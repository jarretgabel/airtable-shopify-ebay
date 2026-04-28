const AI_PROVIDER_HINTS = new Set(['github', 'openai', 'none']);

export function getLambdaAiProviderHint(): 'github' | 'openai' | 'none' {
  const value = (import.meta.env.VITE_AI_PROVIDER || '').trim().toLowerCase();
  if (AI_PROVIDER_HINTS.has(value)) {
    return value as 'github' | 'openai' | 'none';
  }

  return 'none';
}

export function getAppApiBaseUrl(): string {
  return (import.meta.env.VITE_APP_API_BASE_URL || '').trim();
}