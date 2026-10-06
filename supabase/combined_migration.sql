-- AURA FieldOS - Stage 2
-- Authentication, company identity and application roles.
-- Run this migration in Supabase SQL Editor after creating the project.

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum (
  'SUPER_ADMIN',
  'COMPANY_ADMIN',
  'SALES_MANAGER',
  'SALESMAN',
  'HR_ACCOUNTS'
);
exception
  when duplicate_object then null;
end $$;

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

drop policy if exists "users can read own profile" on public.profiles;
create policy "users can read own profile" on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "company members can read same-company profiles" on public.profiles;
create policy "company members can read same-company profiles" on public.profiles
for select
to authenticated
using (
  company_id is not null
  and company_id = public.current_user_company_id()
);

-- Profile updates are intentionally closed at this stage.
-- Stage 3 will add protected server-side workflows for company admins.
-- This prevents a browser client from changing its own role or company.

drop policy if exists "company members can read their company" on public.companies;
create policy "company members can read their company" on public.companies
for select
to authenticated
using (id = public.current_user_company_id());

-- No public INSERT/DELETE policy is intentionally provided here.
-- Company creation and role assignment will be handled through protected
-- server-side workflows in the Company & Employee stage.
-- AURA FieldOS - Stage 3
-- Company setup, employees, teams and protected multi-tenant access.
-- Run after 0001_auth_roles.sql.


-- Tighten Stage 2 helper functions for the same pinned-search-path standard.
create or replace function public.current_user_company_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.company_id from public.profiles p where p.id = (select auth.uid());
$$;

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid());
$$;

create or replace function public.is_company_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() in ('SUPER_ADMIN', 'COMPANY_ADMIN'), false);
$$;

do $$ begin
  create type public.employee_status as enum ('INVITED', 'ACTIVE', 'INACTIVE');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete set null,
  employee_code text not null,
  full_name text not null check (char_length(trim(full_name)) >= 2),
  email text,
  phone text,
  designation text,
  role public.app_role not null default 'SALESMAN',
  manager_id uuid references public.employees(id) on delete set null,
  status public.employee_status not null default 'INVITED',
  joined_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, employee_code)
);

create index if not exists employees_company_id_idx on public.employees(company_id);
create index if not exists employees_company_role_idx on public.employees(company_id, role);
create index if not exists employees_company_manager_idx on public.employees(company_id, manager_id);
create index if not exists employees_company_status_idx on public.employees(company_id, status);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (char_length(trim(name)) >= 2),
  description text,
  manager_employee_id uuid references public.employees(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

create index if not exists teams_company_id_idx on public.teams(company_id);
create index if not exists teams_company_manager_idx on public.teams(company_id, manager_employee_id);

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (team_id, employee_id)
);

create index if not exists team_members_company_id_idx on public.team_members(company_id);
create index if not exists team_members_employee_id_idx on public.team_members(employee_id);

-- Keep company_id consistent across relationships. These checks run in the DB,
-- so a browser cannot create cross-company manager/team relationships.
create or replace function public.validate_employee_company_links()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.manager_id is not null and not exists (
    select 1
    from public.employees e
    where e.id = new.manager_id
      and e.company_id = new.company_id
  ) then
    raise exception 'Manager must belong to the same company';
  end if;

  if new.user_id is not null and exists (
    select 1
    from public.employees e
    where e.user_id = new.user_id
      and e.id <> new.id
  ) then
    raise exception 'This user is already linked to an employee';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_employee_company_links on public.employees;
create trigger validate_employee_company_links
before insert or update on public.employees
for each row execute procedure public.validate_employee_company_links();

create or replace function public.validate_team_links()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.manager_employee_id is not null and not exists (
    select 1
    from public.employees e
    where e.id = new.manager_employee_id
      and e.company_id = new.company_id
  ) then
    raise exception 'Team manager must belong to the same company';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_team_links on public.teams;
create trigger validate_team_links
before insert or update on public.teams
for each row execute procedure public.validate_team_links();

create or replace function public.validate_team_member_company()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.teams t
    where t.id = new.team_id and t.company_id = new.company_id
  ) then
    raise exception 'Team must belong to the same company';
  end if;

  if not exists (
    select 1 from public.employees e
    where e.id = new.employee_id and e.company_id = new.company_id
  ) then
    raise exception 'Employee must belong to the same company';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_team_member_company on public.team_members;
create trigger validate_team_member_company
before insert or update on public.team_members
for each row execute procedure public.validate_team_member_company();

-- Protected company bootstrap. A newly authenticated user with no company can
-- create exactly one company and become its COMPANY_ADMIN.
create or replace function public.bootstrap_company(p_name text, p_slug text)
returns public.companies
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_company public.companies;
  v_slug text := lower(trim(p_slug));
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_user_id) then
    raise exception 'Profile not found';
  end if;

  if exists (
    select 1 from public.profiles p
    where p.id = v_user_id and p.company_id is not null
  ) then
    raise exception 'User already belongs to a company';
  end if;

  if char_length(trim(p_name)) < 2 then
    raise exception 'Company name is too short';
  end if;

  if v_slug !~ '^[a-z0-9]+([a-z0-9-]*[a-z0-9])?$' then
    raise exception 'Slug must use lowercase letters, numbers and hyphens';
  end if;

  insert into public.companies (name, slug)
  values (trim(p_name), v_slug)
  returning * into v_company;

  update public.profiles
  set company_id = v_company.id,
      role = 'COMPANY_ADMIN',
      updated_at = now()
  where id = v_user_id;

  insert into public.employees (
    company_id, user_id, employee_code, full_name, email, role, status, joined_at
  )
  select
    v_company.id,
    u.id,
    'EMP-001',
    coalesce(nullif(trim(p.full_name), ''), split_part(coalesce(u.email, 'admin'), '@', 1)),
    u.email,
    'COMPANY_ADMIN',
    'ACTIVE',
    current_date
  from auth.users u
  join public.profiles p on p.id = u.id
  where u.id = v_user_id;

  return v_company;
exception
  when unique_violation then
    raise exception 'Company name or slug already exists';
end;
$$;

revoke execute on function public.bootstrap_company(text, text) from public;
grant execute on function public.bootstrap_company(text, text) to authenticated;

-- Helper used by RLS. SECURITY DEFINER avoids recursive profile/company policy
-- evaluation while still returning only the current user's authorization state.
create or replace function public.can_manage_company_people()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role in ('SUPER_ADMIN', 'COMPANY_ADMIN', 'SALES_MANAGER')
     from public.profiles p
     where p.id = (select auth.uid())),
    false
  );
$$;

create or replace function public.is_company_admin_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role in ('SUPER_ADMIN', 'COMPANY_ADMIN')
     from public.profiles p
     where p.id = (select auth.uid())),
    false
  );
$$;

revoke execute on function public.can_manage_company_people() from public;
revoke execute on function public.is_company_admin_user() from public;
grant execute on function public.can_manage_company_people() to authenticated;
grant execute on function public.is_company_admin_user() to authenticated;

-- Prevent non-admins from promoting an employee to a company-admin role.
create or replace function public.protect_employee_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role public.app_role;
begin
  select p.role into v_actor_role
  from public.profiles p
  where p.id = (select auth.uid());

  if new.role = 'SUPER_ADMIN' then
    raise exception 'SUPER_ADMIN cannot be assigned to a company employee';
  end if;

  if new.role = 'COMPANY_ADMIN' and v_actor_role <> 'COMPANY_ADMIN' and v_actor_role <> 'SUPER_ADMIN' then
    raise exception 'Only company admins can assign company-admin role';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_employee_role on public.employees;
create trigger protect_employee_role
before insert or update of role on public.employees
for each row execute procedure public.protect_employee_role();

alter table public.employees enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;

-- Employees: every member can read their own company. Managers/admins can mutate.
drop policy if exists "company members can read employees" on public.employees;
create policy "company members can read employees" on public.employees
for select
to authenticated
using (company_id = (select public.current_user_company_id()));

drop policy if exists "authorized users can create employees" on public.employees;
create policy "authorized users can create employees" on public.employees
for insert
to authenticated
with check (
  company_id = (select public.current_user_company_id())
  and (select public.can_manage_company_people())
);

drop policy if exists "authorized users can update employees" on public.employees;
create policy "authorized users can update employees" on public.employees
for update
to authenticated
using (
  company_id = (select public.current_user_company_id())
  and (select public.can_manage_company_people())
)
with check (
  company_id = (select public.current_user_company_id())
  and (select public.can_manage_company_people())
);

drop policy if exists "company admins can delete employees" on public.employees;
create policy "company admins can delete employees" on public.employees
for delete
to authenticated
using (
  company_id = (select public.current_user_company_id())
  and (select public.is_company_admin_user())
);

-- Teams.
drop policy if exists "company members can read teams" on public.teams;
create policy "company members can read teams" on public.teams
for select
to authenticated
using (company_id = (select public.current_user_company_id()));

drop policy if exists "authorized users can create teams" on public.teams;
create policy "authorized users can create teams" on public.teams
for insert
to authenticated
with check (
  company_id = (select public.current_user_company_id())
  and (select public.can_manage_company_people())
);

drop policy if exists "authorized users can update teams" on public.teams;
create policy "authorized users can update teams" on public.teams
for update
to authenticated
using (
  company_id = (select public.current_user_company_id())
  and (select public.can_manage_company_people())
)
with check (
  company_id = (select public.current_user_company_id())
  and (select public.can_manage_company_people())
);

drop policy if exists "company admins can delete teams" on public.teams;
create policy "company admins can delete teams" on public.teams
for delete
to authenticated
using (
  company_id = (select public.current_user_company_id())
  and (select public.is_company_admin_user())
);

-- Team membership.
drop policy if exists "company members can read team members" on public.team_members;
create policy "company members can read team members" on public.team_members
for select
to authenticated
using (company_id = (select public.current_user_company_id()));

