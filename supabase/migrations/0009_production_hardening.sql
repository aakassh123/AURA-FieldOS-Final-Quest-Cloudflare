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
