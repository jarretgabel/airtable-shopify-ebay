import { describe, expect, it } from 'vitest';
import { buildDeleteUserConfirmationRequest } from '@/components/users/userManagementConfirmation';

describe('buildDeleteUserConfirmationRequest', () => {
  it('requires typing the user email before deletion', () => {
    const request = buildDeleteUserConfirmationRequest({
      id: 'user-1',
      name: 'Alex Parker',
      email: 'alex@example.com',
      role: 'user',
      notificationPreferences: {
        infoEnabled: true,
        successEnabled: true,
        warningEnabled: true,
        errorEnabled: true,
        autoDismissMs: 5000,
      },
      allowedPages: ['dashboard'],
    });

    expect(request.typedConfirmation).toEqual({
      expectedValue: 'alex@example.com',
      inputLabel: 'Type the user email to confirm',
      helperText: 'Enter the user email exactly as shown to permanently delete this account.',
      placeholder: 'alex@example.com',
    });
  });
});