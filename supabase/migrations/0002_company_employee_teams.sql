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

create type public.employee_status as enum ('INVITED', 'ACTIVE', 'INACTIVE');

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
create policy "company members can read employees"
on public.employees
for select
to authenticated
using (company_id = (select public.current_user_company_id()));

create policy "authorized users can create employees"
on public.employees
for insert
to authenticated
with check (
  company_id = (select public.current_user_company_id())
  and (select public.can_manage_company_people())
);

create policy "authorized users can update employees"
on public.employees
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

create policy "company admins can delete employees"
on public.employees
for delete
to authenticated
using (
  company_id = (select public.current_user_company_id())
  and (select public.is_company_admin_user())
);

-- Teams.
create policy "company members can read teams"
on public.teams
for select
to authenticated
using (company_id = (select public.current_user_company_id()));

create policy "authorized users can create teams"
on public.teams
for insert
to authenticated
with check (
  company_id = (select public.current_user_company_id())
  and (select public.can_manage_company_people())
);

create policy "authorized users can update teams"
on public.teams
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

create policy "company admins can delete teams"
on public.teams
for delete
to authenticated
using (
  company_id = (select public.current_user_company_id())
  and (select public.is_company_admin_user())
);

-- Team membership.
create policy "company members can read team members"
on public.team_members
for select
to authenticated
using (company_id = (select public.current_user_company_id()));

create policy "authorized users can add team members"
on public.team_members
for insert
to authenticated
with check (
  company_id = (select public.current_user_company_id())
  and (select public.can_manage_company_people())
);

create policy "authorized users can update team members"
on public.team_members
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

create policy "company admins can remove team members"
on public.team_members
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
