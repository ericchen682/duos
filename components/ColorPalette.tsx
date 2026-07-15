"use client";

export const PALETTE: string[] = [
  "#f43f5e", // rose
  "#fb7185", // pink
  "#f97316", // orange
  "#f59e0b", // amber
  "#facc15", // yellow
  "#84cc16", // lime
  "#22c55e", // green
  "#14b8a6", // teal
  "#38bdf8", // sky
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#a855f7", // purple
  "#ec4899", // fuchsia
  "#92400e", // brown
  "#0f172a", // near-black
  "#94a3b8", // slate
  "#e2e8f0", // light gray
  "#ffffff", // white
];

export function ColorPalette({
  color,
  onChange,
}: {
  color: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PALETTE.map((c) => {
        const selected = c.toLowerCase() === color.toLowerCase();
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={`Color ${c}`}
            aria-pressed={selected}
            className={`h-9 w-9 rounded-full border shadow-sm transition-transform active:scale-90 ${
              selected
                ? "scale-110 border-slate-800 ring-2 ring-slate-800 ring-offset-2"
                : "border-black/10"
            }`}
            style={{ backgroundColor: c }}
          />
        );
      })}
      <label
        className="relative h-9 w-9 cursor-pointer overflow-hidden rounded-full border border-dashed border-slate-400 bg-white text-center text-lg leading-9"
        title="Custom color"
      >
        <span aria-hidden>＋</span>
        <input
          type="color"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Pick a custom color"
        />
      </label>
    </div>
  );
}
