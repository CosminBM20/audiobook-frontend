/**
 * Two-tier summarisation worker:
 *
 * Tier 1 — Extractive (instant, ~50 ms, pure JS, no download)
 *   Scores every sentence by TF-IDF-style word frequency and returns the
 *   top-N highest-scoring sentences in their original order. Works well for
 *   academic notes in any language.
 *
 * Tier 2 — Neural (Transformers.js, ~40 MB quantised model, cached after first use)
 *   Downloads Xenova/distilbart-cnn-6-6, chunks long texts so they fit inside the
 *   1 024-token context window, and upgrades the extractive result once done.
 *   Sends real download-progress events so the UI can show a progress bar.
 *
 * Message protocol (worker → main thread):
 *   { type: 'extractive',   bookId, summary }          — instant, always sent first
 *   { type: 'status',       bookId, message, progress } — optional number 0-100
 *   { type: 'result',       bookId, summary }          — neural upgrade
 *   { type: 'neural_error', bookId, message }          — neural failed; extractive stays
 *   { type: 'error',        bookId, message }          — total failure (even extractive)
 */

import { pipeline, env } from '@xenova/transformers';

env.allowLocalModels = false;
env.useBrowserCache  = true;

type SumPipeline = Awaited<ReturnType<typeof pipeline>>;
let pipe: SumPipeline | null = null;

// ── Tier 1: Extractive ────────────────────────────────────────────────────────

const STOP = new Set([
  // English
  'that','this','with','from','have','they','were','been','their','said',
  'each','when','will','would','could','should',
  // Romanian
  'care','este','sunt','pentru','poate','trebuie','astfel','dupa','prin',
  'toate','acesta','acestea','acest','intr','unui','unei','care','care',
  'sau','dar','mai','deci','prin','unde','cum','daca','fara',
]);

function extractiveSummary(raw: string, maxSentences = 5): string {
  const text  = raw.replace(/\s+/g, ' ').trim();
  const sents = text.match(/[^.!?؟]+[.!?؟]+/g) ?? [text];
  if (sents.length <= maxSentences) return sents.join(' ');

  // Word-frequency table
  const freq: Record<string, number> = {};
  (text.toLowerCase().match(/\b\w{4,}\b/g) ?? []).forEach(w => {
    if (!STOP.has(w)) freq[w] = (freq[w] ?? 0) + 1;
  });

  const scored = sents.map((s, i) => {
    const words = s.toLowerCase().match(/\b\w{4,}\b/g) ?? [];
    const score = words.length
      ? words.reduce((sum, w) => sum + (freq[w] ?? 0), 0) / words.length
      : 0;
    return { s, score, i };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .sort((a, b) => a.i - b.i)          // restore original sentence order
    .map(t => t.s.trim())
    .join(' ');
}

// ── Tier 2 helpers ────────────────────────────────────────────────────────────

function chunkText(text: string, maxChars = 3_000): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  const sents = clean.match(/[^.!?]+[.!?]+/g) ?? [clean];
  const chunks: string[] = [];
  let cur = '';
  for (const s of sents) {
    if (cur.length + s.length > maxChars && cur) { chunks.push(cur.trim()); cur = s; }
    else cur += ' ' + s;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.slice(0, 3); // max 3 chunks ≈ 9 000 chars
}

// ── Main handler ──────────────────────────────────────────────────────────────

self.addEventListener('message', async (
  event: MessageEvent<{ text: string; bookId: string }>,
) => {
  const { text, bookId } = event.data;

  // ── Tier 1: always send an instant extractive result ─────────────────────
  try {
    const extractive = extractiveSummary(text);
    self.postMessage({ type: 'extractive', bookId, summary: extractive });
  } catch {
    self.postMessage({ type: 'error', bookId, message: 'Eroare la procesarea textului.' });
    return;
  }

  // ── Tier 2: neural upgrade ────────────────────────────────────────────────
  try {
    if (!pipe) {
      self.postMessage({ type: 'status', bookId, message: 'Se inițializează modelul AI…', progress: 0 });

      pipe = await pipeline('summarization', 'Xenova/distilbart-cnn-6-6', {
        quantized: true,
        progress_callback: (info: { status: string; progress?: number }) => {
          if (info.status === 'progress' && info.progress != null) {
            self.postMessage({
              type: 'status', bookId,
              message: `Descarcă modelul AI: ${Math.round(info.progress)}%`,
              progress: Math.round(info.progress),
            });
          } else if (info.status === 'done') {
            self.postMessage({ type: 'status', bookId, message: 'Model pregătit. Analizează textul…', progress: 100 });
          }
        },
      });
    } else {
      self.postMessage({ type: 'status', bookId, message: 'Analizează textul cu AI…', progress: undefined });
    }

    const chunks = chunkText(text);
    const partials: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      self.postMessage({
        type: 'status', bookId,
        message: chunks.length > 1
          ? `Procesează secțiunea ${i + 1} din ${chunks.length}…`
          : 'Generează rezumatul neural…',
        progress: undefined,
      });

      const out = await (pipe as any)(chunks[i], {
        max_new_tokens: 120,
        min_length:     25,
        do_sample:      false,
      }) as Array<{ summary_text: string }>;

      partials.push(out[0].summary_text);
    }

    self.postMessage({ type: 'result', bookId, summary: partials.join(' ') });

  } catch (err) {
    // Neural failed — the extractive result is already in the UI, so just
    // clear the loading state without alarming the user.
    self.postMessage({
      type: 'neural_error', bookId,
      message: err instanceof Error ? err.message : 'Modelul neural nu a putut fi încărcat.',
    });
  }
});
