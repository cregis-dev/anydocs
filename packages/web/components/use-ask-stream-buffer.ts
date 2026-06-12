'use client';

import { useCallback, useEffect, useRef } from 'react';

const STREAM_FRAME_MS = 35;

function nextChunkSize(length: number) {
  if (length > 400) return 64;
  if (length > 160) return 36;
  if (length > 60) return 18;
  return 8;
}

export function useAskStreamBuffer(
  applyText: (messageId: string, text: string) => void,
) {
  const applyTextRef = useRef(applyText);
  const pendingRef = useRef(new Map<string, string>());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRef = useRef<() => void>(() => {});

  useEffect(() => {
    applyTextRef.current = applyText;
  }, [applyText]);

  const clearTimer = useCallback(() => {
    if (!timerRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const flushPending = useCallback(() => {
    timerRef.current = null;

    const pendingMap = pendingRef.current;

    for (const [messageId, pending] of pendingMap) {
      if (!pending) {
        pendingMap.delete(messageId);
        continue;
      }

      const size = nextChunkSize(pending.length);
      const chunk = pending.slice(0, size);
      const rest = pending.slice(size);
      applyTextRef.current(messageId, chunk);

      if (rest) {
        pendingMap.set(messageId, rest);
      } else {
        pendingMap.delete(messageId);
      }
    }

    if (pendingMap.size > 0) {
      scheduleRef.current();
    }
  }, []);

  const schedule = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setTimeout(flushPending, STREAM_FRAME_MS);
  }, [flushPending]);

  useEffect(() => {
    scheduleRef.current = schedule;
  }, [schedule]);

  const appendBufferedText = useCallback(
    (messageId: string, text: string) => {
      if (!text) return;
      pendingRef.current.set(messageId, `${pendingRef.current.get(messageId) ?? ''}${text}`);
      schedule();
    },
    [schedule],
  );

  const clearBufferedText = useCallback(
    (messageId?: string) => {
      if (messageId) {
        pendingRef.current.delete(messageId);
      } else {
        pendingRef.current.clear();
      }

      if (pendingRef.current.size === 0) {
        clearTimer();
      }
    },
    [clearTimer],
  );

  useEffect(() => {
    const pendingMap = pendingRef.current;

    return () => {
      pendingMap.clear();
      clearTimer();
    };
  }, [clearTimer]);

  return { appendBufferedText, clearBufferedText };
}
