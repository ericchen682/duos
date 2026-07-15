import Link from "next/link";

export function BackLink({
  href,
  children = "Back",
}: {
  href: string;
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[var(--duos-ink-muted)] transition hover:text-[var(--duos-accent-strong)]"
    >
      <span aria-hidden>←</span>
      {children}
    </Link>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
}) {
  const alignClass = align === "center" ? "text-center" : "text-left";
  return (
    <header className={alignClass}>
      {eyebrow && (
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--duos-accent-strong)]">
          {eyebrow}
        </p>
      )}
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-[var(--duos-ink)] sm:text-4xl">
        {title}
      </h1>
      {description && (
        <p className="mt-2 max-w-xl text-pretty text-base leading-relaxed text-[var(--duos-ink-muted)]">
          {description}
        </p>
      )}
    </header>
  );
}
