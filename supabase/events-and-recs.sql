-- Run once in the Supabase SQL editor.
create table if not exists public.music_events (
  id                bigserial primary key,
  user_key          text not null,        -- random id stored on the device, not an account id
  media_id          text not null,
  media_type        text not null default 'music',
  event             text not null,        -- complete | skip | repeat | playlist_add | volume
  duration_consumed integer not null default 0,
  total_duration    integer not null default 0,
  value             real,
  meta              jsonb,                -- title, artist, thumbnail, duration (for "For You")
  created_at        timestamptz not null default now()
);
create index if not exists music_events_user_idx on public.music_events (user_key, created_at desc);
alter table public.music_events enable row level security;
