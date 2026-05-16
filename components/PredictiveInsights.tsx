'use client';

import { useMemo } from 'react';
import { TrendingUp, Calendar, Zap, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface ProgressItem {
  currentPosition: number;
  isCompleted: boolean;
  lastListened: string;
  audiobook: {
    id: string;
    title: string;
    durationSeconds: number;
    coverImageUrl: string;
    category: { name: string };
    author: { name: string };
  };
}

interface ActivityDay { day: string; count: number; }

interface PredictiveInsightsProps {
  progressItems: ProgressItem[];
  activity:      ActivityDay[];
}

function formatHours(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(date: Date) {
  return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' });
}

export function PredictiveInsights({ progressItems, activity }: PredictiveInsightsProps) {
  const insights = useMemo(() => {
    if (!progressItems.length) return null;

    // ── Listening velocity: seconds consumed per active day ──────────────
    const totalConsumed = progressItems.reduce((sum, p) => sum + p.currentPosition, 0);
    const activeDaysSet = new Set(
      progressItems
        .filter(p => p.lastListened)
        .map(p => new Date(p.lastListened).toDateString()),
    );
    const activeDays      = Math.max(1, activeDaysSet.size);
    const velocityPerDay  = totalConsumed / activeDays; // seconds/day

    // ── Streak: consecutive active days from today backwards ─────────────
    const activityStreak = (() => {
      let streak = 0;
      for (let i = activity.length - 1; i >= 0; i--) {
        if (activity[i].count > 0) streak++;
        else break;
      }
      return streak;
    })();

    // ── Predicted completion dates for in-progress books ─────────────────
    const predictions = progressItems
      .filter(p => !p.isCompleted && p.currentPosition > 0)
      .map(p => {
        const remaining    = p.audiobook.durationSeconds - p.currentPosition;
        const daysLeft     = velocityPerDay > 60 ? remaining / velocityPerDay : null;
        const completionDate = daysLeft !== null
          ? new Date(Date.now() + daysLeft * 86_400_000)
          : null;
        const pct = Math.min(100, (p.currentPosition / p.audiobook.durationSeconds) * 100);
        return { ...p, completionDate, pct, remaining };
      })
      .slice(0, 3); // show top 3

    // ── Category distribution (for the mini radar chart) ─────────────────
    const catMap: Record<string, number> = {};
    progressItems.forEach(p => {
      const cat = p.audiobook.category.name;
      catMap[cat] = (catMap[cat] || 0) + p.currentPosition;
    });
    const catEntries = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const catTotal = catEntries.reduce((s, [, v]) => s + v, 0) || 1;

    return { velocityPerDay, activeDays, activityStreak, predictions, catEntries, catTotal };
  }, [progressItems, activity]);

  if (!insights || !progressItems.length) return null;

  const { velocityPerDay, activityStreak, predictions, catEntries, catTotal } = insights;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="size-4 text-muted-foreground" />
        <h2 className="font-semibold text-foreground">Statistici Avansate</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* ── Streak + Velocity card ───────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="size-3.5 text-amber-500" />
              Ritm de ascultare
            </CardTitle>
            <CardDescription>
              {velocityPerDay > 60
                ? `~${formatHours(velocityPerDay)} pe zi în medie`
                : 'Prea puține date — ascultă mai mult!'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-foreground leading-none">{activityStreak}</p>
                <p className="text-xs text-muted-foreground mt-1">zile la rând</p>
              </div>
              {/* 7-day mini activity bars */}
              <div className="flex items-end gap-1 h-10 flex-1" aria-label="Activitate ultimele 7 zile">
                {activity.map(({ day, count }) => {
                  const maxCount = Math.max(...activity.map(a => a.count), 1);
                  const heightPct = count === 0 ? 8 : (count / maxCount) * 100;
                  return (
                    <div key={day} className="flex-1 flex flex-col items-center gap-0.5" title={`${day}: ${count}`}>
                      <div
                        className={`w-full rounded-sm transition-all duration-500 ${count > 0 ? 'bg-foreground' : 'bg-muted'}`}
                        style={{ height: `${heightPct}%` }}
                      />
                      <span className="text-[8px] text-muted-foreground">{day.slice(0, 2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Category distribution ────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="size-3.5 text-violet-500" />
              Distribuție categorii
            </CardTitle>
            <CardDescription>Timp ascultat pe gen</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {catEntries.map(([cat, seconds], index) => {
              const pct = Math.round((seconds / catTotal) * 100);
              return (
                <div key={cat} className="space-y-0.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground truncate pr-2">{cat}</span>
                    <span className="text-muted-foreground shrink-0">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden" style={{ minWidth: 4 }}>
                    <div
                      className="h-full bg-violet-500 rounded-full"
                      style={{
                        width: `${pct}%`,
                        minWidth: pct > 0 ? 4 : 0,
                        transition: 'width 0.7s cubic-bezier(0.34, 1.1, 0.64, 1)',
                        transitionDelay: `${index * 80}ms`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* ── Predicted completion dates ───────────────────────────────── */}
        {predictions.length > 0 && (
          <Card className="sm:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="size-3.5 text-green-500" />
                Predicție finalizare
              </CardTitle>
              <CardDescription>
                Bazat pe ritmul tău actual de ascultare
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {predictions.map((p, index) => (
                  <div key={p.audiobook.id} className="flex items-center gap-3">
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex justify-between items-baseline gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{p.audiobook.title}</p>
                        {p.completionDate ? (
                          <p className="text-xs text-green-600 dark:text-green-400 shrink-0 font-medium">
                            ~{formatDate(p.completionDate)}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground shrink-0">Dată necunoscută</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden" style={{ minWidth: 4 }}>
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{
                              width: `${p.pct}%`,
                              minWidth: p.pct > 0 ? 4 : 0,
                              transition: 'width 0.8s cubic-bezier(0.34, 1.1, 0.64, 1)',
                              transitionDelay: `${index * 120}ms`,
                            }}
                          />
                        </div>
                        <span className="text-[11px] text-muted-foreground tabular-nums w-8 text-right shrink-0">
                          {Math.round(p.pct)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
