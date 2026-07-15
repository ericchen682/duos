"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadImage } from "@/lib/imageUtils";
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
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      if (halfA) ctx.drawImage(halfA, 0, 0, width, height);
      if (halfB) ctx.drawImage(halfB, 0, 0, width, height);
      ctx.drawImage(line, 0, 0, width, height);
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
    <div className="space-y-5 text-center">
      <div className="animate-pop-in">
        <h2 className="font-display text-3xl font-extrabold text-slate-800">
          Ta-da! 🎉
        </h2>
        <p className="mt-1 text-slate-500">Here&apos;s what you made together.</p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="block w-full"
          style={{ aspectRatio: `${width} / ${height}` }}
        />
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm font-semibold text-slate-500">
            Combining your halves…
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 text-sm font-semibold text-rose-500">
            Couldn&apos;t load the halves.{" "}
            <button onClick={compose} className="ml-1 underline">
              Retry
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          onClick={download}
          disabled={status !== "ready"}
          className="rounded-2xl bg-gradient-to-br from-rose-400 to-pink-500 px-6 py-3 font-bold text-white shadow-lg shadow-rose-200 transition active:scale-95 disabled:opacity-50"
        >
          ⬇︎ Download the drawing
        </button>
        <a
          href="/games/split-coloring"
          className="rounded-2xl border border-slate-200 bg-white px-6 py-3 font-bold text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          Play again
        </a>
      </div>
    </div>
  );
}
