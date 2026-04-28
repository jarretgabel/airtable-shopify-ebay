import type { EquipmentIdentification } from '@/services/equipmentAI';
import { getDirectAIProvider, identifyEquipmentDirect, type AIProviderStatus } from '@/services/aiDirect';
import { isAppApiHttpError } from './errors';
import { getLambdaAiProviderHint, isLambdaAiEnabled } from './flags';
import { postJson } from './http';

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
  if (!isLambdaAiEnabled()) {
    return identifyEquipmentDirect(base64, mimeType);
  }

  try {
    return await postJson<EquipmentIdentification>('/api/ai/identify-equipment', { base64, mimeType });
  } catch (error) {
    throw toAiError(error);
  }
}

export function getAIProvider(): AIProviderStatus {
  if (!isLambdaAiEnabled()) {
    return getDirectAIProvider();
  }

  const providerHint = getLambdaAiProviderHint();
  if (providerHint !== 'none') {
    return { provider: providerHint, key: '' };
  }

  return getDirectAIProvider();
}