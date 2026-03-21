function readEnv(name: string): string {
  const value = import.meta.env[name as keyof ImportMetaEnv];
  return typeof value === 'string' ? value.trim() : '';
}

export function requireEnv(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function requireOneOfEnv(names: string[]): string {
  for (const name of names) {
    const value = readEnv(name);
    if (value) return value;
  }

  throw new Error(`Missing required environment variable. Set one of: ${names.join(', ')}`);
}

export function checkOptionalEnv(name: string): string {
  return readEnv(name);
}

export function logMissingOptionalEnv(names: string[]): void {
  if (typeof window === 'undefined') return;

  const missing = names.filter((name) => !readEnv(name));
  if (missing.length) {
    console.warn(`[env] Missing optional environment variables: ${missing.join(', ')}`);
  }
}
