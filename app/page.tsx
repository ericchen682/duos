import { GameCard } from "@/components/GameCard";
import { GAMES } from "@/lib/games/registry";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 py-10 sm:px-8 sm:py-16">
      <header className="text-center">
        <div className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--duos-border)] bg-[var(--duos-surface)]/80 px-4 py-1.5 text-sm font-semibold text-[var(--duos-accent-strong)] shadow-sm backdrop-blur">
          <span className="animate-[float-slow_3s_ease-in-out_infinite]" aria-hidden>
            ♥
          </span>
          Games for two
        </div>
        <h1 className="font-display text-5xl font-extrabold tracking-tight text-[var(--duos-ink)] sm:text-6xl">
          Duos
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-balance text-base leading-relaxed text-[var(--duos-ink-muted)] sm:text-lg">
          Cozy little games to play side by side or across the world. No accounts,
          no fuss — just start a room and share the code.
        </p>
      </header>

      <section
        className="mt-12 grid gap-5 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Available games"
      >
        {GAMES.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </section>

      <footer className="mt-auto pt-16 text-center text-sm text-[var(--duos-ink-muted)]">
        Made for date nights. Best on an iPad.
      </footer>
    </main>
  );
}
