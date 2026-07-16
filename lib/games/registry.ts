export interface GameMeta {
  id: string;
  title: string;
  tagline: string;
  emoji: string;
  href: string;
  status: "active" | "soon";
  accent: string;
}

export const GAMES: GameMeta[] = [
  {
    id: "split-coloring",
    title: "Split Coloring",
    tagline:
      "Split a drawing in two, color your half in secret, then reveal it together.",
    emoji: "🎨",
    href: "/",
    status: "active",
    accent: "from-[var(--duos-accent)] to-[var(--duos-accent-strong)]",
  },
];
