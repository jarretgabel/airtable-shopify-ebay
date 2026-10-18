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
    return result.description;
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