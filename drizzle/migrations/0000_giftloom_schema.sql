create type public.app_role as enum ('admin','user');
create table public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade not null, role app_role not null, unique(user_id, role));
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.user_roles where user_id=_user_id and role=_role) $$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_roles(user_id, role) values (new.id, 'user');
  if not exists (select 1 from public.user_roles where role='admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.fake_code() returns text language sql volatile as $$
  select 'GLM-' || upper(substr(md5(random()::text),1,4)) || '-' || upper(substr(md5(random()::text),1,4)) || '-' || upper(substr(md5(random()::text),1,4))
$$;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  order_number text not null default ('GL-' || to_char(now(),'YYMMDD') || '-' || upper(substr(md5(random()::text),1,6))),
  brand text not null,
  amount int not null check (amount in (250,500,1000,2000)),
  method text not null check (method in ('upi','debit','wallet')),
  code text not null default public.fake_code(),
  created_at timestamptz not null default now()
);
grant select, insert on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "own orders read" on public.orders for select to authenticated using (user_id = auth.uid());
create policy "own orders insert" on public.orders for insert to authenticated with check (user_id = auth.uid());

create table public.tributes (id uuid primary key default gen_random_uuid(), user_id uuid default auth.uid(), order_number text not null, amount int not null check (amount in (50,100,250)), method text not null check (method in ('upi','debit','wallet')), created_at timestamptz not null default now());
create table public.tickets (id uuid primary key default gen_random_uuid(), user_id uuid default auth.uid(), name text not null check (char_length(name) between 1 and 100), email text not null check (char_length(email) between 3 and 255), subject text not null check (char_length(subject) between 1 and 150), message text not null check (char_length(message) between 1 and 2000), created_at timestamptz not null default now());
create table public.feedback (id uuid primary key default gen_random_uuid(), user_id uuid default auth.uid(), rating int not null check (rating between 1 and 5), comments text check (char_length(comments) <= 2000), created_at timestamptz not null default now());
create table public.messages (id uuid primary key default gen_random_uuid(), user_id uuid default auth.uid(), name text not null check (char_length(name) between 1 and 100), email text not null check (char_length(email) between 3 and 255), message text not null check (char_length(message) between 1 and 2000), created_at timestamptz not null default now());

grant insert on public.tributes, public.tickets, public.feedback, public.messages to anon, authenticated;
grant select on public.tributes, public.tickets, public.feedback, public.messages to authenticated;
grant all on public.tributes, public.tickets, public.feedback, public.messages to service_role;
alter table public.tributes enable row level security;
alter table public.tickets enable row level security;
alter table public.feedback enable row level security;
alter table public.messages enable row level security;
create policy "anyone insert" on public.tributes for insert to anon, authenticated with check (user_id is null or user_id = auth.uid());
create policy "anyone insert" on public.tickets for insert to anon, authenticated with check (user_id is null or user_id = auth.uid());
create policy "anyone insert" on public.feedback for insert to anon, authenticated with check (user_id is null or user_id = auth.uid());
create policy "anyone insert" on public.messages for insert to anon, authenticated with check (user_id is null or user_id = auth.uid());
create policy "admin read" on public.tributes for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admin read" on public.tickets for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admin read" on public.feedback for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admin read" on public.messages for select to authenticated using (public.has_role(auth.uid(),'admin'));
