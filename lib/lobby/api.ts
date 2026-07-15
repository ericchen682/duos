import type { RealtimeChannel } from "@supabase/supabase-js";
import { HALVES_BUCKET, requireSupabase } from "../supabase";
import type {
  Lobby,
  LobbyStatus,
  Player,
  PlayerRole,
  SplitData,
  SplitType,
} from "../types";

// Ambiguous characters (0/O, 1/I/L) removed for easy sharing/typing.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;

function randomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

/** Create a new lobby with the current client as player A (the creator). */
export async function createLobby(
  pageImage: string,
  clientId: string
): Promise<{ lobby: Lobby; role: PlayerRole }> {
  const supabase = requireSupabase();

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomCode();
    const { data, error } = await supabase
      .from("lobbies")
      .insert({ code, page_image: pageImage, status: "setup" })
      .select()
      .single();

    if (!error && data) {
      const lobby = data as Lobby;
      const { error: playerError } = await supabase.from("players").insert({
        lobby_id: lobby.id,
        role: "A",
        client_id: clientId,
        ready: false,
        done: false,
      });
      if (playerError) throw playerError;
      return { lobby, role: "A" };
    }
    lastError = error;
    // 23505 = unique_violation on the code; retry with a new code.
    if (error && (error as { code?: string }).code !== "23505") break;
  }
  throw lastError ?? new Error("Could not create lobby");
}

/** Fetch a lobby by its shareable code. */
export async function getLobbyByCode(code: string): Promise<Lobby | null> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("lobbies")
    .select()
    .eq("code", code.toUpperCase())
    .maybeSingle();
  if (error) throw error;
  return (data as Lobby) ?? null;
}

export async function getPlayers(lobbyId: string): Promise<Player[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("players")
    .select()
    .eq("lobby_id", lobbyId)
    .order("role");
  if (error) throw error;
  return (data as Player[]) ?? [];
}

/**
 * Join a lobby by code. Reconnects to the existing role if this client is
 * already a member; otherwise claims the open role. Throws if the lobby is full
 * or missing.
 */
export async function joinLobby(
  code: string,
  clientId: string
): Promise<{ lobby: Lobby; role: PlayerRole }> {
  const supabase = requireSupabase();
  const lobby = await getLobbyByCode(code);
  if (!lobby) throw new Error("Lobby not found. Check the code and try again.");

  const players = await getPlayers(lobby.id);
  const existing = players.find((p) => p.client_id === clientId);
  if (existing) return { lobby, role: existing.role };

  const takenRoles = new Set(players.map((p) => p.role));
  const openRole: PlayerRole | null = !takenRoles.has("A")
    ? "A"
    : !takenRoles.has("B")
      ? "B"
      : null;
  if (!openRole) throw new Error("This lobby is already full.");

  const { error } = await supabase.from("players").insert({
    lobby_id: lobby.id,
    role: openRole,
    client_id: clientId,
    ready: false,
    done: false,
  });
  if (error) throw error;

  // A partner joining a lobby whose split is already configured starts play.
  if (openRole === "B" && lobby.status === "waiting") {
    await updateLobbyStatus(lobby.id, "playing");
    return { lobby: { ...lobby, status: "playing" }, role: openRole };
  }
  return { lobby, role: openRole };
}

export async function updateSplit(
  lobbyId: string,
  splitType: SplitType,
  splitData: SplitData
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("lobbies")
    .update({ split_type: splitType, split_data: splitData })
    .eq("id", lobbyId);
  if (error) throw error;
}

export async function updatePageImage(
  lobbyId: string,
  pageImage: string
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("lobbies")
    .update({ page_image: pageImage })
    .eq("id", lobbyId);
  if (error) throw error;
}

export async function updateLobbyStatus(
  lobbyId: string,
  status: LobbyStatus
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("lobbies")
    .update({ status })
    .eq("id", lobbyId);
  if (error) throw error;
}

/**
 * Called by the creator to finalize the split. Moves to `playing` if the partner
 * has already joined, otherwise `waiting`.
 */
export async function finalizeSetup(lobbyId: string): Promise<LobbyStatus> {
  const players = await getPlayers(lobbyId);
  const nextStatus: LobbyStatus = players.length >= 2 ? "playing" : "waiting";
  await updateLobbyStatus(lobbyId, nextStatus);
  return nextStatus;
}

export async function setPlayerDone(
  playerId: string,
  done: boolean
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("players")
    .update({ done })
    .eq("id", playerId);
  if (error) throw error;
}

/** Upload a player's colored half as a PNG to Storage (overwrites prior). */
export async function uploadHalf(
  lobbyId: string,
  role: PlayerRole,
  blob: Blob
): Promise<void> {
  const supabase = requireSupabase();
  const path = `${lobbyId}/${role}.png`;
  const { error } = await supabase.storage
    .from(HALVES_BUCKET)
    .upload(path, blob, { contentType: "image/png", upsert: true });
  if (error) throw error;
}

/** Public URL for a player's uploaded half (bucket must be public). */
export function halfUrl(lobbyId: string, role: PlayerRole): string {
  const supabase = requireSupabase();
  const path = `${lobbyId}/${role}.png`;
  const { data } = supabase.storage.from(HALVES_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

/**
 * Subscribe to realtime changes for a lobby and its players. The callback fires
 * on any relevant insert/update. Returns an unsubscribe function.
 */
export function subscribeLobby(
  lobbyId: string,
  onChange: () => void
): () => void {
  const supabase = requireSupabase();
  const channel: RealtimeChannel = supabase
    .channel(`lobby:${lobbyId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "lobbies", filter: `id=eq.${lobbyId}` },
      () => onChange()
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "players",
        filter: `lobby_id=eq.${lobbyId}`,
      },
      () => onChange()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
