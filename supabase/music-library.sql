-- Run this ONCE in Supabase -> SQL Editor.
-- Your app's likes/playlists code already expects these tables, but they were
-- never created in the database (only watchlist_items and continue_watching
-- exist), so "Like" and playlists silently failed.

create table if not exists public.saved_tracks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  video_id text not null,
  title text,
  artist text,
  thumbnail text,
  created_at timestamptz not null default now(),
  unique (user_id, video_id)
);

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table if not exists public.playlist_tracks (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  video_id text not null,
  title text,
  artist text,
  thumbnail text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (playlist_id, video_id)
);

create index if not exists saved_tracks_user_idx on public.saved_tracks (user_id, created_at desc);
create index if not exists playlists_user_idx on public.playlists (user_id, created_at desc);
create index if not exists playlist_tracks_playlist_idx on public.playlist_tracks (playlist_id, position);

alter table public.saved_tracks enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_tracks enable row level security;

-- Each person can only see and change their own rows.
create policy "saved_tracks_own" on public.saved_tracks
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "playlists_own" on public.playlists
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Playlist tracks belong to whoever owns the playlist.
create policy "playlist_tracks_own" on public.playlist_tracks
  for all to authenticated
  using (exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = (select auth.uid())))
  with check (exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = (select auth.uid())));
