"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { getClientId } from "@/lib/clientId";
import { loadColoringPages } from "@/lib/coloringPages";
import { createLobby, joinLobby } from "@/lib/lobby";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function SplitColoringEntryPage() {
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
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 transition hover:text-rose-500"
      >
        ← All games
      </Link>

      <div className="animate-pop-in">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-400 to-pink-500 text-3xl shadow-lg shadow-rose-200">
            🎨
          </span>
          <div>
            <h1 className="font-display text-3xl font-extrabold text-slate-800">
              Split Coloring
            </h1>
            <p className="text-sm text-slate-500">Color your half, reveal it together.</p>
          </div>
        </div>

        {!configured ? (
          <SupabaseNotice />
        ) : (
          <div className="space-y-4">
            <button
              onClick={handleCreate}
              disabled={busy !== null}
              className="w-full rounded-2xl bg-gradient-to-br from-rose-400 to-pink-500 px-6 py-4 text-lg font-bold text-white shadow-lg shadow-rose-200 transition active:scale-[0.98] disabled:opacity-60"
            >
              {busy === "create" ? "Creating room…" : "Create a room"}
            </button>

            <div className="flex items-center gap-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              or join
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <form
              onSubmit={handleJoin}
              className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur"
            >
              <label
                htmlFor="code"
                className="mb-2 block text-sm font-semibold text-slate-600"
              >
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
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-xl font-bold uppercase tracking-[0.3em] text-slate-800 outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
                />
                <button
                  type="submit"
                  disabled={busy !== null || joinCode.trim().length === 0}
                  className="rounded-xl bg-slate-800 px-5 py-3 font-bold text-white transition active:scale-95 disabled:opacity-40"
                >
                  {busy === "join" ? "…" : "Join"}
                </button>
              </div>
            </form>

            {error && (
              <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
