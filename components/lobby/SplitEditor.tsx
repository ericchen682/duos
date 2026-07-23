"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { resolveColoringPage } from "@/lib/coloring/resolvePage";
import { loadImage } from "@/lib/coloring/imageUtils";
import { deriveMask } from "@/lib/coloring/mask";
import {
  computeSeedsForPath,
  extendPathToEdges,
  presetSplit,
} from "@/lib/coloring/splits";
import { uploadColoringPage } from "@/lib/lobby/uploadPage";
import type {
  ColoringPage,
  Point,
  SplitData,
  SplitPreset,
  SplitType,
} from "@/lib/types";

const PREVIEW_W = 560;
// Touches this soon after pencil contact are treated as a resting palm
// (mirrors the coloring canvas's palm guard).
const TOUCH_REJECT_MS = 500;

const PRESETS: { id: SplitPreset; label: string }[] = [
  { id: "vertical", label: "Vertical" },
  { id: "horizontal", label: "Horizontal" },
  { id: "diagonal", label: "Diagonal" },
];

interface SplitEditorProps {
  pages: ColoringPage[];
  selectedPage: ColoringPage;
  onSelectPage: (page: ColoringPage) => void;
  onConfirm: (splitType: SplitType, splitData: SplitData) => void;
  lobbyId: string;
  canUpload: boolean;
  busy?: boolean;
}

