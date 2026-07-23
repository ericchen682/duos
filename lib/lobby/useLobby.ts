"use client";

import { useCallback, useEffect, useState } from "react";
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

  const refresh = useCallback(async () => {
    try {
      const lb = await getLobbyByCode(code);
      if (!lb) {
        setError("We couldn't find that room. Check the code and try again.");
        setLoading(false);
        return;
      }
      const pl = await getPlayers(lb.id);
      setLobby(lb);
      setPlayers(pl);
      const mine = pl.find((p) => p.client_id === getClientId());
      setRole(mine?.role ?? null);
      setError(null);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
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
