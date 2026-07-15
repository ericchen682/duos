export interface GameMeta {
  id: string;
  title: string;
  tagline: string;
  emoji: string;
  href: string;
  status: "active" | "soon";
  accent: string; // tailwind gradient classes
}

export const GAMES: GameMeta[] = [
  {
    id: "split-coloring",
    title: "Split Coloring",
    tagline:
      "Split a drawing in two, color your half in secret, then reveal it together.",
    emoji: "🎨",
    href: "/games/split-coloring",
    status: "active",
    accent: "from-rose-400 to-pink-500",
  },
  {
    id: "guess-together",
    title: "Guess Together",
    tagline: "Take turns sketching prompts and guessing each other's doodles.",
    emoji: "✏️",
    href: "#",
    status: "soon",
    accent: "from-indigo-400 to-violet-500",
  },
  {
    id: "twenty-questions",
    title: "20 Questions",
    tagline: "One of you thinks of something, the other has twenty guesses.",
    emoji: "💬",
    href: "#",
    status: "soon",
    accent: "from-amber-400 to-orange-500",
  },
];
