"use client";

import { useCallback, useState } from "react";
import {
  getToolSize,
  isSizedTool,
  loadLastTool,
  loadToolSizes,
  saveLastTool,
  saveToolSizes,
  sizeKeyForTool,
} from "@/lib/coloring/toolPrefs";
import type { Tool } from "@/lib/coloring/strokes";

export function useDrawingTools() {
  const [tool, setToolState] = useState<Tool>(() => loadLastTool());
  const [sizes, setSizes] = useState(loadToolSizes);

  const brushSize = getToolSize(tool, sizes);

  const setTool = useCallback((next: Tool) => {
    saveLastTool(next);
    setToolState(next);
  }, []);

  const setBrushSize = useCallback(
    (size: number) => {
      if (!isSizedTool(tool)) return;
      const key = sizeKeyForTool(tool);
      setSizes((prev) => {
        const next = { ...prev, [key]: size };
        saveToolSizes(next);
        return next;
      });
    },
    [tool]
  );

  return { tool, setTool, brushSize, setBrushSize };
}
