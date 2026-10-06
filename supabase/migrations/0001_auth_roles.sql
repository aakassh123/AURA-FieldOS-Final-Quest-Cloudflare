-- AURA FieldOS - Stage 2
-- Authentication, company identity and application roles.
-- Run this migration in Supabase SQL Editor after creating the project.

create extension if not exists pgcrypto;

create type public.app_role as enum (
  'SUPER_ADMIN',
  'COMPANY_ADMIN',
  'SALES_MANAGER',
  'SALESMAN',
  'HR_ACCOUNTS'
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) >= 2),
  slug text not null unique check (slug = lower(slug)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  full_name text,
  role public.app_role not null default 'SALESMAN',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_company_id_idx on public.profiles(company_id);
create index if not exists profiles_role_idx on public.profiles(role);

alter table public.companies enable row level security;
alter table public.profiles enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', null)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.current_user_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_company_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('SUPER_ADMIN', 'COMPANY_ADMIN'), false);
$$;

create policy "users can read own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "company members can read same-company profiles"
on public.profiles
for select
to authenticated
using (
  company_id is not null
  and company_id = public.current_user_company_id()
);

-- Profile updates are intentionally closed at this stage.
-- Stage 3 will add protected server-side workflows for company admins.
-- This prevents a browser client from changing its own role or company.

create policy "company members can read their company"
on public.companies
for select
to authenticated
using (id = public.current_user_company_id());

-- No public INSERT/DELETE policy is intentionally provided here.
-- Company creation and role assignment will be handled through protected
-- server-side workflows in the Company & Employee stage.
