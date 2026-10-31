/**
 * Supabase mode is explicit: DATA_SOURCE=supabase plus the project URL and publishable key. Without it the app runs
 * on data/seed with no sign-in (local development, tests). The app never holds the service role key: pages read
 * through the signed-in user's session, so row-level security decides; only scripts/sync_supabase.py writes.
 */
export function supabaseOn(): boolean {
  return process.env.DATA_SOURCE === 'supabase';
}

export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // the Vercel integration's name
  if (!url || !key) throw new Error('DATA_SOURCE=supabase needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  return { url, key };
}
