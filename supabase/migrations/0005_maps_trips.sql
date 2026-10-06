-- AURA FieldOS - Stage 6 Maps + Trips + Distance
-- Run after 0001-0004.

create type public.trip_status as enum ('ACTIVE','COMPLETED','CANCELLED');

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
