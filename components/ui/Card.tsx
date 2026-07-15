import type { HTMLAttributes } from "react";

export function Card({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-[var(--radius-card)] border border-[var(--duos-border)] bg-[var(--duos-surface)]/90 shadow-[var(--shadow-card)] backdrop-blur-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function Panel({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-[var(--radius-panel)] border border-[var(--duos-border)] bg-[var(--duos-surface)] p-5 shadow-sm sm:p-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "success" | "warning";
  className?: string;
}) {
  const tones = {
    neutral: "bg-[var(--duos-surface-raised)] text-[var(--duos-ink-muted)]",
    accent: "bg-[var(--duos-accent-soft)] text-[var(--duos-accent-strong)]",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
  };
  return (
    <span
      className={`inline-flex min-h-8 items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
