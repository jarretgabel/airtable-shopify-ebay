import { useState } from 'react';
import { useNotificationStore } from '@/stores/notificationStore';

interface UseCopyQueueLinkParams {
  sectionId: string;
  successTitle: string;
  successMessage: string;
  unavailableMessage: string;
  failureMessage: string;
  buildUrl?: () => string;
}

export function useCopyQueueLink({
  sectionId,
  successTitle,
  successMessage,
  unavailableMessage,
  failureMessage,
  buildUrl,
}: UseCopyQueueLinkParams) {
  const pushNotification = useNotificationStore((state) => state.push);
  const [copyingLink, setCopyingLink] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const copyLink = async (urlOverride?: string) => {
    if (typeof window === 'undefined' || !navigator.clipboard) {
      pushNotification({
        tone: 'error',
        title: 'Clipboard unavailable',
        message: unavailableMessage,
      });
      return;
    }

    setCopyingLink(true);

    try {
      const queueUrl = urlOverride ?? (buildUrl ? buildUrl() : (() => {
        const nextUrl = new URL(window.location.href);
        nextUrl.hash = sectionId;
        return nextUrl.toString();
      })());
      await navigator.clipboard.writeText(queueUrl);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 1800);
      pushNotification({
        tone: 'success',
        title: successTitle,
        message: successMessage,
      });
    } catch {
      pushNotification({
        tone: 'error',
        title: 'Copy failed',
        message: failureMessage,
      });
    } finally {
      setCopyingLink(false);
    }
  };

  return {
    copyingLink,
    copiedLink,
    copyLink,
  };
}