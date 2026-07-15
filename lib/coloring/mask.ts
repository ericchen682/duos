import type { PlayerRole, Point, SplitData } from "../types";

/** Draw a filled disc of the given radius into a barrier buffer. */
function stamp(
  barrier: Uint8Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number
): void {
  const r2 = radius * radius;
  for (let dy = -radius; dy <= radius; dy++) {
    const y = cy + dy;
    if (y < 0 || y >= height) continue;
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > r2) continue;
      const x = cx + dx;
      if (x < 0 || x >= width) continue;
      barrier[y * width + x] = 1;
    }
  }
}

/** Rasterize a thick polyline into a barrier buffer (Bresenham + disc stamp). */
function drawThickPolyline(
  barrier: Uint8Array,
  width: number,
  height: number,
  points: Point[],
  thickness: number
): void {
  const radius = Math.max(1, Math.round(thickness / 2));
  for (let s = 0; s < points.length - 1; s++) {
    let x0 = Math.round(points[s].x * (width - 1));
    let y0 = Math.round(points[s].y * (height - 1));
    const x1 = Math.round(points[s + 1].x * (width - 1));
    const y1 = Math.round(points[s + 1].y * (height - 1));
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      stamp(barrier, width, height, x0, y0, radius);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
}

/**
 * Flood a region from a normalized seed over all non-barrier pixels using a
 * scanline fill. Returns a per-pixel Uint8Array (1 = inside region).
 */
function fillRegion(
  barrier: Uint8Array,
  width: number,
  height: number,
  seed: Point
): Uint8Array {
  const mask = new Uint8Array(width * height);
  const sx = Math.min(width - 1, Math.max(0, Math.round(seed.x * (width - 1))));
  const sy = Math.min(height - 1, Math.max(0, Math.round(seed.y * (height - 1))));
  if (barrier[sy * width + sx] === 1) return mask;

  const stack: number[] = [sx, sy];
  while (stack.length > 0) {
    const y = stack.pop() as number;
    const x = stack.pop() as number;

    let lx = x;
    while (lx >= 0 && barrier[y * width + lx] === 0 && mask[y * width + lx] === 0) {
      lx--;
    }
    lx++;

    let spanUp = false;
    let spanDown = false;
    for (
      let cx = lx;
      cx < width && barrier[y * width + cx] === 0 && mask[y * width + cx] === 0;
      cx++
    ) {
      mask[y * width + cx] = 1;
      if (y > 0) {
        const ap = (y - 1) * width + cx;
        if (barrier[ap] === 0 && mask[ap] === 0) {
          if (!spanUp) {
            stack.push(cx, y - 1);
            spanUp = true;
          }
        } else {
          spanUp = false;
        }
      }
      if (y < height - 1) {
        const bp = (y + 1) * width + cx;
        if (barrier[bp] === 0 && mask[bp] === 0) {
          if (!spanDown) {
            stack.push(cx, y + 1);
            spanDown = true;
          }
        } else {
          spanDown = false;
        }
      }
    }
  }
  return mask;
}

/**
 * Derive the paint mask for a player's region at the given raster resolution.
 *
 * The dividing path is drawn as a barrier; region A is flooded from seedA and
 * region B from seedB. Region A additionally absorbs the barrier seam so the two
 * halves overlap by a pixel or two and leave no unpainted gap in the reveal.
 */
export function deriveMask(
  width: number,
  height: number,
  split: SplitData,
  role: PlayerRole
): Uint8Array {
  const barrier = new Uint8Array(width * height);
  const thickness = Math.max(3, Math.round(Math.min(width, height) * 0.006));
  drawThickPolyline(barrier, width, height, split.path, thickness);

  const seed = role === "A" ? split.seedA : split.seedB;
  const mask = fillRegion(barrier, width, height, seed);

  if (role === "A") {
    for (let i = 0; i < mask.length; i++) {
      if (barrier[i] === 1) mask[i] = 1;
    }
  }
  return mask;
}
