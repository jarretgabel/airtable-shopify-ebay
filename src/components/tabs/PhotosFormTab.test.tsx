import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PhotosFormTab } from '@/components/tabs/PhotosFormTab';

const {
  loadPhotosFormOptionSetsMock,
  loadPhotosFormValuesMock,
  submitPhotosFormMock,
} = vi.hoisted(() => ({
  loadPhotosFormOptionSetsMock: vi.fn(),
  loadPhotosFormValuesMock: vi.fn(),
  submitPhotosFormMock: vi.fn(),
}));

vi.mock('@/services/photosForm', async () => {
  const actual = await vi.importActual<typeof import('@/services/photosForm')>('@/services/photosForm');
  return {
    ...actual,
    loadPhotosFormOptionSets: loadPhotosFormOptionSetsMock,
    loadPhotosFormValues: loadPhotosFormValuesMock,
    submitPhotosForm: submitPhotosFormMock,
  };
});

describe('PhotosFormTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadPhotosFormOptionSetsMock.mockResolvedValue({
      Status: ["Photo'd"],
      'Component Type': ['Receiver'],
      'Audiogon Rating': ['7/10'],
      'Original Box': ['No'],
      Manual: ['Included'],
      Remote: ['No'],
      'Power Cable': ['Included'],
    });
    loadPhotosFormValuesMock.mockResolvedValue({
      source: 'used-gear-workflow',
      customerReference: {
        cosmeticNotes: 'Seller noted cabinet scratches.',
        functionalNotes: '',
        inclusionNotes: 'Manual and power cable included.',
        submittedPhotosNotes: '',
      },
      stageContext: {
        inventoryNotes: 'Capture the serial plate and top cover.',
        testingNotes: 'Passed tuner test.',
        existingAttachments: [{ id: 'att-1', url: 'https://example.com/hero.jpg', filename: 'hero.jpg' }],
      },
      values: {
        sku: 'SKU-400',
        make: 'Sansui',
        model: '9090DB',
        componentType: 'Receiver',
        originalBox: 'No',
        manual: 'Included',
        remote: 'No',
        powerCable: 'Included',
        additionalItems: 'Rack handles',
        audiogonRating: '7/10',
        cosmeticConditionNotes: 'Front panel is strong.',
        imageFiles: [],
        photoDate: '2026-05-07',
        status: "Photo'd",
      },
    });
    submitPhotosFormMock.mockResolvedValue({
      recordId: 'rec-photo',
      sku: 'SKU-400',
      action: 'updated',
    });
  });

  it('requires included-item confirmations before allowing photo-stage submit', async () => {
    render(<PhotosFormTab recordId="rec-photo" />);

    await screen.findByText('Photos');

    fireEvent.click(screen.getByRole('button', { name: 'Save Photos' }));

    await screen.findByText('Confirm that the following included items were checked and photographed: Manual, Power Cable, Additional Items.');
    expect(submitPhotosFormMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('I checked and photographed Manual for this unit.'));
    fireEvent.click(screen.getByLabelText('I checked and photographed Power Cable for this unit.'));
    fireEvent.click(screen.getByLabelText('I checked and photographed Additional Items for this unit.'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Photos' }));

    await waitFor(() => {
      expect(submitPhotosFormMock).toHaveBeenCalledWith(expect.any(Object), 'rec-photo', { recordSource: 'used-gear-workflow' });
    });
  });
});