export function SplitEditor({
  pages,
  selectedPage,
  onSelectPage,
  onConfirm,
  lobbyId,
  canUpload,
  busy,
}: SplitEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [preset, setPreset] = useState<SplitPreset>("vertical");
  const [customPath, setCustomPath] = useState<Point[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const drawingRef = useRef(false);
  // Exactly one pointer draws the curve. Without this, a palm resting on the
  // canvas mid-draw resets the whole path (its pointerdown restarted it).
  const activeDrawIdRef = useRef<number | null>(null);
  const lastPenTimeRef = useRef(0);

  const previewH = Math.round((PREVIEW_W * selectedPage.height) / selectedPage.width);
  const isUploaded = selectedPage.id === "uploaded";

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

    const split = drawingRef.current ? null : currentSplit();
    if (split) {
      const maskA = deriveMask(PREVIEW_W, previewH, split, "A");
      const maskB = deriveMask(PREVIEW_W, previewH, split, "B");
      const tint = ctx.getImageData(0, 0, PREVIEW_W, previewH);
      for (let i = 0; i < maskA.length; i++) {
        const o = i * 4;
        if (maskA[i]) {
          tint.data[o] = Math.min(255, tint.data[o] * 0.75 + 196 * 0.25);
          tint.data[o + 1] = Math.min(255, tint.data[o + 1] * 0.75 + 92 * 0.25);
          tint.data[o + 2] = Math.min(255, tint.data[o + 2] * 0.75 + 74 * 0.25);
        } else if (maskB[i]) {
          tint.data[o] = Math.min(255, tint.data[o] * 0.75 + 91 * 0.25);
          tint.data[o + 1] = Math.min(255, tint.data[o + 1] * 0.75 + 74 * 0.25);
          tint.data[o + 2] = Math.min(255, tint.data[o + 2] * 0.75 + 122 * 0.25);
        }
      }
      ctx.putImageData(tint, 0, 0);

      ctx.strokeStyle = "rgba(26, 18, 40, 0.85)";
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
      ctx.strokeStyle = "rgba(26, 18, 40, 0.85)";
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
    if (e.pointerType === "pen") {
      // The pencil always wins: a touch mid-draw was a palm, so its path is
      // discarded and the pen starts the curve fresh.
      lastPenTimeRef.current = performance.now();
    } else if (
      activeDrawIdRef.current !== null ||
      (e.pointerType === "touch" &&
        performance.now() - lastPenTimeRef.current < TOUCH_REJECT_MS)
    ) {
      return; // second finger, or a palm resting near the pencil
    }
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    activeDrawIdRef.current = e.pointerId;
    drawingRef.current = true;
    setCustomPath([toNorm(e)]);
  };
  const onMove = (e: React.PointerEvent) => {
    if (mode !== "custom" || !drawingRef.current) return;
    if (e.pointerId !== activeDrawIdRef.current) return;
    if (e.pointerType === "pen" && e.buttons !== 0) {
      lastPenTimeRef.current = performance.now();
    }
    e.preventDefault();
    setCustomPath((prev) => [...prev, toNorm(e)]);
  };
  const onUp = (e: React.PointerEvent) => {
    if (e.pointerId !== activeDrawIdRef.current) return;
    if (e.pointerType === "pen") lastPenTimeRef.current = performance.now();
    activeDrawIdRef.current = null;
    if (!drawingRef.current) return;
    drawingRef.current = false;
    render();
  };

  const handleUpload = async (file: File) => {
    if (!canUpload) return;
    setUploadError(null);
    setUploading(true);
    try {
      const url = await uploadColoringPage(lobbyId, file);
      const page = await resolveColoringPage(url, pages);
      onSelectPage(page);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const split = currentSplit();
  const canConfirm = Boolean(split) && !busy && !uploading;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[var(--duos-ink-muted)]">
          1 · Choose a page
        </h3>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {pages.map((page) => (
            <button
              key={page.id}
              type="button"
              onClick={() => onSelectPage(page)}
              className={`shrink-0 overflow-hidden rounded-2xl border-2 bg-white transition ${
                page.src === selectedPage.src && !isUploaded
                  ? "border-[var(--duos-accent)] shadow-md"
                  : "border-transparent opacity-80 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={page.src} alt={page.title} className="h-20 w-28 object-contain p-1" />
              <span className="block px-2 pb-2 text-xs font-semibold text-[var(--duos-ink-muted)]">
                {page.title}
              </span>
            </button>
          ))}

          {canUpload ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className={`flex h-[7.5rem] w-28 shrink-0 flex-col items-center justify-center rounded-2xl border-2 border-dashed px-2 text-center transition ${
                isUploaded
                  ? "border-[var(--duos-accent)] bg-[var(--duos-accent-soft)]"
                  : "border-[var(--duos-border)] bg-[var(--duos-surface)] hover:border-[var(--duos-accent)]"
              }`}
            >
              <span className="text-2xl font-light text-[var(--duos-accent-strong)]" aria-hidden>
                +
              </span>
              <span className="mt-1 text-xs font-bold text-[var(--duos-ink-muted)]">
                {uploading ? "Uploading…" : "Upload yours"}
              </span>
            </button>
          ) : (
            <div className="flex h-[7.5rem] w-28 shrink-0 items-center justify-center rounded-2xl border border-dashed border-[var(--duos-border)] px-2 text-center text-xs text-[var(--duos-ink-muted)]">
              Connect Supabase to upload
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = "";
            }}
          />
        </div>
        {uploadError && (
          <p className="mt-2 text-sm font-medium text-[var(--duos-danger)]">{uploadError}</p>
        )}
        {uploading && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--duos-surface-raised)]">
            <div className="upload-progress-bar h-full w-2/5 rounded-full bg-[var(--duos-accent)]" />
          </div>
        )}
        {isUploaded && (
          <p className="mt-2 text-sm text-[var(--duos-ink-muted)]">
            Using your uploaded image — both players will see this exact file.
          </p>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[var(--duos-ink-muted)]">
          2 · Draw the split
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
              className={`min-h-11 rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
                mode === "preset" && preset === p.id
                  ? "bg-[var(--duos-ink)] text-white shadow"
                  : "bg-[var(--duos-surface)] text-[var(--duos-ink-muted)] border border-[var(--duos-border)] hover:bg-[var(--duos-surface-raised)]"
              }`}
            >
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
            className={`min-h-11 rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
              mode === "custom"
                ? "bg-[var(--duos-ink)] text-white shadow"
                : "bg-[var(--duos-surface)] text-[var(--duos-ink-muted)] border border-[var(--duos-border)] hover:bg-[var(--duos-surface-raised)]"
            }`}
          >
            Freehand curve
          </button>
        </div>
        {mode === "custom" && (
          <p className="mt-2 text-sm text-[var(--duos-ink-muted)]">
            Drag from one edge to another to draw your dividing line.{" "}
            {customPath.length > 0 && (
              <button
                type="button"
                onClick={() => setCustomPath([])}
                className="font-semibold text-[var(--duos-accent-strong)] underline"
              >
                Redraw
              </button>
            )}
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--duos-border)] bg-white shadow-[var(--shadow-card)]">
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

      <div className="flex flex-wrap items-center gap-4 text-sm font-semibold">
        <span className="flex items-center gap-2 text-[var(--duos-player-a)]">
          <span className="h-3 w-3 rounded-full bg-[var(--duos-player-a)]" /> Your half
        </span>
        <span className="flex items-center gap-2 text-[var(--duos-player-b)]">
          <span className="h-3 w-3 rounded-full bg-[var(--duos-player-b)]" /> Partner&apos;s half
        </span>
      </div>

      <Button
        size="lg"
        fullWidth
        disabled={!canConfirm}
        onClick={() => {
          if (split) onConfirm(splitType, split);
        }}
      >
        {busy ? "Saving…" : "Lock in split & start"}
      </Button>
    </div>
  );
}
