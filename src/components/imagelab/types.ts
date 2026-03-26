import type { EquipmentIdentification } from '@/services/equipmentAI';
import type { ProcessedImage } from '@/services/imageProcessor';

export type ItemStatus = 'idle' | 'identifying' | 'identified' | 'processing' | 'done' | 'error';

export type ImageUploadStatus = 'idle' | 'uploading' | 'done' | 'error';

export interface ImageUploadState {
  status: ImageUploadStatus;
  url?: string;
  error?: string;
  assetLabel?: string;
}

export interface ImageItem {
  id: string;
  file: File;
  previewUrl: string;
  status: ItemStatus;
  error?: string;
  aiResult?: EquipmentIdentification;
  processed?: ProcessedImage;
  uploads?: {
    shopify?: ImageUploadState;
    ebay?: ImageUploadState;
  };
}

export interface ImageLabSessionStats {
  total: number;
  identified: number;
  processed: number;
  brands: string[];
  savedBytes: number;
  estLow: number;
  estHigh: number;
  hasPricing: boolean;
  fmtUSD: (n: number) => string;
}
