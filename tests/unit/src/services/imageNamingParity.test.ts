import { describe, expect, it } from 'vitest';
import { buildFallbackImageFilename } from '@/services/imageNamingFormatter';
import { buildSopFallbackFilename } from '@shared/imageNamingRules';
import { normalizeProductImageFilename } from '@shared/imageNaming';

describe('image naming parity', () => {
  it('keeps frontend and AWS fallback normalization outputs identical', () => {
    const fixtures = [
      'IMG_4829 Final Edit V2.JPG',
      'Bowers Wilkins 802D3 Rear Panel.jpeg',
      'mcintosh-mc275-resolutionav.jpg',
      'hero.jpg',
      'Nikon_DSC1234 Front View.png',
      'Accuphase E800s Class A Integrated Amplifier.jpg',
    ];

    for (const input of fixtures) {
      const frontendOutput = buildFallbackImageFilename(input);
      expect(frontendOutput).toBe(buildSopFallbackFilename(input));
      expect(frontendOutput).toBe(normalizeProductImageFilename(input));
    }
  });
});