drop policy if exists "authorized users can add team members" on public.team_members;
create policy "authorized users can add team members" on public.team_members
for insert
to authenticated
with check (
  company_id = (select public.current_user_company_id())
  and (select public.can_manage_company_people())
);

drop policy if exists "authorized users can update team members" on public.team_members;
create policy "authorized users can update team members" on public.team_members
for update
to authenticated
using (
  company_id = (select public.current_user_company_id())
  and (select public.can_manage_company_people())
)
with check (
  company_id = (select public.current_user_company_id())
  and (select public.can_manage_company_people())
);

drop policy if exists "company admins can remove team members" on public.team_members;
create policy "company admins can remove team members" on public.team_members
for delete
to authenticated
using (
  company_id = (select public.current_user_company_id())
  and (select public.is_company_admin_user())
);

-- Profiles can now be read by company members as in Stage 2, but only the
-- controlled employee workflow can change role/company identity.
create or replace function public.sync_employee_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null then
    update public.profiles
    set company_id = new.company_id,
        role = new.role,
        is_active = (new.status <> 'INACTIVE'),
        full_name = new.full_name,
        updated_at = now()
    where id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_employee_profile_role on public.employees;
create trigger sync_employee_profile_role
after insert or update of company_id, user_id, role, status, full_name on public.employees
for each row execute procedure public.sync_employee_profile_role();

-- User linking is a privileged operation. The browser cannot attach an employee
-- to an arbitrary auth user and thereby alter that user's company/role.
create or replace function public.protect_employee_user_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role public.app_role;
  v_target_company uuid;
begin
  select p.role into v_actor_role
  from public.profiles p
  where p.id = (select auth.uid());

  if new.user_id is null then
    if tg_op = 'UPDATE' and old.user_id is not null then
      raise exception 'Linked employee accounts cannot be detached in this stage';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and new.user_id = old.user_id then
    return new;
  end if;

  if v_actor_role not in ('SUPER_ADMIN', 'COMPANY_ADMIN') then
    raise exception 'Only company admins can link employee accounts';
  end if;

  select p.company_id into v_target_company
  from public.profiles p
  where p.id = new.user_id;

  if v_target_company is not null and v_target_company <> new.company_id then
    raise exception 'User already belongs to another company';
  end if;

  if exists (select 1 from public.employees e where e.user_id = new.user_id and e.id <> new.id) then
    raise exception 'This user is already linked to another employee';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_employee_user_link on public.employees;
create trigger protect_employee_user_link
before insert or update of user_id on public.employees
for each row execute procedure public.protect_employee_user_link();

-- Keep updated_at current for Stage 3 entities.
create or replace function public.touch_stage3_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists employees_updated_at on public.employees;
create trigger employees_updated_at before update on public.employees
for each row execute procedure public.touch_stage3_updated_at();

drop trigger if exists teams_updated_at on public.teams;
create trigger teams_updated_at before update on public.teams
for each row execute procedure public.touch_stage3_updated_at();
-- AURA FieldOS - Stage 4 CRM foundation
-- Leads, customers, contacts, pipeline stages, activities and tasks.
-- Run after 0001_auth_roles.sql and 0002_company_employee_teams.sql.

do $$ begin
  create type public.lead_status as enum ('OPEN', 'WON', 'LOST');
exception
  when duplicate_object then null;
end $$;
do $$ begin
  create type public.lead_priority as enum ('LOW', 'MEDIUM', 'HIGH');
exception
  when duplicate_object then null;
end $$;
do $$ begin
  create type public.activity_type as enum ('NOTE', 'CALL', 'EMAIL', 'MEETING', 'WHATSAPP', 'STATUS_CHANGE');
exception
  when duplicate_object then null;
end $$;
do $$ begin
  create type public.task_status as enum ('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (char_length(trim(name)) >= 2),
  position integer not null default 0 check (position >= 0),
  color text not null default 'slate',
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);
create index if not exists pipeline_stages_company_position_idx on public.pipeline_stages(company_id, position);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (char_length(trim(name)) >= 2),
  phone text,
  email text,
  address text,
  city text,
  industry text,
  notes text,
  owner_employee_id uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists customers_company_idx on public.customers(company_id);
create index if not exists customers_owner_idx on public.customers(company_id, owner_employee_id);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) >= 2),
  designation text,
  phone text,
  email text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists contacts_company_customer_idx on public.contacts(company_id, customer_id);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null check (char_length(trim(title)) >= 2),
  customer_id uuid references public.customers(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  stage_id uuid not null references public.pipeline_stages(id) on delete restrict,
  owner_employee_id uuid references public.employees(id) on delete set null,
  source text,
  priority public.lead_priority not null default 'MEDIUM',
  status public.lead_status not null default 'OPEN',
  estimated_value numeric(14,2) not null default 0 check (estimated_value >= 0),
  expected_close_date date,
  next_follow_up_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists leads_company_stage_idx on public.leads(company_id, stage_id);
create index if not exists leads_company_owner_idx on public.leads(company_id, owner_employee_id);
create index if not exists leads_company_status_idx on public.leads(company_id, status);
create index if not exists leads_follow_up_idx on public.leads(company_id, next_follow_up_at);

create table if not exists public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  type public.activity_type not null default 'NOTE',
  body text not null check (char_length(trim(body)) >= 1),
  created_at timestamptz not null default now()
);
create index if not exists lead_activities_lead_idx on public.lead_activities(lead_id, created_at desc);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  assigned_employee_id uuid references public.employees(id) on delete set null,
  created_by_employee_id uuid references public.employees(id) on delete set null,
  title text not null check (char_length(trim(title)) >= 2),
  description text,
  due_at timestamptz,
  priority public.lead_priority not null default 'MEDIUM',
  status public.task_status not null default 'TODO',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_assignee_due_idx on public.tasks(company_id, assigned_employee_id, due_at);
create index if not exists tasks_lead_idx on public.tasks(lead_id);

create or replace function public.current_employee_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select e.id from public.employees e where e.user_id = (select auth.uid()) limit 1;
$$;
revoke execute on function public.current_employee_id() from public;
grant execute on function public.current_employee_id() to authenticated;

create or replace function public.can_manage_crm()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.role in ('SUPER_ADMIN','COMPANY_ADMIN','SALES_MANAGER','HR_ACCOUNTS') from public.profiles p where p.id = (select auth.uid())), false);
$$;
revoke execute on function public.can_manage_crm() from public;
grant execute on function public.can_manage_crm() to authenticated;

create or replace function public.seed_default_pipeline()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.pipeline_stages(company_id, name, position, color, is_closed) values
    (new.id, 'New', 0, 'blue', false),
    (new.id, 'Qualified', 1, 'teal', false),
    (new.id, 'Demo', 2, 'violet', false),
    (new.id, 'Proposal', 3, 'amber', false),
    (new.id, 'Won', 4, 'emerald', true),
    (new.id, 'Lost', 5, 'slate', true)
  on conflict (company_id, name) do nothing;
  return new;
end;
$$;
drop trigger if exists seed_default_pipeline on public.companies;
create trigger seed_default_pipeline after insert on public.companies for each row execute procedure public.seed_default_pipeline();

-- Seed stages for companies created before this migration.
insert into public.pipeline_stages(company_id, name, position, color, is_closed)
select c.id, s.name, s.position, s.color, s.is_closed
from public.companies c cross join (values
 ('New',0,'blue',false),('Qualified',1,'teal',false),('Demo',2,'violet',false),('Proposal',3,'amber',false),('Won',4,'emerald',true),('Lost',5,'slate',true)
) as s(name,position,color,is_closed)
on conflict (company_id, name) do nothing;

-- RLS
alter table public.pipeline_stages enable row level security;
alter table public.customers enable row level security;
alter table public.contacts enable row level security;
alter table public.leads enable row level security;
alter table public.lead_activities enable row level security;
alter table public.tasks enable row level security;

create policy pipeline_select on public.pipeline_stages for select to authenticated using (company_id = public.current_user_company_id());
create policy pipeline_manage on public.pipeline_stages for all to authenticated using (company_id = public.current_user_company_id() and public.can_manage_crm()) with check (company_id = public.current_user_company_id() and public.can_manage_crm());

create policy customers_select on public.customers for select to authenticated using (company_id = public.current_user_company_id() and (public.can_manage_crm() or owner_employee_id = public.current_employee_id() or owner_employee_id is null));
create policy customers_insert on public.customers for insert to authenticated with check (company_id = public.current_user_company_id() and (public.can_manage_crm() or owner_employee_id = public.current_employee_id() or owner_employee_id is null));
create policy customers_update on public.customers for update to authenticated using (company_id = public.current_user_company_id() and (public.can_manage_crm() or owner_employee_id = public.current_employee_id())) with check (company_id = public.current_user_company_id());
create policy customers_delete on public.customers for delete to authenticated using (company_id = public.current_user_company_id() and public.can_manage_crm());

create policy contacts_select on public.contacts for select to authenticated using (company_id = public.current_user_company_id());
create policy contacts_insert on public.contacts for insert to authenticated with check (company_id = public.current_user_company_id());
create policy contacts_update on public.contacts for update to authenticated using (company_id = public.current_user_company_id()) with check (company_id = public.current_user_company_id());
create policy contacts_delete on public.contacts for delete to authenticated using (company_id = public.current_user_company_id() and public.can_manage_crm());

create policy leads_select on public.leads for select to authenticated using (company_id = public.current_user_company_id() and (public.can_manage_crm() or owner_employee_id = public.current_employee_id() or owner_employee_id is null));
create policy leads_insert on public.leads for insert to authenticated with check (company_id = public.current_user_company_id() and (public.can_manage_crm() or owner_employee_id = public.current_employee_id() or owner_employee_id is null));
create policy leads_update on public.leads for update to authenticated using (company_id = public.current_user_company_id() and (public.can_manage_crm() or owner_employee_id = public.current_employee_id())) with check (company_id = public.current_user_company_id());
create policy leads_delete on public.leads for delete to authenticated using (company_id = public.current_user_company_id() and public.can_manage_crm());

