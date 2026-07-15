/** Organized preset swatches for the color picker. */
export interface PaletteGroup {
  id: string;
  label: string;
  colors: string[];
}

export const PALETTE_GROUPS: PaletteGroup[] = [
  {
    id: "warm",
    label: "Warm",
    colors: [
      "#7f1d1d", "#b91c1c", "#dc2626", "#ef4444", "#f87171",
      "#c2410c", "#ea580c", "#f97316", "#fb923c", "#fdba74",
      "#b45309", "#d97706", "#f59e0b", "#fbbf24", "#fcd34d",
    ],
  },
  {
    id: "cool",
    label: "Cool",
    colors: [
      "#14532d", "#15803d", "#16a34a", "#22c55e", "#4ade80",
      "#115e59", "#0d9488", "#14b8a6", "#2dd4bf", "#5eead4",
      "#1e3a8a", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd",
      "#312e81", "#4f46e5", "#6366f1", "#818cf8", "#a5b4fc",
    ],
  },
  {
    id: "violet",
    label: "Violet & pink",
    colors: [
      "#581c87", "#7e22ce", "#9333ea", "#a855f7", "#c084fc",
      "#831843", "#be185d", "#db2777", "#ec4899", "#f472b6",
      "#9d174d", "#e11d48", "#f43f5e", "#fb7185", "#fda4af",
    ],
  },
  {
    id: "earth",
    label: "Earth & neutrals",
    colors: [
      "#451a03", "#78350f", "#92400e", "#a16207", "#ca8a04",
      "#44403c", "#57534e", "#78716c", "#a8a29e", "#d6d3d1",
      "#1c1917", "#292524", "#44403c", "#0f172a", "#1e293b",
      "#ffffff", "#f8fafc", "#f1f5f9", "#e2e8f0", "#cbd5e1",
    ],
  },
];

export const FLAT_PALETTE: string[] = PALETTE_GROUPS.flatMap((g) => g.colors);
