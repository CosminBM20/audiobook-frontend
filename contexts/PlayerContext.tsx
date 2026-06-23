'use client';

import React, {
  createContext, useContext, useRef,
  useState, useEffect, useCallback, useMemo,
} from 'react';
import { API_URL } from '@/lib/api';
import { detectContentLang, pickBestVoice, preprocessForTts, CHARS_PER_MIN } from '@/lib/ttsUtils';
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

  // ╔══════════════════════════════════════════════════════════════╗
  // ║  SCREENSHOT: Listing 4.1 — Sincronizarea useRef cu useState  ║
  // ║  Capturați: currentTime useState + timeRef useRef (linia 173) ║
  // ║  + funcția onTimeUpdate din useEffect (~linia 235)            ║
  // ╚══════════════════════════════════════════════════════════════╝
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
  const timeRef              = useRef(0);          // global current time — LISTING 4.1: useRef paralel cu useState
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
  // Timestamp of the last real `onboundary` word event. Used to decide whether
  // a voice actually reports word positions (Edge / some voices do) or whether
  // the time-based estimator must drive the progress bar (most Chrome SAPI
  // voices never fire onboundary).
  const lastTtsBoundaryRef  = useRef(0);
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

  // Sequence counters used to discard results from a stale in-flight request
  // (e.g. user clicks book B before book A's fetch has resolved).
  const bookLoadSeqRef = useRef(0);
  const pdfLoadSeqRef  = useRef(0);
  // Shows the "session expired" toast at most once per session instead of
  // once per failed auto-save (every 10s).
  const sessionExpiredNotifiedRef = useRef(false);

  const notifySessionExpired = useCallback(() => {
    if (sessionExpiredNotifiedRef.current) return;
    sessionExpiredNotifiedRef.current = true;
    toast('Sesiunea a expirat. Reconectează-te pentru ca progresul să fie salvat.', 'error');
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const saveProgress = useCallback((bookId: string, position: number): Promise<{ title: string; titleEn: string; badgeIcon: string; xpReward: number }[]> => {
    const token = localStorage.getItem('token');
    if (!token || position < 1) return Promise.resolve([]);
    return fetch(`${API_URL}/api/audiobooks/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ audiobookId: bookId, currentPosition: Math.floor(position) }),
    })
      .then(r => {
        if (r.status === 401 || r.status === 403) { notifySessionExpired(); return null; }
        if (!r.ok) return null;
        return r.json();
      })
      .then(data => data?.newlyCompleted ?? [])
      .catch(() => []);
  }, [notifySessionExpired]);

  const showChallengeToasts = useCallback((completed: { title: string; titleEn: string; badgeIcon: string; xpReward: number }[]) => {
    for (const ch of completed) {
      toast(`${ch.badgeIcon} Provocare completată: ${ch.title} +${ch.xpReward} XP`, 'success');
    }
  }, []);

  const savePdfProgress = useCallback((bookId: string, charOffset: number) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch(`${API_URL}/api/personal-books/${bookId}/progress`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body:    JSON.stringify({ charOffset }),
    })
      .then(r => { if (r.status === 401 || r.status === 403) notifySessionExpired(); })
      .catch(() => {});
  }, [notifySessionExpired]);

  // ── Event listeners (set once) ────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // ╔══════════════════════════════════════════════════════════════╗
    // ║  SCREENSHOT: Listing 4.1 — handler onTimeUpdate (partea 2)  ║
    // ║  Capturați funcția onTimeUpdate de mai jos                   ║
    // ╚══════════════════════════════════════════════════════════════╝
    const onTimeUpdate = () => {
      const localT  = audio.currentTime;
      const offset  = chapterOffsetsRef.current[currentChapterIdxRef.current] ?? 0;
      const globalT = offset + localT;
      const total   = totalDurRef.current;
      timeRef.current = globalT;
      setCurrentTime(globalT);
      setProgressPct(total > 0 ? (globalT / total) * 100 : 0);
    };
    // ╚══ SFARSIT Listing 4.1 ══════════════════════════════════════╝

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

  // ── PDF TTS progress estimator ──────────────────────────────────────────────
  // Many Chrome SAPI voices never emit `onboundary`, so the speech engine reports
  // no word positions and the progress bar would stay frozen. While TTS is
  // playing, advance the displayed character offset based on the speaking rate.
  // If real onboundary events ARE firing (Edge / some voices), this estimator
  // stays dormant and lets those accurate positions drive the bar instead.
  useEffect(() => {
    if (!ttsIsPlaying) return;
    const TICK_MS = 250;
    const id = setInterval(() => {
      const bookId = pdfTrackIdRef.current;
      if (!bookId) return;
      const total = processedCacheRef.current[bookId]?.length || ttsTotalCharsState || 0;

      // If no real word-boundary event arrived in the last ~1.2 s, this voice
      // doesn't report positions — advance the offset by the estimated speaking
      // rate (chars/sec scaled to the 0.82 baseline CHARS_PER_MIN is calibrated
      // for). When onboundary IS firing, it keeps ttsOffsetRef accurate and we
      // simply mirror it below.
      const boundaryActive = Date.now() - lastTtsBoundaryRef.current < 1200;
      if (!boundaryActive) {
        const charsPerSec = (CHARS_PER_MIN / 60) * (ttsRateRef.current / 0.82);
        const advanced = ttsOffsetRef.current + charsPerSec * (TICK_MS / 1000);
        ttsOffsetRef.current = total > 0 ? Math.min(total, advanced) : advanced;
      }

      // Single writer of the visible state — push the current position every
      // tick so the bar moves smoothly whether the position came from the
      // engine (onboundary) or from the estimate above.
      const shown = Math.floor(ttsOffsetRef.current);
      setTtsOffsetState(shown);
      localStorage.setItem(`tts-progress-${bookId}`, String(shown));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [ttsIsPlaying, ttsTotalCharsState]);

  // ── TTS Actions ───────────────────────────────────────────────────────────

  // Chrome silently drops SpeechSynthesisUtterances longer than ~32 KB.
  // Split the text into safe-sized chunks and chain them via onend so that
  // arbitrarily large PDFs play correctly regardless of browser limits.
  const CHUNK_SIZE = 10_000; // chars per utterance (~5-6 min of speech each)

  const speakFrom = useCallback(async (bookId: string, text: string, offset: number, seq?: number) => {
    const locale = detectContentLang(text);

    // Chrome loads voices asynchronously — getVoices() returns [] on the first
    // call until the 'voiceschanged' event fires. Without a voice explicitly set
    // on the utterance, Chrome silently drops speak() while the engine is still
    // initialising (Edge is more permissive and works without this wait).
    let voices = voicesCacheRef.current.length
      ? voicesCacheRef.current
      : window.speechSynthesis.getVoices();

    if (!voices.length) {
      voices = await new Promise<SpeechSynthesisVoice[]>(resolve => {
        const onReady = () => {
          window.speechSynthesis.removeEventListener('voiceschanged', onReady);
          const v = window.speechSynthesis.getVoices();
          voicesCacheRef.current = v;
          resolve(v);
        };
        window.speechSynthesis.addEventListener('voiceschanged', onReady);
        // Safety timeout: proceed even if the event never fires
        setTimeout(() => {
          window.speechSynthesis.removeEventListener('voiceschanged', onReady);
          resolve(window.speechSynthesis.getVoices());
        }, 3000);
      });
    }

    // Another playPdf()/seek/track-switch started while we were waiting on
    // voices to load — this call is stale and must not resurrect its track
    // over whatever the user has since navigated to.
    if (seq !== undefined && pdfLoadSeqRef.current !== seq) return;

    const bestVoice = pickBestVoice(voices, locale);

    // Google online voices (localService=false) fail silently in Chrome.
    // Fall back to the best local (SAPI/OneCore) voice with the same language.
    const isGoogle = (v: SpeechSynthesisVoice) => v.name.toLowerCase().startsWith('google');
    const chosenVoice: SpeechSynthesisVoice | null = (() => {
      if (!bestVoice || !isGoogle(bestVoice)) return bestVoice;
      const prefix = locale.split('-')[0];
      return (
        voices.find(v => v.localService && (v.lang === locale || v.lang.startsWith(prefix)))
        ?? voices.find(v => v.localService)
        ?? bestVoice
      );
    })();

    const fullText = text.slice(offset);

    if (!fullText.length) {
      // Nothing left — mark as completed
      savePdfProgress(bookId, text.length);
      localStorage.removeItem(`tts-progress-${bookId}`);
      setPdfTrack(null);
      setTtsIsPlaying(false);
      setTtsPaused(false);
      pdfTrackIdRef.current = null;
      ttsOffsetRef.current  = 0;
      setTtsOffsetState(0);
      return;
    }

    // cancel() is required even on an idle engine — it initialises Chrome's
    // Google TTS client before speak(). A delay after cancel() breaks online
    // voices (Google TTS session expires during the pause), so we call
    // speakChunk immediately with no await between cancel and speak.
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();

    let chunkBaseOffset = offset; // absolute char position where the current chunk starts

    const speakChunk = (chunkIndex: number) => {
      if (pdfTrackIdRef.current !== bookId) return; // cancelled externally

      const chunkStart = chunkIndex * CHUNK_SIZE;
      if (chunkStart >= fullText.length) {
        // All chunks finished — finalize
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
        return;
      }

      const chunk      = fullText.slice(chunkStart, chunkStart + CHUNK_SIZE);
      const utterance  = new SpeechSynthesisUtterance(chunk);
      utterance.lang   = locale;
      utterance.rate   = ttsRateRef.current;
      utterance.pitch  = 1.0;
      utterance.volume = ttsVolumeRef.current;
      if (chosenVoice) utterance.voice = chosenVoice;
      else if (voices.length > 0) utterance.voice = voices.find(v => v.localService) ?? voices[0];

      utterance.onboundary = (ev) => {
        if (ev.name !== 'word') return;
        // Only record the TRUE position + a timestamp. The estimator effect is
        // the single writer of the visible state (setTtsOffsetState), so the bar
        // advances smoothly regardless of whether this event fires per-word,
        // irregularly, or never (most Chrome SAPI voices do not fire it).
        lastTtsBoundaryRef.current = Date.now();
        ttsOffsetRef.current = chunkBaseOffset + ev.charIndex;
      };

      utterance.onend = () => {
        if (pdfTrackIdRef.current !== bookId) return; // cancelled externally
        chunkBaseOffset += chunk.length;
        // Resync to the true position at the chunk boundary so any drift the
        // estimator accumulated is corrected every ~10k chars.
        ttsOffsetRef.current = chunkBaseOffset;
        speakChunk(chunkIndex + 1);
      };

      utterance.onerror = (ev) => {
        const err = (ev as SpeechSynthesisErrorEvent).error;
        // canceled / interrupted are expected when we deliberately stop or
        // switch tracks — ignore them.
        if (err === 'canceled' || err === 'interrupted') return;
        // A genuine failure: clear BOTH the ref and the React state so the bar
        // is never left visible-but-frozen (which previously caused a stale PDF
        // bar to persist when the user then started an audiobook).
        if (pdfTrackIdRef.current === bookId) {
          pdfTrackIdRef.current = null;
          setPdfTrack(null);
          setTtsIsPlaying(false);
          setTtsPaused(false);
        }
      };

      window.speechSynthesis.speak(utterance);
    };

    pdfTrackIdRef.current = bookId;
    ttsOffsetRef.current  = offset;
    setTtsOffsetState(offset);
    setTtsIsPlaying(true);
    setTtsPaused(false);
    // Give the engine a brief grace window to fire its first onboundary before
    // the estimator kicks in (so Edge/voices that DO report positions stay
    // perfectly accurate and the estimator never fights them).
    lastTtsBoundaryRef.current = Date.now();

    speakChunk(0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const playPdf = useCallback(async (bookId: string, title: string) => {
    // Claim this as the latest PDF-load request. Any earlier playPdf() call
    // still awaiting fetches/voices will see its seq go stale and bail out
    // instead of resurrecting the wrong track (see checks below + in speakFrom).
    const seq = ++pdfLoadSeqRef.current;

    // Stop audiobook if playing
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
    // Cancel other PDF if playing
    if (pdfTrackIdRef.current && pdfTrackIdRef.current !== bookId) {
      savePdfProgress(pdfTrackIdRef.current, ttsOffsetRef.current);
      // Clear a pending debounced re-speak from the previous PDF so it cannot
      // resurrect itself after we switch to the new document.
      if (seekDebounceRef.current) {
        clearTimeout(seekDebounceRef.current);
        seekDebounceRef.current = null;
      }
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
      if (pdfLoadSeqRef.current !== seq) return; // superseded by a newer playPdf() call

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

      if (pdfLoadSeqRef.current !== seq) return; // superseded by a newer playPdf() call

      setPdfTrack({ id: bookId, title, totalChars: processed.length });
      setTtsTotalCharsState(processed.length);
      await speakFrom(bookId, processed, savedOffset, seq);
    } catch (err) {
      console.error('playPdf error:', err);
    }
  }, [speakFrom, savePdfProgress]);

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

  // Full, idempotent TTS teardown. Safe to call even when nothing is playing.
  // Clears any pending debounced re-speak (so a queued seek/rate/volume change
  // can't resurrect TTS after we switch to an audiobook), cancels speech,
  // persists progress, and resets BOTH the ref and the React state together so
  // the PDF player bar can never be left in a frozen / inconsistent state.
  const teardownTts = useCallback(() => {
    if (seekDebounceRef.current) {
      clearTimeout(seekDebounceRef.current);
      seekDebounceRef.current = null;
    }
    const activeId = pdfTrackIdRef.current;
    if (activeId) {
      savePdfProgress(activeId, ttsOffsetRef.current);
      localStorage.setItem(`tts-progress-${activeId}`, String(ttsOffsetRef.current));
    }
    window.speechSynthesis.cancel();
    pdfTrackIdRef.current = null;
    ttsOffsetRef.current  = 0;
    setPdfTrack(null);
    setTtsIsPlaying(false);
    setTtsPaused(false);
    setTtsOffsetState(0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The Stop button on the PDF bar performs the same full teardown.
  const stopTts = teardownTts;

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
  }, [speakFrom]);

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
  }, [speakFrom]);

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
  }, [speakFrom]);

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

    // Claim this as the latest book-load request. If the user navigates again
    // before this one's fetch resolves, the stale call below sees its seq
    // invalidated and bails out instead of overwriting the newer book's state.
    const seq = ++bookLoadSeqRef.current;

    // Always tear down any TTS/PDF state before starting a book. Idempotent —
    // a no-op when nothing is playing. Run unconditionally (not gated on the
    // ref) so that a bar left inconsistent by a transient TTS error is still
    // cleared, never leaving the PDF and the audiobook both "active".
    teardownTts();

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
      if (bookLoadSeqRef.current !== seq) return; // superseded by a newer playBook()/loadBook() call

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
  }, [_setupBook, teardownTts, saveProgress]);

  // Load + prepare WITHOUT auto-playing (use inside useEffect, not a click handler).
  const loadBook = useCallback(async (id: string) => {
    const audio = audioRef.current;
    if (!audio) return;

    // Claim this as the latest book-load request — see playBook() for why.
    const seq = ++bookLoadSeqRef.current;

    // Tear down any active TTS FIRST — even if this book is already loaded — so
    // landing on a book page always stops a PDF that is currently playing.
    // (Runs before the early-return below, which only skips re-fetching.)
    teardownTts();

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
      if (bookLoadSeqRef.current !== seq) return; // superseded by a newer playBook()/loadBook() call

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
  }, [_setupBook, teardownTts, saveProgress]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !bookIdRef.current) return;
    if (audio.paused) {
      // Starting book audio must stop any PDF/TTS that is still playing — this
      // is the play button on the book page, which (unlike playBook) does not
      // otherwise tear TTS down. Prevents the book and a PDF running together.
      if (pdfTrackIdRef.current) teardownTts();
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
  }, [saveProgress, showChallengeToasts, teardownTts]);

  // ╔══════════════════════════════════════════════════════════════╗
  // ║  SCREENSHOT: Listing 4.2 — Seek global (navigare capitole)   ║
  // ║  Capturați întreaga funcție seek de mai jos                   ║
  // ║  (chapterIdxAt = căutare lineară, echivalent cu binary search ║
  // ║   descris în teză pentru claritate pedagogică)                ║
  // ╚══════════════════════════════════════════════════════════════╝
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
  // ╚══ SFARSIT Listing 4.2 ══════════════════════════════════════╝

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

  // ╔══════════════════════════════════════════════════════════════╗
  // ║  SCREENSHOT: Listing 3.3 — Separarea contextelor stabil/timp ║
  // ║  Capturați: stableValue useMemo + timeValue useMemo          ║
  // ║  + blocul return cu cele 2 Provider-e                         ║
  // ╚══════════════════════════════════════════════════════════════╝
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
  // ╚══ SFARSIT Listing 3.3 ══════════════════════════════════════╝
}