create policy activities_select on public.lead_activities for select to authenticated using (company_id = public.current_user_company_id());
create policy activities_insert on public.lead_activities for insert to authenticated with check (company_id = public.current_user_company_id() and (public.can_manage_crm() or employee_id = public.current_employee_id()));
create policy activities_delete on public.lead_activities for delete to authenticated using (company_id = public.current_user_company_id() and public.can_manage_crm());

create policy tasks_select on public.tasks for select to authenticated using (company_id = public.current_user_company_id() and (public.can_manage_crm() or assigned_employee_id = public.current_employee_id() or created_by_employee_id = public.current_employee_id()));
create policy tasks_insert on public.tasks for insert to authenticated with check (company_id = public.current_user_company_id() and (public.can_manage_crm() or assigned_employee_id = public.current_employee_id()));
create policy tasks_update on public.tasks for update to authenticated using (company_id = public.current_user_company_id() and (public.can_manage_crm() or assigned_employee_id = public.current_employee_id())) with check (company_id = public.current_user_company_id());
create policy tasks_delete on public.tasks for delete to authenticated using (company_id = public.current_user_company_id() and public.can_manage_crm());

-- Relationship company guards.
create or replace function public.validate_crm_links()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_table_name = 'leads' then
    if not exists (select 1 from public.pipeline_stages p where p.id = new.stage_id and p.company_id = new.company_id) then raise exception 'Pipeline stage must belong to the same company'; end if;
    if new.owner_employee_id is not null and not exists (select 1 from public.employees e where e.id = new.owner_employee_id and e.company_id = new.company_id) then raise exception 'Lead owner must belong to the same company'; end if;
    if new.customer_id is not null and not exists (select 1 from public.customers c where c.id = new.customer_id and c.company_id = new.company_id) then raise exception 'Lead customer must belong to the same company'; end if;
  elsif tg_table_name = 'contacts' then
    if not exists (select 1 from public.customers c where c.id = new.customer_id and c.company_id = new.company_id) then raise exception 'Contact customer must belong to the same company'; end if;
  elsif tg_table_name = 'lead_activities' then
    if not exists (select 1 from public.leads l where l.id = new.lead_id and l.company_id = new.company_id) then raise exception 'Activity lead must belong to the same company'; end if;
  elsif tg_table_name = 'tasks' then
    if new.lead_id is not null and not exists (select 1 from public.leads l where l.id = new.lead_id and l.company_id = new.company_id) then raise exception 'Task lead must belong to the same company'; end if;
    if new.customer_id is not null and not exists (select 1 from public.customers c where c.id = new.customer_id and c.company_id = new.company_id) then raise exception 'Task customer must belong to the same company'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_lead_links on public.leads;
create trigger validate_lead_links before insert or update on public.leads for each row execute procedure public.validate_crm_links();
drop trigger if exists validate_contact_links on public.contacts;
create trigger validate_contact_links before insert or update on public.contacts for each row execute procedure public.validate_crm_links();
drop trigger if exists validate_activity_links on public.lead_activities;
create trigger validate_activity_links before insert or update on public.lead_activities for each row execute procedure public.validate_crm_links();
drop trigger if exists validate_task_links on public.tasks;
create trigger validate_task_links before insert or update on public.tasks for each row execute procedure public.validate_crm_links();
-- AURA FieldOS - Stage 5 Field Work
-- Attendance, work sessions, GPS pings and customer visits.
-- Run after 0001, 0002 and 0003.

do $$ begin
  create type public.attendance_status as enum ('PRESENT','LATE','HALF_DAY','ABSENT');
exception
  when duplicate_object then null;
end $$;
do $$ begin
  create type public.work_session_status as enum ('ACTIVE','PAUSED','ENDED');
exception
  when duplicate_object then null;
end $$;
do $$ begin
  create type public.visit_status as enum ('PLANNED','STARTED','COMPLETED','CANCELLED');
exception
  when duplicate_object then null;
end $$;

alter table public.customers
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists geofence_radius_m integer not null default 150;

alter table public.customers
  drop constraint if exists customers_latitude_check;
alter table public.customers
  add constraint customers_latitude_check check (latitude is null or latitude between -90 and 90);
alter table public.customers
  drop constraint if exists customers_longitude_check;
alter table public.customers
  add constraint customers_longitude_check check (longitude is null or longitude between -180 and 180);
alter table public.customers
  drop constraint if exists customers_geofence_radius_check;
alter table public.customers
  add constraint customers_geofence_radius_check check (geofence_radius_m between 25 and 1000);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  attendance_date date not null default current_date,
  status public.attendance_status not null default 'PRESENT',
  check_in_at timestamptz not null default now(),
  check_out_at timestamptz,
  check_in_latitude double precision,
  check_in_longitude double precision,
  check_out_latitude double precision,
  check_out_longitude double precision,
  check_in_accuracy_m double precision,
  check_out_accuracy_m double precision,
  check_in_note text,
  check_out_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, attendance_date)
);
create index if not exists attendance_company_date_idx on public.attendance(company_id, attendance_date desc);
create index if not exists attendance_employee_date_idx on public.attendance(employee_id, attendance_date desc);

create table if not exists public.work_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  attendance_id uuid references public.attendance(id) on delete set null,
  status public.work_session_status not null default 'ACTIVE',
  started_at timestamptz not null default now(),
  paused_at timestamptz,
  ended_at timestamptz,
  total_active_seconds integer not null default 0 check (total_active_seconds >= 0),
  start_latitude double precision,
  start_longitude double precision,
  end_latitude double precision,
  end_longitude double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists work_sessions_one_active_per_employee_idx
  on public.work_sessions(employee_id) where status = 'ACTIVE';
create index if not exists work_sessions_company_employee_idx on public.work_sessions(company_id, employee_id, started_at desc);

create table if not exists public.work_session_location_points (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  work_session_id uuid not null references public.work_sessions(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision,
  recorded_at timestamptz not null default now()
);
create index if not exists work_session_points_session_idx on public.work_session_location_points(work_session_id, recorded_at desc);

create table if not exists public.customer_visits (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  employee_id uuid not null references public.employees(id) on delete cascade,
  status public.visit_status not null default 'PLANNED',
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  check_in_latitude double precision,
  check_in_longitude double precision,
  check_in_accuracy_m double precision,
  check_in_distance_m double precision,
  geofence_verified boolean not null default false,
  outcome text,
  notes text,
  next_follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists visits_company_employee_idx on public.customer_visits(company_id, employee_id, scheduled_at desc);
create index if not exists visits_customer_idx on public.customer_visits(customer_id, scheduled_at desc);

create or replace function public.can_manage_field_work()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.role in ('SUPER_ADMIN','COMPANY_ADMIN','SALES_MANAGER','HR_ACCOUNTS') from public.profiles p where p.id = (select auth.uid())), false);
$$;
revoke execute on function public.can_manage_field_work() from public;
grant execute on function public.can_manage_field_work() to authenticated;

create or replace function public.haversine_meters(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
returns double precision language sql immutable set search_path = '' as $$
  select 6371000.0 * 2 * asin(sqrt(
    power(sin(radians(lat2-lat1)/2),2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2-lon1)/2),2)
  ));
$$;

-- RLS
alter table public.attendance enable row level security;
alter table public.work_sessions enable row level security;
alter table public.work_session_location_points enable row level security;
alter table public.customer_visits enable row level security;

create policy attendance_select on public.attendance for select to authenticated
using (company_id = public.current_user_company_id() and (public.can_manage_field_work() or employee_id = public.current_employee_id()));
create policy attendance_insert on public.attendance for insert to authenticated
with check (company_id = public.current_user_company_id() and (public.can_manage_field_work() or employee_id = public.current_employee_id()));
create policy attendance_update on public.attendance for update to authenticated
using (company_id = public.current_user_company_id() and (public.can_manage_field_work() or employee_id = public.current_employee_id()))
with check (company_id = public.current_user_company_id() and (public.can_manage_field_work() or employee_id = public.current_employee_id()));
create policy attendance_delete on public.attendance for delete to authenticated
using (company_id = public.current_user_company_id() and public.can_manage_field_work());

create policy work_sessions_select on public.work_sessions for select to authenticated
using (company_id = public.current_user_company_id() and (public.can_manage_field_work() or employee_id = public.current_employee_id()));
create policy work_sessions_insert on public.work_sessions for insert to authenticated
with check (company_id = public.current_user_company_id() and employee_id = public.current_employee_id());
create policy work_sessions_update on public.work_sessions for update to authenticated
using (company_id = public.current_user_company_id() and (public.can_manage_field_work() or employee_id = public.current_employee_id()))
with check (company_id = public.current_user_company_id() and (public.can_manage_field_work() or employee_id = public.current_employee_id()));

create policy work_points_select on public.work_session_location_points for select to authenticated
using (company_id = public.current_user_company_id() and (public.can_manage_field_work() or employee_id = public.current_employee_id()));
create policy work_points_insert on public.work_session_location_points for insert to authenticated
with check (company_id = public.current_user_company_id() and employee_id = public.current_employee_id());

create policy visits_select on public.customer_visits for select to authenticated
using (company_id = public.current_user_company_id() and (public.can_manage_field_work() or employee_id = public.current_employee_id()));
create policy visits_insert on public.customer_visits for insert to authenticated
with check (company_id = public.current_user_company_id() and (public.can_manage_field_work() or employee_id = public.current_employee_id()));
create policy visits_update on public.customer_visits for update to authenticated
using (company_id = public.current_user_company_id() and (public.can_manage_field_work() or employee_id = public.current_employee_id()))
with check (company_id = public.current_user_company_id() and (public.can_manage_field_work() or employee_id = public.current_employee_id()));
create policy visits_delete on public.customer_visits for delete to authenticated
using (company_id = public.current_user_company_id() and public.can_manage_field_work());

