'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';
import { BottomPlayer } from './BottomPlayer';
import { SearchProvider } from './SearchContext';
import { usePlayerControls } from '../contexts/PlayerContext';
import { HelpCircle } from 'lucide-react';

const NO_CHROME = ['/login', '/register'];

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname   = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { book } = usePlayerControls();

  if (NO_CHROME.includes(pathname)) return <>{children}</>;

  return (
    <SearchProvider>
      <AppHeader onMenuToggle={() => setMobileOpen(o => !o)} />
      <AppSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <main id="main-content" className={`pt-16 lg:pl-64 min-h-screen bg-background transition-[padding] duration-300 ${book ? 'pb-[72px]' : ''}`}>
        {children}
      </main>

      <BottomPlayer />

      <button
        aria-label="Help"
        className={`fixed right-6 z-50 flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:scale-105 transition-all duration-200 ${book ? 'bottom-[88px]' : 'bottom-6'}`}
      >
        <HelpCircle className="size-5" strokeWidth={1.5} />
      </button>
    </SearchProvider>
  );
}
