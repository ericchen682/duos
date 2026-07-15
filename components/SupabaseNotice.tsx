import Link from "next/link";
import { Panel } from "@/components/ui/Card";

export function SupabaseNotice() {
  return (
    <Panel className="border-amber-200 bg-amber-50/90 text-amber-950">
      <h2 className="font-display text-xl font-bold">Connect Supabase to play</h2>
      <p className="mt-2 text-sm leading-relaxed">
        Multiplayer needs a Supabase project. Run{" "}
        <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs">
          supabase/schema.sql
        </code>
        , then add your URL and anon key to{" "}
        <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs">
          .env.local
        </code>{" "}
        and restart the dev server.
      </p>
      <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm">
        <li>
          Copy <code className="font-mono text-xs">.env.local.example</code> →{" "}
          <code className="font-mono text-xs">.env.local</code>
        </li>
        <li>
          Fill in <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
        </li>
        <li>See the README for the full walkthrough</li>
      </ol>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-amber-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
      >
        Back home
      </Link>
    </Panel>
  );
}
