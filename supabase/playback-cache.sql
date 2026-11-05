-- Run once in the Supabase SQL editor.
create table if not exists public.playback_cache (
  cache_key  text primary key,
  video_id   text,
  source     text not null,
  created_at timestamptz not null default now()
);
-- Locked down: only the server (service role key) can read or write.
alter table public.playback_cache enable row level security;
