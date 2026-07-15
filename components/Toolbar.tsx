"use client";

export type Tool = "fill" | "brush" | "eraser";

export const BRUSH_SIZES = [6, 14, 28, 48];

interface ToolbarProps {
  tool: Tool;
  onToolChange: (t: Tool) => void;
  brushSize: number;
  onBrushSizeChange: (s: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const toolMeta: { id: Tool; label: string; icon: string }[] = [
  { id: "fill", label: "Fill", icon: "🪣" },
  { id: "brush", label: "Brush", icon: "🖌️" },
  { id: "eraser", label: "Eraser", icon: "🧽" },
];

function IconButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg shadow-sm transition active:scale-90 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

export function Toolbar({
  tool,
  onToolChange,
  brushSize,
  onBrushSizeChange,
  onUndo,
  onRedo,
  onClear,
  canUndo,
  canRedo,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex gap-1.5 rounded-2xl bg-white/80 p-1.5 shadow-sm">
        {toolMeta.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onToolChange(t.id)}
            aria-pressed={tool === t.id}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition ${
              tool === t.id
                ? "bg-slate-800 text-white shadow"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span aria-hidden>{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {(tool === "brush" || tool === "eraser") && (
        <div className="flex items-center gap-1.5 rounded-2xl bg-white/80 p-1.5 shadow-sm">
          {BRUSH_SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onBrushSizeChange(s)}
              aria-pressed={brushSize === s}
              aria-label={`Brush size ${s}`}
              className={`flex h-11 w-11 items-center justify-center rounded-xl transition ${
                brushSize === s ? "bg-slate-800" : "bg-slate-100 hover:bg-slate-200"
              }`}
            >
              <span
                className="rounded-full"
                style={{
                  width: Math.max(6, s / 3),
                  height: Math.max(6, s / 3),
                  backgroundColor: brushSize === s ? "#fff" : "#475569",
                }}
              />
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <IconButton onClick={onUndo} disabled={!canUndo} title="Undo">
          ↩︎
        </IconButton>
        <IconButton onClick={onRedo} disabled={!canRedo} title="Redo">
          ↪︎
        </IconButton>
        <IconButton onClick={onClear} title="Clear my half">
          🗑️
        </IconButton>
      </div>
    </div>
  );
}
