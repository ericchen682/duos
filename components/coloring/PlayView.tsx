"use client";

import { useRef, useState } from "react";
import { ColorPicker } from "@/components/coloring/ColorPicker";
import { ColoringCanvas, type ColoringCanvasHandle } from "@/components/coloring/ColoringCanvas";
import { HistoryControls, Toolbar } from "@/components/coloring/Toolbar";
import { useDrawingTools } from "@/components/coloring/useDrawingTools";
import { Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Card";
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
  const { tool, setTool, brushSize, setBrushSize } = useDrawingTools();
  const [color, setColor] = useState("#c45c4a");
  const [history, setHistory] = useState({ canUndo: false, canRedo: false });
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const partnerBadgeTone = !partnerPresent
    ? "neutral"
    : partnerDone
      ? "success"
      : "warning";

  const partnerLabel = !partnerPresent
    ? "Waiting for partner"
    : partnerDone
      ? "Partner is done"
      : "Partner is coloring";

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

  const canvas = (
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
  );

  return (
    <div className="space-y-4">
      {/* Top bar: heading, partner status, and history controls. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-extrabold text-[var(--duos-ink)] sm:text-3xl">
            Color your half
          </h2>
          <p className="mt-1 text-sm text-[var(--duos-ink-muted)]">
            Player {role} — your colors stay hidden until you both finish.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={partnerBadgeTone}>
            <span
              className={`mr-2 inline-block h-2 w-2 rounded-full ${
                partnerPresent
                  ? partnerDone
                    ? "bg-emerald-500"
                    : "bg-amber-500"
                  : "bg-slate-400"
              }`}
              aria-hidden
            />
            {partnerLabel}
          </Badge>
          {!isDone && (
            <HistoryControls
              onUndo={() => canvasRef.current?.undo()}
              onRedo={() => canvasRef.current?.redo()}
              onClear={() => canvasRef.current?.clear()}
              canUndo={history.canUndo}
              canRedo={history.canRedo}
            />
          )}
        </div>
      </div>

      {isDone ? (
        <div className="mx-auto w-full max-w-3xl space-y-4">
          {canvas}
          <Panel className="border-emerald-200 bg-emerald-50/80 text-center">
            <p className="font-display text-lg font-bold text-emerald-800">
              Your half is submitted
            </p>
            <p className="mt-1 text-sm text-emerald-700">
              {partnerDone
                ? "Revealing the finished drawing…"
                : "Waiting for your partner to finish."}
            </p>
            {!partnerDone && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={onKeepColoring}
              >
                Keep coloring
              </Button>
            )}
          </Panel>
        </div>
      ) : (
        /* Main area: tool rail left, canvas center, color picker right on md+;
           stacked bars above the canvas below md (today's phone behavior). */
        <div className="space-y-4 md:flex md:items-start md:gap-4 md:space-y-0">
          <div className="sticky top-2 z-10 flex flex-col gap-2 md:contents">
            <Panel className="bg-[var(--duos-surface)]/95 p-2 backdrop-blur-md md:order-1 md:sticky md:top-2 md:shrink-0 md:self-start">
              <div className="md:hidden">
                <Toolbar
                  tool={tool}
                  onToolChange={setTool}
                  brushSize={brushSize}
                  onBrushSizeChange={setBrushSize}
                />
              </div>
              <div className="hidden md:block">
                <Toolbar
                  orientation="vertical"
                  tool={tool}
                  onToolChange={setTool}
                  brushSize={brushSize}
                  onBrushSizeChange={setBrushSize}
                />
              </div>
            </Panel>
            <Panel className="bg-[var(--duos-surface)]/95 p-3 backdrop-blur-md md:order-3 md:sticky md:top-2 md:w-72 md:shrink-0 md:self-start lg:w-80">
              <ColorPicker color={color} onChange={setColor} layout="compact" />
            </Panel>
          </div>

          <div className="min-w-0 space-y-4 md:order-2 md:flex-1">
            {canvas}
            <Button
              variant="success"
              size="lg"
              fullWidth
              disabled={!ready || submitting}
              onClick={handleDone}
            >
              {submitting ? "Submitting…" : "I'm done — submit my half"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
