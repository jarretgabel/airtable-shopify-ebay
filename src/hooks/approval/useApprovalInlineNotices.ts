import { useCallback, useEffect, useRef, useState } from 'react';

export type InlineActionNoticeTone = 'info' | 'success' | 'warning' | 'error';

export interface InlineActionNotice {
  id: string;
  tone: InlineActionNoticeTone;
  title: string;
  message: string;
}

interface InlineNoticeTimers {
  fade: number;
  remove: number;
}

function getNoticeLifetimeMs(tone: InlineActionNoticeTone): { fadeAfterMs: number; removeAfterMs: number } | null {
  if (tone === 'error') return null;
  if (tone === 'warning') {
    return {
      fadeAfterMs: 14000,
      removeAfterMs: 16000,
    };
  }

  return {
    fadeAfterMs: 5500,
    removeAfterMs: 6500,
  };
}

export function useApprovalInlineNotices() {
  const [inlineActionNotices, setInlineActionNotices] = useState<InlineActionNotice[]>([]);
  const [fadingInlineNoticeIds, setFadingInlineNoticeIds] = useState<string[]>([]);
  const inlineNoticeTimersRef = useRef<Record<string, InlineNoticeTimers>>({});

  const clearInlineNoticeTimer = useCallback((id: string) => {
    const timers = inlineNoticeTimersRef.current[id];
    if (timers !== undefined) {
      window.clearTimeout(timers.fade);
      window.clearTimeout(timers.remove);
      delete inlineNoticeTimersRef.current[id];
    }
  }, []);

  const clearAllInlineNoticeTimers = useCallback(() => {
    Object.values(inlineNoticeTimersRef.current).forEach((timers) => {
      window.clearTimeout(timers.fade);
      window.clearTimeout(timers.remove);
    });
    inlineNoticeTimersRef.current = {};
  }, []);

  const resetInlineActionNotices = useCallback(() => {
    clearAllInlineNoticeTimers();
    setInlineActionNotices([]);
    setFadingInlineNoticeIds([]);
  }, [clearAllInlineNoticeTimers]);

  const pushInlineActionNotice = useCallback((tone: InlineActionNoticeTone, title: string, message: string) => {
    const fallbackId = `inline-notice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let id = fallbackId;
    setInlineActionNotices((current) => {
      const duplicate = current.find((notice) => (
        notice.tone === tone
        && notice.title === title
        && notice.message === message
      ));

      if (duplicate) {
        id = duplicate.id;
      }

      const nextNotice: InlineActionNotice = {
        id,
        tone,
        title,
        message,
      };

      const retained = current.filter((notice) => notice.id !== id);
      return [nextNotice, ...retained].slice(0, 6);
    });

    clearInlineNoticeTimer(id);

    const lifetime = getNoticeLifetimeMs(tone);
    if (!lifetime) {
      setFadingInlineNoticeIds((current) => current.filter((noticeId) => noticeId !== id));
      return;
    }

    const fadeTimer = window.setTimeout(() => {
      setFadingInlineNoticeIds((current) => (current.includes(id) ? current : [...current, id]));
    }, lifetime.fadeAfterMs);

    const removeTimer = window.setTimeout(() => {
      setInlineActionNotices((current) => current.filter((notice) => notice.id !== id));
      setFadingInlineNoticeIds((current) => current.filter((noticeId) => noticeId !== id));
      clearInlineNoticeTimer(id);
    }, lifetime.removeAfterMs);

    inlineNoticeTimersRef.current[id] = { fade: fadeTimer, remove: removeTimer };
  }, [clearInlineNoticeTimer]);

  useEffect(() => () => {
    clearAllInlineNoticeTimers();
  }, [clearAllInlineNoticeTimers]);

  return {
    inlineActionNotices,
    fadingInlineNoticeIds,
    pushInlineActionNotice,
    resetInlineActionNotices,
  };
}