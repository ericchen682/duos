/**
 * Local persistence for the in-progress paint layer, so a page refresh (or a
 * remount from toggling done/keep-coloring) never loses a drawing. One entry
 * per lobby+role, stored as a PNG data URL with a timestamp for pruning.
 */

const PREFIX = "duos:paint:";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface SavedPaint {
  ts: number;
  data: string;
}

function storageKey(key: string): string {
  return PREFIX + key;
}

/** Remove expired or unparsable entries; optionally spare one key. */
export function pruneStalePaints(exceptKey?: string): void {
  if (typeof window === "undefined") return;
  try {
    const spare = exceptKey ? storageKey(exceptKey) : null;
    const now = Date.now();
    const remove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(PREFIX) || k === spare) continue;
      try {
        const parsed = JSON.parse(window.localStorage.getItem(k) ?? "") as SavedPaint;
        if (!parsed?.data || now - parsed.ts > TTL_MS) remove.push(k);
      } catch {
        remove.push(k);
      }
    }
    remove.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // storage unavailable — persistence is best-effort
  }
}

/** Remove every saved paint except the given key (quota fallback). */
function evictOtherPaints(exceptKey: string): void {
  try {
    const spare = storageKey(exceptKey);
    const remove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(PREFIX) && k !== spare) remove.push(k);
    }
    remove.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // best-effort
  }
}

export function savePaint(key: string, dataUrl: string): void {
  if (typeof window === "undefined") return;
  const value = JSON.stringify({ ts: Date.now(), data: dataUrl } satisfies SavedPaint);
  try {
    window.localStorage.setItem(storageKey(key), value);
  } catch {
    // Quota exceeded: drop expired entries, then other drawings, then give up.
    pruneStalePaints(key);
    try {
      window.localStorage.setItem(storageKey(key), value);
    } catch {
      evictOtherPaints(key);
      try {
        window.localStorage.setItem(storageKey(key), value);
      } catch {
        // still no room — this save is lost, the next one will retry
      }
    }
  }
}

export function loadPaint(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedPaint;
    if (!parsed?.data || Date.now() - parsed.ts > TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}
