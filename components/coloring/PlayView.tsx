"use client";

import { useRef, useState } from "react";
import { ColorPicker } from "@/components/coloring/ColorPicker";
import { ColoringCanvas, type ColoringCanvasHandle } from "@/components/coloring/ColoringCanvas";
import { Toolbar, type Tool } from "@/components/coloring/Toolbar";
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
  const [tool, setTool] = useState<Tool>("fill");
  const [color, setColor] = useState("#c45c4a");
  const [brushSize, setBrushSize] = useState(14);
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-extrabold text-[var(--duos-ink)] sm:text-3xl">
            Color your half
          </h2>
          <p className="mt-1 text-sm text-[var(--duos-ink-muted)]">
            Player {role} — your colors stay hidden until you both finish.
          </p>
        </div>
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
      </div>

      {!isDone && (
        <Panel className="sticky top-3 z-10 space-y-4 bg-[var(--duos-surface)]/95 backdrop-blur-md">
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
          <ColorPicker color={color} onChange={setColor} />
        </Panel>
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
      ) : (
        <Button
          variant="success"
          size="lg"
          fullWidth
          disabled={!ready || submitting}
          onClick={handleDone}
        >
          {submitting ? "Submitting…" : "I'm done — submit my half"}
        </Button>
      )}
    </div>
  );
}
