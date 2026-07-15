import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { GameMeta } from "@/lib/games";

export function GameCard({ game }: { game: GameMeta }) {
  const isActive = game.status === "active";

  const inner = (
    <Card
      className={`group flex h-full flex-col p-6 transition duration-300 sm:p-7 ${
        isActive
          ? "hover:-translate-y-1 hover:shadow-[var(--shadow-soft)]"
          : "opacity-65"
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
          <h3 className="font-display text-2xl font-bold text-[var(--duos-ink)]">
            {game.title}
          </h3>
          {!isActive && (
            <span className="rounded-full bg-[var(--duos-surface-raised)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--duos-ink-muted)]">
              Soon
            </span>
          )}
        </div>
        <p className="mt-2 text-pretty text-sm leading-relaxed text-[var(--duos-ink-muted)]">
          {game.tagline}
        </p>
      </div>

      {isActive && (
        <p className="mt-6 flex items-center gap-2 font-semibold text-[var(--duos-accent-strong)]">
          Play now
          <span className="transition-transform duration-200 group-hover:translate-x-1" aria-hidden>
            →
          </span>
        </p>
      )}
    </Card>
  );

  if (!isActive) {
    return (
      <div
        aria-disabled
        className="h-full w-full max-w-sm cursor-not-allowed select-none sm:w-[calc(50%-0.625rem)] lg:w-[calc(33.333%-0.834rem)]"
      >
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={game.href}
      className="block h-full w-full max-w-sm rounded-[var(--radius-card)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--duos-accent)] focus-visible:ring-offset-2 sm:w-[calc(50%-0.625rem)] lg:w-[calc(33.333%-0.834rem)]"
    >
      {inner}
    </Link>
  );
}
