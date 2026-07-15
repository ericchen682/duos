"use client";

// Dev-only harness for exercising the ColoringCanvas in isolation (no Supabase).
// Visit /dev/canvas. Safe to delete; not linked from the app.

import { useRef, useState } from "react";
import { ColorPalette } from "@/components/ColorPalette";
import { ColoringCanvas, type ColoringCanvasHandle } from "@/components/ColoringCanvas";
import { Toolbar, type Tool } from "@/components/Toolbar";
import { presetSplit } from "@/lib/splits";
import type { PlayerRole, SplitPreset } from "@/lib/types";

const PAGE = { src: "/coloring-pages/house.png", width: 1000, height: 750 };

export default function DevCanvasPage() {
  const ref = useRef<ColoringCanvasHandle>(null);
  const [tool, setTool] = useState<Tool>("fill");
  const [color, setColor] = useState("#f43f5e");
  const [brushSize, setBrushSize] = useState(14);
  const [role, setRole] = useState<PlayerRole>("A");
  const [preset, setPreset] = useState<SplitPreset>("vertical");
  const [history, setHistory] = useState({ canUndo: false, canRedo: false });
  const [ready, setReady] = useState(false);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="mb-2 font-display text-2xl font-bold">Canvas dev harness</h1>
      <p className="mb-4 text-sm text-slate-500" data-testid="ready-state">
        ready: {String(ready)}
      </p>

      <div className="mb-3 flex flex-wrap gap-2 text-sm">
        <label>
          role:{" "}
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as PlayerRole)}
            className="rounded border px-2 py-1"
          >
            <option value="A">A</option>
            <option value="B">B</option>
          </select>
        </label>
        <label>
          split:{" "}
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as SplitPreset)}
            className="rounded border px-2 py-1"
          >
            <option value="vertical">vertical</option>
            <option value="horizontal">horizontal</option>
            <option value="diagonal">diagonal</option>
          </select>
        </label>
      </div>

      <div className="mb-3 space-y-3">
        <Toolbar
          tool={tool}
          onToolChange={setTool}
          brushSize={brushSize}
          onBrushSizeChange={setBrushSize}
          onUndo={() => ref.current?.undo()}
          onRedo={() => ref.current?.redo()}
          onClear={() => ref.current?.clear()}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
        />
        <ColorPalette color={color} onChange={setColor} />
      </div>

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
    </main>
  );
}
