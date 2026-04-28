export function requireSecret(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getOptionalSecret(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}