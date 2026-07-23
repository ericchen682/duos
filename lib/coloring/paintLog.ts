import { floodFill, hexToRgba } from "@/lib/coloring/floodFill";
import {
  HIGHLIGHTER_ALPHA,
  paintHighlighterSegment,
  paintStroke,
} from "@/lib/coloring/strokes";
import type { PenTool } from "@/lib/coloring/strokes";

/**
 * Local persistence of the in-progress drawing as a replayable operation log.
 *
 * Instead of snapshotting pixels, every committed action (stroke, fill, clear)
 * is recorded as the recipe to reproduce it and the log is saved to
 * localStorage — compact enough that vector data fits comfortably in the
 * ~5MB quota, and resolution-independent (a log saved at one canvas size can
 * be replayed at another). Restoring replays the log through the same paint
 * routines the live canvas uses.
 *
 * Fidelity notes: crayon/pencil grain uses Math.random(), so a replayed stroke
 * has the same shape, color, and style but not bit-identical texture. Fills
 * replay from their original seed against the replayed paint state, in order,
 * so they stay inside the same outlines.
 */

export type StrokeTool = PenTool | "eraser";

export type PaintOp =
  | {
      t: "s";
      tool: StrokeTool;
      color: string;
      size: number;
      /** Flattened [x, y, widthScale, ...] samples in canvas pixels. */
      pts: number[];
    }
  | { t: "f"; color: string; x: number; y: number }
  | { t: "c" };

interface SavedPaintLog {
  v: number;
  ts: number;
  w: number;
  h: number;
  ops: PaintOp[];
}

/** Flood-fill tolerance shared by live fills and replay — must stay in sync. */
export const FILL_TOLERANCE = 48;

const PREFIX = "duos:paintlog:";
const VERSION = 1;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

const storageKey = (key: string) => PREFIX + key;

/** Remove expired or unparsable logs; optionally spare one key. */
export function prunePaintLogs(exceptKey?: string): void {
  if (typeof window === "undefined") return;
  try {
    const spare = exceptKey ? storageKey(exceptKey) : null;
    const now = Date.now();
    const remove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(PREFIX) || k === spare) continue;
      try {
        const parsed = JSON.parse(window.localStorage.getItem(k) ?? "") as SavedPaintLog;
        if (parsed?.v !== VERSION || !Array.isArray(parsed.ops) || now - parsed.ts > TTL_MS) {
          remove.push(k);
        }
      } catch {
        remove.push(k);
      }
    }
    remove.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // storage unavailable — persistence is best-effort
  }
}

/** Remove every saved log except the given key (quota fallback). */
function evictOtherPaintLogs(exceptKey: string): void {
  try {
    const spare = storageKey(exceptKey);
    const remove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(PREFIX) && k !== spare) remove.push(k);
    }
    remove.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // best-effort
  }
}

export function removePaintLog(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(key));
  } catch {
    // best-effort
  }
}

export function savePaintLog(
  key: string,
  ops: PaintOp[],
  width: number,
  height: number
): void {
  if (typeof window === "undefined") return;
  const value = JSON.stringify({
    v: VERSION,
    ts: Date.now(),
    w: width,
    h: height,
    ops,
  } satisfies SavedPaintLog);
  try {
    window.localStorage.setItem(storageKey(key), value);
  } catch {
    // Quota exceeded (or storage disabled): drop expired logs, then other
    // drawings' logs, then give up — the next commit will retry.
    prunePaintLogs(key);
    try {
      window.localStorage.setItem(storageKey(key), value);
    } catch {
      evictOtherPaintLogs(key);
      try {
        window.localStorage.setItem(storageKey(key), value);
      } catch (err) {
        console.warn("duos: could not save drawing locally:", err);
      }
    }
  }
}

/**
 * Load the saved op log for a key, rescaled to the given canvas size if it was
 * recorded at a different one. Returns null when absent, expired, or invalid.
 */
