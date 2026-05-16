/**
 * Transformers.js AI Summarization Worker
 *
 * Runs entirely in the browser — zero API cost, zero server changes.
 * The model (~40MB quantized) is downloaded once and cached by the browser
 * via the Cache API built into @xenova/transformers.
 *
 * Setup:
 *   npm install @xenova/transformers
 *   (next.config.ts already has the required webpack aliases)
 */

import { pipeline, env } from '@xenova/transformers';

// Only use remote models from HuggingFace CDN — never look for local files
env.allowLocalModels = false;
// Use the browser's Cache API to persist the model between sessions
env.useBrowserCache  = true;

type SummarizationPipeline = Awaited<ReturnType<typeof pipeline>>;
let pipe: SummarizationPipeline | null = null;

self.addEventListener('message', async (event: MessageEvent<{ text: string; bookId: string }>) => {
  const { text, bookId } = event.data;

  try {
    // ── Step 1: Load model (cached after first download) ─────────────────
    if (!pipe) {
      self.postMessage({
        type: 'status',
        bookId,
        message: 'Se descarcă modelul AI (prima utilizare, ~40MB)…',
      });

      pipe = await pipeline('summarization', 'Xenova/distilbart-cnn-6-6', {
        quantized: true, // 40MB instead of 150MB — good accuracy, much smaller
      });
    }

    // ── Step 2: Run inference ─────────────────────────────────────────────
    self.postMessage({ type: 'status', bookId, message: 'Se analizează textul…' });

    // distilbart-cnn-6-6 has a ~1024-token context window.
    // Romanian text averages ~4 chars/token, so ~4000 chars is safe.
    const truncated = text
      .replace(/\s+/g, ' ')  // collapse whitespace from PDF extraction
      .trim()
      .slice(0, 4_000);

    const output = await (pipe as any)(truncated, {
      max_new_tokens: 130,
      min_length:     30,
      do_sample:      false,
    }) as Array<{ summary_text: string }>;

    self.postMessage({
      type:    'result',
      bookId,
      summary: output[0].summary_text,
    });
  } catch (err) {
    self.postMessage({
      type:    'error',
      bookId,
      message: err instanceof Error ? err.message : 'Eroare necunoscută.',
    });
  }
});
