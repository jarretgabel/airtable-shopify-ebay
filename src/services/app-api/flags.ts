const TRUTHY_VALUES = new Set(['1', 'true', 'yes', 'on']);
const AI_PROVIDER_HINTS = new Set(['github', 'openai', 'none']);

function isEnabled(value: string | undefined): boolean {
  return typeof value === 'string' && TRUTHY_VALUES.has(value.trim().toLowerCase());
}

export function isLambdaJotformEnabled(): boolean {
  return isEnabled(import.meta.env.VITE_USE_LAMBDA_JOTFORM);
}

export function isLambdaAirtableEnabled(): boolean {
  return isEnabled(import.meta.env.VITE_USE_LAMBDA_AIRTABLE);
}

export function isLambdaAiEnabled(): boolean {
  return isEnabled(import.meta.env.VITE_USE_LAMBDA_AI);
}

export function isLambdaGmailEnabled(): boolean {
  return isEnabled(import.meta.env.VITE_USE_LAMBDA_GMAIL);
}

export function isLambdaShopifyEnabled(): boolean {
  return isEnabled(import.meta.env.VITE_USE_LAMBDA_SHOPIFY);
}

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