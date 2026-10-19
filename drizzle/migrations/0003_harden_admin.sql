-- Hardening. Run after 0002.

-- 1. Nobody becomes admin automatically any more. Every new account is a plain 'user'.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_roles(user_id, role) values (new.id, 'user');
  return new;
end $$;

-- 2. Admins are named explicitly, from the Supabase SQL editor only (service_role / postgres).
--    select public.grant_admin('owner@yourdomain.com');
--    select public.revoke_admin('someone@else.com');
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

-- 3. Anonymous visitors must not be able to probe who is an admin.
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

-- 4. AUDIT: if the site was ever open to the public before this migration, check who holds admin NOW
--    and remove anyone who should not:
--      select u.email from public.user_roles r join auth.users u on u.id = r.user_id where r.role = 'admin';
--      select public.revoke_admin('unknown@example.com');

-- 5. Remove the leftover prototype order tables (they hold no real data).
drop table if exists public.practice_orders;
drop table if exists public.legacy_orders;
