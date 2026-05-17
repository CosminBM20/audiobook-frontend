import type { Lang } from '../contexts/LanguageContext';

export interface BookCategory {
  /** Canonical value stored in the DB — always Romanian */
  ro: string;
  en: string;
}

export const BOOK_CATEGORIES: BookCategory[] = [
  { ro: 'Ficțiune',             en: 'Fiction' },
  { ro: 'Știință Ficțiune',     en: 'Science Fiction' },
  { ro: 'Thriller',             en: 'Thriller' },
  { ro: 'Aventură',             en: 'Adventure' },
  { ro: 'Roman',                en: 'Novel' },
  { ro: 'Clasică',              en: 'Classics' },
  { ro: 'Umor',                 en: 'Humor' },
  { ro: 'Dezvoltare Personală', en: 'Personal Development' },
  { ro: 'Psihologie',           en: 'Psychology' },
  { ro: 'Afaceri',              en: 'Business' },
  { ro: 'Filosofie',            en: 'Philosophy' },
  { ro: 'Știință',              en: 'Science' },
  { ro: 'Tehnologie',           en: 'Technology' },
  { ro: 'Istorie',              en: 'History' },
  { ro: 'Biografie',            en: 'Biography' },
  { ro: 'Artă',                 en: 'Art' },
  { ro: 'Copii',                en: 'Children' },
];

/** Lookup: canonical RO name → EN display name */
const EN_MAP: Record<string, string> = Object.fromEntries(
  BOOK_CATEGORIES.map(c => [c.ro, c.en])
);

/**
 * Known diacritic typos/variants that may exist in the DB.
 * Maps the wrong spelling → canonical RO name.
 */
export const CATEGORY_CANONICAL: Record<string, string> = {
  'Dezvoltare Personala': 'Dezvoltare Personală',
  'Stiinta':              'Știință',
  'Fictiune':             'Ficțiune',
};

/** Normalise a raw DB category name to its canonical RO form. */
export const toCanonical = (name: string): string =>
  CATEGORY_CANONICAL[name] ?? name;

/** Return the display name in the requested language. */
export function displayCategory(roName: string, lang: Lang): string {
  if (lang === 'en') return EN_MAP[roName] ?? roName;
  return roName;
}
