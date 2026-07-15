const STORAGE_KEY = "duos:recent-colors";
const MAX_RECENT = 10;

export function loadRecentColors(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((c): c is string => typeof c === "string").slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function pushRecentColor(hex: string): string[] {
  const normalized = hex.toLowerCase();
  const prev = loadRecentColors().filter((c) => c.toLowerCase() !== normalized);
  const next = [normalized, ...prev].slice(0, MAX_RECENT);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}
