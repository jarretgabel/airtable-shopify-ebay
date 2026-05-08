import { useState } from 'react';
import { useNotificationStore } from '@/stores/notificationStore';

interface UseCopyQueueLinkParams {
  sectionId: string;
  successTitle: string;
  successMessage: string;
  unavailableMessage: string;
  failureMessage: string;
}

export function useCopyQueueLink({
  sectionId,
  successTitle,
  successMessage,
  unavailableMessage,
  failureMessage,
}: UseCopyQueueLinkParams) {
  const pushNotification = useNotificationStore((state) => state.push);
  const [copyingLink, setCopyingLink] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const copyLink = async () => {
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
      const queueUrl = new URL(window.location.href);
      queueUrl.hash = sectionId;
      await navigator.clipboard.writeText(queueUrl.toString());
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