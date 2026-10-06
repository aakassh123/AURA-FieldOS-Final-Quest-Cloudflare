-- AURA FieldOS - Stage 10
-- Realtime notifications and event triggers.
-- Run after 0001 -> 0006.

create type public.notification_type as enum (
  'LEAD_ASSIGNED',
  'TASK_ASSIGNED',
  'VISIT_PLANNED',
  'EXPENSE_REVIEWED',
  'COMMISSION_CREATED',
  'SYSTEM'
);

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
