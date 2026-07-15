"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadImage } from "@/lib/imageUtils";
import { deriveMask } from "@/lib/mask";
import {
  computeSeedsForPath,
  extendPathToEdges,
  presetSplit,
} from "@/lib/splits";
import type {
  ColoringPage,
  Point,
  SplitData,
  SplitPreset,
  SplitType,
} from "@/lib/types";

const PREVIEW_W = 560;

const PRESETS: { id: SplitPreset; label: string; icon: string }[] = [
  { id: "vertical", label: "Vertical", icon: "▮▮" },
  { id: "horizontal", label: "Horizontal", icon: "⬒" },
  { id: "diagonal", label: "Diagonal", icon: "◺" },
];

interface SplitEditorProps {
  pages: ColoringPage[];
  selectedPage: ColoringPage;
  onSelectPage: (page: ColoringPage) => void;
  onConfirm: (splitType: SplitType, splitData: SplitData) => void;
  busy?: boolean;
}

export function SplitEditor({
  pages,
  selectedPage,
  onSelectPage,
  onConfirm,
  busy,
}: SplitEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [preset, setPreset] = useState<SplitPreset>("vertical");
  const [customPath, setCustomPath] = useState<Point[]>([]);
  const drawingRef = useRef(false);

  const previewH = Math.round((PREVIEW_W * selectedPage.height) / selectedPage.width);

  const currentSplit = useCallback((): SplitData | null => {
    if (mode === "preset") return presetSplit(preset);
    if (customPath.length >= 2) {
      const path = extendPathToEdges(customPath);
      const { seedA, seedB } = computeSeedsForPath(path);
      return { path, seedA, seedB };
    }
    return null;
  }, [mode, preset, customPath]);

  const splitType: SplitType = mode === "preset" ? preset : "custom";

  const render = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!imgRef.current || imgRef.current.src.indexOf(selectedPage.src) === -1) {
      imgRef.current = await loadImage(selectedPage.src);
    }
    const img = imgRef.current;

    ctx.clearRect(0, 0, PREVIEW_W, previewH);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, PREVIEW_W, previewH);
    ctx.drawImage(img, 0, 0, PREVIEW_W, previewH);

    // While actively drawing a freehand line, skip the (expensive) mask tint and
    // just trace the raw path for smooth feedback. The tint is rendered on release.
    const split = drawingRef.current ? null : currentSplit();
    if (split) {
      const maskA = deriveMask(PREVIEW_W, previewH, split, "A");
      const maskB = deriveMask(PREVIEW_W, previewH, split, "B");
      const tint = ctx.getImageData(0, 0, PREVIEW_W, previewH);
      for (let i = 0; i < maskA.length; i++) {
        const o = i * 4;
        if (maskA[i]) {
          tint.data[o] = Math.min(255, tint.data[o] * 0.75 + 244 * 0.25);
          tint.data[o + 1] = Math.min(255, tint.data[o + 1] * 0.75 + 63 * 0.25);
          tint.data[o + 2] = Math.min(255, tint.data[o + 2] * 0.75 + 94 * 0.25);
        } else if (maskB[i]) {
          tint.data[o] = Math.min(255, tint.data[o] * 0.75 + 99 * 0.25);
          tint.data[o + 1] = Math.min(255, tint.data[o + 1] * 0.75 + 102 * 0.25);
          tint.data[o + 2] = Math.min(255, tint.data[o + 2] * 0.75 + 241 * 0.25);
        }
      }
      ctx.putImageData(tint, 0, 0);

      // Dividing line on top.
      ctx.strokeStyle = "rgba(15,23,42,0.85)";
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      split.path.forEach((p, idx) => {
        const x = p.x * PREVIEW_W;
        const y = p.y * previewH;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (customPath.length > 0) {
      ctx.strokeStyle = "rgba(15,23,42,0.85)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      customPath.forEach((p, idx) => {
        const x = p.x * PREVIEW_W;
        const y = p.y * previewH;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }, [selectedPage, previewH, currentSplit, customPath]);

  useEffect(() => {
    render();
  }, [render]);

  const toNorm = (e: React.PointerEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };

  const onDown = (e: React.PointerEvent) => {
    if (mode !== "custom") return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drawingRef.current = true;
    setCustomPath([toNorm(e)]);
  };
  const onMove = (e: React.PointerEvent) => {
    if (mode !== "custom" || !drawingRef.current) return;
    e.preventDefault();
    setCustomPath((prev) => [...prev, toNorm(e)]);
  };
  const onUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    // Re-render now that drawing finished so the tinted split preview appears.
    render();
  };

  const split = currentSplit();
  const canConfirm = Boolean(split) && !busy;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          1. Pick a page
        </h3>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {pages.map((page) => (
            <button
              key={page.id}
              type="button"
              onClick={() => onSelectPage(page)}
              className={`shrink-0 overflow-hidden rounded-xl border-2 bg-white transition ${
                page.src === selectedPage.src
                  ? "border-rose-400 shadow-md"
                  : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={page.src} alt={page.title} className="h-20 w-28 object-contain" />
              <span className="block px-2 pb-1 text-xs font-semibold text-slate-600">
                {page.title}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          2. Choose the split
        </h3>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setMode("preset");
                setPreset(p.id);
              }}
              aria-pressed={mode === "preset" && preset === p.id}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                mode === "preset" && preset === p.id
                  ? "bg-slate-800 text-white shadow"
                  : "bg-white text-slate-600 shadow-sm hover:bg-slate-100"
              }`}
            >
              <span aria-hidden>{p.icon}</span>
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setMode("custom");
              setCustomPath([]);
            }}
            aria-pressed={mode === "custom"}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
              mode === "custom"
                ? "bg-slate-800 text-white shadow"
                : "bg-white text-slate-600 shadow-sm hover:bg-slate-100"
            }`}
          >
            ✏️ Freehand
          </button>
        </div>
        {mode === "custom" && (
          <p className="mt-2 text-sm text-slate-500">
            Drag across the picture from one edge to another to draw your own dividing
            line.{" "}
            {customPath.length > 0 && (
              <button
                type="button"
                onClick={() => setCustomPath([])}
                className="font-semibold text-rose-500 underline"
              >
                Redraw
              </button>
            )}
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
        <canvas
          ref={canvasRef}
          width={PREVIEW_W}
          height={previewH}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className={`block w-full ${mode === "custom" ? "no-touch-scroll cursor-crosshair" : ""}`}
          style={{ aspectRatio: `${PREVIEW_W} / ${previewH}` }}
        />
      </div>

      <div className="flex items-center gap-4 text-sm font-semibold">
        <span className="flex items-center gap-2 text-rose-500">
          <span className="h-3 w-3 rounded-full bg-rose-400" /> Your half
        </span>
        <span className="flex items-center gap-2 text-indigo-500">
          <span className="h-3 w-3 rounded-full bg-indigo-400" /> Partner&apos;s half
        </span>
      </div>

      <button
        type="button"
        disabled={!canConfirm}
        onClick={() => {
          if (split) onConfirm(splitType, split);
        }}
        className="w-full rounded-2xl bg-gradient-to-br from-rose-400 to-pink-500 px-6 py-4 text-lg font-bold text-white shadow-lg shadow-rose-200 transition active:scale-[0.98] disabled:opacity-50"
      >
        {busy ? "Saving…" : "Lock in the split & start"}
      </button>
    </div>
  );
}
