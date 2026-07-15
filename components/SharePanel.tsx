"use client";

import { useState } from "react";

export function SharePanel({ code }: { code: string }) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/lobby/${code}`
      : `/lobby/${code}`;

  const copy = async (value: string, kind: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard may be blocked; ignore silently.
    }
  };

  return (
    <div className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur">
      <p className="text-sm font-semibold text-slate-500">Invite your partner</p>
      <div className="mt-2 flex items-center gap-3">
        <span className="font-display text-4xl font-extrabold tracking-[0.35em] text-slate-800">
          {code}
        </span>
        <button
          onClick={() => copy(code, "code")}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-200"
        >
          {copied === "code" ? "Copied!" : "Copy code"}
        </button>
      </div>
      <button
        onClick={() => copy(link, "link")}
        className="mt-3 w-full truncate rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left text-sm font-medium text-slate-500 transition hover:border-rose-300"
        title={link}
        suppressHydrationWarning
      >
        {copied === "link" ? "Link copied to clipboard!" : link}
      </button>
    </div>
  );
}
