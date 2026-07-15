-- ===========================================================================
-- Duos: Split Coloring schema
-- Run this in the Supabase SQL editor (or `supabase db execute`) after creating
-- your project. It creates the tables, realtime publication, storage bucket and
-- the (permissive, anon-friendly) RLS policies used by this MVP.
-- ===========================================================================

-- Enable UUID generation.
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.lobbies (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  page_image  text not null,
  split_type  text check (split_type in ('vertical','horizontal','diagonal','custom')),
  split_data  jsonb,
  status      text not null default 'setup'
                check (status in ('setup','waiting','playing','revealed')),
  created_at  timestamptz not null default now()
);

create table if not exists public.players (
  id          uuid primary key default gen_random_uuid(),
  lobby_id    uuid not null references public.lobbies(id) on delete cascade,
  role        text not null check (role in ('A','B')),
  client_id   text not null,
  ready       boolean not null default false,
  done        boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (lobby_id, role)
);

create index if not exists players_lobby_id_idx on public.players(lobby_id);
create index if not exists lobbies_code_idx on public.lobbies(code);

-- ---------------------------------------------------------------------------
-- Realtime: broadcast row changes for these tables.
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.lobbies;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.players;
  exception when duplicate_object then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- NOTE (MVP): This app has NO login. Players are identified only by a random
-- client_id stored in localStorage. The policies below allow full anonymous
-- access to lobbies/players so any client can create/join/update a lobby.
-- This is acceptable for a casual, unlisted, short-lived game where lobby codes
-- are effectively the only secret. For production you should tighten these:
--   * restrict updates to the row owned by the caller's client_id,
--   * add a scheduled cleanup for old lobbies,
--   * consider Supabase anonymous auth so auth.uid() can scope policies.
-- ---------------------------------------------------------------------------
alter table public.lobbies enable row level security;
alter table public.players enable row level security;

drop policy if exists "anon full access lobbies" on public.lobbies;
create policy "anon full access lobbies" on public.lobbies
  for all using (true) with check (true);

drop policy if exists "anon full access players" on public.players;
create policy "anon full access players" on public.players
  for all using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Storage: bucket for each player's colored half (keyed lobbyId/role.png).
-- Public read so the reveal can composite via public URLs. Writes are open for
-- the MVP (same trade-off as above).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('colored-halves', 'colored-halves', true)
on conflict (id) do nothing;

drop policy if exists "public read colored-halves" on storage.objects;
create policy "public read colored-halves" on storage.objects
  for select using (bucket_id = 'colored-halves');

drop policy if exists "anon write colored-halves" on storage.objects;
create policy "anon write colored-halves" on storage.objects
  for insert with check (bucket_id = 'colored-halves');

drop policy if exists "anon update colored-halves" on storage.objects;
create policy "anon update colored-halves" on storage.objects
  for update using (bucket_id = 'colored-halves') with check (bucket_id = 'colored-halves');

-- ---------------------------------------------------------------------------
-- Storage: creator-uploaded line-art pages (PNG/JPG).
-- Public read so both players load the same image via page_image URL.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('coloring-pages-uploads', 'coloring-pages-uploads', true)
on conflict (id) do nothing;

drop policy if exists "public read coloring-pages-uploads" on storage.objects;
create policy "public read coloring-pages-uploads" on storage.objects
  for select using (bucket_id = 'coloring-pages-uploads');

drop policy if exists "anon write coloring-pages-uploads" on storage.objects;
create policy "anon write coloring-pages-uploads" on storage.objects
  for insert with check (bucket_id = 'coloring-pages-uploads');

drop policy if exists "anon update coloring-pages-uploads" on storage.objects;
create policy "anon update coloring-pages-uploads" on storage.objects
  for update using (bucket_id = 'coloring-pages-uploads')
  with check (bucket_id = 'coloring-pages-uploads');
