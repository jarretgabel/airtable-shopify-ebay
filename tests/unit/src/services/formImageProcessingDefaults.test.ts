import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_FORM_IMAGE_PROCESSING_DEFAULTS,
  loadFormImageProcessingDefaults,
} from '@/services/formImageProcessingDefaults';

describe('formImageProcessingDefaults', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('migrates legacy Resolution AV watermark variants to the current default', () => {
    window.localStorage.setItem('form-image-processing-defaults:v1', JSON.stringify({
      maxPx: 1200,
      quality: 85,
      watermarkEnabled: true,
      watermarkText: '© Resolution AV',
      watermarkPos: 'bottom-right',
      crop: { left: 0, top: 0, right: 0, bottom: 0 },
    }));

    const loaded = loadFormImageProcessingDefaults();

    expect(loaded.watermarkText).toBe(DEFAULT_FORM_IMAGE_PROCESSING_DEFAULTS.watermarkText);
    expect(loaded.watermarkText).toBe('© Resolution Audio Video');
  });

  it('preserves non-legacy custom watermark text', () => {
    window.localStorage.setItem('form-image-processing-defaults:v1', JSON.stringify({
      maxPx: 1200,
      quality: 85,
      watermarkEnabled: true,
      watermarkText: 'Studio Collection ©',
      watermarkPos: 'bottom-right',
      crop: { left: 0, top: 0, right: 0, bottom: 0 },
    }));

    const loaded = loadFormImageProcessingDefaults();

    expect(loaded.watermarkText).toBe('Studio Collection ©');
  });
});
