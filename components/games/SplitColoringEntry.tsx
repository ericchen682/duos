"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Card";
import { BackLink, PageHeader } from "@/components/ui/PageHeader";
import { getClientId } from "@/lib/clientId";
import { loadColoringPages } from "@/lib/coloringPages";
import { createLobby, joinLobby } from "@/lib/lobby";
import { isSupabaseConfigured } from "@/lib/supabase";

export function SplitColoringEntry({ showBackLink = false }: { showBackLink?: boolean }) {
  const router = useRouter();
  const configured = isSupabaseConfigured;
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setError(null);
    setBusy("create");
    try {
      const pages = await loadColoringPages();
      const defaultPage = pages[0]?.src ?? "";
      const { lobby } = await createLobby(defaultPage, getClientId());
      router.push(`/lobby/${lobby.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create a room.");
      setBusy(null);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setBusy("join");
    try {
      const { lobby } = await joinLobby(code, getClientId());
      router.push(`/lobby/${lobby.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join that room.");
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-5 py-10 sm:px-8">
      {showBackLink && <BackLink href="/">All games</BackLink>}

      <div className={`animate-pop-in ${showBackLink ? "mt-8" : ""}`}>
        <div className="mb-6 flex items-center gap-3">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--duos-accent)] to-[var(--duos-accent-strong)] text-3xl shadow-[var(--shadow-soft)]"
            aria-hidden
          >
            🎨
          </span>
          <PageHeader
            title="Split Coloring"
            description="Color your half, reveal it together."
          />
        </div>

        {!configured ? (
          <SupabaseNotice />
        ) : (
          <div className="space-y-4">
            <Button size="lg" fullWidth onClick={handleCreate} disabled={busy !== null}>
              {busy === "create" ? "Creating room…" : "Create a room"}
            </Button>

            <div className="flex items-center gap-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--duos-ink-muted)]">
              <span className="h-px flex-1 bg-[var(--duos-border)]" />
              or join
              <span className="h-px flex-1 bg-[var(--duos-border)]" />
            </div>

            <Panel>
              <form onSubmit={handleJoin} className="space-y-3">
                <label htmlFor="code" className="block text-sm font-semibold text-[var(--duos-ink-muted)]">
                  Enter a room code
                </label>
                <div className="flex gap-2">
                  <input
                    id="code"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="ABCDE"
                    autoComplete="off"
                    autoCapitalize="characters"
                    maxLength={5}
                    className="min-h-11 min-w-0 flex-1 rounded-xl border border-[var(--duos-border)] bg-white px-4 py-3 text-center text-xl font-bold uppercase tracking-[0.3em] text-[var(--duos-ink)] outline-none focus:border-[var(--duos-accent)] focus:ring-2 focus:ring-[var(--duos-accent-soft)]"
                  />
                  <Button type="submit" disabled={busy !== null || joinCode.trim().length === 0}>
                    {busy === "join" ? "…" : "Join"}
                  </Button>
                </div>
              </form>
            </Panel>

            {error && (
              <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-[var(--duos-danger)]">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
