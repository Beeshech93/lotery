-- Lotery MVP schema — demo mode only.
-- Apply in Supabase SQL Editor after creating the project.
-- This migration deliberately contains no real wager, ticket-sale, or payout tables.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'cashier' check (role in ('admin', 'cashier')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.terminals (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  jurisdiction text not null check (jurisdiction in ('NY', 'FL', 'GA')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.demo_receipts (
  id uuid primary key default gen_random_uuid(),
  terminal_id uuid references public.terminals(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  demo_reference text not null unique,
  jurisdiction text not null check (jurisdiction in ('NY', 'FL', 'GA')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint demo_receipts_payload_object check (jsonb_typeof(payload) = 'object')
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists demo_receipts_created_by_created_at_idx
  on public.demo_receipts (created_by, created_at desc);
create index if not exists audit_events_created_at_idx
  on public.audit_events (created_at desc);

-- Create a default cashier profile for each newly registered Auth user.
-- A user cannot choose their own role during sign-up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    'cashier'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_lotery on auth.users;
create trigger on_auth_user_created_lotery
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- SECURITY DEFINER avoids recursive RLS evaluation when policies check admin status.
create or replace function public.is_lotery_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and p.active = true
  );
$$;

revoke all on function public.is_lotery_admin() from public;
grant execute on function public.is_lotery_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.terminals enable row level security;
alter table public.demo_receipts enable row level security;
alter table public.audit_events enable row level security;

-- Profiles: users can read their own profile; admins can read/manage all profiles.
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_lotery_admin()));

drop policy if exists "profiles_update_admin_only" on public.profiles;
create policy "profiles_update_admin_only"
  on public.profiles for update to authenticated
  using ((select public.is_lotery_admin()))
  with check ((select public.is_lotery_admin()));

-- No client-side role edits or profile inserts. Provision the first admin manually
-- in the SQL Editor after signing up the intended account.
revoke insert, delete on public.profiles from anon, authenticated;
revoke update on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, active) on public.profiles to authenticated;

-- Terminals: active users can view active terminals; admins manage terminal config.
drop policy if exists "terminals_select_active_or_admin" on public.terminals;
create policy "terminals_select_active_or_admin"
  on public.terminals for select to authenticated
  using (active = true or (select public.is_lotery_admin()));

drop policy if exists "terminals_admin_insert" on public.terminals;
create policy "terminals_admin_insert"
  on public.terminals for insert to authenticated
  with check ((select public.is_lotery_admin()));

drop policy if exists "terminals_admin_update" on public.terminals;
create policy "terminals_admin_update"
  on public.terminals for update to authenticated
  using ((select public.is_lotery_admin()))
  with check ((select public.is_lotery_admin()));

drop policy if exists "terminals_admin_delete" on public.terminals;
create policy "terminals_admin_delete"
  on public.terminals for delete to authenticated
  using ((select public.is_lotery_admin()));

grant select, insert, update, delete on public.terminals to authenticated;

-- Demo receipts: signed-in users create and read their own; admins may read all.
drop policy if exists "demo_receipts_select_owner_or_admin" on public.demo_receipts;
create policy "demo_receipts_select_owner_or_admin"
  on public.demo_receipts for select to authenticated
  using (created_by = (select auth.uid()) or (select public.is_lotery_admin()));

drop policy if exists "demo_receipts_insert_owner" on public.demo_receipts;
create policy "demo_receipts_insert_owner"
  on public.demo_receipts for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and demo_reference like 'DEMO-%'
  );

grant select, insert on public.demo_receipts to authenticated;
revoke update, delete on public.demo_receipts from anon, authenticated;

-- Audit events are read-only to clients in this first migration.
-- Write audit records later through trusted server-side code/triggers.
drop policy if exists "audit_events_admin_read" on public.audit_events;
create policy "audit_events_admin_read"
  on public.audit_events for select to authenticated
  using ((select public.is_lotery_admin()));

grant select on public.audit_events to authenticated;
revoke insert, update, delete on public.audit_events from anon, authenticated;

-- Starter terminal for demonstration only.
insert into public.terminals (label, jurisdiction)
values ('POS-001-DEMO', 'NY')
on conflict (label) do nothing;
