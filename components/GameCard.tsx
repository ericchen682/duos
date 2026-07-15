import Link from "next/link";
import type { GameMeta } from "@/lib/games";

export function GameCard({ game }: { game: GameMeta }) {
  const isActive = game.status === "active";

  const inner = (
    <div
      className={`group relative flex h-full flex-col overflow-hidden rounded-3xl border p-6 transition-all duration-300 sm:p-7 ${
        isActive
          ? "border-white/70 bg-white/80 shadow-lg shadow-rose-200/50 backdrop-blur hover:-translate-y-1 hover:shadow-xl"
          : "border-white/40 bg-white/40 opacity-70"
      }`}
    >
      <div
        className={`mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br text-3xl shadow-inner ${game.accent}`}
        aria-hidden
      >
        <span className="drop-shadow-sm">{game.emoji}</span>
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-2xl font-bold text-slate-800">
            {game.title}
          </h3>
          {!isActive && (
            <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-slate-500">
              Soon
            </span>
          )}
        </div>
        <p className="mt-2 text-pretty text-sm leading-relaxed text-slate-500">
          {game.tagline}
        </p>
      </div>

      {isActive && (
        <div className="mt-6 flex items-center gap-2 font-semibold text-rose-500">
          Play now
          <span className="transition-transform duration-300 group-hover:translate-x-1">
            →
          </span>
        </div>
      )}
    </div>
  );

  if (!isActive) {
    return (
      <div aria-disabled className="h-full cursor-not-allowed select-none">
        {inner}
      </div>
    );
  }

  return (
    <Link href={game.href} className="h-full focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-300 rounded-3xl">
      {inner}
    </Link>
  );
}
