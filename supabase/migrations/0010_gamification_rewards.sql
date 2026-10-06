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
