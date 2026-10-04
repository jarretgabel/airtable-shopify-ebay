import { getRecordsFromResolvedSource, updateRecordFromResolvedSource } from '@/services/app-api/airtable';
import { mapShippingServiceToFields, SHIPPING_SERVICE_FIELD } from '@/stores/approvalStore';
import { fromFormValueForField, getDropdownOptions } from '@/stores/approval/approvalStoreFieldUtils';
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
    expect(getRecordsFromResolvedSource).toHaveBeenCalledWith(
      'tblApproval',
      'Approval',
      expect.objectContaining({ fields: expect.any(Array) }),
    );
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

  it('hydrates workflow-derived listing values into blank approval fields', () => {
    const selectedRecord: AirtableRecord = {
      id: 'recWorkflow1',
      createdTime: '2026-05-07T00:00:00.000Z',
      fields: {
        'Workflow Status': 'Approved for Publish',
        Make: 'Accuphase',
        Model: 'E-470',
        'Inventory Notes': 'One-owner unit with fresh service notes.',
        'Internal Functional Notes': 'Passed all bench tests.',
      },
    };

    useApprovalStore.getState().hydrateForm(
      selectedRecord,
      ['Shopify REST Title', 'Description', 'Testing Notes', 'Shopify Approved'],
      'Shopify Approved',
    );

    expect(useApprovalStore.getState().formValues).toEqual(expect.objectContaining({
      'Shopify REST Title': 'Accuphase E-470',
      Description: 'One-owner unit with fresh service notes.',
      'Testing Notes': 'Functional Notes: Passed all bench tests.',
    }));
  });

  it('mirrors canonical price values into eBay price alias fields during hydrate', () => {
    const selectedRecord: AirtableRecord = {
      id: 'recPriceMirror1',
      createdTime: '2026-05-08T00:00:00.000Z',
      fields: {
        Price: '1899.00',
        'eBay Offer Price Value': '',
      },
    };

    useApprovalStore.getState().hydrateForm(
      selectedRecord,
      ['Price', 'eBay Offer Price Value', 'Shopify Approved'],
      'Shopify Approved',
    );

    expect(useApprovalStore.getState().formValues).toEqual(expect.objectContaining({
      Price: '1899.00',
      'eBay Offer Price Value': '1899.00',
    }));
  });

  it('mirrors Shopify Type into the visible Type field during hydrate', () => {
    const selectedRecord: AirtableRecord = {
      id: 'recShopifyTypeMirror1',
      createdTime: '2026-05-08T00:00:00.000Z',
      fields: {
        'Shopify Type': 'Electronics > Audio > Receivers',
        Type: '',
      },
    };

    useApprovalStore.getState().hydrateForm(
      selectedRecord,
      ['Shopify Type', 'Type'],
      'Shopify Approved',
    );

    expect(useApprovalStore.getState().formValues).toEqual(expect.objectContaining({
      'Shopify Type': 'Electronics > Audio > Receivers',
      Type: 'Electronics > Audio > Receivers',
    }));
  });

  it('preserves multiple explicit eBay shipping services during save mapping', () => {
    expect(mapShippingServiceToFields({
      '__Shipping Services__': 'UPS Ground',
      'Ebay Domestic Service 1': 'UPS Ground',
      'Ebay Domestic Service 2': 'UPS 3-Day Select',
      'Ebay International Service 1': '',
      'Ebay International Service 2': '',
    })).toEqual({
      '__Shipping Services__': 'UPS Ground',
      'Ebay Domestic Service 1': 'UPS Ground',
      'Ebay Domestic Service 2': 'UPS 3-Day Select',
      'Ebay International Service 1': '',
      'Ebay International Service 2': '',
    });
  });

  it('hydrates the shipping services editor from prefixed Airtable service fields', () => {
    const selectedRecord: AirtableRecord = {
      id: 'recEbayShippingServiceHydrate1',
      createdTime: '2026-05-08T00:00:00.000Z',
      fields: {
        'Ebay International Service 1': 'International',
      },
    };

    useApprovalStore.getState().hydrateForm(
      selectedRecord,
      ['Ebay International Service 1'],
      'Ebay Approved',
    );

    expect(useApprovalStore.getState().formValues[SHIPPING_SERVICE_FIELD]).toBe('International');
  });

  it('uses destination-specific options for canonical eBay shipping service fields', () => {
    expect(getDropdownOptions('Ebay Domestic Service 1')).toEqual(['UPS Ground', 'UPS 3-Day Select']);
    expect(getDropdownOptions('Ebay International Service 1')).toEqual([
      'International',
      'USPS Priority Mail International',
      'eBay International Standard Delivery',
    ]);
  });

  it('serializes editor category and collection values as Airtable multi-select arrays', () => {
    expect(fromFormValueForField('Ebay Categories', '14981, 12345', 'json')).toEqual(['14981', '12345']);
    expect(fromFormValueForField('Shopify Collections', '["Vintage Audio", "Receivers"]', 'json')).toEqual([
      'Vintage Audio',
      'Receivers',
    ]);
  });

  it('mirrors Buy It Now Price into the visible eBay offer price field during hydrate', () => {
    const selectedRecord: AirtableRecord = {
      id: 'recBuyItNowPriceMirror1',
      createdTime: '2026-05-08T00:00:00.000Z',
      fields: {
        'Buy It Now Price': 2299,
        'eBay Offer Price Value': '',
      },
    };

    useApprovalStore.getState().hydrateForm(
      selectedRecord,
      ['Buy It Now Price', 'eBay Offer Price Value'],
      'eBay Offer Price Value',
    );

    expect(useApprovalStore.getState().formValues).toEqual(expect.objectContaining({
      'Buy It Now Price': '2299',
      'eBay Offer Price Value': '2299',
    }));
  });
});