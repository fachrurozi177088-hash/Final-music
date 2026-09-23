-- GameWave Music - Supabase schema
-- Jalankan di Supabase SQL Editor.
-- Schema ini memakai nama tabel/kolom yang diminta oleh aplikasi.

create extension if not exists pgcrypto;

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  artist text,
  album text,
  storage_path text not null unique,
  cover_url text,
  duration double precision,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.playlist_songs (
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  primary key (playlist_id, song_id)
);

create index if not exists songs_user_id_idx on public.songs(user_id);
create index if not exists songs_public_created_idx on public.songs(is_public, created_at desc);
create index if not exists playlists_user_id_idx on public.playlists(user_id);
create index if not exists playlist_songs_song_id_idx on public.playlist_songs(song_id);

alter table public.songs enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_songs enable row level security;

-- SONGS
drop policy if exists "songs_select_own_or_public" on public.songs;
create policy "songs_select_own_or_public"
on public.songs
for select
to authenticated
using (auth.uid() = user_id or is_public = true);

drop policy if exists "songs_insert_own" on public.songs;
create policy "songs_insert_own"
on public.songs
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "songs_update_own" on public.songs;
create policy "songs_update_own"
on public.songs
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "songs_delete_own" on public.songs;
create policy "songs_delete_own"
on public.songs
for delete
to authenticated
using (auth.uid() = user_id);

-- PLAYLISTS
drop policy if exists "playlists_select_own" on public.playlists;
create policy "playlists_select_own"
on public.playlists
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "playlists_insert_own" on public.playlists;
create policy "playlists_insert_own"
on public.playlists
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "playlists_update_own" on public.playlists;
create policy "playlists_update_own"
on public.playlists
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "playlists_delete_own" on public.playlists;
create policy "playlists_delete_own"
on public.playlists
for delete
to authenticated
using (auth.uid() = user_id);

-- PLAYLIST SONGS
drop policy if exists "playlist_songs_select_own_playlist" on public.playlist_songs;
create policy "playlist_songs_select_own_playlist"
on public.playlist_songs
for select
to authenticated
using (
  exists (
    select 1
    from public.playlists p
    where p.id = playlist_songs.playlist_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "playlist_songs_insert_own_playlist_visible_song" on public.playlist_songs;
create policy "playlist_songs_insert_own_playlist_visible_song"
on public.playlist_songs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.playlists p
    where p.id = playlist_songs.playlist_id
      and p.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.songs s
    where s.id = playlist_songs.song_id
      and (s.user_id = auth.uid() or s.is_public = true)
  )
);

drop policy if exists "playlist_songs_delete_own_playlist" on public.playlist_songs;
create policy "playlist_songs_delete_own_playlist"
on public.playlist_songs
for delete
to authenticated
using (
  exists (
    select 1
    from public.playlists p
    where p.id = playlist_songs.playlist_id
      and p.user_id = auth.uid()
  )
);

-- STORAGE
-- Bucket harus bernama tepat: songs.
insert into storage.buckets (id, name, public)
values ('songs', 'songs', false)
on conflict (id) do update set public = false;

-- Path file dibuat oleh aplikasi sebagai:
-- USER_ID/SONG_ID.ext
drop policy if exists "songs_storage_insert_own_folder" on storage.objects;
create policy "songs_storage_insert_own_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'songs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "songs_storage_select_owner_or_public" on storage.objects;
create policy "songs_storage_select_owner_or_public"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'songs'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1
      from public.songs s
      where s.storage_path = storage.objects.name
        and s.is_public = true
    )
  )
);

drop policy if exists "songs_storage_update_own_folder" on storage.objects;
create policy "songs_storage_update_own_folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'songs'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'songs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "songs_storage_delete_own_folder" on storage.objects;
create policy "songs_storage_delete_own_folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'songs'
  and (storage.foldername(name))[1] = auth.uid()::text
);
