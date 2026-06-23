'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Play, Pause, Volume2, Upload, Trash2,
  Sparkles, Loader2, FileText, Info, Zap, RotateCcw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from './Toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '../contexts/LanguageContext';
import { usePlayerControls, usePlayerTime } from '../contexts/PlayerContext';
import { API_URL } from '@/lib/api';
import { CHARS_PER_MIN, formatTtsTime } from '@/lib/ttsUtils';

interface PersonalBook {
  id: string;
  title: string;
  createdAt: string;
  contentLength: number;
  progress: {
    charOffset:  number;
    totalChars:  number;
    isCompleted: boolean;
    lastPlayedAt: string | null;
  } | null;
}

type AiMode = 'extractive' | 'neural';

export function PersonalDocumentsSection() {
  const { t, lang } = useLanguage();
  const {
    pdfTrack, ttsIsPlaying, ttsPaused,
    playPdf, pauseTts, resumeTts, stopTts, seekTts,
  } = usePlayerControls();
  const { ttsOffset, ttsTotalChars } = usePlayerTime();

  const [personalBooks, setPersonalBooks] = useState<PersonalBook[]>([]);
  const [uploading,     setUploading]     = useState(false);
  const [file,          setFile]          = useState<File | null>(null);
  const [docTitle,      setDocTitle]      = useState('');
  const [pdfSearch,     setPdfSearch]     = useState('');
  const [aiSummary,     setAiSummary]     = useState<Record<string, { text: string; mode: AiMode }>>({});
  const [aiStatus,      setAiStatus]      = useState<Record<string, { message: string; progress?: number }>>({});

  // Keep for the summarize feature (separate concern from TTS caching in PlayerContext)
  const pdfContentRef = useRef<Record<string, string>>({});

  const fetchPersonalBooks = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res  = await fetch(`${API_URL}/api/personal-books`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setPersonalBooks(data.data);
    } catch {
      toast(t('errLoadData'), 'error');
    }
  }, []);

  useEffect(() => { fetchPersonalBooks(); }, [fetchPersonalBooks]);

  useEffect(() => {
    return () => { /* TTS lifecycle managed by PlayerContext */ };
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { toast(t('errNoPdf'), 'error'); return; }
    setUploading(true);
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('title', docTitle);
    formData.append('pdfFile', file);
    try {
      const res  = await fetch(`${API_URL}/api/personal-books/upload`, {
        method : 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body   : formData,
      });
      const data = await res.json();
      if (data.success) {
        toast(t('pdfSaved'));
        setFile(null);
        setDocTitle('');
        fetchPersonalBooks();
      } else {
        toast(data.message || t('errUpload'), 'error');
      }
    } catch {
      toast(t('errConnection'), 'error');
    } finally {
      setUploading(false);
    }
  };

  const fetchContent = useCallback(async (bookId: string): Promise<string | null> => {
    if (pdfContentRef.current[bookId]) return pdfContentRef.current[bookId];
    const token = localStorage.getItem('token');
    try {
      const res  = await fetch(`${API_URL}/api/personal-books/${bookId}/content`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        pdfContentRef.current[bookId] = data.data.content;
        return data.data.content;
      }
    } catch {}
    return null;
  }, []);

  const handlePlayAudio = useCallback(async (bookId: string, bookTitle: string) => {
    if (pdfTrack?.id === bookId) {
      ttsIsPlaying ? pauseTts() : resumeTts();
      return;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(' '));
    await playPdf(bookId, bookTitle);
  }, [pdfTrack, ttsIsPlaying, pauseTts, resumeTts, playPdf]);

  const handleSeek = useCallback((bookId: string, offset: number) => {
    if (pdfTrack?.id === bookId) {
      seekTts(offset);
      return;
    }
    // Not currently playing — save starting position to API for next play
    const token = localStorage.getItem('token');
    if (token) {
      fetch(`${API_URL}/api/personal-books/${bookId}/progress`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify({ charOffset: offset }),
      }).catch(() => {});
    }
    // Update local display
    setPersonalBooks(prev => prev.map(b =>
      b.id === bookId
        ? { ...b, progress: { ...(b.progress ?? { totalChars: b.contentLength, isCompleted: false, lastPlayedAt: null }), charOffset: offset } }
        : b,
    ));
  }, [pdfTrack, seekTts]);

  const handleClearProgress = useCallback((bookId: string) => {
    if (pdfTrack?.id === bookId) stopTts();
    const token = localStorage.getItem('token');
    if (token) {
      fetch(`${API_URL}/api/personal-books/${bookId}/progress`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify({ charOffset: 0, isCompleted: false }),
      }).catch(() => {});
    }
    localStorage.removeItem(`tts-progress-${bookId}`);
    setPersonalBooks(prev => prev.map(b =>
      b.id === bookId ? { ...b, progress: null } : b,
    ));
  }, [pdfTrack, stopTts]);

  const handleDeletePdf = async (bookId: string) => {
    if (pdfTrack?.id === bookId) stopTts();
    const token = localStorage.getItem('token');
    try {
      const res  = await fetch(`${API_URL}/api/personal-books/${bookId}`, {
        method : 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setPersonalBooks(prev => prev.filter(b => b.id !== bookId));
        toast(t('docDeleted'));
      } else {
        toast(data.message || t('errDelete'), 'error');
      }
    } catch {
      toast(t('errConnection'), 'error');
    }
  };

  const handleSummarize = useCallback(async (bookId: string) => {
    if (aiStatus[bookId]) return;

    const text = await fetchContent(bookId);
    if (!text) { toast(t('errContentUnavail'), 'error'); return; }

    setAiStatus(prev => ({ ...prev, [bookId]: { message: t('aiInitializing') } }));

    const token = localStorage.getItem('token');
    try {
      const res  = await fetch(`${API_URL}/api/summarize`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify({ content: text }),
      });
      const data = await res.json();

      if (data.success) {
        setAiSummary(prev => ({ ...prev, [bookId]: { text: data.summary, mode: 'neural' } }));
      } else {
        toast(data.message || t('errSummaryGenerate'), 'error');
      }
    } catch {
      toast(t('errConnection'), 'error');
    } finally {
      setAiStatus(prev => { const s = { ...prev }; delete s[bookId]; return s; });
    }
  }, [aiStatus, fetchContent, t]);

  const estimateReadingTime = (contentLength: number) => {
    if (!contentLength) return '—';
    const words   = Math.round(contentLength / 5);
    const minutes = Math.ceil(words / (135 * 0.9));
    return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
  };

  const filteredPdfs = pdfSearch.trim()
    ? personalBooks.filter(b => b.title.toLowerCase().includes(pdfSearch.toLowerCase()))
    : personalBooks;

  return (
    <div className="space-y-5">

      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <FileText className="size-4 text-muted-foreground" />
          <h2
            className="font-semibold text-foreground"
            style={{ fontFamily: 'var(--font-fraunces)' }}
          >
            {t('myDocuments')}
          </h2>
          <Badge variant="secondary" className="text-xs rounded-full font-mono">
            {personalBooks.length}/50
          </Badge>
        </div>
        {personalBooks.length > 0 && (
          <div className="relative max-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder={t('searchDocs')}
              value={pdfSearch}
              onChange={e => setPdfSearch(e.target.value)}
              className="pl-9 h-8 text-xs rounded-xl border-border/70"
            />
          </div>
        )}
      </div>

      {/* How it works info box */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 flex gap-4">
        <div className="shrink-0 size-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center mt-0.5">
          <Info className="size-4 text-primary" />
        </div>
        <div className="space-y-2.5 min-w-0">
          <p className="font-semibold text-sm text-foreground">{t('howItWorksTitle')}</p>
          <div className="grid sm:grid-cols-2 gap-1.5 text-xs text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="text-base leading-none shrink-0">📄</span>
              <p>
                {t('how1a')} <strong className="text-foreground">{t('how1Bold')}</strong>{t('how1b')}
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-base leading-none shrink-0">🔊</span>
              <p>
                {t('how2a')} <strong className="text-foreground">{t('how2Bold')}</strong>{t('how2b')}
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-base leading-none shrink-0">⚡</span>
              <p>
                {t('how3Bold') && <strong className="text-foreground">{t('how3Bold')}</strong>}{t('how3b')}
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-base leading-none shrink-0">🤖</span>
              <p>
                {t('how4Bold') && <strong className="text-foreground">{t('how4Bold')}</strong>}{t('how4b')}
              </p>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground/60">⚠️ {t('howWarning')}</p>
        </div>
      </div>

      {/* Upload form */}
      <div className="bg-card rounded-2xl border border-border/60 p-5 shadow-sm space-y-4">
        <p className="text-sm font-semibold text-foreground">{t('uploadNewDoc')}</p>
        <form onSubmit={handleUpload} className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div className="space-y-1.5">
            <Label htmlFor="pdf-title" className="text-xs text-muted-foreground">
              {t('docTitleLabel')}
            </Label>
            <Input
              id="pdf-title"
              required
              value={docTitle}
              onChange={e => setDocTitle(e.target.value)}
              placeholder={t('docTitlePlaceholder')}
              className="h-9 rounded-xl border-border/70 focus-visible:ring-2 focus-visible:ring-primary/30"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pdf-file" className="text-xs text-muted-foreground">
              {t('pdfFileLabel')}
            </Label>
            <input
              id="pdf-file"
              type="file"
              accept="application/pdf"
              required
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="flex h-9 w-full rounded-xl border border-input bg-background px-3 py-1.5 text-sm cursor-pointer file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground"
            />
          </div>
          <Button
            type="submit"
            disabled={uploading}
            className="h-9 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20 whitespace-nowrap"
          >
            {uploading
              ? <><Loader2 className="size-3.5 mr-1.5 animate-spin" />{t('processing')}</>
              : <><Upload className="size-3.5 mr-1.5" />{t('uploadBtn')}</>
            }
          </Button>
        </form>
        {file && (
          <p className="text-xs text-muted-foreground">
            {t('selectedFile')}{' '}
            <span className="text-foreground font-medium">{file.name}</span>
            {' '}({(file.size / 1024 / 1024).toFixed(1)} MB)
          </p>
        )}
      </div>

      {/* PDF list */}
      {filteredPdfs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center border-2 border-dashed border-border/40 rounded-2xl gap-3">
          <FileText className="size-10 text-muted-foreground/25" />
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {personalBooks.length === 0 ? t('noDocUploaded') : t('noBooksFound')}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">
              {personalBooks.length === 0 ? t('addFirstPdfHint') : t('tryAnotherSearch')}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredPdfs.map(book => {
            const summary    = aiSummary[book.id];
            const status     = aiStatus[book.id];
            const processing = !!status;
            const isNeural   = summary?.mode === 'neural';

            const isActive      = pdfTrack?.id === book.id;
            const displayOffset = isActive ? ttsOffset : (book.progress?.charOffset ?? 0);
            const displayTotal  = isActive ? ttsTotalChars : (book.progress?.totalChars || book.contentLength);
            const hasProgress   = displayOffset > 0;
            const pct = displayTotal > 0 ? Math.min(100, Math.round((displayOffset / displayTotal) * 100)) : 0;

            return (
              <div
                key={book.id}
                className={`bg-card rounded-2xl border shadow-sm overflow-hidden transition-all ${
                  isActive ? 'border-primary/40 shadow-[0_0_16px_var(--glow-sage)]' : 'border-border/60 hover:shadow-md'
                }`}
              >
                {/* Main row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Icon */}
                  <div className={`shrink-0 size-9 rounded-xl flex items-center justify-center border ${
                    isActive ? 'bg-primary/15 border-primary/30' : 'bg-red-500/10 border-red-500/20'
                  }`}>
                    <FileText className={`size-4 ${isActive ? 'text-primary' : 'text-red-400'}`} />
                  </div>

                  {/* Title + meta */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate leading-snug">{book.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground font-mono">~{estimateReadingTime(book.contentLength)}</span>
                      {hasProgress && (
                        <>
                          <span className="text-border text-xs">·</span>
                          <span className="text-[11px] text-primary font-semibold">{pct}%</span>
                          {isActive && (
                            <span className="text-[11px] text-muted-foreground font-mono">{formatTtsTime(displayOffset)}</span>
                          )}
                        </>
                      )}
                      {summary && (
                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                          isNeural ? 'bg-primary/10 text-primary border-primary/25' : 'bg-muted text-muted-foreground border-border/60'
                        }`}>
                          {isNeural ? <><Sparkles className="size-2.5" />AI</> : <><Zap className="size-2.5" />Quick</>}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Inline progress bar */}
                  {hasProgress && (
                    <div
                      className="hidden sm:block w-20 h-1 rounded-full overflow-hidden bg-muted cursor-pointer shrink-0"
                      onClick={e => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const offset = Math.round(((e.clientX - rect.left) / rect.width) * displayTotal);
                        handleSeek(book.id, Math.max(0, Math.min(displayTotal, offset)));
                      }}
                    >
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-[var(--gold)]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant={isActive && ttsIsPlaying ? 'default' : 'outline'}
                      onClick={() => handlePlayAudio(book.id, book.title)}
                      className="rounded-xl h-8 text-xs px-3"
                    >
                      {isActive && ttsIsPlaying
                        ? <><Pause   className="size-3 mr-1" />{t('pauseAction')}</>
                        : isActive && ttsPaused
                          ? <><Play    className="size-3 mr-1" />{t('resumeAction')}</>
                          : <><Volume2 className="size-3 mr-1" />{hasProgress ? t('resumeAction') : t('listenAction')}</>
                      }
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSummarize(book.id)}
                      disabled={processing}
                      className="rounded-xl h-8 text-xs px-3 hover:border-primary/40 hover:text-primary"
                    >
                      {processing
                        ? <Loader2 className="size-3 animate-spin" />
                        : <Sparkles className="size-3" />
                      }
                    </Button>
                    <button
                      onClick={() => handleDeletePdf(book.id)}
                      aria-label={t('deleteDoc')}
                      className="flex size-8 items-center justify-center rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>

                {/* Active TTS navigation strip */}
                {isActive && (
                  <div className="px-4 pb-3 space-y-2 border-t border-border/40 pt-2">
                    <div className="flex items-center justify-center gap-1.5">
                      {([[-10, '−10m'], [-1, '−1m'], [1, '+1m'], [10, '+10m']] as [number, string][]).map(([mins, label]) => (
                        <button
                          key={label}
                          onClick={() => handleSeek(book.id, Math.max(0, Math.min(displayTotal, displayOffset + mins * CHARS_PER_MIN)))}
                          className="text-[10px] font-mono px-2 py-1 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reset progress (not active, has progress) */}
                {!isActive && hasProgress && (
                  <div className="px-4 pb-2 flex justify-end">
                    <button
                      onClick={() => handleClearProgress(book.id)}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <RotateCcw className="size-3" />{t('resetProgress')}
                    </button>
                  </div>
                )}

                {/* Processing status */}
                {processing && (
                  <div className="px-4 pb-3 flex items-center gap-2 text-xs text-primary border-t border-border/40 pt-2">
                    <Loader2 className="size-3 animate-spin shrink-0" />
                    <span>{status.message}</span>
                  </div>
                )}

                {/* Summary panel */}
                <AnimatePresence>
                  {summary && (
                    <motion.div
                      key={`ai-${book.id}`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                      className="border-t border-border/60 px-4 py-3 bg-primary/[0.03] overflow-hidden"
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        {isNeural ? <Sparkles className="size-3 text-primary" /> : <Zap className="size-3 text-muted-foreground" />}
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${isNeural ? 'text-primary' : 'text-muted-foreground'}`}>
                          {isNeural ? t('neuralSummaryTitle') : t('quickSummaryTitle')}
                        </span>
                      </div>
                      <p className="text-xs text-foreground leading-relaxed">{summary.text}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
