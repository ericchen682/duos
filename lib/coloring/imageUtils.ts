/** Load an <img> element and resolve once it has decoded. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/**
 * Rasterize an image into a canvas at the given size and read its pixels once.
 * The canvas is what per-frame code should draw from — a multi-megapixel
 * upload resampled on every redraw keeps its full decoded bitmap alive and
 * burns time per frame; this pays that cost once. Callers should drop the
 * source image afterwards so the decode can be reclaimed.
 */
export function rasterizeImage(
  img: HTMLImageElement,
  width: number,
  height: number
): { canvas: HTMLCanvasElement; data: ImageData } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(img, 0, 0, width, height);
  return { canvas, data: ctx.getImageData(0, 0, width, height) };
}

/** Build an opaque-white-inside canvas from a mask, for destination-in clipping. */
export function maskToCanvas(
  mask: Uint8Array,
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  const data = ctx.createImageData(width, height);
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) {
      const o = i * 4;
      data.data[o] = 255;
      data.data[o + 1] = 255;
      data.data[o + 2] = 255;
      data.data[o + 3] = 255;
    }
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

/** Build a translucent overlay that dims everything OUTSIDE the player's mask. */
export function overlayOutsideMask(
  mask: Uint8Array,
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  const data = ctx.createImageData(width, height);
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) {
      const o = i * 4;
      data.data[o] = 148;
      data.data[o + 1] = 163;
      data.data[o + 2] = 184;
      data.data[o + 3] = 118;
    }
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}
