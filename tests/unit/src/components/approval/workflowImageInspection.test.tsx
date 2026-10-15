import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApprovalFormFieldsSupplementalEditors } from '@/components/approval/ApprovalFormFieldsSupplementalEditors';
import { inspectWorkflowImageMetadata, type InspectWorkflowImageMetadataResponse } from '@/services/app-api/airtable';

vi.mock('@/services/app-api/airtable', () => ({ inspectWorkflowImageMetadata: vi.fn() }));

const valid = 'https://drive.google.com/uc?id=valid-photo';
const invalid = 'https://drive.google.com/uc?id=invalid-photo';
const props: ComponentProps<typeof ApprovalFormFieldsSupplementalEditors> = {
  recordId: 'rec-images',
  validateWorkflowImageFormats: true,
  useCombinedImageAltEditor: true,
  combinedImageEditorValue: '',
  imageUrlSourceField: 'Images',
  imageAltTextSourceField: 'Images Alt Text',
  shopifyImagePayloadFieldName: 'Shopify REST Images JSON',
  workflowImageMetadataFieldName: 'Workflow Image Metadata JSON',
  workflowImageAttachments: [
    { url: valid, filename: 'valid.jpg' },
    { url: invalid, filename: 'invalid.jpg' },
  ],
  selectedWorkflowImageUrls: [valid, invalid],
  formValues: {
    'Workflow Image Metadata JSON': JSON.stringify([
      { url: valid, filename: 'valid.jpg', sourceStage: 'photos', includedInListing: true },
      { url: invalid, filename: 'invalid.jpg', sourceStage: 'photos', includedInListing: true },
    ]),
  },
  setFormValue: vi.fn(),
  setDerivedFormValue: vi.fn(),
  saving: false,
  isReadOnlyApprovalField: () => false,
  workflowManagedListingContent: false,
  testingSectionFields: [],
  renderSpecialLabel: (label) => <span>{label}</span>,
  inputBaseClass: '',
  isEbayApprovalForm: false,
  shopifyKeyFeaturesSyncFieldNames: [],
  ebayKeyFeaturesSyncFieldNames: [],
  ebayAttributesSyncFieldNames: [],
  ebayDomesticShippingFlatFeeFieldName: '',
  ebayInternationalShippingFlatFeeFieldName: '',
  hasEbayShippingServicesEditor: false,
  hasShopifyTagEditor: false,
  shopifyTagValues: [],
  setShopifyTagValues: vi.fn(),
  hasShopifyCollectionEditor: false,
  shopifyCollectionsFieldName: 'Collections',
  effectiveShopifyCollectionIds: [],
  effectiveCollectionEditorLabelsById: {},
  setShopifyCollectionIds: vi.fn(),
  hasEbayCategoryEditor: false,
  effectiveEbayCategoriesFieldName: '',
  ebayMarketplaceId: 'EBAY_US',
  ebaySelectedCategoryDisplayValues: [],
  normalizedEbayCategoryLabelsById: {},
  setEbayCategoryIds: vi.fn(),
  hasSecondaryEbayCategory: false,
  renderFieldLabel: (name) => <span>{name}</span>,
  getSelectClassName: () => '',
  getInputClassName: () => '',
};

