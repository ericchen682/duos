"use client";

import {
  PEN_TOOLS,
  TOOL_SIZE_MAX,
  TOOL_SIZE_MIN,
  type PenTool,
  type Tool,
  toolUsesSize,
} from "@/lib/coloring/strokes";

export type { Tool, PenTool };
export { PEN_TOOLS, toolUsesSize, TOOL_SIZE_MIN, TOOL_SIZE_MAX };
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

function PenIcon() {
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

function MarkerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 19h14M7 16l8-8 3 3-8 8H7v-3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20h9M4.5 19.5 16 8l-4-4L3 13l1.5 6.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CrayonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m14 4 6 6-9 9H5v-6l9-9Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M13 5l6 6" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function HighlighterIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 11l-6 6v3h3l6-6M20 4 15 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M14 3l7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function AirbrushIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="6" cy="12" r="2" fill="currentColor" opacity="0.35" />
      <circle cx="11" cy="10" r="3" fill="currentColor" opacity="0.55" />
      <circle cx="17" cy="12" r="4" fill="currentColor" opacity="0.75" />
    </svg>
  );
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

const penMeta: { id: PenTool; label: string; Icon: () => React.ReactElement }[] = [
  { id: "pen", label: "Pen", Icon: PenIcon },
  { id: "marker", label: "Marker", Icon: MarkerIcon },
  { id: "pencil", label: "Pencil", Icon: PencilIcon },
  { id: "crayon", label: "Crayon", Icon: CrayonIcon },
  { id: "highlighter", label: "Highlighter", Icon: HighlighterIcon },
  { id: "airbrush", label: "Airbrush", Icon: AirbrushIcon },
];

const utilityMeta: { id: "fill" | "eraser"; label: string; Icon: () => React.ReactElement }[] = [
  { id: "fill", label: "Fill", Icon: FillIcon },
  { id: "eraser", label: "Eraser", Icon: EraserIcon },
];

function ToolButton({
  label,
  Icon,
  selected,
  onSelect,
}: {
  label: string;
  Icon: () => React.ReactElement;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={label}
      title={label}
      className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-bold transition sm:px-3 ${
        selected
          ? "bg-[var(--duos-ink)] text-white shadow"
          : "text-[var(--duos-ink-muted)] hover:bg-[var(--duos-surface-raised)]"
      }`}
    >
      <Icon />
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

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
        className="flex min-w-0 max-w-full gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="toolbar"
        aria-label="Drawing tools"
      >
        <div className="flex shrink-0 gap-1 rounded-2xl border border-[var(--duos-border)] bg-[var(--duos-surface)] p-1 shadow-sm">
          {penMeta.map((t) => (
            <ToolButton
              key={t.id}
              label={t.label}
              Icon={t.Icon}
              selected={tool === t.id}
              onSelect={() => onToolChange(t.id)}
            />
          ))}
        </div>

        <div className="flex shrink-0 gap-1 rounded-2xl border border-[var(--duos-border)] bg-[var(--duos-surface)] p-1 shadow-sm">
          {utilityMeta.map((t) => (
            <ToolButton
              key={t.id}
              label={t.label}
              Icon={t.Icon}
              selected={tool === t.id}
              onSelect={() => onToolChange(t.id)}
            />
          ))}
        </div>
      </div>

      {toolUsesSize(tool) && (
        <div
          className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-[var(--duos-border)] bg-[var(--duos-surface)] p-1 px-2 shadow-sm sm:flex-none"
          role="group"
          aria-label="Tool size"
        >
          {BRUSH_SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onBrushSizeChange(s)}
              aria-pressed={brushSize === s}
              aria-label={`Tool size ${s}`}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition ${
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
          <label className="flex min-h-11 min-w-[6.5rem] flex-1 items-center gap-2 px-1 sm:min-w-[8.5rem]">
            <span className="sr-only">Custom tool size</span>
            <input
              type="range"
              min={TOOL_SIZE_MIN}
              max={TOOL_SIZE_MAX}
              step={1}
              value={brushSize}
              onChange={(e) => onBrushSizeChange(Number(e.target.value))}
              className="min-w-0 flex-1 accent-[var(--duos-accent)]"
              aria-label={`Custom tool size, ${brushSize}`}
              aria-valuemin={TOOL_SIZE_MIN}
              aria-valuemax={TOOL_SIZE_MAX}
              aria-valuenow={brushSize}
            />
            <span
              className="w-7 shrink-0 text-center text-xs font-bold tabular-nums text-[var(--duos-ink-muted)]"
              aria-hidden
            >
              {brushSize}
            </span>
          </label>
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
