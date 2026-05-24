const STOP = new Set([
  'that','this','with','from','have','they','were','been','their','said',
  'each','when','will','would','could','should',
  'care','este','sunt','pentru','poate','trebuie','astfel','dupa','prin',
  'toate','acesta','acestea','acest','intr','unui','unei',
  'sau','dar','mai','deci','unde','cum','daca','fara',
]);

export function extractiveSummary(raw: string, maxSentences = 5): string {
  const text  = raw.replace(/\s+/g, ' ').trim();
  const sents = text.match(/[^.!?؟]+[.!?؟]+/g) ?? [text];
  if (sents.length <= maxSentences) return sents.join(' ');

  const freq: Record<string, number> = {};
  (text.toLowerCase().match(/\b\w{4,}\b/g) ?? []).forEach(w => {
    if (!STOP.has(w)) freq[w] = (freq[w] ?? 0) + 1;
  });

  return sents
    .map((s, i) => {
      const words = s.toLowerCase().match(/\b\w{4,}\b/g) ?? [];
      const score = words.length
        ? words.reduce((sum, w) => sum + (freq[w] ?? 0), 0) / words.length
        : 0;
      return { s, score, i };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .sort((a, b) => a.i - b.i)
    .map(t => t.s.trim())
    .join(' ');
}
