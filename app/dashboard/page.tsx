'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Clock, BookOpen, Trophy, Tag, Search, Square,
  Volume2, Upload, X, BarChart2, Headphones, Trash2, Award, Sparkles, Loader2,
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
  const [aiSummary,    setAiSummary]      = useState<Record<string, string>>({});
  const [aiStatus,     setAiStatus]       = useState<Record<string, string>>({});
  const workerRef = useRef<Worker | null>(null);

  const getTtsOffset  = (id: string) => parseInt(sessionStorage.getItem(`tts-offset-${id}`) ?? '0');
  const setTtsOffset  = (id: string, c: number) => sessionStorage.setItem(`tts-offset-${id}`, String(c));
  const clearTtsOffset= (id: string) => sessionStorage.removeItem(`tts-offset-${id}`);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    fetchAll(token);
  }, [router]);

  const fetchAll = async (token: string) => {
    try {
      const [r1, r2, r3, r4, r5] = await Promise.all([
        fetch(`${API_URL}/api/personal-books`,      { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/api/audiobooks/my-books`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/api/audiobooks/stats`,    { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/api/audiobooks/activity`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/api/listen-later`,        { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);
      const [d1, d2, d3, d4, d5] = await Promise.all([r1.json(), r2.json(), r3.json(), r4.json(), r5.json()]);
      if (d1.success) setPersonalBooks(d1.data);
      if (d2.success) setPublicBooks(d2.data);
      if (d3.success) setStats(d3.data);
      if (d4.success) setActivity(d4.data);
      if (d5.success) setListenLater(d5.data);
    } catch {
      toast('Eroare la încărcarea datelor.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { toast('Selectează un fișier PDF!', 'error'); return; }
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
        toast('PDF procesat și salvat!');
        setFile(null);
        setTitle('');
        fetchAll(token || '');
      } else {
        toast(data.message || 'Eroare la încărcare.', 'error');
      }
    } catch {
      toast('Eroare de conexiune.', 'error');
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
    if (!text) { toast('Eroare la încărcarea conținutului.', 'error'); return; }

    const offset    = getTtsOffset(bookId);
    const slice     = text.slice(offset);
    const utterance = new SpeechSynthesisUtterance(slice);
    utterance.lang  = 'ro-RO';
    utterance.rate  = 0.9;
    utterance.onboundary = (event) => {
      if (event.name === 'word') setTtsOffset(bookId, offset + event.charIndex);
    };
    utterance.onend   = () => { setIsPlaying(null); clearTtsOffset(bookId); };
    utterance.onerror = () => setIsPlaying(null);

    window.speechSynthesis.speak(utterance);
    setIsPlaying(bookId);
  }, [isPlaying, fetchContent]);

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
        toast('Document șters.');
      } else {
        toast(data.message || 'Eroare la ștergere.', 'error');
      }
    } catch { toast('Eroare de conexiune.', 'error'); }
  };

  const removeListenLater = async (audiobookId: string) => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`${API_URL}/api/listen-later/${audiobookId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      setListenLater(prev => prev.filter(i => i.audiobookId !== audiobookId));
      toast('Eliminat din lista de ascultare.');
    } catch { toast('Eroare de conexiune.', 'error'); }
  };

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      workerRef.current?.terminate();
    };
  }, []);

  const handleSummarize = useCallback(async (bookId: string) => {
    if (aiSummary[bookId] || aiStatus[bookId]) return;

    const text = await fetchContent(bookId);
    if (!text) { toast('Conținut indisponibil.', 'error'); return; }

    if (!workerRef.current) {
      try {
        workerRef.current = new Worker(
          new URL('../../workers/summarizer.worker.ts', import.meta.url),
          { type: 'module' },
        );
      } catch {
        toast('Funcția AI nu este disponibilă. Rulați: npm install @xenova/transformers', 'error');
        setAiStatus(prev => { const s = { ...prev }; delete s[bookId]; return s; });
        return;
      }

      workerRef.current.onmessage = (e) => {
        const { type, bookId: bid, message, summary } = e.data;
        if (type === 'status') setAiStatus(prev => ({ ...prev, [bid]: message }));
        if (type === 'result') {
          setAiSummary(prev => ({ ...prev, [bid]: summary }));
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

    setAiStatus(prev => ({ ...prev, [bookId]: 'Se pregătește…' }));
    workerRef.current.postMessage({ text, bookId });
  }, [aiSummary, aiStatus, fetchContent]);

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

  const challenges = useMemo(() => {
    if (!stats) return [];
    const catCount = Object.keys(stats.byCategory).length;
    return [
      {
        id: 'first', emoji: '🎯', label: 'Primul Pas',
        desc: 'Completează prima carte audio',
        current: Math.min(stats.completed, 1), target: 1,
        curLabel: `${stats.completed} completate`, tgtLabel: '1 carte',
      },
      {
        id: 'avid', emoji: '📚', label: 'Cititor Avid',
        desc: 'Completează 5 cărți audio',
        current: Math.min(stats.completed, 5), target: 5,
        curLabel: `${stats.completed}/5 cărți`, tgtLabel: '5 cărți',
      },
      {
        id: 'marathon', emoji: '⏱️', label: 'Maratonist',
        desc: 'Ascultă cel puțin 5 ore total',
        current: Math.min(stats.totalSeconds, 18000), target: 18000,
        curLabel: formatHours(stats.totalSeconds), tgtLabel: '5h',
      },
      {
        id: 'explorer', emoji: '🌍', label: 'Explorator',
        desc: 'Explorează 3 categorii diferite',
        current: Math.min(catCount, 3), target: 3,
        curLabel: `${catCount} ${catCount === 1 ? 'categorie' : 'categorii'}`, tgtLabel: '3 categorii',
      },
      {
        id: 'streak', emoji: '🔥', label: 'Săptămâna Activă',
        desc: 'Fii activ 5 din ultimele 7 zile',
        current: Math.min(activeDays, 5), target: 5,
        curLabel: `${activeDays}/7 zile active`, tgtLabel: '5 zile',
      },
    ];
  }, [stats, activeDays]);

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
          Spațiul meu
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Statisticile tale, progresul în librărie și documentele personale
        </p>
      </div>

      {/* ── Stats cards ── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Clock,    label: 'Total ascultat',      value: formatHours(stats.totalSeconds), accent: 'oklch(0.68 0.14 185)', glow: 'oklch(0.68 0.14 185 / 0.15)' },
            { icon: BookOpen, label: 'Cărți începute',      value: stats.booksStarted,              accent: 'oklch(0.65 0.10 280)', glow: 'oklch(0.65 0.10 280 / 0.15)' },
            { icon: Trophy,   label: 'Finalizate',           value: stats.completed,                 accent: 'var(--sage)',          glow: 'var(--glow-sage)' },
            { icon: Tag,      label: 'Categorie preferată', value: topCategory || '—',              accent: 'var(--gold)',          glow: 'var(--glow-gold)' },
          ].map(({ icon: Icon, label, value, accent, glow }) => (
            <div
              key={label}
              className="relative bg-card rounded-2xl p-5 flex flex-col gap-3 overflow-hidden border border-border/60 shadow-sm"
            >
              {/* Color accent top bar */}
              <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: accent }} />
              <Icon className="size-4" style={{ color: accent }} />
              <div>
                <p className="text-2xl font-bold text-foreground leading-none tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground mt-1.5">{label}</p>
              </div>
              {/* Subtle glow bg */}
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
            <h2 className="text-sm font-semibold text-foreground">Activitate săptămânală</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-5">Cărți ascultate în ultimele 7 zile</p>
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
                  title={`${count} ${count === 1 ? 'carte' : 'cărți'}`}
                />
                <span className="text-[10px] text-muted-foreground capitalize font-medium">{day}</span>
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
              Provocări
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
                        ✓ Gata
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
            <h2 className="font-semibold text-foreground">Listen Later</h2>
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
          <h2 className="font-semibold text-foreground">Continuă ascultarea</h2>
          {publicBooks.length > 0 && (
            <Badge variant="secondary" className="text-xs rounded-full font-mono">{publicBooks.length}</Badge>
          )}
        </div>

        {publicBooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center border-2 border-dashed border-border/40 rounded-2xl gap-3">
            <Headphones className="size-10 text-muted-foreground/25" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Nu ai început nicio carte</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">Explorează librăria pentru a găsi prima ta carte</p>
            </div>
            <Button variant="outline" size="sm" asChild className="mt-1 rounded-xl">
              <Link href="/">Explorează librăria</Link>
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
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BookOpen className="size-4 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">PDF-urile mele</h2>
            <Badge variant="secondary" className="text-xs rounded-full font-mono">{personalBooks.length}/50</Badge>
          </div>
        </div>

        {/* Upload form */}
        <div className="bg-card rounded-2xl border border-border/60 p-5 shadow-sm">
          <p className="text-sm font-medium text-foreground mb-4">Încarcă document nou</p>
          <form onSubmit={handleUpload} className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="pdf-title" className="text-xs text-muted-foreground">Titlu</Label>
              <Input
                id="pdf-title"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="ex: Curs 3"
                className="h-9 rounded-xl border-border/70 focus-visible:ring-2 focus-visible:ring-primary/30"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="pdf-file" className="text-xs text-muted-foreground">Fișier PDF</Label>
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
              size="sm"
              className="shrink-0 h-9 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20"
            >
              {uploading ? 'Se procesează…' : <><Upload className="size-3.5 mr-1.5" />Încarcă</>}
            </Button>
          </form>
        </div>

        {/* Search PDFs */}
        {personalBooks.length > 0 && (
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Caută documente..."
              value={pdfSearch}
              onChange={e => setPdfSearch(e.target.value)}
              className="pl-9 h-9 text-sm rounded-xl border-border/70 focus-visible:ring-2 focus-visible:ring-primary/30"
            />
          </div>
        )}

        {/* PDF list */}
        {filteredPdfs.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-4">
            {personalBooks.length === 0 ? 'Nu ai încărcat documente.' : 'Niciun rezultat.'}
          </p>
        ) : (
          <div className="space-y-2">
            {filteredPdfs.map(book => (
              <div key={book.id} className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
                <div className="p-4 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-foreground line-clamp-1">{book.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(book.createdAt).toLocaleDateString()}
                      <span className="mx-1.5 opacity-40">·</span>
                      <span className="font-mono">~{estimateReadingTime(book.contentLength)}</span>
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant={isPlaying === book.id ? 'destructive' : 'outline'}
                    onClick={() => handlePlayAudio(book.id)}
                    className={`shrink-0 rounded-xl h-8 text-xs ${isPlaying === book.id ? '' : 'hover:border-primary/40 hover:text-primary'}`}
                  >
                    {isPlaying === book.id
                      ? <><Square  className="size-3.5 mr-1.5" />Oprește</>
                      : <><Volume2 className="size-3.5 mr-1.5" />Ascultă</>
                    }
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleSummarize(book.id)}
                    disabled={!!aiStatus[book.id]}
                    title="Generează rezumat AI"
                    className="shrink-0 h-8 w-8 p-0 rounded-xl text-primary/60 hover:text-primary hover:bg-primary/10"
                  >
                    {aiStatus[book.id]
                      ? <Loader2 className="size-3.5 animate-spin" />
                      : <Sparkles className="size-3.5" />
                    }
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeletePdf(book.id)}
                    className="shrink-0 h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>

                {aiStatus[book.id] && (
                  <div className="px-4 pb-3 flex items-center gap-2 text-xs text-primary">
                    <Loader2 className="size-3 animate-spin" />
                    {aiStatus[book.id]}
                  </div>
                )}

                <AnimatePresence>
                  {aiSummary[book.id] && (
                    <motion.div
                      key={`ai-${book.id}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.35, ease: 'easeOut' }}
                      className="px-4 pb-4 border-t border-border/60"
                    >
                      <div className="mt-3 p-3 rounded-xl bg-primary/5 border border-primary/15">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Sparkles className="size-3 text-primary" aria-hidden="true" />
                          <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                            Rezumat AI
                          </span>
                        </div>
                        <p className="text-xs text-foreground leading-relaxed">{aiSummary[book.id]}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
