import {
  getAIProvider as getAppApiAIProvider,
  identifyEquipment as identifyEquipmentViaAppApi,
} from '@/services/app-api/ai';

export interface EquipmentIdentification {
  equipment_type: string;
  brand: string;
  model: string;
  year_range: string;
  description: string;
  condition_notes: string;
  suggested_sku: string;
  suggested_tags: string[];
  shopify_product_type: string;
  specifications: Record<string, string>;
  msrp_original: string;
  price_range_sold: string;
}

export async function identifyEquipment(
  base64: string,
  mimeType: string = 'image/jpeg',
): Promise<EquipmentIdentification> {
  return identifyEquipmentViaAppApi(base64, mimeType);
}

/**
 * Returns which AI provider will be used based on available env vars.
 * Priority: GitHub Models > OpenAI
 */
export function getAIProvider(): { provider: 'github' | 'openai' | 'backend' | 'none'; key: string } {
  return getAppApiAIProvider();
}

/** Read a File as base64 string + mimeType */
export function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const comma = dataUrl.indexOf(',');
      const header = dataUrl.slice(0, comma);
      const mimeType = header.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg';
      resolve({ base64: dataUrl.slice(comma + 1), mimeType });
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
