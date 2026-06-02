import { HttpError } from '../../shared/errors.js';
import type { UserRole } from '../../shared/appPages.js';
import { sendPlainTextEmail } from '../gmail/client.js';
import { findAuthUserByEmail, findAuthUserById, updateAuthUserEmail, updateAuthUserPassword, type AuthUserRecord } from './users.js';
import { needsPasswordUpgrade, verifyStoredPassword } from './passwords.js';
import { issueEmailChangeToken, issuePasswordResetToken, issueSessionToken, verifyToken } from './tokens.js';

interface AuthLoginResult {
  userId: string;
  airtableRecordId: string;
  name: string;
  email: string;
  sessionToken: string;
  mustChangePassword: boolean;
  role: UserRole;
  allowedPages: string[];
}

interface AuthSessionResult {
  userId: string;
  airtableRecordId: string;
  name: string;
  email: string;
  mustChangePassword: boolean;
  role: UserRole;
  allowedPages: string[];
}

interface SessionTokenClaims {
  userId: string;
  airtableRecordId: string;
  name: string;
  email: string;
  role: UserRole;
  allowedPages: string[];
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

export const authServiceDependencies = {
  findAuthUserByEmail,
  findAuthUserById,
  updateAuthUserEmail,
  updateAuthUserPassword,
  sendPlainTextEmail,
};

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

function getSessionTokenClaims(sessionToken: string): SessionTokenClaims {
  const payload = verifyToken(requireSessionToken(sessionToken), 'session');
  return {
    userId: payload.userId,
    airtableRecordId: payload.airtableRecordId,
    name: payload.name,
    email: payload.email,
    role: payload.role,
    allowedPages: payload.allowedPages,
    mustChangePassword: payload.mustChangePassword,
  };
}

function hasEmbeddedSessionClaims(payload: SessionTokenClaims): boolean {
  return Boolean(payload.airtableRecordId && payload.name && payload.email && payload.allowedPages.length > 0);
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
  const user = await authServiceDependencies.findAuthUserByEmail(normalizeEmail(email));
  if (!user || !verifyStoredPassword(password, user.passwordState)) {
    throw new HttpError(401, 'Invalid email or password.', {
      service: 'auth',
      code: 'AUTH_INVALID_CREDENTIALS',
      retryable: false,
    });
  }

  if (needsPasswordUpgrade(user.passwordState)) {
    await authServiceDependencies.updateAuthUserPassword(user, password, user.mustChangePassword);
  }

  return {
    userId: user.id,
    airtableRecordId: user.airtableRecordId,
    name: user.name,
    email: user.email,
    sessionToken: issueSessionToken({
      userId: user.id,
      airtableRecordId: user.airtableRecordId,
      name: user.name,
      email: user.email,
      role: user.role,
      allowedPages: user.allowedPages,
      mustChangePassword: user.mustChangePassword,
    }),
    mustChangePassword: user.mustChangePassword,
    role: user.role,
    allowedPages: user.allowedPages,
  };
}

export async function resolveSession(sessionToken: string): Promise<AuthSessionResult> {
  const payload = getSessionTokenClaims(sessionToken);
  if (hasEmbeddedSessionClaims(payload)) {
    return {
      userId: payload.userId,
      airtableRecordId: payload.airtableRecordId,
      name: payload.name,
      email: payload.email,
      mustChangePassword: payload.mustChangePassword,
      role: payload.role,
      allowedPages: payload.allowedPages,
    };
  }

  const user = await authServiceDependencies.findAuthUserById(payload.userId);
  if (!user) {
    throw new HttpError(401, 'Session is invalid.', {
      service: 'auth',
      code: 'AUTH_SESSION_INVALID',
      retryable: false,
    });
  }

  return {
    userId: payload.userId,
    airtableRecordId: user.airtableRecordId,
    name: user.name,
    email: user.email,
    mustChangePassword: payload.mustChangePassword,
    role: payload.role,
    allowedPages: payload.allowedPages,
  };
}

export async function requestPasswordReset(email: string, origin: string): Promise<PasswordResetRequestResult> {
  const user = await authServiceDependencies.findAuthUserByEmail(normalizeEmail(email));
  if (!user) {
    return {
      sent: true,
      message: 'If the account exists, a reset email was sent.',
    };
  }

  const token = issuePasswordResetToken(user.id);
  const resetLink = buildResetLink(origin, token);

  try {
    const delivered = await authServiceDependencies.sendPlainTextEmail(user.email, 'Password reset request', buildPasswordResetBody(resetLink));
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
  const user = await authServiceDependencies.findAuthUserById(payload.userId);
  if (!user) {
    throw new HttpError(404, 'Could not find user for this reset link.', {
      service: 'auth',
      code: 'AUTH_USER_NOT_FOUND',
      retryable: false,
    });
  }

  await authServiceDependencies.updateAuthUserPassword(user, nextPassword, false);
}

export async function requestEmailChange(sessionToken: string, nextEmail: string, currentPassword: string, origin: string): Promise<EmailChangeRequestResult> {
  const session = getSessionTokenClaims(sessionToken);
  const user = await authServiceDependencies.findAuthUserById(session.userId);
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

  if (!verifyStoredPassword(currentPassword, user.passwordState)) {
    throw new HttpError(400, 'Current password is incorrect.', {
      service: 'auth',
      code: 'AUTH_PASSWORD_INCORRECT',
      retryable: false,
    });
  }

  if (needsPasswordUpgrade(user.passwordState)) {
    await authServiceDependencies.updateAuthUserPassword(user, currentPassword, user.mustChangePassword);
  }

  const duplicate = await authServiceDependencies.findAuthUserByEmail(normalizedEmail);
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
    const delivered = await authServiceDependencies.sendPlainTextEmail(normalizedEmail, 'Confirm your email change', buildEmailChangeBody(confirmationLink));
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
  const user = await authServiceDependencies.findAuthUserById(payload.userId);
  if (!user) {
    throw new HttpError(404, 'Current user was not found.', {
      service: 'auth',
      code: 'AUTH_USER_NOT_FOUND',
      retryable: false,
    });
  }

  const duplicate = await authServiceDependencies.findAuthUserByEmail(payload.nextEmail);
  if (duplicate && duplicate.id !== user.id) {
    throw new HttpError(400, 'Another user already uses this email address.', {
      service: 'auth',
      code: 'AUTH_EMAIL_ALREADY_IN_USE',
      retryable: false,
    });
  }

  await authServiceDependencies.updateAuthUserEmail(user, payload.nextEmail);
}

export async function updatePassword(sessionToken: string, currentPassword: string | undefined, nextPassword: string): Promise<{ mustChangePassword: boolean }> {
  const payload = getSessionTokenClaims(sessionToken);
  const user = await authServiceDependencies.findAuthUserById(payload.userId);
  if (!user) {
    throw new HttpError(404, 'Current user was not found.', {
      service: 'auth',
      code: 'AUTH_USER_NOT_FOUND',
      retryable: false,
    });
  }

  if (currentPassword) {
    if (!verifyStoredPassword(currentPassword, user.passwordState)) {
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

  await authServiceDependencies.updateAuthUserPassword(user, nextPassword, false);
  return { mustChangePassword: false };
}