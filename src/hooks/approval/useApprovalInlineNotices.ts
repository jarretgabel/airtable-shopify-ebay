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
    const id = `inline-notice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setInlineActionNotices((current) => ([
      { id, tone, title, message },
      ...current,
    ].slice(0, 8)));

    clearInlineNoticeTimer(id);
    const fadeTimer = window.setTimeout(() => {
      setFadingInlineNoticeIds((current) => (current.includes(id) ? current : [...current, id]));
    }, 3700);

    const removeTimer = window.setTimeout(() => {
      setInlineActionNotices((current) => current.filter((notice) => notice.id !== id));
      setFadingInlineNoticeIds((current) => current.filter((noticeId) => noticeId !== id));
      clearInlineNoticeTimer(id);
    }, 4000);

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