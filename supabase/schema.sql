-- RAVENOID production Supabase schema
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_no bigint generated always as identity unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null check (char_length(subject) between 1 and 200),
  category text not null default 'General',
  status text not null default 'open' check (status in ('open','pending','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 10000),
  attachment_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.public_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  image_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  message text not null,
  type text not null default 'system',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.site_content (
  id uuid primary key default gen_random_uuid(),
  content_type text not null,
  title text,
  body text,
  metadata jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.private_files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  path text not null,
  filename text not null,
  mime_type text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.public_posts enable row level security;
alter table public.notifications enable row level security;
alter table public.site_content enable row level security;
alter table public.private_files enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'); $$;

drop policy if exists "profiles public read" on public.profiles;
create policy "profiles public read" on public.profiles for select using (true);
drop policy if exists "profile own update" on public.profiles;
create policy "profile own update" on public.profiles for update using (auth.uid()=id);

drop policy if exists "users read own tickets" on public.tickets;
create policy "users read own tickets" on public.tickets for select using (auth.uid()=user_id or public.is_admin());
drop policy if exists "users create tickets" on public.tickets;
create policy "users create tickets" on public.tickets for insert with check (auth.uid()=user_id);
drop policy if exists "admin update tickets" on public.tickets;
create policy "admin update tickets" on public.tickets for update using (public.is_admin());

drop policy if exists "ticket participants read messages" on public.ticket_messages;
create policy "ticket participants read messages" on public.ticket_messages for select using (public.is_admin() or exists(select 1 from public.tickets t where t.id=ticket_id and t.user_id=auth.uid()));
drop policy if exists "ticket participants send messages" on public.ticket_messages;
create policy "ticket participants send messages" on public.ticket_messages for insert with check (auth.uid()=sender_id and (public.is_admin() or exists(select 1 from public.tickets t where t.id=ticket_id and t.user_id=auth.uid())));

drop policy if exists "public posts read" on public.public_posts;
create policy "public posts read" on public.public_posts for select using (true);
drop policy if exists "users create public posts" on public.public_posts;
create policy "users create public posts" on public.public_posts for insert with check (auth.uid()=user_id);
drop policy if exists "owners or admins delete public posts" on public.public_posts;
create policy "owners or admins delete public posts" on public.public_posts for delete using (auth.uid()=user_id or public.is_admin());

drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications" on public.notifications for select using (auth.uid()=user_id or public.is_admin());
drop policy if exists "admin creates notifications" on public.notifications;
create policy "admin creates notifications" on public.notifications for insert with check (public.is_admin());
drop policy if exists "users mark own notifications" on public.notifications;
create policy "users mark own notifications" on public.notifications for update using (auth.uid()=user_id);

drop policy if exists "published content readable" on public.site_content;
create policy "published content readable" on public.site_content for select using (published=true or public.is_admin());
drop policy if exists "admins manage content" on public.site_content;
create policy "admins manage content" on public.site_content for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "owners/admins read file records" on public.private_files;
create policy "owners/admins read file records" on public.private_files for select using (owner_id=auth.uid() or public.is_admin());
drop policy if exists "owners create file records" on public.private_files;
create policy "owners create file records" on public.private_files for insert with check (owner_id=auth.uid() or public.is_admin());
drop policy if exists "owners/admins delete file records" on public.private_files;
create policy "owners/admins delete file records" on public.private_files for delete using (owner_id=auth.uid() or public.is_admin());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  insert into public.profiles(id, display_name)
  values(new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Storage bucket for public-room images.
insert into storage.buckets (id,name,public)
values ('ravenoid-files','ravenoid-files',true)
on conflict (id) do update set public=true;

drop policy if exists "ravenoid image upload" on storage.objects;
create policy "ravenoid image upload" on storage.objects for insert to authenticated
with check (bucket_id='ravenoid-files' and (storage.foldername(name))[1]='public' and (storage.foldername(name))[2]=auth.uid()::text);

drop policy if exists "ravenoid image read" on storage.objects;
create policy "ravenoid image read" on storage.objects for select
using (bucket_id='ravenoid-files');

drop policy if exists "ravenoid image delete" on storage.objects;
create policy "ravenoid image delete" on storage.objects for delete to authenticated
using (bucket_id='ravenoid-files' and ((storage.foldername(name))[2]=auth.uid()::text or public.is_admin()));

-- Realtime
alter publication supabase_realtime add table public.tickets;
alter publication supabase_realtime add table public.ticket_messages;
alter publication supabase_realtime add table public.public_posts;
alter publication supabase_realtime add table public.notifications;

-- After your first signup, promote that account:
-- update public.profiles set role='admin' where id='YOUR_USER_UUID';
