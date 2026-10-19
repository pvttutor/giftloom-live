-- ===================== 0001_real_inventory =====================
alter table public.orders rename to legacy_orders;
alter table public.legacy_orders alter column code drop default;
revoke all on public.legacy_orders from anon, authenticated;
drop function public.fake_code();

create type public.inventory_status as enum ('available', 'reserved', 'sold');

create table public.gift_card_inventory (
  id uuid primary key default gen_random_uuid(),
  brand text not null check (char_length(brand) between 1 and 100),
  denomination int not null check (denomination > 0),
  code_ciphertext text not null,
  code_hash text not null unique,          -- HMAC of the code, blocks duplicate uploads
  status public.inventory_status not null default 'available',
  reserved_by uuid references auth.users(id),
  reserved_until timestamptz,
  order_id uuid,
  sold_at timestamptz,
  source text check (char_length(source) <= 200),  -- supplier / invoice / batch reference (audit trail)
  created_at timestamptz not null default now(),
  check (status <> 'reserved' or (reserved_by is not null and reserved_until is not null))
);
create index gift_card_inventory_pick on public.gift_card_inventory (brand, denomination, status, created_at);

alter table public.gift_card_inventory enable row level security;
revoke all on public.gift_card_inventory from public, anon, authenticated;
grant all on public.gift_card_inventory to service_role;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  order_number text not null unique default ('GL-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6))),
  brand text not null,
  amount int not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending','paid','paid_unfulfilled','failed','expired')),
  inventory_id uuid references public.gift_card_inventory(id),
  provider text not null default 'razorpay',
  provider_order_id text unique,
  provider_payment_id text unique,
  test_mode boolean not null default true,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
revoke all on public.orders from public, anon, authenticated;
grant select on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "own orders read" on public.orders for select to authenticated using (user_id = auth.uid());

create or replace function public.reserve_inventory(p_user uuid, p_brand text, p_denom int, p_minutes int default 20)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  with released as (
    update public.gift_card_inventory
       set status = 'available', reserved_by = null, reserved_until = null
     where status = 'reserved' and reserved_until < now()
    returning id
  )
  update public.orders set status = 'expired'
   where status = 'pending' and inventory_id in (select id from released);

  if (select count(*) from public.gift_card_inventory where status = 'reserved' and reserved_by = p_user) >= 3 then
    raise exception 'too_many_reservations';
  end if;

  select id into v_id from public.gift_card_inventory
   where brand = p_brand and denomination = p_denom and status = 'available'
   order by created_at
   limit 1
   for update skip locked;

  if v_id is null then return null; end if;

  update public.gift_card_inventory
     set status = 'reserved', reserved_by = p_user, reserved_until = now() + make_interval(mins => p_minutes)
   where id = v_id;
  return v_id;
end $$;

create or replace function public.finalize_paid_order(p_order_id uuid, p_provider_payment_id text)
returns void language plpgsql security definer set search_path = public as $$
declare v_inv uuid; v_user uuid; v_status text;
begin
  select inventory_id, user_id, status into v_inv, v_user, v_status
    from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_status not in ('pending', 'expired') then raise exception 'order_not_payable'; end if;

  update public.gift_card_inventory
     set status = 'sold', sold_at = now(), order_id = p_order_id, reserved_by = v_user, reserved_until = null
   where id = v_inv and (status = 'available' or (status = 'reserved' and reserved_by = v_user));
  if not found then raise exception 'stock_unavailable'; end if;

  update public.orders set status = 'paid', paid_at = now(), provider_payment_id = p_provider_payment_id
   where id = p_order_id;
end $$;

revoke all on function public.reserve_inventory(uuid, text, int, int) from public, anon, authenticated;
revoke all on function public.finalize_paid_order(uuid, text) from public, anon, authenticated;
grant execute on function public.reserve_inventory(uuid, text, int, int) to service_role;
grant execute on function public.finalize_paid_order(uuid, text) to service_role;

-- ===================== 0002_catalog_and_test_stock =====================
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  name text not null unique check (char_length(name) between 1 and 100),
  category text not null check (char_length(category) between 1 and 60),
  tagline text not null default '' check (char_length(tagline) <= 140),
  hue int not null default 262 check (hue between 0 and 360),
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create unique index brands_name_lower_key on public.brands (lower(name));

create table public.denominations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  amount int not null check (amount > 0 and amount <= 100000),
  active boolean not null default true,
  unique (brand_id, amount)
);

alter table public.brands enable row level security;
alter table public.denominations enable row level security;
revoke all on public.brands, public.denominations from public, anon, authenticated;
grant all on public.brands, public.denominations to service_role;

alter table public.gift_card_inventory add column is_test boolean not null default false;
alter table public.gift_card_inventory
  add constraint gift_card_inventory_brand_fk foreign key (brand) references public.brands(name) on update cascade not valid;
create index gift_card_inventory_pick2 on public.gift_card_inventory (is_test, brand, denomination, status, created_at);

drop function public.reserve_inventory(uuid, text, int, int);
create function public.reserve_inventory(p_user uuid, p_brand text, p_denom int, p_test boolean, p_minutes int default 20)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  with released as (
    update public.gift_card_inventory
       set status = 'available', reserved_by = null, reserved_until = null
     where status = 'reserved' and reserved_until < now()
    returning id
  )
  update public.orders set status = 'expired'
   where status = 'pending' and inventory_id in (select id from released);

  if (select count(*) from public.gift_card_inventory where status = 'reserved' and reserved_by = p_user) >= 3 then
    raise exception 'too_many_reservations';
  end if;

  select id into v_id from public.gift_card_inventory
   where brand = p_brand and denomination = p_denom and is_test = p_test and status = 'available'
   order by created_at
   limit 1
   for update skip locked;

  if v_id is null then return null; end if;

  update public.gift_card_inventory
     set status = 'reserved', reserved_by = p_user, reserved_until = now() + make_interval(mins => p_minutes)
   where id = v_id;
  return v_id;
