'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useState } from 'react';
import { Library, LayoutDashboard, ShieldCheck, LogOut, Headphones } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { usePlayerControls } from '../contexts/PlayerContext';
import { useLanguage } from '../contexts/LanguageContext';
import { API_URL } from '@/lib/api';

interface AppSidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

// Keys reference the LanguageContext dictionary — labels are resolved via t()
const navItems = [
  { labelKey: 'library'  as const, href: '/',          icon: Library },
  { labelKey: 'mySpace'  as const, href: '/dashboard', icon: LayoutDashboard },
];

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const { t }     = useLanguage();

  const [isLoggedIn,     setIsLoggedIn]     = useState(false);
  const [isAdmin,        setIsAdmin]        = useState(false);
  const [userName,       setUserName]       = useState('');
  const [booksCompleted, setBooksCompleted] = useState(0);
  const goalTotal = 20;

  // Synchronous read before first paint — no avatar flash.
  useLayoutEffect(() => {
    try {
      const token   = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      setIsLoggedIn(!!token);
      if (userStr) {
        const user = JSON.parse(userStr);
        setIsAdmin(user.role === 'ADMIN');
        setUserName(user.name || '');
      }
    } catch {}
  }, []);

  useEffect(() => {
    const token   = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    setIsLoggedIn(!!token);
    if (userStr) {
      const user = JSON.parse(userStr);
      setIsAdmin(user.role === 'ADMIN');
      setUserName(user.name || '');
    }
    if (token) {
      fetch(`${API_URL}/api/audiobooks/stats`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(d => { if (d.success) setBooksCompleted(d.data.completed); })
        .catch(() => {});
    }
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsLoggedIn(false);
    router.push('/login');
    router.refresh();
  };

  const progressPct = Math.min(100, Math.round((booksCompleted / goalTotal) * 100));

  return (
    <div className="flex flex-col h-full">

      {/* Nav links */}
      <nav className="flex-1 p-3 space-y-0.5 pt-4">
        {navItems.map(({ labelKey, href, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavClick}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-[0_2px_12px_var(--glow-sage)]'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              }`}
            >
              <Icon className="size-4 shrink-0" strokeWidth={isActive ? 2 : 1.5} />
              {t(labelKey)}
            </Link>
          );
        })}

        {isAdmin && (
          <Link
            href="/admin"
            onClick={onNavClick}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              pathname === '/admin'
                ? 'bg-primary text-primary-foreground shadow-[0_2px_12px_var(--glow-sage)]'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            }`}
          >
            <ShieldCheck className="size-4 shrink-0" strokeWidth={pathname === '/admin' ? 2 : 1.5} />
            {t('adminPanel')}
          </Link>
        )}
      </nav>

      {/* Bottom section */}
      <div className="p-3 space-y-2.5">

        {/* Progress widget */}
        <div className="rounded-xl border border-sidebar-border/60 bg-sidebar-accent/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-sidebar-foreground">{t('annualGoal')}</p>
            <span className="text-xs font-bold text-primary">{progressPct}%</span>
          </div>
          <div>
            <div className="w-full h-1.5 bg-sidebar-border/40 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-primary to-[var(--gold)]"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {booksCompleted} {t('outOf')} {goalTotal} {t('booksCompletedOf')}
            </p>
          </div>
        </div>

        {/* User + logout */}
        {isLoggedIn && (
          <div className="flex items-center gap-2 px-1">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/15 border border-primary/25 shrink-0">
              <span className="text-[11px] font-bold text-primary">
                {userName.trim().charAt(0).toUpperCase() || '?'}
              </span>
            </div>
            <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">{userName}</span>
            <button
              onClick={handleLogout}
              title={t('logout')}
              className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function AppSidebar({ mobileOpen = false, onClose }: AppSidebarProps) {
  const { book } = usePlayerControls();
  return (
    <>
      {/* Desktop — fixed, hidden on mobile */}
      <aside className={`hidden lg:flex fixed left-0 top-16 w-64 bg-sidebar border-r border-sidebar-border/60 z-40 flex-col overflow-y-auto transition-[bottom] duration-300 ${book ? 'bottom-[72px]' : 'bottom-0'}`}>
        <SidebarContent />
      </aside>

      {/* Mobile — Sheet overlay */}
      <Sheet open={mobileOpen} onOpenChange={open => !open && onClose?.()}>
        <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border/60">
          <div className="flex items-center gap-2.5 px-4 py-4 border-b border-sidebar-border/60">
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary shadow-[0_0_10px_var(--glow-sage)]">
              <Headphones className="size-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sidebar-foreground tracking-tight">AudioBooks</span>
          </div>
          <div className="flex flex-col h-[calc(100%-57px)] overflow-y-auto">
            <SidebarContent onNavClick={onClose} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
