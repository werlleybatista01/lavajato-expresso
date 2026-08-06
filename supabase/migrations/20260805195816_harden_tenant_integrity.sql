begin;

-- Migração-base completa. O projeto remoto foi validado e endurecido em
-- homologação antes de esta versão ser promovida ao repositório.

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

do $$ begin
  create type public.app_role as enum ('owner', 'admin', 'operator', 'viewer');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.financial_status as enum ('posted', 'void');
exception when duplicate_object then null;
end $$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  cnpj text,
  phone text,
  address text,
  monthly_target numeric(14,2) not null default 0 check (monthly_target >= 0),
  water_rate numeric(12,4) not null default 0 check (water_rate >= 0),
  energy_rate numeric(12,4) not null default 0 check (energy_rate >= 0),
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'viewer',
  display_name text not null check (length(trim(display_name)) between 2 and 120),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 120),
  job_title text not null default 'Lavador',
  salary numeric(14,2) not null default 0 check (salary >= 0),
  commission_percent numeric(5,2) not null default 0 check (commission_percent between 0 and 100),
  admission_date date not null default current_date,
  termination_date date,
  active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 160),
  category text not null default 'Geral',
  price numeric(14,2) not null check (price > 0),
  duration_minutes integer not null default 30 check (duration_minutes > 0),
  operational_cost numeric(14,2) not null default 0 check (operational_cost >= 0),
  material_cost numeric(14,2) not null default 0 check (material_cost >= 0),
  default_employee_id uuid references public.employees(id) on delete set null,
  active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 160),
  phone text,
  vehicle text,
  plate text,
  active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 160),
  category text not null default 'Geral',
  quantity numeric(14,3) not null default 0 check (quantity >= 0),
  unit text not null default 'Unidade',
  unit_cost numeric(14,2) not null default 0 check (unit_cost >= 0),
  minimum_quantity numeric(14,3) not null default 0 check (minimum_quantity >= 0),
  supplier text,
  purchase_date date,
  active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  movement_type text not null check (movement_type in ('entry', 'exit')),
  quantity numeric(14,3) not null check (quantity > 0),
  previous_balance numeric(14,3) not null check (previous_balance >= 0),
  resulting_balance numeric(14,3) not null check (resulting_balance >= 0),
  reason text,
  movement_date date not null default current_date,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.revenues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  revenue_date date not null default current_date,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name_snapshot text not null default 'Cliente Avulso',
  service_id uuid references public.services(id) on delete set null,
  service_name_snapshot text,
  employee_id uuid references public.employees(id) on delete set null,
  employee_name_snapshot text,
  commission_percent_snapshot numeric(5,2) not null default 0 check (commission_percent_snapshot between 0 and 100),
  service_cost_snapshot numeric(14,2) not null default 0 check (service_cost_snapshot >= 0),
  payment_method text not null default 'Pix',
  amount numeric(14,2) not null check (amount > 0),
  notes text,
  status public.financial_status not null default 'posted',
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  expense_date date not null default current_date,
  expense_type text not null check (expense_type in ('fixed', 'variable')),
  category text not null,
  description text not null check (length(trim(description)) between 2 and 240),
  amount numeric(14,2) not null check (amount > 0),
  notes text,
  status public.financial_status not null default 'posted',
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  table_name text not null,
  record_id text not null,
  operation text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  actor_id uuid references auth.users(id),
  occurred_at timestamptz not null default now()
);

create index memberships_user_idx on public.memberships(user_id) where active;
create index employees_org_active_idx on public.employees(organization_id, active);
create index services_org_active_idx on public.services(organization_id, active);
create index customers_org_active_idx on public.customers(organization_id, active);
create index inventory_org_active_idx on public.inventory_items(organization_id, active);
create index inventory_movements_org_date_idx on public.inventory_movements(organization_id, movement_date desc);
create index revenues_org_date_idx on public.revenues(organization_id, revenue_date desc) where status = 'posted';
create index expenses_org_date_idx on public.expenses(organization_id, expense_date desc) where status = 'posted';
create index audit_logs_org_date_idx on public.audit_logs(organization_id, occurred_at desc);

create or replace function private.has_org_role(p_organization_id uuid, p_roles text[] default null)
returns boolean language sql stable security definer
set search_path = pg_catalog, public, private
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.active
      and (p_roles is null or m.role::text = any(p_roles))
  );
$$;
revoke all on function private.has_org_role(uuid, text[]) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.has_org_role(uuid, text[]) to authenticated;

create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = pg_catalog
as $$ begin new.updated_at = now(); return new; end $$;

