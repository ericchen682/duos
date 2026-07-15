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
import { PALETTE_GROUPS } from "@/lib/coloring/palette";
import { loadRecentColors, pushRecentColor } from "@/lib/coloring/recentColors";

interface ColorPickerProps {
  color: string;
  onChange: (hex: string) => void;
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
  const dim = size === "sm" ? "h-10 w-10" : "h-11 w-11";
  return (
    <button
      type="button"
      onClick={() => onPick(c)}
      aria-label={`Color ${c}`}
      aria-pressed={selected}
      className={`${dim} shrink-0 rounded-full border-2 shadow-sm transition active:scale-95 ${
        selected
          ? "scale-105 border-[var(--duos-ink)] ring-2 ring-[var(--duos-ink)] ring-offset-2"
          : "border-black/10"
      }`}
      style={{ backgroundColor: c }}
    />
  );
}

export function ColorPicker({ color, onChange }: ColorPickerProps) {
  const [hsv, setHsv] = useState(() => hexToHsv(color));
  const [hexInput, setHexInput] = useState(color);
  const [rgb, setRgb] = useState(() => hexToRgb(color));
  const [recents, setRecents] = useState<string[]>(() => loadRecentColors());
  const [expanded, setExpanded] = useState(false);

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
      const hex = hsvToHex(next);
      applyColor(hex);
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

  const hueBg = `hsl(${hsv.h} 100% 50%)`;
  const svBg = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueBg})`;

  return (
    <div className="space-y-3" data-testid="color-picker">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex min-h-11 items-center gap-3 rounded-2xl border border-[var(--duos-border)] bg-[var(--duos-surface)] px-3 py-2 shadow-sm transition hover:border-[var(--duos-accent)]"
        >
          <span
            className="h-9 w-9 rounded-xl border border-black/10 shadow-inner"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          <span className="text-sm font-semibold text-[var(--duos-ink)]">
            {expanded ? "Hide picker" : "Custom color"}
          </span>
        </button>
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

      {expanded && (
        <div className="animate-pop-in space-y-4 rounded-[var(--radius-panel)] border border-[var(--duos-border)] bg-[var(--duos-surface)] p-4 shadow-sm">
          <div
            ref={svRef}
            role="application"
            aria-label="Saturation and brightness"
            className="no-touch-scroll relative h-44 w-full cursor-crosshair overflow-hidden rounded-2xl border border-[var(--duos-border)]"
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
            className="no-touch-scroll relative h-11 w-full cursor-pointer overflow-hidden rounded-xl border border-[var(--duos-border)]"
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
              className="pointer-events-none absolute top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ring-1 ring-black/20"
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
                className="mt-1 w-full min-h-11 rounded-xl border border-[var(--duos-border)] bg-white px-3 font-mono text-sm uppercase tracking-wider text-[var(--duos-ink)] outline-none focus:border-[var(--duos-accent)] focus:ring-2 focus:ring-[var(--duos-accent-soft)]"
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
                      setRgb(next);
                      applyColor(rgbToHex(next));
                    }}
                    className="mt-1 w-16 min-h-11 rounded-xl border border-[var(--duos-border)] bg-white px-2 text-center text-sm text-[var(--duos-ink)] outline-none focus:border-[var(--duos-accent)]"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {PALETTE_GROUPS.map((group) => (
          <div key={group.id}>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--duos-ink-muted)]">
              {group.label}
            </p>
            <div className="flex flex-wrap gap-2">
              {group.colors.map((c, i) => (
                <SwatchButton
                  key={`${group.id}-${c}-${i}`}
                  c={c}
                  selected={c.toLowerCase() === color.toLowerCase()}
                  onPick={applyColor}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
