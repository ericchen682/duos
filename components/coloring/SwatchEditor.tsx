"use client";

import { useState } from "react";
import { hexToHsv, hsvToHex, normalizeHex } from "@/lib/coloring/colorUtils";
import { HsvArea } from "@/components/coloring/HsvArea";
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
  // Captured once on mount so the "reset" half of the chip stays the original.
  const [original] = useState(() => normalizeHex(initialColor));
  const color = normalizeHex(hsvToHex(hsv));

  return (
    <div
      className="animate-pop-in space-y-4 rounded-[var(--radius-panel)] border border-[var(--duos-border)] bg-[var(--duos-surface)] p-4 shadow-[var(--shadow-soft)]"
      role="dialog"
      aria-label="Edit color"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex shrink-0 overflow-hidden rounded-xl border-2 border-black/10 shadow-inner">
            <button
              type="button"
              onClick={() => setHsv(hexToHsv(original))}
              disabled={color === original}
              aria-label={`Reset to original color ${original}`}
              title="Tap to reset to the original color"
              className="h-12 w-8 touch-manipulation select-none transition enabled:cursor-pointer enabled:active:brightness-90"
              style={{ backgroundColor: original }}
            />
            <span className="h-12 w-8" style={{ backgroundColor: color }} aria-hidden />
          </div>
          <div>
            <p className="font-display text-base font-bold text-[var(--duos-ink)]">Edit color</p>
            <p className="text-xs text-[var(--duos-ink-muted)]">
              {target ? `${target.label} · ` : ""}
              <span className="font-mono uppercase tracking-wider">{color}</span>
            </p>
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

      <HsvArea hsv={hsv} onChange={setHsv} svHeightClassName="h-32 sm:h-40" />

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
