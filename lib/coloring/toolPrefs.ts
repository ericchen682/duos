import {
  DEFAULT_TOOL_SIZES,
  type PenTool,
  type Tool,
  isPenTool,
} from "@/lib/coloring/strokes";

const LAST_TOOL_KEY = "duos:last-tool";
const TOOL_SIZES_KEY = "duos:tool-sizes";

type SizedTool = PenTool | "eraser";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadLastTool(): Tool {
  const raw = readJson<string | null>(LAST_TOOL_KEY, null);
  if (raw === "brush") return "pen";
  if (
    raw === "pen" ||
    raw === "marker" ||
    raw === "pencil" ||
    raw === "crayon" ||
    raw === "highlighter" ||
    raw === "airbrush" ||
    raw === "fill" ||
    raw === "eraser"
  ) {
    return raw;
  }
  return "pen";
}

export function saveLastTool(tool: Tool): void {
  writeJson(LAST_TOOL_KEY, tool);
}

export function loadToolSizes(): Record<SizedTool, number> {
  const parsed = readJson<Partial<Record<SizedTool, number>>>(TOOL_SIZES_KEY, {});
  return { ...DEFAULT_TOOL_SIZES, ...parsed };
}

export function saveToolSizes(sizes: Record<SizedTool, number>): void {
  writeJson(TOOL_SIZES_KEY, sizes);
}

export function sizeKeyForTool(tool: Tool): SizedTool {
  if (tool === "fill") return "pen";
  return tool;
}

export function getToolSize(tool: Tool, sizes: Record<SizedTool, number>): number {
  return sizes[sizeKeyForTool(tool)];
}

export function isSizedTool(tool: Tool): tool is SizedTool {
  return tool !== "fill";
}

export { isPenTool };
