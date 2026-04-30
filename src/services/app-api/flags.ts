import { checkOptionalEnv } from '@/config/runtimeEnv';

const AI_PROVIDER_HINTS = new Set(['github', 'openai', 'none']);

export function getLambdaAiProviderHint(): 'github' | 'openai' | 'none' {
  const value = checkOptionalEnv('VITE_AI_PROVIDER').toLowerCase();
  if (AI_PROVIDER_HINTS.has(value)) {
    return value as 'github' | 'openai' | 'none';
  }

  return 'none';
}

export function getAppApiBaseUrl(): string {
  return checkOptionalEnv('VITE_APP_API_BASE_URL');
}