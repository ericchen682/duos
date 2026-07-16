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
import { paintStroke } from "@/lib/coloring/strokes";
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

    // Drawing state.
    const drawingRef = useRef(false);
    const lastRef = useRef<{ x: number; y: number } | null>(null);

    // History (index-based full-state snapshots).
    const historyRef = useRef<ImageData[]>([]);
    const historyIndexRef = useRef(0);

    const [ready, setReady] = useState(false);

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
      // Line art is drawn with "multiply" so a white/opaque line-art background
      // keeps the paint visible underneath while the dark outlines stay dark.
      ctx.globalCompositeOperation = "multiply";
      ctx.drawImage(line, 0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";
      if (overlayRef.current) ctx.drawImage(overlayRef.current, 0, 0);
    }, [width, height]);

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
    }, [width, height, emitHistory]);

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
      onReadyChange?.(false);

      (async () => {
        const img = await loadImage(pageSrc);
        if (cancelled) return;
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

        historyRef.current = [pctx.getImageData(0, 0, width, height)];
        historyIndexRef.current = 0;
        emitHistory();

        redraw();
        setReady(true);
        onReadyChange?.(true);
      })();

      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageSrc, width, height, role, JSON.stringify(split)]);

    const toCanvasCoords = (e: React.PointerEvent) => {
      const display = displayRef.current;
      if (!display) return { x: 0, y: 0 };
      const rect = display.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * width,
        y: ((e.clientY - rect.top) / rect.height) * height,
      };
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
      to: { x: number; y: number }
    ) => {
      const ctx = paintCtxRef.current;
      if (!ctx) return;
      const size = sizeRef.current;
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
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      const pt = toCanvasCoords(e);
      if (toolRef.current === "fill") {
        doFill(pt);
        return;
      }
      drawingRef.current = true;
      lastRef.current = pt;
      strokeSegment(pt, pt);
      redraw();
    };

    const onPointerMove = (e: React.PointerEvent) => {
      if (!drawingRef.current) return;
      e.preventDefault();
      const pt = toCanvasCoords(e);
      const last = lastRef.current ?? pt;
      strokeSegment(last, pt);
      lastRef.current = pt;
      redraw();
    };

    const endStroke = () => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      lastRef.current = null;
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
          }
        },
        redo() {
          if (historyIndexRef.current < historyRef.current.length - 1) {
            historyIndexRef.current += 1;
            restore(historyIndexRef.current);
            emitHistory();
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
      [restore, emitHistory, redraw, snapshot, width, height]
    );

    return (
      <div className="relative w-full">
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
          className="no-touch-scroll block w-full rounded-2xl border border-slate-200 bg-white shadow-sm"
          style={{ aspectRatio: `${width} / ${height}`, cursor: "crosshair" }}
        />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/70 text-sm font-semibold text-slate-500">
            Preparing your half…
          </div>
        )}
      </div>
    );
  }
);
