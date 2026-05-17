'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft, Play, Pause, Rewind, FastForward,
  Gauge, Timer, Bookmark, Plus, X, Loader2,
  SkipBack, SkipForward, ListMusic, ChevronDown, Check,
} from 'lucide-react';
import { usePlayer } from '../../../contexts/PlayerContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import { toast } from '../../../components/Toast';
import { API_URL } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface BookmarkItem { id: string; position: number; label: string; }

function fmtCountdown(s: number): string {
  const m  = Math.floor(s / 60);
  const sc = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sc).padStart(2, '0')}`;
}

function fmt(s: number): string {
  if (!s || isNaN(s)) return '0:00';
  const h  = Math.floor(s / 3600);
  const m  = Math.floor((s % 3600) / 60);
  const sc = Math.floor(s % 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(sc).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export default function AudiobookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const player  = usePlayer();
  const { t }   = useLanguage();

  const [bookmarks,        setBookmarks]        = useState<BookmarkItem[]>([]);
  const [showBookmarkForm, setShowBookmarkForm] = useState(false);
  const [bookmarkLabel,    setBookmarkLabel]    = useState('');
  const [playbackRate,     setLocalRate]        = useState(1);
  const [sleepMinutes,     setSleepMinutes]     = useState<number | null>(null);
  const [sleepSecondsLeft, setSleepSecondsLeft] = useState<number | null>(null);
  const [speedOpen,        setSpeedOpen]        = useState(false);
  const [sleepOpen,        setSleepOpen]        = useState(false);
  const speedRef = useRef<HTMLDivElement>(null);
  const sleepRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    const params   = new URLSearchParams(window.location.search);
    const deepLink = params.get('t') ? Number(params.get('t')) : null;

    player.loadBook(id).then(() => {
      if (deepLink && deepLink > 0) player.seek(deepLink);
    });

    fetch(`${API_URL}/api/bookmarks/${id}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) setBookmarks(d.data.sort((a: BookmarkItem, b: BookmarkItem) => a.position - b.position));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => { player.setPlaybackRate(playbackRate); }, [playbackRate, player]);

  useEffect(() => {
    if (!sleepMinutes) return;
    const timerId = setTimeout(() => {
      if (player.isPlaying) player.toggle();
      setSleepMinutes(null);
      toast(t('sleepTimerFired'), 'info');
    }, sleepMinutes * 60_000);
    return () => clearTimeout(timerId);
  }, [sleepMinutes, player]);

  // Countdown display ticker
  useEffect(() => {
    if (sleepMinutes === null) { setSleepSecondsLeft(null); return; }
    setSleepSecondsLeft(sleepMinutes * 60);
    const interval = setInterval(() => {
      setSleepSecondsLeft(prev => (prev !== null && prev > 1 ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(interval);
  }, [sleepMinutes]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (speedRef.current && !speedRef.current.contains(e.target as Node)) setSpeedOpen(false);
      if (sleepRef.current && !sleepRef.current.contains(e.target as Node)) setSleepOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space')    { e.preventDefault(); player.toggle(); }
      if (e.code === 'ArrowLeft')  player.skip(-15);
      if (e.code === 'ArrowRight') player.skip(15);
      if (e.code === 'KeyM')       player.setVolume(player.volume > 0 ? 0 : 1);
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [player]);

  const addBookmark = useCallback(async () => {
    const token    = localStorage.getItem('token');
    const position = Math.floor(player.currentTime);
    const label    = bookmarkLabel.trim() || fmt(position);
    try {
      const res  = await fetch(`${API_URL}/api/bookmarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ audiobookId: id, position, label }),
      });
      const data = await res.json();
      if (data.success) {
        setBookmarks(prev => [...prev, data.data].sort((a, b) => a.position - b.position));
        setBookmarkLabel('');
        setShowBookmarkForm(false);
        toast(t('bookmarkAdded'), 'info');
      }
    } catch { toast(t('errBookmarkAdd'), 'error'); }
  }, [id, bookmarkLabel, player.currentTime]);

  const deleteBookmark = useCallback(async (bmId: string) => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`${API_URL}/api/bookmarks/${bmId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      setBookmarks(prev => prev.filter(b => b.id !== bmId));
    } catch { toast(t('errGeneric'), 'error'); }
  }, []);

  const handleScrubClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    player.seek(pct * player.duration);
  };

  const progressPct = player.duration > 0 ? (player.currentTime / player.duration) * 100 : 0;

  if (!player.book || player.book.id !== id) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <Skeleton className="h-8 w-40 rounded-xl" />
        <div className="grid lg:grid-cols-[300px_1fr] gap-10">
          <div className="space-y-5">
            <Skeleton className="aspect-[2/3] rounded-2xl" />
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>
          <div className="space-y-4 pt-2">
            <Skeleton className="h-10 w-3/4 rounded-xl" />
            <Skeleton className="h-5 w-1/3 rounded-lg" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  const book = player.book;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

      {/* Back */}
      <Button
        variant="ghost"
        size="sm"
        asChild
        className="text-muted-foreground hover:text-foreground -ml-2 rounded-xl gap-1.5"
      >
        <Link href="/"><ArrowLeft className="size-4" />{t('backToLibrary')}</Link>
      </Button>

      <div className="grid lg:grid-cols-[300px_1fr] gap-10 items-start">

        {/* ── LEFT: Cover + controls ─────────────────────────────────── */}
        <div className="space-y-5 lg:sticky lg:top-24">

          {/* Cover art with ambient glow */}
          <div className="relative aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl"
            style={{ boxShadow: '0 20px 60px oklch(0 0 0 / 0.4), 0 0 0 1px var(--border)' }}
          >
            <Image
              src={book.coverImageUrl}
              alt={book.title}
              fill
              sizes="(max-width: 1024px) 90vw, 300px"
              className="object-cover"
              priority
            />
            {/* Subtle bottom gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
          </div>

          {/* Progress scrubber */}
          <div className="space-y-1.5">
            <div
              className="w-full h-1.5 bg-muted rounded-full cursor-pointer relative group hover:h-2.5 transition-all duration-150 select-none"
              onClick={handleScrubClick}
            >
              {/* Bookmark markers */}
              {player.duration > 0 && bookmarks.map(bm => (
                <div
                  key={bm.id}
                  className="absolute top-0 bottom-0 w-px bg-primary/50 pointer-events-none"
                  style={{ left: `${Math.min(99, (bm.position / player.duration) * 100)}%` }}
                  title={bm.label}
                />
              ))}
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-[var(--gold)]"
                style={{ width: `${progressPct}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-3.5 rounded-full bg-primary shadow-md shadow-primary/40 scale-0 group-hover:scale-100 transition-transform pointer-events-none"
                style={{ left: `${progressPct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground font-mono tabular-nums">
              <span>{fmt(player.currentTime)}</span>
              <span>{fmt(player.duration)}</span>
            </div>
          </div>

          {/* Chapter nav (only when multi-chapter) */}
          {player.chapters.length > 1 && (
            <div className="flex items-center justify-between px-1">
              <button
                onClick={() => player.goToChapter(player.currentChapterIdx - 1)}
                disabled={player.currentChapterIdx === 0}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                aria-label={t('prevChapter')}
              >
                <SkipBack className="size-4" />
                <span className="hidden sm:inline">{t('prevChapter')}</span>
              </button>
              <span className="text-xs text-muted-foreground font-medium">
                {player.currentChapterIdx + 1} / {player.chapters.length}
              </span>
              <button
                onClick={() => player.goToChapter(player.currentChapterIdx + 1)}
                disabled={player.currentChapterIdx === player.chapters.length - 1}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                aria-label={t('nextChapter')}
              >
                <span className="hidden sm:inline">{t('nextChapter')}</span>
                <SkipForward className="size-4" />
              </button>
            </div>
          )}

          {/* Transport buttons */}
          <div className="flex items-center justify-center gap-8">
            <button
              onClick={() => player.skip(-15)}
              className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-all hover:-translate-y-0.5 active:scale-95"
              aria-label={t('back15')}
            >
              <Rewind className="size-6" />
              <span className="text-[9px] font-bold tracking-wide">15s</span>
            </button>

            <button
              onClick={player.toggle}
              className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:scale-105 active:scale-95 transition-all duration-200"
              aria-label={player.isPlaying ? t('pause') : t('play')}
            >
              {player.isLoading
                ? <Loader2 className="size-6 animate-spin" />
                : player.isPlaying
                  ? <Pause className="size-6" />
                  : <Play  className="size-6 ml-0.5" fill="currentColor" />
              }
            </button>

            <button
              onClick={() => player.skip(15)}
              className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-all hover:-translate-y-0.5 active:scale-95"
              aria-label={t('forward15')}
            >
              <FastForward className="size-6" />
              <span className="text-[9px] font-bold tracking-wide">15s</span>
            </button>
          </div>

          {/* Speed + Sleep */}
          <div className="flex items-center justify-between px-1 pt-2 border-t border-border/50">

            {/* Speed custom dropdown */}
            <div className="flex items-center gap-2" ref={speedRef}>
              <Gauge className="size-3.5 text-muted-foreground" />
              <div className="relative">
                <button
                  onClick={() => setSpeedOpen(p => !p)}
                  className="flex items-center gap-1 text-xs font-semibold text-foreground bg-card border border-border/50 rounded-lg px-2 py-0.5 hover:border-primary/40 hover:text-primary transition-colors"
                >
                  {playbackRate}x
                  <ChevronDown className={`size-3 transition-transform duration-150 ${speedOpen ? 'rotate-180' : ''}`} />
                </button>
                {speedOpen && (
                  <div className="absolute bottom-full mb-1.5 left-0 z-50 bg-popover border border-border/60 rounded-xl shadow-xl overflow-hidden min-w-[76px]">
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map(s => (
                      <button
                        key={s}
                        onClick={() => { setLocalRate(s); setSpeedOpen(false); }}
                        className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium transition-colors ${
                          playbackRate === s
                            ? 'bg-primary/10 text-primary'
                            : 'text-foreground hover:bg-muted/70'
                        }`}
                      >
                        {s}x
                        {playbackRate === s && <Check className="size-3" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sleep custom dropdown + countdown */}
            <div className="flex items-center gap-2" ref={sleepRef}>
              <Timer className={`size-3.5 transition-colors ${sleepSecondsLeft !== null ? 'text-primary' : 'text-muted-foreground'}`} />
              <div className="relative">
                <button
                  onClick={() => setSleepOpen(p => !p)}
                  className={`flex items-center gap-1 text-xs font-semibold border rounded-lg px-2 py-0.5 transition-colors ${
                    sleepSecondsLeft !== null
                      ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
                      : 'bg-card border-border/50 text-foreground hover:border-primary/40 hover:text-primary'
                  }`}
                >
                  {sleepSecondsLeft !== null ? `⏱ ${fmtCountdown(sleepSecondsLeft)}` : t('sleepTimer')}
                  <ChevronDown className={`size-3 transition-transform duration-150 ${sleepOpen ? 'rotate-180' : ''}`} />
                </button>
                {sleepOpen && (
                  <div className="absolute bottom-full mb-1.5 right-0 z-50 bg-popover border border-border/60 rounded-xl shadow-xl overflow-hidden min-w-[110px]">
                    {sleepSecondsLeft !== null && (
                      <>
                        <button
                          onClick={() => { setSleepMinutes(null); setSleepOpen(false); }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <X className="size-3" />
                          {t('cancelTimer')}
                        </button>
                        <div className="border-t border-border/60" />
                      </>
                    )}
                    {[5, 10, 15, 30, 60].map(m => (
                      <button
                        key={m}
                        onClick={() => { setSleepMinutes(m); setSleepOpen(false); }}
                        className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium transition-colors ${
                          sleepMinutes === m
                            ? 'bg-primary/10 text-primary'
                            : 'text-foreground hover:bg-muted/70'
                        }`}
                      >
                        {m} min
                        {sleepMinutes === m && <Check className="size-3" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <p className="text-center text-[10px] text-muted-foreground/40 font-mono">
            {t('keyboardHint')}
          </p>
        </div>

        {/* ── RIGHT: Book info + bookmarks ──────────────────────────── */}
        <div className="space-y-8">

          {/* Book metadata */}
          <div className="space-y-3">
            <h1
              className="text-4xl font-bold text-foreground leading-tight"
              style={{ fontFamily: 'var(--font-fraunces)' }}
            >
              {book.title}
            </h1>
            <p className="text-lg text-muted-foreground font-medium">{book.author.name}</p>
            <Badge
              variant="secondary"
              className="rounded-full px-3 py-0.5 text-xs font-medium bg-primary/10 text-primary border-primary/20"
            >
              {book.category.name}
            </Badge>
            {book.description && (
              <p className="text-sm text-muted-foreground leading-relaxed pt-2 max-w-prose">
                {book.description}
              </p>
            )}
          </div>

          {/* Bookmarks */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bookmark className="size-4 text-muted-foreground" strokeWidth={1.5} />
                <h2 className="font-semibold text-foreground text-sm">{t('bookmarks')}</h2>
                {bookmarks.length > 0 && (
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md font-mono">
                    {bookmarks.length}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowBookmarkForm(p => !p)}
                className="h-7 gap-1 text-xs rounded-lg hover:text-primary hover:bg-primary/10"
              >
                <Plus className="size-3" />{t('addBookmark')}
              </Button>
            </div>

            {showBookmarkForm && (
              <div className="flex gap-2 animate-slide-in">
                <input
                  autoFocus
                  type="text"
                  value={bookmarkLabel}
                  onChange={e => setBookmarkLabel(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addBookmark()}
                  placeholder={`${t('bookmarkAt')} ${fmt(player.currentTime)}`}
                  className="flex-1 border border-input bg-card rounded-xl px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                />
                <Button size="sm" onClick={addBookmark} className="h-8 rounded-xl px-3 bg-primary text-primary-foreground hover:bg-primary/90">OK</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowBookmarkForm(false)} className="h-8 rounded-xl">
                  <X className="size-3.5" />
                </Button>
              </div>
            )}

            {bookmarks.length > 0 ? (
              <div className="space-y-1.5">
                {bookmarks.map(bm => (
                  <div
                    key={bm.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/60 bg-card hover:bg-muted/40 hover:border-border transition-all group"
                  >
                    <button
                      onClick={() => player.seek(bm.position)}
                      className="flex-1 flex items-center gap-3 text-left"
                    >
                      <span className="text-xs font-mono text-primary shrink-0 w-14 bg-primary/10 px-1.5 py-0.5 rounded-md">
                        {fmt(bm.position)}
                      </span>
                      <span className="text-sm text-foreground truncate">{bm.label}</span>
                    </button>
                    <button
                      onClick={() => deleteBookmark(bm.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                      aria-label={t('deleteBookmark')}
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : !showBookmarkForm && (
              <div className="flex flex-col items-center justify-center py-10 text-center border-2 border-dashed border-border/40 rounded-2xl">
                <Bookmark className="size-8 text-muted-foreground/25 mb-2.5" strokeWidth={1.5} />
                <p className="text-sm font-medium text-muted-foreground">{t('noBookmarks')}</p>
                <p className="text-xs text-muted-foreground/50 mt-0.5">{t('noBookmarksHint')}</p>
              </div>
            )}
          </div>

          {/* Chapter list (only for multi-chapter books) */}
          {player.chapters.length > 1 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ListMusic className="size-4 text-muted-foreground" strokeWidth={1.5} />
                <h2 className="font-semibold text-foreground text-sm">{t('chapters')}</h2>
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md font-mono">
                  {player.chapters.length}
                </span>
              </div>

              <div className="space-y-1.5">
                {player.chapters.map((ch, i) => {
                  const isActive = i === player.currentChapterIdx;
                  return (
                    <button
                      key={ch.id}
                      onClick={() => player.goToChapter(i)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                        isActive
                          ? 'border-primary/30 bg-primary/5 text-foreground'
                          : 'border-border/60 bg-card hover:bg-muted/40 hover:border-border text-foreground'
                      }`}
                    >
                      {/* Playing indicator */}
                      <span className={`shrink-0 flex items-center justify-center size-5 rounded-full text-[10px] font-bold tabular-nums ${
                        isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}>
                        {isActive && player.isPlaying ? '▶' : i + 1}
                      </span>
                      <span className="flex-1 text-sm truncate">{ch.title}</span>
                      <span className="text-xs font-mono text-muted-foreground shrink-0">
                        {fmt(ch.durationSeconds)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
