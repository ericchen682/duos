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
import { QUICK_PICKS } from "@/lib/coloring/palette";
import {
  addToPersonalPalette,
  filledPersonalColors,
  getEffectivePaletteGroups,
  loadPersonalPalette,
  loadPaletteOverrides,
  setPaletteOverride,
  setPersonalSlot,
  type PaletteOverrideKey,
} from "@/lib/coloring/paletteStorage";
import { loadRecentColors, pushRecentColor } from "@/lib/coloring/recentColors";
import { SwatchEditor, type SwatchEditTarget } from "@/components/coloring/SwatchEditor";
import { Button } from "@/components/ui/Button";

type PickerTab = "quick" | "palette" | "custom";

interface ColorPickerProps {
  color: string;
  onChange: (hex: string) => void;
  /** compact = play view (collapsed quick row + expandable sheet); full = dev/setup */
  layout?: "compact" | "full";
}

function SwatchButton({
  c,
  selected,
  onPick,
  onLongPress,
  size = "md",
  empty = false,
  label,
}: {
  c: string | null;
  selected: boolean;
  onPick: (c: string) => void;
  onLongPress?: () => void;
  size?: "sm" | "md";
  empty?: boolean;
  label?: string;
}) {
  const dim = size === "sm" ? "h-9 w-9" : "h-10 w-10";
  // iPad: suppress the iOS long-press callout/text-selection (which fires
  // pointercancel and kills the timer) and the 350ms double-tap-zoom delay.
  // touch-action stays `manipulation` so the scrollable swatch row still pans.
  const touchSafe = "touch-manipulation select-none [-webkit-touch-callout:none]";
  const longPressTriggered = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pressStart.current = null;
  };

  if (empty || !c) {
    return (
      <button
        type="button"
        onClick={() => onLongPress?.()}
        aria-label={label ?? "Empty color slot"}
        className={`${dim} ${touchSafe} shrink-0 rounded-full border-2 border-dashed border-[var(--duos-border)] bg-white text-sm text-[var(--duos-ink-muted)] transition hover:border-[var(--duos-accent)]`}
      >
        +
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (longPressTriggered.current) {
          longPressTriggered.current = false;
          return;
        }
        onPick(c);
      }}
      onPointerDown={(e) => {
        longPressTriggered.current = false;
        if (onLongPress) {
          pressStart.current = { x: e.clientX, y: e.clientY };
          timerRef.current = setTimeout(() => {
            longPressTriggered.current = true;
            onLongPress();
          }, 450);
        }
      }}
      onPointerMove={(e) => {
        // A press that wanders ~10px is a scroll, not a long-press.
        if (!timerRef.current || !pressStart.current) return;
        const dx = e.clientX - pressStart.current.x;
        const dy = e.clientY - pressStart.current.y;
        if (dx * dx + dy * dy > 100) clearTimer();
      }}
      onPointerUp={clearTimer}
      onPointerCancel={clearTimer}
      onPointerLeave={clearTimer}
      onContextMenu={(e) => {
        if (onLongPress) e.preventDefault();
      }}
      aria-label={label ?? `Color ${c}`}
      aria-pressed={selected}
      className={`${dim} ${touchSafe} shrink-0 rounded-full border-2 shadow-sm transition active:scale-95 ${
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
  onSavePersonal,
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
  onSavePersonal: (hex: string) => void;
}) {
  const hueBg = `hsl(${hsv.h} 100% 50%)`;
  const svBg = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueBg})`;

  return (
    <div className="space-y-3">
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
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            enterKeyHint="done"
            data-testid="hex-input"
          />
        </label>
        <div className="flex gap-2">
          {(["r", "g", "b"] as const).map((ch) => (
            <label key={ch} className="block text-sm font-semibold text-[var(--duos-ink-muted)]">
              {ch.toUpperCase()}
              <input
                type="number"
                inputMode="numeric"
                enterKeyHint="done"
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

      <Button size="sm" variant="secondary" onClick={() => onSavePersonal(color)}>
        Save to My Colors
      </Button>
    </div>
  );
}

function TabBar({
  tab,
  onTabChange,
}: {
  tab: PickerTab;
  onTabChange: (t: PickerTab) => void;
}) {
  const tabs: { id: PickerTab; label: string }[] = [
    { id: "quick", label: "Quick" },
    { id: "palette", label: "Palette" },
    { id: "custom", label: "Custom" },
  ];

  return (
    <div
      className="flex gap-1 rounded-xl border border-[var(--duos-border)] bg-[var(--duos-surface-raised)] p-1"
      role="tablist"
      aria-label="Color picker sections"
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={tab === t.id}
          onClick={() => onTabChange(t.id)}
          className={`min-h-9 flex-1 touch-manipulation select-none rounded-lg px-2 text-xs font-bold transition ${
            tab === t.id
              ? "bg-[var(--duos-surface)] text-[var(--duos-ink)] shadow-sm"
              : "text-[var(--duos-ink-muted)] hover:text-[var(--duos-ink)]"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function ColorPicker({ color, onChange, layout = "full" }: ColorPickerProps) {
  const isCompact = layout === "compact";

  const [hsv, setHsv] = useState(() => hexToHsv(color));
  const [hexInput, setHexInput] = useState(color);
  const [rgb, setRgb] = useState(() => hexToRgb(color));
  const [recents, setRecents] = useState<string[]>(() => loadRecentColors());
  const [personalSlots, setPersonalSlots] = useState<(string | null)[]>(() => loadPersonalPalette());
  const [overrides, setOverrides] = useState<Record<PaletteOverrideKey, string>>(() =>
    loadPaletteOverrides()
  );
  const [sheetOpen, setSheetOpen] = useState(!isCompact);
  const [tab, setTab] = useState<PickerTab>("quick");
  const [editTarget, setEditTarget] = useState<SwatchEditTarget | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorColor, setEditorColor] = useState(color);

  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const draggingSv = useRef(false);
  const draggingHue = useRef(false);
  // Mirrors of hsv/color state so pointermove handlers never read a stale
  // closure (moves can outpace renders on 120Hz touch screens).
  const hsvRef = useRef(hexToHsv(color));
  const colorRef = useRef(normalizeHex(color));

  const paletteGroups = getEffectivePaletteGroups(overrides);
  const personalColors = filledPersonalColors(personalSlots);

  const applyColor = useCallback(
    (hex: string, trackRecent = true) => {
      const normalized = normalizeHex(hex);
      colorRef.current = normalized;
      hsvRef.current = hexToHsv(normalized);
      onChange(normalized);
      setHexInput(normalized);
      setHsv(hsvRef.current);
      setRgb(hexToRgb(normalized));
      if (trackRecent) setRecents(pushRecentColor(normalized));
    },
    [onChange]
  );

  const handleSavePersonal = useCallback((hex: string) => {
    setPersonalSlots(addToPersonalPalette(hex));
  }, []);

  const handleReplacePreset = useCallback(
    (hex: string) => {
      if (!editTarget || editTarget.kind !== "preset") return;
      setOverrides(setPaletteOverride(editTarget.groupId, editTarget.index, hex));
      applyColor(hex);
      setEditTarget(null);
    },
    [applyColor, editTarget]
  );

  const openEditor = useCallback((initial: string, target?: SwatchEditTarget) => {
    setEditorColor(initial);
    setEditTarget(target ?? null);
    setEditorOpen(true);
  }, []);

  // HSV is the source of truth while dragging the custom picker: converting
  // back through 8-bit hex loses hue/saturation near black and white, which
  // made the hue drift (or snap to red) mid-drag. Recents are committed once
  // per gesture on pointer-up instead of on every move, so we don't hammer
  // localStorage at touch-move frequency.
  const updateFromHsv = useCallback(
    (next: { h: number; s: number; v: number }) => {
      const normalized = normalizeHex(hsvToHex(next));
      hsvRef.current = next;
      colorRef.current = normalized;
      setHsv(next);
      onChange(normalized);
      setHexInput(normalized);
      setRgb(hexToRgb(normalized));
    },
    [onChange]
  );

  const commitRecent = useCallback(() => {
    setRecents(pushRecentColor(colorRef.current));
  }, []);

  const pickSv = (clientX: number, clientY: number) => {
    const el = svRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
    updateFromHsv({ ...hsvRef.current, s, v });
  };

  const pickHue = (clientX: number) => {
    const el = hueRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const h = Math.max(0, Math.min(360, ((clientX - rect.left) / rect.width) * 360));
    updateFromHsv({ ...hsvRef.current, h });
  };

  const onSvDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    draggingSv.current = true;
    pickSv(e.clientX, e.clientY);
  };
  const onSvMove = (e: React.PointerEvent) => {
    if (!draggingSv.current) return;
    e.preventDefault();
    pickSv(e.clientX, e.clientY);
  };
  const onSvUp = () => {
    if (!draggingSv.current) return;
    draggingSv.current = false;
    commitRecent();
  };

  const onHueDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    draggingHue.current = true;
    pickHue(e.clientX);
  };
  const onHueMove = (e: React.PointerEvent) => {
    if (!draggingHue.current) return;
    e.preventDefault();
    pickHue(e.clientX);
  };
  const onHueUp = () => {
    if (!draggingHue.current) return;
    draggingHue.current = false;
    commitRecent();
  };

  const collapsedSwatches = [
    ...personalColors,
    ...QUICK_PICKS.filter(
      (c) => !personalColors.some((p) => p.toLowerCase() === c.toLowerCase())
    ),
  ];

  const quickTab = (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--duos-ink-muted)]">
          My colors
        </p>
        <div className="flex flex-wrap gap-1.5">
          {personalSlots.map((slot, i) => (
            <SwatchButton
              key={`personal-${i}`}
              c={slot}
              empty={slot === null}
              selected={slot !== null && slot.toLowerCase() === color.toLowerCase()}
              onPick={applyColor}
              onLongPress={() =>
                openEditor(slot ?? color, {
                  kind: "preset",
                  groupId: "personal",
                  index: i,
                  label: "My color",
                })
              }
              size="sm"
              label={slot ? `My color ${i + 1}` : `Add my color slot ${i + 1}`}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--duos-ink-muted)]">
          Quick picks
        </p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PICKS.map((c) => (
            <SwatchButton
              key={c}
              c={c}
              selected={c.toLowerCase() === color.toLowerCase()}
              onPick={applyColor}
              onLongPress={() => openEditor(c)}
              size="sm"
            />
          ))}
        </div>
      </div>

      {recents.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--duos-ink-muted)]">
            Recent
          </p>
          <div className="flex flex-wrap gap-1.5">
            {recents.map((c) => (
              <SwatchButton
                key={`recent-${c}`}
                c={c}
                selected={c.toLowerCase() === color.toLowerCase()}
                onPick={applyColor}
                onLongPress={() => openEditor(c)}
                size="sm"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const paletteTab = (
    <div className="space-y-3">
      <p className="text-xs text-[var(--duos-ink-muted)]">Long-press a swatch to tweak or replace it.</p>
      {paletteGroups.map((group) => (
        <div key={group.id}>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--duos-ink-muted)]">
            {group.label}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {group.colors.map((c, i) => (
              <SwatchButton
                key={`${group.id}-${i}`}
                c={c}
                selected={c.toLowerCase() === color.toLowerCase()}
                onPick={applyColor}
                onLongPress={() =>
                  openEditor(c, {
                    kind: "preset",
                    groupId: group.id,
                    index: i,
                    label: group.label,
                  })
                }
                size="sm"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const customPanel = (
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
      onSavePersonal={handleSavePersonal}
    />
  );

  return (
    <div className="space-y-2" data-testid="color-picker">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setSheetOpen(true);
            setTab("custom");
          }}
          aria-label="Current color"
          className="h-10 w-10 shrink-0 touch-manipulation select-none rounded-full border-2 border-[var(--duos-ink)] shadow-sm ring-2 ring-[var(--duos-ink)] ring-offset-1"
          style={{ backgroundColor: color }}
        />

        <div
          className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="list"
          aria-label="Color swatches"
        >
          {collapsedSwatches.map((c) => (
            <SwatchButton
              key={`collapsed-${c}`}
              c={c}
              selected={c.toLowerCase() === color.toLowerCase()}
              onPick={applyColor}
              onLongPress={() => openEditor(c)}
              size="sm"
            />
          ))}
        </div>

        {isCompact && (
          <button
            type="button"
            onClick={() => setSheetOpen((v) => !v)}
            aria-expanded={sheetOpen}
            className="flex h-10 shrink-0 touch-manipulation select-none items-center rounded-xl border border-[var(--duos-border)] bg-[var(--duos-surface)] px-3 text-xs font-bold text-[var(--duos-ink-muted)] transition hover:border-[var(--duos-accent)]"
          >
            {sheetOpen ? "Less" : "Colors"}
          </button>
        )}
      </div>

      {sheetOpen && (
        <div className="animate-pop-in space-y-3 rounded-[var(--radius-panel)] border border-[var(--duos-border)] bg-[var(--duos-surface)] p-3 shadow-sm">
          <TabBar tab={tab} onTabChange={setTab} />
          {tab === "quick" && quickTab}
          {tab === "palette" && paletteTab}
          {tab === "custom" && customPanel}
        </div>
      )}

      {editorOpen && (
        <SwatchEditor
          initialColor={editorColor}
          target={
            editTarget && editTarget.groupId !== "personal" ? editTarget : undefined
          }
          personalSlotIndex={
            editTarget?.groupId === "personal" ? editTarget.index : undefined
          }
          onApply={(hex) => {
            applyColor(hex);
            setEditorOpen(false);
            setEditTarget(null);
          }}
          onSavePersonal={(hex) => {
            if (editTarget?.groupId === "personal") {
              setPersonalSlots(setPersonalSlot(editTarget.index, hex));
            } else {
              handleSavePersonal(hex);
            }
            applyColor(hex);
            setEditorOpen(false);
            setEditTarget(null);
          }}
          onUpdateSlot={(hex) => {
            if (editTarget?.groupId === "personal") {
              setPersonalSlots(setPersonalSlot(editTarget.index, hex));
              applyColor(hex);
            }
            setEditorOpen(false);
            setEditTarget(null);
          }}
          onReplacePreset={(hex) => {
            handleReplacePreset(hex);
            setEditorOpen(false);
          }}
          onClose={() => {
            setEditorOpen(false);
            setEditTarget(null);
          }}
        />
      )}
    </div>
  );
}
