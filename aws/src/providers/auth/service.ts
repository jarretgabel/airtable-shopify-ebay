import { HttpError } from '../../shared/errors.js';
import { sendPlainTextEmail } from '../gmail/client.js';
import { findAuthUserByEmail, findAuthUserById, updateAuthUserEmail, updateAuthUserPassword } from './users.js';
import { issueEmailChangeToken, issuePasswordResetToken, issueSessionToken, verifyToken } from './tokens.js';

interface AuthLoginResult {
  userId: string;
  sessionToken: string;
  mustChangePassword: boolean;
}

interface AuthSessionResult {
  userId: string;
  mustChangePassword: boolean;
}

interface PasswordResetRequestResult {
  sent: boolean;
  message: string;
  resetLink?: string;
}

interface EmailChangeRequestResult {
  success: boolean;
  message: string;
  confirmationLink?: string;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function requireSessionToken(sessionToken: string): string {
  const normalized = sessionToken.trim();
  if (normalized) {
    return normalized;
  }

  throw new HttpError(401, 'Session is invalid.', {
    service: 'auth',
    code: 'AUTH_SESSION_INVALID',
    retryable: false,
  });
}

function buildResetLink(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
}

function buildEmailChangeLink(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, '')}/account/settings?emailChangeToken=${encodeURIComponent(token)}`;
}

function buildPasswordResetBody(link: string): string {
  return [
    'A password reset was requested for your account.',
    '',
    `Use this link to reset your password: ${link}`,
    '',
    'If you did not request this reset, please ignore this email.',
  ].join('\n');
}

function buildEmailChangeBody(link: string): string {
  return [
    'An email change was requested for your account.',
    '',
    `Use this link to confirm your new email address: ${link}`,
    '',
    'If you did not request this change, you can ignore this email.',
  ].join('\n');
}

export async function login(email: string, password: string): Promise<AuthLoginResult> {
  const user = await findAuthUserByEmail(normalizeEmail(email));
  if (!user || user.password !== password) {
    throw new HttpError(401, 'Invalid email or password.', {
      service: 'auth',
      code: 'AUTH_INVALID_CREDENTIALS',
      retryable: false,
    });
  }

  return {
    userId: user.id,
    sessionToken: issueSessionToken(user.id, user.mustChangePassword),
    mustChangePassword: user.mustChangePassword,
  };
}

export async function resolveSession(sessionToken: string): Promise<AuthSessionResult> {
  const payload = verifyToken(requireSessionToken(sessionToken), 'session');
  const user = await findAuthUserById(payload.userId);
  if (!user) {
    throw new HttpError(401, 'Session is invalid.', {
      service: 'auth',
      code: 'AUTH_SESSION_INVALID',
      retryable: false,
    });
  }

  return {
    userId: user.id,
    mustChangePassword: user.mustChangePassword,
  };
}

export async function requestPasswordReset(email: string, origin: string): Promise<PasswordResetRequestResult> {
  const user = await findAuthUserByEmail(normalizeEmail(email));
  if (!user) {
    return {
      sent: true,
      message: 'If the account exists, a reset email was sent.',
    };
  }

  const token = issuePasswordResetToken(user.id);
  const resetLink = buildResetLink(origin, token);

  try {
    const delivered = await sendPlainTextEmail(user.email, 'Password reset request', buildPasswordResetBody(resetLink));
    return {
      sent: delivered,
      message: delivered
        ? `A password reset email was sent to ${user.email}.`
        : `Password reset link created for ${user.email}.`,
      resetLink: delivered ? undefined : resetLink,
    };
  } catch {
    return {
      sent: true,
      message: `Password reset link created for ${user.email}.`,
      resetLink,
    };
  }
}

export async function resetPassword(token: string, nextPassword: string): Promise<void> {
  const payload = verifyToken(token, 'password-reset');
  const user = await findAuthUserById(payload.userId);
  if (!user) {
    throw new HttpError(404, 'Could not find user for this reset link.', {
      service: 'auth',
      code: 'AUTH_USER_NOT_FOUND',
      retryable: false,
    });
  }

  await updateAuthUserPassword(user, nextPassword, false);
}

export async function requestEmailChange(sessionToken: string, nextEmail: string, currentPassword: string, origin: string): Promise<EmailChangeRequestResult> {
  const session = verifyToken(requireSessionToken(sessionToken), 'session');
  const user = await findAuthUserById(session.userId);
  if (!user) {
    throw new HttpError(404, 'Current user was not found.', {
      service: 'auth',
      code: 'AUTH_USER_NOT_FOUND',
      retryable: false,
    });
  }

  const normalizedEmail = normalizeEmail(nextEmail);
  if (!normalizedEmail) {
    throw new HttpError(400, 'Email is required.', {
      service: 'auth',
      code: 'AUTH_EMAIL_REQUIRED',
      retryable: false,
    });
  }

  if (user.password !== currentPassword) {
    throw new HttpError(400, 'Current password is incorrect.', {
      service: 'auth',
      code: 'AUTH_PASSWORD_INCORRECT',
      retryable: false,
    });
  }

  const duplicate = await findAuthUserByEmail(normalizedEmail);
  if (duplicate && duplicate.id !== user.id) {
    throw new HttpError(400, 'Another user already uses that email.', {
      service: 'auth',
      code: 'AUTH_EMAIL_ALREADY_IN_USE',
      retryable: false,
    });
  }

  const token = issueEmailChangeToken(user.id, normalizedEmail);
  const confirmationLink = buildEmailChangeLink(origin, token);

  try {
    const delivered = await sendPlainTextEmail(normalizedEmail, 'Confirm your email change', buildEmailChangeBody(confirmationLink));
    return {
      success: true,
      message: delivered
        ? `Confirmation email sent to ${normalizedEmail}.`
        : `Confirmation link created for ${normalizedEmail}.`,
      confirmationLink: delivered ? undefined : confirmationLink,
    };
  } catch {
    return {
      success: true,
      message: `Confirmation link created for ${normalizedEmail}.`,
      confirmationLink,
    };
  }
}

export async function confirmEmailChange(token: string): Promise<void> {
  const payload = verifyToken(token, 'email-change');
  const user = await findAuthUserById(payload.userId);
  if (!user) {
    throw new HttpError(404, 'Current user was not found.', {
      service: 'auth',
      code: 'AUTH_USER_NOT_FOUND',
      retryable: false,
    });
  }

  const duplicate = await findAuthUserByEmail(payload.nextEmail);
  if (duplicate && duplicate.id !== user.id) {
    throw new HttpError(400, 'Another user already uses this email address.', {
      service: 'auth',
      code: 'AUTH_EMAIL_ALREADY_IN_USE',
      retryable: false,
    });
  }

  await updateAuthUserEmail(user, payload.nextEmail);
}

export async function updatePassword(sessionToken: string, currentPassword: string | undefined, nextPassword: string): Promise<{ mustChangePassword: boolean }> {
  const payload = verifyToken(requireSessionToken(sessionToken), 'session');
  const user = await findAuthUserById(payload.userId);
  if (!user) {
    throw new HttpError(404, 'Current user was not found.', {
      service: 'auth',
      code: 'AUTH_USER_NOT_FOUND',
      retryable: false,
    });
  }

  if (currentPassword) {
    if (user.password !== currentPassword) {
      throw new HttpError(400, 'Current password is incorrect.', {
        service: 'auth',
        code: 'AUTH_PASSWORD_INCORRECT',
        retryable: false,
      });
    }
    if (currentPassword === nextPassword) {
      throw new HttpError(400, 'New password must be different from your current password.', {
        service: 'auth',
        code: 'AUTH_PASSWORD_UNCHANGED',
        retryable: false,
      });
    }
  } else if (!user.mustChangePassword) {
    throw new HttpError(400, 'Password update is not required for this account.', {
      service: 'auth',
      code: 'AUTH_PASSWORD_CHANGE_NOT_REQUIRED',
      retryable: false,
    });
  }

  await updateAuthUserPassword(user, nextPassword, false);
  return { mustChangePassword: false };
}