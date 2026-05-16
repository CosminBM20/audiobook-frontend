'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Clock, Heart, Plus } from 'lucide-react';

interface BookListRowProps {
  id: string;
  title: string;
  coverImageUrl: string;
  author: string;
  category: string;
  durationSeconds: number;
  isFavorite?: boolean;
  onFavoriteToggle?: (e: React.MouseEvent) => void;
  onListenLater?: (e: React.MouseEvent) => void;
}

function formatDuration(seconds: number) {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export const BookListRow = React.memo(function BookListRow({
  id, title, coverImageUrl, author, category, durationSeconds,
  isFavorite, onFavoriteToggle, onListenLater,
}: BookListRowProps) {
  return (
    <Link href={`/audiobook/${id}`} className="group block">
      <div className="flex items-center gap-4 px-3 py-2.5 rounded-xl border border-border/60 bg-card hover:bg-muted/40 hover:border-border hover:shadow-sm transition-all duration-200">
        <div className="relative w-10 h-14 rounded-lg overflow-hidden shrink-0">
          <Image
            src={coverImageUrl || 'https://via.placeholder.com/40x56'}
            alt={title}
            fill
            sizes="40px"
            className="object-cover"
          />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground truncate leading-snug">{title}</p>
          <p className="text-xs text-muted-foreground truncate">{author}</p>
          <p className="text-xs text-muted-foreground/60 mt-0.5 hidden sm:block">{category}</p>
        </div>

        <div className="flex items-center gap-1 text-muted-foreground/60 text-xs shrink-0">
          <Clock className="size-3 shrink-0" strokeWidth={1.5} />
          <span>{formatDuration(durationSeconds)}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onFavoriteToggle && (
            <button
              onClick={onFavoriteToggle}
              title={isFavorite ? 'Elimină din favorite' : 'Adaugă la favorite'}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Heart
                className={`size-4 transition-colors ${isFavorite ? 'fill-red-500 text-red-500' : ''}`}
                strokeWidth={1.5}
              />
            </button>
          )}
          {onListenLater && (
            <button
              onClick={onListenLater}
              title="Adaugă la lista de ascultare"
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Plus className="size-4" strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>
    </Link>
  );
});
