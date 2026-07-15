import { loadImage } from "@/lib/coloring/imageUtils";
import type { ColoringPage } from "@/lib/types";

/** Cap canvas raster size so huge uploads stay performant on iPad. */
export const MAX_CANVAS_EDGE = 1500;

export function fitCanvasDimensions(
  width: number,
  height: number
): { width: number; height: number } {
  const max = Math.max(width, height);
  if (max <= MAX_CANVAS_EDGE) return { width, height };
  const scale = MAX_CANVAS_EDGE / max;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

/**
 * Resolve a coloring page from the manifest or by loading an image URL (e.g.
 * uploaded to Supabase Storage). Returns fitted canvas dimensions.
 */
export async function resolveColoringPage(
  src: string,
  manifest: ColoringPage[] = []
): Promise<ColoringPage> {
  const found = manifest.find((p) => p.src === src);
  if (found) return found;

  const img = await loadImage(src);
  const fitted = fitCanvasDimensions(img.naturalWidth, img.naturalHeight);
  const isUpload = src.includes("coloring-pages-uploads") || src.startsWith("http");
  return {
    id: isUpload ? "uploaded" : "custom",
    title: isUpload ? "Your upload" : "Custom page",
    src,
    width: fitted.width,
    height: fitted.height,
  };
}
