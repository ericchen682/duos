"use client";

import { useCallback, useRef, useState } from "react";
import {
  contrastText,
  hexToHsv,
  hexToRgb,
  hsvToHex,
  isValidHex,
  normalizeHex,
  rgbToHex,
  shadeRamp,
  type HSV,
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
import { HsvArea } from "@/components/coloring/HsvArea";
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
  onEmptyPick,
  size = "md",
  empty = false,
  label,
}: {
  c: string | null;
  selected: boolean;
  onPick: (c: string) => void;
  onLongPress?: () => void;
  /** Tap handler for empty slots (e.g. save the current color into the slot). */
  onEmptyPick?: () => void;
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
        onClick={() => onEmptyPick?.()}
        aria-label={label ?? "Empty color slot"}
        className={`${dim} ${touchSafe} shrink-0 rounded-full border-2 border-dashed border-[var(--duos-border)] bg-white text-sm text-[var(--duos-ink-muted)] transition hover:border-[var(--duos-accent)] hover:text-[var(--duos-accent)] active:scale-95`}
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
    >
      {selected && (
        <span
          className="pointer-events-none flex h-full w-full items-center justify-center text-[11px] font-bold"
          style={{ color: contrastText(c) }}
          aria-hidden
        >
          ✓
        </span>
      )}
    </button>
  );
}

/**
 * Segmented darker→lighter ramp of the current base color. Anchored to the
 * last deliberately-picked color, so tapping a shade doesn't shift the ramp
 * out from under your finger.
 */
