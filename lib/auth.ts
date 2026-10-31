import { redirect } from 'next/navigation';
import { cache } from 'react';
import { supabaseOn } from '@/lib/supabase/env';
import { createServerSupabase } from '@/lib/supabase/server';

/** viewer: executives, read only · auditor: files audits · lead: reviews and imports · admin: invites and roles. */
export type Role = 'viewer' | 'auditor' | 'lead' | 'admin';
export interface Me { id: string; email: string; role: Role | null }

const RANK: Record<Role, number> = { viewer: 0, auditor: 1, lead: 2, admin: 3 };

/**
 * The signed-in user and their role, once per request. The role counts only once the email is confirmed (the
 * database's app_role() says the same). Without Supabase (local, tests) everyone is a local admin.
 */
export const currentUser = cache(async (): Promise<Me | null> => {
  if (!supabaseOn()) return { id: 'local', email: 'local', role: 'admin' };
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = user.email_confirmed_at ? ((data?.role as Role | null) ?? null) : null;
  return { id: user.id, email: user.email ?? '', role };
});

/** The page needs at least this role; otherwise the login page explains. */
export async function requireRole(min: Role): Promise<Me> {
  const me = await currentUser();
  if (!me) redirect('/login');
  if (!me.role || RANK[me.role] < RANK[min]) redirect('/login?reason=no-access');
  return me;
}

export function hasRole(me: Me | null, min: Role): boolean {
  return !!me?.role && RANK[me.role] >= RANK[min];
}
