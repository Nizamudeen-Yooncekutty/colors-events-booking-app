import { useEffect, useRef, useCallback } from 'react';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'];

export default function useIdleTimeout(onIdle) {
  const timerRef = useRef(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onIdle();
    }, IDLE_TIMEOUT_MS);
  }, [onIdle]);

  useEffect(() => {
    resetTimer();

    const handler = () => resetTimer();
    ACTIVITY_EVENTS.forEach(event => window.addEventListener(event, handler, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach(event => window.removeEventListener(event, handler));
    };
  }, [resetTimer]);
}
