import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Clock, Heart, BookmarkPlus, Play } from 'lucide-react';

interface BookCardProps {
  id: string;
  title: string;
  coverImageUrl: string;
  author: string;
  category: string;
  durationSeconds: number;
  progress?: number;
  isFavorite?: boolean;
  onFavoriteToggle?: (e: React.MouseEvent) => void;
  onListenLater?: (e: React.MouseEvent) => void;
  onPlay?: (e: React.MouseEvent) => void;
  createdAt?: string;
}

function formatDuration(seconds: number) {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getBlurDataUrl(url: string): string | undefined {
  if (!url?.includes('res.cloudinary.com')) return undefined;
  return url.replace('/upload/', '/upload/w_10,q_10,e_blur:200/');
}

export const BookCard = React.memo(function BookCard({
  id, title, coverImageUrl, author, durationSeconds,
  progress = 0, isFavorite, onFavoriteToggle, onListenLater, onPlay, createdAt,
}: BookCardProps) {
  const isNew = createdAt
    ? Date.now() - new Date(createdAt).getTime() < 7 * 24 * 60 * 60 * 1000
    : false;

  const blurDataURL = getBlurDataUrl(coverImageUrl);

  return (
    <Link
      href={`/audiobook/${id}`}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl"
      aria-label={`${title} de ${author} — ${formatDuration(durationSeconds)}`}
    >
      <article className="bg-card rounded-2xl overflow-hidden flex flex-col shadow-sm transition-all duration-300 motion-safe:hover:shadow-[0_8px_28px_oklch(0_0_0_/_0.18),_0_2px_8px_var(--glow-sage)] motion-safe:hover:-translate-y-1">

        {/* Cover image — overflow-hidden clips the scaled image on hover */}
        <div className="relative w-full aspect-[2/3] overflow-hidden bg-muted">
          <Image
            src={coverImageUrl || 'https://placehold.co/300x450'}
            alt=""
            role="presentation"
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover object-top transition-transform duration-500 motion-safe:group-hover:scale-[1.03] [will-change:transform]"
            placeholder={blurDataURL ? 'blur' : 'empty'}
            blurDataURL={blurDataURL}
          />

          {/* Bottom gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Play button — wrapper is pointer-events-none so it never blocks the heart/bookmark */}
          {onPlay && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 pointer-events-none">
              <button
                onClick={e => { e.preventDefault(); e.stopPropagation(); onPlay(e); }}
                aria-label={`Redă ${title}`}
                className="pointer-events-auto flex size-11 items-center justify-center rounded-full bg-primary/90 backdrop-blur-sm shadow-[0_4px_20px_var(--glow-sage-strong)] motion-safe:scale-90 motion-safe:group-hover:scale-100 transition-transform duration-200 hover:bg-primary active:scale-95"
              >
                <Play className="size-4 text-primary-foreground ml-0.5" aria-hidden="true" fill="currentColor" />
              </button>
            </div>
          )}

          {/* "NOU" badge */}
          {isNew && (
            <div
              aria-label="Carte nouă"
              className="absolute top-2 left-2 bg-primary/90 backdrop-blur-sm text-primary-foreground text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider pointer-events-none shadow-sm"
            >
              Nou
            </div>
          )}

          {/* Favorite toggle */}
          {onFavoriteToggle && (
            <button
              onClick={e => { e.stopPropagation(); e.preventDefault(); onFavoriteToggle(e); }}
              aria-label={isFavorite ? `Elimină ${title} din favorite` : `Adaugă ${title} la favorite`}
              aria-pressed={isFavorite}
              className="absolute top-2 right-2 z-20 flex size-7 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all hover:bg-black/60 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Heart
                className={`size-3.5 transition-colors duration-200 ${
                  isFavorite ? 'fill-red-400 text-red-400' : 'text-white'
                }`}
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </button>
          )}

          {/* Listen-later button */}
          {onListenLater && (
            <button
              onClick={e => { e.stopPropagation(); e.preventDefault(); onListenLater(e); }}
              aria-label={`Adaugă ${title} la lista de ascultare`}
              className="absolute bottom-2 right-2 z-20 flex size-7 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all hover:bg-black/60 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <BookmarkPlus className="size-3.5 text-white" strokeWidth={1.5} aria-hidden="true" />
            </button>
          )}

          {/* Listening progress bar */}
          {progress > 0 && (
            <div
              className="absolute bottom-0 left-0 right-0 h-[3px] bg-border/40"
              role="progressbar"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Progres ascultare: ${Math.round(progress)}%`}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-[var(--gold)] transition-all duration-500"
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
          )}
        </div>

        {/* Text area */}
        <div className="p-3 flex flex-col gap-0.5 flex-1 bg-card">
          <p className="font-semibold text-foreground text-sm truncate leading-snug">{title}</p>
          <p className="text-muted-foreground text-xs truncate">{author}</p>
          <div className="flex items-center gap-1 text-muted-foreground/60 text-xs mt-auto pt-2" aria-label={`Durată: ${formatDuration(durationSeconds)}`}>
            <Clock className="size-3 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            <span className="font-mono">{formatDuration(durationSeconds)}</span>
          </div>
        </div>

      </article>
    </Link>
  );
});
