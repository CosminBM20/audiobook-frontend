'use client';

import { useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Rewind, FastForward, Play, Pause, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { usePlayerControls, usePlayerTime } from '../contexts/PlayerContext';
import { useAudioVisualizer } from '../hooks/useAudioVisualizer';

function fmt(s: number): string {
  if (!s || isNaN(s)) return '0:00';
  const h  = Math.floor(s / 3600);
  const m  = Math.floor((s % 3600) / 60);
  const sc = Math.floor(s % 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(sc).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

function useDragSlider(onChange: (pct: number) => void) {
  return useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      const bar = e.currentTarget;
      const update = (clientX: number) => {
        const rect = bar.getBoundingClientRect();
        onChange(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)));
      };
      update(e.clientX);
      const onMove = (ev: MouseEvent) => update(ev.clientX);
      const onUp   = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup',   onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup',   onUp);
    },
    [onChange],
  );
}

export function BottomPlayer() {
  const { book, isPlaying, isLoading, duration, volume, toggle, seek, skip, setVolume } = usePlayerControls();
  const { currentTime, progressPct } = usePlayerTime();
  const prevVolume = useRef(volume > 0 ? volume : 0.75);
  const canvasRef  = useAudioVisualizer(isPlaying);

  const onScrubChange  = useCallback((pct: number) => seek(pct * duration), [seek, duration]);
  const onVolumeChange = useCallback((pct: number) => setVolume(pct), [setVolume]);
  const handleScrubber = useDragSlider(onScrubChange);
  const handleVolume   = useDragSlider(onVolumeChange);

  const toggleMute = () => {
    if (volume > 0) { prevVolume.current = volume; setVolume(0); }
    else setVolume(prevVolume.current);
  };

  if (!book) return null;

  return (
    <div
      role="region"
      aria-label="Player audio persistent"
      className="fixed bottom-0 left-0 right-0 z-50 h-[72px] flex items-center px-4 gap-2 bg-background/90 backdrop-blur-xl border-t border-border/60 shadow-[0_-4px_40px_oklch(0_0_0_/_0.15)] animate-slide-up"
    >
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {isPlaying ? `Se redă: ${book.title}` : `Pauză: ${book.title}`}
      </div>

      {/* LEFT: Book info */}
      <Link
        href={`/audiobook/${book.id}`}
        className="flex items-center gap-3 w-[26%] min-w-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
        aria-label={`Vizualizează detalii: ${book.title} de ${book.author.name}`}
      >
        <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 ring-1 ring-border/60 shadow-sm group-hover:shadow-md transition-shadow">
          <Image src={book.coverImageUrl} alt="" role="presentation" fill sizes="48px" className="object-cover" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm text-foreground truncate leading-tight group-hover:text-primary transition-colors">
            {book.title}
          </p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{book.author.name}</p>
        </div>
      </Link>

      {/* CENTER: Controls + Scrubber */}
      <div className="flex-1 flex flex-col items-center justify-center gap-1.5 min-w-0">

        <div className="flex items-center gap-5">
          {/* Frequency visualizer */}
          <canvas
            ref={canvasRef}
            width={80}
            height={20}
            aria-hidden="true"
            className={`rounded hidden md:block transition-opacity duration-500 ${isPlaying ? 'opacity-70' : 'opacity-0'}`}
          />

          <button
            onClick={() => skip(-15)}
            aria-label="Înapoi 15 secunde"
            className="group/btn flex flex-col items-center gap-px text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            <Rewind className="size-[17px] transition-transform group-active/btn:scale-90" aria-hidden="true" />
            <span className="text-[9px] font-bold leading-none tracking-wide">15s</span>
          </button>

          <button
            onClick={toggle}
            disabled={isLoading}
            aria-label={isPlaying ? 'Pauză' : 'Redă'}
            className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/30 motion-safe:hover:scale-105 motion-safe:active:scale-95 transition-all duration-150 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {isLoading
              ? <Loader2 className="size-[17px] animate-spin" aria-hidden="true" />
              : isPlaying
                ? <Pause className="size-[17px]" aria-hidden="true" />
                : <Play  className="size-[17px] ml-0.5" aria-hidden="true" fill="currentColor" />
            }
          </button>

          <button
            onClick={() => skip(15)}
            aria-label="Înainte 15 secunde"
            className="group/btn flex flex-col items-center gap-px text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            <FastForward className="size-[17px] transition-transform group-active/btn:scale-90" aria-hidden="true" />
            <span className="text-[9px] font-bold leading-none tracking-wide">15s</span>
          </button>

          <canvas width={80} height={20} aria-hidden="true" className="rounded hidden md:block opacity-0 pointer-events-none" />
        </div>

        {/* Scrubber */}
        <div className="flex items-center gap-2 w-full max-w-[480px]">
          <span className="text-[10px] tabular-nums font-mono text-muted-foreground w-8 text-right shrink-0" aria-hidden="true">
            {fmt(currentTime)}
          </span>

          <div
            role="slider"
            aria-label="Poziție redare"
            aria-valuenow={Math.round(progressPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={`${fmt(currentTime)} din ${fmt(duration)}`}
            tabIndex={0}
            className="relative flex-1 h-1 rounded-full cursor-pointer select-none bg-muted group hover:h-[5px] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            onMouseDown={handleScrubber}
            onKeyDown={e => {
              if (e.key === 'ArrowRight') seek(currentTime + 10);
              if (e.key === 'ArrowLeft')  seek(currentTime - 10);
            }}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full pointer-events-none bg-gradient-to-r from-primary to-[var(--gold)]"
              style={{ width: `${progressPct}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-3 rounded-full bg-primary shadow scale-0 group-hover:scale-100 transition-transform duration-150 pointer-events-none"
              style={{ left: `${progressPct}%` }}
            />
          </div>

          <span className="text-[10px] tabular-nums font-mono text-muted-foreground w-8 shrink-0" aria-hidden="true">
            {fmt(duration)}
          </span>
        </div>
      </div>

      {/* RIGHT: Volume */}
      <div className="flex items-center justify-end gap-2 w-[26%] pr-2">
        <button
          onClick={toggleMute}
          aria-label={volume === 0 ? 'Activează sunetul' : 'Dezactivează sunetul'}
          className="text-muted-foreground hover:text-primary transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          {volume === 0
            ? <VolumeX className="size-4" aria-hidden="true" />
            : <Volume2 className="size-4" aria-hidden="true" />
          }
        </button>

        <div
          role="slider"
          aria-label="Volum"
          aria-valuenow={Math.round(volume * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={`${Math.round(volume * 100)} la sută`}
          tabIndex={0}
          className="relative w-24 h-1 rounded-full cursor-pointer select-none bg-muted group hover:h-[5px] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          onMouseDown={handleVolume}
          onKeyDown={e => {
            if (e.key === 'ArrowRight') setVolume(Math.min(1, volume + 0.05));
            if (e.key === 'ArrowLeft')  setVolume(Math.max(0, volume - 0.05));
          }}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full pointer-events-none bg-gradient-to-r from-primary to-[var(--gold)]"
            style={{ width: `${volume * 100}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-3 rounded-full bg-primary shadow scale-0 group-hover:scale-100 transition-transform duration-150 pointer-events-none"
            style={{ left: `${volume * 100}%` }}
          />
        </div>

        <span className="text-[10px] tabular-nums font-mono text-muted-foreground w-7 text-right shrink-0" aria-hidden="true">
          {Math.round(volume * 100)}%
        </span>
      </div>
    </div>
  );
}
