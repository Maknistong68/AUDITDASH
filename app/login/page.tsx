import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { supabaseOn } from '@/lib/supabase/env';
import { sendLink, signIn, signOut } from './actions';

export const metadata: Metadata = { title: 'Sign in' };

const FIELD = 'h-11 w-full rounded-xl bg-fill-2 px-3.5 text-[15px] text-ink outline-none transition-shadow focus:shadow-[0_0_0_2px_var(--accent)]';
const MESSAGES: Record<string, string> = {
  credentials: 'That email and password do not match an account here. Check them, or ask for a sign-in link.',
  fields: 'Enter your email and password to sign in.',
  'no-access': 'This account has no role on the dashboard yet. Ask an admin to invite your address, then sign in again.',
  'link-invalid': 'That sign-in link has expired or was already used. Ask for a new one.',
};

/** Sign-in: password, or an emailed link. Accounts are created by invitation only (Supabase → invite user). */
export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!supabaseOn()) redirect('/');
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) ?? '';
  const next = one('next').startsWith('/') ? one('next') : '/';
  const reason = one('reason') || one('error');
  const me = await currentUser();
  const message = MESSAGES[reason];
  return (
    <main id="main" className="flex min-h-svh flex-col items-center justify-center gap-8 px-[var(--gutter)] py-12">
      <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Audits</h1>
      <section aria-labelledby="signin-h" className="card flex w-full max-w-[400px] flex-col gap-5 p-6">
        <h2 id="signin-h" className="text-[21px] font-semibold tracking-[-0.02em]">Sign in</h2>
        {me && me.role && (
          <p className="text-[14px] text-muted">
            Signed in as <span className="font-semibold text-ink">{me.email}</span>.
          </p>
        )}
        {message && <p role="alert" className="rounded-xl bg-fill-2 px-3.5 py-2.5 text-[14px] text-ink">{message}</p>}
        {one('sent') && <p role="status" className="rounded-xl bg-fill-2 px-3.5 py-2.5 text-[14px] text-ink">If that address has an account, a sign-in link is on its way.</p>}
        <form action={signIn} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-muted">Email</span>
            <input name="email" type="email" autoComplete="email" required className={FIELD} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-muted">Password</span>
            <input name="password" type="password" autoComplete="current-password" required className={FIELD} />
          </label>
          <button type="submit" className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--accent)] px-5 text-[14px] font-semibold text-[var(--on-accent)] hover:brightness-110">
            Sign in
          </button>
        </form>
        <form action={sendLink} className="flex flex-col gap-3">
          <input type="hidden" name="next" value={next} />
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-muted">Or email me a sign-in link</span>
            <input name="email" type="email" autoComplete="email" required className={FIELD} />
          </label>
          <button type="submit" className="inline-flex h-10 items-center justify-center rounded-full bg-fill px-4 text-[14px] font-semibold text-ink hover:bg-[var(--control)]">
            Send sign-in link
          </button>
        </form>
        {me && (
          <form action={signOut}>
            <button type="submit" className="text-[13px] font-semibold text-muted hover:text-ink">Sign out</button>
          </form>
        )}
      </section>
    </main>
  );
}
