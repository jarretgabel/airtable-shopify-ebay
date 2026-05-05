import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmationModal } from '@/components/app/ConfirmationModal';

describe('ConfirmationModal', () => {
  it('requires the typed confirmation value before enabling confirm', () => {
    const onConfirm = vi.fn();

    render(
      <ConfirmationModal
        open
        title="Publish listing"
        message="Publish this listing now."
        confirmLabel="Publish"
        cancelLabel="Cancel"
        typedConfirmation={{
          expectedValue: 'PUBLISH SHOPIFY',
          inputLabel: 'Type the publish command to confirm',
        }}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    const confirmButton = screen.getByRole('button', { name: 'Publish' });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Type the publish command to confirm'), {
      target: { value: 'PUBLISH' },
    });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Type the publish command to confirm'), {
      target: { value: 'PUBLISH SHOPIFY' },
    });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('can rerender closed and reopened without violating hook order', () => {
    const { rerender } = render(
      <ConfirmationModal
        open={false}
        title="Discard changes"
        message="Leave this page?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(
      <ConfirmationModal
        open
        title="Discard changes"
        message="Leave this page?"
        typedConfirmation={{ expectedValue: 'DISCARD' }}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();

    rerender(
      <ConfirmationModal
        open={false}
        title="Discard changes"
        message="Leave this page?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});