"use client";

import { useRef } from "react";
import { hsvToHex, type HSV } from "@/lib/coloring/colorUtils";

interface HsvAreaProps {
  hsv: HSV;
  /** Fires on every pointer move while dragging (and on tap). */
  onChange: (next: HSV) => void;
  /** Fires once at the end of each drag gesture — commit recents etc. here. */
  onCommit?: () => void;
  /** Height classes for the saturation/brightness pad. */
  svHeightClassName?: string;
}

/**
 * Shared saturation/brightness pad + hue bar.
 *
 * HSV is the source of truth while dragging: converting back through 8-bit hex
 * loses hue/saturation near black and white, which made the hue drift (or snap
 * to red) mid-drag. A ref mirrors the hsv value during a gesture so
 * pointermove handlers never read a stale closure (moves can outpace renders
 * on 120Hz touch screens); it re-syncs from the prop at gesture start, so
 * external changes (hex input, swatch picks) are picked up between gestures.
 */
export function HsvArea({
  hsv,
  onChange,
  onCommit,
  svHeightClassName = "h-36 sm:h-44",
}: HsvAreaProps) {
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const draggingSv = useRef(false);
  const draggingHue = useRef(false);
  const hsvRef = useRef(hsv);

  const color = hsvToHex(hsv);
  const hueBg = `hsl(${hsv.h} 100% 50%)`;
  const svBg = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueBg})`;

  const update = (next: HSV) => {
    hsvRef.current = next;
    onChange(next);
  };

  const pickSv = (clientX: number, clientY: number) => {
    const el = svRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
    update({ ...hsvRef.current, s, v });
  };

  const pickHue = (clientX: number) => {
    const el = hueRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const h = Math.max(0, Math.min(360, ((clientX - rect.left) / rect.width) * 360));
    update({ ...hsvRef.current, h });
  };

  const endGesture = (flag: React.RefObject<boolean>) => {
    if (!flag.current) return;
    flag.current = false;
    onCommit?.();
  };

  return (
    <div className="space-y-3">
      <div
        ref={svRef}
        role="application"
        aria-label="Saturation and brightness"
        className={`no-touch-scroll relative w-full cursor-crosshair overflow-hidden rounded-xl border border-[var(--duos-border)] ${svHeightClassName}`}
        style={{ background: svBg }}
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture?.(e.pointerId);
          hsvRef.current = hsv;
          draggingSv.current = true;
          pickSv(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (!draggingSv.current) return;
          e.preventDefault();
          pickSv(e.clientX, e.clientY);
        }}
        onPointerUp={() => endGesture(draggingSv)}
        onPointerCancel={() => endGesture(draggingSv)}
      >
        <span
          className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md ring-1 ring-black/20"
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
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture?.(e.pointerId);
          hsvRef.current = hsv;
          draggingHue.current = true;
          pickHue(e.clientX);
        }}
        onPointerMove={(e) => {
          if (!draggingHue.current) return;
          e.preventDefault();
          pickHue(e.clientX);
        }}
        onPointerUp={() => endGesture(draggingHue)}
        onPointerCancel={() => endGesture(draggingHue)}
      >
        <span
          className="pointer-events-none absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ring-1 ring-black/20"
          style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: hueBg }}
        />
      </div>
    </div>
  );
}
