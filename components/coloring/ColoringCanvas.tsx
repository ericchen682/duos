"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { floodFill, hexToRgba } from "@/lib/coloring/floodFill";
import {
  imageToImageData,
  loadImage,
  maskToCanvas,
  overlayOutsideMask,
} from "@/lib/coloring/imageUtils";
import { deriveMask } from "@/lib/coloring/mask";
import { loadPaint, pruneStalePaints, savePaint } from "@/lib/coloring/paintStorage";
import {
  HIGHLIGHTER_ALPHA,
  paintHighlighterSegment,
  paintStroke,
  pressureWidthScale,
} from "@/lib/coloring/strokes";
import type { PlayerRole, SplitData } from "@/lib/types";
import type { Tool } from "@/lib/coloring/strokes";

const MAX_HISTORY = 14;

export interface ColoringCanvasHandle {
  undo: () => void;
  redo: () => void;
  clear: () => void;
  exportHalfBlob: () => Promise<Blob | null>;
}

interface ColoringCanvasProps {
  pageSrc: string;
  width: number;
  height: number;
  split: SplitData;
  role: PlayerRole;
  tool: Tool;
  color: string;
  brushSize: number;
  onReadyChange?: (ready: boolean) => void;
  onHistoryChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
  /** When set, the paint layer is saved locally under this key and restored on
      mount — refreshes and done/keep-coloring remounts keep the drawing. */
  persistKey?: string;
}

