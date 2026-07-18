"use client";

// Dev-only harness for exercising the ColoringCanvas in isolation (no Supabase).
// Visit /dev/canvas. Safe to delete; not linked from the app.

import { useRef, useState } from "react";
import { ColorPicker } from "@/components/coloring/ColorPicker";
import { ColoringCanvas, type ColoringCanvasHandle } from "@/components/coloring/ColoringCanvas";
import { HistoryControls, Toolbar } from "@/components/coloring/Toolbar";
import { useDrawingTools } from "@/components/coloring/useDrawingTools";
import { Panel } from "@/components/ui/Card";
import { presetSplit } from "@/lib/coloring/splits";
import type { PlayerRole, SplitPreset } from "@/lib/types";

const PAGE = { src: "/coloring-pages/house.png", width: 1000, height: 750 };

export default function DevCanvasPage() {
  const ref = useRef<ColoringCanvasHandle>(null);
  const { tool, setTool, brushSize, setBrushSize } = useDrawingTools();
  const [color, setColor] = useState("#c45c4a");
  const [role, setRole] = useState<PlayerRole>("A");
  const [preset, setPreset] = useState<SplitPreset>("vertical");
  const [history, setHistory] = useState({ canUndo: false, canRedo: false });
  const [ready, setReady] = useState(false);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6">
      {/* Top bar: heading, harness controls, and history controls. */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-[var(--duos-ink)]">
            Canvas dev harness
          </h1>
          <p className="text-sm text-[var(--duos-ink-muted)]" data-testid="ready-state">
            ready: {String(ready)}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-sm">
          <label className="flex min-h-11 items-center gap-2">
            role:{" "}
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as PlayerRole)}
              className="min-h-11 rounded-xl border border-[var(--duos-border)] px-3"
            >
              <option value="A">A</option>
              <option value="B">B</option>
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2">
            split:{" "}
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value as SplitPreset)}
              className="min-h-11 rounded-xl border border-[var(--duos-border)] px-3"
            >
              <option value="vertical">vertical</option>
              <option value="horizontal">horizontal</option>
              <option value="diagonal">diagonal</option>
            </select>
          </label>
          <HistoryControls
            onUndo={() => ref.current?.undo()}
            onRedo={() => ref.current?.redo()}
            onClear={() => ref.current?.clear()}
            canUndo={history.canUndo}
            canRedo={history.canRedo}
          />
        </div>
      </div>

      {/* Main area: tool rail left, canvas center, color picker right on md+;
         stacked bars above the canvas below md. */}
      <div className="space-y-3 md:flex md:items-start md:gap-4 md:space-y-0">
        <Panel className="p-2 md:order-1 md:shrink-0 md:self-start">
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

        <Panel className="p-3 md:order-3 md:w-72 md:shrink-0 md:self-start lg:w-80">
          <ColorPicker color={color} onChange={setColor} layout="compact" />
        </Panel>

        <div className="min-w-0 md:order-2 md:flex-1">
          <ColoringCanvas
            ref={ref}
            pageSrc={PAGE.src}
            width={PAGE.width}
            height={PAGE.height}
            split={presetSplit(preset)}
            role={role}
            tool={tool}
            color={color}
            brushSize={brushSize}
            onReadyChange={setReady}
            onHistoryChange={setHistory}
          />
        </div>
      </div>
    </main>
  );
}
