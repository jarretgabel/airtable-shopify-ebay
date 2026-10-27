import { useEffect, useRef } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestingFormTab } from '@/components/tabs/TestingFormTab';
import { AUDIOGON_RATINGS, audiogonRatingDescription } from '@contracts/audiogonRating';

vi.mock('@/services/app-api/airtable', () => ({
  getConfiguredWorkflowImagePreview: vi.fn(async () => ({ dataUrl: 'data:image/jpeg;base64,/9j/2Q==' })),
}));

vi.mock('@/components/tabs/FormImageUploadEditor', () => ({
  FormImageUploadEditor: ({
    onFilesChange,
    onUploadAssetsChange,
    onProcessingStateChange,
    onProcessingSummaryChange,
    resetKey = 0,
    afterUploadContent,
  }: {
    onFilesChange: (files: File[]) => void;
    onUploadAssetsChange?: (assets: Array<{
      originalFile: File;
      uploadFile: File;
      imageRole?: string;
      customImageRole?: string;
      altText?: string;
    }>) => void;
    onProcessingStateChange?: (isProcessing: boolean) => void;
    onProcessingSummaryChange?: (summary: { total: number; processed: number; processing: number; failed: number }) => void;
    resetKey?: string | number;
    afterUploadContent?: React.ReactNode;
  }) => {
    const callbacksRef = useRef({ onFilesChange, onUploadAssetsChange });
    const previousResetKeyRef = useRef(resetKey);

    useEffect(() => {
      callbacksRef.current = { onFilesChange, onUploadAssetsChange };
    }, [onFilesChange, onUploadAssetsChange]);

    useEffect(() => {
      if (previousResetKeyRef.current === resetKey) return;
      previousResetKeyRef.current = resetKey;
      callbacksRef.current.onFilesChange([]);
      callbacksRef.current.onUploadAssetsChange?.([]);
    }, [resetKey]);

    return (
      <div>
        <button
          type="button"
          onClick={() => {
            const originalFile = new File(['original-testing'], 'original-testing.jpg', { type: 'image/jpeg' });
            const processedFile = new File(['processed-testing'], 'processed-testing.jpg', { type: 'image/jpeg' });
            onFilesChange([processedFile]);
            onUploadAssetsChange?.([{
              originalFile,
              uploadFile: processedFile,
              imageRole: 'front',
              altText: 'Accuphase P-300 amplifier available at Resolution AV',
            }]);
          }}
        >
          Mock add processed testing photos
        </button>
        <button
          type="button"
          onClick={() => {
            onProcessingSummaryChange?.({ total: 2, processed: 1, processing: 1, failed: 0 });
            onProcessingStateChange?.(true);
          }}
        >
          Mock testing processing in progress
        </button>
        {afterUploadContent}
      </div>
    );
  },
}));

const {
  loadTestingFormOptionSetsMock,
  loadTestingFormValuesMock,
  submitTestingFormMock,
} = vi.hoisted(() => ({
  loadTestingFormOptionSetsMock: vi.fn(),
  loadTestingFormValuesMock: vi.fn(),
  submitTestingFormMock: vi.fn(),
}));

vi.mock('@/services/testingForm', async () => {
  const actual = await vi.importActual<typeof import('@/services/testingForm')>('@/services/testingForm');
  return {
    ...actual,
    loadTestingFormOptionSets: loadTestingFormOptionSetsMock,
    loadTestingFormValues: loadTestingFormValuesMock,
    submitTestingForm: submitTestingFormMock,
  };
});

