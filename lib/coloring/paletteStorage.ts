import { normalizeHex } from "@/lib/coloring/colorUtils";
import { PALETTE_GROUPS, type PaletteGroup } from "@/lib/coloring/palette";

const PERSONAL_KEY = "duos:personal-palette";
const OVERRIDES_KEY = "duos:palette-overrides";

export const PERSONAL_SLOT_COUNT = 10;

export type PaletteOverrideKey = `${string}:${number}`;

export function paletteOverrideKey(groupId: string, index: number): PaletteOverrideKey {
  return `${groupId}:${index}`;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

/** Fixed personal slots; null = empty. */
export function loadPersonalPalette(): (string | null)[] {
  const parsed = readJson<unknown>(PERSONAL_KEY, []);
  if (!Array.isArray(parsed)) return emptyPersonalSlots();
  const slots = parsed
    .slice(0, PERSONAL_SLOT_COUNT)
    .map((c) => (typeof c === "string" ? normalizeHex(c) : null));
  while (slots.length < PERSONAL_SLOT_COUNT) slots.push(null);
  return slots;
}

function emptyPersonalSlots(): (string | null)[] {
  return Array.from({ length: PERSONAL_SLOT_COUNT }, () => null);
}

export function savePersonalPalette(slots: (string | null)[]): (string | null)[] {
  const next = slots
    .slice(0, PERSONAL_SLOT_COUNT)
    .map((c) => (c ? normalizeHex(c) : null));
  while (next.length < PERSONAL_SLOT_COUNT) next.push(null);
  writeJson(PERSONAL_KEY, next);
  return next;
}

/** Add color to the first empty personal slot, or replace the oldest filled slot. */
export function addToPersonalPalette(hex: string): (string | null)[] {
  const normalized = normalizeHex(hex);
  const slots = loadPersonalPalette();
  const emptyIdx = slots.findIndex((c) => c === null);
  if (emptyIdx >= 0) {
    slots[emptyIdx] = normalized;
  } else {
    slots.shift();
    slots.push(normalized);
  }
  return savePersonalPalette(slots);
}

export function setPersonalSlot(index: number, hex: string | null): (string | null)[] {
  const slots = loadPersonalPalette();
  if (index < 0 || index >= PERSONAL_SLOT_COUNT) return slots;
  slots[index] = hex ? normalizeHex(hex) : null;
  return savePersonalPalette(slots);
}

export function loadPaletteOverrides(): Record<PaletteOverrideKey, string> {
  const parsed = readJson<Record<string, string>>(OVERRIDES_KEY, {});
  const out: Record<PaletteOverrideKey, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "string") out[key as PaletteOverrideKey] = normalizeHex(value);
  }
  return out;
}

export function setPaletteOverride(
  groupId: string,
  index: number,
  hex: string
): Record<PaletteOverrideKey, string> {
  const overrides = loadPaletteOverrides();
  overrides[paletteOverrideKey(groupId, index)] = normalizeHex(hex);
  writeJson(OVERRIDES_KEY, overrides);
  return overrides;
}

export function getEffectivePaletteGroups(
  overrides: Record<PaletteOverrideKey, string> = loadPaletteOverrides()
): PaletteGroup[] {
  return PALETTE_GROUPS.map((group) => ({
    ...group,
    colors: group.colors.map((c, i) => {
      const key = paletteOverrideKey(group.id, i);
      return overrides[key] ?? c;
    }),
  }));
}

export function filledPersonalColors(slots: (string | null)[]): string[] {
  return slots.filter((c): c is string => c !== null);
}
