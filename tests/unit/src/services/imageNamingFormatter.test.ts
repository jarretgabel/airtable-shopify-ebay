import { buildImageAltText, buildFallbackImageFilename, buildImageFilename } from '@/services/imageNamingFormatter';

describe('buildImageFilename', () => {
  it('builds SOP-compliant filenames from naming context and image role', () => {
    const result = buildImageFilename(
      {
        brand: 'McIntosh',
        model: 'MC275',
        productType: 'Tube Amplifier',
      },
      {
        role: 'rear',
      },
    );

    expect(result.filename).toBe('mcintosh-mc275-tube-amplifier-rear-panel.jpg');
    expect(result.warnings).toEqual([]);
  });

  it('enforces lowercase kebab-case and removes camera-style source tokens', () => {
    const fallback = buildFallbackImageFilename('IMG_4829 Final Edit V2.JPG');
    expect(fallback).toBe('final-edit-product-hero-image.jpg');
  });
});

describe('buildImageAltText', () => {
  it('builds role-aware alt text from naming context and predefined role', () => {
    const altText = buildImageAltText(
      {
        brand: 'McIntosh',
        model: 'MC225',
        productType: 'Stereo Tube Power Amplifier',
      },
      {
        role: 'side',
      },
    );

    expect(altText).toBe('McIntosh MC225 Stereo Tube Power Amplifier Side View');
  });

  it('uses custom role label text when custom image role is selected', () => {
    const altText = buildImageAltText(
      {
        brand: 'McIntosh',
        model: 'MC225',
        productType: 'Stereo Tube Power Amplifier',
      },
      {
        role: 'custom',
        customRole: 'left side',
      },
    );

    expect(altText).toBe('McIntosh MC225 Stereo Tube Power Amplifier Left Side');
  });
});