-- Prevent cross-company relationships at DB level.
create or replace function public.validate_field_work_links()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_table_name = 'attendance' then
    if not exists (select 1 from public.employees e where e.id = new.employee_id and e.company_id = new.company_id) then raise exception 'Attendance employee must belong to the same company'; end if;
  elsif tg_table_name = 'work_sessions' then
    if not exists (select 1 from public.employees e where e.id = new.employee_id and e.company_id = new.company_id) then raise exception 'Work session employee must belong to the same company'; end if;
  elsif tg_table_name = 'work_session_location_points' then
    if not exists (select 1 from public.work_sessions w where w.id = new.work_session_id and w.company_id = new.company_id and w.employee_id = new.employee_id) then raise exception 'Location point must belong to the same work session'; end if;
  elsif tg_table_name = 'customer_visits' then
    if not exists (select 1 from public.customers c where c.id = new.customer_id and c.company_id = new.company_id) then raise exception 'Visit customer must belong to the same company'; end if;
    if new.employee_id is not null and not exists (select 1 from public.employees e where e.id = new.employee_id and e.company_id = new.company_id) then raise exception 'Visit employee must belong to the same company'; end if;
    if new.lead_id is not null and not exists (select 1 from public.leads l where l.id = new.lead_id and l.company_id = new.company_id) then raise exception 'Visit lead must belong to the same company'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_attendance_links on public.attendance;
create trigger validate_attendance_links before insert or update on public.attendance for each row execute procedure public.validate_field_work_links();
drop trigger if exists validate_work_session_links on public.work_sessions;
create trigger validate_work_session_links before insert or update on public.work_sessions for each row execute procedure public.validate_field_work_links();
drop trigger if exists validate_work_point_links on public.work_session_location_points;
create trigger validate_work_point_links before insert or update on public.work_session_location_points for each row execute procedure public.validate_field_work_links();
drop trigger if exists validate_visit_links on public.customer_visits;
create trigger validate_visit_links before insert or update on public.customer_visits for each row execute procedure public.validate_field_work_links();
-- AURA FieldOS - Stage 6 Maps + Trips + Distance
-- Run after 0001-0004.

do $$ begin
  create type public.trip_status as enum ('ACTIVE','COMPLETED','CANCELLED');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  status public.trip_status not null default 'ACTIVE',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  start_latitude double precision not null,
  start_longitude double precision not null,
  end_latitude double precision,
  end_longitude double precision,
  distance_m double precision not null default 0 check (distance_m >= 0),
  purpose text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_latitude between -90 and 90),
  check (start_longitude between -180 and 180),
  check (end_latitude is null or end_latitude between -90 and 90),
  check (end_longitude is null or end_longitude between -180 and 180)
);

create unique index if not exists trips_one_active_per_employee_idx
  on public.trips(employee_id) where status = 'ACTIVE';
create index if not exists trips_company_employee_idx
  on public.trips(company_id, employee_id, started_at desc);

create table if not exists public.trip_points (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision,
  recorded_at timestamptz not null default now()
);
create index if not exists trip_points_trip_time_idx on public.trip_points(trip_id, recorded_at asc);
create index if not exists trip_points_company_time_idx on public.trip_points(company_id, recorded_at desc);

create or replace function public.can_manage_maps()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.role in ('SUPER_ADMIN','COMPANY_ADMIN','SALES_MANAGER','HR_ACCOUNTS') from public.profiles p where p.id = (select auth.uid())), false);
$$;
revoke execute on function public.can_manage_maps() from public;
grant execute on function public.can_manage_maps() to authenticated;

alter table public.trips enable row level security;
alter table public.trip_points enable row level security;

create policy trips_select on public.trips for select to authenticated
using (company_id = public.current_user_company_id() and (public.can_manage_maps() or employee_id = public.current_employee_id()));
create policy trips_insert on public.trips for insert to authenticated
with check (company_id = public.current_user_company_id() and employee_id = public.current_employee_id());
create policy trips_update on public.trips for update to authenticated
using (company_id = public.current_user_company_id() and (public.can_manage_maps() or employee_id = public.current_employee_id()))
with check (company_id = public.current_user_company_id() and (public.can_manage_maps() or employee_id = public.current_employee_id()));
create policy trips_delete on public.trips for delete to authenticated
using (company_id = public.current_user_company_id() and public.can_manage_maps());

create policy trip_points_select on public.trip_points for select to authenticated
using (company_id = public.current_user_company_id() and (public.can_manage_maps() or employee_id = public.current_employee_id()));
create policy trip_points_insert on public.trip_points for insert to authenticated
with check (company_id = public.current_user_company_id() and employee_id = public.current_employee_id());

create or replace function public.validate_trip_links()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.employees e where e.id = new.employee_id and e.company_id = new.company_id) then
    raise exception 'Trip employee must belong to the same company';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_trip_links on public.trips;
create trigger validate_trip_links before insert or update on public.trips
for each row execute procedure public.validate_trip_links();

drop trigger if exists validate_trip_point_links on public.trip_points;
create trigger validate_trip_point_links before insert or update on public.trip_points
for each row execute procedure public.validate_trip_links();

create or replace function public.validate_trip_point_relationship()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (
    select 1 from public.trips t
    where t.id = new.trip_id and t.company_id = new.company_id and t.employee_id = new.employee_id
  ) then
    raise exception 'Trip point must belong to the same trip and employee';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_trip_point_relationship on public.trip_points;
create trigger validate_trip_point_relationship before insert or update on public.trip_points
for each row execute procedure public.validate_trip_point_relationship();

-- Manager map queries can use the existing company-scoped RLS policies.
-- AURA FieldOS - Stage 7 Finance + Compensation
-- Expenses, deals/revenue, versioned compensation rules, targets, commissions and payouts.
-- Run after 0001-0005.

do $$ begin
  create type public.expense_status as enum ('SUBMITTED','APPROVED','REJECTED','PAID');
exception
  when duplicate_object then null;
end $$;
do $$ begin
  create type public.expense_category as enum ('TRAVEL','FUEL','MEALS','LODGING','PHONE','OFFICE','OTHER');
exception
  when duplicate_object then null;
end $$;
do $$ begin
  create type public.deal_status as enum ('OPEN','WON','LOST','CANCELLED');
exception
  when duplicate_object then null;
end $$;
do $$ begin
  create type public.compensation_rule_type as enum ('FIXED_SALARY','PER_DAY','FIXED_PLUS_INCENTIVE','COMMISSION','HYBRID');
exception
  when duplicate_object then null;
end $$;
do $$ begin
  create type public.commission_status as enum ('CALCULATED','APPROVED','PAID','VOID');
exception
  when duplicate_object then null;
end $$;
do $$ begin
  create type public.payout_status as enum ('DRAFT','READY','APPROVED','PAID','VOID');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  owner_employee_id uuid not null references public.employees(id) on delete restrict,
  title text not null check (char_length(trim(title)) >= 2),
  status public.deal_status not null default 'OPEN',
  revenue_amount numeric(14,2) not null default 0 check (revenue_amount >= 0),
  closed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists deals_company_owner_idx on public.deals(company_id, owner_employee_id, created_at desc);
create index if not exists deals_company_status_idx on public.deals(company_id, status, closed_at desc);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete set null,
  category public.expense_category not null default 'OTHER',
  status public.expense_status not null default 'SUBMITTED',
  expense_date date not null default current_date,
  amount numeric(14,2) not null check (amount > 0),
  approved_amount numeric(14,2) check (approved_amount is null or approved_amount >= 0),
  merchant text,
  description text not null check (char_length(trim(description)) >= 2),
  receipt_path text,
  latitude double precision,
  longitude double precision,
  submitted_at timestamptz not null default now(),
  reviewed_by_employee_id uuid references public.employees(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180)
);
create index if not exists expenses_company_employee_date_idx on public.expenses(company_id, employee_id, expense_date desc);
create index if not exists expenses_company_status_idx on public.expenses(company_id, status, submitted_at desc);

create table if not exists public.compensation_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (char_length(trim(name)) >= 2),
  version integer not null default 1 check (version > 0),
  rule_type public.compensation_rule_type not null,
  fixed_salary numeric(14,2) not null default 0 check (fixed_salary >= 0),
  daily_rate numeric(14,2) not null default 0 check (daily_rate >= 0),
  incentive_rate_percent numeric(7,4) not null default 0 check (incentive_rate_percent between 0 and 100),
  commission_rate_percent numeric(7,4) not null default 0 check (commission_rate_percent between 0 and 100),
  effective_from date not null,
  effective_to date,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name, version),
  check (effective_to is null or effective_to >= effective_from)
);
create index if not exists compensation_rules_company_effective_idx on public.compensation_rules(company_id, effective_from desc);

create table if not exists public.employee_compensation (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  rule_id uuid not null references public.compensation_rules(id) on delete restrict,
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);
create index if not exists employee_compensation_employee_idx on public.employee_compensation(employee_id, effective_from desc);
create unique index if not exists employee_compensation_one_active_idx
  on public.employee_compensation(employee_id) where effective_to is null;

create table if not exists public.targets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  revenue_target numeric(14,2) not null default 0 check (revenue_target >= 0),
  visit_target integer not null default 0 check (visit_target >= 0),
  deal_target integer not null default 0 check (deal_target >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (employee_id, period_start, period_end)
);
create index if not exists targets_company_period_idx on public.targets(company_id, period_start desc, period_end desc);

