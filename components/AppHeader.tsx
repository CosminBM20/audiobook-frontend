'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Headphones, Search, Bell, User, Menu, Moon, Sun, X } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearch } from './SearchContext';

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
  const [userName,     setUserName]     = useState('');
  const [isDark,       setIsDark]       = useState(false);
  const [showNotifs,   setShowNotifs]   = useState(false);
  const [hasUnread,    setHasUnread]    = useState(false);
  const [notifBooks,   setNotifBooks]   = useState<NotifBook[]>([]);
  const [notifLoaded,  setNotifLoaded]  = useState(false);
  const [searchFocused,setSearchFocused]= useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) setUserName(JSON.parse(user).name || '');
    setIsDark(document.documentElement.classList.contains('dark'));

    const seenAt = localStorage.getItem('notifSeenAt');
    if (!seenAt || Date.now() - parseInt(seenAt) > 24 * 60 * 60 * 1000) {
      setHasUnread(true);
    }
  }, [pathname]);

  useEffect(() => {
    if (pathname !== '/') setSearch('');
  }, [pathname, setSearch]);

  useEffect(() => {
    if (!showNotifs) return;
    const handle = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
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
        fetch('http://localhost:5000/api/audiobooks')
          .then(r => r.json())
          .then(data => { if (data.success) setNotifBooks(data.data.slice(-4).reverse()); })
          .catch(() => {})
          .finally(() => setNotifLoaded(true));
      }
    }
  };

  const initials = userName ? userName.charAt(0).toUpperCase() : null;

  return (
    <header className="fixed top-0 left-0 right-0 h-16 z-50 flex items-center px-4 lg:px-6 gap-3 lg:gap-6 bg-background/85 backdrop-blur-xl border-b border-border/60">

      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden flex size-9 items-center justify-center rounded-xl hover:bg-muted transition-colors shrink-0"
        aria-label="Open menu"
      >
        <Menu className="size-5 text-muted-foreground" />
      </button>

      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
        <div className="flex size-8 items-center justify-center rounded-xl bg-primary shadow-[0_0_12px_var(--glow-sage)] group-hover:shadow-[0_0_20px_var(--glow-sage-strong)] transition-shadow duration-300">
          <Headphones className="size-4 text-primary-foreground" />
        </div>
        <span className="font-bold text-foreground text-base tracking-tight hidden sm:block">
          AudioBooks
        </span>
      </Link>

      {/* Search */}
      <div className="flex-1 max-w-md mx-auto">
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
            placeholder="Caută cărți, autori..."
            className={`w-full bg-muted/70 rounded-xl pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground border border-transparent outline-none transition-all duration-200 ${
              searchFocused
                ? 'bg-card border-primary/40 shadow-[0_0_0_3px_var(--glow-sage)]'
                : 'hover:bg-muted hover:border-border/50'
            }`}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0 ml-auto">

        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          className="flex size-9 items-center justify-center rounded-xl hover:bg-muted transition-colors"
          aria-label="Toggle theme"
        >
          {isDark
            ? <Sun  className="size-4 text-muted-foreground hover:text-gold transition-colors" />
            : <Moon className="size-4 text-muted-foreground hover:text-primary transition-colors" />
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
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                <span className="text-sm font-semibold text-foreground">Notificări</span>
                <button onClick={() => setShowNotifs(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="size-4" />
                </button>
              </div>

              <div className="divide-y divide-border/60 max-h-[360px] overflow-y-auto">
                {!notifLoaded ? (
                  <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">Se încarcă…</div>
                ) : notifBooks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                    <Bell className="size-7 opacity-20" />
                    <p className="text-sm">Nicio notificare</p>
                  </div>
                ) : (
                  <>
                    <div className="px-4 pt-3 pb-1.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Nou în bibliotecă</p>
                    </div>
                    {notifBooks.map(book => (
                      <Link
                        key={book.id}
                        href={`/audiobook/${book.id}`}
                        onClick={() => setShowNotifs(false)}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60 transition-colors"
                      >
                        <div className="relative size-10 rounded-lg overflow-hidden shrink-0 ring-1 ring-border/60">
                          <Image src={book.coverImageUrl} alt={book.title} fill sizes="40px" className="object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{book.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{book.author?.name}</p>
                        </div>
                      </Link>
                    ))}
                  </>
                )}
              </div>

              <div className="px-4 py-2.5 border-t border-border/60 bg-muted/30">
                <Link href="/" onClick={() => setShowNotifs(false)} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                  Vezi toată librăria →
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
