import { isAppApiHttpError } from './errors';
import { clearCsrfToken } from './http';
import { getJson, postJson } from './http';

interface AuthLoginResponse {
  userId: string;
  mustChangePassword: boolean;
  csrfToken?: string;
}

interface AuthSessionResponse {
  userId: string;
  mustChangePassword: boolean;
  csrfToken?: string;
}

interface PasswordResetRequestResponse {
  sent: boolean;
  message: string;
  resetLink?: string;
}

interface PasswordResetConfirmResponse {
  success: boolean;
  message: string;
}

interface EmailChangeRequestResponse {
  success: boolean;
  message: string;
  confirmationLink?: string;
}

interface AccountUpdateResponse {
  success: boolean;
  message: string;
  mustChangePassword?: boolean;
}

function toAuthError(error: unknown): Error {
  if (isAppApiHttpError(error)) {
    return new Error(error.message);
  }

  return error instanceof Error ? error : new Error(String(error));
}

export async function login(email: string, password: string): Promise<AuthLoginResponse> {
  try {
    return await postJson<AuthLoginResponse>('/api/auth/login', { email, password });
  } catch (error) {
    throw toAuthError(error);
  }
}

export async function resolveSession(): Promise<AuthSessionResponse> {
  try {
    return await getJson<AuthSessionResponse>('/api/auth/session');
  } catch (error) {
    throw toAuthError(error);
  }
}

export async function requestPasswordReset(email: string, origin: string): Promise<PasswordResetRequestResponse> {
  try {
    return await postJson<PasswordResetRequestResponse>('/api/auth/password-reset/request', { email, origin });
  } catch (error) {
    throw toAuthError(error);
  }
}

export async function resetPassword(token: string, password: string): Promise<PasswordResetConfirmResponse> {
  try {
    return await postJson<PasswordResetConfirmResponse>('/api/auth/password-reset/confirm', { token, password });
  } catch (error) {
    throw toAuthError(error);
  }
}

export async function requestEmailChange(email: string, currentPassword: string, origin: string): Promise<EmailChangeRequestResponse> {
  try {
    return await postJson<EmailChangeRequestResponse>('/api/auth/email-change/request', {
      email,
      currentPassword,
      origin,
    });
  } catch (error) {
    throw toAuthError(error);
  }
}

export async function confirmEmailChange(token: string): Promise<AccountUpdateResponse> {
  try {
    return await postJson<AccountUpdateResponse>('/api/auth/email-change/confirm', { token });
  } catch (error) {
    throw toAuthError(error);
  }
}

export async function updatePassword(nextPassword: string, currentPassword?: string): Promise<AccountUpdateResponse> {
  try {
    return await postJson<AccountUpdateResponse>('/api/auth/password/change', {
      currentPassword,
      nextPassword,
    });
  } catch (error) {
    throw toAuthError(error);
  }
}

export async function logout(): Promise<void> {
  try {
    await postJson<{ success: boolean }>('/api/auth/logout', {});
    clearCsrfToken();
  } catch (error) {
    throw toAuthError(error);
  }
}