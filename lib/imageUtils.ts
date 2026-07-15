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

/** Draw an image into an offscreen canvas at the given size and read its pixels. */
export function imageToImageData(
  img: HTMLImageElement,
  width: number,
  height: number
): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(img, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
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
