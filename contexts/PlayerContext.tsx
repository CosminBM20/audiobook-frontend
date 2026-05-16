'use client';

import React, {
  createContext, useContext, useRef,
  useState, useEffect, useCallback, useMemo,
} from 'react';
import { API_URL } from '@/lib/api';

export interface PlayerBook {
  id: string;
  title: string;
  description: string;
  coverImageUrl: string;
  audioFileUrl: string;
  durationSeconds: number;
  author: { name: string };
  category: { name: string };
}

// ── STABLE context — changes only when book/controls change ─────────────────
// Components that only need book info or controls subscribe here.
// They will NOT re-render on every `timeupdate` tick.
interface PlayerStableValue {
  book: PlayerBook | null;
  isPlaying: boolean;
  isLoading: boolean;
  duration: number;
  volume: number;
  playbackRate: number;
  playBook: (id: string) => Promise<void>;
  loadBook: (id: string) => Promise<void>; // load + prepare audio WITHOUT auto-playing
  toggle: () => void;
  seek: (time: number) => void;
  skip: (seconds: number) => void;
  setVolume: (v: number) => void;
  setPlaybackRate: (r: number) => void;
}

// ── VOLATILE context — updates ~4× per second while playing ─────────────────
// Only subscribe if you actually render the current time.
interface PlayerTimeValue {
  currentTime: number;
  progressPct: number; // pre-computed so consumers don't divide on every render
}

const PlayerStableContext = createContext<PlayerStableValue | null>(null);
const PlayerTimeContext   = createContext<PlayerTimeValue>({ currentTime: 0, progressPct: 0 });

/** Controls, book info, volume — stable, cheap to subscribe to. */
export function usePlayerControls() {
  const ctx = useContext(PlayerStableContext);
  if (!ctx) throw new Error('usePlayerControls must be inside PlayerProvider');
  return ctx;
}

/** Current playback time — volatile, re-renders on every tick. */
export function usePlayerTime() {
  return useContext(PlayerTimeContext);
}

/** Convenience hook that returns everything — use only in components
 *  that already need the time value (BottomPlayer, AudiobookDetailPage). */
export function usePlayer() {
  return { ...usePlayerControls(), ...usePlayerTime() };
}

// ── Module-level singleton Audio element ─────────────────────────────────────
// Created synchronously at module-load time (browser only), so it is always
// available when React effects run. This eliminates the race condition where
// the audiobook detail page's useEffect calls playBook() before PlayerProvider's
// own useEffect has had a chance to call `new Audio()` (React commits children's
// effects before parents').
const _sharedAudio =
  typeof window !== 'undefined'
    ? Object.assign(new Audio(), { preload: 'metadata' } as Partial<HTMLAudioElement>)
    : null;

