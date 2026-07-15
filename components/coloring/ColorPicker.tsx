"use client";

import { useCallback, useRef, useState } from "react";
import {
  hexToHsv,
  hexToRgb,
  hsvToHex,
  isValidHex,
  normalizeHex,
  rgbToHex,
} from "@/lib/coloring/colorUtils";
import { PALETTE_GROUPS, QUICK_PICKS } from "@/lib/coloring/palette";
import { loadRecentColors, pushRecentColor } from "@/lib/coloring/recentColors";

interface ColorPickerProps {
  color: string;
  onChange: (hex: string) => void;
  /** compact = play view (quick row + collapsible full palette); full = dev/setup */
  layout?: "compact" | "full";
}

function SwatchButton({
  c,
  selected,
  onPick,
  size = "md",
}: {
  c: string;
  selected: boolean;
  onPick: (c: string) => void;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-9 w-9" : "h-10 w-10";
  return (
    <button
      type="button"
      onClick={() => onPick(c)}
      aria-label={`Color ${c}`}
      aria-pressed={selected}
      className={`${dim} shrink-0 rounded-full border-2 shadow-sm transition active:scale-95 ${
        selected
          ? "scale-105 border-[var(--duos-ink)] ring-2 ring-[var(--duos-ink)] ring-offset-1"
          : "border-black/10"
      }`}
      style={{ backgroundColor: c }}
    />
  );
}

function CustomPickerPanel({
  color,
  hsv,
  hexInput,
  rgb,
  svRef,
  hueRef,
  onSvDown,
  onSvMove,
  onSvUp,
  onHueDown,
  onHueMove,
  onHueUp,
  setHexInput,
  applyColor,
}: {
  color: string;
  hsv: { h: number; s: number; v: number };
  hexInput: string;
  rgb: { r: number; g: number; b: number };
  svRef: React.RefObject<HTMLDivElement | null>;
  hueRef: React.RefObject<HTMLDivElement | null>;
  onSvDown: (e: React.PointerEvent) => void;
  onSvMove: (e: React.PointerEvent) => void;
  onSvUp: () => void;
  onHueDown: (e: React.PointerEvent) => void;
  onHueMove: (e: React.PointerEvent) => void;
  onHueUp: () => void;
  setHexInput: (v: string) => void;
  applyColor: (hex: string) => void;
}) {
  const hueBg = `hsl(${hsv.h} 100% 50%)`;
  const svBg = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueBg})`;

  return (
    <div className="animate-pop-in space-y-3 rounded-[var(--radius-panel)] border border-[var(--duos-border)] bg-[var(--duos-surface)] p-3 shadow-sm">
      <div
        ref={svRef}
        role="application"
        aria-label="Saturation and brightness"
        className="no-touch-scroll relative h-36 w-full cursor-crosshair overflow-hidden rounded-xl border border-[var(--duos-border)] sm:h-44"
        style={{ background: svBg }}
        onPointerDown={onSvDown}
        onPointerMove={onSvMove}
        onPointerUp={onSvUp}
        onPointerCancel={onSvUp}
      >
        <span
          className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md ring-1 ring-black/20"
          style={{
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
            backgroundColor: color,
          }}
        />
      </div>

      <div
        ref={hueRef}
        role="slider"
        aria-label="Hue"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.h)}
        className="no-touch-scroll relative h-10 w-full cursor-pointer overflow-hidden rounded-xl border border-[var(--duos-border)]"
        style={{
          background:
            "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
        }}
        onPointerDown={onHueDown}
        onPointerMove={onHueMove}
        onPointerUp={onHueUp}
        onPointerCancel={onHueUp}
      >
        <span
          className="pointer-events-none absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ring-1 ring-black/20"
          style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: hueBg }}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block text-sm font-semibold text-[var(--duos-ink-muted)]">
          Hex
          <input
            value={hexInput}
            onChange={(e) => setHexInput(e.target.value)}
            onBlur={() => {
              if (isValidHex(hexInput)) applyColor(hexInput);
              else setHexInput(color);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && isValidHex(hexInput)) applyColor(hexInput);
            }}
            className="mt-1 w-full min-h-10 rounded-xl border border-[var(--duos-border)] bg-white px-3 font-mono text-sm uppercase tracking-wider text-[var(--duos-ink)] outline-none focus:border-[var(--duos-accent)] focus:ring-2 focus:ring-[var(--duos-accent-soft)]"
            spellCheck={false}
            data-testid="hex-input"
          />
        </label>
        <div className="flex gap-2">
          {(["r", "g", "b"] as const).map((ch) => (
            <label key={ch} className="block text-sm font-semibold text-[var(--duos-ink-muted)]">
              {ch.toUpperCase()}
              <input
                type="number"
                min={0}
                max={255}
                value={rgb[ch]}
                onChange={(e) => {
                  const val = Math.max(0, Math.min(255, Number(e.target.value) || 0));
                  const next = { ...rgb, [ch]: val };
                  applyColor(rgbToHex(next));
                }}
                className="mt-1 w-14 min-h-10 rounded-xl border border-[var(--duos-border)] bg-white px-2 text-center text-sm text-[var(--duos-ink)] outline-none focus:border-[var(--duos-accent)]"
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ColorPicker({ color, onChange, layout = "full" }: ColorPickerProps) {
  const isCompact = layout === "compact";

  const [hsv, setHsv] = useState(() => hexToHsv(color));
  const [hexInput, setHexInput] = useState(color);
  const [rgb, setRgb] = useState(() => hexToRgb(color));
  const [recents, setRecents] = useState<string[]>(() => loadRecentColors());
  const [expandedCustom, setExpandedCustom] = useState(!isCompact);
  const [expandedPalette, setExpandedPalette] = useState(!isCompact);

  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const draggingSv = useRef(false);
  const draggingHue = useRef(false);

  const applyColor = useCallback(
    (hex: string, trackRecent = true) => {
      const normalized = normalizeHex(hex);
      onChange(normalized);
      setHexInput(normalized);
      setHsv(hexToHsv(normalized));
      setRgb(hexToRgb(normalized));
      if (trackRecent) setRecents(pushRecentColor(normalized));
    },
    [onChange]
  );

  const updateFromHsv = useCallback(
    (next: { h: number; s: number; v: number }) => {
      applyColor(hsvToHex(next));
    },
    [applyColor]
  );

  const pickSv = (clientX: number, clientY: number) => {
    const el = svRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
    updateFromHsv({ ...hsv, s, v });
  };

  const pickHue = (clientX: number) => {
    const el = hueRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const h = Math.max(0, Math.min(360, ((clientX - rect.left) / rect.width) * 360));
    updateFromHsv({ ...hsv, h });
  };

  const onSvDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    draggingSv.current = true;
    pickSv(e.clientX, e.clientY);
  };
  const onSvMove = (e: React.PointerEvent) => {
    if (!draggingSv.current) return;
    e.preventDefault();
    pickSv(e.clientX, e.clientY);
  };
  const onSvUp = () => {
    draggingSv.current = false;
  };

  const onHueDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    draggingHue.current = true;
    pickHue(e.clientX);
  };
  const onHueMove = (e: React.PointerEvent) => {
    if (!draggingHue.current) return;
    e.preventDefault();
    pickHue(e.clientX);
  };
  const onHueUp = () => {
    draggingHue.current = false;
  };

  const quickSwatches = isCompact ? QUICK_PICKS : [];
  const showRecents = recents.length > 0;

  return (
    <div className="space-y-2" data-testid="color-picker">
      {/* Quick row — always visible */}
      <div className="flex items-center gap-2">
        <div
          className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="list"
          aria-label="Color swatches"
        >
          {(isCompact ? quickSwatches : []).map((c) => (
            <SwatchButton
              key={c}
              c={c}
              selected={c.toLowerCase() === color.toLowerCase()}
              onPick={applyColor}
              size="sm"
            />
          ))}

          {!isCompact && showRecents &&
            recents.map((c) => (
              <SwatchButton
                key={`recent-${c}`}
                c={c}
                selected={c.toLowerCase() === color.toLowerCase()}
                onPick={applyColor}
                size="sm"
              />
            ))}

          {/* Native color input — fast on iPad */}
          <label
            className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-[var(--duos-border)] bg-white text-lg font-light text-[var(--duos-ink-muted)] shadow-sm transition hover:border-[var(--duos-accent)]"
            title="Pick any color"
          >
            <span aria-hidden>+</span>
            <input
              type="color"
              value={color}
              onChange={(e) => applyColor(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Pick a custom color"
            />
          </label>
        </div>

        {isCompact && (
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => setExpandedCustom((v) => !v)}
              aria-expanded={expandedCustom}
              className="flex h-9 items-center rounded-xl border border-[var(--duos-border)] bg-[var(--duos-surface)] px-2.5 text-xs font-bold text-[var(--duos-ink-muted)] transition hover:border-[var(--duos-accent)]"
            >
              {expandedCustom ? "Less" : "Custom"}
            </button>
            <button
              type="button"
              onClick={() => setExpandedPalette((v) => !v)}
              aria-expanded={expandedPalette}
              className="flex h-9 items-center rounded-xl border border-[var(--duos-border)] bg-[var(--duos-surface)] px-2.5 text-xs font-bold text-[var(--duos-ink-muted)] transition hover:border-[var(--duos-accent)]"
            >
              {expandedPalette ? "Less" : "More"}
            </button>
          </div>
        )}
      </div>

      {isCompact && showRecents && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          <span className="shrink-0 self-center text-[10px] font-bold uppercase tracking-wide text-[var(--duos-ink-muted)]">
            Recent
          </span>
          {recents.map((c) => (
            <SwatchButton
              key={`recent-${c}`}
              c={c}
              selected={c.toLowerCase() === color.toLowerCase()}
              onPick={applyColor}
              size="sm"
            />
          ))}
        </div>
      )}

      {/* Full mode: toggle for custom picker */}
      {!isCompact && (
        <button
          type="button"
          onClick={() => setExpandedCustom((v) => !v)}
          aria-expanded={expandedCustom}
          className="flex min-h-10 items-center gap-2 rounded-xl border border-[var(--duos-border)] bg-[var(--duos-surface)] px-3 py-1.5 text-sm font-semibold text-[var(--duos-ink)] shadow-sm transition hover:border-[var(--duos-accent)]"
        >
          <span
            className="h-7 w-7 rounded-lg border border-black/10 shadow-inner"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          {expandedCustom ? "Hide custom picker" : "Custom color"}
        </button>
      )}

      {expandedCustom && (
        <CustomPickerPanel
          color={color}
          hsv={hsv}
          hexInput={hexInput}
          rgb={rgb}
          svRef={svRef}
          hueRef={hueRef}
          onSvDown={onSvDown}
          onSvMove={onSvMove}
          onSvUp={onSvUp}
          onHueDown={onHueDown}
          onHueMove={onHueMove}
          onHueUp={onHueUp}
          setHexInput={setHexInput}
          applyColor={applyColor}
        />
      )}

      {(expandedPalette || !isCompact) && (
        <div className="space-y-2">
          {PALETTE_GROUPS.map((group) => (
            <div key={group.id}>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--duos-ink-muted)]">
                {group.label}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {group.colors.map((c, i) => (
                  <SwatchButton
                    key={`${group.id}-${c}-${i}`}
                    c={c}
                    selected={c.toLowerCase() === color.toLowerCase()}
                    onPick={applyColor}
                    size="sm"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
