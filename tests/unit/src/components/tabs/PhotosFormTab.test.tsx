import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PhotosFormTab } from '@/components/tabs/PhotosFormTab';

vi.mock('@/components/tabs/FormImageUploadEditor', () => ({
  FormImageUploadEditor: ({
    onFilesChange,
    afterUploadContent,
    description,
  }: {
    onFilesChange: (files: File[]) => void;
    afterUploadContent?: React.ReactNode;
    description?: string;
  }) => (
    <div>
      {description ? <p>{description}</p> : null}
      <button
        type="button"
        onClick={() => onFilesChange([new File(['processed-photo'], 'processed-photo.jpg', { type: 'image/jpeg' })])}
      >
        Mock add processed photos
      </button>
      {afterUploadContent}
    </div>
  ),
}));

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
        testingCosmeticNotes: 'Light wear on the top cover edges.',
        existingAttachments: [{ id: 'att-1', url: 'https://example.com/hero.jpg', filename: 'hero.jpg' }],
        imageMetadata: [
          {
            attachmentId: 'att-1',
            url: 'https://example.com/hero.jpg',
            filename: 'hero.jpg',
            alt: 'Original hero shot',
            sortOrder: 1,
            sourceStage: 'photos',
            includedInListing: true,
          },
          {
            attachmentId: 'att-2',
            url: 'https://example.com/testing.jpg',
            filename: 'testing.jpg',
            alt: 'Bench proof',
            sortOrder: 2,
            sourceStage: 'testing',
            includedInListing: false,
          },
        ],
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

  it('requires included-item confirmations before allowing photo-stage completion', async () => {
    render(<PhotosFormTab recordId="rec-photo" />);

    await screen.findByText('Photos');

    expect(screen.queryByLabelText('Alt text for testing.jpg')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Additional Items')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Audiogon Rating')).not.toBeInTheDocument();
    expect(screen.getByText('Cosmetic Notes')).toBeInTheDocument();
    expect(screen.getByText('Additional details if Audiogon rating is below an 8/10.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();
    expect(screen.getAllByText('Audiogon Rating').length).toBeGreaterThan(0);
    expect(screen.getByText('7/10')).toBeInTheDocument();
    expect(screen.getAllByText('Original Box').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Manual').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Remote').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Power Cable').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Please confirm')).toHaveLength(4);
    expect(screen.getByText('Photos should cover all sides of the unit with close ups of any cosmetic issues. Photograph additional items also.')).toBeInTheDocument();
    expect(screen.getAllByText('Additional Items').length).toBeGreaterThan(0);
    expect(screen.getByText('Rack handles')).toBeInTheDocument();
    expect(screen.getByText('Inventory Notes')).toBeInTheDocument();
    expect(screen.getByText('Capture the serial plate and top cover.')).toBeInTheDocument();
    expect(screen.getByText('Testing Cosmetic Notes')).toBeInTheDocument();
    expect(screen.getByText('Light wear on the top cover edges.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Photos Complete' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, complete photography' }));

    await screen.findByText('Confirm that the following included items were checked and photographed: Manual, Power Cable, Additional Items.');
    expect(submitPhotosFormMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('I checked and photographed Manual for this unit.'));
    fireEvent.click(screen.getByLabelText('I checked and photographed Power Cable for this unit.'));
    fireEvent.click(screen.getByLabelText('I checked and photographed Additional Items for this unit.'));
    fireEvent.change(screen.getByLabelText('Alt text for hero.jpg'), { target: { value: 'Updated hero shot' } });
    fireEvent.click(screen.getByRole('button', { name: 'Photos Complete' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, complete photography' }));

    await waitFor(() => {
      expect(submitPhotosFormMock).toHaveBeenCalledWith(expect.any(Object), 'rec-photo', {
        completeWorkflowStage: true,
        recordSource: 'used-gear-workflow',
        imageMetadata: [
          expect.objectContaining({
            attachmentId: 'att-1',
            url: 'https://example.com/hero.jpg',
            filename: 'hero.jpg',
            alt: 'Updated hero shot',
            sourceStage: 'photos',
            includedInListing: true,
          }),
          expect.objectContaining({
            attachmentId: 'att-2',
            url: 'https://example.com/testing.jpg',
            filename: 'testing.jpg',
            alt: 'Bench proof',
            sourceStage: 'testing',
            includedInListing: false,
          }),
        ],
      });
    });
  });

  it('submits upload-editor files through the photos save flow', async () => {
    render(<PhotosFormTab recordId="rec-photo" />);

    await screen.findByText('Photos');

    fireEvent.click(screen.getByRole('button', { name: 'Mock add processed photos' }));
    fireEvent.click(screen.getByLabelText('I checked and photographed Manual for this unit.'));
    fireEvent.click(screen.getByLabelText('I checked and photographed Power Cable for this unit.'));
    fireEvent.click(screen.getByLabelText('I checked and photographed Additional Items for this unit.'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Photos' }));

    await waitFor(() => {
      expect(submitPhotosFormMock).toHaveBeenCalled();
    });

    expect(submitPhotosFormMock).toHaveBeenLastCalledWith(expect.any(Object), 'rec-photo', expect.objectContaining({
      completeWorkflowStage: false,
    }));

    const latestCall = submitPhotosFormMock.mock.calls[submitPhotosFormMock.mock.calls.length - 1];
    const [submittedValues] = latestCall as [
      { imageFiles: File[] },
      string,
      unknown,
    ];

    expect(submittedValues.imageFiles).toHaveLength(1);
    expect(submittedValues.imageFiles[0]?.name).toBe('processed-photo.jpg');
  });

  it('blocks save when no images exist on the record or in the upload editor', async () => {
    loadPhotosFormValuesMock.mockResolvedValueOnce({
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
        testingCosmeticNotes: 'Light wear on the top cover edges.',
        existingAttachments: [],
        imageMetadata: [],
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

    render(<PhotosFormTab recordId="rec-photo" />);

    await screen.findByText('Photos');

    fireEvent.click(screen.getByRole('button', { name: 'Save Photos' }));

    expect(await screen.findByText('Upload at least one image before submitting the Photos form.')).toBeInTheDocument();
    expect(submitPhotosFormMock).not.toHaveBeenCalled();
  });
});