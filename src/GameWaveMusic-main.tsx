import React, {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createRoot } from 'react-dom/client';
import { createClient, Session, User } from '@supabase/supabase-js';
import './styles.css';

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    'GameWave Music: VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY wajib diatur.'
  );
}

const supabase = createClient(
  SUPABASE_URL ?? '',
  SUPABASE_KEY ?? ''
);

type Song = {
  id: string;
  user_id: string;
  title: string;
  artist: string | null;
  album: string | null;
  storage_path: string;
  cover_url: string | null;
  duration: number | null;
  is_public: boolean;
  created_at: string;
};

type Playlist = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  songCount?: number;
};

type PlaylistSong = {
  playlist_id: string;
  song_id: string;
};

type Page = 'home' | 'public' | 'favorites' | 'playlists' | 'search';

const FAVORITES_KEY = 'gamewave-favorites-v1';
const RECENT_KEY = 'gamewave-recent-v1';

function readIdList(key: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown;
    return Array.isArray(value) && value.every((item) => typeof item === 'string')
      ? value
      : [];
  } catch {
    return [];
  }
}

function writeIdList(key: string, ids: string[]) {
  localStorage.setItem(key, JSON.stringify(ids.slice(0, 50)));
}

function formatTime(seconds: number | null | undefined): string {
  if (!Number.isFinite(seconds) || !seconds || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function getDisplayName(user: User | null): string {
  if (!user) return 'Guest';
  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  const name = metadata?.full_name ?? metadata?.name;
  return typeof name === 'string' && name.trim()
    ? name.trim()
    : user.email?.split('@')[0] ?? 'User';
}

function getInitials(user: User | null): string {
  const name = getDisplayName(user).trim();
  const parts = name.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2))
    .toUpperCase();
}

function extensionFor(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : 'mp3';
}

function normalizeError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Terjadi kesalahan. Silakan coba lagi.';
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) console.error(error);
      setSession(data.session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (authLoading) {
    return <LoadingScreen label="Memuat GameWave Music..." />;
  }

  if (!session?.user) {
    return <AuthScreen />;
  }

  return <MusicApp user={session.user} />;
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <div className="loading-screen">
      <div className="brand-mark">GW</div>
      <div className="spinner" />
      <p>{label}</p>
    </div>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(
    null
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!email.trim() || !password) {
      setMessage({ type: 'error', text: 'Email dan password wajib diisi.' });
      return;
    }
    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Password minimal 6 karakter.' });
      return;
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: name.trim() || undefined,
            },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage({
            type: 'success',
            text: 'Registrasi berhasil. Cek email jika verifikasi email diaktifkan.',
          });
          setMode('login');
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: normalizeError(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-glow auth-glow-one" />
      <div className="auth-glow auth-glow-two" />
      <section className="auth-card">
        <div className="brand-lockup">
          <div className="brand-mark large">GW</div>
          <div>
            <strong>GameWave</strong>
            <span>Music</span>
          </div>
        </div>

        <div className="auth-copy">
          <span className="eyebrow">YOUR MUSIC. YOUR WAVE.</span>
          <h1>{mode === 'login' ? 'Selamat datang kembali' : 'Buat akun GameWave'}</h1>
          <p>
            Simpan koleksi musikmu di cloud dan dengarkan dari perangkat mana pun.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'register' && (
            <label>
              Nama
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nama kamu"
                autoComplete="name"
              />
            </label>
          )}

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="kamu@email.com"
              autoComplete="email"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimal 6 karakter"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={6}
            />
          </label>

          {message && <div className={`alert ${message.type}`}>{message.text}</div>}

          <button className="primary-button full-width" disabled={busy} type="submit">
            {busy ? 'Memproses...' : mode === 'login' ? 'Masuk' : 'Daftar'}
          </button>
        </form>

        <button
          className="text-button auth-switch"
          type="button"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setMessage(null);
          }}
        >
          {mode === 'login' ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
        </button>
      </section>
    </main>
  );
}

