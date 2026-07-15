"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { loadImage } from "@/lib/coloring/imageUtils";
import { halfUrl } from "@/lib/lobby";

interface RevealViewProps {
  lobbyId: string;
  pageSrc: string;
  width: number;
  height: number;
}

export function RevealView({ lobbyId, pageSrc, width, height }: RevealViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const compose = useCallback(async () => {
    setStatus("loading");
    try {
      const [halfA, halfB, line] = await Promise.all([
        loadImage(halfUrl(lobbyId, "A")).catch(() => null),
        loadImage(halfUrl(lobbyId, "B")).catch(() => null),
        loadImage(pageSrc),
      ]);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      if (halfA) ctx.drawImage(halfA, 0, 0, width, height);
      if (halfB) ctx.drawImage(halfB, 0, 0, width, height);
      ctx.globalCompositeOperation = "multiply";
      ctx.drawImage(line, 0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [lobbyId, pageSrc, width, height]);

  useEffect(() => {
    compose();
  }, [compose]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "duos-split-coloring.png";
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  return (
    <div className="animate-pop-in space-y-6">
      <PageHeader
        align="center"
        eyebrow="Reveal"
        title="Ta-da!"
        description="Here's what you made together."
      />

      <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--duos-border)] bg-white shadow-[var(--shadow-card)]">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="block w-full"
          style={{ aspectRatio: `${width} / ${height}` }}
        />
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm font-semibold text-[var(--duos-ink-muted)]">
            Combining your halves…
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/80 text-sm font-semibold text-[var(--duos-danger)]">
            Couldn&apos;t load the halves.
            <Button variant="secondary" size="sm" onClick={compose}>
              Retry
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button size="lg" onClick={download} disabled={status !== "ready"}>
          Download the drawing
        </Button>
        <Link
          href="/games/split-coloring"
          className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[var(--duos-border)] bg-[var(--duos-surface)] px-6 py-3 text-base font-semibold text-[var(--duos-ink)] shadow-sm transition hover:bg-[var(--duos-surface-raised)]"
        >
          Play again
        </Link>
      </div>
    </div>
  );
}
