"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getClientId } from "../clientId";
import { getLobbyByCode, getPlayers, subscribeLobby } from "./api";
import type { Lobby, Player, PlayerRole } from "../types";

export interface UseLobbyResult {
  lobby: Lobby | null;
  players: Player[];
  role: PlayerRole | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Loads a lobby by code, resolves this client's role, and keeps both the lobby
 * row and its players in sync via Supabase Realtime (with a polling fallback in
 * case Realtime is not enabled on the project).
 */
export function useLobby(code: string): UseLobbyResult {
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [role, setRole] = useState<PlayerRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Whether we've ever loaded this lobby. Refresh runs on a 5s poll, so a
  // single transient failure (flaky wifi, a fetch aborted by the tab being
  // backgrounded) must NOT surface as an error once the room is on screen —
  // that would swap the play view for "Room not found" and destroy the
  // player's unsubmitted coloring. Keep showing the last good state instead.
  const hasLoadedRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const lb = await getLobbyByCode(code);
      if (!lb) {
        if (!hasLoadedRef.current) {
          setError("We couldn't find that room. Check the code and try again.");
          setLoading(false);
        }
        return;
      }
      const pl = await getPlayers(lb.id);
      hasLoadedRef.current = true;
      setLobby(lb);
      setPlayers(pl);
      const mine = pl.find((p) => p.client_id === getClientId());
      setRole(mine?.role ?? null);
      setError(null);
      setLoading(false);
    } catch (err) {
      if (!hasLoadedRef.current) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setLoading(false);
      }
    }
  }, [code]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const id = lobby?.id;
    if (!id) return;
    const unsub = subscribeLobby(id, () => {
      refresh();
    });
    const poll = window.setInterval(refresh, 5000);
    return () => {
      unsub();
      window.clearInterval(poll);
    };
  }, [lobby?.id, refresh]);

  return {
    lobby,
    players,
    role,
    loading,
    error,
    refresh,
  };
}
