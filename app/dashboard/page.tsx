'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Clock, BookOpen, Trophy, Tag, BarChart2, Headphones, Award, X, FileText, Flame,
} from 'lucide-react';
import { toast } from '../../components/Toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BookCard } from '../../components/BookCard';
import { PredictiveInsights } from '../../components/PredictiveInsights';
import { PersonalDocumentsSection } from '../../components/PersonalDocumentsSection';
import { useLanguage } from '../../contexts/LanguageContext';
import { usePlayerControls } from '../../contexts/PlayerContext';
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

  const [publicBooks,   setPublicBooks]   = useState<any[]>([]);
  const [listenLater,   setListenLater]   = useState<any[]>([]);
  const [stats,         setStats]         = useState<Stats | null>(null);
  const [activity,      setActivity]      = useState<ActivityDay[]>([]);
  const [personalBooks, setPersonalBooks] = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [challenges,    setChallenges]    = useState<any[]>([]);
  const [streak,        setStreak]        = useState<{ current: number; longest: number; lastActivity: string | null } | null>(null);

  const { playPdf } = usePlayerControls();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    fetchAll(token);
  }, [router]);

  const fetchAll = async (token: string) => {
    // Each response is parsed independently — a single endpoint returning a
    // malformed body (e.g. an HTML error page) must not prevent the other six
    // already-resolved sections from rendering their data.
    const apply = async (result: PromiseSettledResult<Response>, onSuccess: (data: any) => void) => {
      if (result.status !== 'fulfilled') return false;
      try {
        const d = await result.value.json();
        if (d.success) onSuccess(d.data);
        return d.success;
      } catch {
        return false;
      }
    };

    const [r1, r2, r3, r4, r5, r6, r7] = await Promise.allSettled([
      fetch(`${API_URL}/api/audiobooks/my-books`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_URL}/api/audiobooks/stats`,    { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_URL}/api/audiobooks/activity`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_URL}/api/listen-later`,        { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_URL}/api/personal-books`,      { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_URL}/api/challenges`,          { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_URL}/api/challenges/streak`,   { headers: { Authorization: `Bearer ${token}` } }),
    ]);

    const results = await Promise.all([
      apply(r1, d => setPublicBooks(d)),
      apply(r2, d => setStats(d)),
      apply(r3, d => setActivity(d)),
      apply(r4, d => setListenLater(d)),
      apply(r5, d => setPersonalBooks(d)),
      apply(r6, d => setChallenges(d)),
      apply(r7, d => setStreak(d)),
    ]);

    if (results.every(ok => !ok)) toast(t('errLoadData'), 'error');
    setLoading(false);
  };

  const removeListenLater = async (audiobookId: string) => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`${API_URL}/api/listen-later/${audiobookId}`, {
        method : 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setListenLater(prev => prev.filter(i => i.audiobookId !== audiobookId));
      toast(t('removedFromLater'));
    } catch {
      toast(t('errConnection'), 'error');
    }
  };

  const formatHours = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h === 0) return `${m}m`;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const topCategory = stats
    ? Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1])[0]?.[0]
    : null;

  const totalXP   = challenges.filter(c => c.isCompleted).reduce((sum: number, c: any) => sum + (Number(c.xpReward) || 0), 0);
  const level     = Math.floor(totalXP / 150) + 1;
  const xpInLevel = totalXP % 150;
  const xpToNext  = 150;

  const maxActivity = Math.max(...activity.map(a => a.count), 1);

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
                    ? new Date(day + 'T12:00:00').toLocaleDateString(
                        lang === 'en' ? 'en-US' : 'ro-RO',
                        { weekday: 'short' },
                      )
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

      {/* ── Streak Widget ── */}
      {streak !== null && (
        <div className="bg-card rounded-2xl border border-border/60 p-5 shadow-sm flex items-center gap-5">
          <div className="flex flex-col items-center justify-center size-16 rounded-2xl bg-primary/10 border border-primary/20 shrink-0">
            <Flame className="size-6 text-primary mb-0.5" />
            <span className="text-xl font-bold text-foreground tabular-nums leading-none">{streak.current}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground text-sm">{t('streakTitle')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {streak.current === 0
                ? t('streakStart')
                : streak.current === 1
                ? t('streakDay1')
                : `${streak.current} ${t('streakNDays')}`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{t('streakRecord')} <span className="font-semibold text-foreground">{streak.longest}</span> {t('daysUnit')}</p>
          </div>
          {streak.current >= 3 && (
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">{t('streakFire')}</span>
          )}
        </div>
      )}

      {/* ── XP / Level ── */}
      {challenges.length > 0 && (
        <div className="bg-card rounded-2xl border border-border/60 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div
                className="flex size-9 items-center justify-center rounded-xl text-sm font-bold text-primary-foreground shrink-0"
                style={{ background: 'linear-gradient(135deg, var(--sage), var(--gold))' }}
              >
                {level}
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">{t('levelLabel')} {level}</p>
                <p className="text-xs text-muted-foreground">{totalXP} {t('xpAccumulated')}</p>
              </div>
            </div>
            <span className="text-xs font-mono text-muted-foreground">
              {xpInLevel}/{xpToNext} XP → {t('nextLevelAbbr')} {level + 1}
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-primary to-[var(--gold)]"
              style={{ width: `${(xpInLevel / xpToNext) * 100}%` }}
            />
          </div>
        </div>
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
              {challenges.filter(c => c.isCompleted).length}/{challenges.length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {challenges.map(ch => {
              const pct  = Math.min(100, ch.target > 0 ? (ch.progress / ch.target) * 100 : 0);
              const done = ch.isCompleted;
              const progressLabel = ch.type === 'LISTENING_TIME'
                ? `${Math.floor(ch.progress)}/${ch.target} min`
                : `${Math.floor(ch.progress)}/${ch.target}`;
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
                      <span className="text-2xl leading-none select-none">{ch.badgeIcon}</span>
                      <div>
                        <p className="text-sm font-semibold text-foreground leading-tight">{lang === 'en' && ch.titleEn ? ch.titleEn : ch.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{lang === 'en' && ch.descriptionEn ? ch.descriptionEn : ch.description}</p>
                      </div>
                    </div>
                    {done && (
                      <span className="shrink-0 text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        ✓
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-muted-foreground mb-1.5">
                      <span>{progressLabel}</span>
                      {ch.xpReward > 0 && <span className="text-primary font-semibold">+{ch.xpReward} XP</span>}
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
                  aria-label={t('removedFromLater')}
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
      {(() => {
        const inProgress = publicBooks.filter(item => !item.isCompleted);
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <Headphones className="size-4 text-muted-foreground" />
              <h2 className="font-semibold text-foreground">{t('continueListening')}</h2>
              {inProgress.length > 0 && (
                <Badge variant="secondary" className="text-xs rounded-full font-mono">{inProgress.length}</Badge>
              )}
            </div>

            {inProgress.length === 0 ? (
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
                {inProgress.map(item => (
                  <BookCard
                    key={item.id}
                    id={item.audiobook.id}
                    title={item.audiobook.title}
                    coverImageUrl={item.audiobook.coverImageUrl}
                    author={item.audiobook.author?.name}
                    category={item.audiobook.category?.name}
                    durationSeconds={item.audiobook.durationSeconds}
                    progress={item.audiobook.durationSeconds > 0 ? Math.min(100, (item.currentPosition / item.audiobook.durationSeconds) * 100) : 0}
                  />
                ))}
              </div>
            )}

            {/* ── PDF Documents in Progress ── */}
            {(() => {
              const pdfsInProgress = personalBooks.filter(
                b => b.progress && !b.progress.isCompleted && b.progress.charOffset > 0,
              );
              if (pdfsInProgress.length === 0) return null;
              return (
                <div className="space-y-3 mt-4">
                  <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                    <FileText className="size-3.5" />
                    {t('personalDocsSection')}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {pdfsInProgress.map(book => {
                      const pct = book.progress.totalChars > 0
                        ? Math.min(100, Math.round((book.progress.charOffset / book.progress.totalChars) * 100))
                        : 0;
                      return (
                        <button
                          key={book.id}
                          onClick={() => playPdf(book.id, book.title)}
                          className="group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl"
                        >
                          <article className="bg-card rounded-2xl overflow-hidden flex flex-col shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
                            <div className="relative w-full aspect-[2/3] bg-primary/5 border-b border-border/40 flex flex-col items-center justify-center gap-2">
                              <FileText className="size-10 text-primary/40" />
                              <span className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">PDF</span>
                              {pct > 0 && (
                                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-border/40">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-primary to-[var(--gold)]"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              )}
                            </div>
                            <div className="p-3 flex flex-col gap-0.5 bg-card">
                              <p className="font-semibold text-foreground text-sm truncate leading-snug">{book.title}</p>
                              <p className="text-muted-foreground text-xs">{pct}% {t('bookCompleted').toLowerCase()}</p>
                            </div>
                          </article>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* ── Personal Documents — fully self-contained ── */}
      <PersonalDocumentsSection />

    </div>
  );
}
