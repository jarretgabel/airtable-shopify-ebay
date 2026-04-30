import { useCallback, useState } from 'react';
import { ConfirmationModal, type ConfirmationModalProps } from '@/components/app/ConfirmationModal';

export interface ConfirmationRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmationModalProps['tone'];
  bullets?: string[];
  typedConfirmation?: ConfirmationModalProps['typedConfirmation'];
}

interface PendingConfirmation extends ConfirmationRequest {
  resolve: (value: boolean) => void;
}

export function useConfirmationDialog() {
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);

  const requestConfirmation = useCallback((request: ConfirmationRequest) => new Promise<boolean>((resolve) => {
    setPendingConfirmation({ ...request, resolve });
  }), []);

  const closeWith = useCallback((result: boolean) => {
    setPendingConfirmation((current) => {
      if (!current) return null;
      current.resolve(result);
      return null;
    });
  }, []);

  return {
    requestConfirmation,
    confirmationModal: (
      <ConfirmationModal
        open={Boolean(pendingConfirmation)}
        title={pendingConfirmation?.title ?? ''}
        message={pendingConfirmation?.message ?? ''}
        confirmLabel={pendingConfirmation?.confirmLabel}
        cancelLabel={pendingConfirmation?.cancelLabel}
        tone={pendingConfirmation?.tone}
        bullets={pendingConfirmation?.bullets}
        typedConfirmation={pendingConfirmation?.typedConfirmation}
        onConfirm={() => closeWith(true)}
        onCancel={() => closeWith(false)}
      />
    ),
  };
}