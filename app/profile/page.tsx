'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { User, Lock, Save, Loader2, ShieldCheck, LogOut, Clock, BookOpen, Trophy, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/Toast';
import { API_URL } from '@/lib/api';

export default function ProfilePage() {
  const router = useRouter();
  const { t, lang } = useLanguage();

  const [profile,  setProfile]  = useState<{ name: string; email: string; role: string; createdAt: string } | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [savingInfo,  setSavingInfo]  = useState(false);
  const [savingPass,  setSavingPass]  = useState(false);
  const [stats, setStats] = useState<{ totalSeconds: number; booksStarted: number; completed: number } | null>(null);
  const [challengesCompleted, setChallengesCompleted] = useState(0);

  const [name,      setName]      = useState('');
  const [email,     setEmail]     = useState('');
  const [curPass,   setCurPass]   = useState('');
  const [newPass,   setNewPass]   = useState('');
  const [confPass,  setConfPass]  = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    Promise.all([
      fetch(`${API_URL}/api/user/profile`,        { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API_URL}/api/audiobooks/stats`,     { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${API_URL}/api/challenges`,           { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ])
      .then(([profile, statsData, challengesData]) => {
        if (profile.success) {
          setProfile(profile.data);
          setName(profile.data.name);
          setEmail(profile.data.email);
        }
        if (statsData.success) setStats(statsData.data);
        if (challengesData.success) {
          setChallengesCompleted(challengesData.data.filter((c: any) => c.isCompleted).length);
        }
      })
      .catch(() => toast(t('errLoadProfile'), 'error'))
      .finally(() => setLoading(false));
  }, [router]);

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) return;
    setSavingInfo(true);
    try {
      const res  = await fetch(`${API_URL}/api/user/profile`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ name, email }),
      });
      const data = await res.json();
      if (!data.success) { toast(data.message || t('errGeneric'), 'error'); return; }
      setProfile(prev => prev ? { ...prev, name: data.data.name, email: data.data.email } : prev);
      // Update localStorage so sidebar/header reflects new name immediately
      try {
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...stored, name: data.data.name, email: data.data.email }));
      } catch {}
      toast(t('profileUpdated'), 'success');
    } catch { toast(t('errConnection'), 'error'); }
    finally { setSavingInfo(false); }
  };

  const handleSavePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass !== confPass) { toast(t('passwordMismatch'), 'error'); return; }
    if (newPass.length < 6)   { toast(t('passwordTooShort'), 'error'); return; }
    const token = localStorage.getItem('token');
    if (!token) return;
    setSavingPass(true);
    try {
      const res  = await fetch(`${API_URL}/api/user/profile`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ currentPassword: curPass, newPassword: newPass }),
      });
      const data = await res.json();
      if (!data.success) { toast(data.message || t('errGeneric'), 'error'); return; }
      toast(t('passwordChanged'), 'success');
      setCurPass(''); setNewPass(''); setConfPass('');
    } catch { toast(t('errConnection'), 'error'); }
    finally { setSavingPass(false); }
  };

  if (loading) return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <Skeleton className="h-10 w-48 rounded-2xl" />
      <Skeleton className="h-48 rounded-2xl" />
      <Skeleton className="h-56 rounded-2xl" />
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-center gap-4">
        <div
          className="flex size-14 items-center justify-center rounded-2xl text-xl font-bold text-primary-foreground shrink-0"
          style={{ background: 'linear-gradient(135deg, var(--sage), var(--gold))' }}
        >
          {profile?.name?.trim().charAt(0).toUpperCase() || '?'}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground leading-tight" style={{ fontFamily: 'var(--font-fraunces)' }}>
            {profile?.name}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-muted-foreground">{profile?.email}</p>
            {profile?.role === 'ADMIN' && (
              <Badge className="rounded-full text-[10px] gap-1 bg-primary/10 text-primary border-primary/20 px-2">
                <ShieldCheck className="size-2.5" />Admin
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Stats summary */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              icon: Clock,
              label: t('totalListened'),
              value: (() => {
                const h = Math.floor(stats.totalSeconds / 3600);
                const m = Math.floor((stats.totalSeconds % 3600) / 60);
                return h > 0 ? `${h}h ${m}m` : `${m}m`;
              })(),
              accent: 'oklch(0.68 0.14 185)',
            },
            {
              icon: BookOpen,
              label: t('booksStartedStat'),
              value: stats.booksStarted,
              accent: 'oklch(0.65 0.10 280)',
            },
            {
              icon: Trophy,
              label: t('booksCompleted'),
              value: stats.completed,
              accent: 'var(--sage)',
            },
          ].map(({ icon: Icon, label, value, accent }) => (
            <div
              key={label}
              className="relative bg-card rounded-2xl border border-border/60 p-4 flex flex-col gap-2 overflow-hidden shadow-sm"
            >
              <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: accent }} />
              <Icon className="size-3.5" style={{ color: accent }} />
              <p className="text-xl font-bold text-foreground tabular-nums leading-none">{value}</p>
              <p className="text-[11px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      )}

      {challengesCompleted > 0 && (
        <div className="bg-card rounded-2xl border border-border/60 px-5 py-4 flex items-center gap-3 shadow-sm">
          <Award className="size-4 text-primary shrink-0" />
          <p className="text-sm text-foreground">
            <span className="font-bold">{challengesCompleted}</span>
            <span className="text-muted-foreground">{t('challengesCompletedSuffix')}</span>
          </p>
        </div>
      )}

      {/* Personal info */}
      <div className="bg-card rounded-2xl border border-border/60 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <User className="size-4 text-muted-foreground" />
          <h2 className="font-semibold text-foreground text-sm">{t('profilePersonalInfo')}</h2>
        </div>
        <form onSubmit={handleSaveInfo} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="profile-name" className="text-xs text-muted-foreground">{t('nameLabel')}</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="rounded-xl border-border/70 h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-email" className="text-xs text-muted-foreground">Email</Label>
            <Input
              id="profile-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="rounded-xl border-border/70 h-10"
            />
          </div>
          <Button type="submit" disabled={savingInfo} className="rounded-xl gap-2 w-full sm:w-auto">
            {savingInfo ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {savingInfo ? t('saving') : t('saveInfoBtn')}
          </Button>
        </form>
      </div>

      {/* Change password */}
      <div className="bg-card rounded-2xl border border-border/60 p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Lock className="size-4 text-muted-foreground" />
          <h2 className="font-semibold text-foreground text-sm">{t('profileChangePassword')}</h2>
        </div>
        <form onSubmit={handleSavePass} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cur-pass" className="text-xs text-muted-foreground">{t('currentPasswordLabel')}</Label>
            <Input
              id="cur-pass"
              type="password"
              value={curPass}
              onChange={e => setCurPass(e.target.value)}
              required
              autoComplete="current-password"
              className="rounded-xl border-border/70 h-10"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-pass" className="text-xs text-muted-foreground">{t('newPasswordLabel')}</Label>
              <Input
                id="new-pass"
                type="password"
                value={newPass}
                onChange={e => setNewPass(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="rounded-xl border-border/70 h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="conf-pass" className="text-xs text-muted-foreground">{t('confirmPasswordLabel')}</Label>
              <Input
                id="conf-pass"
                type="password"
                value={confPass}
                onChange={e => setConfPass(e.target.value)}
                required
                autoComplete="new-password"
                className="rounded-xl border-border/70 h-10"
              />
            </div>
          </div>
          <Button type="submit" disabled={savingPass} variant="outline" className="rounded-xl gap-2 w-full sm:w-auto">
            {savingPass ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
            {savingPass ? t('saving') : t('profileChangePassword')}
          </Button>
        </form>
      </div>

      {/* Logout */}
      <div className="flex flex-col items-center gap-3">
        <Button
          variant="outline"
          className="rounded-xl gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive/50"
          onClick={() => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            router.push('/login');
          }}
        >
          <LogOut className="size-4" />
          {t('logout')}
        </Button>

        {profile?.createdAt && (
          <p className="text-xs text-muted-foreground text-center">
            {t('accountCreatedOn')} {new Date(profile.createdAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'ro-RO', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        )}
      </div>
    </div>
  );
}
