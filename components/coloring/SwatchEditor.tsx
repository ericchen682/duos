"use client";

import { useCallback, useState } from "react";
import { hexToHsv, hsvToHex, normalizeHex } from "@/lib/coloring/colorUtils";
import { Button } from "@/components/ui/Button";

export interface SwatchEditTarget {
  kind: "preset";
  groupId: string;
  index: number;
  label: string;
}

interface SwatchEditorProps {
  initialColor: string;
  target?: SwatchEditTarget;
  personalSlotIndex?: number;
  onApply: (hex: string) => void;
  onSavePersonal: (hex: string) => void;
  onReplacePreset?: (hex: string) => void;
  onUpdateSlot?: (hex: string) => void;
  onClose: () => void;
}

export function SwatchEditor({
  initialColor,
  target,
  personalSlotIndex,
  onApply,
  onSavePersonal,
  onReplacePreset,
  onUpdateSlot,
  onClose,
}: SwatchEditorProps) {
  const [hsv, setHsv] = useState(() => hexToHsv(initialColor));
  const color = normalizeHex(hsvToHex(hsv));

  const updateHsv = useCallback((patch: Partial<typeof hsv>) => {
    setHsv((prev) => ({ ...prev, ...patch }));
  }, []);

  return (
    <div
      className="animate-pop-in space-y-4 rounded-[var(--radius-panel)] border border-[var(--duos-border)] bg-[var(--duos-surface)] p-4 shadow-[var(--shadow-soft)]"
      role="dialog"
      aria-label="Edit color"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="h-12 w-12 shrink-0 rounded-xl border-2 border-black/10 shadow-inner"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          <div>
            <p className="font-display text-base font-bold text-[var(--duos-ink)]">Edit color</p>
            {target && (
              <p className="text-xs text-[var(--duos-ink-muted)]">
                {target.label} — long-press to tweak presets
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--duos-ink-muted)] transition hover:bg-[var(--duos-surface-raised)]"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="space-y-3">
        <label className="block text-xs font-bold uppercase tracking-wide text-[var(--duos-ink-muted)]">
          Hue
          <input
            type="range"
            min={0}
            max={360}
            value={Math.round(hsv.h)}
            onChange={(e) => updateHsv({ h: Number(e.target.value) })}
            className="mt-1 w-full accent-[var(--duos-accent)]"
          />
        </label>
        <label className="block text-xs font-bold uppercase tracking-wide text-[var(--duos-ink-muted)]">
          Saturation
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(hsv.s * 100)}
            onChange={(e) => updateHsv({ s: Number(e.target.value) / 100 })}
            className="mt-1 w-full accent-[var(--duos-accent)]"
          />
        </label>
        <label className="block text-xs font-bold uppercase tracking-wide text-[var(--duos-ink-muted)]">
          Brightness
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(hsv.v * 100)}
            onChange={(e) => updateHsv({ v: Number(e.target.value) / 100 })}
            className="mt-1 w-full accent-[var(--duos-accent)]"
          />
        </label>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button size="sm" onClick={() => onApply(color)}>
          Use color
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onSavePersonal(color)}>
          Save to My Colors
        </Button>
        {personalSlotIndex !== undefined && onUpdateSlot && (
          <Button size="sm" variant="secondary" onClick={() => onUpdateSlot(color)}>
            Update slot
          </Button>
        )}
        {target && onReplacePreset && (
          <Button size="sm" variant="secondary" onClick={() => onReplacePreset(color)}>
            Replace preset
          </Button>
        )}
      </div>
    </div>
  );
}
