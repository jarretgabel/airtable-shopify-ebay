import type { EquipmentIdentification } from '@/services/equipmentAI';
import { isAppApiHttpError } from './errors';
import { getLambdaAiProviderHint } from './flags';
import { postJson } from './http';

interface AIProviderStatus {
  provider: 'github' | 'openai' | 'backend' | 'none';
  key: string;
}

function toAiError(error: unknown): Error {
  if (isAppApiHttpError(error)) {
    return new Error(error.message);
  }

  return error instanceof Error ? error : new Error(String(error));
}

export async function identifyEquipment(
  base64: string,
  mimeType = 'image/jpeg',
): Promise<EquipmentIdentification> {
  try {
    return await postJson<EquipmentIdentification>('/api/ai/identify-equipment', { base64, mimeType });
  } catch (error) {
    throw toAiError(error);
  }
}

export async function generateListingDescription(
  fields: Record<string, string>,
  existingDescription = '',
): Promise<string> {
  try {
    const result = await postJson<{ description: string }>('/api/ai/generate-description', {
      fields,
      existingDescription,
    });
    if (typeof result.description !== 'string' || !result.description.trim()) {
      throw new Error('The AI service returned no description.');
    }
    return result.description;
  } catch (error) {
    throw toAiError(error);
  }
}

export async function generateListingTitle(
  fields: Record<string, string>,
  existingTitle = '',
): Promise<string> {
  try {
    const result = await postJson<{ title: string }>('/api/ai/generate-description', {
      kind: 'title',
      fields,
      existingDescription: existingTitle,
    });
    if (typeof result.title !== 'string' || !result.title.trim()) {
      throw new Error('The AI service returned no title. Restart the API so it has the latest version.');
    }
    return result.title;
  } catch (error) {
    throw toAiError(error);
  }
}

export async function generateListingSeoText(
  kind: 'seoTitle' | 'seoDescription',
  fields: Record<string, string>,
  existing = '',
): Promise<string> {
  try {
    const result = await postJson<{ seoTitle?: string; seoDescription?: string }>('/api/ai/generate-description', {
      kind,
      fields,
      existingDescription: existing,
    });
    const text = kind === 'seoTitle' ? result.seoTitle : result.seoDescription;
    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('The AI service returned no text. Restart the API so it has the latest version.');
    }
    return text;
  } catch (error) {
    throw toAiError(error);
  }
}

export interface GeneratedKeyFeatureRow {
  feature: string;
  value: string;
}

export async function generateListingKeyFeatures(
  fields: Record<string, string>,
  existingFeatureNames: string[] = [],
  excludedFeatureNames: string[] = [],
): Promise<GeneratedKeyFeatureRow[]> {
  try {
    const result = await postJson<{ features: GeneratedKeyFeatureRow[] }>('/api/ai/generate-description', {
      kind: 'features',
      fields,
      existingFeatureNames,
      excludedFeatureNames,
    });
    if (!Array.isArray(result.features)) {
      throw new Error('The AI service returned no features. Restart the API so it has the latest version.');
    }
    return result.features;
  } catch (error) {
    throw toAiError(error);
  }
}

export function getAIProvider(): AIProviderStatus {
  const providerHint = getLambdaAiProviderHint();
  if (providerHint !== 'none') {
    return { provider: providerHint, key: '' };
  }

  return { provider: 'backend', key: '' };
}