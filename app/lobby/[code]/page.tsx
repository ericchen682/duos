"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PlayView } from "@/components/PlayView";
import { RevealView } from "@/components/RevealView";
import { SharePanel } from "@/components/SharePanel";
import { SplitEditor } from "@/components/SplitEditor";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { getClientId } from "@/lib/clientId";
import { loadColoringPages } from "@/lib/coloringPages";
import {
  finalizeSetup,
  joinLobby,
  setPlayerDone,
  updateLobbyStatus,
  updatePageImage,
  updateSplit,
  uploadHalf,
} from "@/lib/lobby";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useLobby } from "@/lib/useLobby";
import type { ColoringPage, SplitData, SplitType } from "@/lib/types";

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-5 text-center">
      {children}
    </main>
  );
}

export default function LobbyPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? "").toUpperCase();

  const configured = isSupabaseConfigured;
  const [pages, setPages] = useState<ColoringPage[] | null>(null);
  const [selectedPageSrc, setSelectedPageSrc] = useState<string | null>(null);
  const [savingSplit, setSavingSplit] = useState(false);

  const joinAttempted = useRef(false);
  const revealTriggered = useRef(false);

  const { lobby, players, role, loading, error, refresh } = useLobby(code);

  useEffect(() => {
    loadColoringPages()
      .then(setPages)
      .catch(() => setPages([]));
  }, []);

  // Auto-join when arriving via a shared link without being a member yet.
  useEffect(() => {
    if (loading || !lobby || role || joinAttempted.current) return;
    if (players.length >= 2) return; // full; handled below
    joinAttempted.current = true;
    joinLobby(code, getClientId())
      .then(() => refresh())
      .catch(() => {
        /* surfaced via role staying null / full message */
      });
  }, [loading, lobby, role, players.length, code, refresh]);

  const me = useMemo(
    () => players.find((p) => p.role === role) ?? null,
    [players, role]
  );
  const partner = useMemo(
    () => players.find((p) => p.role !== role) ?? null,
    [players, role]
  );

  const activePageSrc = selectedPageSrc ?? lobby?.page_image ?? null;
  const activePage = useMemo(
    () => pages?.find((p) => p.src === activePageSrc) ?? pages?.[0] ?? null,
    [pages, activePageSrc]
  );

  // Once both players are done, flip the lobby to revealed (idempotent).
  useEffect(() => {
    if (!lobby || lobby.status !== "playing") return;
    const a = players.find((p) => p.role === "A");
    const b = players.find((p) => p.role === "B");
    if (a?.done && b?.done && !revealTriggered.current) {
      revealTriggered.current = true;
      updateLobbyStatus(lobby.id, "revealed").then(() => refresh());
    }
  }, [lobby, players, refresh]);

  const handleSelectPage = useCallback(
    (page: ColoringPage) => {
      setSelectedPageSrc(page.src);
      if (lobby) updatePageImage(lobby.id, page.src).catch(() => {});
    },
    [lobby]
  );

  const handleConfirmSplit = useCallback(
    async (splitType: SplitType, splitData: SplitData) => {
      if (!lobby) return;
      setSavingSplit(true);
      try {
        if (activePageSrc && activePageSrc !== lobby.page_image) {
          await updatePageImage(lobby.id, activePageSrc);
        }
        await updateSplit(lobby.id, splitType, splitData);
        await finalizeSetup(lobby.id);
        await refresh();
      } finally {
        setSavingSplit(false);
      }
    },
    [lobby, activePageSrc, refresh]
  );

  const handleMarkDone = useCallback(
    async (blob: Blob) => {
      if (!lobby || !role || !me) return;
      await uploadHalf(lobby.id, role, blob);
      await setPlayerDone(me.id, true);
      await refresh();
    },
    [lobby, role, me, refresh]
  );

  const handleKeepColoring = useCallback(async () => {
    if (!me) return;
    await setPlayerDone(me.id, false);
    await refresh();
  }, [me, refresh]);

  // --- Render states -------------------------------------------------------
  if (!configured) {
    return (
      <Centered>
        <SupabaseNotice />
      </Centered>
    );
  }

  if (loading || !pages) {
    return (
      <Centered>
        <div className="animate-pulse text-lg font-semibold text-slate-500">
          Loading room…
        </div>
      </Centered>
    );
  }

  if (error || !lobby) {
    return (
      <Centered>
        <p className="text-2xl">🤔</p>
        <h1 className="mt-2 font-display text-2xl font-bold text-slate-800">
          Room not found
        </h1>
        <p className="mt-1 text-slate-500">{error ?? "This room doesn't exist."}</p>
        <Link
          href="/games/split-coloring"
          className="mt-6 rounded-full bg-rose-500 px-5 py-2.5 font-semibold text-white"
        >
          Start a new room
        </Link>
      </Centered>
    );
  }

  if (!role && players.length >= 2) {
    return (
      <Centered>
        <p className="text-2xl">🔒</p>
        <h1 className="mt-2 font-display text-2xl font-bold text-slate-800">
          This room is full
        </h1>
        <p className="mt-1 text-slate-500">Two players are already coloring here.</p>
        <Link
          href="/games/split-coloring"
          className="mt-6 rounded-full bg-rose-500 px-5 py-2.5 font-semibold text-white"
        >
          Start your own room
        </Link>
      </Centered>
    );
  }

  const isCreator = role === "A";

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="text-sm font-semibold text-slate-500 transition hover:text-rose-500"
        >
          ← Duos
        </Link>
        <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-500 shadow-sm">
          Room {code}
        </span>
      </div>

      {/* SETUP */}
      {lobby.status === "setup" &&
        (isCreator ? (
          <div className="space-y-6">
            <div>
              <h1 className="font-display text-3xl font-extrabold text-slate-800">
                Set up your drawing
              </h1>
              <p className="mt-1 text-slate-500">
                Pick a page and how to split it. Your partner can join anytime with the
                code below.
              </p>
            </div>
            <SharePanel code={code} />
            {activePage && (
              <SplitEditor
                pages={pages}
                selectedPage={activePage}
                onSelectPage={handleSelectPage}
                onConfirm={handleConfirmSplit}
                busy={savingSplit}
              />
            )}
          </div>
        ) : (
          <div className="space-y-6 text-center">
            <p className="text-4xl">🎨</p>
            <h1 className="font-display text-2xl font-bold text-slate-800">
              Your partner is setting things up
            </h1>
            <p className="text-slate-500">
              Hang tight — you&apos;ll start coloring the moment they lock in the split.
            </p>
            <div className="animate-pulse text-sm font-semibold text-rose-400">
              Waiting…
            </div>
          </div>
        ))}

      {/* WAITING for partner to join */}
      {lobby.status === "waiting" && (
        <div className="space-y-6">
          <div className="text-center">
            <p className="text-4xl">📨</p>
            <h1 className="mt-2 font-display text-2xl font-bold text-slate-800">
              Waiting for your partner
            </h1>
            <p className="mt-1 text-slate-500">
              Share the code and you&apos;ll both start as soon as they join.
            </p>
          </div>
          <SharePanel code={code} />
        </div>
      )}

      {/* PLAYING */}
      {lobby.status === "playing" && role && lobby.split_data && activePage && (
        <PlayView
          pageSrc={lobby.page_image}
          width={activePage.width}
          height={activePage.height}
          split={lobby.split_data}
          role={role}
          isDone={Boolean(me?.done)}
          partnerDone={Boolean(partner?.done)}
          partnerPresent={Boolean(partner)}
          onMarkDone={handleMarkDone}
          onKeepColoring={handleKeepColoring}
        />
      )}

      {/* REVEALED */}
      {lobby.status === "revealed" && activePage && (
        <RevealView
          lobbyId={lobby.id}
          pageSrc={lobby.page_image}
          width={activePage.width}
          height={activePage.height}
        />
      )}
    </main>
  );
}
