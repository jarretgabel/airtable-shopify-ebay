import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

const PASSWORD_FIELD_PAYLOAD_PREFIX = '__LCC_PASSWORD__:';
const PASSWORD_HASH_SCHEME = 'pbkdf2-sha256';
const PASSWORD_HASH_ITERATIONS = 210000;
const PASSWORD_HASH_KEY_LENGTH = 32;

interface StoredPasswordPayload {
  scheme?: string;
  iterations?: number;
  salt?: string;
  hash?: string;
  password?: string;
  mustChangePassword?: boolean;
}

export interface StoredPasswordState {
  mustChangePassword?: boolean;
  legacyPassword?: string;
  scheme: 'legacy' | typeof PASSWORD_HASH_SCHEME;
  iterations?: number;
  salt?: string;
  hash?: string;
}

function decodeBase64(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    return Buffer.from(trimmed, 'base64').toString('utf8');
  } catch {
    return trimmed;
  }
}

function encodeBase64(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64');
}

function buildPasswordHash(password: string, salt: string, iterations: number): string {
  return pbkdf2Sync(password, salt, iterations, PASSWORD_HASH_KEY_LENGTH, 'sha256').toString('base64');
}

export function parseStoredPasswordField(value: unknown): StoredPasswordState {
  const decoded = decodeBase64(typeof value === 'string' ? value : '');
  if (!decoded.startsWith(PASSWORD_FIELD_PAYLOAD_PREFIX)) {
    return {
      legacyPassword: decoded,
      scheme: 'legacy',
    };
  }

  try {
    const parsed = JSON.parse(decoded.slice(PASSWORD_FIELD_PAYLOAD_PREFIX.length)) as StoredPasswordPayload;
    if (
      parsed.scheme === PASSWORD_HASH_SCHEME
      && typeof parsed.salt === 'string'
      && typeof parsed.hash === 'string'
    ) {
      return {
        scheme: PASSWORD_HASH_SCHEME,
        iterations: typeof parsed.iterations === 'number' ? parsed.iterations : PASSWORD_HASH_ITERATIONS,
        salt: parsed.salt,
        hash: parsed.hash,
        mustChangePassword: typeof parsed.mustChangePassword === 'boolean' ? parsed.mustChangePassword : undefined,
      };
    }

    if (typeof parsed.password === 'string') {
      return {
        legacyPassword: parsed.password,
        scheme: 'legacy',
        mustChangePassword: typeof parsed.mustChangePassword === 'boolean' ? parsed.mustChangePassword : undefined,
      };
    }
  } catch {
    // Fall through to legacy parsing below.
  }

  return {
    legacyPassword: decoded,
    scheme: 'legacy',
  };
}

export function serializePasswordField(password: string, mustChangePassword: boolean): string {
  const salt = randomBytes(16).toString('base64');
  const hash = buildPasswordHash(password, salt, PASSWORD_HASH_ITERATIONS);

  return encodeBase64(`${PASSWORD_FIELD_PAYLOAD_PREFIX}${JSON.stringify({
    scheme: PASSWORD_HASH_SCHEME,
    iterations: PASSWORD_HASH_ITERATIONS,
    salt,
    hash,
    mustChangePassword,
  } satisfies StoredPasswordPayload)}`);
}

export function verifyStoredPassword(candidatePassword: string, state: StoredPasswordState): boolean {
  if (state.scheme === 'legacy') {
    return state.legacyPassword === candidatePassword;
  }

  const expectedHash = state.hash;
  const salt = state.salt;
  const iterations = state.iterations ?? PASSWORD_HASH_ITERATIONS;
  if (!expectedHash || !salt) {
    return false;
  }

  const candidateHash = buildPasswordHash(candidatePassword, salt, iterations);
  const expectedBuffer = Buffer.from(expectedHash, 'base64');
  const candidateBuffer = Buffer.from(candidateHash, 'base64');
  if (expectedBuffer.length !== candidateBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, candidateBuffer);
}

export function needsPasswordUpgrade(state: StoredPasswordState): boolean {
  return state.scheme === 'legacy';
}