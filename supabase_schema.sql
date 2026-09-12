-- ================================================================
-- Trackrr: Supabase Database Schema with Workspace Collaboration
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/tdedvipgmafivbecfcpo/sql/new
-- ================================================================

-- 1. Enable UUID extension
create extension if not exists "uuid-ossp";

-- 2. Workspaces Table
create table if not exists public.workspaces (
  id text primary key default uuid_generate_v4()::text,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  color text default '#818CF8',
  type text default 'freelance',
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.workspaces add column if not exists type text default 'freelance';

-- 3. Workspace Members Table
create table if not exists public.workspace_members (
  id text primary key default uuid_generate_v4()::text,
  workspace_id text references public.workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  user_email text not null,
  role text not null check (role in ('owner', 'manager', 'viewer')),
  created_at timestamptz default timezone('utc'::text, now()) not null,
  unique (workspace_id, user_id)
);

-- 4. Workspace Invites Table
create table if not exists public.workspace_invites (
  id text primary key default uuid_generate_v4()::text,
  workspace_id text references public.workspaces(id) on delete cascade not null,
  workspace_name text not null,
  invited_by_user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  invited_by_email text not null,
  invitee_email text not null,
  role text not null check (role in ('manager', 'viewer')),
  status text default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 5. Clients Table
create table if not exists public.clients (
  id text primary key default uuid_generate_v4()::text,
  workspace_id text references public.workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  company text default '',
  email text default '',
  phone text default '',
  color text default '#818CF8',
  payment_type text default 'per_video' check (payment_type in ('per_video', 'monthly')),
  monthly_salary numeric default 0,
  notes text default '',
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- 6. Tasks Table
create table if not exists public.tasks (
  id text primary key default uuid_generate_v4()::text,
  workspace_id text references public.workspaces(id) on delete cascade not null,
  client_id text references public.clients(id) on delete set null,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  title text not null,
  description text default '',
  status text default 'Completed',
  videos integer default 1,
  price numeric default 0,
  pricing_type text default 'per_video' check (pricing_type in ('total', 'per_video')),
  received_date text not null,
  completed_date text,
  deadline text,
  tags text[] default '{}',
  order_index integer default 0,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- 7. Salary Rates Table
create table if not exists public.salary_rates (
  id text primary key default uuid_generate_v4()::text,
  client_id text references public.clients(id) on delete cascade not null,
  workspace_id text references public.workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  amount numeric not null,
  effective_from text not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 8. Discounts Table
create table if not exists public.discounts (
  id text primary key default uuid_generate_v4()::text,
  client_id text references public.clients(id) on delete cascade not null,
  workspace_id text references public.workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  amount numeric not null,
  note text default '',
  date text not null,
  payment_for_months text[] default '{}',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 9. Payments Table
create table if not exists public.payments (
  id text primary key default uuid_generate_v4()::text,
  client_id text references public.clients(id) on delete cascade not null,
  workspace_id text references public.workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  amount numeric not null,
  method text default 'Cash',
  note text default '',
  date text not null,
  payment_for_months text[] default '{}',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 10. User Settings Table
create table if not exists public.settings (
  id bigint generated by default as identity primary key,
  user_id uuid references auth.users(id) on delete cascade default auth.uid() unique,
  active_workspace_id text,
  currency text default 'USD' check (currency in ('USD', 'INR')),
  theme_color text default '#818CF8',
  theme_style text default 'default',
  show_completed boolean default true,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.settings add column if not exists theme_style text default 'default';

-- Helper function: Check if user has required permission in workspace
create or replace function public.has_workspace_access(ws_id text, min_role text default 'viewer')
returns boolean security definer set search_path = public as $$
begin
  -- 1. Owner of workspace always has full access
  if exists (select 1 from public.workspaces where id = ws_id and user_id = auth.uid()) then
    return true;
  end if;

  -- 2. Check membership role
  if min_role = 'viewer' then
    return exists (select 1 from public.workspace_members where workspace_id = ws_id and user_id = auth.uid());
  elsif min_role = 'manager' then
    return exists (select 1 from public.workspace_members where workspace_id = ws_id and user_id = auth.uid() and role in ('owner', 'manager'));
  elsif min_role = 'owner' then
    return exists (select 1 from public.workspace_members where workspace_id = ws_id and user_id = auth.uid() and role = 'owner');
  end if;

  return false;
end;
$$ language plpgsql;

-- Helper to automatically add owner as member when workspace is created
create or replace function public.handle_new_workspace()
returns trigger security definer set search_path = public as $$
begin
  insert into public.workspace_members (workspace_id, user_id, user_email, role)
  values (
    new.id,
    new.user_id,
    coalesce(auth.jwt() ->> 'email', 'owner@trackrr.local'),
    'owner'
  )
  on conflict (workspace_id, user_id) do nothing;
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_workspace_created on public.workspaces;
create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute function public.handle_new_workspace();

-- Backfill any existing workspaces into workspace_members
insert into public.workspace_members (workspace_id, user_id, user_email, role)
select 
  w.id, 
  w.user_id, 
  coalesce(u.email, 'owner@trackrr.local'), 
  'owner'
from public.workspaces w
left join auth.users u on u.id = w.user_id
where w.user_id is not null
on conflict (workspace_id, user_id) do nothing;

-- Enable RLS
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.clients enable row level security;
alter table public.tasks enable row level security;
alter table public.salary_rates enable row level security;
alter table public.discounts enable row level security;
alter table public.payments enable row level security;
alter table public.settings enable row level security;

-- Drop existing policies to cleanly replace them
drop policy if exists "Users can manage own workspaces" on public.workspaces;
drop policy if exists "Workspaces access policy" on public.workspaces;
create policy "Workspaces access policy" on public.workspaces
  for all using (user_id = auth.uid() or public.has_workspace_access(id, 'viewer'))
  with check (user_id = auth.uid());

drop policy if exists "Members access policy" on public.workspace_members;
create policy "Members access policy" on public.workspace_members
  for all using (user_id = auth.uid() or public.has_workspace_access(workspace_id, 'viewer'))
  with check (public.has_workspace_access(workspace_id, 'owner') or user_id = auth.uid());

drop policy if exists "Invites access policy" on public.workspace_invites;
create policy "Invites access policy" on public.workspace_invites
  for all using (invited_by_user_id = auth.uid() or lower(invitee_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  with check (invited_by_user_id = auth.uid() or lower(invitee_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists "Users can manage own clients" on public.clients;
drop policy if exists "Clients access policy" on public.clients;
create policy "Clients access policy" on public.clients
  for all using (user_id = auth.uid() or public.has_workspace_access(workspace_id, 'viewer'))
  with check (user_id = auth.uid() or public.has_workspace_access(workspace_id, 'manager'));

drop policy if exists "Users can manage own tasks" on public.tasks;
drop policy if exists "Tasks access policy" on public.tasks;
create policy "Tasks access policy" on public.tasks
  for all using (user_id = auth.uid() or public.has_workspace_access(workspace_id, 'viewer'))
  with check (user_id = auth.uid() or public.has_workspace_access(workspace_id, 'manager'));

drop policy if exists "Users can manage own salary rates" on public.salary_rates;
drop policy if exists "Salary rates access policy" on public.salary_rates;
create policy "Salary rates access policy" on public.salary_rates
  for all using (user_id = auth.uid() or public.has_workspace_access(workspace_id, 'viewer'))
  with check (user_id = auth.uid() or public.has_workspace_access(workspace_id, 'manager'));

drop policy if exists "Users can manage own discounts" on public.discounts;
drop policy if exists "Discounts access policy" on public.discounts;
create policy "Discounts access policy" on public.discounts
  for all using (user_id = auth.uid() or public.has_workspace_access(workspace_id, 'viewer'))
  with check (user_id = auth.uid() or public.has_workspace_access(workspace_id, 'manager'));

drop policy if exists "Users can manage own payments" on public.payments;
drop policy if exists "Payments access policy" on public.payments;
create policy "Payments access policy" on public.payments
  for all using (user_id = auth.uid() or public.has_workspace_access(workspace_id, 'viewer'))
  with check (user_id = auth.uid() or public.has_workspace_access(workspace_id, 'manager'));

drop policy if exists "Users can manage own settings" on public.settings;
create policy "Users can manage own settings" on public.settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ================================================================
-- BatchFlow Workspace Integration Tables & RLS Policies
-- ================================================================

-- 11. BatchFlow Clients Table
create table if not exists public.batchflow_clients (
  id text primary key default uuid_generate_v4()::text,
  workspace_id text references public.workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  color text default '#818CF8',
  instagram_id text default '',
  archived integer default 0,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 12. BatchFlow Batches Table
create table if not exists public.batchflow_batches (
  id text primary key default uuid_generate_v4()::text,
  workspace_id text references public.workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  client_id text references public.batchflow_clients(id) on delete cascade not null,
  name text not null,
  shoot_date text not null,
  script text default '',
  archived integer default 0,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 13. BatchFlow Videos Table
create table if not exists public.batchflow_videos (
  id text primary key default uuid_generate_v4()::text,
  workspace_id text references public.workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  batch_id text references public.batchflow_batches(id) on delete cascade not null,
  name text not null,
  script_number integer default 1,
  status text default 'Pending',
  waiting_date text,
  edited_date text,
  posted_date text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.batchflow_clients enable row level security;
alter table public.batchflow_batches enable row level security;
alter table public.batchflow_videos enable row level security;

drop policy if exists "Batchflow clients access policy" on public.batchflow_clients;
create policy "Batchflow clients access policy" on public.batchflow_clients
  for all using (user_id = auth.uid() or public.has_workspace_access(workspace_id, 'viewer'))
  with check (user_id = auth.uid() or public.has_workspace_access(workspace_id, 'manager'));

drop policy if exists "Batchflow batches access policy" on public.batchflow_batches;
create policy "Batchflow batches access policy" on public.batchflow_batches
  for all using (user_id = auth.uid() or public.has_workspace_access(workspace_id, 'viewer'))
  with check (user_id = auth.uid() or public.has_workspace_access(workspace_id, 'manager'));

drop policy if exists "Batchflow videos access policy" on public.batchflow_videos;
create policy "Batchflow videos access policy" on public.batchflow_videos
  for all using (user_id = auth.uid() or public.has_workspace_access(workspace_id, 'viewer'))
  with check (user_id = auth.uid() or public.has_workspace_access(workspace_id, 'manager'));

-- Schema Parity Migrations: Video URL, Views, Description, and Meta credentials
alter table public.batchflow_videos add column if not exists script_number integer default 1;
alter table public.batchflow_videos add column if not exists video_url text;
alter table public.batchflow_videos add column if not exists views text;
alter table public.batchflow_videos add column if not exists description text;

alter table public.settings add column if not exists meta_app_id text;
alter table public.settings add column if not exists meta_client_token text;
alter table public.settings add column if not exists meta_user_token text;
alter table public.settings add column if not exists meta_ig_user_id text;

