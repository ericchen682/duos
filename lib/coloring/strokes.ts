import { hexToRgb } from "@/lib/coloring/colorUtils";

export type PenTool = "pen" | "marker" | "pencil" | "crayon" | "highlighter" | "airbrush";
export type Tool = PenTool | "fill" | "eraser";

export const PEN_TOOLS: PenTool[] = [
  "pen",
  "marker",
  "pencil",
  "crayon",
  "highlighter",
  "airbrush",
];

export const DEFAULT_TOOL_SIZES: Record<PenTool | "eraser", number> = {
  pen: 14,
  marker: 28,
  pencil: 8,
  crayon: 22,
  highlighter: 36,
  airbrush: 24,
  eraser: 14,
};

export const TOOL_SIZE_MIN = 4;
export const TOOL_SIZE_MAX = 64;

export function isPenTool(tool: Tool): tool is PenTool {
  return PEN_TOOLS.includes(tool as PenTool);
}

export function toolUsesSize(tool: Tool): boolean {
  return tool !== "fill";
}

/**
 * Width multiplier for stylus pressure (Apple Pencil). Tools with a rigid tip
 * (marker felt, highlighter chisel) stay fixed-width; soft tools swell from a
 * light hairline to ~1.5x at full press. 0.5 pressure (also the mouse default)
 * lands near 1x so pointer type doesn't change the baseline feel.
 */
export function pressureWidthScale(tool: Tool, pressure: number): number {
  if (tool === "marker" || tool === "highlighter" || tool === "fill") return 1;
  const p = Math.min(1, Math.max(0.05, pressure));
  return 0.45 + p * 1.1;
}

function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function lerpPoints(
  from: { x: number; y: number },
  to: { x: number; y: number },
  step: number
): { x: number; y: number }[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist < step) return [to];
  const n = Math.ceil(dist / step);
  const pts: { x: number; y: number }[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    pts.push({ x: from.x + dx * t, y: from.y + dy * t });
  }
  return pts;
}

function airbrushDab(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string
) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, rgba(color, 0.5));
  g.addColorStop(0.45, rgba(color, 0.18));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function crayonDab(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string
) {
  const grains = 5;
  for (let i = 0; i < grains; i++) {
    const ox = (Math.random() - 0.5) * radius * 0.7;
    const oy = (Math.random() - 0.5) * radius * 0.7;
    ctx.globalAlpha = 0.14 + Math.random() * 0.14;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + ox, y + oy, radius * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/**
 * Opacity at which a whole highlighter stroke is composited over the paint
 * layer. Individual strokes are uniform at this alpha no matter how much they
 * self-overlap; separate strokes still stack translucently.
 */
export const HIGHLIGHTER_ALPHA = 0.35;

/** Fixed chisel angle (45°): unit offset from a point to the tip's edge. */
const CHISEL_UX = Math.SQRT1_2;
const CHISEL_UY = -Math.SQRT1_2;

/**
 * Paint one OPAQUE chisel-tip highlighter segment. Callers are expected to
 * accumulate these into an offscreen stroke buffer and composite the whole
 * buffer at HIGHLIGHTER_ALPHA (once per frame for preview, once on commit) so
 * self-overlap within a stroke never darkens.
 *
 * The tip is a flat bar at a constant 45° angle; a segment is the parallelogram
 * swept between the two tip positions. Because the angle is fixed, consecutive
 * segments share an exact edge at their joint — no caps, no seams, and cheap
 * enough to run per pointermove.
 */
export function paintHighlighterSegment(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  size: number,
  color: string
) {
  const half = (size * 1.35) / 2;
  const ox = CHISEL_UX * half;
  const oy = CHISEL_UY * half;

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = color;
  ctx.strokeStyle = color;

  // Flat tip footprint at both ends (also what a stationary tap leaves, and it
  // keeps strokes visible when dragging parallel to the chisel edge).
  ctx.lineCap = "butt";
  ctx.lineWidth = Math.max(2, size * 0.18);
  ctx.beginPath();
  ctx.moveTo(from.x - ox, from.y - oy);
  ctx.lineTo(from.x + ox, from.y + oy);
  ctx.moveTo(to.x - ox, to.y - oy);
  ctx.lineTo(to.x + ox, to.y + oy);
  // Center line keeps the mark continuous when the drag direction is parallel
  // to the chisel edge (degenerate parallelogram); elsewhere it is hidden
  // inside the opaque parallelogram.
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();

  // Parallelogram swept by the tip between the two points.
  if (from.x !== to.x || from.y !== to.y) {
    ctx.beginPath();
    ctx.moveTo(from.x - ox, from.y - oy);
    ctx.lineTo(to.x - ox, to.y - oy);
    ctx.lineTo(to.x + ox, to.y + oy);
    ctx.lineTo(from.x + ox, from.y + oy);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function dotAt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha = 1
) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** Paint a stroke segment for pen-like tools (not fill). */
export function paintStroke(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  tool: PenTool | "eraser",
  size: number,
  color: string
) {
  if (tool === "eraser") {
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = size;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    dotAt(ctx, to.x, to.y, size / 2, "rgba(0,0,0,1)");
    ctx.restore();
    return;
  }

  ctx.save();

  switch (tool) {
    case "pen": {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = size;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      dotAt(ctx, to.x, to.y, size / 2, color);
      break;
    }
    case "marker": {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineCap = "square";
      ctx.lineJoin = "miter";
      ctx.lineWidth = size * 1.15;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      dotAt(ctx, to.x, to.y, (size * 1.15) / 2, color);
      break;
    }
    case "pencil": {
      const w = Math.max(2, size * 0.7);
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = rgba(color, 0.55);
      ctx.fillStyle = rgba(color, 0.55);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(from.x + (Math.random() - 0.5), from.y + (Math.random() - 0.5));
      ctx.lineTo(to.x + (Math.random() - 0.5), to.y + (Math.random() - 0.5));
      ctx.stroke();
      dotAt(ctx, to.x, to.y, w / 2, color, 0.55);
      break;
    }
    case "crayon": {
      ctx.globalCompositeOperation = "source-over";
      const step = Math.max(3, size / 5);
      const pts = lerpPoints(from, to, step);
      for (const pt of pts) {
        crayonDab(ctx, pt.x, pt.y, size / 2, color);
      }
      break;
    }
    case "highlighter": {
      // Legacy direct path (per-segment alpha). ColoringCanvas instead routes
      // highlighter segments through paintHighlighterSegment into an offscreen
      // stroke buffer so alpha stays uniform within a stroke.
      ctx.globalAlpha = HIGHLIGHTER_ALPHA;
      paintHighlighterSegment(ctx, from, to, size, color);
      ctx.globalAlpha = 1;
      break;
    }
    case "airbrush": {
      ctx.globalCompositeOperation = "source-over";
      const step = Math.max(2, size / 6);
      const pts = lerpPoints(from, to, step);
      for (const pt of pts) {
        airbrushDab(ctx, pt.x, pt.y, size / 2, color);
      }
      break;
    }
  }

  ctx.restore();
}
