'use client';

import React, {
  createContext, useContext, useRef,
  useState, useEffect, useCallback, useMemo,
} from 'react';
import { API_URL } from '@/lib/api';

export interface Chapter {
  id: string;
  title: string;
  order: number;
  audioFileUrl: string;
  durationSeconds: number;
}

export interface PlayerBook {
  id: string;
  title: string;
  description: string;
  coverImageUrl: string;
  audioFileUrl: string;
  durationSeconds: number;
  author: { name: string };
  category: { name: string };
  chapters: Chapter[];
}

// ── STABLE context ────────────────────────────────────────────────────────────
interface PlayerStableValue {
  book: PlayerBook | null;
  isPlaying: boolean;
  isLoading: boolean;
  duration: number;      // total book duration (all chapters summed)
  volume: number;
  playbackRate: number;
  chapters: Chapter[];
  currentChapterIdx: number;
  playBook: (id: string) => Promise<void>;
  loadBook: (id: string) => Promise<void>;
  toggle: () => void;
  seek: (globalTime: number) => void;
  skip: (seconds: number) => void;
  setVolume: (v: number) => void;
  setPlaybackRate: (r: number) => void;
  goToChapter: (index: number) => void;
}

// ── VOLATILE context ──────────────────────────────────────────────────────────
interface PlayerTimeValue {
  currentTime: number;   // global position across all chapters
  progressPct: number;
}

const PlayerStableContext = createContext<PlayerStableValue | null>(null);
const PlayerTimeContext   = createContext<PlayerTimeValue>({ currentTime: 0, progressPct: 0 });

export function usePlayerControls() {
  const ctx = useContext(PlayerStableContext);
  if (!ctx) throw new Error('usePlayerControls must be inside PlayerProvider');
  return ctx;
}

export function usePlayerTime() {
  return useContext(PlayerTimeContext);
}

export function usePlayer() {
  return { ...usePlayerControls(), ...usePlayerTime() };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeOffsets(chapters: Chapter[]): number[] {
  const offsets: number[] = [];
  let acc = 0;
  for (const ch of chapters) {
    offsets.push(acc);
    acc += ch.durationSeconds;
  }
  return offsets;
}

// Returns the index of the chapter that contains globalPos
function chapterIdxAt(globalPos: number, offsets: number[]): number {
  if (offsets.length === 0) return 0;
  let i = offsets.length - 1;
  while (i > 0 && offsets[i] > globalPos) i--;
  return i;
}

function getInitialVolume(): number {
  if (typeof window === 'undefined') return 0.7;
  const saved = localStorage.getItem('audiobook_volume');
  if (saved !== null) {
    const parsed = parseFloat(saved);
    if (!isNaN(parsed)) return parsed;
  }
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const u = JSON.parse(userStr) as { preferredVolume?: number };
      if (typeof u.preferredVolume === 'number') return u.preferredVolume;
    }
  } catch {}
  return 0.7;
}

// ── Singleton Audio ───────────────────────────────────────────────────────────
const _sharedAudio =
  typeof window !== 'undefined'
    ? Object.assign(new Audio(), { preload: 'metadata' } as Partial<HTMLAudioElement>)
    : null;

