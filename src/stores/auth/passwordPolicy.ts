export const PASSWORD_POLICY_MESSAGE = 'Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.';

export function validatePasswordPolicy(password: string): string | null {
  const trimmed = password.trim();
  const strongEnough =
    trimmed.length >= 8
    && /[a-z]/.test(trimmed)
    && /[A-Z]/.test(trimmed)
    && /\d/.test(trimmed)
    && /[^A-Za-z0-9]/.test(trimmed);

  if (!strongEnough) {
    return PASSWORD_POLICY_MESSAGE;
  }

  return null;
}