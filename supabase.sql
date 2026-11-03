
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text unique not null,
  role text not null default 'user'
    check (role in ('user', 'admin')),
  created_at timestamptz default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  api_url text not null,
  query_param text not null default 'query',
  results_path text default '',
  page_param text default 'page',
  method text not null default 'GET'
    check (method in ('GET', 'POST')),
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.categories enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

create policy "Users read own profile"
on public.profiles for select
to authenticated
using (id = (select auth.uid()));

create policy "Users read categories"
on public.categories for select
to authenticated
using (true);

create policy "Admins insert categories"
on public.categories for insert
to authenticated
with check (public.is_admin());

create policy "Admins update categories"
on public.categories for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins delete categories"
on public.categories for delete
to authenticated
using (public.is_admin());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nickname)
  values (
    new.id,
    new.raw_user_meta_data ->> 'nickname'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

grant execute on function public.is_admin() to authenticated;
grant select on public.profiles to authenticated;
grant select on public.categories to authenticated;
grant insert, update, delete on public.categories to authenticated;