describe('TestingFormTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadTestingFormOptionSetsMock.mockResolvedValue({
      Status: ['Tested'],
      'Component Type': ['Amplifier'],
      'Audiogon Rating': AUDIOGON_RATINGS.map(audiogonRatingDescription),
      'Original Box': ['No'],
      Manual: ['Included'],
      Remote: ['No'],
      'Power Cable': ['Included'],
      'Shipping Method': ['Freight'],
    });
    loadTestingFormValuesMock.mockResolvedValue({
      source: 'used-gear-workflow',
      customerReference: {
        cosmeticNotes: 'Customer noted one chip on the rack handle.',
        functionalNotes: '',
        inclusionNotes: '',
      },
      stageContext: {
        existingAttachments: [{ id: 'att-1', url: 'https://drive.google.com/uc?id=file-testing', filename: 'testing.jpg' }],
        referenceAttachments: [{ id: 'att-intake', url: 'https://drive.google.com/uc?id=file-intake', filename: 'intake.jpg' }],
        imageMetadata: [
          {
            attachmentId: 'att-1',
            url: 'https://drive.google.com/uc?id=file-testing',
            filename: 'testing.jpg',
            alt: 'Bench overview',
            sortOrder: 1,
            sourceStage: 'testing',
            includedInListing: true,
          },
          {
            attachmentId: 'att-2',
            url: 'https://drive.google.com/uc?id=file-photo',
            filename: 'photo.jpg',
            alt: 'Final photo',
            sortOrder: 2,
            sourceStage: 'photos',
            includedInListing: true,
          },
        ],
      },
      values: {
        sku: 'SKU-500',
        arrivalDate: '2026-05-01',
        acquiredFrom: 'Walk-in seller',
        make: 'Accuphase',
        model: 'P-300',
        componentType: 'Amplifier',
        cost: '1200',
        inventoryNotes: 'Capture top cover wear.',
        serialNumber: 'SN-500',
        voltage: '120V',
        audiogonRating: '7/10',
        cosmeticConditionNotes: 'Strong faceplate.',
        originalBox: 'No',
        manual: 'Included',
        remote: 'No',
        powerCable: 'Included',
        additionalItems: '',
        shippingWeight: '65 lbs',
        shippingDims: '26x22x9',
        shippingMethod: 'Freight',
        imageFiles: [],
        testingNotes: 'Bench tested.',
        testingTimeMinutes: '30',
        serviceNotes: '',
        serviceTimeMinutes: '0',
        testingDate: '2026-05-03',
        status: 'Tested',
      },
    });
    submitTestingFormMock.mockResolvedValue({
      recordId: 'rec-testing',
      sku: 'SKU-500',
      action: 'updated',
    });
  });

  it('renders the back-arrow action for the testing queue when a directory callback is provided', async () => {
    const onBackToDirectory = vi.fn();

    render(<TestingFormTab recordId="rec-testing" onBackToDirectory={onBackToDirectory} />);

    await screen.findByRole('heading', { name: 'SKU-500' });

    fireEvent.click(screen.getByRole('button', { name: 'Back to Testing' }));
    expect(onBackToDirectory).toHaveBeenCalledTimes(1);
  });

  it('explains how to enter shipping weight and dimensions separately', async () => {
    render(<TestingFormTab recordId="rec-testing" />);

    await screen.findByRole('heading', { name: 'SKU-500' });

    expect(screen.getByText('Enter the total packaged weight in pounds (lbs), including the box and foam. Example: 22.')).toBeInTheDocument();
    expect(screen.getByText('Enter package dimensions in inches as W x D x H. Keep weight separate; do not include it here. Example: 22 x 20 x 12.')).toBeInTheDocument();
  });

  it('submits edited workflow image metadata only after testing completion is confirmed', async () => {
    render(<TestingFormTab recordId="rec-testing" />);

    await screen.findByRole('heading', { name: 'SKU-500' });

    expect(screen.queryByLabelText('Alt text for photo.jpg')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Arrival Date')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Acquired From')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Cost')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Inventory Notes')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Shipping Method')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();
    screen.getByRole('heading', { name: 'Intake Snapshot' });
    expect(screen.getByText('Audiogon Rating')).toBeInTheDocument();
    expect(screen.getAllByText('Original Box').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Manual').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Remote').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Power Cable').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Please confirm')).toHaveLength(4);
    expect(screen.getAllByText('Additional Items').length).toBeGreaterThan(0);
    expect(screen.getByText('Inventory Notes')).toBeInTheDocument();
    expect(screen.getByText('Capture top cover wear.')).toBeInTheDocument();
    expect(screen.getByText('Intake Images')).toBeInTheDocument();
    expect(screen.getByText('intake.jpg')).toBeInTheDocument();
    expect(screen.queryByText('Customer Intake Reference')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Alt text for testing.jpg'), { target: { value: 'Updated bench overview' } });
    fireEvent.click(screen.getByRole('button', { name: 'Testing Complete' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, complete testing' }));

    await waitFor(() => {
      expect(submitTestingFormMock).toHaveBeenCalledWith(expect.any(Object), 'rec-testing', expect.objectContaining({
        completeWorkflowStage: true,
        recordSource: 'used-gear-workflow',
        originalImageMetadata: expect.arrayContaining([expect.objectContaining({ alt: 'Bench overview' })]),
        imageUploadAssets: [],
        imageMetadata: [
          expect.objectContaining({
            attachmentId: 'att-1',
            url: 'https://drive.google.com/uc?id=file-testing',
            filename: 'testing.jpg',
            alt: 'Updated bench overview',
            sourceStage: 'testing',
            includedInListing: true,
          }),
          expect.objectContaining({
            attachmentId: 'att-2',
            url: 'https://drive.google.com/uc?id=file-photo',
            filename: 'photo.jpg',
            alt: 'Final photo',
            sourceStage: 'photos',
            includedInListing: true,
          }),
        ],
      }));
    });
    await screen.findByRole('status');
    fireEvent.change(screen.getByLabelText('Alt text for testing.jpg'), { target: { value: 'Bench overview' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Testing' }));
    await waitFor(() => {
      expect(submitTestingFormMock).toHaveBeenLastCalledWith(expect.any(Object), 'rec-testing', expect.objectContaining({
        originalImageMetadata: expect.arrayContaining([expect.objectContaining({ alt: 'Updated bench overview' })]),
        imageMetadata: expect.arrayContaining([expect.objectContaining({ alt: 'Bench overview' })]),
      }));
    });
  });

  it('submits upload-editor files through the testing save flow', async () => {
    render(<TestingFormTab recordId="rec-testing" />);

    await screen.findByRole('heading', { name: 'SKU-500' });

    fireEvent.click(screen.getByRole('button', { name: 'Mock add processed testing photos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Testing' }));

    await waitFor(() => {
      expect(submitTestingFormMock).toHaveBeenCalled();
    });

    expect(submitTestingFormMock).toHaveBeenLastCalledWith(expect.any(Object), 'rec-testing', expect.objectContaining({
      completeWorkflowStage: false,
      imageUploadAssets: [
        expect.objectContaining({
          originalFile: expect.objectContaining({ name: 'original-testing.jpg' }),
          uploadFile: expect.objectContaining({ name: 'processed-testing.jpg' }),
        }),
      ],
    }));

    const latestCall = submitTestingFormMock.mock.calls[submitTestingFormMock.mock.calls.length - 1];
    const [submittedValues] = latestCall as [
      { imageFiles: File[] },
      string,
      unknown,
    ];

    expect(submittedValues.imageFiles).toHaveLength(1);
    expect(submittedValues.imageFiles[0]?.name).toBe('processed-testing.jpg');
  });

  it('submits the selected complete Audiogon choice while retaining the loaded rating baseline', async () => {
    render(<TestingFormTab recordId="rec-testing" />);
    const rating = await screen.findByRole('combobox', { name: 'Audiogon Rating' });
    const fullChoice = '8/10: Very Good - Flawless front face, other minor imperfections.';
    expect(screen.getByRole('option', { name: fullChoice })).toHaveValue(fullChoice);
    expect(rating).toHaveValue('7/10');
    fireEvent.change(rating, { target: { value: fullChoice } });
    expect(rating).toHaveAccessibleDescription(fullChoice);
    fireEvent.click(screen.getByRole('button', { name: 'Save Testing' }));
    await waitFor(() => {
      expect(submitTestingFormMock).toHaveBeenCalledWith(
        expect.objectContaining({ audiogonRating: fullChoice }),
        'rec-testing', expect.objectContaining({ originalAudiogonRating: '7/10' }),
      );
    });
  });

  it('allows submission when Audiogon Rating is blank', async () => {
    loadTestingFormValuesMock.mockResolvedValueOnce({
      source: 'used-gear-workflow',
      customerReference: {
        cosmeticNotes: 'Customer noted one chip on the rack handle.',
        functionalNotes: '',
        inclusionNotes: '',
      },
      stageContext: {
        existingAttachments: [],
        referenceAttachments: [],
        imageMetadata: [],
      },
      values: {
        sku: 'SKU-500',
        arrivalDate: '2026-05-01',
        acquiredFrom: 'Walk-in seller',
        make: 'Accuphase',
        model: 'P-300',
        componentType: 'Amplifier',
        cost: '1200',
        inventoryNotes: 'Capture top cover wear.',
        serialNumber: 'SN-500',
        voltage: '120V',
        audiogonRating: '',
        cosmeticConditionNotes: 'Strong faceplate.',
        originalBox: 'No',
        manual: 'Included',
        remote: 'No',
        powerCable: 'Included',
        additionalItems: '',
        shippingWeight: '65 lbs',
        shippingDims: '26x22x9',
        shippingMethod: 'Freight',
        imageFiles: [],
        testingNotes: 'Bench tested.',
        testingTimeMinutes: '30',
        serviceNotes: '',
        serviceTimeMinutes: '0',
        testingDate: '2026-05-03',
        status: 'Tested',
      },
    });

    render(<TestingFormTab recordId="rec-testing" />);

    await screen.findByRole('heading', { name: 'SKU-500' });

    fireEvent.click(screen.getByRole('button', { name: 'Save Testing' }));

    await waitFor(() => {
      expect(submitTestingFormMock).toHaveBeenCalledWith(
        expect.objectContaining({ audiogonRating: '' }),
        'rec-testing',
        expect.any(Object),
      );
    });

    const saveNotice = await screen.findByText('Testing changes saved');
    const statusNotice = saveNotice.closest('[role="status"]');
    expect(statusNotice).toHaveTextContent('Testing details for SKU-500 were saved.');
    expect(statusNotice).toHaveClass('rounded-lg', 'border-emerald-400/35');
    expect(statusNotice?.nextElementSibling).toContainElement(screen.getByRole('button', { name: 'Save Testing' }));
  });

  it('allows saving incremental work when required fields are blank', async () => {
    render(<TestingFormTab recordId="rec-testing" />);

    await screen.findByRole('heading', { name: 'SKU-500' });
    fireEvent.change(screen.getByLabelText(/Service Time/), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Testing' }));

    await waitFor(() => {
      expect(submitTestingFormMock).toHaveBeenCalledWith(
        expect.objectContaining({ serviceTimeMinutes: '' }),
        'rec-testing',
        expect.objectContaining({ completeWorkflowStage: false }),
      );
    });
  });

  it('blocks Testing Complete when required Service Time is blank', async () => {
    render(<TestingFormTab recordId="rec-testing" />);

    await screen.findByRole('heading', { name: 'SKU-500' });
    fireEvent.change(screen.getByLabelText(/Service Time/), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Testing Complete' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, complete testing' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Service Time is required.');
    expect(submitTestingFormMock).not.toHaveBeenCalled();
  });

  it('shows processing progress and disables submission while testing images are still being prepared', async () => {
    render(<TestingFormTab recordId="rec-testing" />);

    await screen.findByRole('heading', { name: 'SKU-500' });

    fireEvent.click(screen.getByRole('button', { name: 'Mock testing processing in progress' }));

    expect(await screen.findByText('Preparing images: 1 of 2 ready. 1 still processing.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Processing images...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Testing Complete' })).toBeDisabled();
  });

  it('shows upload progress while testing images are being submitted', async () => {
    const resolveSubmitRef: { current?: (value: { recordId: string; sku: string; action: 'updated' }) => void } = {};
    submitTestingFormMock.mockImplementationOnce(async (_values, _recordId, options) => {
      options?.onImageUploadProgress?.({ total: 1, completed: 0, currentFilename: 'processed-testing.jpg', phase: 'uploading' });
      await Promise.resolve();
      options?.onImageUploadProgress?.({ total: 1, completed: 1, currentFilename: '', phase: 'finalizing' });
      return await new Promise<{ recordId: string; sku: string; action: 'updated' }>((resolve) => {
        resolveSubmitRef.current = resolve;
      });
    });

    render(<TestingFormTab recordId="rec-testing" />);

    await screen.findByRole('heading', { name: 'SKU-500' });

    fireEvent.click(screen.getByRole('button', { name: 'Mock add processed testing photos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Testing' }));

    expect(await screen.findByText('Uploading images: 0 of 1 complete. Current file: processed-testing.jpg.')).toBeInTheDocument();
    expect(await screen.findByText('Finalizing saved image metadata for 1 image.')).toBeInTheDocument();

    if (!resolveSubmitRef.current) {
      throw new Error('Expected testing submit promise resolver to be assigned.');
    }

    resolveSubmitRef.current({ recordId: 'rec-testing', sku: 'SKU-500', action: 'updated' });

    await waitFor(() => {
      expect(screen.queryByText('Uploading images: 0 of 1 complete. Current file: processed-testing.jpg.')).not.toBeInTheDocument();
      expect(screen.queryByText('Finalizing saved image metadata for 1 image.')).not.toBeInTheDocument();
    });
  });
});