export function loadPaintLog(
  key: string,
  width: number,
  height: number
): PaintOp[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedPaintLog;
    if (parsed?.v !== VERSION || !Array.isArray(parsed.ops)) return null;
    if (Date.now() - parsed.ts > TTL_MS) return null;
    if (!(parsed.w > 0) || !(parsed.h > 0)) return null;
    if (parsed.w === width && parsed.h === height) return parsed.ops;
    return rescaleOps(parsed.ops, width / parsed.w, height / parsed.h);
  } catch {
    return null;
  }
}

function rescaleOps(ops: PaintOp[], sx: number, sy: number): PaintOp[] {
  const ss = (sx + sy) / 2;
  return ops.map((op) => {
    if (op.t === "f") return { ...op, x: op.x * sx, y: op.y * sy };
    if (op.t === "s") {
      const pts = op.pts.slice();
      for (let i = 0; i + 2 < pts.length; i += 3) {
        pts[i] *= sx;
        pts[i + 1] *= sy;
      }
      return { ...op, size: op.size * ss, pts };
    }
    return op;
  });
}

export interface ReplayEnv {
  /** The paint layer's 2d context (must allow getImageData for fills). */
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  mask: Uint8Array | null;
  maskCanvas: HTMLCanvasElement | null;
  lineData: ImageData | null;
}

/**
 * Replay a log onto a (typically blank) paint layer, mirroring the live paint
 * paths: pen-like strokes segment-by-segment then clipped to the mask,
 * highlighter strokes accumulated opaque in a buffer and composited once at
 * HIGHLIGHTER_ALPHA, fills through the same floodFill with the same tolerance.
 */
export function replayPaintLog(ops: PaintOp[], env: ReplayEnv): void {
  const { ctx, width, height, mask, maskCanvas, lineData } = env;

  const clip = (c: CanvasRenderingContext2D) => {
    if (!maskCanvas) return;
    c.globalCompositeOperation = "destination-in";
    c.drawImage(maskCanvas, 0, 0);
    c.globalCompositeOperation = "source-over";
  };

  let scratch: CanvasRenderingContext2D | null = null;

  for (const op of ops) {
    if (op.t === "c") {
      ctx.clearRect(0, 0, width, height);
      continue;
    }

    if (op.t === "f") {
      const paintData = ctx.getImageData(0, 0, width, height);
      const changed = floodFill(paintData, lineData, mask, op.x, op.y, hexToRgba(op.color), {
        tolerance: FILL_TOLERANCE,
      });
      if (changed) ctx.putImageData(paintData, 0, 0);
      continue;
    }

    const { pts } = op;
    const n = Math.floor(pts.length / 3);
    if (n === 0) continue;
    const at = (i: number) => ({ x: pts[i * 3], y: pts[i * 3 + 1] });
    const scaleAt = (i: number) => pts[i * 3 + 2];

    if (op.tool === "highlighter") {
      if (!scratch) {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        scratch = canvas.getContext("2d");
        if (!scratch) continue;
      }
      scratch.clearRect(0, 0, width, height);
      let prev = at(0);
      paintHighlighterSegment(scratch, prev, prev, op.size * scaleAt(0), op.color);
      for (let i = 1; i < n; i++) {
        const cur = at(i);
        paintHighlighterSegment(scratch, prev, cur, op.size * scaleAt(i), op.color);
        prev = cur;
      }
      clip(scratch);
      ctx.globalAlpha = HIGHLIGHTER_ALPHA;
      ctx.drawImage(scratch.canvas, 0, 0);
      ctx.globalAlpha = 1;
      continue;
    }

    let prev = at(0);
    paintStroke(ctx, prev, prev, op.tool, op.size * scaleAt(0), op.color);
    for (let i = 1; i < n; i++) {
      const cur = at(i);
      paintStroke(ctx, prev, cur, op.tool, op.size * scaleAt(i), op.color);
      prev = cur;
    }
    // Live painting clips after every segment; clipping once per stroke is
    // equivalent (destination-in with the same mask is idempotent) and faster.
    if (op.tool !== "eraser") clip(ctx);
  }
}
