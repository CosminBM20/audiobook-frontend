'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Upload, Trash2, BookOpen, Layers, Clock, AlertTriangle } from 'lucide-react';
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

interface Book {
  id: string;
  title: string;
  coverImageUrl: string;
  durationSeconds: number;
  author: { name: string };
  category: { name: string };
}

function formatDuration(s: number) {
  if (!s) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'library' | 'add'>('library');

  // ── Library state ──────────────────────────────────────────────────────────
  const [books, setBooks] = useState<Book[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // ── Add-book form state ────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const progressRef = useRef<NodeJS.Timeout | null>(null);
  const [formData, setFormData] = useState({
    title: '', authorName: '', categoryName: '', description: '',
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);

  // ── Guard: admin only ──────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('token');
    const user  = localStorage.getItem('user');
    if (!token) { router.push('/login'); return; }
    if (!user || JSON.parse(user).role !== 'ADMIN') { router.push('/'); return; }
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

  const update = (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFormData(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coverFile || !audioFile) {
      toast('Selectează ambele fișiere (poză și audio).', 'error');
      return;
    }
    setIsSubmitting(true);
    setUploadProgress(0);

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
    body.append('audioFile', audioFile);

    try {
      const res  = await fetch(`${API_URL}/api/audiobooks`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body,
      });
      const data = await res.json();

      if (data.success) {
        clearInterval(progressRef.current!);
        setUploadProgress(100);
        toast('Cartea a fost publicată cu succes!');
        // Reset form
        setFormData({ title: '', authorName: '', categoryName: '', description: '' });
        setCoverFile(null);
        setAudioFile(null);
        // Refresh library and switch to it
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
        <h1 className="text-2xl font-bold text-foreground">Panou Admin</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Gestionează biblioteca de audiobook-uri</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: BookOpen, label: 'Cărți', value: books.length,      color: 'text-violet-500' },
          { icon: Layers,   label: 'Categorii', value: categories.length, color: 'text-blue-500'   },
          { icon: Clock,    label: 'Ore totale', value: (() => {
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
        {(['library', 'add'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'library' ? 'Bibliotecă' : 'Adaugă carte'}
          </button>
        ))}
      </div>

      {/* ── LIBRARY TAB ─────────────────────────────────────────────────────── */}
      {tab === 'library' && (
        <div className="space-y-3">
          {loadingBooks ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))
          ) : books.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <BookOpen className="size-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Nu există cărți în bibliotecă.</p>
                <Button variant="outline" size="sm" onClick={() => setTab('add')}>
                  Adaugă prima carte
                </Button>
              </CardContent>
            </Card>
          ) : (
            books.map(book => (
              <Card key={book.id} className="overflow-hidden">
                <CardContent className="p-3 flex items-center gap-4">
                  {/* Cover */}
                  <div className="relative w-12 h-16 rounded-lg overflow-hidden shrink-0 border border-border">
                    <Image
                      src={book.coverImageUrl}
                      alt={book.title}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
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

                  {/* Delete controls */}
                  {confirmDelete === book.id ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground hidden sm:block">Ești sigur?</span>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={deleting === book.id}
                        onClick={() => handleDelete(book.id)}
                        className="h-8 px-3 text-xs"
                      >
                        {deleting === book.id ? '...' : 'Da, șterge'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmDelete(null)}
                        className="h-8 px-3 text-xs"
                      >
                        Anulează
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmDelete(book.id)}
                      className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ── ADD BOOK TAB ─────────────────────────────────────────────────────── */}
      {tab === 'add' && (
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Upload notice */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/60 border border-border text-sm text-muted-foreground">
            <AlertTriangle className="size-4 mt-0.5 shrink-0 text-amber-500" />
            <p>Fișierele audio mari pot dura 1–3 minute la upload (Cloudinary free tier). Pagina rămâne activă.</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalii carte</CardTitle>
              <CardDescription>Informațiile de bază care apar în librărie</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Titlul cărții</Label>
                  <Input id="title" required value={formData.title} onChange={update('title')} placeholder="ex: Atomic Habits" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="author">Autor</Label>
                  <Input id="author" required value={formData.authorName} onChange={update('authorName')} placeholder="ex: James Clear" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categorie</Label>
                <Input id="category" required value={formData.categoryName} onChange={update('categoryName')} placeholder="ex: Dezvoltare Personală" />
              </div>
              <p className="text-xs text-muted-foreground">
                ⏱ Durata este detectată automat din fișierul audio.
              </p>
              <div className="space-y-2">
                <Label htmlFor="description">Descriere</Label>
                <Textarea
                  id="description"
                  rows={3}
                  required
                  value={formData.description}
                  onChange={update('description')}
                  placeholder="O scurtă descriere a cărții..."
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fișiere media</CardTitle>
              <CardDescription>Coperta și fișierul audio sunt stocate pe Cloudinary</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cover">Copertă (.jpg / .png / .webp)</Label>
                <input
                  id="cover"
                  type="file"
                  accept="image/*"
                  required
                  onChange={e => setCoverFile(e.target.files?.[0] || null)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="audio">Fișier audio (.mp3 / .wav)</Label>
                <input
                  id="audio"
                  type="file"
                  accept="audio/*"
                  required
                  onChange={e => setAudioFile(e.target.files?.[0] || null)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting
                ? 'Se procesează...'
                : <><Upload className="size-4 mr-2" />Publică Audiobook-ul</>
              }
            </Button>

            {isSubmitting && (
              <div className="space-y-1.5">
                <Progress value={uploadProgress} className="h-1.5" />
                <p className="text-xs text-muted-foreground text-center">
                  {uploadProgress < 90
                    ? `Se încarcă pe Cloudinary… ${uploadProgress}%`
                    : uploadProgress < 100
                      ? 'Se finalizează…'
                      : 'Publicat cu succes!'}
                </p>
              </div>
            )}
          </div>

        </form>
      )}

    </div>
  );
}
