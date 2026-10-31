import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { supabaseOn } from '@/lib/supabase/env';
import { setPassword, signOut } from '@/app/login/actions';

export const metadata: Metadata = { title: 'Account' };

const FIELD = 'h-11 w-full rounded-xl bg-fill-2 px-3.5 text-[15px] text-ink outline-none transition-shadow focus:shadow-[0_0_0_2px_var(--accent)]';

/** The signed-in person: their role, a password of their own (invited accounts arrive without one), sign out. */
export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!supabaseOn()) redirect('/');
  const me = await currentUser();
  if (!me) redirect('/login');
  const sp = await searchParams;
  const flag = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) ?? '';
  return (
    <main id="main" className="flex min-h-svh flex-col items-center justify-center gap-8 px-[var(--gutter)] py-12">
      <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Audits</h1>
      <section aria-labelledby="account-h" className="card flex w-full max-w-[400px] flex-col gap-5 p-6">
        <h2 id="account-h" className="text-[21px] font-semibold tracking-[-0.02em]">Your account</h2>
        <p className="text-[14px] text-muted">
          <span className="font-semibold text-ink">{me.email}</span> · {me.role ? `${me.role} access` : 'no role yet: ask an admin'}
        </p>
        {flag('saved') && <p role="status" className="rounded-xl bg-fill-2 px-3.5 py-2.5 text-[14px]">Password saved. You can sign in with it from now on.</p>}
        {flag('error') === 'short' && <p role="alert" className="rounded-xl bg-fill-2 px-3.5 py-2.5 text-[14px]">Choose a password of at least 10 characters.</p>}
        {flag('error') === 'failed' && <p role="alert" className="rounded-xl bg-fill-2 px-3.5 py-2.5 text-[14px]">The password was not saved. Try again, or ask for a new sign-in link.</p>}
        <form action={setPassword} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-muted">New password</span>
            <input name="password" type="password" autoComplete="new-password" minLength={10} required className={FIELD} />
          </label>
          <button type="submit" className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--accent)] px-5 text-[14px] font-semibold text-[var(--on-accent)] hover:brightness-110">
            Save password
          </button>
        </form>
        <div className="flex items-center justify-between">
          <Link href="/" className="text-[13px] font-semibold text-[var(--accent)] hover:underline">Open the dashboard</Link>
          <form action={signOut}>
            <button type="submit" className="text-[13px] font-semibold text-muted hover:text-ink">Sign out</button>
          </form>
        </div>
      </section>
    </main>
  );
}
