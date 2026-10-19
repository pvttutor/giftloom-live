-- Step 1: replace the random code generator with a real inventory vault.
-- Run in the Supabase SQL editor (or: DATABASE_URL=... npx drizzle-kit migrate).

-- 1. Retire the prototype orders table and the random-code generator.
alter table public.orders rename to legacy_orders;
alter table public.legacy_orders alter column code drop default;
revoke all on public.legacy_orders from anon, authenticated;
drop function public.fake_code();

-- 2. Inventory vault. Codes are stored ENCRYPTED (AES-256-GCM, done by the server).
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

-- Server only. No policies and no grants for browser roles.
alter table public.gift_card_inventory enable row level security;
revoke all on public.gift_card_inventory from public, anon, authenticated;
grant all on public.gift_card_inventory to service_role;

-- 3. Orders: created and updated only by the server (service_role).
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

-- 4. Atomic stock reservation. Returns the reserved inventory id, or null when out of stock.
create or replace function public.reserve_inventory(p_user uuid, p_brand text, p_denom int, p_minutes int default 20)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  -- release expired reservations and expire their unpaid orders
  with released as (
    update public.gift_card_inventory
       set status = 'available', reserved_by = null, reserved_until = null
     where status = 'reserved' and reserved_until < now()
    returning id
  )
  update public.orders set status = 'expired'
   where status = 'pending' and inventory_id in (select id from released);

  -- stop one user from hoarding stock
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

-- 5. Mark an order paid and the voucher sold in ONE transaction.
-- Called only after the server has verified the payment with the gateway.
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
