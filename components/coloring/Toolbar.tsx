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

function FillIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M19 11l-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2a2 2 0 0 0 2.8 0L19 11Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="m5 21 3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function BrushIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M18.4 5.6a2.5 2.5 0 0 0-3.5 0l-9 9a2 2 0 0 0-.5.8L4 19l3.6-1.4a2 2 0 0 0 .8-.5l9-9a2.5 2.5 0 0 0 0-3.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EraserIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m7 21 8.5-8.5M3 17l4 4M14 3l7 7-9 9H5L3 14l11-11Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const toolMeta: { id: Tool; label: string; Icon: () => React.ReactElement }[] = [
  { id: "brush", label: "Brush", Icon: BrushIcon },
  { id: "fill", label: "Fill", Icon: FillIcon },
  { id: "eraser", label: "Eraser", Icon: EraserIcon },
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
      className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--duos-border)] bg-[var(--duos-surface)] text-[var(--duos-ink)] shadow-sm transition active:scale-95 disabled:opacity-30"
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
      <div
        className="flex gap-1 rounded-2xl border border-[var(--duos-border)] bg-[var(--duos-surface)] p-1 shadow-sm"
        role="toolbar"
        aria-label="Drawing tools"
      >
        {toolMeta.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onToolChange(t.id)}
            aria-pressed={tool === t.id}
            className={`flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition ${
              tool === t.id
                ? "bg-[var(--duos-ink)] text-white shadow"
                : "text-[var(--duos-ink-muted)] hover:bg-[var(--duos-surface-raised)]"
            }`}
          >
            <t.Icon />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {(tool === "brush" || tool === "eraser") && (
        <div
          className="flex items-center gap-1 rounded-2xl border border-[var(--duos-border)] bg-[var(--duos-surface)] p-1 shadow-sm"
          role="group"
          aria-label="Brush size"
        >
          {BRUSH_SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onBrushSizeChange(s)}
              aria-pressed={brushSize === s}
              aria-label={`Brush size ${s}`}
              className={`flex h-11 w-11 items-center justify-center rounded-xl transition ${
                brushSize === s
                  ? "bg-[var(--duos-ink)]"
                  : "bg-[var(--duos-surface-raised)] hover:bg-[var(--duos-border)]"
              }`}
            >
              <span
                className="rounded-full"
                style={{
                  width: Math.max(6, s / 3),
                  height: Math.max(6, s / 3),
                  backgroundColor: brushSize === s ? "#fff" : "var(--duos-ink-muted)",
                }}
              />
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <IconButton onClick={onUndo} disabled={!canUndo} title="Undo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </IconButton>
        <IconButton onClick={onRedo} disabled={!canRedo} title="Redo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </IconButton>
        <IconButton onClick={onClear} title="Clear my half">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </IconButton>
      </div>
    </div>
  );
}
