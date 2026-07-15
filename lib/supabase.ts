import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Name of the Storage bucket that holds each player's colored half. Documented
 * in the README and created manually in the Supabase dashboard.
 */
export const HALVES_BUCKET = "colored-halves";

/**
 * True when the Supabase environment variables are present. UI can use this to
 * fail gracefully with a helpful setup message instead of crashing.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let cachedClient: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase client, or null when the app has not been
 * configured with env vars yet. Callers should handle the null case and show
 * setup instructions.
 */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl as string, supabaseAnonKey as string, {
      realtime: { params: { eventsPerSecond: 10 } },
      auth: { persistSession: false },
    });
  }
  return cachedClient;
}

/**
 * Like getSupabase but throws a descriptive error instead of returning null.
 * Use in code paths that have already checked isSupabaseConfigured.
 */
export function requireSupabase(): SupabaseClient {
  const client = getSupabase();
  if (!client) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local (see README)."
    );
  }
  return client;
}