// ── Provider ─────────────────────────────────────────────────────────────────

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  // ── Stable state
  const [book,        setBook]        = useState<PlayerBook | null>(null);
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [isLoading,   setIsLoading]   = useState(false);
  const [duration,    setDuration]    = useState(0);
  const [volume,      setVolumeState] = useState(1);
  const [playbackRate, setRateState]  = useState(1);

  // ── Volatile state
  const [currentTime, setCurrentTime] = useState(0);
  const [progressPct, setProgressPct] = useState(0);

  // ── Refs
  // audioRef starts with the module-level singleton so it is never null in browser.
  const audioRef   = useRef<HTMLAudioElement | null>(_sharedAudio);
  const timeRef    = useRef(0);
  const durRef     = useRef(0);
  const bookIdRef  = useRef<string | null>(null);
  const volumeRef  = useRef(1);
  const rateRef    = useRef(1);

  // ── Attach event listeners to the already-created audio element ──────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return; // SSR guard — _sharedAudio is null on server

    const onTimeUpdate = () => {
      const t = audio.currentTime;
      const d = durRef.current;
      timeRef.current = t;
      setCurrentTime(t);
      setProgressPct(d > 0 ? (t / d) * 100 : 0);
    };
    const onMetadata = () => {
      const d = audio.duration;
      durRef.current = d;
      setDuration(d);
    };
    const onPlay     = () => { setIsPlaying(true);  setIsLoading(false); };
    const onPause    = () => setIsPlaying(false);
    const onEnded    = () => setIsPlaying(false);
    const onWaiting  = () => setIsLoading(true);
    const onCanPlay  = () => setIsLoading(false);

    audio.addEventListener('timeupdate',     onTimeUpdate);
    audio.addEventListener('loadedmetadata', onMetadata);
    audio.addEventListener('play',           onPlay);
    audio.addEventListener('pause',          onPause);
    audio.addEventListener('ended',          onEnded);
    audio.addEventListener('waiting',        onWaiting);
    audio.addEventListener('canplay',        onCanPlay);

    const onUnload = () => {
      if (bookIdRef.current && timeRef.current > 1) saveProgress(bookIdRef.current, timeRef.current);
    };
    window.addEventListener('beforeunload', onUnload);

    return () => {
      audio.pause();
      audio.src = '';
      audio.removeEventListener('timeupdate',     onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onMetadata);
      audio.removeEventListener('play',           onPlay);
      audio.removeEventListener('pause',          onPause);
      audio.removeEventListener('ended',          onEnded);
      audio.removeEventListener('waiting',        onWaiting);
      audio.removeEventListener('canplay',        onCanPlay);
      window.removeEventListener('beforeunload',  onUnload);
    };
  }, []);

  // ── Auto-save every 10 s while playing ──────────────────────────────────
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      if (bookIdRef.current && timeRef.current > 1) saveProgress(bookIdRef.current, timeRef.current);
    }, 10_000);
    return () => clearInterval(id);
  }, [isPlaying]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const saveProgress = (bookId: string, position: number) => {
    const token = localStorage.getItem('token');
    if (!token || position < 1) return;
    fetch(`${API_URL}/api/audiobooks/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ audiobookId: bookId, currentPosition: Math.floor(position) }),
    }).catch(() => {});
  };

  // ── Actions (stable references via useCallback with ref deps) ────────────
  const playBook = useCallback(async (id: string) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (bookIdRef.current === id) {
      if (audio.paused) await audio.play().catch(() => {});
      return;
    }

    if (bookIdRef.current && timeRef.current > 1) saveProgress(bookIdRef.current, timeRef.current);

    setIsLoading(true);
    setCurrentTime(0);
    setProgressPct(0);
    timeRef.current = 0;

    try {
      const token   = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};

      const [bookRes, progRes] = await Promise.all([
        fetch(`${API_URL}/api/audiobooks/${id}`),
        token
          ? fetch(`${API_URL}/api/audiobooks/progress/${id}`, { headers })
          : Promise.resolve(new Response(JSON.stringify({ success: false }))),
      ]);

      const bookData = await bookRes.json();
      const progData = await progRes.json();
      if (!bookData.success) return;

      const newBook: PlayerBook = bookData.data;
      setBook(newBook);
      bookIdRef.current = id;

      const savedPos: number = progData.success && progData.lastPosition > 1 ? progData.lastPosition : 0;

      audio.src          = newBook.audioFileUrl;
      audio.volume       = volumeRef.current;
      audio.playbackRate = rateRef.current;

      if (savedPos > 0) {
        const seekOnce = () => {
          audio.currentTime = savedPos;
          setCurrentTime(savedPos);
          timeRef.current = savedPos;
          audio.removeEventListener('loadedmetadata', seekOnce);
        };
        audio.addEventListener('loadedmetadata', seekOnce);
      }

      // Do NOT call audio.load() — setting src already triggers loading.
      // An explicit load() after src assignment aborts the play() promise
      // with an AbortError: "play() interrupted by a new load request".
      await audio.play();
    } catch (err) {
      // AbortError is benign: it means a new load interrupted a pending play(),
      // which can happen on rapid book switches. Not a real error — skip logging.
      if ((err as Error).name !== 'AbortError') {
        console.error('playBook error:', err);
      }
      setIsLoading(false);
    }
  }, []);

  // loadBook: fetch + prepare audio but do NOT call audio.play().
  // Use this inside useEffect (no user gesture). The user must then click
  // a Play button so play() is called directly within a click handler.
  const loadBook = useCallback(async (id: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (bookIdRef.current === id) return; // already loaded

    if (bookIdRef.current && timeRef.current > 1) saveProgress(bookIdRef.current, timeRef.current);

    setIsLoading(true);
    setCurrentTime(0);
    setProgressPct(0);
    timeRef.current = 0;

    try {
      const token   = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};

      const [bookRes, progRes] = await Promise.all([
        fetch(`${API_URL}/api/audiobooks/${id}`),
        token
          ? fetch(`${API_URL}/api/audiobooks/progress/${id}`, { headers })
          : Promise.resolve(new Response(JSON.stringify({ success: false }))),
      ]);

      const bookData = await bookRes.json();
      const progData = await progRes.json();
      if (!bookData.success) return;

      const newBook: PlayerBook = bookData.data;
      setBook(newBook);
      bookIdRef.current = id;
      setIsLoading(false);

      const savedPos: number = progData.success && progData.lastPosition > 1 ? progData.lastPosition : 0;

      audio.src          = newBook.audioFileUrl;
      audio.volume       = volumeRef.current;
      audio.playbackRate = rateRef.current;

      if (savedPos > 0) {
        const seekOnce = () => {
          audio.currentTime = savedPos;
          setCurrentTime(savedPos);
          timeRef.current = savedPos;
          audio.removeEventListener('loadedmetadata', seekOnce);
        };
        audio.addEventListener('loadedmetadata', seekOnce);
      }
      // Deliberately NOT calling audio.play() — waiting for user gesture.
    } catch (err) {
      console.error('loadBook error:', err);
      setIsLoading(false);
    }
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !bookIdRef.current) return;
    if (audio.paused) audio.play().catch(() => {});
    else { audio.pause(); saveProgress(bookIdRef.current, timeRef.current); }
  }, []);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const t = Math.max(0, Math.min(durRef.current, time));
    audio.currentTime = t;
    setCurrentTime(t);
    timeRef.current = t;
  }, []);

  const skip = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    seek(audio.currentTime + seconds);
  }, [seek]);

  const setVolume = useCallback((v: number) => {
    const clamped     = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    volumeRef.current = clamped;
    if (audioRef.current) audioRef.current.volume = clamped;
  }, []);

  const setPlaybackRate = useCallback((r: number) => {
    setRateState(r);
    rateRef.current = r;
    if (audioRef.current) audioRef.current.playbackRate = r;
  }, []);

  // useMemo prevents a new object reference on every render, which would
  // cause all PlayerStableContext consumers to re-render even when only
  // currentTime changed (i.e., the volatile context updated).
  const stableValue = useMemo<PlayerStableValue>(() => ({
    book, isPlaying, isLoading, duration, volume, playbackRate,
    playBook, loadBook, toggle, seek, skip, setVolume, setPlaybackRate,
  }), [book, isPlaying, isLoading, duration, volume, playbackRate,
       playBook, loadBook, toggle, seek, skip, setVolume, setPlaybackRate]);

  const timeValue = useMemo<PlayerTimeValue>(
    () => ({ currentTime, progressPct }),
    [currentTime, progressPct],
  );

  return (
    <PlayerStableContext.Provider value={stableValue}>
      <PlayerTimeContext.Provider value={timeValue}>
        {children}
      </PlayerTimeContext.Provider>
    </PlayerStableContext.Provider>
  );
}
