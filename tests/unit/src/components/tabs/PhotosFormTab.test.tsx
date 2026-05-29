import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PhotosFormTab } from '@/components/tabs/PhotosFormTab';

vi.mock('@/components/tabs/FormImageUploadEditor', () => ({
  FormImageUploadEditor: ({
    onFilesChange,
    onUploadAssetsChange,
    onProcessingStateChange,
    onProcessingSummaryChange,
    afterUploadContent,
    description,
  }: {
    onFilesChange: (files: File[]) => void;
    onUploadAssetsChange?: (assets: Array<{ originalFile: File; uploadFile: File }>) => void;
    onProcessingStateChange?: (isProcessing: boolean) => void;
    onProcessingSummaryChange?: (summary: { total: number; processed: number; processing: number; failed: number }) => void;
    afterUploadContent?: React.ReactNode;
    description?: string;
  }) => (
    <div>
      {description ? <p>{description}</p> : null}
      <button
        type="button"
        onClick={() => {
          const originalFile = new File(['original-photo'], 'original-photo.jpg', { type: 'image/jpeg' });
          const processedFile = new File(['processed-photo'], 'processed-photo.jpg', { type: 'image/jpeg' });
          onFilesChange([processedFile]);
          onUploadAssetsChange?.([{ originalFile, uploadFile: processedFile }]);
        }}
      >
        Mock add processed photos
      </button>
      <button
        type="button"
        onClick={() => {
          onProcessingSummaryChange?.({ total: 3, processed: 2, processing: 1, failed: 0 });
          onProcessingStateChange?.(true);
        }}
      >
        Mock photo processing in progress
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
      },
      stageContext: {
        inventoryNotes: 'Capture the serial plate and top cover.',
        testingNotes: 'Passed tuner test.',
        testingCosmeticNotes: 'Light wear on the top cover edges.',
        existingAttachments: [{ id: 'att-1', url: 'https://example.com/hero.jpg', filename: 'hero.jpg' }],
        intakeReferenceAttachments: [{ id: 'att-3', url: 'https://drive.google.com/uc?export=view&id=file-intake', filename: 'intake.jpg' }],
        testingReferenceAttachments: [{ id: 'att-2', url: 'https://example.com/testing.jpg', filename: 'testing.jpg' }],
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

  it('renders the back-arrow action for the photography queue when a directory callback is provided', async () => {
    const onBackToDirectory = vi.fn();

    render(<PhotosFormTab recordId="rec-photo" onBackToDirectory={onBackToDirectory} />);

    await screen.findByRole('heading', { name: 'SKU-400' });

    fireEvent.click(screen.getByRole('button', { name: 'Back to Photography' }));
    expect(onBackToDirectory).toHaveBeenCalledTimes(1);
  });

  it('requires included-item confirmations before allowing photo-stage completion', async () => {
    render(<PhotosFormTab recordId="rec-photo" />);

    await screen.findByRole('heading', { name: 'SKU-400' });

    expect(screen.queryByLabelText('Alt text for testing.jpg')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Additional Items')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Audiogon Rating')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Original Box')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Manual')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Remote')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Power Cable')).not.toBeInTheDocument();
    expect(screen.getByText('Cosmetic Notes')).toBeInTheDocument();
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();
    expect(screen.queryByText('Status')).not.toBeInTheDocument();
    expect(screen.queryByText("Photo'd")).not.toBeInTheDocument();
    expect(screen.getAllByText('Audiogon Rating').length).toBeGreaterThan(0);
    expect(screen.getByText('7/10')).toBeInTheDocument();
    expect(screen.getAllByText('Original Box').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Manual').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Remote').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Power Cable').length).toBeGreaterThan(0);
    expect(screen.queryByText('Please confirm')).not.toBeInTheDocument();
    expect(screen.getByText('Photos should cover all sides of the unit with close ups of any cosmetic issues. Photograph additional items also.')).toBeInTheDocument();
    expect(screen.getAllByText('Additional Items').length).toBeGreaterThan(0);
    expect(screen.getByText('Rack handles')).toBeInTheDocument();
    expect(screen.getByText('Inventory Notes')).toBeInTheDocument();
    expect(screen.getByText('Capture the serial plate and top cover.')).toBeInTheDocument();
    expect(screen.getByText('Testing Cosmetic Notes')).toBeInTheDocument();
    expect(screen.getByText('Light wear on the top cover edges.')).toBeInTheDocument();
    expect(screen.getByText('Intake Images')).toBeInTheDocument();
    expect(screen.getByText('Testing Images')).toBeInTheDocument();
    expect(screen.getByText('intake.jpg')).toBeInTheDocument();
    expect(screen.getByText('testing.jpg')).toBeInTheDocument();
    expect(screen.queryByText('Customer Intake Reference')).not.toBeInTheDocument();
    expect(screen.getByAltText('intake.jpg')).toHaveAttribute('src', 'https://drive.google.com/thumbnail?id=file-intake&sz=w1600');

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
      expect(submitPhotosFormMock).toHaveBeenCalledWith(expect.any(Object), 'rec-photo', expect.objectContaining({
        completeWorkflowStage: true,
        recordSource: 'used-gear-workflow',
        imageUploadAssets: [],
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
      }));
    });
  });

  it('submits upload-editor files through the photos save flow', async () => {
    render(<PhotosFormTab recordId="rec-photo" />);

    await screen.findByRole('heading', { name: 'SKU-400' });

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
      imageUploadAssets: [
        expect.objectContaining({
          originalFile: expect.objectContaining({ name: 'original-photo.jpg' }),
          uploadFile: expect.objectContaining({ name: 'processed-photo.jpg' }),
        }),
      ],
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
      },
      stageContext: {
        inventoryNotes: 'Capture the serial plate and top cover.',
        testingNotes: 'Passed tuner test.',
        testingCosmeticNotes: 'Light wear on the top cover edges.',
        existingAttachments: [],
        intakeReferenceAttachments: [],
        testingReferenceAttachments: [],
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

    await screen.findByRole('heading', { name: 'SKU-400' });

    fireEvent.click(screen.getByRole('button', { name: 'Save Photos' }));

    expect(await screen.findByText('Upload at least one image before submitting the Photos form.')).toBeInTheDocument();
    expect(submitPhotosFormMock).not.toHaveBeenCalled();
  });

  it('shows processing progress and disables submission while photo images are still being prepared', async () => {
    render(<PhotosFormTab recordId="rec-photo" />);

    await screen.findByRole('heading', { name: 'SKU-400' });

    fireEvent.click(screen.getByRole('button', { name: 'Mock photo processing in progress' }));

    expect(await screen.findByText('Preparing images: 2 of 3 ready. 1 still processing.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Processing images...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Photos Complete' })).toBeDisabled();
  });

  it('shows upload progress while photo images are being submitted', async () => {
    const resolveSubmitRef: { current?: (value: { recordId: string; sku: string; action: 'updated' }) => void } = {};
    submitPhotosFormMock.mockImplementationOnce(async (_values, _recordId, options) => {
      options?.onImageUploadProgress?.({ total: 1, completed: 0, currentFilename: 'processed-photo.jpg', phase: 'uploading' });
      await Promise.resolve();
      options?.onImageUploadProgress?.({ total: 1, completed: 1, currentFilename: '', phase: 'finalizing' });
      return await new Promise<{ recordId: string; sku: string; action: 'updated' }>((resolve) => {
        resolveSubmitRef.current = resolve;
      });
    });

    render(<PhotosFormTab recordId="rec-photo" />);

    await screen.findByRole('heading', { name: 'SKU-400' });

    fireEvent.click(screen.getByRole('button', { name: 'Mock add processed photos' }));
    fireEvent.click(screen.getByLabelText('I checked and photographed Manual for this unit.'));
    fireEvent.click(screen.getByLabelText('I checked and photographed Power Cable for this unit.'));
    fireEvent.click(screen.getByLabelText('I checked and photographed Additional Items for this unit.'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Photos' }));

    expect(await screen.findByText('Uploading images: 0 of 1 complete. Current file: processed-photo.jpg.')).toBeInTheDocument();
    expect(await screen.findByText('Finalizing saved image metadata for 1 image.')).toBeInTheDocument();

    if (!resolveSubmitRef.current) {
      throw new Error('Expected photos submit promise resolver to be assigned.');
    }

    resolveSubmitRef.current({ recordId: 'rec-photo', sku: 'SKU-400', action: 'updated' });

    await waitFor(() => {
      expect(screen.queryByText('Uploading images: 0 of 1 complete. Current file: processed-photo.jpg.')).not.toBeInTheDocument();
      expect(screen.queryByText('Finalizing saved image metadata for 1 image.')).not.toBeInTheDocument();
    });
  });
});