function MusicApp({ user }: { user: User }) {
  const [page, setPage] = useState<Page>('home');
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistSongs, setPlaylistSongs] = useState<PlaylistSong[]>([]);
  const [favorites, setFavorites] = useState<string[]>(() => readIdList(FAVORITES_KEY));
  const [recentIds, setRecentIds] = useState<string[]>(() => readIdList(RECENT_KEY));
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [queue, setQueue] = useState<Song[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlCache = useRef<Map<string, string>>(new Map());

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  const loadSongs = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      try {
        const [ownResult, publicResult] = await Promise.all([
          supabase.from('songs').select('*').eq('user_id', user.id).order('created_at', {
            ascending: false,
          }),
          supabase.from('songs').select('*').eq('is_public', true).order('created_at', {
            ascending: false,
          }),
        ]);

        if (ownResult.error) throw ownResult.error;
        if (publicResult.error) throw publicResult.error;

        const merged = new Map<string, Song>();
        [...(publicResult.data ?? []), ...(ownResult.data ?? [])].forEach((row) => {
          merged.set(row.id as string, row as Song);
        });

        setSongs(Array.from(merged.values()));
      } catch (error) {
        showToast(`Gagal memuat lagu: ${normalizeError(error)}`, 'error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showToast, user.id]
  );

  const loadPlaylists = useCallback(async () => {
    try {
      const { data: playlistData, error: playlistError } = await supabase
        .from('playlists')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (playlistError) throw playlistError;

      const { data: relationData, error: relationError } = await supabase
        .from('playlist_songs')
        .select('playlist_id, song_id');

      if (relationError) throw relationError;

      const relations = (relationData ?? []) as PlaylistSong[];
      setPlaylistSongs(relations);

      const counts = new Map<string, number>();
      relations.forEach((item) => {
        counts.set(item.playlist_id, (counts.get(item.playlist_id) ?? 0) + 1);
      });

      setPlaylists(
        ((playlistData ?? []) as Playlist[]).map((playlist) => ({
          ...playlist,
          songCount: counts.get(playlist.id) ?? 0,
        }))
      );
    } catch (error) {
      showToast(`Gagal memuat playlist: ${normalizeError(error)}`, 'error');
    }
  }, [showToast, user.id]);

  useEffect(() => {
    void Promise.all([loadSongs(), loadPlaylists()]);
  }, [loadPlaylists, loadSongs]);

  useEffect(() => {
    writeIdList(FAVORITES_KEY, favorites);
  }, [favorites]);

  useEffect(() => {
    writeIdList(RECENT_KEY, recentIds);
  }, [recentIds]);

  useEffect(() => {
    return () => {
      urlCache.current.clear();
    };
  }, []);

  const ownSongs = useMemo(
    () => songs.filter((song) => song.user_id === user.id),
    [songs, user.id]
  );

  const publicSongs = useMemo(
    () => songs.filter((song) => song.is_public),
    [songs]
  );

  const favoriteSongs = useMemo(
    () => songs.filter((song) => favorites.includes(song.id)),
    [favorites, songs]
  );

  const recentSongs = useMemo(
    () =>
      recentIds
        .map((id) => songs.find((song) => song.id === id))
        .filter((song): song is Song => Boolean(song)),
    [recentIds, songs]
  );

  const searchResults = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return songs.filter((song) =>
      [song.title, song.artist, song.album].some((value) =>
        (value ?? '').toLowerCase().includes(term)
      )
    );
  }, [search, songs]);

  const visibleSongsForPage = useMemo(() => {
    switch (page) {
      case 'public':
        return publicSongs;
      case 'favorites':
        return favoriteSongs;
      case 'search':
        return searchResults;
      default:
        return ownSongs;
    }
  }, [favoriteSongs, ownSongs, page, publicSongs, searchResults]);

  const getSignedUrl = useCallback(
    async (song: Song): Promise<string> => {
      const cached = urlCache.current.get(song.id);
      if (cached) return cached;

      const { data, error } = await supabase.storage
        .from('songs')
        .createSignedUrl(song.storage_path, 3600);

      if (error || !data?.signedUrl) {
        throw error ?? new Error('Signed URL tidak tersedia.');
      }

      urlCache.current.set(song.id, data.signedUrl);
      return data.signedUrl;
    },
    []
  );

  const playSong = useCallback(
    async (song: Song, newQueue?: Song[]) => {
      try {
        const audio = audioRef.current;
        if (!audio) return;

        const list = newQueue && newQueue.length > 0 ? newQueue : songs;
        setQueue(list);
        setCurrentSong(song);

        const url = await getSignedUrl(song);
        audio.src = url;
        audio.load();
        await audio.play();

        setIsPlaying(true);
        setRecentIds((previous) => [song.id, ...previous.filter((id) => id !== song.id)].slice(0, 20));
      } catch (error) {
        showToast(`Tidak dapat memutar lagu: ${normalizeError(error)}`, 'error');
        setIsPlaying(false);
      }
    },
    [getSignedUrl, showToast, songs]
  );

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentSong) {
      const first = visibleSongsForPage[0] ?? songs[0];
      if (first) await playSong(first, visibleSongsForPage.length ? visibleSongsForPage : songs);
      return;
    }

    try {
      if (audio.paused) {
        await audio.play();
        setIsPlaying(true);
      } else {
        audio.pause();
        setIsPlaying(false);
      }
    } catch (error) {
      showToast(`Gagal menjalankan player: ${normalizeError(error)}`, 'error');
    }
  }, [currentSong, playSong, showToast, songs, visibleSongsForPage]);

  const playRelative = useCallback(
    async (direction: 'next' | 'previous') => {
      if (queue.length === 0) return;
      const currentIndex = currentSong ? queue.findIndex((song) => song.id === currentSong.id) : -1;
      let nextIndex: number;

      if (direction === 'next' && shuffle && queue.length > 1) {
        do {
          nextIndex = Math.floor(Math.random() * queue.length);
        } while (nextIndex === currentIndex);
      } else {
        nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
        if (nextIndex < 0) nextIndex = queue.length - 1;
        if (nextIndex >= queue.length) nextIndex = 0;
      }

      await playSong(queue[nextIndex], queue);
    },
    [currentSong, playSong, queue, shuffle]
  );

  const handleEnded = useCallback(() => {
    if (repeat && audioRef.current) {
      audioRef.current.currentTime = 0;
      void audioRef.current.play();
      return;
    }

    if (queue.length === 0) {
      setIsPlaying(false);
      return;
    }

    const currentIndex = currentSong ? queue.findIndex((song) => song.id === currentSong.id) : -1;
    let nextIndex: number;

    if (shuffle && queue.length > 1) {
      do {
        nextIndex = Math.floor(Math.random() * queue.length);
      } while (nextIndex === currentIndex);
    } else {
      nextIndex = currentIndex + 1;
    }

    if (nextIndex < queue.length) {
      void playSong(queue[nextIndex], queue);
    } else {
      setIsPlaying(false);
    }
  }, [currentSong, playSong, queue, repeat, shuffle]);

  async function toggleFavorite(songId: string) {
    setFavorites((previous) =>
      previous.includes(songId)
        ? previous.filter((id) => id !== songId)
        : [songId, ...previous]
    );
  }

  async function togglePublic(song: Song) {
    if (song.user_id !== user.id) return;

    const nextValue = !song.is_public;
    const { error } = await supabase
      .from('songs')
      .update({ is_public: nextValue })
      .eq('id', song.id)
      .eq('user_id', user.id);

    if (error) {
      showToast(`Gagal mengubah status: ${normalizeError(error)}`, 'error');
      return;
    }

    setSongs((previous) =>
      previous.map((item) => (item.id === song.id ? { ...item, is_public: nextValue } : item))
    );
    showToast(nextValue ? 'Lagu sekarang Public.' : 'Lagu sekarang Private.');
  }

  async function deleteSong(song: Song) {
    if (song.user_id !== user.id) return;

    const confirmed = window.confirm(`Hapus "${song.title}"? File musik juga akan dihapus.`);
    if (!confirmed) return;

    if (currentSong?.id === song.id) {
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.removeAttribute('src');
      setCurrentSong(null);
      setIsPlaying(false);
    }

    const { error: dbError } = await supabase
      .from('songs')
      .delete()
      .eq('id', song.id)
      .eq('user_id', user.id);

    if (dbError) {
      showToast(`Gagal menghapus lagu: ${normalizeError(dbError)}`, 'error');
      return;
    }

    const { error: storageError } = await supabase.storage.from('songs').remove([song.storage_path]);
    if (storageError) {
      showToast(`Record terhapus, tetapi file Storage gagal dihapus: ${normalizeError(storageError)}`, 'error');
    } else {
      showToast('Lagu berhasil dihapus.');
    }

    urlCache.current.delete(song.id);
    setSongs((previous) => previous.filter((item) => item.id !== song.id));
    setFavorites((previous) => previous.filter((id) => id !== song.id));
    setRecentIds((previous) => previous.filter((id) => id !== song.id));
    setPlaylistSongs((previous) => previous.filter((item) => item.song_id !== song.id));
  }

  async function createPlaylist(name: string, description: string) {
    const trimmedName = name.trim();
    if (!trimmedName) {
      showToast('Nama playlist wajib diisi.', 'error');
      return;
    }

    const { data, error } = await supabase
      .from('playlists')
      .insert({
        user_id: user.id,
        name: trimmedName,
        description: description.trim() || null,
      })
      .select('*')
      .single();

    if (error) {
      showToast(`Gagal membuat playlist: ${normalizeError(error)}`, 'error');
      return;
    }

    setPlaylists((previous) => [{ ...(data as Playlist), songCount: 0 }, ...previous]);
    setPlaylistOpen(false);
    showToast('Playlist dibuat.');
  }

  async function addToPlaylist(playlistId: string, songId: string) {
    const exists = playlistSongs.some(
      (item) => item.playlist_id === playlistId && item.song_id === songId
    );
    if (exists) {
      showToast('Lagu sudah ada di playlist.', 'error');
      return;
    }

    const { error } = await supabase.from('playlist_songs').insert({
      playlist_id: playlistId,
      song_id: songId,
    });

    if (error) {
      showToast(`Gagal menambahkan lagu: ${normalizeError(error)}`, 'error');
      return;
    }

    setPlaylistSongs((previous) => [...previous, { playlist_id: playlistId, song_id: songId }]);
    setPlaylists((previous) =>
      previous.map((playlist) =>
        playlist.id === playlistId
          ? { ...playlist, songCount: (playlist.songCount ?? 0) + 1 }
          : playlist
      )
    );
    showToast('Lagu ditambahkan ke playlist.');
  }

  async function deletePlaylist(playlist: Playlist) {
    const confirmed = window.confirm(`Hapus playlist "${playlist.name}"?`);
    if (!confirmed) return;

    const { error } = await supabase
      .from('playlists')
      .delete()
      .eq('id', playlist.id)
      .eq('user_id', user.id);

    if (error) {
      showToast(`Gagal menghapus playlist: ${normalizeError(error)}`, 'error');
      return;
    }

    setPlaylists((previous) => previous.filter((item) => item.id !== playlist.id));
    setPlaylistSongs((previous) => previous.filter((item) => item.playlist_id !== playlist.id));
    if (selectedPlaylist?.id === playlist.id) setSelectedPlaylist(null);
    showToast('Playlist dihapus.');
  }

  async function openPlaylist(playlist: Playlist) {
    const relations = playlistSongs
      .filter((item) => item.playlist_id === playlist.id)
      .map((item) => item.song_id);
    const list = relations
      .map((id) => songs.find((song) => song.id === id))
      .filter((song): song is Song => Boolean(song));

    setSelectedPlaylist({ ...playlist });
    if (list.length > 0) {
      await playSong(list[0], list);
    } else {
      showToast('Playlist ini belum memiliki lagu.', 'error');
    }
  }

  async function handleUpload(
    file: File,
    title: string,
    artist: string,
    album: string,
    isPublic: boolean
  ) {
    const songId = crypto.randomUUID();
    const extension = extensionFor(file.name);
    const storagePath = `${user.id}/${songId}.${extension}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('songs')
        .upload(storagePath, file, {
          contentType: file.type || 'audio/mpeg',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const duration = await readAudioDuration(file);

      const { data, error: insertError } = await supabase
        .from('songs')
        .insert({
          id: songId,
          user_id: user.id,
          title: title.trim() || file.name.replace(/\.[^/.]+$/, ''),
          artist: artist.trim() || null,
          album: album.trim() || null,
          storage_path: storagePath,
          cover_url: null,
          duration,
          is_public: isPublic,
        })
        .select('*')
        .single();

      if (insertError) {
        await supabase.storage.from('songs').remove([storagePath]);
        throw insertError;
      }

      setSongs((previous) => [data as Song, ...previous]);
      setUploadOpen(false);
      showToast(isPublic ? 'Lagu berhasil di-upload sebagai Public.' : 'Lagu berhasil di-upload.');
    } catch (error) {
      showToast(`Upload gagal: ${normalizeError(error)}`, 'error');
    }
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  const pageTitle =
    page === 'home'
      ? 'Beranda'
      : page === 'public'
        ? 'Public Music'
        : page === 'favorites'
          ? 'Favorite'
          : page === 'playlists'
            ? 'Playlist'
            : 'Cari Musik';

  return (
    <div className="app-shell">
      <audio
        ref={audioRef}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={handleEnded}
        preload="metadata"
      />

      <aside className="desktop-sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">GW</div>
          <div>
            <strong>GameWave</strong>
            <span>Music</span>
          </div>
        </div>

        <Navigation page={page} setPage={setPage} />
        <div className="sidebar-user">
          <div className="avatar">{getInitials(user)}</div>
          <div className="user-copy">
            <strong>{getDisplayName(user)}</strong>
            <span>{user.email}</span>
          </div>
          <button className="icon-button" onClick={() => void logout()} title="Logout" type="button">
            ↪
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">GAMEWAVE MUSIC</span>
            <h1>{pageTitle}</h1>
          </div>
          <div className="topbar-actions">
            <button
              className="icon-button"
              onClick={() => void loadSongs(true)}
              disabled={refreshing}
              title="Refresh"
              type="button"
            >
              {refreshing ? '…' : '↻'}
            </button>
            <button className="avatar mobile-avatar" type="button" title={user.email ?? ''}>
              {getInitials(user)}
            </button>
          </div>
        </header>

        {page === 'home' && (
          <HomePage
            user={user}
            ownSongs={ownSongs}
            publicSongs={publicSongs}
            favoriteSongs={favoriteSongs}
            recentSongs={recentSongs}
            favorites={favorites}
            onPlay={(song, list) => void playSong(song, list)}
            onFavorite={(songId) => void toggleFavorite(songId)}
            onTogglePublic={(song) => void togglePublic(song)}
            onDelete={(song) => void deleteSong(song)}
            onUpload={() => setUploadOpen(true)}
            playlists={playlists}
            onAddToPlaylist={(playlistId, songId) => void addToPlaylist(playlistId, songId)}
          />
        )}

        {page === 'public' && (
          <section className="page-section">
            <SectionHeading
              title="Public Music"
              subtitle="Lagu public dari seluruh pengguna GameWave."
            />
            {loading ? (
              <InlineLoader />
            ) : (
              <SongList
                songs={publicSongs}
                currentSong={currentSong}
                isPlaying={isPlaying}
                favorites={favorites}
                currentUserId={user.id}
                playlists={playlists}
                onPlay={(song) => void playSong(song, publicSongs)}
                onFavorite={(songId) => void toggleFavorite(songId)}
                onTogglePublic={(song) => void togglePublic(song)}
                onDelete={(song) => void deleteSong(song)}
                onAddToPlaylist={(playlistId, songId) => void addToPlaylist(playlistId, songId)}
              />
            )}
          </section>
        )}

        {page === 'favorites' && (
          <section className="page-section">
            <SectionHeading
              title="Favorite"
              subtitle="Koleksi lagu yang kamu tandai sebagai favorit."
            />
            <SongList
              songs={favoriteSongs}
              currentSong={currentSong}
              isPlaying={isPlaying}
              favorites={favorites}
              currentUserId={user.id}
              playlists={playlists}
              onPlay={(song) => void playSong(song, favoriteSongs)}
              onFavorite={(songId) => void toggleFavorite(songId)}
              onTogglePublic={(song) => void togglePublic(song)}
              onDelete={(song) => void deleteSong(song)}
              onAddToPlaylist={(playlistId, songId) => void addToPlaylist(playlistId, songId)}
            />
          </section>
        )}

        {page === 'playlists' && (
          <PlaylistPage
            playlists={playlists}
            selectedPlaylist={selectedPlaylist}
            playlistSongs={playlistSongs}
            songs={songs}
            currentSong={currentSong}
            isPlaying={isPlaying}
            favorites={favorites}
            userId={user.id}
            onCreate={() => setPlaylistOpen(true)}
            onOpen={(playlist) => void openPlaylist(playlist)}
            onBack={() => setSelectedPlaylist(null)}
            onDelete={(playlist) => void deletePlaylist(playlist)}
            onPlay={(song, list) => void playSong(song, list)}
            onFavorite={(songId) => void toggleFavorite(songId)}
            onTogglePublic={(song) => void togglePublic(song)}
            onDeleteSong={(song) => void deleteSong(song)}
            onAddToPlaylist={(playlistId, songId) => void addToPlaylist(playlistId, songId)}
          />
        )}

        {page === 'search' && (
          <section className="page-section">
            <div className="search-large">
              <span>⌕</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari judul, artist, atau album..."
                autoFocus
              />
              {search && (
                <button className="clear-button" onClick={() => setSearch('')} type="button">
                  ×
                </button>
              )}
            </div>
            <SectionHeading
              title={search.trim() ? `Hasil untuk "${search.trim()}"` : 'Cari Musik'}
              subtitle="Pencarian mencakup lagu milikmu dan lagu public."
            />
            {search.trim() ? (
              <SongList
                songs={searchResults}
                currentSong={currentSong}
                isPlaying={isPlaying}
                favorites={favorites}
                currentUserId={user.id}
                playlists={playlists}
                onPlay={(song) => void playSong(song, searchResults)}
                onFavorite={(songId) => void toggleFavorite(songId)}
                onTogglePublic={(song) => void togglePublic(song)}
                onDelete={(song) => void deleteSong(song)}
                onAddToPlaylist={(playlistId, songId) => void addToPlaylist(playlistId, songId)}
              />
            ) : (
              <div className="empty-state">
                <div className="empty-icon">⌕</div>
                <h3>Ketik sesuatu untuk mencari</h3>
                <p>Cari berdasarkan judul, artist, atau album.</p>
              </div>
            )}
          </section>
        )}
      </main>

      <MobileNavigation page={page} setPage={setPage} />

      <MiniPlayer
        currentSong={currentSong}
        isPlaying={isPlaying}
        audioRef={audioRef}
        onTogglePlay={() => void togglePlay()}
        onNext={() => void playRelative('next')}
        onPrevious={() => void playRelative('previous')}
      />

      {uploadOpen && (
        <UploadModal
          onClose={() => setUploadOpen(false)}
          onUpload={(file, title, artist, album, isPublic) =>
            handleUpload(file, title, artist, album, isPublic)
          }
        />
      )}

      {playlistOpen && (
        <PlaylistModal
          onClose={() => setPlaylistOpen(false)}
          onCreate={(name, description) => void createPlaylist(name, description)}
        />
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.text}</div>}
    </div>
  );
}

function Navigation({ page, setPage }: { page: Page; setPage: (page: Page) => void }) {
  const items: Array<{ page: Page; label: string; icon: string }> = [
    { page: 'home', label: 'Beranda', icon: '⌂' },
    { page: 'public', label: 'Public', icon: '◎' },
    { page: 'favorites', label: 'Favorite', icon: '♡' },
    { page: 'playlists', label: 'Playlist', icon: '▤' },
    { page: 'search', label: 'Cari', icon: '⌕' },
  ];

  return (
    <nav className="nav-list">
      {items.map((item) => (
        <button
          className={`nav-item ${page === item.page ? 'active' : ''}`}
          key={item.page}
          onClick={() => setPage(item.page)}
          type="button"
        >
          <span>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function MobileNavigation({ page, setPage }: { page: Page; setPage: (page: Page) => void }) {
  return (
    <nav className="mobile-nav">
      <Navigation page={page} setPage={setPage} />
    </nav>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

function HomePage({
  user,
  ownSongs,
  publicSongs,
  favoriteSongs,
  recentSongs,
  favorites,
  onPlay,
  onFavorite,
  onTogglePublic,
  onDelete,
  onUpload,
  playlists,
  onAddToPlaylist,
}: {
  user: User;
  ownSongs: Song[];
  publicSongs: Song[];
  favoriteSongs: Song[];
  recentSongs: Song[];
  favorites: string[];
  onPlay: (song: Song, list: Song[]) => void;
  onFavorite: (songId: string) => void;
  onTogglePublic: (song: Song) => void;
  onDelete: (song: Song) => void;
  onUpload: () => void;
  playlists: Playlist[];
  onAddToPlaylist: (playlistId: string, songId: string) => void;
}) {
  void user;

  return (
    <div className="home-page">
      <section className="hero-card">
        <div>
          <span className="eyebrow">MUSIC CLOUD</span>
          <h2>Musikmu, di mana saja.</h2>
          <p>Upload koleksi dari HP dan dengarkan kembali dari perangkat lain.</p>
          <button className="primary-button" onClick={onUpload} type="button">
            ＋ Upload Lagu
          </button>
        </div>
        <div className="hero-disc" aria-hidden="true">
          <div className="disc-center">GW</div>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard label="Total lagu tersedia" value={new Set([...ownSongs, ...publicSongs].map((song) => song.id)).size} icon="♫" />
        <StatCard label="Lagu saya" value={ownSongs.length} icon="▣" />
        <StatCard label="Public" value={publicSongs.length} icon="◎" />
        <StatCard label="Favorite" value={favoriteSongs.length} icon="♥" />
      </section>

      <section className="content-section">
        <SectionHeading title="Baru Diputar" subtitle="Lanjutkan musik terakhir yang kamu dengarkan." />
        {recentSongs.length ? (
          <SongList
            songs={recentSongs}
            currentSong={null}
            isPlaying={false}
            favorites={favorites}
            currentUserId={user.id}
            playlists={playlists}
            onPlay={(song) => onPlay(song, recentSongs)}
            onFavorite={onFavorite}
            onTogglePublic={onTogglePublic}
            onDelete={onDelete}
            onAddToPlaylist={onAddToPlaylist}
          />
        ) : (
          <EmptyCompact text="Belum ada lagu yang diputar." />
        )}
      </section>

      <section className="content-section">
        <SectionHeading title="Koleksi Saya" subtitle="Lagu yang kamu upload ke GameWave." />
        {ownSongs.length ? (
          <SongList
            songs={ownSongs.slice(0, 8)}
            currentSong={null}
            isPlaying={false}
            favorites={favorites}
            currentUserId={user.id}
            playlists={playlists}
            onPlay={(song) => onPlay(song, ownSongs)}
            onFavorite={onFavorite}
            onTogglePublic={onTogglePublic}
            onDelete={onDelete}
            onAddToPlaylist={onAddToPlaylist}
          />
        ) : (
          <EmptyCompact text="Belum ada lagu. Upload lagu pertamamu." action={onUpload} />
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="stat-card">
      <span className="stat-icon">{icon}</span>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function SongList({
  songs,
  currentSong,
  isPlaying,
  favorites,
  currentUserId,
  playlists,
  onPlay,
  onFavorite,
  onTogglePublic,
  onDelete,
  onAddToPlaylist,
}: {
  songs: Song[];
  currentSong: Song | null;
  isPlaying: boolean;
  favorites: string[];
  currentUserId: string;
  playlists: Playlist[];
  onPlay: (song: Song) => void;
  onFavorite: (songId: string) => void;
  onTogglePublic: (song: Song) => void;
  onDelete: (song: Song) => void;
  onAddToPlaylist: (playlistId: string, songId: string) => void;
}) {
  if (!songs.length) {
    return (
      <div className="empty-state compact">
        <div className="empty-icon">♫</div>
        <h3>Belum ada lagu di sini</h3>
        <p>Upload lagu atau buka Public Music untuk menemukan koleksi lain.</p>
      </div>
    );
  }

  return (
    <div className="song-list">
      {songs.map((song, index) => (
        <SongRow
          key={song.id}
          song={song}
          index={index}
          isCurrent={currentSong?.id === song.id}
          isPlaying={isPlaying}
          isFavorite={favorites.includes(song.id)}
          isOwner={song.user_id === currentUserId}
          playlists={playlists}
          onPlay={() => onPlay(song)}
          onFavorite={() => onFavorite(song.id)}
          onTogglePublic={() => onTogglePublic(song)}
          onDelete={() => onDelete(song)}
          onAddToPlaylist={(playlistId) => onAddToPlaylist(playlistId, song.id)}
        />
      ))}
    </div>
  );
}

function SongRow({
  song,
  index,
  isCurrent,
  isPlaying,
  isFavorite,
  isOwner,
  playlists,
  onPlay,
  onFavorite,
  onTogglePublic,
  onDelete,
  onAddToPlaylist,
}: {
  song: Song;
  index: number;
  isCurrent: boolean;
  isPlaying: boolean;
  isFavorite: boolean;
  isOwner: boolean;
  playlists: Playlist[];
  onPlay: () => void;
  onFavorite: () => void;
  onTogglePublic: () => void;
  onDelete: () => void;
  onAddToPlaylist: (playlistId: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <article className={`song-row ${isCurrent ? 'current' : ''}`}>
      <button className="song-cover" onClick={onPlay} type="button" title="Putar">
        {song.cover_url ? (
          <img src={song.cover_url} alt="" />
        ) : (
          <span>{isCurrent && isPlaying ? 'Ⅱ' : index + 1}</span>
        )}
      </button>

      <button className="song-main" onClick={onPlay} type="button">
        <strong>{song.title}</strong>
        <span>{song.artist || 'Unknown artist'}</span>
      </button>

      <span className="song-album">{song.album || '—'}</span>

      <span className={`visibility-badge ${song.is_public ? 'public' : 'private'}`}>
        {song.is_public ? 'Public' : 'Private'}
      </span>

      <span className="song-duration">{formatTime(song.duration)}</span>

      <div className="song-actions">
        <button
          className={`icon-button favorite-button ${isFavorite ? 'liked' : ''}`}
          onClick={onFavorite}
          title="Favorite"
          type="button"
        >
          {isFavorite ? '♥' : '♡'}
        </button>

        <div className="menu-wrap">
          <button
            className="icon-button"
            onClick={() => setMenuOpen((value) => !value)}
            title="Menu"
            type="button"
          >
            ⋮
          </button>
          {menuOpen && (
            <div className="action-menu">
              {playlists.length > 0 &&
                playlists.map((playlist) => (
                  <button
                    key={playlist.id}
                    onClick={() => {
                      onAddToPlaylist(playlist.id);
                      setMenuOpen(false);
                    }}
                    type="button"
                  >
                    ＋ {playlist.name}
                  </button>
                ))}
              {playlists.length === 0 && <span className="menu-empty">Buat playlist dulu.</span>}
              {isOwner && (
                <>
                  <button
                    onClick={() => {
                      onTogglePublic();
                      setMenuOpen(false);
                    }}
                    type="button"
                  >
                    {song.is_public ? 'Jadikan Private' : 'Jadikan Public'}
                  </button>
                  <button
                    className="danger-text"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete();
                    }}
                    type="button"
                  >
                    Hapus lagu
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function PlaylistPage({
  playlists,
  selectedPlaylist,
  playlistSongs,
  songs,
  currentSong,
  isPlaying,
  favorites,
  userId,
  onCreate,
  onOpen,
  onBack,
  onDelete,
  onPlay,
  onFavorite,
  onTogglePublic,
  onDeleteSong,
  onAddToPlaylist,
}: {
  playlists: Playlist[];
  selectedPlaylist: Playlist | null;
  playlistSongs: PlaylistSong[];
  songs: Song[];
  currentSong: Song | null;
  isPlaying: boolean;
  favorites: string[];
  userId: string;
  onCreate: () => void;
  onOpen: (playlist: Playlist) => void;
  onBack: () => void;
  onDelete: (playlist: Playlist) => void;
  onPlay: (song: Song, list: Song[]) => void;
  onFavorite: (songId: string) => void;
  onTogglePublic: (song: Song) => void;
  onDeleteSong: (song: Song) => void;
  onAddToPlaylist: (playlistId: string, songId: string) => void;
}) {
  const selectedSongs = selectedPlaylist
    ? playlistSongs
        .filter((item) => item.playlist_id === selectedPlaylist.id)
        .map((item) => songs.find((song) => song.id === item.song_id))
        .filter((song): song is Song => Boolean(song))
    : [];

  return (
    <section className="page-section">
      <div className="section-heading with-button">
        <div>
          <h2>Playlist</h2>
          <p>Buat koleksi musik sesuai mood atau game kamu.</p>
        </div>
        <button className="primary-button" onClick={onCreate} type="button">
          ＋ Playlist
        </button>
      </div>

      {selectedPlaylist ? (
        <div className="playlist-detail">
          <button className="back-button" onClick={onBack} type="button">
            ← Kembali
          </button>
          <div className="playlist-hero">
            <div className="playlist-art">♫</div>
            <div>
              <span className="eyebrow">PLAYLIST</span>
              <h2>{selectedPlaylist.name}</h2>
              <p>{selectedPlaylist.description || 'Tanpa deskripsi'}</p>
              <small>{selectedSongs.length} lagu</small>
            </div>
          </div>
          <SongList
            songs={selectedSongs}
            currentSong={currentSong}
            isPlaying={isPlaying}
            favorites={favorites}
            currentUserId={userId}
            playlists={playlists}
            onPlay={(song) => onPlay(song, selectedSongs)}
            onFavorite={onFavorite}
            onTogglePublic={onTogglePublic}
            onDelete={onDeleteSong}
            onAddToPlaylist={onAddToPlaylist}
          />
        </div>
      ) : playlists.length ? (
        <div className="playlist-grid">
          {playlists.map((playlist) => (
            <article className="playlist-card" key={playlist.id}>
              <button className="playlist-art" onClick={() => onOpen(playlist)} type="button">
                ♫
              </button>
              <div className="playlist-card-info">
                <h3>{playlist.name}</h3>
                <p>{playlist.description || 'Tanpa deskripsi'}</p>
                <span>{playlist.songCount ?? 0} lagu</span>
              </div>
              <div className="playlist-card-actions">
                <button className="secondary-button" onClick={() => onOpen(playlist)} type="button">
                  Buka
                </button>
                <button
                  className="icon-button danger-icon"
                  onClick={() => onDelete(playlist)}
                  title="Hapus playlist"
                  type="button"
                >
                  ×
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">▤</div>
          <h3>Belum ada playlist</h3>
          <p>Buat playlist pertama untuk mengatur koleksi musikmu.</p>
          <button className="primary-button" onClick={onCreate} type="button">
            Buat Playlist
          </button>
        </div>
      )}
    </section>
  );
}

function MiniPlayer({
  currentSong,
  isPlaying,
  audioRef,
  onTogglePlay,
  onNext,
  onPrevious,
  shuffle,
  repeat,
  onShuffle,
  onRepeat,
}: {
  currentSong: Song | null;
  isPlaying: boolean;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrevious: () => void;
  shuffle: boolean;
  repeat: boolean;
  onShuffle: () => void;
  onRepeat: () => void;
}) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime || 0);
    const updateDuration = () => setDuration(audio.duration || currentSong?.duration || 0);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
    };
  }, [audioRef, currentSong]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = volume;
  }, [audioRef, volume]);

  if (!currentSong) return null;

  const total = duration || currentSong.duration || 0;
  const progress = total > 0 ? Math.min(100, (currentTime / total) * 100) : 0;

  function seek(event: ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current;
    const next = Number(event.target.value);
    setCurrentTime(next);
    if (audio) audio.currentTime = next;
  }

  return (
    <div className="mini-player">
      <div className="player-song">
        <div className="player-cover">
          {currentSong.cover_url ? <img src={currentSong.cover_url} alt="" /> : '♫'}
        </div>
        <div className="player-copy">
          <strong>{currentSong.title}</strong>
          <span>{currentSong.artist || 'Unknown artist'}</span>
        </div>
      </div>

      <div className="player-controls">
        <div className="player-buttons">
          <button
            className={`player-control ${shuffle ? 'active' : ''}`}
            onClick={onShuffle}
            title="Shuffle"
            type="button"
          >
            ⤨
          </button>
          <button className="player-control" onClick={onPrevious} title="Previous" type="button">
            ◀
          </button>
          <button className="play-main" onClick={onTogglePlay} title="Play/Pause" type="button">
            {isPlaying ? 'Ⅱ' : '▶'}
          </button>
          <button className="player-control" onClick={onNext} title="Next" type="button">
            ▶
          </button>
          <button
            className={`player-control ${repeat ? 'active' : ''}`}
            onClick={onRepeat}
            title="Repeat"
            type="button"
          >
            ↻
          </button>
        </div>

        <div className="progress-row">
          <span>{formatTime(currentTime)}</span>
          <input
            className="range"
            type="range"
            min="0"
            max={total || 0}
            step="0.1"
            value={Math.min(currentTime, total || 0)}
            onChange={seek}
            style={{ '--progress': `${progress}%` } as React.CSSProperties}
          />
          <span>{formatTime(total)}</span>
        </div>
      </div>

      <div className="volume-control">
        <span>{volume === 0 ? '×' : '◖'}</span>
        <input
          className="range"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(event) => setVolume(Number(event.target.value))}
        />
      </div>
    </div>
  );
}

function UploadModal({
  onClose,
  onUpload,
}: {
  onClose: () => void;
  onUpload: (
    file: File,
    title: string,
    artist: string,
    album: string,
    isPublic: boolean
  ) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    if (selected && !title) {
      setTitle(selected.name.replace(/\.[^/.]+$/, ''));
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    await onUpload(file, title, artist, album, isPublic);
    setBusy(false);
  }

  return (
    <Modal title="Upload Lagu" onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <label className="file-picker">
          <span className="file-icon">♫</span>
          <strong>{file ? file.name : 'Pilih file audio'}</strong>
          <small>MP3, M4A, WAV, OGG, dan format audio lain yang didukung browser</small>
          <input type="file" accept="audio/*" onChange={chooseFile} required />
        </label>

        <label>
          Judul
          <input value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>
        <label>
          Artist
          <input value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="Opsional" />
        </label>
        <label>
          Album
          <input value={album} onChange={(event) => setAlbum(event.target.value)} placeholder="Opsional" />
        </label>

        <label className="switch-row">
          <span>
            <strong>Public Music</strong>
            <small>Jika aktif, pengguna lain dapat menemukan dan memutarnya.</small>
          </span>
          <input
            className="switch"
            type="checkbox"
            checked={isPublic}
            onChange={(event) => setIsPublic(event.target.checked)}
          />
        </label>

        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose} type="button">
            Batal
          </button>
          <button className="primary-button" disabled={!file || busy} type="submit">
            {busy ? 'Meng-upload...' : 'Upload'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PlaylistModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, description: string) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  return (
    <Modal title="Buat Playlist" onClose={onClose}>
      <form
        className="modal-form"
        onSubmit={(event) => {
          event.preventDefault();
          onCreate(name, description);
        }}
      >
        <label>
          Nama playlist
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Contoh: ML Rank Push"
            required
          />
        </label>
        <label>
          Deskripsi
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Deskripsi singkat (opsional)"
            rows={4}
          />
        </label>
        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose} type="button">
            Batal
          </button>
          <button className="primary-button" type="submit">
            Buat Playlist
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal-card" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} type="button">
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function InlineLoader() {
  return (
    <div className="inline-loader">
      <div className="spinner" />
      <span>Memuat lagu...</span>
    </div>
  );
}

function EmptyCompact({ text, action }: { text: string; action?: () => void }) {
  return (
    <div className="empty-compact">
      <span>♫</span>
      <p>{text}</p>
      {action && (
        <button className="text-button" onClick={action} type="button">
          Upload sekarang →
        </button>
      )}
    </div>
  );
}

function readAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = document.createElement('audio');

    const cleanup = () => {
      URL.revokeObjectURL(url);
      audio.remove();
    };

    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : null;
      cleanup();
      resolve(duration);
    };
    audio.onerror = () => {
      cleanup();
      resolve(null);
    };
    audio.src = url;
  });
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