create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  rule_id uuid not null references public.compensation_rules(id) on delete restrict,
  revenue_amount numeric(14,2) not null check (revenue_amount >= 0),
  rate_percent numeric(7,4) not null check (rate_percent between 0 and 100),
  commission_amount numeric(14,2) not null check (commission_amount >= 0),
  status public.commission_status not null default 'CALCULATED',
  calculated_at timestamptz not null default now(),
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deal_id, rule_id)
);
create index if not exists commissions_company_employee_idx on public.commissions(company_id, employee_id, calculated_at desc);

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  base_amount numeric(14,2) not null default 0 check (base_amount >= 0),
  incentive_amount numeric(14,2) not null default 0 check (incentive_amount >= 0),
  commission_amount numeric(14,2) not null default 0 check (commission_amount >= 0),
  expense_reimbursement numeric(14,2) not null default 0 check (expense_reimbursement >= 0),
  deductions numeric(14,2) not null default 0 check (deductions >= 0),
  net_amount numeric(14,2) not null default 0 check (net_amount >= 0),
  status public.payout_status not null default 'DRAFT',
  approved_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (employee_id, period_start, period_end)
);
create index if not exists payouts_company_period_idx on public.payouts(company_id, period_start desc, period_end desc);

create or replace function public.can_manage_finance()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.role in ('SUPER_ADMIN','COMPANY_ADMIN','HR_ACCOUNTS') from public.profiles p where p.id = (select auth.uid())), false);
$$;
revoke execute on function public.can_manage_finance() from public;
grant execute on function public.can_manage_finance() to authenticated;

create or replace function public.can_review_expenses()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.role in ('SUPER_ADMIN','COMPANY_ADMIN','SALES_MANAGER','HR_ACCOUNTS') from public.profiles p where p.id = (select auth.uid())), false);
$$;
revoke execute on function public.can_review_expenses() from public;
grant execute on function public.can_review_expenses() to authenticated;

alter table public.deals enable row level security;
alter table public.expenses enable row level security;
alter table public.compensation_rules enable row level security;
alter table public.employee_compensation enable row level security;
alter table public.targets enable row level security;
alter table public.commissions enable row level security;
alter table public.payouts enable row level security;

create policy deals_select on public.deals for select to authenticated
using (company_id = public.current_user_company_id() and (public.can_manage_finance() or public.can_manage_crm() or owner_employee_id = public.current_employee_id()));
create policy deals_insert on public.deals for insert to authenticated
with check (company_id = public.current_user_company_id() and (public.can_manage_finance() or public.can_manage_crm() or owner_employee_id = public.current_employee_id()));
create policy deals_update on public.deals for update to authenticated
using (company_id = public.current_user_company_id() and (public.can_manage_finance() or public.can_manage_crm() or owner_employee_id = public.current_employee_id()))
with check (company_id = public.current_user_company_id());
create policy deals_delete on public.deals for delete to authenticated
using (company_id = public.current_user_company_id() and public.can_manage_finance());

create policy expenses_select on public.expenses for select to authenticated
using (company_id = public.current_user_company_id() and (public.can_review_expenses() or employee_id = public.current_employee_id()));
create policy expenses_insert on public.expenses for insert to authenticated
with check (company_id = public.current_user_company_id() and employee_id = public.current_employee_id());
create policy expenses_update on public.expenses for update to authenticated
using (company_id = public.current_user_company_id() and (public.can_review_expenses() or (employee_id = public.current_employee_id() and status = 'SUBMITTED')))
with check (company_id = public.current_user_company_id());
create policy expenses_delete on public.expenses for delete to authenticated
using (company_id = public.current_user_company_id() and employee_id = public.current_employee_id() and status = 'SUBMITTED');

create policy compensation_rules_select on public.compensation_rules for select to authenticated
using (company_id = public.current_user_company_id() and (public.can_manage_finance() or exists (select 1 from public.employee_compensation ec where ec.rule_id = compensation_rules.id and ec.employee_id = public.current_employee_id())));
create policy compensation_rules_manage on public.compensation_rules for all to authenticated
using (company_id = public.current_user_company_id() and public.can_manage_finance())
with check (company_id = public.current_user_company_id() and public.can_manage_finance());

create policy employee_compensation_select on public.employee_compensation for select to authenticated
using (company_id = public.current_user_company_id() and (public.can_manage_finance() or employee_id = public.current_employee_id()));
create policy employee_compensation_manage on public.employee_compensation for all to authenticated
using (company_id = public.current_user_company_id() and public.can_manage_finance())
with check (company_id = public.current_user_company_id() and public.can_manage_finance());

create policy targets_select on public.targets for select to authenticated
using (company_id = public.current_user_company_id() and (public.can_manage_finance() or public.can_manage_crm() or employee_id = public.current_employee_id()));
create policy targets_manage on public.targets for all to authenticated
using (company_id = public.current_user_company_id() and (public.can_manage_finance() or public.can_manage_crm()))
with check (company_id = public.current_user_company_id() and (public.can_manage_finance() or public.can_manage_crm()));

create policy commissions_select on public.commissions for select to authenticated
using (company_id = public.current_user_company_id() and (public.can_manage_finance() or employee_id = public.current_employee_id()));
create policy commissions_manage on public.commissions for all to authenticated
using (company_id = public.current_user_company_id() and public.can_manage_finance())
with check (company_id = public.current_user_company_id() and public.can_manage_finance());

create policy payouts_select on public.payouts for select to authenticated
using (company_id = public.current_user_company_id() and (public.can_manage_finance() or employee_id = public.current_employee_id()));
create policy payouts_manage on public.payouts for all to authenticated
using (company_id = public.current_user_company_id() and public.can_manage_finance())
with check (company_id = public.current_user_company_id() and public.can_manage_finance());

create or replace function public.validate_finance_links()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_table_name = 'deals' then
    if not exists (select 1 from public.employees e where e.id = new.owner_employee_id and e.company_id = new.company_id) then raise exception 'Deal owner must belong to the same company'; end if;
    if new.customer_id is not null and not exists (select 1 from public.customers c where c.id = new.customer_id and c.company_id = new.company_id) then raise exception 'Deal customer must belong to the same company'; end if;
    if new.lead_id is not null and not exists (select 1 from public.leads l where l.id = new.lead_id and l.company_id = new.company_id) then raise exception 'Deal lead must belong to the same company'; end if;
  elsif tg_table_name = 'expenses' then
    if not exists (select 1 from public.employees e where e.id = new.employee_id and e.company_id = new.company_id) then raise exception 'Expense employee must belong to the same company'; end if;
    if new.trip_id is not null and not exists (select 1 from public.trips t where t.id = new.trip_id and t.company_id = new.company_id and t.employee_id = new.employee_id) then raise exception 'Expense trip must belong to the same company and employee'; end if;
    if new.reviewed_by_employee_id is not null and not exists (select 1 from public.employees e where e.id = new.reviewed_by_employee_id and e.company_id = new.company_id) then raise exception 'Reviewer must belong to the same company'; end if;
  elsif tg_table_name = 'employee_compensation' then
    if not exists (select 1 from public.employees e where e.id = new.employee_id and e.company_id = new.company_id) then raise exception 'Compensation employee must belong to the same company'; end if;
    if not exists (select 1 from public.compensation_rules r where r.id = new.rule_id and r.company_id = new.company_id) then raise exception 'Compensation rule must belong to the same company'; end if;
  elsif tg_table_name = 'targets' then
    if not exists (select 1 from public.employees e where e.id = new.employee_id and e.company_id = new.company_id) then raise exception 'Target employee must belong to the same company'; end if;
  elsif tg_table_name = 'commissions' then
    if not exists (select 1 from public.employees e where e.id = new.employee_id and e.company_id = new.company_id) then raise exception 'Commission employee must belong to the same company'; end if;
    if not exists (select 1 from public.deals d where d.id = new.deal_id and d.company_id = new.company_id and d.owner_employee_id = new.employee_id) then raise exception 'Commission deal must belong to the same employee and company'; end if;
    if not exists (select 1 from public.compensation_rules r where r.id = new.rule_id and r.company_id = new.company_id) then raise exception 'Commission rule must belong to the same company'; end if;
  elsif tg_table_name = 'payouts' then
    if not exists (select 1 from public.employees e where e.id = new.employee_id and e.company_id = new.company_id) then raise exception 'Payout employee must belong to the same company'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_deal_links on public.deals;
create trigger validate_deal_links before insert or update on public.deals for each row execute procedure public.validate_finance_links();
drop trigger if exists validate_expense_links on public.expenses;
create trigger validate_expense_links before insert or update on public.expenses for each row execute procedure public.validate_finance_links();
drop trigger if exists validate_employee_compensation_links on public.employee_compensation;
create trigger validate_employee_compensation_links before insert or update on public.employee_compensation for each row execute procedure public.validate_finance_links();
drop trigger if exists validate_target_links on public.targets;
create trigger validate_target_links before insert or update on public.targets for each row execute procedure public.validate_finance_links();
drop trigger if exists validate_commission_links on public.commissions;
create trigger validate_commission_links before insert or update on public.commissions for each row execute procedure public.validate_finance_links();
drop trigger if exists validate_payout_links on public.payouts;
create trigger validate_payout_links before insert or update on public.payouts for each row execute procedure public.validate_finance_links();

-- Historical commission calculation: snapshot the rule/rate into the commission row.
-- This intentionally does not overwrite old commissions when a new rule version is created.
create or replace function public.calculate_commission(p_deal_id uuid, p_rule_id uuid)
returns numeric language plpgsql security definer set search_path = '' as $$
declare
  v_revenue numeric(14,2);
  v_rate numeric(7,4);
  v_amount numeric(14,2);
begin
  select d.revenue_amount, r.commission_rate_percent
    into v_revenue, v_rate
  from public.deals d
  join public.compensation_rules r on r.id = p_rule_id and r.company_id = d.company_id
  where d.id = p_deal_id and d.status = 'WON';
  if v_revenue is null then raise exception 'Only won deals can generate commission'; end if;
  v_amount := round(v_revenue * v_rate / 100, 2);
  return v_amount;
end;
$$;
revoke execute on function public.calculate_commission(uuid, uuid) from public;
grant execute on function public.calculate_commission(uuid, uuid) to authenticated;
-- AURA FieldOS - Stage 10
-- Realtime notifications and event triggers.
-- Run after 0001 -> 0006.

