import type { Point, SplitData, SplitPreset } from "./types";

/** Clamp a value into the [0,1] range. */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Build normalized SplitData for one of the built-in presets. */
export function presetSplit(preset: SplitPreset): SplitData {
  switch (preset) {
    case "vertical":
      return {
        path: [
          { x: 0.5, y: 0 },
          { x: 0.5, y: 1 },
        ],
        seedA: { x: 0.25, y: 0.5 },
        seedB: { x: 0.75, y: 0.5 },
      };
    case "horizontal":
      return {
        path: [
          { x: 0, y: 0.5 },
          { x: 1, y: 0.5 },
        ],
        seedA: { x: 0.5, y: 0.25 },
        seedB: { x: 0.5, y: 0.75 },
      };
    case "diagonal":
      return {
        path: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        seedA: { x: 0.72, y: 0.28 },
        seedB: { x: 0.28, y: 0.72 },
      };
  }
}

/**
 * Given a freehand dividing path (normalized), pick two seed points on opposite
 * sides of the curve by stepping along the path's midpoint normal.
 */
export function computeSeedsForPath(path: Point[]): {
  seedA: Point;
  seedB: Point;
} {
  if (path.length < 2) {
    return { seedA: { x: 0.25, y: 0.5 }, seedB: { x: 0.75, y: 0.5 } };
  }
  const mid = path[Math.floor(path.length / 2)];
  const start = path[0];
  const end = path[path.length - 1];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  // Perpendicular unit vector to the overall path direction.
  const nx = -dy / len;
  const ny = dx / len;
  const offset = 0.22;
  return {
    seedA: { x: clamp01(mid.x + nx * offset), y: clamp01(mid.y + ny * offset) },
    seedB: { x: clamp01(mid.x - nx * offset), y: clamp01(mid.y - ny * offset) },
  };
}

/**
 * Extend the first and last points of a path outward to the nearest image edge
 * so the dividing curve always fully separates the canvas into two regions.
 */
export function extendPathToEdges(path: Point[]): Point[] {
  if (path.length < 2) return path;
  const result = [...path];

  const snapToEdge = (p: Point): Point => {
    const distances = [
      { edge: "left", d: p.x },
      { edge: "right", d: 1 - p.x },
      { edge: "top", d: p.y },
      { edge: "bottom", d: 1 - p.y },
    ].sort((a, b) => a.d - b.d);
    const nearest = distances[0].edge;
    switch (nearest) {
      case "left":
        return { x: 0, y: p.y };
      case "right":
        return { x: 1, y: p.y };
      case "top":
        return { x: p.x, y: 0 };
      default:
        return { x: p.x, y: 1 };
    }
  };

  result[0] = snapToEdge(result[0]);
  result[result.length - 1] = snapToEdge(result[result.length - 1]);
  return result;
}
