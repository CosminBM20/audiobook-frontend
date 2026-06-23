'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Upload, Trash2, BookOpen, Layers, Clock, AlertTriangle, Plus, GripVertical, X, Pencil, ArrowLeft } from 'lucide-react';
import { toast } from '../../components/Toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { BOOK_CATEGORIES, displayCategory } from '@/lib/categories';

interface Book {
  id: string;
  title: string;
  description: string;
  coverImageUrl: string;
  durationSeconds: number;
  author: { name: string };
  category: { name: string };
}

interface ChapterInput {
  uid: string;
  title: string;
  file: File | null;
}

function formatDuration(s: number) {
  if (!s) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

interface CategorySelectProps {
  id: string;
  value: string;
  lang: import('@/contexts/LanguageContext').Lang;
  onChange: (v: string) => void;
  required?: boolean;
}

function CategorySelect({ id, value, lang, onChange, required }: CategorySelectProps) {
  return (
    <select
      id={id}
      required={required}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
    >
      <option value="" disabled>{lang === 'en' ? 'Select category…' : 'Selectează categoria…'}</option>
      {BOOK_CATEGORIES.map(c => (
        <option key={c.ro} value={c.ro}>
          {displayCategory(c.ro, lang)}
        </option>
      ))}
    </select>
  );
}

export default function AdminPage() {
  const router        = useRouter();
  const { t, lang }   = useLanguage();
  const [tab, setTab] = useState<'library' | 'add'>('library');

  // ── Library state ──────────────────────────────────────────────────────────
  const [books, setBooks] = useState<Book[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // ── Edit state ─────────────────────────────────────────────────────────────
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [editForm, setEditForm] = useState({ title: '', authorName: '', categoryName: '', description: '', language: 'ro' });
  const [editCover, setEditCover] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ── Add-book form state ────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const progressRef = useRef<NodeJS.Timeout | null>(null);
  const [formData, setFormData] = useState({
    title: '', authorName: '', categoryName: '', description: '', language: 'ro',
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [chapters, setChapters] = useState<ChapterInput[]>(() => [
    { uid: crypto.randomUUID(), title: `${t('chapterWord')} 1`, file: null },
  ]);

  // ── Guard: admin only ──────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('token');
    const user  = localStorage.getItem('user');
    if (!token || !user) { router.push('/login'); return; }
    let parsed: { role?: string } | null = null;
    try { parsed = JSON.parse(user); } catch { parsed = null; }
    if (!parsed || parsed.role !== 'ADMIN') { router.push('/'); return; }
    fetchBooks(token);
  }, [router]);

  useEffect(() => () => { if (progressRef.current) clearInterval(progressRef.current); }, []);

  const fetchBooks = async (token: string) => {
    setLoadingBooks(true);
    try {
      const res  = await fetch(`${API_URL}/api/audiobooks`);
      const data = await res.json();
      if (data.success) setBooks(data.data);
    } catch {
      toast('Eroare la încărcarea cărților.', 'error');
    } finally {
      setLoadingBooks(false);
    }
  };

  const handleDelete = async (bookId: string) => {
    setDeleting(bookId);
    const token = localStorage.getItem('token');
    try {
      const res  = await fetch(`${API_URL}/api/audiobooks/${bookId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setBooks(prev => prev.filter(b => b.id !== bookId));
        toast('Cartea a fost ștearsă.');
      } else {
        toast(data.message || 'Eroare la ștergere.', 'error');
      }
    } catch {
      toast('Eroare de conexiune.', 'error');
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  };

  const openEdit = (book: Book) => {
    setEditingBook(book);
    setEditForm({
      title:        book.title,
      authorName:   book.author.name,
      categoryName: book.category.name,
      description:  book.description ?? '',
      language:     (book as Book & { language?: string }).language ?? 'ro',
    });
    setEditCover(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBook) return;
    setIsSaving(true);

    const token = localStorage.getItem('token');
    const body  = new FormData();
    Object.entries(editForm).forEach(([k, v]) => body.append(k, v));
    if (editCover) body.append('coverImage', editCover);

    try {
      const res  = await fetch(`${API_URL}/api/audiobooks/${editingBook.id}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
        body,
      });
      const data = await res.json();
      if (data.success) {
        toast('Cartea a fost actualizată!');
        setBooks(prev => prev.map(b =>
          b.id === editingBook.id
            ? { ...b, ...data.data, description: data.data.description ?? b.description }
            : b
        ));
        setEditingBook(null);
      } else {
        toast(data.message || 'Eroare la actualizare.', 'error');
      }
    } catch {
      toast('Eroare de conexiune.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const updateEdit = (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setEditForm(prev => ({ ...prev, [field]: e.target.value }));

  const update = (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFormData(prev => ({ ...prev, [field]: e.target.value }));

  const addChapter = () =>
    setChapters(prev => [
      ...prev,
      { uid: crypto.randomUUID(), title: `${t('chapterWord')} ${prev.length + 1}`, file: null },
    ]);

  const removeChapter = (uid: string) =>
    setChapters(prev => prev.filter(c => c.uid !== uid));

  const updateChapter = (uid: string, patch: Partial<Omit<ChapterInput, 'uid'>>) =>
    setChapters(prev => prev.map(c => c.uid === uid ? { ...c, ...patch } : c));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coverFile) {
      toast('Selectează o copertă.', 'error');
      return;
    }
    const missingFile = chapters.find(c => !c.file);
    if (missingFile) {
      toast('Fiecare capitol trebuie să aibă un fișier audio.', 'error');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    // ~500 ms per 1% → 90% ceiling over ~45 s for large batches
    progressRef.current = setInterval(() => {
      setUploadProgress(p => {
        if (p >= 90) { clearInterval(progressRef.current!); return 90; }
        return p + 1;
      });
    }, 500);

    const token = localStorage.getItem('token');
    const body  = new FormData();
    Object.entries(formData).forEach(([k, v]) => body.append(k, v));
    body.append('coverImage', coverFile);
    body.append('chaptersData', JSON.stringify(chapters.map(c => ({ title: c.title }))));
    chapters.forEach(c => body.append('audioFiles', c.file!));

    try {
      const res  = await fetch(`${API_URL}/api/audiobooks/multi`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body,
      });
      const data = await res.json();

      if (data.success) {
        clearInterval(progressRef.current!);
        setUploadProgress(100);
        toast('Cartea a fost publicată cu succes!');
        setFormData({ title: '', authorName: '', categoryName: '', description: '', language: 'ro' });
        setCoverFile(null);
        setChapters([{ uid: crypto.randomUUID(), title: `${t('chapterWord')} 1`, file: null }]);
        fetchBooks(token || '');
        setTimeout(() => { setTab('library'); setUploadProgress(0); }, 1200);
      } else {
        toast(data.message || 'Eroare la publicare.', 'error');
      }
    } catch {
      toast('Eroare la conexiunea cu serverul.', 'error');
    } finally {
      clearInterval(progressRef.current!);
      setIsSubmitting(false);
    }
  };

  const categories = Array.from(new Set(books.map(b => b.category.name)));

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('adminPanel')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('adminSubtitle')}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: BookOpen, label: t('statsBooks'),      value: books.length,      color: 'text-violet-500' },
          { icon: Layers,   label: t('statsCategories'), value: categories.length, color: 'text-blue-500'   },
          { icon: Clock,    label: t('statsTotalHours'), value: (() => {
              const s = books.reduce((a, b) => a + b.durationSeconds, 0);
              const h = Math.floor(s / 3600);
              return `${h}h`;
            })(), color: 'text-green-500' },
        ].map(({ icon: Icon, label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`size-5 ${color} shrink-0`} />
              <div>
                <p className="text-xl font-bold text-foreground leading-none">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        {(['library', 'add'] as const).map(tabKey => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === tabKey
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tabKey === 'library' ? t('adminLibraryTab') : t('addBook')}
          </button>
        ))}
      </div>

      {/* ── LIBRARY TAB ─────────────────────────────────────────────────────── */}
      {tab === 'library' && (
        <>
          {/* ── Edit form ── */}
          {editingBook ? (
            <form onSubmit={handleEditSubmit} className="space-y-5">
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingBook(null)}
                  className="gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="size-4" /> {t('back')}
                </Button>
                <h2 className="text-sm font-semibold text-foreground">{t('editBookTitle')}: {editingBook.title}</h2>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('bookDetails')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-title">{t('bookTitle')}</Label>
                      <Input id="edit-title" required value={editForm.title} onChange={updateEdit('title')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-author">{t('author')}</Label>
                      <Input id="edit-author" required value={editForm.authorName} onChange={updateEdit('authorName')} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-category">{t('category')}</Label>
                      <CategorySelect
                        id="edit-category"
                        value={editForm.categoryName}
                        lang={lang}
                        onChange={v => setEditForm(prev => ({ ...prev, categoryName: v }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-language">{t('bookLanguage')}</Label>
                      <select
                        id="edit-language"
                        value={editForm.language}
                        onChange={e => setEditForm(prev => ({ ...prev, language: e.target.value }))}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="ro">{t('romanian')}</option>
                        <option value="en">{t('english')}</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-description">{t('description')}</Label>
                    <Textarea id="edit-description" rows={3} value={editForm.description} onChange={updateEdit('description')} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('cover')}</CardTitle>
                  <CardDescription>{t('keepCurrentCover')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {editingBook.coverImageUrl && (
                    <div className="relative w-16 h-24 rounded-lg overflow-hidden border border-border">
                      <Image src={editingBook.coverImageUrl} alt={editingBook.title} fill sizes="64px" className="object-cover" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => setEditCover(e.target.files?.[0] || null)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button type="submit" disabled={isSaving} className="flex-1">
                  {isSaving ? t('saving') : t('saveChanges')}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditingBook(null)}>
                  {t('cancel')}
                </Button>
              </div>
            </form>
          ) : (
            /* ── Book list ── */
            <div className="space-y-3">
              {loadingBooks ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))
              ) : books.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                    <BookOpen className="size-10 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">{t('noBooksInLibrary')}</p>
                    <Button variant="outline" size="sm" onClick={() => setTab('add')}>
                      {t('addFirstBook')}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                books.map(book => (
                  <Card key={book.id} className="overflow-hidden">
                    <CardContent className="p-3 flex items-center gap-4">
                      {/* Cover */}
                      <div className="relative w-12 h-16 rounded-lg overflow-hidden shrink-0 border border-border">
                        <Image src={book.coverImageUrl} alt={book.title} fill sizes="48px" className="object-cover" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="font-semibold text-sm text-foreground truncate">{book.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{book.author.name}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {book.category.name}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground/60">
                            {formatDuration(book.durationSeconds)}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      {confirmDelete === book.id ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground hidden sm:block">{t('areYouSure')}</span>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={deleting === book.id}
                            onClick={() => handleDelete(book.id)}
                            className="h-8 px-3 text-xs"
                          >
                            {deleting === book.id ? '...' : t('confirmDelete')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setConfirmDelete(null)}
                            className="h-8 px-3 text-xs"
                          >
                            {t('cancel')}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEdit(book)}
                            className="text-muted-foreground hover:text-primary hover:bg-primary/10"
                            aria-label="Editează"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmDelete(book.id)}
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            aria-label="Șterge"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* ── ADD BOOK TAB ─────────────────────────────────────────────────────── */}
      {tab === 'add' && (
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Upload notice */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/60 border border-border text-sm text-muted-foreground">
            <AlertTriangle className="size-4 mt-0.5 shrink-0 text-amber-500" />
            <p>{t('uploadNotice')}</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('bookDetails')}</CardTitle>
              <CardDescription>{t('bookDetailsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">{t('bookTitle')}</Label>
                  <Input id="title" required value={formData.title} onChange={update('title')} placeholder="ex: Atomic Habits" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="author">{t('author')}</Label>
                  <Input id="author" required value={formData.authorName} onChange={update('authorName')} placeholder="ex: James Clear" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">{t('category')}</Label>
                  <CategorySelect
                    id="category"
                    value={formData.categoryName}
                    lang={lang}
                    onChange={v => setFormData(prev => ({ ...prev, categoryName: v }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">{t('bookLanguage')}</Label>
                  <select
                    id="language"
                    value={formData.language}
                    onChange={e => setFormData(prev => ({ ...prev, language: e.target.value }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="ro">{t('romanian')}</option>
                    <option value="en">{t('english')}</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t('durationAuto')}</p>
              <div className="space-y-2">
                <Label htmlFor="description">{t('description')}</Label>
                <Textarea
                  id="description"
                  rows={3}
                  required
                  value={formData.description}
                  onChange={update('description')}
                  placeholder={t('descPlaceholder')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Cover */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('cover')}</CardTitle>
              <CardDescription>{t('coverDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="cover">{t('coverLabel')}</Label>
                <input
                  id="cover"
                  type="file"
                  accept="image/*"
                  required
                  onChange={e => setCoverFile(e.target.files?.[0] || null)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </CardContent>
          </Card>

          {/* Chapters */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{t('audioChapters')}</CardTitle>
                  <CardDescription className="mt-0.5">{t('chaptersDesc')}</CardDescription>
                </div>
                <Badge variant="secondary">
                  {chapters.length} {chapters.length === 1 ? t('chapterSingular') : t('chapterPlural')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {chapters.map((ch, idx) => (
                <div key={ch.uid} className="flex gap-2 items-start p-3 rounded-lg border border-border bg-muted/30">
                  <GripVertical className="size-4 text-muted-foreground/40 mt-2.5 shrink-0" />

                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground w-5 shrink-0">{idx + 1}.</span>
                      <Input
                        value={ch.title}
                        onChange={e => updateChapter(ch.uid, { title: e.target.value })}
                        placeholder={`${t('chapterWord')} ${idx + 1}`}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2 pl-7">
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={e => updateChapter(ch.uid, { file: e.target.files?.[0] || null })}
                        className="flex-1 h-8 rounded-md border border-input bg-background px-2 py-1 text-xs cursor-pointer file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      {ch.file && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-24 shrink-0">
                          {(ch.file.size / 1024 / 1024).toFixed(1)} MB
                        </span>
                      )}
                    </div>
                  </div>

                  {chapters.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeChapter(ch.uid)}
                      className="mt-2 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              ))}

              <Button type="button" variant="outline" size="sm" onClick={addChapter} className="w-full mt-1">
                <Plus className="size-3.5 mr-1.5" />
                {t('addChapter')}
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting
                ? t('processing')
                : <><Upload className="size-4 mr-2" />{t('publish')}</>
              }
            </Button>

            {isSubmitting && (
              <div className="space-y-1.5">
                <Progress value={uploadProgress} className="h-1.5" />
                <p className="text-xs text-muted-foreground text-center">
                  {uploadProgress < 90
                    ? `${t('uploadingCloud')} ${uploadProgress}%`
                    : uploadProgress < 100
                      ? t('finalizing')
                      : t('publishedSuccess')}
                </p>
              </div>
            )}
          </div>

        </form>
      )}

    </div>
  );
}