end $$;

create or replace function public.finalize_paid_order(p_order_id uuid, p_provider_payment_id text)
returns void language plpgsql security definer set search_path = public as $$
declare v_inv uuid; v_user uuid; v_status text; v_test boolean;
begin
  select inventory_id, user_id, status, test_mode into v_inv, v_user, v_status, v_test
    from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_status not in ('pending', 'expired') then raise exception 'order_not_payable'; end if;

  update public.gift_card_inventory
     set status = 'sold', sold_at = now(), order_id = p_order_id, reserved_by = v_user, reserved_until = null
   where id = v_inv and is_test = v_test and (status = 'available' or (status = 'reserved' and reserved_by = v_user));
  if not found then raise exception 'stock_unavailable'; end if;

  update public.orders set status = 'paid', paid_at = now(), provider_payment_id = p_provider_payment_id
   where id = p_order_id;
end $$;

create or replace function public.stock_summary()
returns table (brand text, denomination int, is_test boolean, available bigint, reserved bigint, sold bigint)
language sql stable security definer set search_path = public as $$
  select brand, denomination, is_test,
         count(*) filter (where status = 'available' or (status = 'reserved' and reserved_until < now())),
         count(*) filter (where status = 'reserved' and reserved_until >= now()),
         count(*) filter (where status = 'sold')
    from public.gift_card_inventory
   group by brand, denomination, is_test
$$;

revoke all on function public.reserve_inventory(uuid, text, int, boolean, int) from public, anon, authenticated;
revoke all on function public.finalize_paid_order(uuid, text) from public, anon, authenticated;
revoke all on function public.stock_summary() from public, anon, authenticated;
grant execute on function public.reserve_inventory(uuid, text, int, boolean, int) to service_role;
grant execute on function public.finalize_paid_order(uuid, text) to service_role;
grant execute on function public.stock_summary() to service_role;

-- ===================== 0003_harden_admin =====================
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_roles(user_id, role) values (new.id, 'user');
  return new;
end $$;

create or replace function public.grant_admin(p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(p_email);
  if v_id is null then raise exception 'no user with that email'; end if;
  insert into public.user_roles(user_id, role) values (v_id, 'admin') on conflict (user_id, role) do nothing;
end $$;

create or replace function public.revoke_admin(p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(p_email);
  if v_id is null then raise exception 'no user with that email'; end if;
  delete from public.user_roles where user_id = v_id and role = 'admin';
end $$;

revoke all on function public.grant_admin(text) from public, anon, authenticated;
revoke all on function public.revoke_admin(text) from public, anon, authenticated;
grant execute on function public.grant_admin(text) to service_role;
grant execute on function public.revoke_admin(text) to service_role;

revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

drop table if exists public.practice_orders;
drop table if exists public.legacy_orders;

-- ===================== 0004_order_management (the only part you need if 0001 to 0003 already ran) =====================
alter table public.orders add column if not exists admin_note text check (char_length(admin_note) <= 500);
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending','paid','paid_unfulfilled','failed','expired','refunded'));

create or replace function public.admin_orders(p_limit int default 200)
returns table (id uuid, order_number text, email text, brand text, amount int, status text, test_mode boolean,
               provider_order_id text, provider_payment_id text, admin_note text, created_at timestamptz, paid_at timestamptz)
language sql stable security definer set search_path = public as $$
  select o.id, o.order_number, u.email::text, o.brand, o.amount, o.status, o.test_mode,
         o.provider_order_id, o.provider_payment_id, o.admin_note, o.created_at, o.paid_at
    from public.orders o left join auth.users u on u.id = o.user_id
   order by o.created_at desc
   limit least(p_limit, 500)
$$;

create or replace function public.admin_fulfill_order(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype; v_inv uuid;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if o.status <> 'paid_unfulfilled' then raise exception 'order_not_payable'; end if;

  select id into v_inv from public.gift_card_inventory
   where brand = o.brand and denomination = o.amount and is_test = o.test_mode and status = 'available'
   order by created_at
   limit 1
   for update skip locked;
  if v_inv is null then raise exception 'no_stock'; end if;

  update public.gift_card_inventory
     set status = 'sold', sold_at = now(), order_id = o.id, reserved_by = o.user_id, reserved_until = null
   where id = v_inv;
  update public.orders set inventory_id = v_inv, status = 'paid', paid_at = coalesce(paid_at, now()) where id = o.id;
end $$;

revoke all on function public.admin_orders(int) from public, anon, authenticated;
revoke all on function public.admin_fulfill_order(uuid) from public, anon, authenticated;
grant execute on function public.admin_orders(int) to service_role;
grant execute on function public.admin_fulfill_order(uuid) to service_role;

-- ===================== make you@yourdomain.com an admin =====================
do $$
begin
  if exists (select 1 from auth.users where lower(email) = lower('you@yourdomain.com')) then
    perform public.grant_admin('you@yourdomain.com');
    raise notice 'Admin granted to you@yourdomain.com';
  else
    raise notice 'No account for you@yourdomain.com yet. Sign up on the site first, then run: select public.grant_admin(''you@yourdomain.com'');';
  end if;
end $$;
