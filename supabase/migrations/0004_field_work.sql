-- AURA FieldOS - Stage 5 Field Work
-- Attendance, work sessions, GPS pings and customer visits.
-- Run after 0001, 0002 and 0003.

create type public.attendance_status as enum ('PRESENT','LATE','HALF_DAY','ABSENT');
create type public.work_session_status as enum ('ACTIVE','PAUSED','ENDED');
create type public.visit_status as enum ('PLANNED','STARTED','COMPLETED','CANCELLED');

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
