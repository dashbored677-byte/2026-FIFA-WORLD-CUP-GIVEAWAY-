-- Life in Akwa Ibom: global Town Square chat
-- Run this in Supabase SQL Editor. Then enable Anonymous Sign-ins under
-- Authentication > Sign In / Providers (Anonymous).

create table if not exists public.chat_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Resident' check (char_length(display_name) between 1 and 22),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default 'Resident',
  message text not null check (char_length(trim(message)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_created_at_idx on public.chat_messages (created_at desc);
create index if not exists chat_messages_user_id_idx on public.chat_messages (user_id, created_at desc);

alter table public.chat_profiles enable row level security;
alter table public.chat_messages enable row level security;

-- Authenticated and anonymous-authenticated residents can read the public chat.
drop policy if exists "Residents can read chat profiles" on public.chat_profiles;
create policy "Residents can read chat profiles" on public.chat_profiles
  for select to authenticated using (true);

drop policy if exists "Residents can create their own profile" on public.chat_profiles;
create policy "Residents can create their own profile" on public.chat_profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists "Residents can update their own profile" on public.chat_profiles;
create policy "Residents can update their own profile" on public.chat_profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Residents can read messages" on public.chat_messages;
create policy "Residents can read messages" on public.chat_messages
  for select to authenticated using (true);

drop policy if exists "Residents can send as themselves" on public.chat_messages;
create policy "Residents can send as themselves" on public.chat_messages
  for insert to authenticated with check (user_id = auth.uid() and char_length(trim(message)) between 1 and 500);

-- The database, not the browser, chooses the sender's display name.
create or replace function public.set_chat_message_sender()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare profile_name text;
begin
  select display_name into profile_name from public.chat_profiles where id = auth.uid();
  if profile_name is null then
    raise exception 'Create a chat profile before sending messages';
  end if;
  if char_length(trim(new.message)) < 1 or char_length(new.message) > 500 then
    raise exception 'Messages must contain 1 to 500 characters';
  end if;
  -- Simple database-side rate limit: one message per user every 1.5 seconds.
  if exists (
    select 1 from public.chat_messages
    where user_id = auth.uid() and created_at > now() - interval '1.5 seconds'
  ) then
    raise exception 'Please wait a moment before sending another message';
  end if;
  new.user_id := auth.uid();
  new.display_name := profile_name;
  return new;
end;
$$;

drop trigger if exists chat_message_sender_guard on public.chat_messages;
create trigger chat_message_sender_guard
  before insert on public.chat_messages
  for each row execute function public.set_chat_message_sender();

-- Enable realtime delivery for newly inserted chat messages.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;

grant select, insert, update on public.chat_profiles to authenticated;
grant select, insert on public.chat_messages to authenticated;
grant usage, select on sequence public.chat_messages_id_seq to authenticated;
