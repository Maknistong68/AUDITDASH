'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';

/** Where to go after sign-in: an in-app path from ?next=, never another site. */
function safeNext(raw: FormDataEntryValue | null): string {
  const s = typeof raw === 'string' ? raw : '';
  return s.startsWith('/') && !s.startsWith('//') ? s : '/';
}

export async function signIn(form: FormData) {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  const next = safeNext(form.get('next'));
  if (!email || !password) redirect(`/login?error=fields&next=${encodeURIComponent(next)}`);
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=credentials&next=${encodeURIComponent(next)}`);
  redirect(next);
}

export async function sendLink(form: FormData) {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const next = safeNext(form.get('next'));
  if (!email) redirect('/login?error=fields');
  const origin = (await headers()).get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const supabase = await createServerSupabase();
  // Only invited accounts exist (no sign-up here); the link lands on /auth/confirm, which starts the session.
  await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}` } });
  redirect('/login?sent=1');  // the same answer whether or not the address is known
}

export async function signOut() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function setPassword(form: FormData) {
  const password = String(form.get('password') ?? '');
  if (password.length < 10) redirect('/account?error=short');
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.updateUser({ password });
  redirect(error ? '/account?error=failed' : '/account?saved=1');
}
