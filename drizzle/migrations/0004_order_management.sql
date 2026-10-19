-- Order management for the admin panel. Run after 0003.
alter table public.orders add column if not exists admin_note text check (char_length(admin_note) <= 500);
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending','paid','paid_unfulfilled','failed','expired','refunded'));

-- All orders with the customer's email, for the admin panel (server only).
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

-- A customer paid but the reserved voucher was lost: give them another voucher of the same kind, if any.
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
