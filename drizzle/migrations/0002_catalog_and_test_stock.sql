-- Steps 2 and 3: database-backed catalog, and separation of TEST stock from REAL stock.
-- Run after 0001. If you loaded rows with the 0001 script using invented brand names, they stay but are unsellable until a brand with that exact name exists.

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

-- Server only (service_role). The storefront reads these through server functions.
alter table public.brands enable row level security;
alter table public.denominations enable row level security;
revoke all on public.brands, public.denominations from public, anon, authenticated;
grant all on public.brands, public.denominations to service_role;

-- Test stock can never be sold under live keys, and real stock can never be sold under test keys.
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

-- Defense in depth: a test-mode order can only ever sell test stock, and vice versa.
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
