"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PlayView } from "@/components/coloring/PlayView";
import { RevealView } from "@/components/lobby/RevealView";
import { SharePanel } from "@/components/lobby/SharePanel";
import { SplitEditor } from "@/components/lobby/SplitEditor";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { BackLink } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { getClientId } from "@/lib/clientId";
import { resolveColoringPage } from "@/lib/coloring/resolvePage";
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
  const [selectedPage, setSelectedPage] = useState<ColoringPage | null>(null);
  const [savingSplit, setSavingSplit] = useState(false);

  const joinAttempted = useRef(false);
  const revealTriggered = useRef(false);

  const { lobby, players, role, loading, error, refresh } = useLobby(code);

  useEffect(() => {
    loadColoringPages()
      .then(setPages)
      .catch(() => setPages([]));
  }, []);

  const pageSrc = selectedPage?.src ?? lobby?.page_image ?? null;

  useEffect(() => {
    if (!pageSrc || !pages) return;
    let cancelled = false;
    resolveColoringPage(pageSrc, pages).then((page) => {
      if (!cancelled) setSelectedPage(page);
    });
    return () => {
      cancelled = true;
    };
  }, [pageSrc, pages]);

  useEffect(() => {
    if (loading || !lobby || role || joinAttempted.current) return;
    if (players.length >= 2) return;
    joinAttempted.current = true;
    joinLobby(code, getClientId())
      .then(() => refresh())
      .catch(() => {});
  }, [loading, lobby, role, players.length, code, refresh]);

  const me = useMemo(
    () => players.find((p) => p.role === role) ?? null,
    [players, role]
  );
  const partner = useMemo(
    () => players.find((p) => p.role !== role) ?? null,
    [players, role]
  );

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
      setSelectedPage(page);
      if (lobby) updatePageImage(lobby.id, page.src).catch(() => {});
    },
    [lobby]
  );

  const handleConfirmSplit = useCallback(
    async (splitType: SplitType, splitData: SplitData) => {
      if (!lobby || !selectedPage) return;
      setSavingSplit(true);
      try {
        if (selectedPage.src !== lobby.page_image) {
          await updatePageImage(lobby.id, selectedPage.src);
        }
        await updateSplit(lobby.id, splitType, splitData);
        await finalizeSetup(lobby.id);
        await refresh();
      } finally {
        setSavingSplit(false);
      }
    },
    [lobby, selectedPage, refresh]
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
        <div className="animate-pulse text-lg font-semibold text-[var(--duos-ink-muted)]">
          Loading room…
        </div>
      </Centered>
    );
  }

  if (error || !lobby) {
    return (
      <Centered>
        <PageHeader
          align="center"
          title="Room not found"
          description={error ?? "This room doesn't exist."}
        />
        <Link
          href="/"
          className="mt-6 inline-flex min-h-11 items-center rounded-2xl bg-[var(--duos-accent)] px-5 py-2.5 font-semibold text-white"
        >
          Start a new room
        </Link>
      </Centered>
    );
  }

  if (!role && players.length >= 2) {
    return (
      <Centered>
        <PageHeader
          align="center"
          title="This room is full"
          description="Two players are already coloring here."
        />
        <Link
          href="/"
          className="mt-6 inline-flex min-h-11 items-center rounded-2xl bg-[var(--duos-accent)] px-5 py-2.5 font-semibold text-white"
        >
          Start your own room
        </Link>
      </Centered>
    );
  }

  const isCreator = role === "A";

  return (
    <main
      className={`mx-auto w-full px-4 py-6 sm:px-6 sm:py-10 ${
        lobby.status === "playing" ? "max-w-7xl" : "max-w-2xl"
      }`}
    >
      <div className="mb-6 flex items-center justify-between">
        <BackLink href="/">Duos</BackLink>
        <Badge tone="accent">Room {code}</Badge>
      </div>

      {lobby.status === "setup" &&
        (isCreator ? (
          <div className="space-y-6">
            <PageHeader
              eyebrow="Setup"
              title="Set up your drawing"
              description="Pick a page (or upload your own), choose how to split it, then lock it in. Your partner can join anytime with the code below."
            />
            <SharePanel code={code} />
            {selectedPage && (
              <SplitEditor
                pages={pages}
                selectedPage={selectedPage}
                onSelectPage={handleSelectPage}
                onConfirm={handleConfirmSplit}
                lobbyId={lobby.id}
                canUpload={configured}
                busy={savingSplit}
              />
            )}
          </div>
        ) : (
          <div className="space-y-6 text-center">
            <PageHeader
              align="center"
              title="Your partner is setting things up"
              description="Hang tight — you'll start coloring the moment they lock in the split."
            />
            <div className="animate-pulse text-sm font-semibold text-[var(--duos-accent-strong)]">
              Waiting…
            </div>
          </div>
        ))}

      {lobby.status === "waiting" && (
        <div className="space-y-6">
          <PageHeader
            align="center"
            title="Waiting for your partner"
            description="Share the code and you'll both start as soon as they join."
          />
          <SharePanel code={code} />
        </div>
      )}

      {lobby.status === "playing" && role && lobby.split_data && selectedPage && (
        <PlayView
          pageSrc={lobby.page_image}
          width={selectedPage.width}
          height={selectedPage.height}
          split={lobby.split_data}
          role={role}
          isDone={Boolean(me?.done)}
          partnerDone={Boolean(partner?.done)}
          partnerPresent={Boolean(partner)}
          onMarkDone={handleMarkDone}
          onKeepColoring={handleKeepColoring}
        />
      )}

      {lobby.status === "revealed" && selectedPage && (
        <RevealView
          lobbyId={lobby.id}
          pageSrc={lobby.page_image}
          width={selectedPage.width}
          height={selectedPage.height}
        />
      )}
    </main>
  );
}