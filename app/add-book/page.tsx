'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import { toast } from '../../components/Toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { API_URL } from '@/lib/api';
import { Separator } from '@/components/ui/separator';

export default function AddBookPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const progressRef = useRef<NodeJS.Timeout | null>(null);
  const [formData, setFormData] = useState({
    title: '', authorName: '', categoryName: '', description: '',
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (!token) { router.push('/login'); return; }
    let parsed: { role?: string } = {};
    try { parsed = user ? JSON.parse(user) : {}; } catch { parsed = {}; }
    if (parsed.role !== 'ADMIN') router.push('/');
  }, [router]);

  // Clean up interval on unmount
  useEffect(() => () => { if (progressRef.current) clearInterval(progressRef.current); }, []);

  const update = (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFormData(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coverFile || !audioFile) {
      toast('Selectează ambele fișiere (poză și audio).', 'error');
      return;
    }

    setIsLoading(true);
    setUploadProgress(0);

    // Simulate progress: 0 → 90% over ~45 s (large MP3s take time on Cloudinary free tier)
    progressRef.current = setInterval(() => {
      setUploadProgress(p => {
        if (p >= 90) { clearInterval(progressRef.current!); return 90; }
        return p + 1;
      });
    }, 500);

    const token = localStorage.getItem('token');
    const body = new FormData();
    Object.entries(formData).forEach(([k, v]) => body.append(k, v));
    body.append('coverImage', coverFile);
    body.append('audioFile', audioFile);

    try {
      const res = await fetch(`${API_URL}/api/audiobooks`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body,
      });
      const data = await res.json();

      if (data.success) {
        clearInterval(progressRef.current!);
        setUploadProgress(100);
        toast('Cartea a fost publicată cu succes!');
        setTimeout(() => router.push('/'), 1500);
      } else {
        toast(data.message || 'Eroare la publicare.', 'error');
      }
    } catch {
      toast('Eroare la conexiunea cu serverul.', 'error');
    } finally {
      clearInterval(progressRef.current!);
      setIsLoading(false);
      // Don't reset progress if success (let the 100% show briefly before redirect)
      if (uploadProgress < 100) setUploadProgress(0);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Adaugă Audiobook</h1>
        <p className="text-muted-foreground mt-1">Publică o carte nouă în librărie</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalii carte</CardTitle>
            <CardDescription>Informațiile de bază care apar în librărie</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Titlul Cărții</Label>
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
          <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
            {isLoading ? 'Se procesează...' : <><Upload className="size-4 mr-2" /> Publică Audiobook-ul</>}
          </Button>

          {isLoading && (
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
    </div>
  );
}