do $$ begin
  create type public.notification_type as enum (
  'LEAD_ASSIGNED',
  'TASK_ASSIGNED',
  'VISIT_PLANNED',
  'EXPENSE_REVIEWED',
  'COMMISSION_CREATED',
  'SYSTEM'
);
exception
  when duplicate_object then null;
end $$;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.notification_type not null,
  title text not null check (char_length(trim(title)) >= 2),
  body text not null default '',
  href text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);
create index if not exists notifications_company_idx
  on public.notifications(company_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications(user_id, read_at, created_at desc);

alter table public.notifications enable row level security;

create policy notifications_select_own
on public.notifications
for select
to authenticated
using (
  user_id = (select auth.uid())
  and company_id = public.current_user_company_id()
);

create policy notifications_update_own
on public.notifications
for update
to authenticated
using (
  user_id = (select auth.uid())
  and company_id = public.current_user_company_id()
)
with check (
  user_id = (select auth.uid())
  and company_id = public.current_user_company_id()
);

-- Notifications are created by trusted database triggers, not by the browser.
-- This prevents a client from impersonating another recipient.

create or replace function public.create_notification(
  p_company_id uuid,
  p_user_id uuid,
  p_type public.notification_type,
  p_title text,
  p_body text,
  p_href text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_company_id is null or p_user_id is null then
    return;
  end if;

  insert into public.notifications (
    company_id, user_id, type, title, body, href, metadata
  ) values (
    p_company_id,
    p_user_id,
    p_type,
    trim(p_title),
    coalesce(trim(p_body), ''),
    p_href,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.create_notification(uuid, uuid, public.notification_type, text, text, text, jsonb) from public;

-- Lead assignment notifications.
create or replace function public.notify_lead_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_name text;
  v_href text;
begin
  if new.owner_employee_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.owner_employee_id is not distinct from old.owner_employee_id then
    return new;
  end if;

  select e.user_id, e.full_name
    into v_user_id, v_name
  from public.employees e
  where e.id = new.owner_employee_id
    and e.company_id = new.company_id
    and e.status = 'ACTIVE';

  if v_user_id is not null then
    v_href := '/leads';
    perform public.create_notification(
      new.company_id,
      v_user_id,
      'LEAD_ASSIGNED',
      'New lead assigned',
      coalesce(new.title, 'A new lead needs your attention.'),
      v_href,
      jsonb_build_object('lead_id', new.id, 'owner_name', v_name)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists notify_lead_assignment on public.leads;
create trigger notify_lead_assignment
after insert or update of owner_employee_id on public.leads
for each row execute procedure public.notify_lead_assignment();

-- Task assignment notifications.
create or replace function public.notify_task_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if new.assigned_employee_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.assigned_employee_id is not distinct from old.assigned_employee_id then
    return new;
  end if;

  select e.user_id into v_user_id
  from public.employees e
  where e.id = new.assigned_employee_id
    and e.company_id = new.company_id
    and e.status = 'ACTIVE';

  if v_user_id is not null then
    perform public.create_notification(
      new.company_id,
      v_user_id,
      'TASK_ASSIGNED',
      'Task assigned to you',
      coalesce(new.title, 'A new task needs your attention.'),
      '/field',
      jsonb_build_object('task_id', new.id)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists notify_task_assignment on public.tasks;
create trigger notify_task_assignment
after insert or update of assigned_employee_id on public.tasks
for each row execute procedure public.notify_task_assignment();

-- Visit planning notifications.
create or replace function public.notify_visit_planned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_customer_name text;
begin
  select e.user_id into v_user_id
  from public.employees e
  where e.id = new.employee_id
    and e.company_id = new.company_id
    and e.status = 'ACTIVE';

  select c.name into v_customer_name
  from public.customers c
  where c.id = new.customer_id
    and c.company_id = new.company_id;

  if v_user_id is not null then
    perform public.create_notification(
      new.company_id,
      v_user_id,
      'VISIT_PLANNED',
      'Customer visit planned',
      coalesce(v_customer_name, 'A customer visit has been scheduled.'),
      '/visits/' || new.id::text,
      jsonb_build_object('visit_id', new.id, 'customer_id', new.customer_id)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists notify_visit_planned on public.customer_visits;
create trigger notify_visit_planned
after insert on public.customer_visits
for each row execute procedure public.notify_visit_planned();

-- Expense review notifications.
create or replace function public.notify_expense_reviewed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_text text;
begin
  if new.status not in ('APPROVED', 'REJECTED') then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  select e.user_id into v_user_id
  from public.employees e
  where e.id = new.employee_id
    and e.company_id = new.company_id;

  if v_user_id is not null then
    v_text := case when new.status = 'APPROVED'
      then 'Your expense has been approved.'
      else 'Your expense has been rejected.'
    end;

    perform public.create_notification(
      new.company_id,
      v_user_id,
      'EXPENSE_REVIEWED',
      case when new.status = 'APPROVED' then 'Expense approved' else 'Expense rejected' end,
      v_text,
      '/expenses',
      jsonb_build_object('expense_id', new.id, 'status', new.status, 'approved_amount', new.approved_amount)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists notify_expense_reviewed on public.expenses;
create trigger notify_expense_reviewed
after update of status on public.expenses
for each row execute procedure public.notify_expense_reviewed();

-- Commission creation notifications.
create or replace function public.notify_commission_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  select e.user_id into v_user_id
  from public.employees e
  where e.id = new.employee_id
    and e.company_id = new.company_id;

  if v_user_id is not null then
    perform public.create_notification(
      new.company_id,
      v_user_id,
      'COMMISSION_CREATED',
      'Commission generated',
      'A new commission has been recorded for your sale.',
      '/commissions',
      jsonb_build_object('commission_id', new.id, 'commission_amount', new.commission_amount)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists notify_commission_created on public.commissions;
create trigger notify_commission_created
after insert on public.commissions
for each row execute procedure public.notify_commission_created();

-- Enable persisted notification INSERT events for Realtime.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;

comment on table public.notifications is 'Persisted user notifications. Realtime clients subscribe only to their own user_id rows.';
-- AURA FieldOS - Stage 11 Mobile devices
-- Run after 0001 -> 0007.

create table if not exists public.mobile_devices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('ios','android','web')),
  device_name text,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

create index if not exists mobile_devices_user_idx on public.mobile_devices(user_id, is_active);
create index if not exists mobile_devices_company_idx on public.mobile_devices(company_id, is_active);

alter table public.mobile_devices enable row level security;

create policy mobile_devices_select_own
on public.mobile_devices
for select to authenticated
using (user_id = (select auth.uid()) and company_id = public.current_user_company_id());

create policy mobile_devices_insert_own
on public.mobile_devices
for insert to authenticated
with check (user_id = (select auth.uid()) and company_id = public.current_user_company_id());

create policy mobile_devices_update_own
on public.mobile_devices
for update to authenticated
using (user_id = (select auth.uid()) and company_id = public.current_user_company_id())
with check (user_id = (select auth.uid()) and company_id = public.current_user_company_id());

create policy mobile_devices_delete_own
on public.mobile_devices
for delete to authenticated
using (user_id = (select auth.uid()) and company_id = public.current_user_company_id());

create or replace function public.set_mobile_device_company_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id <> (select auth.uid()) then
    raise exception 'Device must belong to the authenticated user';
  end if;

  new.company_id := public.current_user_company_id();
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_mobile_device_company_id() from public;
grant execute on function public.set_mobile_device_company_id() to authenticated;

drop trigger if exists set_mobile_device_company_id on public.mobile_devices;
create trigger set_mobile_device_company_id
before insert or update on public.mobile_devices
for each row execute procedure public.set_mobile_device_company_id();
-- AURA FieldOS Stage 12: production hardening
-- Adds operational indexes, audit logging, and safer database defaults.

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_employee_id uuid references public.employees(id) on delete set null,
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  table_name text not null,
  record_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_company_created
  on public.audit_logs(company_id, created_at desc);
create index if not exists idx_audit_logs_actor_created
  on public.audit_logs(actor_user_id, created_at desc);
create index if not exists idx_audit_logs_record
  on public.audit_logs(table_name, record_id);

alter table public.audit_logs enable row level security;

create policy audit_logs_select_authorized
on public.audit_logs for select to authenticated
using (
  company_id = public.current_user_company_id()
  and public.can_manage_company_people()
);

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_company_id uuid;
  v_record_id uuid;
  v_employee_id uuid;
begin
  if tg_op = 'DELETE' then
    v_company_id := old.company_id;
    v_record_id := old.id;
  else
    v_company_id := new.company_id;
    v_record_id := new.id;
  end if;

  if v_company_id is null then
    return coalesce(new, old);
  end if;

  select e.id into v_employee_id
  from public.employees e
  where e.user_id = auth.uid()
    and e.company_id = v_company_id
  limit 1;

  insert into public.audit_logs (
    company_id, actor_user_id, actor_employee_id,
    action, table_name, record_id
  ) values (
    v_company_id, auth.uid(), v_employee_id,
    tg_op, tg_table_name, v_record_id
  );

  return coalesce(new, old);
end;
$$;

revoke all on function public.write_audit_log() from public;

drop trigger if exists audit_employees on public.employees;
create trigger audit_employees
after insert or update or delete on public.employees
for each row execute function public.write_audit_log();

drop trigger if exists audit_teams on public.teams;
create trigger audit_teams
after insert or update or delete on public.teams
for each row execute function public.write_audit_log();

drop trigger if exists audit_leads on public.leads;
create trigger audit_leads
after insert or update or delete on public.leads
for each row execute function public.write_audit_log();

drop trigger if exists audit_tasks on public.tasks;
create trigger audit_tasks
after insert or update or delete on public.tasks
for each row execute function public.write_audit_log();

drop trigger if exists audit_visits on public.customer_visits;
create trigger audit_visits
after insert or update or delete on public.customer_visits
for each row execute function public.write_audit_log();

drop trigger if exists audit_trips on public.trips;
create trigger audit_trips
after insert or update or delete on public.trips
for each row execute function public.write_audit_log();

drop trigger if exists audit_expenses on public.expenses;
create trigger audit_expenses
after insert or update or delete on public.expenses
for each row execute function public.write_audit_log();

drop trigger if exists audit_deals on public.deals;
create trigger audit_deals
after insert or update or delete on public.deals
for each row execute function public.write_audit_log();

drop trigger if exists audit_commissions on public.commissions;
create trigger audit_commissions
after insert or update or delete on public.commissions
for each row execute function public.write_audit_log();

drop trigger if exists audit_payouts on public.payouts;
create trigger audit_payouts
after insert or update or delete on public.payouts
for each row execute function public.write_audit_log();

-- Query-performance indexes for the most common tenant and date filters.
create index if not exists idx_employees_company_status on public.employees(company_id, status);
create index if not exists idx_teams_company_name on public.teams(company_id, name);
create index if not exists idx_leads_company_stage on public.leads(company_id, stage_id);
create index if not exists idx_leads_company_owner on public.leads(company_id, owner_employee_id);
create index if not exists idx_leads_company_created on public.leads(company_id, created_at desc);
create index if not exists idx_tasks_company_due on public.tasks(company_id, due_at);
create index if not exists idx_visits_company_scheduled on public.customer_visits(company_id, scheduled_at desc);
create index if not exists idx_visits_company_employee on public.customer_visits(company_id, employee_id);
create index if not exists idx_attendance_company_date on public.attendance(company_id, attendance_date desc);
create index if not exists idx_sessions_company_employee on public.work_sessions(company_id, employee_id, started_at desc);
create index if not exists idx_trips_company_employee on public.trips(company_id, employee_id, started_at desc);
create index if not exists idx_expenses_company_status on public.expenses(company_id, status, submitted_at desc);
create index if not exists idx_deals_company_closed on public.deals(company_id, closed_at desc);
create index if not exists idx_commissions_company_employee on public.commissions(company_id, employee_id, created_at desc);
create index if not exists idx_payouts_company_employee on public.payouts(company_id, employee_id, period_start desc);

-- Protect audit records from direct client writes.
revoke insert, update, delete on public.audit_logs from authenticated, anon;
-- AURA FieldOS - Stage 13: Quest & Reward Engine
-- Turns meaningful field-work completions into measurable progress and company-configured rewards.
-- India-first; reward budgets and redemption remain company-controlled.

alter table public.tasks
  add column if not exists task_type text not null default 'GENERAL'
  check (task_type in ('GENERAL','CALL','FOLLOW_UP','MEETING','DEMO','PROPOSAL','VISIT','OTHER'));

create index if not exists idx_tasks_company_assignee_type
  on public.tasks(company_id, assigned_employee_id, task_type, status, due_at);

create table if not exists public.reward_catalog (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (char_length(trim(name)) >= 2),
  description text,
  icon text not null default 'gift',
  cost_inr numeric(10,2) not null default 0 check (cost_inr >= 0),
  stock_remaining integer check (stock_remaining is null or stock_remaining >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_reward_catalog_company_active
  on public.reward_catalog(company_id, active, created_at desc);

create table if not exists public.reward_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (char_length(trim(name)) >= 2),
  trigger_type text not null check (trigger_type in ('TASK_COMPLETED','VISIT_COMPLETED','DAILY_GOAL','WEEKLY_GOAL','STREAK')),
  task_type text check (task_type is null or task_type in ('GENERAL','CALL','FOLLOW_UP','MEETING','DEMO','PROPOSAL','VISIT','OTHER')),
  reward_id uuid references public.reward_catalog(id) on delete set null,
  xp_amount integer not null default 25 check (xp_amount between 0 and 10000),
  priority integer not null default 100 check (priority >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id, name)
);
create index if not exists idx_reward_rules_company_trigger
  on public.reward_rules(company_id, trigger_type, task_type, active, priority);

create table if not exists public.employee_gamification (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  xp_total integer not null default 0 check (xp_total >= 0),
  level integer not null default 1 check (level >= 1),
  current_streak integer not null default 0 check (current_streak >= 0),
  best_streak integer not null default 0 check (best_streak >= 0),
  tasks_completed integer not null default 0 check (tasks_completed >= 0),
  visits_completed integer not null default 0 check (visits_completed >= 0),
  last_completion_date date,
  updated_at timestamptz not null default now()
);
create index if not exists idx_employee_gamification_company_xp
  on public.employee_gamification(company_id, xp_total desc);

create table if not exists public.reward_claims (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  reward_id uuid not null references public.reward_catalog(id) on delete restrict,
  rule_id uuid references public.reward_rules(id) on delete set null,
  source_type text not null check (source_type in ('TASK','VISIT','DAILY_GOAL','WEEKLY_GOAL','STREAK')),
  source_id uuid,
  status text not null default 'UNLOCKED' check (status in ('UNLOCKED','REDEEMED','EXPIRED')),
  redemption_code text not null unique,
  unlocked_at timestamptz not null default now(),
  redeemed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_reward_claims_employee_status
  on public.reward_claims(employee_id, status, unlocked_at desc);
create index if not exists idx_reward_claims_company_created
  on public.reward_claims(company_id, created_at desc);
create unique index if not exists uq_reward_claims_source
  on public.reward_claims(employee_id, rule_id, source_type, source_id)
  where source_id is not null;

alter table public.reward_catalog enable row level security;
alter table public.reward_rules enable row level security;
alter table public.employee_gamification enable row level security;
alter table public.reward_claims enable row level security;

create policy reward_catalog_select on public.reward_catalog for select to authenticated
using (company_id = public.current_user_company_id());
create policy reward_catalog_manage on public.reward_catalog for all to authenticated
using (company_id = public.current_user_company_id() and public.can_manage_company_people())
with check (company_id = public.current_user_company_id() and public.can_manage_company_people());

create policy reward_rules_select on public.reward_rules for select to authenticated
using (company_id = public.current_user_company_id());
create policy reward_rules_manage on public.reward_rules for all to authenticated
using (company_id = public.current_user_company_id() and public.can_manage_company_people())
with check (company_id = public.current_user_company_id() and public.can_manage_company_people());

create policy employee_gamification_select on public.employee_gamification for select to authenticated
using (
  company_id = public.current_user_company_id()
  and (employee_id = public.current_employee_id() or public.can_manage_company_people())
);

create policy reward_claims_select on public.reward_claims for select to authenticated
using (
  company_id = public.current_user_company_id()
  and (employee_id = public.current_employee_id() or public.can_manage_company_people())
);

-- No browser insert/update/delete policies for gamification or claims.
-- The server-side function below is the only way to create progress/reward state.
revoke insert, update, delete on public.employee_gamification from authenticated, anon;
revoke insert, update, delete on public.reward_claims from authenticated, anon;

create or replace function public.complete_task_with_rewards(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_task public.tasks%rowtype;
  v_employee public.employees%rowtype;
  v_rule public.reward_rules%rowtype;
  v_reward public.reward_catalog%rowtype;
  v_claim public.reward_claims%rowtype;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_xp integer := 25;
  v_total_xp integer;
  v_level integer;
  v_streak integer;
  v_best_streak integer;
  v_code text;
  v_reward_name text := null;
  v_reward_cost numeric := null;
begin
  select t.* into v_task
  from public.tasks t
  where t.id = p_task_id
    and t.company_id = public.current_user_company_id()
  for update;

  if v_task.id is null then
    raise exception 'Task not found or outside your company';
  end if;

  if v_task.assigned_employee_id is null then
    raise exception 'Only assigned tasks can earn quest rewards';
  end if;

  select e.* into v_employee
  from public.employees e
  where e.id = v_task.assigned_employee_id
    and e.company_id = v_task.company_id;

  if v_employee.id is null then
    raise exception 'Task employee is invalid';
  end if;

  if not (v_employee.user_id = auth.uid() or public.can_manage_crm()) then
    raise exception 'You are not allowed to complete this task';
  end if;

  if v_task.status = 'DONE' then
    select rc.* into v_claim
    from public.reward_claims rc
    where rc.employee_id = v_employee.id
      and rc.source_type = 'TASK'
      and rc.source_id = v_task.id
    order by rc.created_at desc
    limit 1;

    select coalesce(eg.xp_total, 0), coalesce(eg.level, 1), coalesce(eg.current_streak, 0), coalesce(eg.best_streak, 0)
      into v_total_xp, v_level, v_streak, v_best_streak
    from public.employee_gamification eg
    where eg.employee_id = v_employee.id;

    return jsonb_build_object(
      'already_completed', true,
      'xp_earned', 0,
      'xp_total', coalesce(v_total_xp, 0),
      'level', coalesce(v_level, 1),
      'streak', coalesce(v_streak, 0),
      'reward_name', case when v_claim.reward_id is not null then (select name from public.reward_catalog where id = v_claim.reward_id) else null end,
      'redemption_code', v_claim.redemption_code
    );
  end if;

  update public.tasks
  set status = 'DONE', completed_at = now(), updated_at = now()
  where id = v_task.id;

  select rr.* into v_rule
  from public.reward_rules rr
  where rr.company_id = v_task.company_id
    and rr.active = true
    and rr.trigger_type = 'TASK_COMPLETED'
    and (rr.task_type is null or rr.task_type = v_task.task_type)
  order by case when rr.task_type = v_task.task_type then 0 else 1 end, rr.priority asc, rr.created_at asc
  limit 1;

  if v_rule.id is not null then
    v_xp := greatest(0, v_rule.xp_amount);
    if v_rule.reward_id is not null then
      select rc.* into v_reward
      from public.reward_catalog rc
      where rc.id = v_rule.reward_id
        and rc.company_id = v_task.company_id
        and rc.active = true
      for update;

      if v_reward.id is not null and (v_reward.stock_remaining is null or v_reward.stock_remaining > 0) then
        v_code := 'AURA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
        insert into public.reward_claims (
          company_id, employee_id, reward_id, rule_id, source_type, source_id,
          status, redemption_code, expires_at
        ) values (
          v_task.company_id, v_employee.id, v_reward.id, v_rule.id, 'TASK', v_task.id,
          'UNLOCKED', v_code, now() + interval '30 days'
        ) on conflict (employee_id, rule_id, source_type, source_id) where source_id is not null do nothing
        returning * into v_claim;

        if v_claim.id is not null then
          if v_reward.stock_remaining is not null then
            update public.reward_catalog set stock_remaining = stock_remaining - 1, updated_at = now() where id = v_reward.id;
          end if;
          v_reward_name := v_reward.name;
          v_reward_cost := v_reward.cost_inr;
        end if;
      end if;
    end if;
  end if;

  select coalesce(eg.current_streak, 0), coalesce(eg.best_streak, 0), coalesce(eg.xp_total, 0)
    into v_streak, v_best_streak, v_total_xp
  from public.employee_gamification eg
  where eg.employee_id = v_employee.id
  for update;

  if v_streak is null then
    v_streak := 0; v_best_streak := 0; v_total_xp := 0;
  end if;

  if exists (select 1 from public.employee_gamification eg where eg.employee_id = v_employee.id and eg.last_completion_date = v_today) then
    v_streak := greatest(v_streak, 1);
  elsif exists (select 1 from public.employee_gamification eg where eg.employee_id = v_employee.id and eg.last_completion_date = v_today - 1) then
    v_streak := v_streak + 1;
  else
    v_streak := 1;
  end if;

  v_total_xp := v_total_xp + v_xp;
  v_level := greatest(1, floor(sqrt(v_total_xp::numeric / 100))::integer + 1);
  v_best_streak := greatest(v_best_streak, v_streak);

  insert into public.employee_gamification (
    employee_id, company_id, xp_total, level, current_streak, best_streak,
    tasks_completed, visits_completed, last_completion_date, updated_at
  ) values (
    v_employee.id, v_task.company_id, v_total_xp, v_level, v_streak, v_best_streak,
    1, 0, v_today, now()
  )
  on conflict (employee_id) do update set
    xp_total = excluded.xp_total,
    level = excluded.level,
    current_streak = excluded.current_streak,
    best_streak = excluded.best_streak,
    tasks_completed = public.employee_gamification.tasks_completed + 1,
    last_completion_date = excluded.last_completion_date,
    updated_at = now();

  return jsonb_build_object(
    'already_completed', false,
    'xp_earned', v_xp,
    'xp_total', v_total_xp,
    'level', v_level,
    'streak', v_streak,
    'reward_name', v_reward_name,
    'reward_cost_inr', v_reward_cost,
    'redemption_code', case when v_claim.id is not null then v_claim.redemption_code else null end
  );
end;
$$;

revoke all on function public.complete_task_with_rewards(uuid) from public;
grant execute on function public.complete_task_with_rewards(uuid) to authenticated;

drop trigger if exists audit_reward_catalog on public.reward_catalog;
create trigger audit_reward_catalog after insert or update or delete on public.reward_catalog for each row execute function public.write_audit_log();
drop trigger if exists audit_reward_rules on public.reward_rules;
create trigger audit_reward_rules after insert or update or delete on public.reward_rules for each row execute function public.write_audit_log();

-- Seed a practical starting catalog/rule for existing companies.
-- Managers can edit/disable these records after migration.
insert into public.reward_catalog(company_id, name, description, icon, cost_inr)
select c.id, 'Refreshment', 'A small refreshment after a verified customer meeting.', 'cup-soda', 20
from public.companies c
where not exists (
  select 1 from public.reward_catalog r where r.company_id = c.id and r.name = 'Refreshment'
);

insert into public.reward_rules(company_id, name, trigger_type, task_type, reward_id, xp_amount, priority)
select r.company_id, 'Meeting completed · Refreshment', 'TASK_COMPLETED', 'MEETING', r.id, 60, 10
from public.reward_catalog r
where r.name = 'Refreshment'
  and not exists (
    select 1 from public.reward_rules rr
    where rr.company_id = r.company_id and rr.name = 'Meeting completed · Refreshment'
  );

create or replace function public.complete_visit_with_rewards(p_visit_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_visit public.customer_visits%rowtype;
  v_employee public.employees%rowtype;
  v_rule public.reward_rules%rowtype;
  v_reward public.reward_catalog%rowtype;
  v_claim public.reward_claims%rowtype;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_xp integer := 40;
  v_total_xp integer := 0;
  v_level integer := 1;
  v_streak integer := 1;
  v_best_streak integer := 1;
  v_reward_name text := null;
  v_reward_cost numeric := null;
  v_code text;
begin
  select v.* into v_visit
  from public.customer_visits v
  where v.id = p_visit_id
    and v.company_id = public.current_user_company_id()
  for update;
  if v_visit.id is null then raise exception 'Visit not found or outside your company'; end if;
  if v_visit.employee_id is null then raise exception 'Visit employee is invalid'; end if;
  select e.* into v_employee from public.employees e where e.id = v_visit.employee_id and e.company_id = v_visit.company_id;
  if not (v_employee.user_id = auth.uid() or public.can_manage_field_work()) then raise exception 'You are not allowed to complete this visit'; end if;
  if v_visit.status <> 'COMPLETED' then raise exception 'Visit must be completed before rewards are unlocked'; end if;
  if not v_visit.geofence_verified then raise exception 'A GPS-verified visit is required for a visit reward'; end if;

  select rr.* into v_rule
  from public.reward_rules rr
  where rr.company_id = v_visit.company_id and rr.active = true and rr.trigger_type = 'VISIT_COMPLETED'
  order by rr.priority asc, rr.created_at asc limit 1;

  if v_rule.id is not null then
    v_xp := greatest(0, v_rule.xp_amount);
    if v_rule.reward_id is not null then
      select rc.* into v_reward from public.reward_catalog rc
      where rc.id = v_rule.reward_id and rc.company_id = v_visit.company_id and rc.active = true
      for update;
      if v_reward.id is not null and (v_reward.stock_remaining is null or v_reward.stock_remaining > 0) then
        v_code := 'AURA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
        insert into public.reward_claims(company_id, employee_id, reward_id, rule_id, source_type, source_id, status, redemption_code, expires_at)
        values(v_visit.company_id, v_employee.id, v_reward.id, v_rule.id, 'VISIT', v_visit.id, 'UNLOCKED', v_code, now() + interval '30 days')
        on conflict (employee_id, rule_id, source_type, source_id) where source_id is not null do nothing
        returning * into v_claim;
        if v_claim.id is not null then
          if v_reward.stock_remaining is not null then update public.reward_catalog set stock_remaining = stock_remaining - 1, updated_at = now() where id = v_reward.id; end if;
          v_reward_name := v_reward.name; v_reward_cost := v_reward.cost_inr;
        end if;
      end if;
    end if;
  end if;

  select coalesce(eg.current_streak, 0), coalesce(eg.best_streak, 0), coalesce(eg.xp_total, 0)
  into v_streak, v_best_streak, v_total_xp
  from public.employee_gamification eg where eg.employee_id = v_employee.id for update;
  if not exists(select 1 from public.employee_gamification eg where eg.employee_id = v_employee.id) then v_streak := 0; v_best_streak := 0; v_total_xp := 0; end if;
  if exists(select 1 from public.employee_gamification eg where eg.employee_id = v_employee.id and eg.last_completion_date = v_today) then
    v_streak := greatest(v_streak,1);
  elsif exists(select 1 from public.employee_gamification eg where eg.employee_id = v_employee.id and eg.last_completion_date = v_today - 1) then
    v_streak := v_streak + 1;
  else v_streak := 1; end if;
  v_total_xp := v_total_xp + v_xp;
  v_level := greatest(1, floor(sqrt(v_total_xp::numeric / 100))::integer + 1);
  v_best_streak := greatest(v_best_streak, v_streak);

  insert into public.employee_gamification(employee_id, company_id, xp_total, level, current_streak, best_streak, tasks_completed, visits_completed, last_completion_date, updated_at)
  values(v_employee.id, v_visit.company_id, v_total_xp, v_level, v_streak, v_best_streak, 0, 1, v_today, now())
  on conflict(employee_id) do update set xp_total=excluded.xp_total, level=excluded.level, current_streak=excluded.current_streak, best_streak=excluded.best_streak, visits_completed=public.employee_gamification.visits_completed+1, last_completion_date=excluded.last_completion_date, updated_at=now();

  return jsonb_build_object('xp_earned',v_xp,'xp_total',v_total_xp,'level',v_level,'streak',v_streak,'reward_name',v_reward_name,'reward_cost_inr',v_reward_cost,'redemption_code',case when v_claim.id is not null then v_claim.redemption_code else null end);
end;
$$;
revoke all on function public.complete_visit_with_rewards(uuid) from public;
grant execute on function public.complete_visit_with_rewards(uuid) to authenticated;

insert into public.reward_rules(company_id, name, trigger_type, reward_id, xp_amount, priority)
select r.company_id, 'Verified visit · Refreshment choice', 'VISIT_COMPLETED', r.id, 75, 10
from public.reward_catalog r
where r.name = 'Refreshment'
  and not exists (select 1 from public.reward_rules rr where rr.company_id = r.company_id and rr.name = 'Verified visit · Refreshment choice');

update public.reward_catalog
set name = 'Refreshment Choice',
    description = 'Choose one small reward: a cold drink up to ₹20 OR 2 samosa. Company policy and availability apply.',
    icon = 'cup-soda'
where name = 'Refreshment';
update public.reward_rules rr
set name = replace(rr.name, 'Refreshment', 'Refreshment Choice')
where rr.name like '%Refreshment%';
