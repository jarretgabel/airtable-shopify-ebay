import { getRecordsFromResolvedSource, updateRecordFromResolvedSource } from '@/services/app-api/airtable';
import { useApprovalStore } from '@/stores/approvalStore';
import type { AirtableRecord } from '@/types/airtable';

vi.mock('@/services/app-api/airtable', () => ({
  getRecordsFromResolvedSource: vi.fn(),
  updateRecordFromResolvedSource: vi.fn(),
}));

vi.mock('@/services/app-api/ebay', () => ({
  getInventoryItems: vi.fn(),
  getOffersForInventorySkus: vi.fn(),
}));

vi.mock('@/services/shopifyDraftFromAirtable', () => ({
  buildShopifyCollectionIdsFromApprovalFields: vi.fn(() => []),
}));

vi.mock('@/services/logger', () => ({
  logServiceInfo: vi.fn(),
}));

function createRecord(): AirtableRecord {
  return {
    id: 'recApproval1',
    createdTime: '2026-04-27T00:00:00.000Z',
    fields: {
      Title: 'Test 141',
      'Shopify Approved': 'FALSE',
    },
  };
}

function create422Error(message: string): Error & { response: { status: number } } {
  return Object.assign(new Error(message), {
    response: { status: 422 },
  });
}

describe('approvalStore saveRecord approve-only', () => {
  beforeEach(() => {
    useApprovalStore.setState({
      records: [],
      loading: false,
      saving: false,
      error: null,
      formValues: {},
      fieldKinds: {},
    });

    vi.mocked(getRecordsFromResolvedSource).mockReset();
    vi.mocked(updateRecordFromResolvedSource).mockReset();
  });

  it('retries approve-only saves with typecast after a 422', async () => {
    const selectedRecord = createRecord();
    const onSuccess = vi.fn();

    useApprovalStore.getState().hydrateForm(selectedRecord, ['Title', 'Shopify Approved'], 'Shopify Approved');

    vi.mocked(updateRecordFromResolvedSource)
      .mockRejectedValueOnce(create422Error('Cannot parse value for field Shopify Approved'))
      .mockResolvedValueOnce(selectedRecord);
    vi.mocked(getRecordsFromResolvedSource).mockResolvedValueOnce([selectedRecord]);

    const result = await useApprovalStore.getState().saveRecord(
      true,
      selectedRecord,
      'tblApproval',
      'Approval',
      ['Title', 'Shopify Approved'],
      'Shopify Approved',
      onSuccess,
      'approve-only',
    );

    expect(result).toBe(true);
    expect(updateRecordFromResolvedSource).toHaveBeenNthCalledWith(
      1,
      'tblApproval',
      'Approval',
      'recApproval1',
      { 'Shopify Approved': 'TRUE' },
      undefined,
    );
    expect(updateRecordFromResolvedSource).toHaveBeenNthCalledWith(
      2,
      'tblApproval',
      'Approval',
      'recApproval1',
      { 'Shopify Approved': 'TRUE' },
      { typecast: true },
    );
    expect(getRecordsFromResolvedSource).toHaveBeenCalledWith('tblApproval', 'Approval');
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(useApprovalStore.getState().error).toBeNull();
  });

  it('returns a failure when the approve-only retry also fails', async () => {
    const selectedRecord = createRecord();

    useApprovalStore.getState().hydrateForm(selectedRecord, ['Title', 'Shopify Approved'], 'Shopify Approved');

    vi.mocked(updateRecordFromResolvedSource)
      .mockRejectedValueOnce(create422Error('Cannot parse value for field Shopify Approved'))
      .mockRejectedValueOnce(create422Error('Airtable still rejected value'));

    const result = await useApprovalStore.getState().saveRecord(
      true,
      selectedRecord,
      'tblApproval',
      'Approval',
      ['Title', 'Shopify Approved'],
      'Shopify Approved',
      vi.fn(),
      'approve-only',
    );

    expect(result).toBe(false);
    expect(updateRecordFromResolvedSource).toHaveBeenCalledTimes(2);
    expect(useApprovalStore.getState().error).toBe('Airtable still rejected value');
  });
});