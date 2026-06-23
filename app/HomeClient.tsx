'use client';

import { useState, useMemo, useEffect, useCallback, useDeferredValue } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { toast } from '../components/Toast';
import { BookCard } from '../components/BookCard';
import { BookListRow } from '../components/BookListRow';
import { useSearch } from '../components/SearchContext';
import { usePlayerControls } from '../contexts/PlayerContext';
import { useLanguage } from '../contexts/LanguageContext';
import { toCanonical, displayCategory } from '@/lib/categories';
import { API_URL } from '@/lib/api';
import { LayoutGrid, List, ArrowUpAZ, Clock3, RotateCcw, User, Play, X, Heart, FileText } from 'lucide-react';
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

// Delegate typo-correction to the canonical categories table
const fixCategory = toCanonical;

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
  const { playBook, playPdf }  = usePlayerControls();
  const { t, lang }   = useLanguage();
  const deferredSearch = useDeferredValue(search);

  const [selectedCategory,  setSelectedCategory]  = useState('All');
  const [selectedLanguage,  setSelectedLanguage]  = useState<'all' | 'ro' | 'en'>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortMode,         setSortMode]         = useState<SortMode>('default');
  const [viewMode,         setViewMode]         = useState<ViewMode>('grid');
  const [favorites,        setFavorites]        = useState<Set<string>>(new Set());
  const [lastBook,         setLastBook]         = useState<LastBook | null>(null);
  const [showBanner,       setShowBanner]       = useState(false);
  const [books,            setBooks]            = useState<Audiobook[]>(initialBooks);
  const [booksLoading,     setBooksLoading]     = useState(initialBooks.length === 0);
  const [personalDocs,     setPersonalDocs]     = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    fetch(`${API_URL}/api/favorites`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.success) setFavorites(new Set(d.data)); })
      .catch(() => {});

    fetch(`${API_URL}/api/personal-books`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.success) setPersonalDocs(d.data); })
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

  // Fallback: if the server component returned an empty list (backend cold-start
  // or stale router cache), fetch books client-side on first render.
  useEffect(() => {
    if (initialBooks.length > 0) { setBooksLoading(false); return; }
    fetch(`${API_URL}/api/audiobooks`)
      .then(r => r.json())
      .then(d => { if (d.success) setBooks(d.data); })
      .catch(() => {})
      .finally(() => setBooksLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleFavorite = useCallback(async (e: React.MouseEvent, bookId: string) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) { toast(t('errAuthRequired'), 'error'); return; }

    const wasFav = favorites.has(bookId);

    // Optimistic update
    setFavorites(prev => {
      const s = new Set(prev);
      wasFav ? s.delete(bookId) : s.add(bookId);
      return s;
    });

    try {
      const res = await fetch(`${API_URL}/api/favorites/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ audiobookId: bookId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      toast(wasFav ? t('removedFromFav') : t('addedToFav'), wasFav ? 'info' : 'success');
    } catch {
      // Revert on failure
      setFavorites(prev => {
        const s = new Set(prev);
        wasFav ? s.add(bookId) : s.delete(bookId);
        return s;
      });
      toast(t('errFavoriteUpdate'), 'error');
    }
  }, [favorites]);

  const addToListenLater = useCallback(async (e: React.MouseEvent, bookId: string) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) { toast(t('errAuthRequired'), 'error'); return; }
    try {
      const res  = await fetch(`${API_URL}/api/listen-later`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ audiobookId: bookId }),
      });
      const data = await res.json();
      if (data.success) toast(t('addedToLater'));
      else toast(data.message || t('errGeneric'), 'error');
    } catch { toast(t('errConnection'), 'error'); }
  }, []);

  // Apply diacritic corrections before computing unique categories
  const normalizedBooks = useMemo(
    () => books.map(b => ({
      ...b,
      author: b.author ?? { name: 'Unknown' },
      category: { ...b.category, name: fixCategory(b.category.name) },
    })),
    [books],
  );

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(normalizedBooks.map(b => b.category.name)))],
    [normalizedBooks],
  );

  const filteredBooks = useMemo(() => {
    let list = normalizedBooks.filter(book => {
      const q = deferredSearch.toLowerCase();
      const matchesSearch =
        !q ||
        book.title.toLowerCase().includes(q) ||
        book.author.name.toLowerCase().includes(q);
      const matchesCategory =
        selectedCategory === 'All' || book.category.name === selectedCategory;
      // Strict match: books without a language field are treated as 'ro'.
      // When 'en' is selected, only books explicitly marked 'en' pass through.
      const bookLang = book.language ?? 'ro';
      const matchesLanguage  = selectedLanguage === 'all' || bookLang === selectedLanguage;
      const matchesFavorites = !showFavoritesOnly || favorites.has(book.id);
      return matchesSearch && matchesCategory && matchesLanguage && matchesFavorites;
    });

    if (sortMode === 'title')    list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    if (sortMode === 'author')   list = [...list].sort((a, b) => a.author.name.localeCompare(b.author.name));
    if (sortMode === 'duration') list = [...list].sort((a, b) => a.durationSeconds - b.durationSeconds);

    return list;
  }, [normalizedBooks, deferredSearch, selectedCategory, selectedLanguage, sortMode, showFavoritesOnly, favorites]);

  const gridKey = `${selectedCategory}-${selectedLanguage}-${sortMode}-${deferredSearch}-${showFavoritesOnly}`;

  const sortButtons: { mode: SortMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'default',  label: t('sortDefault'),  icon: <RotateCcw className="size-3" /> },
    { mode: 'title',    label: t('sortTitle'),    icon: <ArrowUpAZ  className="size-3" /> },
    { mode: 'author',   label: t('sortAuthor'),   icon: <User       className="size-3" /> },
    { mode: 'duration', label: t('sortDuration'), icon: <Clock3     className="size-3" /> },
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
              <p className="text-[10px] font-semibold text-primary uppercase tracking-widest mb-0.5">{t('continueListening')}</p>
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
              {t('resume')}
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
            {t('library')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5" aria-live="polite" aria-atomic="true">
            {booksLoading
              ? t('loading')
              : `${filteredBooks.length} ${filteredBooks.length === 1 ? t('book') : t('books')}`}
            {!booksLoading && search !== deferredSearch && ' …'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Favorites toggle */}
          <button
            onClick={() => setShowFavoritesOnly(p => !p)}
            aria-pressed={showFavoritesOnly}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
              showFavoritesOnly
                ? 'bg-red-500/10 border-red-500/30 text-red-500'
                : 'border-border/70 bg-card text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            <Heart
              className={`size-3 transition-colors ${showFavoritesOnly ? 'fill-red-500 text-red-500' : ''}`}
              strokeWidth={1.5}
            />
            {t('myFavorites')}
          </button>

          {/* Visual separator */}
          <div className="w-px h-5 bg-border/60 self-center hidden sm:block" aria-hidden="true" />

          {/* Language filter */}
          <div role="group" aria-label="Filtrare după limbă" className="flex items-center gap-0.5 rounded-xl border border-border/70 p-0.5 bg-card">
            {([
              { value: 'all', label: t('allLanguages') },
              { value: 'ro',  label: t('langRo') },
              { value: 'en',  label: t('langEn') },
            ] as const).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setSelectedLanguage(value)}
                aria-pressed={selectedLanguage === value}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedLanguage === value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Visual separator between filter groups */}
          <div className="w-px h-5 bg-border/60 self-center hidden sm:block" aria-hidden="true" />

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
            {cat === 'All' ? t('allCategories') : displayCategory(cat, lang)}
          </button>
        ))}
      </div>

      {/* ── Book grid / list ───────────────────────────────────────────────── */}
      {booksLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl overflow-hidden shadow-sm">
              <div className="aspect-[2/3] bg-muted animate-pulse" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-muted animate-pulse rounded-md" />
                <div className="h-2.5 bg-muted animate-pulse rounded-md w-2/3" />
                <div className="h-2 bg-muted animate-pulse rounded-md w-1/3 mt-1" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredBooks.length > 0 ? (
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
          <p className="font-semibold text-foreground">{t('noBooksFound')}</p>
          <p className="text-sm text-muted-foreground/60 mt-1">{t('tryAnotherSearch')}</p>
        </motion.div>
      )}

      {/* ── My Documents ── */}
      {personalDocs.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center gap-2.5 mb-5">
            <FileText className="size-4 text-muted-foreground" />
            <h2
              className="font-semibold text-foreground text-lg"
              style={{ fontFamily: 'var(--font-fraunces)' }}
            >
              {t('myDocuments')}
            </h2>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-mono">
              {personalDocs.length}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {personalDocs.map((doc: any) => {
              const pct = doc.progress?.totalChars > 0
                ? Math.min(100, Math.round((doc.progress.charOffset / doc.progress.totalChars) * 100))
                : 0;
              return (
                <button
                  key={doc.id}
                  onClick={() => playPdf(doc.id, doc.title)}
                  className="group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl"
                >
                  <article className="bg-card rounded-2xl overflow-hidden flex flex-col shadow-sm transition-all duration-300 hover:shadow-[0_8px_28px_oklch(0_0_0_/_0.18),_0_2px_8px_var(--glow-sage)] hover:-translate-y-0.5">
                    {/* Cover area */}
                    <div className="relative w-full aspect-[2/3] bg-primary/5 border-b border-border/40 flex flex-col items-center justify-center gap-2 overflow-hidden">
                      <div className="size-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center">
                        <FileText className="size-6 text-primary/60" />
                      </div>
                      <span className="text-[9px] font-bold text-primary/50 uppercase tracking-[0.2em]">PDF</span>
                      {/* Progress bar at bottom of cover */}
                      {pct > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-border/40">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary to-[var(--gold)]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                      {/* Play overlay on hover */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="size-10 rounded-full bg-primary flex items-center justify-center shadow-lg">
                          <Play className="size-4 text-primary-foreground fill-current ml-0.5" />
                        </div>
                      </div>
                    </div>
                    {/* Info */}
                    <div className="p-3 flex flex-col gap-0.5">
                      <p className="font-semibold text-foreground text-sm truncate leading-snug group-hover:text-primary transition-colors">
                        {doc.title}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {pct > 0 ? `${pct}% ${t('bookCompleted').toLowerCase()}` : t('noBookStarted')}
                      </p>
                    </div>
                  </article>
                </button>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
