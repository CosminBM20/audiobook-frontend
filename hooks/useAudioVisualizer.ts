'use client';

import { useRef, useEffect } from 'react';

/**
 * Animated canvas bar visualizer — purely visual, no AudioContext.
 *
 * Why not Web Audio API?
 * `createMediaElementSource()` reroutes the <audio> element's output
 * exclusively through the AudioContext. Because new AudioContexts start
 * in "suspended" state (browser autoplay policy), audio goes completely
 * silent until resume() succeeds — which races with requestAnimationFrame
 * and is unreliable across browsers. Removing that connection guarantees
 * audio always plays through the system's default output.
 *
 * The bars animate with smooth per-bar interpolation toward random targets
 * while playing, giving a convincing "equalizer" appearance without
 * analysing actual frequencies.
 */
export function useAudioVisualizer(isPlaying: boolean) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);
  // Each bar independently tracks its current height (0-1) and a target
  const barsRef   = useRef<Float32Array>(new Float32Array(32).fill(0.1));
  const targetsRef = useRef<Float32Array>(new Float32Array(32).map(() => Math.random() * 0.4 + 0.05));

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || !isPlaying) {
      cancelAnimationFrame(animRef.current);
      // Smoothly collapse bars to zero instead of a hard clear
      const ctx = canvas?.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas!.width, canvas!.height);
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx    = canvas.getContext('2d')!;
    const W      = canvas.width;
    const H      = canvas.height;
    const bars   = barsRef.current;
    const targets = targetsRef.current;
    const barW   = W / bars.length;

    let frame = 0;

    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      frame++;
      ctx.clearRect(0, 0, W, H);

      const isDark = document.documentElement.classList.contains('dark');

      bars.forEach((value, i) => {
        // Randomise targets at slightly different rates per bar for organic feel
        if (frame % (8 + (i % 5)) === 0) {
          targets[i] = Math.random() * 0.85 + 0.05;
        }
        // Smooth interpolation toward target
        bars[i] = value + (targets[i] - value) * 0.12;

        const barH  = Math.max(2, bars[i] * H);
        const alpha = 0.3 + bars[i] * 0.7;

        // Colour gradient: cool blue → violet per bar (adapts to dark mode)
        const progress = i / bars.length;
        const r = isDark ? Math.round(160 + progress * 95) : Math.round(15  + progress * 30);
        const g = isDark ? Math.round(170 - progress * 50) : Math.round(23  + progress * 20);
        const b = isDark ? 230                              : 42;

        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;

        const x      = i * barW;
        const y      = H - barH;
        const radius = Math.min(2, barW / 2);

        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + barW - radius - 1, y);
        ctx.quadraticCurveTo(x + barW - 1, y, x + barW - 1, y + radius);
        ctx.lineTo(x + barW - 1, H);
        ctx.lineTo(x, H);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
      });
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying]);

  useEffect(() => () => cancelAnimationFrame(animRef.current), []);

  return canvasRef;
}
