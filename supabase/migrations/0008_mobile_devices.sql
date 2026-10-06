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
