import type { ColoringPage, ColoringPageManifest } from "./types";

let cache: ColoringPage[] | null = null;

/**
 * Load the coloring-page manifest from /public. Cached after first fetch.
 * Add new pages by dropping PNG/JPGs into public/coloring-pages and listing
 * them in manifest.json.
 */
export async function loadColoringPages(): Promise<ColoringPage[]> {
  if (cache) return cache;
  const res = await fetch("/coloring-pages/manifest.json", { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Could not load coloring-pages/manifest.json");
  }
  const manifest = (await res.json()) as ColoringPageManifest;
  cache = manifest.pages ?? [];
  return cache;
}

export function findPage(
  pages: ColoringPage[],
  src: string
): ColoringPage | undefined {
  return pages.find((p) => p.src === src);
}