function ShadeStrip({
  base,
  current,
  onPick,
}: {
  base: string;
  current: string;
  onPick: (hex: string) => void;
}) {
  const ramp = shadeRamp(base, 3);
  const mid = Math.floor(ramp.length / 2);

  return (
    <div>
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--duos-ink-muted)]">
        Shades
      </p>
      <div
        className="flex h-10 w-full overflow-hidden rounded-xl border border-[var(--duos-border)] shadow-sm"
        role="group"
        aria-label="Shades and tints of the current color"
      >
        {ramp.map((c, i) => {
          const selected = c.toLowerCase() === current.toLowerCase();
          const label =
            i === mid
              ? `Base color ${c}`
              : i < mid
                ? `Darker shade ${mid - i}`
                : `Lighter tint ${i - mid}`;
          return (
            <button
              key={`${c}-${i}`}
              type="button"
              onClick={() => onPick(c)}
              aria-label={label}
              aria-pressed={selected}
              title={c}
              className="flex min-w-0 flex-1 touch-manipulation select-none items-center justify-center transition active:brightness-110"
              style={{ backgroundColor: c }}
            >
              {selected && (
                <span
                  className="pointer-events-none text-xs font-bold"
                  style={{ color: contrastText(c) }}
                  aria-hidden
                >
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CustomPickerPanel({
  color,
  baseline,
  hsv,
  hexInput,
  rgb,
  onHsvChange,
  onHsvCommit,
  onRevert,
  setHexInput,
  applyColor,
  onSavePersonal,
}: {
  color: string;
  baseline: string;
  hsv: HSV;
  hexInput: string;
  rgb: { r: number; g: number; b: number };
  onHsvChange: (next: HSV) => void;
  onHsvCommit: () => void;
  onRevert: () => void;
  setHexInput: (v: string) => void;
  applyColor: (hex: string) => void;
  onSavePersonal: (hex: string) => void;
}) {
  const unchanged = baseline.toLowerCase() === color.toLowerCase();

  return (
    <div className="space-y-3">
      <HsvArea
        hsv={hsv}
        onChange={onHsvChange}
        onCommit={onHsvCommit}
        svHeightClassName="h-40 sm:h-48"
      />

      <div className="flex items-center gap-3">
        <div className="shrink-0">
          <div className="flex overflow-hidden rounded-xl border border-[var(--duos-border)] shadow-sm">
            <button
              type="button"
              onClick={onRevert}
              disabled={unchanged}
              aria-label={`Go back to previous color ${baseline}`}
              title="Tap to go back to the previous color"
              className="h-11 w-11 touch-manipulation select-none transition enabled:cursor-pointer enabled:active:brightness-90"
              style={{ backgroundColor: baseline }}
            />
            <div className="h-11 w-11" style={{ backgroundColor: color }} aria-hidden />
          </div>
          <div className="mt-0.5 flex justify-between px-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--duos-ink-muted)]">
            <span>{unchanged ? "" : "Was"}</span>
            <span>Now</span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm font-semibold uppercase tracking-wider text-[var(--duos-ink)]">
            {color}
          </p>
          <p className="text-xs text-[var(--duos-ink-muted)]">
            H {Math.round(hsv.h)}° · S {Math.round(hsv.s * 100)}% · B {Math.round(hsv.v * 100)}%
          </p>
        </div>
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

      <Button size="sm" variant="secondary" fullWidth onClick={() => onSavePersonal(color)}>
        <span
          className="h-4 w-4 rounded-full border border-black/10"
          style={{ backgroundColor: color }}
          aria-hidden
        />
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

function dedupeHex(colors: string[]): string[] {
  const seen = new Set<string>();
  return colors.filter((c) => {
    const key = c.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
  // Anchor for the shades strip: the last deliberately-picked color. Tapping a
  // shade doesn't move it, so the ramp stays stable while you shade.
  const [shadeBase, setShadeBase] = useState(() => normalizeHex(color));
  // "Was" chip in the custom tab: the color when the custom tab was opened.
  const [customBaseline, setCustomBaseline] = useState(() => normalizeHex(color));
  const [editTarget, setEditTarget] = useState<SwatchEditTarget | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorColor, setEditorColor] = useState(color);

  // Mirror of the current color so gesture-end commits never read a stale
  // closure (moves can outpace renders on 120Hz touch screens).
  const colorRef = useRef(normalizeHex(color));

  const paletteGroups = getEffectivePaletteGroups(overrides);
  const personalColors = filledPersonalColors(personalSlots);

  const applyColor = useCallback(
    (hex: string, opts?: { rebase?: boolean }) => {
      const normalized = normalizeHex(hex);
      colorRef.current = normalized;
      onChange(normalized);
      setHexInput(normalized);
      setHsv(hexToHsv(normalized));
      setRgb(hexToRgb(normalized));
      setRecents(pushRecentColor(normalized));
      if (opts?.rebase !== false) setShadeBase(normalized);
    },
    [onChange]
  );

  /** Pick a shade of the current base without re-anchoring the shade strip. */
  const applyShade = useCallback(
    (hex: string) => applyColor(hex, { rebase: false }),
    [applyColor]
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

  // HSV stays the source of truth during custom-picker drags (HsvArea keeps a
  // gesture-local mirror); recents are committed once per gesture on
  // pointer-up so we don't hammer localStorage at touch-move frequency.
  const updateFromHsv = useCallback(
    (next: HSV) => {
      const normalized = normalizeHex(hsvToHex(next));
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
    setShadeBase(colorRef.current);
  }, []);

  const handleTabChange = useCallback(
    (t: PickerTab) => {
      if (t === "custom" && tab !== "custom") setCustomBaseline(colorRef.current);
      setTab(t);
    },
    [tab]
  );

  const collapsedSwatches = dedupeHex([
    ...recents.slice(0, 5),
    ...personalColors,
    ...QUICK_PICKS,
  ]);

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
              onEmptyPick={() => setPersonalSlots(setPersonalSlot(i, colorRef.current))}
              onLongPress={() =>
                openEditor(slot ?? color, {
                  kind: "preset",
                  groupId: "personal",
                  index: i,
                  label: "My color",
                })
              }
              size="sm"
              label={slot ? `My color ${i + 1}` : `Save current color to slot ${i + 1}`}
            />
          ))}
        </div>
        <p className="mt-1.5 text-[10px] text-[var(--duos-ink-muted)]">
          Tap + to save the current color · long-press a swatch to edit
        </p>
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
      baseline={customBaseline}
      hsv={hsv}
      hexInput={hexInput}
      rgb={rgb}
      onHsvChange={updateFromHsv}
      onHsvCommit={commitRecent}
      onRevert={() => applyColor(customBaseline)}
      setHexInput={setHexInput}
      applyColor={applyColor}
      onSavePersonal={handleSavePersonal}
    />
  );

  return (
    <div data-testid="color-picker">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (!sheetOpen || tab !== "custom") setCustomBaseline(colorRef.current);
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

      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
          sheetOpen ? "[grid-template-rows:1fr] opacity-100" : "[grid-template-rows:0fr] opacity-0"
        }`}
        inert={!sheetOpen}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pt-2">
            <div className="space-y-3 rounded-[var(--radius-panel)] border border-[var(--duos-border)] bg-[var(--duos-surface)] p-3 shadow-sm">
              <ShadeStrip base={shadeBase} current={color} onPick={applyShade} />
              <TabBar tab={tab} onTabChange={handleTabChange} />
              {tab === "quick" && quickTab}
              {tab === "palette" && paletteTab}
              {tab === "custom" && customPanel}
            </div>
          </div>
        </div>
      </div>

      {editorOpen && (
        <div className="mt-2">
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
        </div>
      )}
    </div>
  );
}
