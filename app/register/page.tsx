'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Headphones, Eye, EyeOff } from 'lucide-react';
import { toast } from '../../components/Toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { API_URL } from '@/lib/api';

export default function RegisterPage() {
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPwd,  setShowPwd]  = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (localStorage.getItem('token')) router.replace('/');
  }, [router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast('Parola trebuie să aibă cel puțin 6 caractere.', 'error');
      return;
    }
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (data.success) {
        toast('Cont creat cu succes! Te poți autentifica acum.');
        router.push('/login');
      } else {
        toast(data.message || 'Eroare la înregistrare.', 'error');
      }
    } catch {
      toast('Nu s-a putut conecta la server.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">

      {/* Left panel — atmospheric, desktop only */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden flex-col items-center justify-center p-16"
        style={{ background: 'linear-gradient(145deg, oklch(0.10 0.025 130) 0%, oklch(0.14 0.030 120) 50%, oklch(0.16 0.025 95) 100%)' }}
      >
        {/* Ambient orbs */}
        <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, oklch(0.72 0.16 142 / 0.15) 0%, transparent 70%)' }}
        />
        <div className="absolute bottom-1/4 left-1/5 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, oklch(0.78 0.14 75 / 0.12) 0%, transparent 70%)' }}
        />

        {/* Brand content */}
        <div className="relative z-10 flex flex-col items-center text-center gap-8 max-w-sm">
          <div className="flex size-16 items-center justify-center rounded-2xl border"
            style={{ background: 'oklch(0.72 0.16 142 / 0.2)', borderColor: 'oklch(0.72 0.16 142 / 0.35)' }}
          >
            <Headphones className="size-8" style={{ color: 'oklch(0.72 0.16 142)' }} />
          </div>

          <div className="space-y-3">
            <h1
              className="text-6xl font-bold leading-none"
              style={{ fontFamily: 'var(--font-fraunces)', fontStyle: 'italic', color: 'oklch(0.94 0.01 80)' }}
            >
              Grai
            </h1>
            <p className="text-base leading-relaxed" style={{ color: 'oklch(0.94 0.01 80 / 0.55)' }}>
              Dă glas cărților tale.<br />Oricând, oriunde.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 w-full">
            {[
              { value: '500+', label: 'Cărți' },
              { value: '50h', label: 'Conținut' },
              { value: '∞', label: 'Acces' },
            ].map(({ value, label }) => (
              <div key={label} className="flex flex-col items-center gap-1 p-3 rounded-xl"
                style={{ background: 'oklch(0.94 0.01 80 / 0.06)', border: '1px solid oklch(0.94 0.01 80 / 0.10)' }}
              >
                <span className="text-2xl font-bold" style={{ color: 'oklch(0.72 0.16 142)' }}>{value}</span>
                <span className="text-xs" style={{ color: 'oklch(0.94 0.01 80 / 0.45)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">

          {/* Mobile logo */}
          <div className="flex flex-col items-center gap-3 text-center lg:hidden">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
              <Headphones className="size-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold">Grai</h1>
          </div>

          {/* Heading */}
          <div>
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Creează un cont</h2>
            <p className="text-sm text-muted-foreground mt-1">Completează datele de mai jos pentru a începe.</p>
          </div>

          {/* Form */}
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium text-foreground">Nume</Label>
              <Input
                id="name"
                type="text"
                placeholder="Numele tău"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoComplete="name"
                className="h-11 rounded-xl border-border/70 bg-card focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nume@exemplu.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-11 rounded-xl border-border/70 bg-card focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">Parolă</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Minim 6 caractere"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="h-11 rounded-xl border-border/70 bg-card pr-10 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPwd ? 'Ascunde parola' : 'Arată parola'}
                >
                  {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all duration-200"
            >
              {loading ? 'Se creează contul…' : 'Creează cont gratuit'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Ai deja un cont?{' '}
            <Link href="/login" className="font-semibold text-primary hover:text-primary/80 transition-colors">
              Autentifică-te
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
