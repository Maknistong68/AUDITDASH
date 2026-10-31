import type { EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * Where Supabase's emails land: a sign-in link or an invite (`token_hash` + `type`), or a PKCE `code`. The session
 * starts here and the user continues to `next` (an invited user goes to /account to choose a password).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const code = searchParams.get('code');
  const rawNext = searchParams.get('next') ?? '/';
  const to = request.nextUrl.clone();
  to.search = '';
  to.pathname = type === 'invite' || type === 'recovery' ? '/account' : rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';

  const supabase = await createServerSupabase();
  const { error } = tokenHash && type
    ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    : code
      ? await supabase.auth.exchangeCodeForSession(code)
      : { error: new Error('no token') };
  if (error) {
    to.pathname = '/login';
    to.search = '?error=link-invalid';
  }
  return NextResponse.redirect(to);
}
