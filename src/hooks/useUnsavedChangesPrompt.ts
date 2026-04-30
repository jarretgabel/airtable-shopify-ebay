import { useEffect, useRef } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router-dom';
import type { ConfirmationRequest } from '@/hooks/useConfirmationDialog';

interface UseUnsavedChangesPromptParams {
  when: boolean;
  message?: string;
  requestConfirmation?: (request: ConfirmationRequest) => Promise<boolean>;
}

const DEFAULT_MESSAGE = 'You have unsaved changes. Leave this page and discard them?';

export function useUnsavedChangesPrompt({
  when,
  message = DEFAULT_MESSAGE,
  requestConfirmation,
}: UseUnsavedChangesPromptParams) {
  const blocker = useBlocker(when);
  const pendingConfirmationRef = useRef(false);

  useEffect(() => {
    if (blocker.state !== 'blocked' || pendingConfirmationRef.current) return;

    let cancelled = false;
    pendingConfirmationRef.current = true;

    const confirmLeave = async () => {
      if (!requestConfirmation) {
        blocker.reset();
        pendingConfirmationRef.current = false;
        return;
      }

      const confirmed = await requestConfirmation({
        title: 'Discard unsaved changes?',
        message,
        confirmLabel: 'Discard changes',
        tone: 'danger',
      });

      if (cancelled) return;

      if (confirmed) {
        blocker.proceed();
      } else {
        blocker.reset();
      }

      pendingConfirmationRef.current = false;
    };

    void confirmLeave();

    return () => {
      cancelled = true;
      pendingConfirmationRef.current = false;
    };
  }, [blocker, message, requestConfirmation]);

  useBeforeUnload((event) => {
    if (!when) return;
    event.preventDefault();
    event.returnValue = message;
  }, { capture: true });
}