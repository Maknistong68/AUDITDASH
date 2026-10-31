-- app_role() is called by every policy as the signed-in user, so `authenticated` must execute it; nobody else can.
-- (Postgres grants EXECUTE to PUBLIC by default; revoking from anon alone leaves that implicit grant.)
revoke execute on function public.app_role() from public, anon;
grant execute on function public.app_role() to authenticated;
