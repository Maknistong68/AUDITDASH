import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseEnv } from './env';

/** The signed-in user's client (session from the request cookies; row-level security applies). */
export async function createServerSupabase() {
  const { url, key } = supabaseEnv();
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) store.set(name, value, options);
        } catch {
          // Server Components cannot write cookies; the middleware refreshes the session instead.
        }
      },
    },
  });
}
