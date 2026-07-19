"use client";

// Client-side error boundary. Without this, an unhandled exception leaves
// Next's bare white "Application error" screen — which players experience as
// the app suddenly blanking. The drawing itself is safe in local storage.

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-5 text-center">
      <h1 className="font-display text-2xl font-extrabold text-[var(--duos-ink)]">
        Oops — something went wrong
      </h1>
      <p className="mt-2 text-sm text-[var(--duos-ink-muted)]">
        Don&apos;t worry: your coloring is saved on this device and will come
        back when the page reloads.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-11 rounded-2xl bg-[var(--duos-accent)] px-6 font-semibold text-white transition active:scale-95"
        >
          Reload
        </button>
        <button
          type="button"
          onClick={reset}
          className="min-h-11 rounded-2xl border border-[var(--duos-border)] bg-[var(--duos-surface)] px-6 font-semibold text-[var(--duos-ink)] transition active:scale-95"
        >
          Try to continue
        </button>
      </div>
      {error.digest && (
        <p className="mt-4 text-xs text-[var(--duos-ink-muted)]">Ref: {error.digest}</p>
      )}
    </main>
  );
}
