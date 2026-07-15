import Link from "next/link";

/**
 * Shown when the Supabase env vars are missing so the app degrades gracefully
 * with clear setup instructions instead of throwing.
 */
export function SupabaseNotice() {
  return (
    <div className="mx-auto max-w-lg rounded-3xl border border-amber-200 bg-amber-50/90 p-6 text-amber-900 shadow-sm sm:p-8">
      <h2 className="font-display text-xl font-bold">Almost there — connect Supabase</h2>
      <p className="mt-2 text-sm leading-relaxed">
        Multiplayer needs a Supabase project. Create one, run{" "}
        <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs">
          supabase/schema.sql
        </code>
        , then add your project URL and anon key to{" "}
        <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs">
          .env.local
        </code>{" "}
        and restart the dev server.
      </p>
      <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm">
        <li>Copy <code className="font-mono text-xs">.env.local.example</code> → <code className="font-mono text-xs">.env.local</code></li>
        <li>Fill in <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code></li>
        <li>See the README for the full walkthrough</li>
      </ol>
      <Link
        href="/"
        className="mt-6 inline-block rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
      >
        Back home
      </Link>
    </div>
  );
}
