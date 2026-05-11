import {
  DEFAULT_OPTIONS,
  type CropInsetsPercent,
  type ProcessingOptions,
  type WatermarkPosition,
} from '@/services/imageProcessor';

const STORAGE_KEY = 'form-image-processing-defaults:v1';

export interface FormImageProcessingDefaults {
  maxPx: number;
  quality: number;
  watermarkEnabled: boolean;
  watermarkText: string;
  watermarkPos: WatermarkPosition;
  crop: CropInsetsPercent;
}

export const DEFAULT_FORM_IMAGE_PROCESSING_DEFAULTS: FormImageProcessingDefaults = {
  maxPx: DEFAULT_OPTIONS.maxPx,
  quality: DEFAULT_OPTIONS.quality,
  watermarkEnabled: DEFAULT_OPTIONS.watermarkEnabled,
  watermarkText: DEFAULT_OPTIONS.watermarkText,
  watermarkPos: DEFAULT_OPTIONS.watermarkPos,
  crop: DEFAULT_OPTIONS.crop,
};

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normalizeCrop(crop: unknown): CropInsetsPercent {
  if (!crop || typeof crop !== 'object') return { ...DEFAULT_FORM_IMAGE_PROCESSING_DEFAULTS.crop };

  const record = crop as Record<string, unknown>;
  return {
    left: typeof record.left === 'number' ? record.left : 0,
    top: typeof record.top === 'number' ? record.top : 0,
    right: typeof record.right === 'number' ? record.right : 0,
    bottom: typeof record.bottom === 'number' ? record.bottom : 0,
  };
}

function normalizeDefaults(raw: unknown): FormImageProcessingDefaults {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_FORM_IMAGE_PROCESSING_DEFAULTS, crop: { ...DEFAULT_FORM_IMAGE_PROCESSING_DEFAULTS.crop } };
  }

  const record = raw as Record<string, unknown>;
  return {
    maxPx: typeof record.maxPx === 'number' ? record.maxPx : DEFAULT_FORM_IMAGE_PROCESSING_DEFAULTS.maxPx,
    quality: typeof record.quality === 'number' ? record.quality : DEFAULT_FORM_IMAGE_PROCESSING_DEFAULTS.quality,
    watermarkEnabled: typeof record.watermarkEnabled === 'boolean' ? record.watermarkEnabled : DEFAULT_FORM_IMAGE_PROCESSING_DEFAULTS.watermarkEnabled,
    watermarkText: typeof record.watermarkText === 'string' ? record.watermarkText : DEFAULT_FORM_IMAGE_PROCESSING_DEFAULTS.watermarkText,
    watermarkPos: isWatermarkPosition(record.watermarkPos) ? record.watermarkPos : DEFAULT_FORM_IMAGE_PROCESSING_DEFAULTS.watermarkPos,
    crop: normalizeCrop(record.crop),
  };
}

function isWatermarkPosition(value: unknown): value is WatermarkPosition {
  return value === 'bottom-right' || value === 'bottom-left' || value === 'bottom-center' || value === 'top-right';
}

export function loadFormImageProcessingDefaults(): FormImageProcessingDefaults {
  if (!canUseLocalStorage()) {
    return { ...DEFAULT_FORM_IMAGE_PROCESSING_DEFAULTS, crop: { ...DEFAULT_FORM_IMAGE_PROCESSING_DEFAULTS.crop } };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_FORM_IMAGE_PROCESSING_DEFAULTS, crop: { ...DEFAULT_FORM_IMAGE_PROCESSING_DEFAULTS.crop } };
    }

    return normalizeDefaults(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_FORM_IMAGE_PROCESSING_DEFAULTS, crop: { ...DEFAULT_FORM_IMAGE_PROCESSING_DEFAULTS.crop } };
  }
}

export function saveFormImageProcessingDefaults(defaults: FormImageProcessingDefaults) {
  if (!canUseLocalStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
}

export function buildProcessingOptions(
  defaults: FormImageProcessingDefaults,
  outputFilename?: string,
): ProcessingOptions {
  return {
    ...DEFAULT_OPTIONS,
    ...defaults,
    crop: { ...defaults.crop },
    outputFilename,
  };
}