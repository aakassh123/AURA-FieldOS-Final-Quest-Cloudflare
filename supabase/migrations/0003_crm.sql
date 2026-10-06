-- AURA FieldOS - Stage 4 CRM foundation
-- Leads, customers, contacts, pipeline stages, activities and tasks.
-- Run after 0001_auth_roles.sql and 0002_company_employee_teams.sql.

create type public.lead_status as enum ('OPEN', 'WON', 'LOST');
create type public.lead_priority as enum ('LOW', 'MEDIUM', 'HIGH');
create type public.activity_type as enum ('NOTE', 'CALL', 'EMAIL', 'MEETING', 'WHATSAPP', 'STATUS_CHANGE');
create type public.task_status as enum ('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED');

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
