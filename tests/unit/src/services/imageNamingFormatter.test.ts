import { buildImageAltText } from '@/services/imageNamingFormatter';

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
