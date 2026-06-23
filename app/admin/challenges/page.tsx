'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { Plus, ToggleLeft, ToggleRight, Trash2, Edit2, X, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/Toast';
import { API_URL } from '@/lib/api';

const TYPES     = ['LISTENING_TIME', 'BOOKS_COMPLETED', 'PDF_SESSIONS', 'STREAK', 'CATEGORY_EXPLORER'];
const PERIODS   = ['ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY'];
const DIFFS     = ['EASY', 'MEDIUM', 'HARD', 'LEGENDARY'];
const DIFF_COLOR: Record<string, string> = {
  EASY: 'text-emerald-500', MEDIUM: 'text-yellow-500', HARD: 'text-orange-500', LEGENDARY: 'text-purple-500',
};

const blank = () => ({
  title: '', description: '', titleEn: '', descriptionEn: '',
  type: 'BOOKS_COMPLETED', difficulty: 'EASY',
  target: '1', period: 'ONE_TIME', xpReward: '50', badgeIcon: '🏆',
  startsAt: '', endsAt: '',
});

export default function AdminChallengesPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const TYPE_LABEL: Record<string, string> = {
    LISTENING_TIME: t('typeListeningTime'), BOOKS_COMPLETED: t('typeBooksCompleted'),
    PDF_SESSIONS: t('typePdfSessions'), STREAK: t('typeStreak'), CATEGORY_EXPLORER: t('typeCategoryExplorer'),
  };
  const [challenges, setChallenges] = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [editing,    setEditing]    = useState<string | null>(null);
  const [form,       setForm]       = useState(blank());
  const [saving,     setSaving]     = useState(false);

  useEffect(() => {
    const token    = localStorage.getItem('token');
    const userStr  = localStorage.getItem('user');
    if (!token || !userStr) { router.push('/login'); return; }
    let user: { role?: string } | null = null;
    try { user = JSON.parse(userStr); } catch { user = null; }
    if (!user || user.role !== 'ADMIN') { router.push('/'); return; }
    fetchChallenges(token);
  }, [router]);

  const fetchChallenges = async (token: string) => {
    try {
      const res  = await fetch(`${API_URL}/api/challenges/admin`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setChallenges(data.data);
    } catch { toast(t('errLoadData'), 'error'); }
    finally  { setLoading(false); }
  };

  const handleToggle = async (id: string) => {
    const token = localStorage.getItem('token')!;
    try {
      const res  = await fetch(`${API_URL}/api/challenges/${id}/toggle`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setChallenges(prev => prev.map(c => c.id === id ? { ...c, isActive: data.data.isActive } : c));
    } catch { toast(t('errGeneric'), 'error'); }
  };

  const handleArchive = async (id: string) => {
    if (!confirm(t('archiveConfirm'))) return;
    const token = localStorage.getItem('token')!;
    try {
      const res  = await fetch(`${API_URL}/api/challenges/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setChallenges(prev => prev.filter(c => c.id !== id));
    } catch { toast(t('errGeneric'), 'error'); }
  };

  const openCreate = () => { setForm(blank()); setEditing(null); setShowForm(true); };
  const openEdit   = (ch: any) => {
    setForm({
      title: ch.title, description: ch.description,
      titleEn: ch.titleEn || '', descriptionEn: ch.descriptionEn || '',
      type: ch.type,
      difficulty: ch.difficulty, target: String(ch.target), period: ch.period,
      xpReward: String(ch.xpReward), badgeIcon: ch.badgeIcon,
      startsAt: ch.startsAt ? ch.startsAt.slice(0, 10) : '',
      endsAt:   ch.endsAt   ? ch.endsAt.slice(0, 10)   : '',
    });
    setEditing(ch.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast(t('titleRequired'), 'error'); return; }
    setSaving(true);
    const token = localStorage.getItem('token')!;
    const body  = JSON.stringify(form);
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    try {
      const res  = editing
        ? await fetch(`${API_URL}/api/challenges/${editing}`, { method: 'PATCH', headers, body })
        : await fetch(`${API_URL}/api/challenges`,            { method: 'POST',  headers, body });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      if (editing) {
        setChallenges(prev => prev.map(c => c.id === editing ? { ...c, ...data.data } : c));
      } else {
        setChallenges(prev => [{ ...data.data, participantCount: 0, completedCount: 0, completionRate: 0 }, ...prev]);
      }
      setShowForm(false);
      toast(editing ? t('challengeSaved') : t('challengeCreated'));
    } catch (err: any) { toast(err.message || t('errGeneric'), 'error'); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-4">
      {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-fraunces)' }}>
            {t('challengesAdmin')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {challenges.filter(c => c.isActive).length} active · {challenges.length} total
          </p>
        </div>
        <Button onClick={openCreate} className="rounded-xl gap-2">
          <Plus className="size-4" /> {t('newChallengeBtn')}
        </Button>
      </div>

      {/* Challenges table */}
      <div className="space-y-3">
        {challenges.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p>{t('noChallengesYet')}</p>
          </div>
        )}
        {challenges.map(ch => (
          <div key={ch.id} className="bg-card rounded-2xl border border-border/60 p-4 flex items-center gap-4 shadow-sm">
            <span className="text-2xl shrink-0">{ch.badgeIcon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-foreground text-sm">{lang === 'en' && ch.titleEn ? ch.titleEn : ch.title}</p>
                <Badge variant="secondary" className={`text-[10px] ${DIFF_COLOR[ch.difficulty]}`}>{ch.difficulty}</Badge>
                <Badge variant="outline" className="text-[10px]">{ch.period}</Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{lang === 'en' && ch.descriptionEn ? ch.descriptionEn : ch.description}</p>
              <div className="flex items-center gap-4 mt-1.5 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><BarChart2 className="size-3" />{ch.participantCount} {t('participantsSuffix')} · {ch.completionRate}{t('completionSuffix')}</span>
                <span>{TYPE_LABEL[ch.type] ?? ch.type}: {ch.target}</span>
                <span className="text-primary font-semibold">+{ch.xpReward} XP</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleToggle(ch.id)}
                aria-label={ch.isActive ? t('deactivate') : t('activate')}
                className={`transition-colors ${ch.isActive ? 'text-primary' : 'text-muted-foreground'}`}
                title={ch.isActive ? t('deactivate') : t('activate')}
              >
                {ch.isActive ? <ToggleRight className="size-6" /> : <ToggleLeft className="size-6" />}
              </button>
              <button onClick={() => openEdit(ch)} className="text-muted-foreground hover:text-foreground transition-colors">
                <Edit2 className="size-4" />
              </button>
              <button onClick={() => handleArchive(ch.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl border border-border/60 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-foreground text-lg" style={{ fontFamily: 'var(--font-fraunces)' }}>
                {editing ? t('editChallengeBtn') : t('newChallengeBtn')}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="size-5" /></button>
            </div>

            {([
              { label: t('formTitleLabel'),  key: 'title',          type: 'text' },
              { label: t('formDescLabel'),   key: 'description',    type: 'text' },
              { label: 'Title (English)',    key: 'titleEn' as keyof typeof form, type: 'text' },
              { label: 'Description (En)',   key: 'descriptionEn' as keyof typeof form, type: 'text' },
              { label: t('formBadgeLabel'),  key: 'badgeIcon',      type: 'text' },
              { label: t('formXpLabel'),     key: 'xpReward',       type: 'number' },
              { label: t('formTargetLabel'), key: 'target',         type: 'number' },
              { label: t('formStartLabel'),  key: 'startsAt',       type: 'date' },
              { label: t('formEndLabel'),    key: 'endsAt',         type: 'date' },
            ] as Array<{ label: string; key: keyof typeof form; type: string }>).map(({ label, key, type }) => (
              <div key={key} className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{label}</label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            ))}

            {([
              { label: t('typeLabel'),       key: 'type',       options: TYPES.map(v => ({ value: v, label: TYPE_LABEL[v] ?? v })) },
              { label: t('periodLabel'),     key: 'period',     options: PERIODS.map(v => ({ value: v, label: v })) },
              { label: t('difficultyLabel'), key: 'difficulty', options: DIFFS.map(v => ({ value: v, label: v })) },
            ] as Array<{ label: string; key: keyof typeof form; options: {value:string;label:string}[] }>).map(({ label, key, options }) => (
              <div key={key} className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{label}</label>
                <select
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            ))}

            <div className="flex gap-3 pt-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl">
                {saving ? t('saving') : t('saveChanges')}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)} className="rounded-xl">
                {t('cancel')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