function deferred() {
  let resolve!: (result: InspectWorkflowImageMetadataResponse) => void;
  const promise = new Promise<InspectWorkflowImageMetadataResponse>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('automatic workflow image inspection', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows restored metadata alt text without overriding an explicitly cleared draft caption', async () => {
    vi.mocked(inspectWorkflowImageMetadata).mockResolvedValue({ validImageUrls: [valid, invalid], invalidImageUrls: [] });
    const alt = 'Bel Canto PRe1 preamplifier front three-quarter view';
    const values = {
      'Workflow Image Metadata JSON': JSON.stringify([
        { url: valid, filename: 'valid.jpg', alt, sourceStage: 'photos', includedInListing: true },
      ]),
    };
    const { rerender } = render(<ApprovalFormFieldsSupplementalEditors {...props} formValues={values} />);
    expect(screen.getByText(alt)).toBeInTheDocument();
    rerender(<ApprovalFormFieldsSupplementalEditors {...props} formValues={{
      ...values, Images: valid, 'Images Alt Text': '',
    }} />);
    expect(screen.queryByText(alt)).not.toBeInTheDocument();
    expect(props.setFormValue).not.toHaveBeenCalled();
    expect(props.setDerivedFormValue).not.toHaveBeenCalled();
    await act(async () => {});
  });

  it('never replaces pending metadata, alt text, ordering or explicit empty selections', async () => {
    const request = deferred();
    vi.mocked(inspectWorkflowImageMetadata).mockReturnValue(request.promise);
    const { rerender } = render(<ApprovalFormFieldsSupplementalEditors {...props} />);
    const editedProps = {
      ...props, selectedWorkflowImageUrls: [],
      formValues: { 'Workflow Image Metadata JSON': 'unsaved metadata', 'Images Alt Text': 'unsaved alt' },
    };
    rerender(<ApprovalFormFieldsSupplementalEditors {...editedProps} />);
    await act(async () => { request.resolve({ validImageUrls: [valid], invalidImageUrls: [invalid] }); });
    expect(props.setFormValue).not.toHaveBeenCalled();
    expect(props.setDerivedFormValue).not.toHaveBeenCalled();
    expect(screen.queryAllByTestId('selected-listing-image-card')).toHaveLength(0);
    expect(screen.getAllByTestId('available-listing-image-card')).toHaveLength(2);
    const invalidCard = screen.getAllByTestId('available-listing-image-card')[1];
    expect(invalidCard).toHaveTextContent('Unsupported image format');
    expect(within(invalidCard).getByRole('checkbox')).toBeDisabled();
    expect(inspectWorkflowImageMetadata).toHaveBeenCalledTimes(1);
  });

  it('keeps unsupported selected photos visible and removable without deleting the library', async () => {
    vi.mocked(inspectWorkflowImageMetadata).mockResolvedValue({ validImageUrls: [valid], invalidImageUrls: [invalid] });
    render(<ApprovalFormFieldsSupplementalEditors {...props} />);
    await screen.findByText(/Unsupported image format/);
    const cards = screen.getAllByTestId('selected-listing-image-card');
    expect(cards).toHaveLength(2);
    const checkbox = within(cards[1]).getByRole('checkbox');
    expect(checkbox).toBeEnabled();
    fireEvent.click(checkbox);
    expect(props.setFormValue).toHaveBeenCalledWith('Images', valid);
    const metadataCall = vi.mocked(props.setFormValue).mock.calls.find(([field]) => field === 'Workflow Image Metadata JSON');
    const metadata = JSON.parse(metadataCall![1]);
    expect(metadata).toHaveLength(2);
    expect(metadata.find((image: { url: string }) => image.url === invalid).includedInListing).toBe(false);
    expect(metadata.find((image: { url: string }) => image.url === valid).includedInListing).toBe(true);
  });

  it('ignores a previous record response and labels newly added images as unverified, not unsupported', async () => {
    const oldRequest = deferred();
    const newRequest = deferred();
    vi.mocked(inspectWorkflowImageMetadata).mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(newRequest.promise);
    const { rerender } = render(<ApprovalFormFieldsSupplementalEditors {...props} />);
    rerender(<ApprovalFormFieldsSupplementalEditors {...props} recordId="rec-other" />);
    await act(async () => { newRequest.resolve({ validImageUrls: [valid, invalid], invalidImageUrls: [] }); });
    await act(async () => { oldRequest.resolve({ validImageUrls: [], invalidImageUrls: [valid, invalid] }); });
    expect(screen.queryByText(/Unsupported image format/)).not.toBeInTheDocument();
    rerender(<ApprovalFormFieldsSupplementalEditors {...props} recordId="rec-other"
      workflowImageAttachments={[...props.workflowImageAttachments, { url: 'https://drive.google.com/uc?id=new', filename: 'new.jpg' }]} />);
    expect(screen.getByText(/Image format not checked/)).toBeInTheDocument();
    expect(props.setFormValue).not.toHaveBeenCalled();
    expect(props.setDerivedFormValue).not.toHaveBeenCalled();
  });

  it('reports temporary access failures without hiding photos or changing drafts', async () => {
    vi.mocked(inspectWorkflowImageMetadata).mockRejectedValue(new Error('Drive temporarily unavailable'));
    render(<ApprovalFormFieldsSupplementalEditors {...props} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Drive temporarily unavailable');
    expect(screen.getAllByTestId('selected-listing-image-card')).toHaveLength(2);
    expect(screen.queryByText(/Unsupported image format/)).not.toBeInTheDocument();
    expect(props.setFormValue).not.toHaveBeenCalled();
    expect(props.setDerivedFormValue).not.toHaveBeenCalled();
  });
});