create or replace function private.write_audit_log()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare payload jsonb; org_id uuid; row_id text;
begin
  payload := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  org_id := (payload ->> 'organization_id')::uuid;
  row_id := payload ->> 'id';
  insert into public.audit_logs(organization_id, table_name, record_id, operation, old_data, new_data, actor_id)
  values (org_id, tg_table_name, row_id, tg_op,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end,
    auth.uid());
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function private.write_audit_log() from public, anon, authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['organizations','memberships','employees','services','customers','inventory_items','revenues','expenses'] loop
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function private.set_updated_at()', table_name, table_name);
  end loop;
  foreach table_name in array array['employees','services','customers','inventory_items','inventory_movements','revenues','expenses'] loop
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function private.write_audit_log()', table_name, table_name);
  end loop;
end $$;

create or replace function public.bootstrap_organization(p_name text, p_display_name text)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare new_org_id uuid; current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if length(trim(p_name)) < 2 or length(trim(p_display_name)) < 2 then raise exception 'invalid organization or display name'; end if;
  insert into public.organizations(name) values (trim(p_name)) returning id into new_org_id;
  insert into public.memberships(organization_id, user_id, role, display_name)
  values (new_org_id, current_user_id, 'owner', trim(p_display_name));
  return new_org_id;
end $$;
revoke all on function public.bootstrap_organization(text, text) from public, anon;
grant execute on function public.bootstrap_organization(text, text) to authenticated;

create or replace function public.move_inventory(p_item_id uuid, p_type text, p_quantity numeric, p_reason text default null)
returns numeric language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare item public.inventory_items%rowtype; resulting numeric;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_type not in ('entry','exit') or p_quantity <= 0 then raise exception 'invalid movement'; end if;
  select * into item from public.inventory_items where id = p_item_id and active for update;
  if not found then raise exception 'inventory item not found'; end if;
  if not private.has_org_role(item.organization_id, array['owner','admin','operator']) then raise exception 'permission denied' using errcode = '42501'; end if;
  if p_type = 'exit' and item.quantity < p_quantity then raise exception 'insufficient inventory'; end if;
  resulting := case when p_type = 'entry' then item.quantity + p_quantity else item.quantity - p_quantity end;
  update public.inventory_items set quantity = resulting where id = item.id;
  insert into public.inventory_movements(organization_id,item_id,movement_type,quantity,previous_balance,resulting_balance,reason)
  values(item.organization_id,item.id,p_type,p_quantity,item.quantity,resulting,p_reason);
  return resulting;
end $$;
revoke all on function public.move_inventory(uuid, text, numeric, text) from public, anon;
grant execute on function public.move_inventory(uuid, text, numeric, text) to authenticated;

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.employees enable row level security;
alter table public.services enable row level security;
alter table public.customers enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.revenues enable row level security;
alter table public.expenses enable row level security;
alter table public.audit_logs enable row level security;

create policy organizations_select on public.organizations for select to authenticated using (private.has_org_role(id));
create policy organizations_update on public.organizations for update to authenticated using (private.has_org_role(id, array['owner','admin'])) with check (private.has_org_role(id, array['owner','admin']));
create policy memberships_select on public.memberships for select to authenticated using (private.has_org_role(organization_id));
create policy memberships_insert on public.memberships for insert to authenticated with check (private.has_org_role(organization_id, array['owner','admin']));
create policy memberships_update on public.memberships for update to authenticated using (private.has_org_role(organization_id, array['owner','admin'])) with check (private.has_org_role(organization_id, array['owner','admin']));
create policy memberships_delete on public.memberships for delete to authenticated using (private.has_org_role(organization_id, array['owner']));

do $$
declare table_name text;
begin
  foreach table_name in array array['employees','services','customers','inventory_items','revenues','expenses'] loop
    execute format('create policy %I_select on public.%I for select to authenticated using (private.has_org_role(organization_id))', table_name, table_name);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check (private.has_org_role(organization_id, array[''owner'',''admin'',''operator'']))', table_name, table_name);
    execute format('create policy %I_update on public.%I for update to authenticated using (private.has_org_role(organization_id, array[''owner'',''admin'',''operator''])) with check (private.has_org_role(organization_id, array[''owner'',''admin'',''operator'']))', table_name, table_name);
    execute format('create policy %I_delete on public.%I for delete to authenticated using (private.has_org_role(organization_id, array[''owner'',''admin'']))', table_name, table_name);
  end loop;
end $$;

create policy inventory_movements_select on public.inventory_movements for select to authenticated using (private.has_org_role(organization_id));
create policy audit_logs_select on public.audit_logs for select to authenticated using (private.has_org_role(organization_id, array['owner','admin']));

revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.organizations, public.memberships, public.employees, public.services, public.customers, public.inventory_items, public.revenues, public.expenses to authenticated;
grant select on public.inventory_movements, public.audit_logs to authenticated;
grant usage, select on all sequences in schema public to authenticated;

alter table public.employees drop constraint employees_organization_id_name_key;
alter table public.services drop constraint services_organization_id_name_key;
alter table public.inventory_items drop constraint inventory_items_organization_id_name_key;
create unique index employees_org_active_name_uidx on public.employees (organization_id, lower(btrim(name))) where active;
create unique index services_org_active_name_uidx on public.services (organization_id, lower(btrim(name))) where active;
create unique index inventory_org_active_name_uidx on public.inventory_items (organization_id, lower(btrim(name))) where active;

alter table public.employees add constraint employees_id_org_key unique (id, organization_id);
alter table public.services add constraint services_id_org_key unique (id, organization_id);
alter table public.customers add constraint customers_id_org_key unique (id, organization_id);
alter table public.inventory_items add constraint inventory_items_id_org_key unique (id, organization_id);
alter table public.services drop constraint services_default_employee_id_fkey;
alter table public.services add constraint services_default_employee_org_fkey foreign key (default_employee_id, organization_id) references public.employees(id, organization_id) on delete restrict;
alter table public.inventory_movements drop constraint inventory_movements_item_id_fkey;
alter table public.inventory_movements add constraint inventory_movements_item_org_fkey foreign key (item_id, organization_id) references public.inventory_items(id, organization_id) on delete restrict;
alter table public.revenues drop constraint revenues_customer_id_fkey;
alter table public.revenues drop constraint revenues_service_id_fkey;
alter table public.revenues drop constraint revenues_employee_id_fkey;
alter table public.revenues add constraint revenues_customer_org_fkey foreign key (customer_id, organization_id) references public.customers(id, organization_id) on delete restrict;
alter table public.revenues add constraint revenues_service_org_fkey foreign key (service_id, organization_id) references public.services(id, organization_id) on delete restrict;
alter table public.revenues add constraint revenues_employee_org_fkey foreign key (employee_id, organization_id) references public.employees(id, organization_id) on delete restrict;

create or replace function private.prevent_organization_reassignment() returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if new.organization_id is distinct from old.organization_id then raise exception 'organization_id is immutable' using errcode = '23514'; end if;
  return new;
end $$;
revoke all on function private.prevent_organization_reassignment() from public, anon, authenticated;
do $$ declare table_name text; begin
  foreach table_name in array array['memberships','employees','services','customers','inventory_items','inventory_movements','revenues','expenses'] loop
    execute format('create trigger %I_organization_immutable before update on public.%I for each row execute function private.prevent_organization_reassignment()', table_name, table_name);
  end loop;
end $$;

create or replace function private.protect_last_owner() returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare removing_owner boolean;
begin
  removing_owner := old.role = 'owner'::public.app_role and old.active and (tg_op = 'DELETE' or new.role <> 'owner'::public.app_role or not new.active);
  if removing_owner and not exists (select 1 from public.memberships m where m.organization_id = old.organization_id and m.user_id <> old.user_id and m.role = 'owner'::public.app_role and m.active) then
    raise exception 'organization must retain at least one active owner' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function private.protect_last_owner() from public, anon, authenticated;
create trigger memberships_protect_last_owner before update or delete on public.memberships for each row execute function private.protect_last_owner();

create index audit_logs_actor_idx on public.audit_logs(actor_id);
create index customers_created_by_idx on public.customers(created_by);
create index employees_created_by_idx on public.employees(created_by);
create index expenses_created_by_idx on public.expenses(created_by);
create index expenses_voided_by_idx on public.expenses(voided_by) where voided_by is not null;
create index inventory_items_created_by_idx on public.inventory_items(created_by);
create index inventory_movements_created_by_idx on public.inventory_movements(created_by);
create index inventory_movements_item_org_idx on public.inventory_movements(item_id, organization_id);
create index revenues_created_by_idx on public.revenues(created_by);
create index revenues_voided_by_idx on public.revenues(voided_by) where voided_by is not null;
create index revenues_customer_org_idx on public.revenues(customer_id, organization_id);
create index revenues_service_org_idx on public.revenues(service_id, organization_id);
create index revenues_employee_org_idx on public.revenues(employee_id, organization_id);
create index services_created_by_idx on public.services(created_by);
create index services_employee_org_idx on public.services(default_employee_id, organization_id);

commit;
