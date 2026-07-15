"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Card";

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
      /* clipboard blocked */
    }
  };

  return (
    <Panel className="space-y-4">
      <p className="text-sm font-semibold text-[var(--duos-ink-muted)]">
        Invite your partner
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="font-display text-4xl font-extrabold tracking-[0.35em] text-[var(--duos-ink)]"
          aria-label={`Room code ${code.split("").join(" ")}`}
        >
          {code}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => copy(code, "code")}
          aria-live="polite"
        >
          {copied === "code" ? "Copied!" : "Copy code"}
        </Button>
      </div>
      <Button
        variant="secondary"
        fullWidth
        onClick={() => copy(link, "link")}
        className="justify-start truncate font-mono text-sm font-medium normal-case tracking-normal"
        title={link}
        suppressHydrationWarning
        aria-live="polite"
      >
        {copied === "link" ? "Link copied!" : link}
      </Button>
    </Panel>
  );
}
