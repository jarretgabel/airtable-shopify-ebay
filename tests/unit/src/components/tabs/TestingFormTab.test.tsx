import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestingFormTab } from '@/components/tabs/TestingFormTab';

vi.mock('@/components/tabs/FormImageUploadEditor', () => ({
  FormImageUploadEditor: ({ onFilesChange }: { onFilesChange: (files: File[]) => void }) => (
    <div>
      <button
        type="button"
        onClick={() => onFilesChange([new File(['processed-testing'], 'processed-testing.jpg', { type: 'image/jpeg' })])}
      >
        Mock add processed testing photos
      </button>
    </div>
  ),
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
        submittedPhotosNotes: '',
      },
      stageContext: {
        existingAttachments: [{ id: 'att-1', url: 'https://example.com/testing.jpg', filename: 'testing.jpg' }],
        imageMetadata: [
          {
            attachmentId: 'att-1',
            url: 'https://example.com/testing.jpg',
            filename: 'testing.jpg',
            alt: 'Bench overview',
            sortOrder: 1,
            sourceStage: 'testing',
            includedInListing: false,
          },
          {
            attachmentId: 'att-2',
            url: 'https://example.com/photo.jpg',
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
        serviceTimeMinutes: '',
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

  it('submits edited workflow image metadata with testing-stage saves', async () => {
    render(<TestingFormTab recordId="rec-testing" />);

    await screen.findByText('Testing');

    expect(screen.queryByLabelText('Alt text for photo.jpg')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Alt text for testing.jpg'), { target: { value: 'Updated bench overview' } });
    fireEvent.click(screen.getByLabelText('Include testing.jpg in listings'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Testing' }));

    await waitFor(() => {
      expect(submitTestingFormMock).toHaveBeenCalledWith(expect.any(Object), 'rec-testing', {
        recordSource: 'used-gear-workflow',
        imageMetadata: [
          expect.objectContaining({
            attachmentId: 'att-1',
            url: 'https://example.com/testing.jpg',
            filename: 'testing.jpg',
            alt: 'Updated bench overview',
            sourceStage: 'testing',
            includedInListing: true,
          }),
          expect.objectContaining({
            attachmentId: 'att-2',
            url: 'https://example.com/photo.jpg',
            filename: 'photo.jpg',
            alt: 'Final photo',
            sourceStage: 'photos',
            includedInListing: true,
          }),
        ],
      });
    });
  });

  it('submits upload-editor files through the testing save flow', async () => {
    render(<TestingFormTab recordId="rec-testing" />);

    await screen.findByText('Testing');

    fireEvent.click(screen.getByRole('button', { name: 'Mock add processed testing photos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Testing' }));

    await waitFor(() => {
      expect(submitTestingFormMock).toHaveBeenCalled();
    });

    const latestCall = submitTestingFormMock.mock.calls[submitTestingFormMock.mock.calls.length - 1];
    const [submittedValues] = latestCall as [
      { imageFiles: File[] },
      string,
      unknown,
    ];

    expect(submittedValues.imageFiles).toHaveLength(1);
    expect(submittedValues.imageFiles[0]?.name).toBe('processed-testing.jpg');
  });
});