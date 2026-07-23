"use client";

/**
 * App-level error boundary. Without this, any render crash shows Next's bare
 * white "Application error" screen — indistinguishable from lost work for a
 * player mid-drawing. The drawing itself survives locally (op-log
 * persistence), so say so and offer a way back in.
 */
export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-5xl" aria-hidden>
        🎨
      </span>
      <h1 className="font-display text-2xl font-extrabold text-[var(--duos-ink)]">
        Oops — something hiccuped
      </h1>
      <p className="text-sm text-[var(--duos-ink-muted)]">
        Don&apos;t worry: your coloring is saved on this device. Reload and
        you&apos;ll pick up right where you left off.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-11 touch-manipulation rounded-2xl bg-[var(--duos-accent)] px-5 py-2.5 font-semibold text-white shadow-[var(--shadow-soft)] transition active:scale-95"
        >
          Reload
        </button>
        <button
          type="button"
          onClick={reset}
          className="min-h-11 touch-manipulation rounded-2xl border border-[var(--duos-border)] bg-[var(--duos-surface)] px-5 py-2.5 font-semibold text-[var(--duos-ink)] transition active:scale-95"
        >
          Try to continue
        </button>
      </div>
    </main>
  );
}
