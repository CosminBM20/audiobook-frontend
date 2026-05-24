'use client';

import React, {
  createContext, useContext, useRef,
  useState, useEffect, useCallback, useMemo,
} from 'react';
import { API_URL } from '@/lib/api';
import { detectContentLang, pickBestVoice, preprocessForTts } from '@/lib/ttsUtils';
import { toast } from '@/components/Toast';

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

export interface PdfTrack {
  id:         string;
  title:      string;
  totalChars: number;
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
  pdfTrack:    PdfTrack | null;
  ttsIsPlaying: boolean;
  ttsPaused:   boolean;
  playPdf:     (id: string, title: string) => Promise<void>;
  pauseTts:    () => void;
  resumeTts:   () => void;
  stopTts:     () => void;
  seekTts:     (offset: number) => void;
  ttsVolume:    number;
  setTtsVolume: (v: number) => void;
  ttsRate:      number;
  setTtsRate:   (r: number) => void;
}

// ── VOLATILE context ──────────────────────────────────────────────────────────
interface PlayerTimeValue {
  currentTime: number;   // global position across all chapters
  progressPct: number;
  ttsOffset:    number;
  ttsTotalChars: number;
}

const PlayerStableContext = createContext<PlayerStableValue | null>(null);
const PlayerTimeContext   = createContext<PlayerTimeValue>({ currentTime: 0, progressPct: 0, ttsOffset: 0, ttsTotalChars: 0 });

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

  // TTS state
  const [pdfTrack,           setPdfTrack]           = useState<PdfTrack | null>(null);
  const [ttsIsPlaying,       setTtsIsPlaying]        = useState(false);
  const [ttsPaused,          setTtsPaused]           = useState(false);
  const [ttsOffsetState,     setTtsOffsetState]      = useState(0);
  const [ttsTotalCharsState, setTtsTotalCharsState]  = useState(0);
  const [ttsVolume,          setTtsVolumeState]      = useState<number>(() => {
    if (typeof window === 'undefined') return 1;
    const saved = localStorage.getItem('tts_volume');
    return saved !== null ? parseFloat(saved) : 1;
  });
  const [ttsRate,          setTtsRateState]        = useState<number>(() => {
    if (typeof window === 'undefined') return 0.82;
    const saved = localStorage.getItem('tts_rate');
    return saved !== null ? parseFloat(saved) : 0.82;
  });

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
  const pdfContentCacheRef  = useRef<Record<string, string>>({});
  const processedCacheRef   = useRef<Record<string, string>>({});
  const voicesCacheRef      = useRef<SpeechSynthesisVoice[]>([]);
  const ttsOffsetRef        = useRef(0);
  const pdfTrackIdRef       = useRef<string | null>(null);
  const seekDebounceRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ttsVolumeRef        = useRef<number>(
    typeof window !== 'undefined' ? parseFloat(localStorage.getItem('tts_volume') ?? '1') : 1
  );
  const ttsRateRef          = useRef<number>(
    typeof window !== 'undefined' ? parseFloat(localStorage.getItem('tts_rate') ?? '0.82') : 0.82
  );

  const syncVolumeTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Debounces the pause-triggered save: if the user resumes within 500 ms
  // (rapid pause/play or scrubbing) the redundant write is suppressed.
  const savePauseTimer       = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const saveProgress = useCallback((bookId: string, position: number): Promise<{ title: string; titleEn: string; badgeIcon: string; xpReward: number }[]> => {
    const token = localStorage.getItem('token');
    if (!token || position < 1) return Promise.resolve([]);
    return fetch(`${API_URL}/api/audiobooks/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ audiobookId: bookId, currentPosition: Math.floor(position) }),
    })
      .then(r => r.json())
      .then(data => data.newlyCompleted ?? [])
      .catch(() => []);
  }, []);

  const showChallengeToasts = useCallback((completed: { title: string; titleEn: string; badgeIcon: string; xpReward: number }[]) => {
    for (const ch of completed) {
      toast(`${ch.badgeIcon} Provocare completată: ${ch.title} +${ch.xpReward} XP`, 'success');
    }
  }, []);

  const savePdfProgress = (bookId: string, charOffset: number) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch(`${API_URL}/api/personal-books/${bookId}/progress`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body:    JSON.stringify({ charOffset }),
    }).catch(() => {});
  };

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
      // Also cancel TTS and save PDF progress
      window.speechSynthesis.cancel();
      if (pdfTrackIdRef.current && ttsOffsetRef.current > 0) {
        savePdfProgress(pdfTrackIdRef.current, ttsOffsetRef.current);
      }
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
  }, [saveProgress]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save every 10 s while playing ───────────────────────────────────
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      if (bookIdRef.current && timeRef.current > 1) {
        saveProgress(bookIdRef.current, timeRef.current).then(showChallengeToasts);
      }
    }, 10_000);
    return () => clearInterval(id);
  }, [isPlaying, saveProgress, showChallengeToasts]);

  // ── Load TTS voices (async in Chrome) ────────────────────────────────────
  useEffect(() => {
    const load = () => { voicesCacheRef.current = window.speechSynthesis.getVoices(); };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  // ── TTS Actions ───────────────────────────────────────────────────────────
  const speakFrom = useCallback(async (bookId: string, text: string, offset: number) => {
    const locale    = detectContentLang(text);
    const voices    = voicesCacheRef.current.length ? voicesCacheRef.current : window.speechSynthesis.getVoices();
    const bestVoice = pickBestVoice(voices, locale);

    const utterance    = new SpeechSynthesisUtterance(text.slice(offset));
    utterance.lang     = locale;
    utterance.rate     = ttsRateRef.current;
    utterance.pitch    = 1.0;
    utterance.volume   = ttsVolumeRef.current;
    if (bestVoice) utterance.voice = bestVoice;

    let lastSaved = offset;
    utterance.onboundary = (ev) => {
      if (ev.name !== 'word') return;
      const pos = offset + ev.charIndex;
      ttsOffsetRef.current = pos;
      if (pos - lastSaved > 300) {
        lastSaved = pos;
        setTtsOffsetState(pos);
      }
      localStorage.setItem(`tts-progress-${bookId}`, String(pos));
    };

    utterance.onend = () => {
      const finalOffset = ttsOffsetRef.current;
      const totalChars  = processedCacheRef.current[bookId]?.length ?? 0;
      const isCompleted = totalChars > 0 && finalOffset >= totalChars - 200;
      savePdfProgress(bookId, isCompleted ? totalChars : finalOffset);
      if (isCompleted) localStorage.removeItem(`tts-progress-${bookId}`);
      setPdfTrack(null);
      setTtsIsPlaying(false);
      setTtsPaused(false);
      pdfTrackIdRef.current = null;
      ttsOffsetRef.current  = 0;
      setTtsOffsetState(0);
    };

    utterance.onerror = (ev) => {
      const err = (ev as SpeechSynthesisErrorEvent).error;
      if (err === 'canceled' || err === 'interrupted') return;
      setTtsIsPlaying(false);
      setTtsPaused(false);
      pdfTrackIdRef.current = null;
    };

    window.speechSynthesis.cancel();
    await new Promise<void>(resolve => setTimeout(resolve, 150));
    window.speechSynthesis.speak(utterance);
    pdfTrackIdRef.current = bookId;
    ttsOffsetRef.current  = offset;
    setTtsOffsetState(offset);
    setTtsIsPlaying(true);
    setTtsPaused(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const playPdf = useCallback(async (bookId: string, title: string) => {
    // Stop audiobook if playing
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
    // Cancel other PDF if playing
    if (pdfTrackIdRef.current && pdfTrackIdRef.current !== bookId) {
      savePdfProgress(pdfTrackIdRef.current, ttsOffsetRef.current);
      window.speechSynthesis.cancel();
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      // Fetch and cache content if needed
      if (!pdfContentCacheRef.current[bookId]) {
        const res  = await fetch(`${API_URL}/api/personal-books/${bookId}/content`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!data.success) return;
        pdfContentCacheRef.current[bookId] = data.data.content;
      }

      if (!processedCacheRef.current[bookId]) {
        processedCacheRef.current[bookId] = preprocessForTts(pdfContentCacheRef.current[bookId]);
      }

      const processed = processedCacheRef.current[bookId];

      // Fetch saved progress (API first, localStorage fallback)
      let savedOffset = parseInt(localStorage.getItem(`tts-progress-${bookId}`) ?? '0');
      try {
        const progRes  = await fetch(`${API_URL}/api/personal-books/${bookId}/progress`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const progData = await progRes.json();
        if (progData.success && progData.data?.charOffset > 0) {
          savedOffset = progData.data.charOffset;
        }
      } catch {}

      setPdfTrack({ id: bookId, title, totalChars: processed.length });
      setTtsTotalCharsState(processed.length);
      await speakFrom(bookId, processed, savedOffset);
    } catch (err) {
      console.error('playPdf error:', err);
    }
  }, [speakFrom]); // eslint-disable-line react-hooks/exhaustive-deps

  const pauseTts = useCallback(() => {
    window.speechSynthesis.pause();
    setTtsIsPlaying(false);
    setTtsPaused(true);
  }, []);

  const resumeTts = useCallback(() => {
    window.speechSynthesis.resume();
    setTtsIsPlaying(true);
    setTtsPaused(false);
  }, []);

  const stopTts = useCallback(() => {
    if (!pdfTrackIdRef.current) return;
    savePdfProgress(pdfTrackIdRef.current, ttsOffsetRef.current);
    localStorage.setItem(`tts-progress-${pdfTrackIdRef.current}`, String(ttsOffsetRef.current));
    window.speechSynthesis.cancel();
    setPdfTrack(null);
    setTtsIsPlaying(false);
    setTtsPaused(false);
    pdfTrackIdRef.current = null;
    ttsOffsetRef.current  = 0;
    setTtsOffsetState(0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const seekTts = useCallback((offset: number) => {
    const bookId = pdfTrackIdRef.current;
    if (!bookId) return;
    const clamped = Math.max(0, Math.min(processedCacheRef.current[bookId]?.length ?? offset, offset));
    ttsOffsetRef.current = clamped;
    setTtsOffsetState(clamped);
    localStorage.setItem(`tts-progress-${bookId}`, String(clamped));
    window.speechSynthesis.cancel();
    setTtsIsPlaying(false);
    setTtsPaused(false);
    if (seekDebounceRef.current) clearTimeout(seekDebounceRef.current);
    seekDebounceRef.current = setTimeout(async () => {
      const text = processedCacheRef.current[bookId];
      if (text) await speakFrom(bookId, text, clamped);
    }, 400);
  }, [speakFrom]); // eslint-disable-line react-hooks/exhaustive-deps

  const setTtsVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    ttsVolumeRef.current = clamped;
    setTtsVolumeState(clamped);
    localStorage.setItem('tts_volume', String(clamped));
    // Re-speak from current offset if currently playing
    const bookId = pdfTrackIdRef.current;
    if (!bookId) return;
    const text = processedCacheRef.current[bookId];
    if (!text) return;
    window.speechSynthesis.cancel();
    setTtsIsPlaying(false);
    setTtsPaused(false);
    if (seekDebounceRef.current) clearTimeout(seekDebounceRef.current);
    seekDebounceRef.current = setTimeout(async () => {
      await speakFrom(bookId, text, ttsOffsetRef.current);
    }, 400);
  }, [speakFrom]); // eslint-disable-line react-hooks/exhaustive-deps

  const setTtsRate = useCallback((r: number) => {
    const clamped = Math.max(0.5, Math.min(2, r));
    ttsRateRef.current = clamped;
    setTtsRateState(clamped);
    localStorage.setItem('tts_rate', String(clamped));
    const bookId = pdfTrackIdRef.current;
    if (!bookId) return;
    const text = processedCacheRef.current[bookId];
    if (!text) return;
    window.speechSynthesis.cancel();
    setTtsIsPlaying(false);
    setTtsPaused(false);
    if (seekDebounceRef.current) clearTimeout(seekDebounceRef.current);
    seekDebounceRef.current = setTimeout(async () => {
      await speakFrom(bookId, text, ttsOffsetRef.current);
    }, 400);
  }, [speakFrom]); // eslint-disable-line react-hooks/exhaustive-deps

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

    // Stop TTS if it's running
    if (pdfTrackIdRef.current) {
      savePdfProgress(pdfTrackIdRef.current, ttsOffsetRef.current);
      window.speechSynthesis.cancel();
      setPdfTrack(null);
      setTtsIsPlaying(false);
      setTtsPaused(false);
      pdfTrackIdRef.current = null;
    }

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
        if (bookIdRef.current && timeRef.current > 1) {
          saveProgress(bookIdRef.current, timeRef.current).then(showChallengeToasts);
        }
        savePauseTimer.current = null;
      }, 250);
    }
  }, [saveProgress, showChallengeToasts]);

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
    pdfTrack, ttsIsPlaying, ttsPaused,
    playPdf, pauseTts, resumeTts, stopTts, seekTts,
    ttsVolume, setTtsVolume,
    ttsRate, setTtsRate,
  }), [book, isPlaying, isLoading, duration, volume, playbackRate,
       chapters, currentChapterIdx,
       playBook, loadBook, toggle, seek, skip, setVolume, setPlaybackRate, goToChapter,
       pdfTrack, ttsIsPlaying, ttsPaused,
       playPdf, pauseTts, resumeTts, stopTts, seekTts,
       ttsVolume, setTtsVolume,
       ttsRate, setTtsRate]);

  const timeValue = useMemo<PlayerTimeValue>(
    () => ({ currentTime, progressPct, ttsOffset: ttsOffsetState, ttsTotalChars: ttsTotalCharsState }),
    [currentTime, progressPct, ttsOffsetState, ttsTotalCharsState],
  );

  return (
    <PlayerStableContext.Provider value={stableValue}>
      <PlayerTimeContext.Provider value={timeValue}>
        {children}
      </PlayerTimeContext.Provider>
    </PlayerStableContext.Provider>
  );
}
