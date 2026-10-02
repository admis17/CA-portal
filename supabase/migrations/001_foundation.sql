-- Phase 1 foundation: roles, schema, RLS, storage (PRD sections 4-9, TECH_STACK sections 4-6)
-- Run in Supabase SQL editor or via `supabase db push`. Region: ap-south-1 (Mumbai) else ap-southeast-1.

create extension if not exists "pgcrypto";

-- Enums
do $$ begin
  create type user_role as enum ('admin','employee','client');
exception when duplicate_object then null; end $$;
do $$ begin
  create type request_status as enum ('unassigned','assigned','in_progress','under_review','completed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type priority as enum ('low','normal','high');
exception when duplicate_object then null; end $$;

-- Profiles (one row per auth user; username is the login id)
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  role user_role not null,
  username text unique not null,
  full_name text not null,
  email text, phone text,
  company_name text, pan text, gstin text,
  is_active boolean not null default true,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists services (
  id serial primary key,
  name text unique not null,
  is_active boolean default true
);
insert into services(name) values
  ('GST Return'),('ITR Filing'),('TDS Return'),('Audit'),('Bookkeeping'),('Other')
on conflict (name) do nothing;

create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references profiles(id),
  service_id int not null references services(id),
  note text,
  status request_status not null default 'unassigned',
  assigned_to uuid references profiles(id),
  assigned_by uuid references profiles(id),
  priority priority not null default 'normal',
  due_date date,
  assigned_at timestamptz, started_at timestamptz, completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_requests_client on requests(client_id);
create index if not exists idx_requests_assignee on requests(assigned_to);
create index if not exists idx_requests_status on requests(status);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  uploaded_by uuid not null references profiles(id),
  file_name text not null, storage_path text not null,
  mime_type text, size_bytes bigint,
  created_at timestamptz not null default now()
);

create table if not exists request_comments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  author_id uuid not null references profiles(id),
  body text not null, internal boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  request_id uuid references requests(id) on delete cascade,
  message text not null, is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on notifications(user_id, is_read);

create table if not exists activity_log (
  id bigserial primary key,
  actor_id uuid references profiles(id),
  action text not null,
  entity text, entity_id uuid, meta jsonb,
  created_at timestamptz not null default now()
);

-- Helper: current user's role (null when deactivated -> treated as no access)
create or replace function public.current_role_()
returns user_role language sql stable security definer set search_path = public as
$$ select role from profiles where id = auth.uid() and is_active $$;

-- RLS on
alter table profiles enable row level security;
alter table requests enable row level security;
alter table documents enable row level security;
alter table request_comments enable row level security;
alter table notifications enable row level security;
alter table activity_log enable row level security;

-- Profiles: own row readable; admin all
drop policy if exists p_profiles_own on profiles;
create policy p_profiles_own on profiles for select using (id = auth.uid());
drop policy if exists p_profiles_admin on profiles;
create policy p_profiles_admin on profiles for all
  using (public.current_role_() = 'admin') with check (public.current_role_() = 'admin');

-- Requests: admin all; client owns; employee assigned
drop policy if exists p_requests_admin on requests;
create policy p_requests_admin on requests for all
  using (public.current_role_() = 'admin') with check (public.current_role_() = 'admin');
drop policy if exists p_requests_client_sel on requests;
create policy p_requests_client_sel on requests for select using (client_id = auth.uid());
drop policy if exists p_requests_client_ins on requests;
create policy p_requests_client_ins on requests for insert
  with check (client_id = auth.uid() and status = 'unassigned' and assigned_to is null);
drop policy if exists p_requests_emp_sel on requests;
create policy p_requests_emp_sel on requests for select using (assigned_to = auth.uid());

-- Documents: via parent request ownership / assignment / admin
drop policy if exists p_docs_admin on documents;
create policy p_docs_admin on documents for all
  using (public.current_role_() = 'admin') with check (public.current_role_() = 'admin');
drop policy if exists p_docs_client on documents;
create policy p_docs_client on documents for select using (
  exists (select 1 from requests r where r.id = documents.request_id and r.client_id = auth.uid()));
drop policy if exists p_docs_emp on documents;
create policy p_docs_emp on documents for select using (
  exists (select 1 from requests r where r.id = documents.request_id and r.assigned_to = auth.uid()));

-- Comments: admin all; participants on own requests
drop policy if exists p_comments_admin on request_comments;
create policy p_comments_admin on request_comments for all
  using (public.current_role_() = 'admin') with check (public.current_role_() = 'admin');
drop policy if exists p_comments_rw on request_comments;
create policy p_comments_rw on request_comments for all using (
  exists (select 1 from requests r where r.id = request_comments.request_id
    and (r.client_id = auth.uid() or r.assigned_to = auth.uid()))
) with check (
  author_id = auth.uid() and exists
  (select 1 from requests r where r.id = request_comments.request_id
    and (r.client_id = auth.uid() or r.assigned_to = auth.uid())));

-- Notifications: own only
drop policy if exists p_notif_own on notifications;
create policy p_notif_own on notifications for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Activity log: admin reads; inserts happen via service role (bypasses RLS)
drop policy if exists p_log_admin_read on activity_log;
create policy p_log_admin_read on activity_log for select
  using (public.current_role_() = 'admin');

-- Private storage bucket for client files (Phase 2 uses it; created now so env is ready)
insert into storage.buckets (id, name, public)
values ('client-docs', 'client-docs', false)
on conflict (id) do nothing;
-- No storage.objects policies -> all direct access denied; only service-role signed URLs work.
