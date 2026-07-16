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
      // source-over + low alpha: multiply stacks too aggressively on self-overlap while dragging.
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = rgba(color, 0.2);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = size * 1.35;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
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
