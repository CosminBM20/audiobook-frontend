'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Clock, BookOpen, Trophy, Tag, Search, Square,
  Volume2, Upload, X, BarChart2, Headphones, Trash2, Award, Sparkles, Loader2,
  FileText, Info, Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '../../components/Toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { BookCard } from '../../components/BookCard';
import { PredictiveInsights } from '../../components/PredictiveInsights';
import { useLanguage } from '../../contexts/LanguageContext';
import { displayCategory } from '@/lib/categories';
import { API_URL } from '@/lib/api';

interface Stats {
  totalSeconds: number;
  booksStarted: number;
  completed: number;
  byCategory: Record<string, number>;
}
interface ActivityDay { day: string; count: number; }

export default function DashboardPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  // Stable ref so the Worker onmessage closure always sees the current locale
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; }, [t]);

  const [personalBooks, setPersonalBooks] = useState<any[]>([]);
  const [publicBooks,   setPublicBooks]   = useState<any[]>([]);
  const [listenLater,   setListenLater]   = useState<any[]>([]);
  const [stats,         setStats]         = useState<Stats | null>(null);
  const [activity,      setActivity]      = useState<ActivityDay[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [uploading,     setUploading]     = useState(false);
  const [file,          setFile]          = useState<File | null>(null);
  const [title,         setTitle]         = useState('');
  const [isPlaying,     setIsPlaying]     = useState<string | null>(null);
  const [pdfSearch,     setPdfSearch]     = useState('');
  const pdfContentRef = useRef<Record<string, string>>({});
  const [aiSummary, setAiSummary] = useState<Record<string, { text: string; mode: 'extractive' | 'neural' }>>({});
  const [aiStatus,  setAiStatus]  = useState<Record<string, { message: string; progress?: number }>>({});
  const workerRef = useRef<Worker | null>(null);

  const getTtsOffset   = (id: string) => parseInt(sessionStorage.getItem(`tts-offset-${id}`) ?? '0');
  const setTtsOffset   = (id: string, c: number) => sessionStorage.setItem(`tts-offset-${id}`, String(c));
  const clearTtsOffset = (id: string) => sessionStorage.removeItem(`tts-offset-${id}`);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    fetchAll(token);
  }, [router]);

  const fetchAll = async (token: string) => {
    try {
      const [r1, r2, r3, r4, r5] = await Promise.allSettled([
        fetch(`${API_URL}/api/personal-books`,      { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/api/audiobooks/my-books`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/api/audiobooks/stats`,    { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/api/audiobooks/activity`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/api/listen-later`,        { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);

      if (r1.status === 'fulfilled') { const d = await r1.value.json(); if (d.success) setPersonalBooks(d.data); }
      if (r2.status === 'fulfilled') { const d = await r2.value.json(); if (d.success) setPublicBooks(d.data); }
      if (r3.status === 'fulfilled') { const d = await r3.value.json(); if (d.success) setStats(d.data); }
      if (r4.status === 'fulfilled') { const d = await r4.value.json(); if (d.success) setActivity(d.data); }
      if (r5.status === 'fulfilled') { const d = await r5.value.json(); if (d.success) setListenLater(d.data); }
    } catch {
      toast(t('errLoadData'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { toast(t('errNoPdf'), 'error'); return; }
    setUploading(true);
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('title', title);
    formData.append('pdfFile', file);
    try {
      const res  = await fetch(`${API_URL}/api/personal-books/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        toast(t('pdfSaved'));
        setFile(null);
        setTitle('');
        fetchAll(token || '');
      } else {
        toast(data.message || t('errUpload'), 'error');
      }
    } catch {
      toast(t('errConnection'), 'error');
    } finally {
      setUploading(false);
    }
  };

  const fetchContent = useCallback(async (bookId: string): Promise<string | null> => {
    if (pdfContentRef.current[bookId]) return pdfContentRef.current[bookId];
    const token = localStorage.getItem('token');
    try {
      const res  = await fetch(`${API_URL}/api/personal-books/${bookId}/content`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        pdfContentRef.current[bookId] = data.data.content;
        return data.data.content;
      }
    } catch {}
    return null;
  }, []);

  const handlePlayAudio = useCallback(async (bookId: string) => {
    window.speechSynthesis.cancel();
    if (isPlaying === bookId) { setIsPlaying(null); return; }

    const text = await fetchContent(bookId);
    if (!text) { toast(t('errLoadContent'), 'error'); return; }

    const offset    = getTtsOffset(bookId);
    const slice     = text.slice(offset);
    const utterance = new SpeechSynthesisUtterance(slice);
    utterance.lang  = lang === 'en' ? 'en-US' : 'ro-RO';
    utterance.rate  = 0.9;
    utterance.onboundary = (event) => {
      if (event.name === 'word') setTtsOffset(bookId, offset + event.charIndex);
    };
    utterance.onend   = () => { setIsPlaying(null); clearTtsOffset(bookId); };
    utterance.onerror = () => setIsPlaying(null);

    window.speechSynthesis.speak(utterance);
    setIsPlaying(bookId);
  }, [isPlaying, fetchContent, lang]);

  const handleDeletePdf = async (bookId: string) => {
    const token = localStorage.getItem('token');
    if (isPlaying === bookId) { window.speechSynthesis.cancel(); setIsPlaying(null); }
    try {
      const res  = await fetch(`${API_URL}/api/personal-books/${bookId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setPersonalBooks(prev => prev.filter(b => b.id !== bookId));
        toast(t('docDeleted'));
      } else {
        toast(data.message || t('errDelete'), 'error');
      }
    } catch { toast(t('errConnection'), 'error'); }
  };

  const removeListenLater = async (audiobookId: string) => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`${API_URL}/api/listen-later/${audiobookId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      setListenLater(prev => prev.filter(i => i.audiobookId !== audiobookId));
      toast(t('removedFromLater'));
    } catch { toast(t('errConnection'), 'error'); }
  };

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      workerRef.current?.terminate();
    };
  }, []);

  const handleSummarize = useCallback(async (bookId: string) => {
    if (aiStatus[bookId]) return;

    const text = await fetchContent(bookId);
    if (!text) { toast(t('errContentUnavail'), 'error'); return; }

    if (!workerRef.current) {
      try {
        workerRef.current = new Worker(
          new URL('../../workers/summarizer.worker.ts', import.meta.url),
          { type: 'module' },
        );
      } catch {
        toast(t('errAiUnavail'), 'error');
        return;
      }

      workerRef.current.onmessage = (e) => {
        const { type, bookId: bid, message, summary, progress } = e.data;
        if (type === 'extractive') {
          setAiSummary(prev => ({ ...prev, [bid]: { text: summary, mode: 'extractive' } }));
          setAiStatus(prev => ({ ...prev, [bid]: { message: tRef.current('quickSummaryDone') } }));
        }
        if (type === 'status')  { setAiStatus(prev => ({ ...prev, [bid]: { message, progress } })); }
        if (type === 'result')  {
          setAiSummary(prev => ({ ...prev, [bid]: { text: summary, mode: 'neural' } }));
          setAiStatus(prev => { const s = { ...prev }; delete s[bid]; return s; });
        }
        if (type === 'neural_error') {
          setAiStatus(prev => { const s = { ...prev }; delete s[bid]; return s; });
        }
        if (type === 'error') {
          toast(message || 'Eroare la generarea rezumatului.', 'error');
          setAiStatus(prev => { const s = { ...prev }; delete s[bid]; return s; });
        }
      };
      workerRef.current.onerror = () => {
        toast('Eroare internă worker AI.', 'error');
        setAiStatus({});
      };
    }

    setAiStatus(prev => ({ ...prev, [bookId]: { message: t('aiInitializing') } }));
    workerRef.current.postMessage({ text, bookId });
  }, [aiStatus, fetchContent]);

  const formatHours = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h === 0) return `${m}m`;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const estimateReadingTime = (contentLength: number) => {
    if (!contentLength) return '—';
    const words   = Math.round(contentLength / 5);
    const minutes = Math.ceil(words / (135 * 0.9));
    return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
  };

  const topCategory = stats
    ? Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1])[0]?.[0]
    : null;

  const maxActivity = Math.max(...activity.map(a => a.count), 1);
  const filteredPdfs = pdfSearch.trim()
    ? personalBooks.filter(b => b.title.toLowerCase().includes(pdfSearch.toLowerCase()))
    : personalBooks;
  const activeDays = useMemo(() => activity.filter(a => a.count > 0).length, [activity]);

  // Challenges are rebuilt whenever language changes (t is stable per lang)
  const challenges = useMemo(() => {
    if (!stats) return [];
    const catCount = Object.keys(stats.byCategory).length;
    return [
      {
        id: 'first', emoji: '🎯',
        label: t('ch1Label'), desc: t('ch1Desc'),
        current: Math.min(stats.completed, 1), target: 1,
        curLabel: `${stats.completed} ${t('booksCompletedOf')}`,
        tgtLabel: `1 ${t('book')}`,
      },
      {
        id: 'avid', emoji: '📚',
        label: t('ch2Label'), desc: t('ch2Desc'),
        current: Math.min(stats.completed, 5), target: 5,
        curLabel: `${stats.completed}/5 ${t('books')}`,
        tgtLabel: `5 ${t('books')}`,
      },
      {
        id: 'marathon', emoji: '⏱️',
        label: t('ch3Label'), desc: t('ch3Desc'),
        current: Math.min(stats.totalSeconds, 18000), target: 18000,
        curLabel: formatHours(stats.totalSeconds),
        tgtLabel: '5h',
      },
      {
        id: 'explorer', emoji: '🌍',
        label: t('ch4Label'), desc: t('ch4Desc'),
        current: Math.min(catCount, 3), target: 3,
        curLabel: `${catCount} ${catCount === 1 ? t('categoryUnit') : t('categoriesUnit')}`,
        tgtLabel: `3 ${t('categoriesUnit')}`,
      },
      {
        id: 'streak', emoji: '🔥',
        label: t('ch5Label'), desc: t('ch5Desc'),
        current: Math.min(activeDays, 5), target: 5,
        curLabel: `${activeDays}/7 ${t('daysUnit')}`,
        tgtLabel: `5 ${t('daysUnit')}`,
      },
    ];
  }, [stats, activeDays, t]);

  if (loading) return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
      <Skeleton className="h-10 w-52 rounded-2xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
      <Skeleton className="h-48 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-10">

      {/* Page header */}
      <div>
        <h1
          className="text-3xl font-bold text-foreground leading-tight"
          style={{ fontFamily: 'var(--font-fraunces)' }}
        >
          {t('mySpace')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t('dashSubtitle')}</p>
      </div>

      {/* ── Stats cards ── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Clock,    label: t('totalListened'),    value: formatHours(stats.totalSeconds), accent: 'oklch(0.68 0.14 185)', glow: 'oklch(0.68 0.14 185 / 0.15)' },
            { icon: BookOpen, label: t('booksStartedStat'), value: stats.booksStarted,              accent: 'oklch(0.65 0.10 280)', glow: 'oklch(0.65 0.10 280 / 0.15)' },
            { icon: Trophy,   label: t('booksCompleted'),   value: stats.completed,                 accent: 'var(--sage)',          glow: 'var(--glow-sage)' },
            { icon: Tag,      label: t('favoriteCategory'), value: topCategory ? displayCategory(topCategory, lang) : '—', accent: 'var(--gold)', glow: 'var(--glow-gold)' },
          ].map(({ icon: Icon, label, value, accent, glow }) => (
            <div
              key={label}
              className="relative bg-card rounded-2xl p-5 flex flex-col gap-3 overflow-hidden border border-border/60 shadow-sm"
            >
              <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: accent }} />
              <Icon className="size-4" style={{ color: accent }} />
              <div>
                <p className="text-2xl font-bold text-foreground leading-none tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground mt-1.5">{label}</p>
              </div>
              <div className="absolute inset-0 pointer-events-none rounded-2xl" style={{ background: `radial-gradient(ellipse at top left, ${glow} 0%, transparent 60%)` }} />
            </div>
          ))}
        </div>
      )}

      {/* ── Activity chart ── */}
      {activity.length > 0 && (
        <div className="bg-card rounded-2xl border border-border/60 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <BarChart2 className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">{t('weeklyActivity')}</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-5">{t('booksListened7Days')}</p>
          <div className="flex items-end gap-2 h-24">
            {activity.map(({ day, count }) => (
              <div key={day} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full rounded-lg transition-all duration-500"
                  style={{
                    height: `${count === 0 ? 6 : (count / maxActivity) * 80}px`,
                    background: count === 0
                      ? 'var(--muted)'
                      : 'linear-gradient(to top, var(--sage), var(--gold))',
                    boxShadow: count > 0 ? '0 0 8px var(--glow-sage)' : 'none',
                  }}
                  title={`${count} ${count === 1 ? t('book') : t('books')}`}
                />
                <span className="text-[10px] text-muted-foreground capitalize font-medium">
                  {/^\d{4}-\d{2}-\d{2}$/.test(day)
                    ? new Date(day + 'T12:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'ro-RO', { weekday: 'short' })
                    : day}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Predictive insights ── */}
      {publicBooks.length > 0 && (
        <PredictiveInsights progressItems={publicBooks} activity={activity} />
      )}

      {/* ── Challenges ── */}
      {challenges.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <Award className="size-4 text-muted-foreground" />
            <h2
              className="font-semibold text-foreground"
              style={{ fontFamily: 'var(--font-fraunces)' }}
            >
              {t('challenges')}
            </h2>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-mono">
              {challenges.filter(c => c.current >= c.target).length}/{challenges.length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {challenges.map(ch => {
              const pct  = (ch.current / ch.target) * 100;
              const done = ch.current >= ch.target;
              return (
                <div
                  key={ch.id}
                  className={`bg-card rounded-2xl border p-4 space-y-3 transition-all ${
                    done
                      ? 'border-primary/30 shadow-[0_0_20px_var(--glow-sage)]'
                      : 'border-border/60 shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl leading-none select-none">{ch.emoji}</span>
                      <div>
                        <p className="text-sm font-semibold text-foreground leading-tight">{ch.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{ch.desc}</p>
                      </div>
                    </div>
                    {done && (
                      <span className="shrink-0 text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        {t('doneBadge')}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-muted-foreground mb-1.5">
                      <span>{ch.curLabel}</span>
                      <span>{ch.tgtLabel}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          background: done
                            ? 'linear-gradient(to right, var(--sage), var(--gold))'
                            : 'var(--muted-foreground)',
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Listen Later ── */}
      {listenLater.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <Clock className="size-4 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">{t('listenLaterSection')}</h2>
            <Badge variant="secondary" className="text-xs rounded-full font-mono">{listenLater.length}</Badge>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
            {listenLater.map(item => (
              <div key={item.id} className="shrink-0 w-36 relative group">
                <BookCard
                  id={item.audiobook.id}
                  title={item.audiobook.title}
                  coverImageUrl={item.audiobook.coverImageUrl}
                  author={item.audiobook.author?.name}
                  category={item.audiobook.category?.name}
                  durationSeconds={item.audiobook.durationSeconds}
                />
                <button
                  onClick={() => removeListenLater(item.audiobookId)}
                  className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-background/90 shadow text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Continue Listening ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2.5">
          <Headphones className="size-4 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">{t('continueListening')}</h2>
          {publicBooks.length > 0 && (
            <Badge variant="secondary" className="text-xs rounded-full font-mono">{publicBooks.length}</Badge>
          )}
        </div>

        {publicBooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center border-2 border-dashed border-border/40 rounded-2xl gap-3">
            <Headphones className="size-10 text-muted-foreground/25" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('noBookStarted')}</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">{t('exploreLibraryHint')}</p>
            </div>
            <Button variant="outline" size="sm" asChild className="mt-1 rounded-xl">
              <Link href="/">{t('exploreLibraryBtn')}</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {publicBooks.map(item => (
              <BookCard
                key={item.id}
                id={item.audiobook.id}
                title={item.audiobook.title}
                coverImageUrl={item.audiobook.coverImageUrl}
                author={item.audiobook.author?.name}
                category={item.audiobook.category?.name}
                durationSeconds={item.audiobook.durationSeconds}
                progress={Math.min(100, (item.currentPosition / item.audiobook.durationSeconds) * 100)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Personal PDFs ── */}
      <div className="space-y-5">

        {/* Section header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileText className="size-4 text-muted-foreground" />
            <h2
              className="font-semibold text-foreground"
              style={{ fontFamily: 'var(--font-fraunces)' }}
            >
              {t('myDocuments')}
            </h2>
            <Badge variant="secondary" className="text-xs rounded-full font-mono">
              {personalBooks.length}/50
            </Badge>
          </div>
          {personalBooks.length > 0 && (
            <div className="relative max-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder={t('searchDocs')}
                value={pdfSearch}
                onChange={e => setPdfSearch(e.target.value)}
                className="pl-9 h-8 text-xs rounded-xl border-border/70"
              />
            </div>
          )}
        </div>

        {/* ── How it works ── */}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 flex gap-4">
          <div className="shrink-0 size-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center mt-0.5">
            <Info className="size-4 text-primary" />
          </div>
          <div className="space-y-2.5 min-w-0">
            <p className="font-semibold text-sm text-foreground">{t('howItWorksTitle')}</p>
            <div className="grid sm:grid-cols-2 gap-1.5 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <span className="text-base leading-none shrink-0">📄</span>
                <p>
                  {t('how1a')} <strong className="text-foreground">{t('how1Bold')}</strong>{t('how1b')}
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-base leading-none shrink-0">🔊</span>
                <p>
                  {t('how2a')} <strong className="text-foreground">{t('how2Bold')}</strong>{t('how2b')}
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-base leading-none shrink-0">⚡</span>
                <p>
                  {t('how3Bold') && <strong className="text-foreground">{t('how3Bold')}</strong>}{t('how3b')}
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-base leading-none shrink-0">🤖</span>
                <p>
                  {t('how4Bold') && <strong className="text-foreground">{t('how4Bold')}</strong>}{t('how4b')}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground/60">⚠️ {t('howWarning')}</p>
          </div>
        </div>

        {/* ── Upload form ── */}
        <div className="bg-card rounded-2xl border border-border/60 p-5 shadow-sm space-y-4">
          <p className="text-sm font-semibold text-foreground">{t('uploadNewDoc')}</p>
          <form onSubmit={handleUpload} className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="pdf-title" className="text-xs text-muted-foreground">{t('docTitleLabel')}</Label>
              <Input
                id="pdf-title"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={t('docTitlePlaceholder')}
                className="h-9 rounded-xl border-border/70 focus-visible:ring-2 focus-visible:ring-primary/30"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pdf-file" className="text-xs text-muted-foreground">{t('pdfFileLabel')}</Label>
              <input
                id="pdf-file"
                type="file"
                accept="application/pdf"
                required
                onChange={e => setFile(e.target.files?.[0] || null)}
                className="flex h-9 w-full rounded-xl border border-input bg-background px-3 py-1.5 text-sm cursor-pointer file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground"
              />
            </div>
            <Button
              type="submit"
              disabled={uploading}
              className="h-9 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20 whitespace-nowrap"
            >
              {uploading
                ? <><Loader2 className="size-3.5 mr-1.5 animate-spin" />{t('processing')}</>
                : <><Upload className="size-3.5 mr-1.5" />{t('uploadBtn')}</>
              }
            </Button>
          </form>
          {file && (
            <p className="text-xs text-muted-foreground">
              {t('selectedFile')}{' '}
              <span className="text-foreground font-medium">{file.name}</span>
              {' '}({(file.size / 1024 / 1024).toFixed(1)} MB)
            </p>
          )}
        </div>

        {/* ── PDF card grid ── */}
        {filteredPdfs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center border-2 border-dashed border-border/40 rounded-2xl gap-3">
            <FileText className="size-10 text-muted-foreground/25" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {personalBooks.length === 0 ? t('noDocUploaded') : t('noBooksFound')}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                {personalBooks.length === 0 ? t('addFirstPdfHint') : t('tryAnotherSearch')}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPdfs.map(book => {
              const summary    = aiSummary[book.id];
              const status     = aiStatus[book.id];
              const isNeural   = summary?.mode === 'neural';
              const processing = !!status;

              return (
                <div
                  key={book.id}
                  className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden flex flex-col group/card transition-shadow hover:shadow-md"
                >
                  {/* Card header */}
                  <div className="p-4 flex items-start gap-3">
                    <div className="shrink-0 size-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                      <FileText className="size-5 text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate leading-snug">{book.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          {new Date(book.createdAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'ro-RO')}
                        </span>
                        <span className="text-border text-xs">·</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          ~{estimateReadingTime(book.contentLength)}
                        </span>
                        {summary && (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                            isNeural
                              ? 'bg-primary/10 text-primary border-primary/25'
                              : 'bg-muted text-muted-foreground border-border/60'
                          }`}>
                            {isNeural
                              ? <><Sparkles className="size-2.5" />{t('neuralSummaryTitle').split(' ').slice(-2).join(' ')}</>
                              : <><Zap className="size-2.5" />{t('quickSummaryBadge')}</>
                            }
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeletePdf(book.id)}
                      aria-label={t('deleteDoc')}
                      className="shrink-0 opacity-0 group-hover/card:opacity-100 flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>

                  {/* Action buttons */}
                  <div className="px-4 pb-4 flex gap-2">
                    <Button
                      size="sm"
                      variant={isPlaying === book.id ? 'destructive' : 'outline'}
                      onClick={() => handlePlayAudio(book.id)}
                      className="flex-1 rounded-xl h-8 text-xs"
                    >
                      {isPlaying === book.id
                        ? <><Square  className="size-3.5 mr-1.5" />{t('stopAction')}</>
                        : <><Volume2 className="size-3.5 mr-1.5" />{t('listenAction')}</>
                      }
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSummarize(book.id)}
                      disabled={processing}
                      className={`flex-1 rounded-xl h-8 text-xs transition-colors ${
                        !processing ? 'hover:border-primary/40 hover:text-primary' : ''
                      }`}
                    >
                      {processing
                        ? <><Loader2 className="size-3.5 mr-1.5 animate-spin" />{t('processing')}</>
                        : summary
                          ? <><Sparkles className="size-3.5 mr-1.5" />{t('regenerateAction')}</>
                          : <><Sparkles className="size-3.5 mr-1.5" />{t('summarizeAction')}</>
                      }
                    </Button>
                  </div>

                  {/* Progress bar (model download) */}
                  {status?.progress != null && (
                    <div className="px-4 pb-3 space-y-1.5">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-[var(--gold)] transition-all duration-300"
                          style={{ width: `${status.progress}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">{status.message}</p>
                    </div>
                  )}

                  {/* Spinner (no progress number) */}
                  {status && status.progress == null && (
                    <div className="px-4 pb-3 flex items-center gap-2 text-xs text-primary">
                      <Loader2 className="size-3 animate-spin shrink-0" />
                      <span>{status.message}</span>
                    </div>
                  )}

                  {/* Summary panel */}
                  <AnimatePresence>
                    {summary && (
                      <motion.div
                        key={`ai-${book.id}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        className="border-t border-border/60 px-4 py-3 bg-primary/[0.03]"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            {isNeural
                              ? <Sparkles className="size-3 text-primary" />
                              : <Zap className="size-3 text-muted-foreground" />
                            }
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${isNeural ? 'text-primary' : 'text-muted-foreground'}`}>
                              {isNeural ? t('neuralSummaryTitle') : t('quickSummaryTitle')}
                            </span>
                          </div>
                          {!isNeural && processing && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Loader2 className="size-2.5 animate-spin" />
                              {t('upgradingToNeural')}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-foreground leading-relaxed">{summary.text}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
