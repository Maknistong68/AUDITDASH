-- HSE audit dashboard: data tables, invite-only users with roles, row-level security, audit trail.
-- Roles: viewer (executives, read only) · auditor (reads, submits audits) · lead (reviews submissions, imports)
-- · admin (manages invites and roles). A signed-in user with no role sees nothing.

-- An earlier, unused draft schema (empty tables): replaced by this one.
drop table if exists public.audit_questions, public.nc_categories, public.audit_types, public.contractors cascade;
drop type if exists public.audit_result, public.observation_type, public.audit_status, public.corrective_action_status, public.user_role;

create type public.app_role as enum ('viewer', 'auditor', 'lead', 'admin');

-- Invite list: only these emails can create an account (enforced by the trigger on auth.users below).
create table public.invites (
  email text primary key check (email = lower(email)),
  role public.app_role not null default 'viewer',
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  role public.app_role,               -- null: no access
  created_at timestamptz not null default now()
);

-- The caller's role, for policies (security definer so policies on profiles do not recurse).
create function public.app_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r public.app_role;
begin
  select role into r from public.invites where email = lower(new.email);
  if not found then
    raise exception 'This email is not invited to the audit dashboard';
  end if;
  insert into public.profiles (id, email, role) values (new.id, lower(new.email), r);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Audit data, as the importer writes it (data/seed/*.json): one row per record, the record in `doc`, `position` its
-- place in the file (the register order for contractors, date order for audits).
create table public.contractors (id text primary key, position int not null, doc jsonb not null, updated_at timestamptz not null default now());
create table public.checklist_items (code text primary key, position int not null, doc jsonb not null, updated_at timestamptz not null default now());
create table public.audits (
  id text primary key, contractor_id text not null references public.contractors (id),
  quarter text not null, position int not null, doc jsonb not null, updated_at timestamptz not null default now()
);
create table public.observations (
  id text primary key, audit_id text not null references public.audits (id) on delete cascade,
  position int not null, doc jsonb not null, updated_at timestamptz not null default now()
);
create index on public.audits (contractor_id);
create index on public.observations (audit_id);

-- Meta (quarters, sub-regions present), as data/seed/meta.json.
create table public.meta (id int primary key default 1 check (id = 1), doc jsonb not null, updated_at timestamptz not null default now());

-- Audits entered in the app's wizard, waiting for a lead to review and import.
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null default auth.uid() references auth.users (id),
  contractor_id text references public.contractors (id),
  audit_type text not null default 'hs',
  doc jsonb not null,
  status text not null default 'submitted' check (status in ('submitted', 'accepted', 'rejected')),
  review_note text,
  reviewed_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index on public.submissions (submitted_by);

-- Who changed what, when. Written by triggers only.
create table public.audit_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid default auth.uid(),
  table_name text not null,
  record_id text,
  action text not null,
  detail jsonb
);

create function public.log_event() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_events (table_name, record_id, action, detail)
  values (tg_table_name,
          coalesce((to_jsonb(new) ->> 'id'), (to_jsonb(old) ->> 'id'), (to_jsonb(new) ->> 'email'), (to_jsonb(old) ->> 'email'), (to_jsonb(new) ->> 'code')),
          lower(tg_op),
          case when tg_table_name in ('profiles', 'invites', 'submissions')
               then jsonb_build_object('old', to_jsonb(old) - 'doc', 'new', to_jsonb(new) - 'doc') end);
  return coalesce(new, old);
end $$;

create trigger log_profiles after insert or update or delete on public.profiles for each row execute function public.log_event();
create trigger log_invites after insert or update or delete on public.invites for each row execute function public.log_event();
create trigger log_submissions after insert or update or delete on public.submissions for each row execute function public.log_event();
create trigger log_audits after insert or update or delete on public.audits for each row execute function public.log_event();

-- Row-level security: on for every table; nothing is readable without a role.
alter table public.invites enable row level security;
alter table public.profiles enable row level security;
alter table public.contractors enable row level security;
alter table public.checklist_items enable row level security;
alter table public.audits enable row level security;
alter table public.observations enable row level security;
alter table public.meta enable row level security;
alter table public.submissions enable row level security;
alter table public.audit_events enable row level security;

create policy "read: any role" on public.contractors for select to authenticated using ((select public.app_role()) is not null);
create policy "read: any role" on public.checklist_items for select to authenticated using ((select public.app_role()) is not null);
create policy "read: any role" on public.audits for select to authenticated using ((select public.app_role()) is not null);
create policy "read: any role" on public.meta for select to authenticated using ((select public.app_role()) is not null);
create policy "read: any role" on public.observations for select to authenticated using ((select public.app_role()) is not null);

create policy "own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "admin: read profiles" on public.profiles for select to authenticated using ((select public.app_role()) = 'admin');
create policy "admin: change roles" on public.profiles for update to authenticated
  using ((select public.app_role()) = 'admin') with check ((select public.app_role()) = 'admin');

create policy "admin: manage invites" on public.invites for all to authenticated
  using ((select public.app_role()) = 'admin') with check ((select public.app_role()) = 'admin');

create policy "auditor: submit" on public.submissions for insert to authenticated
  with check (submitted_by = (select auth.uid()) and status = 'submitted'
              and (select public.app_role()) in ('auditor', 'lead', 'admin'));
create policy "read own or review" on public.submissions for select to authenticated
  using (submitted_by = (select auth.uid()) or (select public.app_role()) in ('lead', 'admin'));
create policy "lead: review" on public.submissions for update to authenticated
  using ((select public.app_role()) in ('lead', 'admin')) with check ((select public.app_role()) in ('lead', 'admin'));

create policy "admin, lead: read trail" on public.audit_events for select to authenticated
  using ((select public.app_role()) in ('lead', 'admin'));

-- Data tables are written by the sync script (service role, which bypasses RLS), not from the browser.
revoke insert, update, delete on public.meta, public.contractors, public.checklist_items, public.audits, public.observations from anon, authenticated;
revoke all on public.audit_events from anon;
revoke all on public.invites, public.profiles, public.submissions from anon;
revoke execute on function public.app_role() from anon;

-- Owner accounts: admins. An account created before this migration gets its profile here.
insert into public.invites (email, role) values ('nievaoging@gmail.com', 'admin'), ('nievamarkronnel@gmail.com', 'admin');
insert into public.profiles (id, email, role)
  select u.id, lower(u.email), i.role from auth.users u join public.invites i on i.email = lower(u.email)
  on conflict (id) do nothing;

-- Trigger functions are not callable through the API.
revoke execute on function public.handle_new_user(), public.log_event() from public, anon, authenticated;
