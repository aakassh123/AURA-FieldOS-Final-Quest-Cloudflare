-- AURA FieldOS - Stage 7 Finance + Compensation
-- Expenses, deals/revenue, versioned compensation rules, targets, commissions and payouts.
-- Run after 0001-0005.

create type public.expense_status as enum ('SUBMITTED','APPROVED','REJECTED','PAID');
create type public.expense_category as enum ('TRAVEL','FUEL','MEALS','LODGING','PHONE','OFFICE','OTHER');
create type public.deal_status as enum ('OPEN','WON','LOST','CANCELLED');
create type public.compensation_rule_type as enum ('FIXED_SALARY','PER_DAY','FIXED_PLUS_INCENTIVE','COMMISSION','HYBRID');
create type public.commission_status as enum ('CALCULATED','APPROVED','PAID','VOID');
create type public.payout_status as enum ('DRAFT','READY','APPROVED','PAID','VOID');

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
