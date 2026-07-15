const STORAGE_KEY = "duos:client-id";

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Returns a stable per-browser identifier persisted in localStorage. This lets a
 * player reconnect to the same role after a refresh. Safe to call only on the
 * client.
 */
export function getClientId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = randomId();
    window.localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