export const ColoringCanvas = forwardRef<ColoringCanvasHandle, ColoringCanvasProps>(
  function ColoringCanvas(
    {
      pageSrc,
      width,
      height,
      split,
      role,
      tool,
      color,
      brushSize,
      onReadyChange,
      onHistoryChange,
      persistKey,
    },
    ref
  ) {
    const displayRef = useRef<HTMLCanvasElement>(null);

    // Offscreen state.
    const paintRef = useRef<HTMLCanvasElement | null>(null);
    const paintCtxRef = useRef<CanvasRenderingContext2D | null>(null);
    const lineImgRef = useRef<HTMLImageElement | null>(null);
    const lineDataRef = useRef<ImageData | null>(null);
    const maskRef = useRef<Uint8Array | null>(null);
    const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const overlayRef = useRef<HTMLCanvasElement | null>(null);

    // Live tool values (avoid rebinding pointer handlers).
    const toolRef = useRef(tool);
    const colorRef = useRef(color);
    const sizeRef = useRef(brushSize);
    useEffect(() => {
      toolRef.current = tool;
    }, [tool]);
    useEffect(() => {
      colorRef.current = color;
    }, [color]);
    useEffect(() => {
      sizeRef.current = brushSize;
    }, [brushSize]);

    // Drawing state. Exactly one pointer draws at a time; extra touches (a
    // resting palm, a second finger) are ignored while it is active.
    const drawingRef = useRef(false);
    const lastRef = useRef<{ x: number; y: number } | null>(null);
    const activePointerRef = useRef<{ id: number; type: string } | null>(null);
    const strokeStartRef = useRef(0);

    // Pinch-zoom view: CSS transform on the canvas wrapper, so pointer→canvas
    // math keeps working unchanged (getBoundingClientRect reflects the scale).
    const viewportRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef({ scale: 1, tx: 0, ty: 0 });
    const touchPtsRef = useRef(new Map<number, { x: number; y: number }>());
    const pinchRef = useRef<{
      ids: [number, number];
      d0: number;
      m0: { x: number; y: number };
      s0: number;
      tx0: number;
      ty0: number;
      rect: DOMRect;
    } | null>(null);
    // Pointers that must not draw for the rest of their contact (pinch
    // fingers, the finger left over after a pinch, palms during a stroke).
    const consumedRef = useRef(new Set<number>());
    const zoomPillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [zoomPct, setZoomPct] = useState(100);
    const [showZoomPill, setShowZoomPill] = useState(false);
    // Apple Pencil: timestamp of the last pen CONTACT (down/drawing-move/up —
    // hover deliberately excluded, or a pencil held near the screen would
    // silently block finger coloring), plus smoothed pressure for width.
    const lastPenTimeRef = useRef(0);
    const pressureRef = useRef(0.5);

    // Highlighter stroke buffer: the in-progress stroke is accumulated OPAQUE
    // here, previewed over the paint layer at HIGHLIGHTER_ALPHA each frame, and
    // composited onto the paint layer once on stroke end. That keeps opacity
    // uniform within a stroke (self-overlap never darkens) while separate
    // strokes still layer translucently. One buffer, reused across strokes.
    const strokeBufRef = useRef<HTMLCanvasElement | null>(null);
    const strokeBufCtxRef = useRef<CanvasRenderingContext2D | null>(null);
    const highlighterActiveRef = useRef(false);

    // History (index-based full-state snapshots).
    const historyRef = useRef<ImageData[]>([]);
    const historyIndexRef = useRef(0);

    const [ready, setReady] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);
    const [retryNonce, setRetryNonce] = useState(0);

    const emitHistory = useCallback(() => {
      onHistoryChange?.({
        canUndo: historyIndexRef.current > 0,
        canRedo: historyIndexRef.current < historyRef.current.length - 1,
      });
    }, [onHistoryChange]);

    const redraw = useCallback(() => {
      const display = displayRef.current;
      const paint = paintRef.current;
      const line = lineImgRef.current;
      if (!display || !paint || !line) return;
      const ctx = display.getContext("2d");
      if (!ctx) return;
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(paint, 0, 0);
      // Live highlighter preview: the whole in-progress stroke at fixed alpha.
      if (highlighterActiveRef.current && strokeBufRef.current) {
        ctx.globalAlpha = HIGHLIGHTER_ALPHA;
        ctx.drawImage(strokeBufRef.current, 0, 0);
        ctx.globalAlpha = 1;
      }
      // Line art is drawn with "multiply" so a white/opaque line-art background
      // keeps the paint visible underneath while the dark outlines stay dark.
      ctx.globalCompositeOperation = "multiply";
      ctx.drawImage(line, 0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";
      if (overlayRef.current) ctx.drawImage(overlayRef.current, 0, 0);
    }, [width, height]);

    // Debounced local save of the paint layer, so refreshes and remounts
    // (submit / keep coloring) restore the drawing instead of wiping it.
    const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const persistDirtyRef = useRef(false);

    const flushPersist = useCallback(() => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      if (!persistKey || !persistDirtyRef.current) return;
      const paint = paintRef.current;
      if (!paint) return;
      persistDirtyRef.current = false;
      savePaint(persistKey, paint.toDataURL("image/png"));
    }, [persistKey]);

    const schedulePersist = useCallback(() => {
      if (!persistKey) return;
      persistDirtyRef.current = true;
      if (persistTimerRef.current) return;
      persistTimerRef.current = setTimeout(() => {
        persistTimerRef.current = null;
        flushPersist();
      }, 500);
    }, [persistKey, flushPersist]);

    // A pending save must survive losing the component or the page.
    useEffect(() => {
      const onPageHide = () => flushPersist();
      window.addEventListener("pagehide", onPageHide);
      return () => {
        window.removeEventListener("pagehide", onPageHide);
        flushPersist();
      };
    }, [flushPersist]);

    const snapshot = useCallback(() => {
      const ctx = paintCtxRef.current;
      if (!ctx) return;
      const state = ctx.getImageData(0, 0, width, height);
      const stack = historyRef.current;
      // Drop any redo branch, then push.
      stack.splice(historyIndexRef.current + 1);
      stack.push(state);
      if (stack.length > MAX_HISTORY) {
        stack.shift();
      }
      historyIndexRef.current = stack.length - 1;
      emitHistory();
      schedulePersist();
    }, [width, height, emitHistory, schedulePersist]);

    const restore = useCallback(
      (index: number) => {
        const ctx = paintCtxRef.current;
        const state = historyRef.current[index];
        if (!ctx || !state) return;
        ctx.putImageData(state, 0, 0);
        redraw();
      },
      [redraw]
    );

    // Initialize everything when the page/split/role/size changes.
    useEffect(() => {
      let cancelled = false;
      setReady(false);
      setLoadFailed(false);
      onReadyChange?.(false);

      // A flaky connection must not brick the canvas: retry with backoff, and
      // on total failure surface a retry button instead of the eternal
      // "Preparing your half…" overlay.
      const loadImageWithRetry = async (src: string, tries = 3) => {
        let lastErr: unknown;
        for (let attempt = 0; attempt < tries; attempt++) {
          try {
            return await loadImage(src);
          } catch (err) {
            lastErr = err;
            await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
            if (cancelled) throw err;
          }
        }
        throw lastErr;
      };

      (async () => {
        const img = await loadImageWithRetry(pageSrc).catch((err) => {
          if (!cancelled) setLoadFailed(true);
          console.error(err);
          return null;
        });
        if (cancelled || !img) return;
        lineImgRef.current = img;
        lineDataRef.current = imageToImageData(img, width, height);

        const mask = deriveMask(width, height, split, role);
        maskRef.current = mask;
        maskCanvasRef.current = maskToCanvas(mask, width, height);
        overlayRef.current = overlayOutsideMask(mask, width, height);

        const paint = document.createElement("canvas");
        paint.width = width;
        paint.height = height;
        const pctx = paint.getContext("2d", { willReadFrequently: true });
        if (!pctx) return;
        paintRef.current = paint;
        paintCtxRef.current = pctx;
        persistDirtyRef.current = false;

        // Restore the locally saved drawing, if any.
        if (persistKey) {
          pruneStalePaints(persistKey);
          const saved = loadPaint(persistKey);
          if (saved) {
            try {
              const savedImg = await loadImage(saved);
              if (cancelled) return;
              pctx.drawImage(savedImg, 0, 0, width, height);
            } catch {
              // corrupt entry — start fresh
            }
          }
        }

        const strokeBuf = document.createElement("canvas");
        strokeBuf.width = width;
        strokeBuf.height = height;
        const sctx = strokeBuf.getContext("2d");
        if (!sctx) return;
        strokeBufRef.current = strokeBuf;
        strokeBufCtxRef.current = sctx;
        highlighterActiveRef.current = false;

        historyRef.current = [pctx.getImageData(0, 0, width, height)];
        historyIndexRef.current = 0;
        emitHistory();

        // Fresh page starts at fit.
        viewRef.current = { scale: 1, tx: 0, ty: 0 };
        if (contentRef.current) contentRef.current.style.transform = "";
        setZoomPct(100);

        redraw();
        setReady(true);
        onReadyChange?.(true);
      })();

      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageSrc, width, height, role, JSON.stringify(split), retryNonce, persistKey]);

    // Trackpad pinch and ctrl+wheel zoom at the cursor (macOS trackpads emit
    // pinch as ctrl+wheel). Native non-passive listener: React's root wheel
    // listener is passive, so preventDefault would be ignored there.
    useEffect(() => {
      const vp = viewportRef.current;
      const content = contentRef.current;
      if (!vp || !content) return;
      const onWheel = (e: WheelEvent) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        const rect = vp.getBoundingClientRect();
        const m = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const { scale, tx, ty } = viewRef.current;
        const target = Math.min(4, Math.max(1, scale * Math.exp(-e.deltaY * 0.01)));
        const wx = (m.x - tx) / scale;
        const wy = (m.y - ty) / scale;
        const minTx = vp.clientWidth * (1 - target);
        const minTy = vp.clientHeight * (1 - target);
        const cx = Math.min(0, Math.max(minTx, m.x - wx * target));
        const cy = Math.min(0, Math.max(minTy, m.y - wy * target));
        viewRef.current = { scale: target, tx: cx, ty: cy };
        content.style.transform = `translate(${cx}px, ${cy}px) scale(${target})`;
        setZoomPct(Math.round(target * 100));
        setShowZoomPill(true);
        if (zoomPillTimerRef.current) clearTimeout(zoomPillTimerRef.current);
        zoomPillTimerRef.current = setTimeout(() => setShowZoomPill(false), 700);
      };
      vp.addEventListener("wheel", onWheel, { passive: false });
      return () => vp.removeEventListener("wheel", onWheel);
    }, []);

    const toCanvasCoords = (e: { clientX: number; clientY: number }) => {
      const display = displayRef.current;
      if (!display) return { x: 0, y: 0 };
      const rect = display.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * width,
        y: ((e.clientY - rect.top) / rect.height) * height,
      };
    };

    // Touches this soon after any pen activity are treated as a resting palm.
    const TOUCH_REJECT_MS = 500;

    const notePenActivity = (e: { pointerType: string }) => {
      if (e.pointerType === "pen") lastPenTimeRef.current = performance.now();
    };

    const isPalmTouch = (e: React.PointerEvent) =>
      e.pointerType === "touch" &&
      (activePointerRef.current?.type === "pen" ||
        performance.now() - lastPenTimeRef.current < TOUCH_REJECT_MS);

    /** Width multiplier for the current segment; pressure only counts for pens. */
    const segmentScale = (pointerType: string, rawPressure: number) => {
      if (pointerType !== "pen") return 1;
      // Light smoothing keeps width from flickering at 120Hz sample rates.
      pressureRef.current = pressureRef.current * 0.5 + (rawPressure || 0.5) * 0.5;
      return pressureWidthScale(toolRef.current, pressureRef.current);
    };

    // ----- Pinch zoom -----

    const MIN_ZOOM = 1;
    const MAX_ZOOM = 4;
    /** A touch stroke younger than this loses to a landing second finger (pinch). */
    const PINCH_GRACE_MS = 250;

    const applyView = (scale: number, tx: number, ty: number) => {
      const vp = viewportRef.current;
      const content = contentRef.current;
      if (!vp || !content) return;
      const s = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
      // Content is viewport-sized at scale 1; clamp so no gaps appear at edges.
      const minTx = vp.clientWidth * (1 - s);
      const minTy = vp.clientHeight * (1 - s);
      const cx = Math.min(0, Math.max(minTx, tx));
      const cy = Math.min(0, Math.max(minTy, ty));
      viewRef.current = { scale: s, tx: cx, ty: cy };
      content.style.transform = `translate(${cx}px, ${cy}px) scale(${s})`;
      setZoomPct(Math.round(s * 100));
    };

    const flashZoomPill = () => {
      setShowZoomPill(true);
      if (zoomPillTimerRef.current) clearTimeout(zoomPillTimerRef.current);
      zoomPillTimerRef.current = setTimeout(() => setShowZoomPill(false), 700);
    };

    const startPinch = () => {
      const pts = [...touchPtsRef.current.entries()];
      const vp = viewportRef.current;
      if (pts.length !== 2 || !vp) return;
      const [[idA, a], [idB, b]] = pts;
      const rect = vp.getBoundingClientRect();
      pinchRef.current = {
        ids: [idA, idB],
        d0: Math.max(20, Math.hypot(b.x - a.x, b.y - a.y)),
        m0: { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top },
        s0: viewRef.current.scale,
        tx0: viewRef.current.tx,
        ty0: viewRef.current.ty,
        rect,
      };
      consumedRef.current.add(idA);
      consumedRef.current.add(idB);
      // Keep both fingers reporting to the canvas even if they wander off it.
      for (const id of [idA, idB]) {
        try {
          displayRef.current?.setPointerCapture(id);
        } catch {
          // pointer already lifted — updatePinch simply won't see it
        }
      }
      flashZoomPill();
    };

    const updatePinch = () => {
      const pinch = pinchRef.current;
      if (!pinch) return;
      const a = touchPtsRef.current.get(pinch.ids[0]);
      const b = touchPtsRef.current.get(pinch.ids[1]);
      if (!a || !b) return;
      const d = Math.max(20, Math.hypot(b.x - a.x, b.y - a.y));
      const m = {
        x: (a.x + b.x) / 2 - pinch.rect.left,
        y: (a.y + b.y) / 2 - pinch.rect.top,
      };
      const s = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinch.s0 * (d / pinch.d0)));
      // Keep the page point that started under the fingers' midpoint under it.
      const wx = (pinch.m0.x - pinch.tx0) / pinch.s0;
      const wy = (pinch.m0.y - pinch.ty0) / pinch.s0;
      applyView(s, m.x - wx * s, m.y - wy * s);
      flashZoomPill();
    };

    const resetZoom = () => {
      const content = contentRef.current;
      if (!content) return;
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        content.style.transition = "transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)";
        window.setTimeout(() => {
          content.style.transition = "";
        }, 300);
      }
      applyView(1, 0, 0);
      flashZoomPill();
    };

    /** Discard an in-flight stroke's paint (used when a palm stroke loses to the pen). */
    const cancelActiveStroke = () => {
      drawingRef.current = false;
      lastRef.current = null;
      activePointerRef.current = null;
      if (highlighterActiveRef.current) {
        highlighterActiveRef.current = false;
        strokeBufCtxRef.current?.clearRect(0, 0, width, height);
      }
      restore(historyIndexRef.current);
    };

    const clipToMask = () => {
      const ctx = paintCtxRef.current;
      const maskCanvas = maskCanvasRef.current;
      if (!ctx || !maskCanvas) return;
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(maskCanvas, 0, 0);
      ctx.globalCompositeOperation = "source-over";
    };

    const strokeSegment = (
      from: { x: number; y: number },
      to: { x: number; y: number },
      widthScale = 1
    ) => {
      const ctx = paintCtxRef.current;
      if (!ctx) return;
      const size = sizeRef.current * widthScale;

      if (highlighterActiveRef.current) {
        const sctx = strokeBufCtxRef.current;
        const maskCanvas = maskCanvasRef.current;
        if (!sctx) return;
        paintHighlighterSegment(sctx, from, to, size, colorRef.current);
        if (maskCanvas) {
          sctx.globalCompositeOperation = "destination-in";
          sctx.drawImage(maskCanvas, 0, 0);
          sctx.globalCompositeOperation = "source-over";
        }
        return;
      }

      const currentTool = toolRef.current;
      if (currentTool === "fill") return;

      paintStroke(ctx, from, to, currentTool, size, colorRef.current);
      if (currentTool !== "eraser") clipToMask();
    };

    const doFill = (pt: { x: number; y: number }) => {
      const ctx = paintCtxRef.current;
      const line = lineDataRef.current;
      const mask = maskRef.current;
      if (!ctx || !line || !mask) return;
      const px = Math.floor(pt.x);
      const py = Math.floor(pt.y);
      if (px < 0 || py < 0 || px >= width || py >= height) return;
      if (mask[py * width + px] === 0) return; // outside your half
      const paintData = ctx.getImageData(0, 0, width, height);
      const changed = floodFill(paintData, line, mask, px, py, hexToRgba(color), {
        tolerance: 48,
      });
      if (changed) {
        ctx.putImageData(paintData, 0, 0);
        redraw();
        snapshot();
      }
    };

    const onPointerDown = (e: React.PointerEvent) => {
      if (!ready) return;
      e.preventDefault();
      notePenActivity(e);
      // Self-heal: a primary pointer means no other contacts of its type are
      // down, so any bookkeeping still around is left over from a missed
      // pointerup/cancel. Reset it — one dropped event must never wedge the
      // canvas into a "can't color" state until reload.
      if (e.isPrimary) {
        if (e.pointerType === "touch") {
          touchPtsRef.current.clear();
          consumedRef.current.clear();
          pinchRef.current = null;
        }
        if (activePointerRef.current?.type === e.pointerType) {
          endStroke(); // commit whatever the orphaned stroke had painted
        }
      }
      if (e.pointerType === "touch") {
        touchPtsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinchRef.current || touchPtsRef.current.size > 2) {
          consumedRef.current.add(e.pointerId); // third finger etc.
          return;
        }
        if (touchPtsRef.current.size === 2 && activePointerRef.current?.type !== "pen") {
          // Two fingers = zoom. A stroke the first finger just started was the
          // beginning of this gesture, not a mark — undo it and pinch instead.
          const strokeIsYoung =
            drawingRef.current &&
            performance.now() - strokeStartRef.current < PINCH_GRACE_MS;
          if (!drawingRef.current || strokeIsYoung) {
            if (drawingRef.current) cancelActiveStroke();
            startPinch();
            return;
          }
          consumedRef.current.add(e.pointerId); // palm during a committed stroke
          return;
        }
      }
      if (e.pointerType === "pen" && pinchRef.current) return; // no drawing mid-pinch
      // Palm rejection: fingers don't draw while (or just after) the pencil is in use.
      if (isPalmTouch(e)) return;
      if (activePointerRef.current !== null) {
        if (e.pointerType === "pen" && activePointerRef.current.type === "touch") {
          // The pencil landing mid touch-stroke means that touch was a palm:
          // drop its paint and let the pencil take over.
          cancelActiveStroke();
        } else {
          return; // second finger while a stroke is in progress
        }
      }
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      const pt = toCanvasCoords(e);
      if (toolRef.current === "fill") {
        doFill(pt);
        return;
      }
      activePointerRef.current = { id: e.pointerId, type: e.pointerType };
      pressureRef.current = e.pointerType === "pen" ? e.pressure || 0.5 : 0.5;
      drawingRef.current = true;
      strokeStartRef.current = performance.now();
      lastRef.current = pt;
      if (toolRef.current === "highlighter" && strokeBufCtxRef.current) {
        strokeBufCtxRef.current.clearRect(0, 0, width, height);
        highlighterActiveRef.current = true;
      }
      strokeSegment(pt, pt, segmentScale(e.pointerType, e.pressure));
      redraw();
    };

    const onPointerMove = (e: React.PointerEvent) => {
      // Hover moves (pen near the screen, buttons === 0) don't count as pen
      // activity — only actual contact should suppress finger drawing.
      if (e.buttons !== 0) notePenActivity(e);
      if (e.pointerType === "touch" && touchPtsRef.current.has(e.pointerId)) {
        touchPtsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinchRef.current?.ids.includes(e.pointerId)) {
          e.preventDefault();
          updatePinch();
          return;
        }
      }
      if (consumedRef.current.has(e.pointerId)) return;
      if (!drawingRef.current) return;
      if (activePointerRef.current && e.pointerId !== activePointerRef.current.id) return;
      e.preventDefault();
      // Apple Pencil delivers samples faster than pointermove fires; walk the
      // coalesced batch so fast strokes stay smooth instead of chording.
      const native = e.nativeEvent;
      const samples: { clientX: number; clientY: number; pressure: number }[] =
        native.getCoalescedEvents && native.getCoalescedEvents().length > 0
          ? native.getCoalescedEvents()
          : [native];
      let last = lastRef.current ?? toCanvasCoords(samples[0]);
      for (const sample of samples) {
        const pt = toCanvasCoords(sample);
        strokeSegment(last, pt, segmentScale(e.pointerType, sample.pressure));
        last = pt;
      }
      lastRef.current = last;
      redraw();
    };

    const endStroke = (e?: React.PointerEvent) => {
      if (e) {
        notePenActivity(e);
        if (e.pointerType === "touch") {
          touchPtsRef.current.delete(e.pointerId);
          if (pinchRef.current?.ids.includes(e.pointerId)) {
            // Pinch over. The finger still down stays consumed (inert) so it
            // can't start a surprise stroke; it frees itself when it lifts.
            pinchRef.current = null;
            consumedRef.current.delete(e.pointerId);
            return;
          }
          if (consumedRef.current.has(e.pointerId)) {
            consumedRef.current.delete(e.pointerId);
            return;
          }
        }
      }
      if (e && activePointerRef.current && e.pointerId !== activePointerRef.current.id) {
        return; // a rejected palm/second finger lifting must not end the pen stroke
      }
      if (!drawingRef.current) return;
      drawingRef.current = false;
      lastRef.current = null;
      activePointerRef.current = null;
      if (highlighterActiveRef.current) {
        // Commit the whole stroke to the paint layer at fixed alpha (the buffer
        // is already mask-clipped), then drop the preview.
        const ctx = paintCtxRef.current;
        const buf = strokeBufRef.current;
        highlighterActiveRef.current = false;
        if (ctx && buf) {
          ctx.globalAlpha = HIGHLIGHTER_ALPHA;
          ctx.drawImage(buf, 0, 0);
          ctx.globalAlpha = 1;
        }
        redraw();
      }
      snapshot();
    };

    useImperativeHandle(
      ref,
      () => ({
        undo() {
          if (historyIndexRef.current > 0) {
            historyIndexRef.current -= 1;
            restore(historyIndexRef.current);
            emitHistory();
            schedulePersist();
          }
        },
        redo() {
          if (historyIndexRef.current < historyRef.current.length - 1) {
            historyIndexRef.current += 1;
            restore(historyIndexRef.current);
            emitHistory();
            schedulePersist();
          }
        },
        clear() {
          const ctx = paintCtxRef.current;
          if (!ctx) return;
          ctx.clearRect(0, 0, width, height);
          redraw();
          snapshot();
        },
        exportHalfBlob() {
          return new Promise<Blob | null>((resolve) => {
            const paint = paintRef.current;
            if (!paint) return resolve(null);
            paint.toBlob((blob) => resolve(blob), "image/png");
          });
        },
      }),
      [restore, emitHistory, redraw, snapshot, schedulePersist, width, height]
    );

    return (
      <div className="relative w-full">
        <div
          ref={viewportRef}
          className="no-touch-scroll relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          style={{ aspectRatio: `${width} / ${height}` }}
        >
          <div ref={contentRef} className="h-full w-full" style={{ transformOrigin: "0 0" }}>
            <canvas
              ref={displayRef}
              width={width}
              height={height}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endStroke}
              onPointerCancel={endStroke}
              onPointerLeave={endStroke}
              onContextMenu={(e) => e.preventDefault()}
              className="no-touch-scroll block h-full w-full"
              style={{ cursor: "crosshair" }}
            />
          </div>

          {/* Transient zoom readout while pinching */}
          <div
            aria-hidden
            className={`pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-[var(--duos-ink)]/85 px-3 py-1 text-xs font-bold tabular-nums text-white shadow transition-opacity duration-300 ${
              showZoomPill ? "opacity-100" : "opacity-0"
            }`}
          >
            {zoomPct}%
          </div>

          {/* Snap back to fit once zoomed in */}
          {zoomPct > 100 && (
            <button
              type="button"
              onClick={resetZoom}
              aria-label={`Zoomed to ${zoomPct}%. Reset to fit.`}
              className="absolute bottom-3 right-3 z-10 flex h-11 min-w-11 touch-manipulation select-none items-center gap-1.5 rounded-full border border-[var(--duos-border)] bg-white/90 px-3 text-xs font-bold tabular-nums text-[var(--duos-ink)] shadow-md backdrop-blur transition active:scale-95"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M9 3H5a2 2 0 0 0-2 2v4M15 3h4a2 2 0 0 1 2 2v4M9 21H5a2 2 0 0 1-2-2v-4M15 21h4a2 2 0 0 0 2-2v-4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              {zoomPct}%
            </button>
          )}
        </div>
        {!ready && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/70 text-sm font-semibold text-slate-500">
            {loadFailed ? (
              <>
                <p>The page didn&apos;t load. Check your connection.</p>
                <button
                  type="button"
                  onClick={() => setRetryNonce((n) => n + 1)}
                  className="min-h-11 rounded-2xl bg-[var(--duos-accent)] px-5 font-semibold text-white transition active:scale-95"
                >
                  Try again
                </button>
              </>
            ) : (
              "Preparing your half…"
            )}
          </div>
        )}
      </div>
    );
  }
);