// ── Provider ──────────────────────────────────────────────────────────────────

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  // Stable state
  const [book,              setBook]              = useState<PlayerBook | null>(null);
  const [isPlaying,         setIsPlaying]         = useState(false);
  const [isLoading,         setIsLoading]         = useState(false);
  const [duration,          setDuration]          = useState(0);
  const [volume,            setVolumeState]       = useState(getInitialVolume);
  const [playbackRate,      setRateState]         = useState(1);
  const [chapters,          setChapters]          = useState<Chapter[]>([]);
  const [currentChapterIdx, setCurrentChapterIdx] = useState(0);

  // Volatile state
  const [currentTime, setCurrentTime] = useState(0);
  const [progressPct, setProgressPct] = useState(0);

  // Refs — safe to use inside event handlers without stale closure issues
  const audioRef             = useRef<HTMLAudioElement | null>(_sharedAudio);
  const timeRef              = useRef(0);          // global current time
  const totalDurRef          = useRef(0);          // total book duration
  const durRef               = useRef(0);          // current chapter audio duration
  const chaptersRef          = useRef<Chapter[]>([]);
  const chapterOffsetsRef    = useRef<number[]>([]);
  const currentChapterIdxRef = useRef(0);
  const bookIdRef            = useRef<string | null>(null);
  const volumeRef            = useRef(typeof window !== 'undefined' ? getInitialVolume() : 0.7);
  const rateRef              = useRef(1);
  const syncVolumeTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Debounces the pause-triggered save: if the user resumes within 500 ms
  // (rapid pause/play or scrubbing) the redundant write is suppressed.
  const savePauseTimer       = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Event listeners (set once) ────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      const localT  = audio.currentTime;
      const offset  = chapterOffsetsRef.current[currentChapterIdxRef.current] ?? 0;
      const globalT = offset + localT;
      const total   = totalDurRef.current;
      timeRef.current = globalT;
      setCurrentTime(globalT);
      setProgressPct(total > 0 ? (globalT / total) * 100 : 0);
    };

    const onMetadata = () => {
      const d = audio.duration;
      durRef.current = d;
      // For single-file books (no chapters), use the audio element's duration as the total
      if (chaptersRef.current.length === 0) {
        totalDurRef.current = d;
        setDuration(d);
      }
    };

    const onPlay    = () => { setIsPlaying(true);  setIsLoading(false); };
    const onPause   = () => setIsPlaying(false);
    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);

    const onEnded = () => {
      const chs = chaptersRef.current;
      const idx = currentChapterIdxRef.current;
      if (chs.length > 0 && idx < chs.length - 1) {
        // Auto-advance to the next chapter
        const nextIdx = idx + 1;
        currentChapterIdxRef.current = nextIdx;
        setCurrentChapterIdx(nextIdx);
        audio.src = chs[nextIdx].audioFileUrl;
        audio.play().catch(() => {});
      } else {
        setIsPlaying(false);
      }
    };

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
      // Flush any pending debounced save so position isn't lost on unmount
      if (savePauseTimer.current) {
        clearTimeout(savePauseTimer.current);
        if (bookIdRef.current && timeRef.current > 1) saveProgress(bookIdRef.current, timeRef.current);
      }
    };
  }, []);

  // ── Auto-save every 10 s while playing ───────────────────────────────────
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

  // Shared setup called by both playBook and loadBook after fetching data.
  // Configures chapters, offsets, initial audio src and seek position.
  const _setupBook = useCallback((
    audio: HTMLAudioElement,
    newBook: PlayerBook,
    savedPos: number,
  ) => {
    const chs     = newBook.chapters ?? [];
    const offsets = computeOffsets(chs);

    chaptersRef.current       = chs;
    chapterOffsetsRef.current = offsets;
    setChapters(chs);

    if (newBook.durationSeconds > 0) {
      totalDurRef.current = newBook.durationSeconds;
      setDuration(newBook.durationSeconds);
    }

    // Determine starting chapter and local offset within it
    let startChIdx   = 0;
    let startLocalPos = savedPos;
    if (chs.length > 0 && savedPos > 0) {
      startChIdx    = chapterIdxAt(savedPos, offsets);
      startLocalPos = savedPos - offsets[startChIdx];
    }

    currentChapterIdxRef.current = startChIdx;
    setCurrentChapterIdx(startChIdx);

    const startUrl     = chs.length > 0 ? chs[startChIdx].audioFileUrl : newBook.audioFileUrl;
    audio.src          = startUrl;
    audio.volume       = volumeRef.current;
    audio.playbackRate = rateRef.current;

    if (startLocalPos > 0) {
      const seekOnce = () => {
        audio.currentTime = startLocalPos;
        const globalT     = offsets[startChIdx] + startLocalPos;
        setCurrentTime(globalT);
        timeRef.current   = globalT;
        audio.removeEventListener('loadedmetadata', seekOnce);
      };
      audio.addEventListener('loadedmetadata', seekOnce);
    }
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────
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

      const savedPos = progData.success && progData.lastPosition > 1 ? progData.lastPosition : 0;
      _setupBook(audio, newBook, savedPos);

      await audio.play();
    } catch (err) {
      if ((err as Error).name !== 'AbortError') console.error('playBook error:', err);
      setIsLoading(false);
    }
  }, [_setupBook]);

  // Load + prepare WITHOUT auto-playing (use inside useEffect, not a click handler).
  const loadBook = useCallback(async (id: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (bookIdRef.current === id) return;

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

      const savedPos = progData.success && progData.lastPosition > 1 ? progData.lastPosition : 0;
      _setupBook(audio, newBook, savedPos);
      // Deliberately NOT calling audio.play() — waiting for user gesture.
    } catch (err) {
      console.error('loadBook error:', err);
      setIsLoading(false);
    }
  }, [_setupBook]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !bookIdRef.current) return;
    if (audio.paused) {
      // Cancel any pending debounced save — user resumed before the 250 ms window
      if (savePauseTimer.current) {
        clearTimeout(savePauseTimer.current);
        savePauseTimer.current = null;
      }
      audio.play().catch(() => {});
    } else {
      audio.pause();
      // Debounce: suppress redundant DB writes during rapid pause/resume or scrubbing
      if (savePauseTimer.current) clearTimeout(savePauseTimer.current);
      savePauseTimer.current = setTimeout(() => {
        if (bookIdRef.current && timeRef.current > 1) saveProgress(bookIdRef.current, timeRef.current);
        savePauseTimer.current = null;
      }, 250);
    }
  }, []);

  // Seek to a global position (works across chapter boundaries).
  const seek = useCallback((globalTime: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    const total   = totalDurRef.current;
    const clamped = Math.max(0, total > 0 ? Math.min(total, globalTime) : globalTime);
    const chs     = chaptersRef.current;

    if (chs.length === 0) {
      const t = Math.max(0, Math.min(durRef.current || total, clamped));
      audio.currentTime = t;
      setCurrentTime(t);
      timeRef.current = t;
      return;
    }

    const offsets  = chapterOffsetsRef.current;
    const chIdx    = chapterIdxAt(clamped, offsets);
    const localPos = clamped - offsets[chIdx];

    if (chIdx !== currentChapterIdxRef.current) {
      // Chapter boundary crossed — pause, swap src, seek, resume if was playing
      const wasPlaying = !audio.paused;
      if (wasPlaying) audio.pause();
      currentChapterIdxRef.current = chIdx;
      setCurrentChapterIdx(chIdx);
      audio.src = chs[chIdx].audioFileUrl;
      const seekOnce = () => {
        audio.currentTime = localPos;
        timeRef.current   = clamped;
        setCurrentTime(clamped);
        audio.removeEventListener('loadedmetadata', seekOnce);
        if (wasPlaying) audio.play().catch(() => {});
      };
      audio.addEventListener('loadedmetadata', seekOnce);
    } else {
      audio.currentTime = localPos;
      setCurrentTime(clamped);
      timeRef.current = clamped;
    }
  }, []);

  const skip = useCallback((seconds: number) => {
    seek(timeRef.current + seconds);
  }, [seek]);

  const goToChapter = useCallback((index: number) => {
    const chs = chaptersRef.current;
    if (index < 0 || index >= chs.length) return;
    seek(chapterOffsetsRef.current[index]);
  }, [seek]);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    volumeRef.current = clamped;
    if (audioRef.current) audioRef.current.volume = clamped;
    localStorage.setItem('audiobook_volume', String(clamped));
    if (syncVolumeTimer.current) clearTimeout(syncVolumeTimer.current);
    syncVolumeTimer.current = setTimeout(() => {
      const token = localStorage.getItem('token');
      if (!token) return;
      fetch(`${API_URL}/api/user/volume`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ preferredVolume: clamped }),
      }).catch(() => {});
    }, 1500);
  }, []);

  const setPlaybackRate = useCallback((r: number) => {
    setRateState(r);
    rateRef.current = r;
    if (audioRef.current) audioRef.current.playbackRate = r;
  }, []);

  const stableValue = useMemo<PlayerStableValue>(() => ({
    book, isPlaying, isLoading, duration, volume, playbackRate,
    chapters, currentChapterIdx,
    playBook, loadBook, toggle, seek, skip, setVolume, setPlaybackRate, goToChapter,
  }), [book, isPlaying, isLoading, duration, volume, playbackRate,
       chapters, currentChapterIdx,
       playBook, loadBook, toggle, seek, skip, setVolume, setPlaybackRate, goToChapter]);

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
