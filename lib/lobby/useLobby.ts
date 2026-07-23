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
  // Whether we've ever loaded this room successfully. After that point a
  // failed poll must never surface as an error: swapping the play screen for
  // "Room not found" unmounts the canvas mid-session, and transient failures
  // are routine on tablets (wifi blips, iOS aborting fetches on background).
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
      // Otherwise: keep the last good state on screen; the 5s poll retries.
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
