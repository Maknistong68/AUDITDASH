import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { supabaseOn } from '@/lib/supabase/env';

const OPEN = ['/login', '/auth/'];

/**
 * In Supabase mode every page needs a session: the middleware refreshes the Auth token on each request (Server
 * Components cannot write cookies) and sends anyone without one to /login. Roles are checked by the data layer.
 */
export async function middleware(request: NextRequest) {
  if (!supabaseOn()) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await supabase.auth.getClaims();
  const { pathname } = request.nextUrl;
  if (!data?.claims && !OPEN.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|woff2?)$).*)'],
};
