export const CHARS_PER_MIN = 675; // rate=0.82 × ~150 words/min × ~5 chars/word

export function formatTtsTime(chars: number): string {
  const totalSec = Math.round((chars / CHARS_PER_MIN) * 60);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function detectContentLang(text: string): string {
  const sample  = text.slice(0, 1200);
  const roChars = (sample.match(/[ăâîșțĂÂÎȘȚ]/g) ?? []).length;
  const roWords = (sample.toLowerCase().match(
    /\b(și|că|pentru|după|înainte|dacă|foarte|poate|trebuie|acesta|această|acum|când|unde|sunt|este|unui|unei|într|printr)\b/g,
  ) ?? []).length;
  return (roChars > 8 || roWords > 2) ? 'ro-RO' : 'en-US';
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  SCREENSHOT: Listing 4.3 — Selecția vocii TTS prin scoring  ║
// ║  Capturați întreaga funcție pickBestVoice de mai jos         ║
// ╚══════════════════════════════════════════════════════════════╝
export function pickBestVoice(voices: SpeechSynthesisVoice[], locale: string): SpeechSynthesisVoice | null {
  const prefix     = locale.split('-')[0];
  const candidates = voices.filter(v => v.lang === locale || v.lang.startsWith(prefix));
  if (!candidates.length) return null;
  const score = (v: SpeechSynthesisVoice) => {
    const n = v.name.toLowerCase();
    let s = 0;
    if (v.lang === locale)       s += 10;
    if (n.includes('natural'))   s += 8;
    if (n.includes('neural'))    s += 8;
    if (n.includes('online'))    s += 6;
    if (n.includes('premium'))   s += 5;
    if (n.includes('enhanced'))  s += 4;
    if (n.includes('microsoft')) s += 3;
    if (n.includes('google'))    s += 1; // lower than Microsoft so Natural voices win
    return s;
  };
  return candidates.sort((a, b) => score(b) - score(a))[0] ?? null;
}
// ╚══ SFARSIT Listing 4.3 ══════════════════════════════════════╝

export function preprocessForTts(raw: string): string {
  return raw
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/(?:https?:\/\/|ftp:\/\/|www\.)\S+/gi, '')
    .replace(/[\w.+-]+@[\w-]+\.[a-z]{2,}/gi, '')
    .replace(/\[\s*[\w\s.,;:-]{1,30}\s*\]/g, '')
    .replace(/\b(?:doi|isbn|issn)[:\s]*[\d.\-/X]+/gi, '')
    .replace(/^[\s—–-]*\d{1,4}[\s—–-]*$/gm, '')
    .replace(/^[A-ZĂÂÎȘȚ\s]{4,60}$/gm, '')
    .replace(/-\n(\S)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n\n/g, '... ')
    .replace(/\n/g, ' ')
    .replace(/([.!?])\s+([A-ZÁÉÍÓÚĂÂÎȘȚ])/g, '$1 , $2')
    .replace(/\bnr\./gi,   'numărul')
    .replace(/\bstr\./gi,  'strada')
    .replace(/\bdl\./gi,   'domnul')
    .replace(/\bdna\./gi,  'doamna')
    .replace(/\bprof\./gi, 'profesor')
    .replace(/\bdr\./gi,   'doctor')
    .replace(/\betc\./gi,  'etcetera')
    .replace(/\be\.g\./gi, 'for example')
    .replace(/\bi\.e\./gi, 'that is')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
