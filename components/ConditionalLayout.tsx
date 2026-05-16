'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';
import { BottomPlayer } from './BottomPlayer';
import { SearchProvider } from './SearchContext';
import { usePlayerControls } from '../contexts/PlayerContext';
import { HelpCircle, X, Keyboard } from 'lucide-react';

const NO_CHROME = ['/login', '/register'];

const SHORTCUTS = [
  { key: 'Space', action: 'Play / Pauză' },
  { key: '←',    action: 'Înapoi 15 secunde' },
  { key: '→',    action: 'Înainte 15 secunde' },
  { key: 'M',    action: 'Mute / Unmute volum' },
];

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // ── Locked by default. Nothing renders until this becomes true. ───────────
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [showHelp,     setShowHelp]     = useState(false);
  const { book } = usePlayerControls();

  const isAuthRoute = NO_CHROME.includes(pathname);

  useEffect(() => {
    if (isAuthRoute) {
      // /login and /register are always allowed to render.
      setIsAuthorized(true);
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      // window.location.href is a synchronous hard redirect.
      // Unlike router.replace(), it does NOT yield back to React,
      // so there is zero chance of a subsequent render showing protected content.
      window.location.href = '/login';
      return;
    }

    setIsAuthorized(true);
  }, [isAuthRoute]);

  // ── STRICT GATE ───────────────────────────────────────────────────────────
  // isAuthorized starts false and is only flipped to true inside the effect
  // above. Until then, this is the ONLY thing that renders — no children,
  // no chrome, no content at all.
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Auth routes (login / register) — no chrome ────────────────────────────
  if (isAuthRoute) return <>{children}</>;

  // ── Protected routes — full chrome ────────────────────────────────────────
  return (
    <SearchProvider>
      <AppHeader onMenuToggle={() => setMobileOpen(o => !o)} />
      <AppSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <main
        id="main-content"
        className={`pt-16 lg:pl-64 min-h-screen bg-background transition-[padding] duration-300 ${book ? 'pb-[72px]' : ''}`}
      >
        {children}
      </main>

      <BottomPlayer />

      {/* ── Floating help button ─────────────────────────────────────────── */}
      <button
        aria-label="Deschide ajutor"
        onClick={() => setShowHelp(true)}
        className={`fixed right-6 z-50 flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:scale-105 transition-all duration-200 ${book ? 'bottom-[88px]' : 'bottom-6'}`}
      >
        <HelpCircle className="size-5" strokeWidth={1.5} />
      </button>

      {/* ── Help modal ────────────────────────────────────────────────────── */}
      {showHelp && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowHelp(false); }}
        >
          <div className="bg-popover border border-border/60 rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-slide-in">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Keyboard className="size-4 text-primary" />
                <h2 className="font-semibold text-foreground">Scurtături tastatură</h2>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Închide"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-3">
              {SHORTCUTS.map(({ key, action }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{action}</span>
                  <kbd className="px-2.5 py-1 bg-muted border border-border/60 rounded-lg text-xs font-mono text-foreground shadow-sm">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
            <p className="mt-5 text-xs text-muted-foreground/50 text-center">
              Scurtăturile funcționează în pagina playerului
            </p>
          </div>
        </div>
      )}
    </SearchProvider>
  );
}
