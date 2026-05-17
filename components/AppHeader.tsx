'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Headphones, Search, Bell, User, Menu, Moon, Sun, X, Trash2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearch } from './SearchContext';
import { useLanguage } from '../contexts/LanguageContext';
import { API_URL } from '@/lib/api';

interface AppHeaderProps {
  onMenuToggle?: () => void;
}

interface NotifBook {
  id: string;
  title: string;
  coverImageUrl: string;
  author: { name: string };
}

export function AppHeader({ onMenuToggle }: AppHeaderProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const { search, setSearch } = useSearch();
  const { lang, setLang, t } = useLanguage();
  const [userName,      setUserName]      = useState('');
  const [isDark,        setIsDark]        = useState(false);
  const [showNotifs,    setShowNotifs]    = useState(false);
  const [hasUnread,     setHasUnread]     = useState(false);
  const [notifBooks,    setNotifBooks]    = useState<NotifBook[]>([]);
  const [notifLoaded,   setNotifLoaded]   = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Runs synchronously before first paint — eliminates the avatar flash.
  // The existing useEffect below keeps state in sync on subsequent navigations.
  useLayoutEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) setUserName(JSON.parse(raw).name || '');
    } catch {}
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      setUserName(raw ? JSON.parse(raw).name || '' : '');
    } catch {}
    setIsDark(document.documentElement.classList.contains('dark'));
    const seenAt = localStorage.getItem('notifSeenAt');
    if (!seenAt || Date.now() - parseInt(seenAt) > 24 * 60 * 60 * 1000) setHasUnread(true);
  }, [pathname]);

  useEffect(() => {
    if (pathname !== '/') setSearch('');
  }, [pathname, setSearch]);

  useEffect(() => {
    if (!showNotifs) return;
    const handle = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showNotifs]);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  const handleBellClick = () => {
    const next = !showNotifs;
    setShowNotifs(next);
    if (next) {
      setHasUnread(false);
      localStorage.setItem('notifSeenAt', Date.now().toString());
      if (!notifLoaded) {
        fetch(`${API_URL}/api/audiobooks`)
          .then(r => r.json())
          .then(data => { if (data.success) setNotifBooks(data.data.slice(-4).reverse()); })
          .catch(() => {})
          .finally(() => setNotifLoaded(true));
      }
    }
  };

  // Dismiss a single notification from the local list
  const dismissNotif = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setNotifBooks(prev => prev.filter(b => b.id !== id));
  };

  // Clear all notifications and close the panel
  const clearAllNotifs = () => {
    setNotifBooks([]);
    setShowNotifs(false);
  };

  // Derived directly from userName — same field as the sidebar uses
  const initials = userName.trim().charAt(0).toUpperCase() || null;

  return (
    <header className="fixed top-0 left-0 right-0 h-16 z-50 flex items-center px-4 lg:px-6 bg-background/85 backdrop-blur-xl border-b border-border/60">

      {/* ── LEFT: hamburger + logo ────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <button
          onClick={onMenuToggle}
          className="lg:hidden flex size-9 items-center justify-center rounded-xl hover:bg-muted transition-colors shrink-0"
          aria-label="Open menu"
        >
          <Menu className="size-5 text-muted-foreground" />
        </button>

        <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
          <div className="flex size-8 items-center justify-center rounded-xl bg-primary shadow-[0_0_12px_var(--glow-sage)] group-hover:shadow-[0_0_20px_var(--glow-sage-strong)] transition-shadow duration-300">
            <Headphones className="size-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-foreground text-base tracking-tight hidden sm:block">
            AudioBooks
          </span>
        </Link>
      </div>

      {/* ── CENTER: search (truly centered because both sides are flex-1) ──── */}
      <div className="flex-1 max-w-md px-3">
        <div className="relative">
          <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 size-4 transition-colors duration-200 ${searchFocused ? 'text-primary' : 'text-muted-foreground'}`} />
          <input
            type="text"
            value={search}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            onChange={e => {
              setSearch(e.target.value);
              if (pathname !== '/') router.push('/');
            }}
            placeholder={t('searchPlaceholder')}
            className={`w-full bg-muted/70 rounded-xl pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground border border-transparent outline-none transition-all duration-200 ${
              searchFocused
                ? 'bg-card border-primary/40 shadow-[0_0_0_3px_var(--glow-sage)]'
                : 'hover:bg-muted hover:border-border/50'
            }`}
          />
        </div>
      </div>

      {/* ── RIGHT: actions ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 flex-1 justify-end">

        {/* RO / EN language toggle */}
        <div
          className="hidden sm:flex items-center rounded-lg border border-border/60 p-0.5 bg-muted/50 gap-0.5"
          role="group"
          aria-label="Language / Limbă"
        >
          {(['ro', 'en'] as const).map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              className={`px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide transition-all ${
                lang === l
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          className="flex size-9 items-center justify-center rounded-xl hover:bg-muted transition-colors"
          aria-label="Toggle theme"
        >
          {isDark
            ? <Sun  className="size-4 text-muted-foreground" />
            : <Moon className="size-4 text-muted-foreground" />
          }
        </button>

        {/* Bell + notification dropdown */}
        <div className="relative hidden sm:block" ref={notifRef}>
          <button
            onClick={handleBellClick}
            className={`flex size-9 items-center justify-center rounded-xl transition-colors ${showNotifs ? 'bg-muted text-foreground' : 'hover:bg-muted text-muted-foreground'}`}
            aria-label="Notifications"
          >
            <Bell className="size-4" strokeWidth={1.5} />
          </button>
          {hasUnread && (
            <span className="absolute top-2 right-2 size-1.5 rounded-full bg-primary ring-2 ring-background pointer-events-none" />
          )}

          {showNotifs && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-popover/95 backdrop-blur-xl border border-border/60 rounded-2xl shadow-2xl z-50 overflow-hidden animate-slide-in">

              {/* Header row */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                <span className="text-sm font-semibold text-foreground">{t('notifications')}</span>
                <div className="flex items-center gap-1">
                  {notifBooks.length > 0 && (
                    <button
                      onClick={clearAllNotifs}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-lg hover:bg-destructive/10"
                    >
                      <Trash2 className="size-3" />
                      <span>{t('clearAll')}</span>
                    </button>
                  )}
                  <button
                    onClick={() => setShowNotifs(false)}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              {/* Notification list */}
              <div className="divide-y divide-border/60 max-h-[360px] overflow-y-auto">
                {!notifLoaded ? (
                  <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">{t('loading')}</div>
                ) : notifBooks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                    <Bell className="size-7 opacity-20" />
                    <p className="text-sm">{t('noNotifications')}</p>
                  </div>
                ) : (
                  <>
                    <div className="px-4 pt-3 pb-1.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{t('newInLibrary')}</p>
                    </div>
                    {notifBooks.map(book => (
                      <div key={book.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60 transition-colors group/notif">
                        <Link
                          href={`/audiobook/${book.id}`}
                          onClick={() => setShowNotifs(false)}
                          className="flex items-center gap-3 flex-1 min-w-0"
                        >
                          <div className="relative size-10 rounded-lg overflow-hidden shrink-0 ring-1 ring-border/60">
                            <Image src={book.coverImageUrl} alt={book.title} fill sizes="40px" className="object-cover" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">{book.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{book.author?.name}</p>
                          </div>
                        </Link>
                        {/* Per-item dismiss button */}
                        <button
                          onClick={e => dismissNotif(e, book.id)}
                          className="shrink-0 opacity-0 group-hover/notif:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1 rounded-lg hover:bg-destructive/10"
                          aria-label={`Șterge notificarea pentru ${book.title}`}
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>

              <div className="px-4 py-2.5 border-t border-border/60 bg-muted/30">
                <Link href="/" onClick={() => setShowNotifs(false)} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                  {t('seeFullLibrary')}
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Avatar → Dashboard */}
        <button
          onClick={() => router.push('/dashboard')}
          title="Spațiul meu"
          className="flex size-9 items-center justify-center rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/20 hover:border-primary/40 transition-all duration-200"
        >
          {initials ? (
            <span className="text-xs font-bold text-primary">{initials}</span>
          ) : (
            <User className="size-4 text-primary" strokeWidth={1.5} />
          )}
        </button>

      </div>
    </header>
  );
}
