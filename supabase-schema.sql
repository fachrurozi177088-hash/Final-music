create table if not exists public.songs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  artist text not null default 'Unknown Artist',
  album text not null default 'Cloud Music',
  storage_path text not null unique,
  mime_type text,
  favorite boolean not null default false,
  is_public boolean not null default false,
  last_played timestamptz,
  created_at timestamptz not null default now()
);
alter table public.songs add column if not exists is_public boolean not null default false;
create table if not exists public.playlists (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.playlist_songs (
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (playlist_id, song_id)
);

alter table public.songs enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_songs enable row level security;

drop policy if exists "songs_select_own" on public.songs;
drop policy if exists "songs_insert_own" on public.songs;
drop policy if exists "songs_update_own" on public.songs;
drop policy if exists "songs_delete_own" on public.songs;
create policy "songs_select_public_or_own" on public.songs for select using (auth.uid() = user_id or is_public = true);
create policy "songs_insert_own" on public.songs for insert with check (auth.uid() = user_id);
create policy "songs_update_own" on public.songs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "songs_delete_own" on public.songs for delete using (auth.uid() = user_id);

drop policy if exists "playlists_select_own" on public.playlists;
drop policy if exists "playlists_insert_own" on public.playlists;
drop policy if exists "playlists_update_own" on public.playlists;
drop policy if exists "playlists_delete_own" on public.playlists;
create policy "playlists_select_own" on public.playlists for select using (auth.uid() = user_id);
create policy "playlists_insert_own" on public.playlists for insert with check (auth.uid() = user_id);
create policy "playlists_update_own" on public.playlists for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "playlists_delete_own" on public.playlists for delete using (auth.uid() = user_id);

drop policy if exists "playlist_songs_select_own" on public.playlist_songs;
drop policy if exists "playlist_songs_insert_own" on public.playlist_songs;
drop policy if exists "playlist_songs_delete_own" on public.playlist_songs;
create policy "playlist_songs_select_own" on public.playlist_songs for select using (auth.uid() = user_id);
create policy "playlist_songs_insert_own" on public.playlist_songs for insert with check (auth.uid() = user_id);
create policy "playlist_songs_delete_own" on public.playlist_songs for delete using (auth.uid() = user_id);

insert into storage.buckets (id, name, public) values ('songs','songs',false) on conflict (id) do update set public=false;

drop policy if exists "songs_storage_select_own" on storage.objects;
drop policy if exists "songs_storage_insert_own" on storage.objects;
drop policy if exists "songs_storage_update_own" on storage.objects;
drop policy if exists "songs_storage_delete_own" on storage.objects;
create policy "songs_storage_select_public_or_own" on storage.objects for select to authenticated using (bucket_id='songs' and ((storage.foldername(name))[1]=(select auth.uid()::text) or exists (select 1 from public.songs s where s.storage_path = name and s.is_public = true)));
create policy "songs_storage_insert_own" on storage.objects for insert to authenticated with check (bucket_id='songs' and (storage.foldername(name))[1]=(select auth.uid()::text));
create policy "songs_storage_update_own" on storage.objects for update to authenticated using (bucket_id='songs' and (storage.foldername(name))[1]=(select auth.uid()::text)) with check (bucket_id='songs' and (storage.foldername(name))[1]=(select auth.uid()::text));
create policy "songs_storage_delete_own" on storage.objects for delete to authenticated using (bucket_id='songs' and (storage.foldername(name))[1]=(select auth.uid()::text));
