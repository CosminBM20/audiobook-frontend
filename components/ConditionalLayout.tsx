'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';
import { BottomPlayer } from './BottomPlayer';
import { SearchProvider } from './SearchContext';
import { usePlayerControls } from '../contexts/PlayerContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useInactivityLogout } from '../hooks/useInactivityLogout';
import { HelpCircle, X, Keyboard } from 'lucide-react';

const NO_CHROME = ['/login', '/register'];

// Decode a JWT payload without verifying the signature (client-side only).
// Returns true when the token is expired or malformed.
function isTokenExpired(token: string): boolean {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64)) as { exp?: number };
    if (!payload.exp) return false;
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // ── Locked by default. Nothing renders until this becomes true. ───────────
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [showHelp,     setShowHelp]     = useState(false);
  const { book, pdfTrack, isPlaying, ttsIsPlaying } = usePlayerControls();
  const { t } = useLanguage();

  const SHORTCUTS = [
    { key: 'Space', action: t('shortcutPlay') },
    { key: '←',    action: t('back15') },
    { key: '→',    action: t('forward15') },
    { key: 'M',    action: t('shortcutMute') },
  ];

  const isAuthRoute = NO_CHROME.includes(pathname);

  // ╔══════════════════════════════════════════════════════════════╗
  // ║  SCREENSHOT: Listing 3.2 — Guard de rută client-side        ║
  // ║  Capturați useEffect-ul de mai jos + blocul if (!isAuthorized║
  // ╚══════════════════════════════════════════════════════════════╝
  useEffect(() => {
    if (isAuthRoute) {
      // /login and /register are always allowed to render.
      setIsAuthorized(true);
      return;
    }

    const token = localStorage.getItem('token');

    if (!token || isTokenExpired(token)) {
      // Clear any stale data before redirecting
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // window.location.href is a synchronous hard redirect.
      // Unlike router.replace(), it does NOT yield back to React,
      // so there is zero chance of a subsequent render showing protected content.
      window.location.href = '/login';
      return;
    }

    setIsAuthorized(true);
  }, [isAuthRoute]);

  // ── Inactivity auto-logout ────────────────────────────────────────────────
  // Active only on authenticated protected routes. Suspended while audio plays.
  useInactivityLogout(!isAuthRoute && isAuthorized, isPlaying || ttsIsPlaying);

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
  // ╚══ SFARSIT Listing 3.2 ══════════════════════════════════════╝

  // ── Auth routes (login / register) — no chrome ────────────────────────────
  if (isAuthRoute) return <>{children}</>;

  // ── Protected routes — full chrome ────────────────────────────────────────
  return (
    <SearchProvider>
      <AppHeader onMenuToggle={() => setMobileOpen(o => !o)} />
      <AppSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <main
        id="main-content"
        className={`pt-16 lg:pl-64 min-h-screen bg-background transition-[padding] duration-300 ${(book || pdfTrack) ? 'pb-[80px]' : ''}`}
      >
        {children}
      </main>

      <BottomPlayer />

      {/* ── Floating help button ─────────────────────────────────────────── */}
      <button
        aria-label={t('openHelp')}
        onClick={() => setShowHelp(true)}
        className={`fixed right-6 z-50 flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:scale-105 transition-all duration-200 ${(book || pdfTrack) ? 'bottom-[88px]' : 'bottom-6'}`}
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
                <h2 className="font-semibold text-foreground">{t('shortcutsTitle')}</h2>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label={t('closeModal')}
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
              {t('shortcutsHint')}
            </p>
          </div>
        </div>
      )}
    </SearchProvider>
  );
}
