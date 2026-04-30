import type { ConfirmationRequest } from '@/hooks/useConfirmationDialog';
import type { AppUser } from '@/stores/auth/authTypes';

export function buildDeleteUserConfirmationRequest(user: AppUser): ConfirmationRequest {
  return {
    title: 'Delete user account',
    message: 'Delete this user from Airtable and revoke access immediately.',
    confirmLabel: 'Delete user',
    tone: 'danger',
    bullets: [
      `User: ${user.name}`,
      `Email: ${user.email}`,
      'This action cannot be undone.',
    ],
    typedConfirmation: {
      expectedValue: user.email,
      inputLabel: 'Type the user email to confirm',
      helperText: 'Enter the user email exactly as shown to permanently delete this account.',
      placeholder: user.email,
    },
  };
}