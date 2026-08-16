import { loadImage } from "@/lib/coloring/imageUtils";
import type { ColoringPage } from "@/lib/types";

/** Cap canvas raster size so huge uploads stay performant on iPad. */
export const MAX_CANVAS_EDGE = 1500;
/**
 * Cap total pixel count too: every full-canvas operation (mask clipping,
 * redraw, undo snapshots) scales with area, and iPad Safari kills the tab when
 * canvas memory climbs. The built-in pages (1000×750 = 0.75MP) are the
 * known-good baseline; this keeps uploads near it instead of at 2-3× it.
 * Saved op logs are resolution-independent, so drawings made at the old cap
 * replay rescaled.
 */
export const MAX_CANVAS_PIXELS = 1_000_000;

export function fitCanvasDimensions(
  width: number,
  height: number
): { width: number; height: number } {
  const edgeScale = MAX_CANVAS_EDGE / Math.max(width, height);
  const areaScale = Math.sqrt(MAX_CANVAS_PIXELS / (width * height));
  const scale = Math.min(1, edgeScale, areaScale);
  if (scale === 1) return { width, height };
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
