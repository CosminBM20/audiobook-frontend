'use client';

import { useState, useMemo, useEffect, useCallback, useDeferredValue } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { toast } from '../components/Toast';
import { BookCard } from '../components/BookCard';
import { BookListRow } from '../components/BookListRow';
import { useSearch } from '../components/SearchContext';
import { usePlayerControls } from '../contexts/PlayerContext';
import { API_URL } from '@/lib/api';
import { LayoutGrid, List, ArrowUpAZ, Clock3, RotateCcw, User, Play, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { Audiobook } from './page';

interface LastBook {
  currentPosition: number;
  audiobook: {
    id: string;
    title: string;
    coverImageUrl: string;
    durationSeconds: number;
    author: { name: string };
  };
}

type SortMode = 'default' | 'title' | 'author' | 'duration';
type ViewMode = 'grid' | 'list';

const gridContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
};
const gridItem: Variants = {
  hidden:  { opacity: 0, y: 14, scale: 0.97 },
  visible: { opacity: 1, y: 0,  scale: 1,
    transition: { duration: 0.28, ease: 'easeOut' } },
};

export default function HomeClient({ initialBooks }: { initialBooks: Audiobook[] }) {
  const { search }    = useSearch();
  const { playBook }  = usePlayerControls();
  const deferredSearch = useDeferredValue(search);

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortMode,         setSortMode]         = useState<SortMode>('default');
  const [viewMode,         setViewMode]         = useState<ViewMode>('grid');
  const [favorites,        setFavorites]        = useState<Set<string>>(new Set());
  const [lastBook,         setLastBook]         = useState<LastBook | null>(null);
  const [showBanner,       setShowBanner]       = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    fetch(`${API_URL}/api/favorites`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.success) setFavorites(new Set(d.data)); })
      .catch(() => {});

    if (!sessionStorage.getItem('bannerDismissed')) {
      fetch(`${API_URL}/api/audiobooks/my-books`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => {
          if (d.success && d.data.length > 0) {
            const inProgress = d.data.filter((item: LastBook) =>
              item.currentPosition > 10 &&
              item.currentPosition < item.audiobook.durationSeconds * 0.97
            );
            if (inProgress.length > 0) {
              setLastBook(inProgress[0]);
              setShowBanner(true);
            }
          }
        })
        .catch(() => {});
    }
  }, []);

  const toggleFavorite = useCallback(async (e: React.MouseEvent, bookId: string) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) { toast('Autentifică-te pentru a folosi această funcție.', 'error'); return; }

    const wasFav = favorites.has(bookId);
    setFavorites(prev => {
      const s = new Set(prev);
      wasFav ? s.delete(bookId) : s.add(bookId);
      return s;
    });

    try {
      const res = await fetch(
        wasFav ? `${API_URL}/api/favorites/${bookId}` : `${API_URL}/api/favorites`,
        {
          method:  wasFav ? 'DELETE' : 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body:    !wasFav ? JSON.stringify({ audiobookId: bookId }) : undefined,
        }
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      toast(wasFav ? 'Eliminat din favorite.' : 'Adăugat la favorite!', wasFav ? 'info' : 'success');
    } catch {
      setFavorites(prev => {
        const s = new Set(prev);
        wasFav ? s.add(bookId) : s.delete(bookId);
        return s;
      });
      toast('Eroare la actualizarea favoritelor.', 'error');
    }
  }, [favorites]);

  const addToListenLater = useCallback(async (e: React.MouseEvent, bookId: string) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) { toast('Autentifică-te pentru a folosi această funcție.', 'error'); return; }
    try {
      const res  = await fetch(`${API_URL}/api/listen-later`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ audiobookId: bookId }),
      });
      const data = await res.json();
      if (data.success) toast('Adăugat la lista de ascultare!');
      else toast(data.message || 'Eroare.', 'error');
    } catch { toast('Eroare de conexiune.', 'error'); }
  }, []);

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(initialBooks.map(b => b.category.name)))],
    [initialBooks],
  );

  const filteredBooks = useMemo(() => {
    let books = initialBooks.filter(book => {
      const q = deferredSearch.toLowerCase();
      const matchesSearch =
        !q ||
        book.title.toLowerCase().includes(q) ||
        book.author.name.toLowerCase().includes(q);
      const matchesCategory =
        selectedCategory === 'All' || book.category.name === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    if (sortMode === 'title')    books = [...books].sort((a, b) => a.title.localeCompare(b.title));
    if (sortMode === 'author')   books = [...books].sort((a, b) => a.author.name.localeCompare(b.author.name));
    if (sortMode === 'duration') books = [...books].sort((a, b) => a.durationSeconds - b.durationSeconds);

    return books;
  }, [initialBooks, deferredSearch, selectedCategory, sortMode]);

  const gridKey = `${selectedCategory}-${sortMode}-${deferredSearch}`;

  const sortButtons: { mode: SortMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'default',  label: 'Default', icon: <RotateCcw className="size-3" /> },
    { mode: 'title',    label: 'A–Z',     icon: <ArrowUpAZ  className="size-3" /> },
    { mode: 'author',   label: 'Autor',   icon: <User       className="size-3" /> },
    { mode: 'duration', label: 'Durată',  icon: <Clock3     className="size-3" /> },
  ];

  return (
    <div className="p-6 lg:p-8">

      {/* ── Continue Listening banner ────────────────────────────────────── */}
      <AnimatePresence>
        {showBanner && lastBook && (
          <motion.div
            key="banner"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{   opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="mb-6 p-4 rounded-2xl border border-primary/20 bg-primary/5 flex items-center gap-4"
          >
            <div className="relative w-10 h-14 rounded-lg overflow-hidden shrink-0 ring-1 ring-border/60">
              <Image src={lastBook.audiobook.coverImageUrl} alt={lastBook.audiobook.title} fill sizes="40px" className="object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-primary uppercase tracking-widest mb-0.5">Continuă ascultarea</p>
              <p className="text-sm font-semibold text-foreground truncate">{lastBook.audiobook.title}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="h-1 bg-muted rounded-full overflow-hidden w-24">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-[var(--gold)]"
                    style={{ width: `${Math.min(100, (lastBook.currentPosition / lastBook.audiobook.durationSeconds) * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {Math.round((lastBook.currentPosition / lastBook.audiobook.durationSeconds) * 100)}%
                </span>
              </div>
            </div>
            <Link
              href={`/audiobook/${lastBook.audiobook.id}?t=${lastBook.currentPosition}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all hover:-translate-y-0.5 shrink-0 shadow-sm shadow-primary/20"
            >
              <Play className="size-3 fill-current" aria-hidden="true" />
              Reia
            </Link>
            <button
              onClick={() => { setShowBanner(false); sessionStorage.setItem('bannerDismissed', '1'); }}
              aria-label="Închide bannerul"
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Page header + controls ──────────────────────────────────────────── */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="text-3xl font-bold text-foreground leading-tight tracking-tight"
            style={{ fontFamily: 'var(--font-fraunces)' }}
          >
            Librărie
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5" aria-live="polite" aria-atomic="true">
            {filteredBooks.length} {filteredBooks.length === 1 ? 'carte' : 'cărți'}
            {search !== deferredSearch && ' …'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Sort */}
          <div role="group" aria-label="Sortare cărți" className="flex items-center gap-0.5 rounded-xl border border-border/70 p-0.5 bg-card">
            {sortButtons.map(({ mode, label, icon }) => (
              <button
                key={mode}
                onClick={() => setSortMode(mode)}
                aria-pressed={sortMode === mode}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  sortMode === mode
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                {icon}
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div role="group" aria-label="Mod vizualizare" className="flex items-center rounded-xl border border-border/70 p-0.5 bg-card">
            <button
              onClick={() => setViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
              aria-label="Vizualizare grilă"
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'}`}
            >
              <LayoutGrid className="size-3.5" aria-hidden="true" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              aria-pressed={viewMode === 'list'}
              aria-label="Vizualizare listă"
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'}`}
            >
              <List className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Category pills ─────────────────────────────────────────────────── */}
      <div role="group" aria-label="Filtrare după categorie" className="flex flex-wrap gap-2 mb-8">
        {categories.map(cat => (
          <button
            key={cat}
            aria-pressed={selectedCategory === cat}
            onClick={() => setSelectedCategory(cat)}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border select-none ${
              selectedCategory === cat
                ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20 -translate-y-px'
                : 'text-muted-foreground border-border/60 hover:border-primary/40 hover:text-foreground bg-card'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── Book grid / list ───────────────────────────────────────────────── */}
      {filteredBooks.length > 0 ? (
        viewMode === 'grid' ? (
          <motion.div
            key={gridKey}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5"
            variants={gridContainer}
            initial="hidden"
            animate="visible"
          >
            {filteredBooks.map(book => (
              <motion.div key={book.id} variants={gridItem}>
                <BookCard
                  id={book.id}
                  title={book.title}
                  coverImageUrl={book.coverImageUrl}
                  author={book.author.name}
                  category={book.category.name}
                  durationSeconds={book.durationSeconds}
                  isFavorite={favorites.has(book.id)}
                  onFavoriteToggle={e => toggleFavorite(e, book.id)}
                  onListenLater={e => addToListenLater(e, book.id)}
                  onPlay={e => { e.preventDefault(); playBook(book.id); }}
                  createdAt={book.createdAt}
                />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key={gridKey}
            className="flex flex-col gap-2"
            variants={gridContainer}
            initial="hidden"
            animate="visible"
          >
            {filteredBooks.map(book => (
              <motion.div key={book.id} variants={gridItem}>
                <BookListRow
                  id={book.id}
                  title={book.title}
                  coverImageUrl={book.coverImageUrl}
                  author={book.author.name}
                  category={book.category.name}
                  durationSeconds={book.durationSeconds}
                  isFavorite={favorites.has(book.id)}
                  onFavoriteToggle={e => toggleFavorite(e, book.id)}
                  onListenLater={e => addToListenLater(e, book.id)}
                />
              </motion.div>
            ))}
          </motion.div>
        )
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-28 text-center border-2 border-dashed border-border/40 rounded-3xl"
        >
          <p className="text-4xl mb-4 opacity-30">📚</p>
          <p className="font-semibold text-foreground">Nicio carte găsită</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Încearcă o altă căutare sau categorie</p>
        </motion.div>
      )}

    </div>
  );
}
