'use client';

import { useEffect, useRef, useCallback } from 'react';

const INACTIVITY_MS = 15 * 60 * 1000; // 15 minutes

const ACTIVITY_EVENTS = [
  'mousemove', 'mousedown', 'keydown',
  'touchstart', 'scroll', 'click',
] as const;

/**
 * Logs the user out after INACTIVITY_MS of no user interaction.
 * While audio is playing, the timer is suspended — playback counts as activity.
 * When playback stops, a fresh timer starts immediately.
 *
 * @param active         - should be true only for authenticated protected routes
 * @param isAudioPlaying - true when an audiobook or TTS track is playing
 */
export function useInactivityLogout(active: boolean, isAudioPlaying: boolean) {
  const timerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPlayingRef  = useRef(isAudioPlaying);

  // Keep ref current so the activity handler never captures a stale value
  useEffect(() => {
    isPlayingRef.current = isAudioPlaying;
  });

  const doLogout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login?reason=inactivity';
  }, []);

  const scheduleLogout = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(doLogout, INACTIVITY_MS);
  }, [doLogout]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Set up activity listeners once when the hook becomes active
  useEffect(() => {
    if (!active) {
      clearTimer();
      return;
    }

    const onActivity = () => {
      if (!isPlayingRef.current) scheduleLogout();
    };

    ACTIVITY_EVENTS.forEach(e =>
      window.addEventListener(e, onActivity, { passive: true }),
    );

    // Start the initial countdown
    scheduleLogout();

    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, onActivity));
      clearTimer();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // React to playback state changes
  useEffect(() => {
    if (!active) return;

    if (isAudioPlaying) {
      // Suspend the timer while audio plays
      clearTimer();
    } else {
      // Playback stopped — start a fresh countdown
      scheduleLogout();
    }
  }, [active, isAudioPlaying, scheduleLogout, clearTimer]);
}
