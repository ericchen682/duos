export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface FloodFillOptions {
  /** Color-match tolerance (0 = exact, larger = looser). Default 40. */
  tolerance?: number;
  /** Luminance below which a line-art pixel acts as a hard barrier. Default 110. */
  lineThreshold?: number;
}

/**
 * Scanline flood fill on the paint layer.
 *
 * - `paint` is the mutable paint-layer ImageData that gets filled.
 * - `line` is the (immutable) line-art ImageData used purely as a barrier: dark,
 *   opaque pixels block the fill so color stays inside the outlines.
 * - `mask` restricts the fill to the current player's region (1 = inside).
 *
 * Returns true if any pixel changed.
 */
export function floodFill(
  paint: ImageData,
  line: ImageData | null,
  mask: Uint8Array | null,
  startX: number,
  startY: number,
  fill: RGBA,
  options: FloodFillOptions = {}
): boolean {
  const { width, height, data } = paint;
  const sx = Math.floor(startX);
  const sy = Math.floor(startY);
  if (sx < 0 || sy < 0 || sx >= width || sy >= height) return false;

  const tolerance = options.tolerance ?? 40;
  const lineThreshold = options.lineThreshold ?? 110;
  const tol2 = tolerance * tolerance * 4;

  const lineData = line?.data ?? null;

  const startPix = sy * width + sx;
  const startIdx = startPix * 4;
  const tr = data[startIdx];
  const tg = data[startIdx + 1];
  const tb = data[startIdx + 2];
  const ta = data[startIdx + 3];

  const blocked = (x: number, y: number): boolean => {
    const p = y * width + x;
    if (mask && mask[p] === 0) return true;
    if (lineData) {
      const li = p * 4;
      const la = lineData[li + 3];
      if (la > 16) {
        const lum =
          0.299 * lineData[li] + 0.587 * lineData[li + 1] + 0.114 * lineData[li + 2];
        if (lum < lineThreshold) return true;
      }
    }
    return false;
  };

  const matches = (x: number, y: number): boolean => {
    const i = (y * width + x) * 4;
    const dr = data[i] - tr;
    const dg = data[i + 1] - tg;
    const db = data[i + 2] - tb;
    const da = data[i + 3] - ta;
    return dr * dr + dg * dg + db * db + da * da <= tol2;
  };

  const visited = new Uint8Array(width * height);
  const stack: number[] = [sx, sy];
  let changed = false;

  while (stack.length > 0) {
    const y = stack.pop() as number;
    const x = stack.pop() as number;

    let lx = x;
    while (lx >= 0 && !visited[y * width + lx] && !blocked(lx, y) && matches(lx, y)) {
      lx--;
    }
    lx++;

    let spanUp = false;
    let spanDown = false;
    for (
      let cx = lx;
      cx < width && !visited[y * width + cx] && !blocked(cx, y) && matches(cx, y);
      cx++
    ) {
      const p = y * width + cx;
      visited[p] = 1;
      const i = p * 4;
      data[i] = fill.r;
      data[i + 1] = fill.g;
      data[i + 2] = fill.b;
      data[i + 3] = fill.a;
      changed = true;

      if (y > 0) {
        const ay = y - 1;
        if (!visited[ay * width + cx] && !blocked(cx, ay) && matches(cx, ay)) {
          if (!spanUp) {
            stack.push(cx, ay);
            spanUp = true;
          }
        } else {
          spanUp = false;
        }
      }
      if (y < height - 1) {
        const by = y + 1;
        if (!visited[by * width + cx] && !blocked(cx, by) && matches(cx, by)) {
          if (!spanDown) {
            stack.push(cx, by);
            spanDown = true;
          }
        } else {
          spanDown = false;
        }
      }
    }
  }

  return changed;
}

/** Parse a #rrggbb hex string into an opaque RGBA. */
export function hexToRgba(hex: string, alpha = 255): RGBA {
  const clean = hex.replace("#", "");
  const value =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const num = parseInt(value, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
    a: alpha,
  };
}
