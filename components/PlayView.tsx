"use client";

import { useRef, useState } from "react";
import { ColorPalette } from "./ColorPalette";
import { ColoringCanvas, type ColoringCanvasHandle } from "./ColoringCanvas";
import { Toolbar, type Tool } from "./Toolbar";
import type { PlayerRole, SplitData } from "@/lib/types";

interface PlayViewProps {
  pageSrc: string;
  width: number;
  height: number;
  split: SplitData;
  role: PlayerRole;
  isDone: boolean;
  partnerDone: boolean;
  partnerPresent: boolean;
  onMarkDone: (blob: Blob) => Promise<void>;
  onKeepColoring: () => Promise<void>;
}

export function PlayView({
  pageSrc,
  width,
  height,
  split,
  role,
  isDone,
  partnerDone,
  partnerPresent,
  onMarkDone,
  onKeepColoring,
}: PlayViewProps) {
  const canvasRef = useRef<ColoringCanvasHandle>(null);
  const [tool, setTool] = useState<Tool>("fill");
  const [color, setColor] = useState("#f43f5e");
  const [brushSize, setBrushSize] = useState(14);
  const [history, setHistory] = useState({ canUndo: false, canRedo: false });
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleDone = async () => {
    const handle = canvasRef.current;
    if (!handle) return;
    setSubmitting(true);
    try {
      const blob = await handle.exportHalfBlob();
      if (blob) await onMarkDone(blob);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-extrabold text-slate-800">
            Color your half
          </h2>
          <p className="text-sm text-slate-500">
            You&apos;re player {role}. Your partner can&apos;t see your colors until you
            both finish.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${
              partnerPresent
                ? partnerDone
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                partnerPresent ? (partnerDone ? "bg-green-500" : "bg-amber-500") : "bg-slate-400"
              }`}
            />
            {partnerPresent
              ? partnerDone
                ? "Partner is done"
                : "Partner is coloring"
              : "Waiting for partner"}
          </span>
        </div>
      </div>

      {!isDone && (
        <div className="sticky top-0 z-10 -mx-1 flex flex-col gap-3 rounded-2xl bg-white/60 p-2 backdrop-blur">
          <Toolbar
            tool={tool}
            onToolChange={setTool}
            brushSize={brushSize}
            onBrushSizeChange={setBrushSize}
            onUndo={() => canvasRef.current?.undo()}
            onRedo={() => canvasRef.current?.redo()}
            onClear={() => canvasRef.current?.clear()}
            canUndo={history.canUndo}
            canRedo={history.canRedo}
          />
          <ColorPalette color={color} onChange={setColor} />
        </div>
      )}

      <ColoringCanvas
        ref={canvasRef}
        pageSrc={pageSrc}
        width={width}
        height={height}
        split={split}
        role={role}
        tool={tool}
        color={color}
        brushSize={brushSize}
        onReadyChange={setReady}
        onHistoryChange={setHistory}
      />

      {isDone ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center">
          <p className="font-display text-lg font-bold text-green-700">
            Your half is submitted! 🎨
          </p>
          <p className="mt-1 text-sm text-green-600">
            {partnerDone
              ? "Revealing the finished drawing…"
              : "Waiting for your partner to finish."}
          </p>
          {!partnerDone && (
            <button
              onClick={onKeepColoring}
              className="mt-3 rounded-xl border border-green-300 bg-white px-4 py-2 text-sm font-bold text-green-700 transition hover:bg-green-50"
            >
              Keep coloring
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={handleDone}
          disabled={!ready || submitting}
          className="w-full rounded-2xl bg-gradient-to-br from-emerald-400 to-green-500 px-6 py-4 text-lg font-bold text-white shadow-lg shadow-green-200 transition active:scale-[0.98] disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "I'm done — submit my half"}
        </button>
      )}
    </div>
  );
}
