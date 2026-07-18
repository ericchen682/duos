"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { clampPopoverNearAnchor } from "@/lib/coloring/anchorPopover";
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
  /** Long-press passes the button element so the editor can anchor nearby. */
  onLongPress?: (el: HTMLElement) => void;
  /** Tap handler for empty slots (e.g. save the current color into the slot). */
  onEmptyPick?: () => void;
  size?: "sm" | "md";
  empty?: boolean;
  label?: string;
}) {
  // Dense visual swatch with ≥44px hit area (ui-ux-pro-max touch targets).
  const visual = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const hit = "flex min-h-11 min-w-11 shrink-0 items-center justify-center";
  const touchSafe = "touch-manipulation select-none [-webkit-touch-callout:none]";
  const longPressTriggered = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

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
        className={`${hit} ${touchSafe} rounded-full text-sm text-[var(--duos-ink-muted)] transition hover:text-[var(--duos-accent)] active:scale-95`}
      >
        <span
          className={`${visual} flex items-center justify-center rounded-full border-2 border-dashed border-[var(--duos-border)] bg-white hover:border-[var(--duos-accent)]`}
        >
          +
        </span>
      </button>
    );
  }

  return (
    <button
      ref={btnRef}
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
            if (btnRef.current) onLongPress(btnRef.current);
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
      className={`${hit} ${touchSafe} rounded-full transition active:scale-95`}
    >
      <span
        className={`${visual} flex items-center justify-center rounded-full border-2 shadow-sm ${
          selected
            ? "scale-105 border-[var(--duos-ink)] ring-2 ring-[var(--duos-ink)] ring-offset-1"
            : "border-black/10"
        }`}
        style={{ backgroundColor: c }}
      >
        {selected && (
          <span
            className="pointer-events-none text-[10px] font-bold"
            style={{ color: contrastText(c) }}
            aria-hidden
          >
            ✓
          </span>
        )}
      </span>
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
  const [editorAnchor, setEditorAnchor] = useState<DOMRect | null>(null);
  const [editorPos, setEditorPos] = useState<{ top: number; left: number } | null>(null);
  const editorPanelRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

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

  // Collapsed-rail swatches are deliberately stable: they seed from saved
  // colors once, then reorder only when a color is chosen inside the expanded
  // sheet — never from rail taps, so the rail can't shuffle under your finger.
  const [railColors, setRailColors] = useState<string[]>(() =>
    dedupeHex([
      ...loadRecentColors().slice(0, 5),
      ...filledPersonalColors(loadPersonalPalette()),
      ...QUICK_PICKS,
    ]).slice(0, 6)
  );

  const promoteToRail = useCallback((hex: string) => {
    const normalized = normalizeHex(hex);
    setRailColors((prev) => dedupeHex([normalized, ...prev]).slice(0, 6));
  }, []);

  /** Pick from inside the expanded sheet: applies the color and surfaces it on the rail. */
  const applyFromSheet = useCallback(
    (hex: string) => {
      applyColor(hex);
      promoteToRail(hex);
    },
    [applyColor, promoteToRail]
  );

  const applyShadeFromSheet = useCallback(
    (hex: string) => {
      applyShade(hex);
      promoteToRail(hex);
    },
    [applyShade, promoteToRail]
  );

  const handleSavePersonal = useCallback((hex: string) => {
    setPersonalSlots(addToPersonalPalette(hex));
  }, []);

  const handleReplacePreset = useCallback(
    (hex: string) => {
      if (!editTarget || editTarget.kind !== "preset") return;
      setOverrides(setPaletteOverride(editTarget.groupId, editTarget.index, hex));
      applyFromSheet(hex);
      setEditTarget(null);
    },
    [applyFromSheet, editTarget]
  );

  const closeEditor = useCallback(() => {
    setEditorOpen(false);
    setEditTarget(null);
    setEditorAnchor(null);
    setEditorPos(null);
  }, []);

  const openEditor = useCallback((initial: string, el?: HTMLElement, target?: SwatchEditTarget) => {
    setEditorColor(initial);
    setEditTarget(target ?? null);
    setEditorAnchor(el?.getBoundingClientRect() ?? null);
    setEditorOpen(true);
  }, []);

  useLayoutEffect(() => {
    if (!editorOpen || !editorAnchor || !editorPanelRef.current) return;
    // offsetWidth/Height ignore the pop-in transform, so the clamp sees the
    // panel's settled size rather than the mid-animation one.
    const el = editorPanelRef.current;
    setEditorPos(
      clampPopoverNearAnchor(editorAnchor, el.offsetWidth || 320, el.offsetHeight || 420)
    );
  }, [editorOpen, editorAnchor, editorColor]);

  useEffect(() => {
    if (!editorOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeEditor();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editorOpen, closeEditor]);

  // Escape collapses the floating sheet, but only when the swatch editor isn't
  // the thing being dismissed.
  useEffect(() => {
    if (!isCompact || !sheetOpen || editorOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isCompact, sheetOpen, editorOpen]);

  // Outside-tap dismissal for the open sheet. A document-level capture
  // listener instead of a fixed backdrop element: ancestors of the picker use
  // backdrop-blur, which turns position:fixed descendants into panel-sized
  // boxes (a fixed backdrop silently covered nothing outside the panel).
  // Stopping the event here also keeps the closing tap from drawing a stroke.
  useEffect(() => {
    if (!isCompact || !sheetOpen || editorOpen) return;
    const onDocPointerDown = (e: PointerEvent) => {
      const root = rootRef.current;
      if (!root || (e.target instanceof Node && root.contains(e.target))) return;
      e.preventDefault();
      e.stopPropagation();
      setSheetOpen(false);
    };
    document.addEventListener("pointerdown", onDocPointerDown, { capture: true });
    return () =>
      document.removeEventListener("pointerdown", onDocPointerDown, { capture: true });
  }, [isCompact, sheetOpen, editorOpen]);

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
    promoteToRail(colorRef.current);
  }, [promoteToRail]);

  const handleTabChange = useCallback(
    (t: PickerTab) => {
      if (t === "custom" && tab !== "custom") setCustomBaseline(colorRef.current);
      setTab(t);
    },
    [tab]
  );

  const swatchGridClass = "grid grid-cols-8 gap-0.5 sm:grid-cols-9 sm:gap-1 md:grid-cols-10";

  const quickTab = (
    <div className="space-y-2">
      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--duos-ink-muted)]">
          My colors
        </p>
        <div className={swatchGridClass}>
          {personalSlots.map((slot, i) => (
            <SwatchButton
              key={`personal-${i}`}
              c={slot}
              empty={slot === null}
              selected={slot !== null && slot.toLowerCase() === color.toLowerCase()}
              onPick={applyFromSheet}
              onEmptyPick={() => setPersonalSlots(setPersonalSlot(i, colorRef.current))}
              onLongPress={(el) =>
                openEditor(slot ?? color, el, {
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
        <p className="mt-1 text-[10px] text-[var(--duos-ink-muted)]">
          Tap + to save · long-press to edit
        </p>
      </div>

      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--duos-ink-muted)]">
          Quick picks
        </p>
        <div className={swatchGridClass}>
          {QUICK_PICKS.map((c) => (
            <SwatchButton
              key={c}
              c={c}
              selected={c.toLowerCase() === color.toLowerCase()}
              onPick={applyFromSheet}
              onLongPress={(el) => openEditor(c, el)}
              size="sm"
            />
          ))}
        </div>
      </div>

      {recents.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--duos-ink-muted)]">
            Recent
          </p>
          <div className={swatchGridClass}>
            {recents.map((c) => (
              <SwatchButton
                key={`recent-${c}`}
                c={c}
                selected={c.toLowerCase() === color.toLowerCase()}
                onPick={applyFromSheet}
                onLongPress={(el) => openEditor(c, el)}
                size="sm"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const paletteTab = (
    <div className="space-y-2">
      <p className="text-[10px] text-[var(--duos-ink-muted)]">Long-press a swatch to edit.</p>
      {paletteGroups.map((group) => (
        <div key={group.id}>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--duos-ink-muted)]">
            {group.label}
          </p>
          <div className={swatchGridClass}>
            {group.colors.map((c, i) => (
              <SwatchButton
                key={`${group.id}-${i}`}
                c={c}
                selected={c.toLowerCase() === color.toLowerCase()}
                onPick={applyFromSheet}
                onLongPress={(el) =>
                  openEditor(c, el, {
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
      applyColor={applyFromSheet}
      onSavePersonal={handleSavePersonal}
    />
  );

  return (
    <div ref={rootRef} data-testid="color-picker" className="relative">
      <div className="flex items-start gap-2">
        {/* Vertical collapsed rail */}
        <div className="flex w-12 shrink-0 flex-col items-center gap-0.5">
          <button
            type="button"
            onClick={() => {
              if (!sheetOpen || tab !== "custom") setCustomBaseline(colorRef.current);
              setSheetOpen(true);
              setTab("custom");
            }}
            aria-label="Current color"
            className="flex min-h-11 min-w-11 touch-manipulation select-none items-center justify-center rounded-full"
          >
            <span
              className="h-9 w-9 rounded-full border-2 border-[var(--duos-ink)] shadow-sm ring-2 ring-[var(--duos-ink)] ring-offset-1"
              style={{ backgroundColor: color }}
            />
          </button>

          <div
            className="flex flex-col items-center gap-0.5"
            role="list"
            aria-label="Color swatches"
          >
            {railColors.map((c) => (
              <SwatchButton
                key={`collapsed-${c}`}
                c={c}
                selected={c.toLowerCase() === color.toLowerCase()}
                onPick={applyColor}
                onLongPress={(el) => openEditor(c, el)}
                size="sm"
              />
            ))}
          </div>

          {isCompact && (
            <button
              type="button"
              onClick={() => setSheetOpen((v) => !v)}
              aria-expanded={sheetOpen}
              className="mt-0.5 flex min-h-11 min-w-11 touch-manipulation select-none flex-col items-center justify-center rounded-xl border border-[var(--duos-border)] bg-[var(--duos-surface)] px-1 text-[10px] font-bold leading-tight text-[var(--duos-ink-muted)] transition hover:border-[var(--duos-accent)]"
            >
              {sheetOpen ? "Less" : "Colors"}
            </button>
          )}
        </div>

        {/* Expand sheet: in-flow sideways reveal on small screens; on md+ (compact)
            a floating panel anchored left of the rail, over the canvas, so the
            fixed-width side panel never clips it. */}
        <div
          className={`min-w-0 overflow-hidden transition-[max-width,opacity,transform] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none ${
            isCompact
              ? "md:absolute md:right-full md:top-0 md:z-40 md:mr-2 md:w-max md:max-w-none md:flex-none md:origin-top-right md:overflow-visible"
              : ""
          } ${
            sheetOpen
              ? "max-w-[min(100%,36rem)] flex-1 opacity-100"
              : `pointer-events-none max-w-0 opacity-0 ${isCompact ? "md:scale-95" : ""}`
          }`}
          inert={!sheetOpen}
        >
          <div
            className={`w-[min(100vw-9rem,36rem)] space-y-2 rounded-[var(--radius-panel)] border border-[var(--duos-border)] bg-[var(--duos-surface)] p-2.5 shadow-sm sm:p-3 ${
              isCompact
                ? "md:max-h-[calc(100dvh-7rem)] md:overflow-y-auto md:shadow-[var(--shadow-card)]"
                : ""
            }`}
          >
            <ShadeStrip base={shadeBase} current={color} onPick={applyShadeFromSheet} />
            <TabBar tab={tab} onTabChange={handleTabChange} />
            {tab === "quick" && quickTab}
            {tab === "palette" && paletteTab}
            {tab === "custom" && customPanel}
          </div>
        </div>
      </div>


      {editorOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-40"
              aria-hidden
              onPointerDown={closeEditor}
            />
            <div
              ref={editorPanelRef}
              className="fixed z-50 w-[min(100vw-1.5rem,20rem)] animate-pop-in motion-reduce:animate-none"
              style={{
                top: editorPos?.top ?? 12,
                left: editorPos?.left ?? 12,
                visibility: editorPos ? "visible" : "hidden",
              }}
            >
              <SwatchEditor
                initialColor={editorColor}
                target={
                  editTarget && editTarget.groupId !== "personal" ? editTarget : undefined
                }
                personalSlotIndex={
                  editTarget?.groupId === "personal" ? editTarget.index : undefined
                }
                onApply={(hex) => {
                  applyFromSheet(hex);
                  closeEditor();
                }}
                onSavePersonal={(hex) => {
                  if (editTarget?.groupId === "personal") {
                    setPersonalSlots(setPersonalSlot(editTarget.index, hex));
                  } else {
                    handleSavePersonal(hex);
                  }
                  applyFromSheet(hex);
                  closeEditor();
                }}
                onUpdateSlot={(hex) => {
                  if (editTarget?.groupId === "personal") {
                    setPersonalSlots(setPersonalSlot(editTarget.index, hex));
                    applyFromSheet(hex);
                  }
                  closeEditor();
                }}
                onReplacePreset={(hex) => {
                  handleReplacePreset(hex);
                  closeEditor();
                }}
                onClose={closeEditor}
              />
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
