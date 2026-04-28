import { beforeEach, describe, expect, it, vi } from 'vitest';
import airtableService from '@/services/airtable';
import {
  createConfiguredRecord,
  createRecordFromResolvedSource,
  deleteConfiguredRecord,
  deleteRecordFromResolvedSource,
  getConfiguredFieldMetadata,
  getConfiguredRecord,
  getConfiguredRecords,
  getListings,
  getRecordsFromResolvedSource,
  updateConfiguredRecord,
  updateRecordFromResolvedSource,
  uploadConfiguredAttachment,
} from '@/services/app-api/airtable';

vi.mock('@/services/airtable', () => ({
  default: {
    getRecords: vi.fn(),
    getRecord: vi.fn(),
    getRecordsFromReference: vi.fn(),
    getRecordFromReference: vi.fn(),
    createRecord: vi.fn(),
    updateRecord: vi.fn(),
    deleteRecord: vi.fn(),
    createRecordFromReference: vi.fn(),
    updateRecordFromReference: vi.fn(),
    deleteRecordFromReference: vi.fn(),
  },
}));

describe('app-api airtable', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_USE_LAMBDA_AIRTABLE', 'false');
    vi.stubEnv('VITE_APP_API_BASE_URL', '');
    fetchMock.mockReset();
    vi.mocked(airtableService.getRecords).mockReset();
    vi.mocked(airtableService.getRecordsFromReference).mockReset();
    vi.mocked(airtableService.createRecord).mockReset();
    vi.mocked(airtableService.updateRecord).mockReset();
    vi.mocked(airtableService.deleteRecord).mockReset();
    vi.mocked(airtableService.createRecordFromReference).mockReset();
    vi.mocked(airtableService.updateRecordFromReference).mockReset();
    vi.mocked(airtableService.deleteRecordFromReference).mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('delegates to the direct Airtable service when Lambda mode is off', async () => {
    vi.mocked(airtableService.getRecords).mockResolvedValue([{ id: 'rec1', fields: {}, createdTime: 'now' }]);

    const result = await getListings('tbl123', { view: 'viw123' });

    expect(airtableService.getRecords).toHaveBeenCalledWith('tbl123', { view: 'viw123' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual([{ id: 'rec1', fields: {}, createdTime: 'now' }]);
  });

  it('calls the Lambda endpoint when Lambda mode is on', async () => {
    vi.stubEnv('VITE_USE_LAMBDA_AIRTABLE', 'true');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ id: 'rec2', fields: { Name: 'Item' }, createdTime: 'later' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await getListings('tbl123', { view: 'viw123' });

    expect(fetchMock).toHaveBeenCalledWith('/api/airtable/listings?tableName=tbl123&view=viw123', {
      headers: { Accept: 'application/json' },
    });
    expect(result).toEqual([{ id: 'rec2', fields: { Name: 'Item' }, createdTime: 'later' }]);
  });

  it('normalizes Lambda Airtable failures into the direct service error shape', async () => {
    vi.stubEnv('VITE_USE_LAMBDA_AIRTABLE', 'true');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        message: 'Unsupported tableName',
        service: 'airtable',
        code: 'AIRTABLE_TABLE_NOT_ALLOWED',
        retryable: false,
      }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(getListings('tbl123')).rejects.toMatchObject({
      message: 'Failed to load Airtable records from tbl123.',
      serviceError: {
        service: 'airtable',
        code: 'AIRTABLE_GET_RECORDS_FAILED',
        userMessage: 'Failed to load Airtable records from tbl123.',
        retryable: false,
      },
    });
  });

  it('delegates configured users reads to the direct Airtable service when Lambda mode is off', async () => {
    vi.stubEnv('VITE_AIRTABLE_USERS_TABLE_REF', 'appUsers/tblUsers');
    vi.stubEnv('VITE_AIRTABLE_USERS_TABLE_NAME', 'Users');
    vi.mocked(airtableService.getRecordsFromReference).mockResolvedValue([{ id: 'user1', fields: {}, createdTime: 'now' }]);

    const result = await getConfiguredRecords('users');

    expect(airtableService.getRecordsFromReference).toHaveBeenCalledWith('appUsers/tblUsers', 'Users');
    expect(result).toEqual([{ id: 'user1', fields: {}, createdTime: 'now' }]);
  });

  it('calls the Lambda configured-records endpoint when Lambda mode is on', async () => {
    vi.stubEnv('VITE_USE_LAMBDA_AIRTABLE', 'true');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ id: 'rec3', fields: { Name: 'Inventory' }, createdTime: 'later' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await getConfiguredRecords('inventory-directory');

    expect(fetchMock).toHaveBeenCalledWith('/api/airtable/configured-records?source=inventory-directory', {
      headers: { Accept: 'application/json' },
    });
    expect(result).toEqual([{ id: 'rec3', fields: { Name: 'Inventory' }, createdTime: 'later' }]);
  });

  it('supports requesting a shaped configured-records list in Lambda mode', async () => {
    vi.stubEnv('VITE_USE_LAMBDA_AIRTABLE', 'true');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ id: 'recSlim', fields: { SKU: 'ABC' }, createdTime: 'later' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await getConfiguredRecords('inventory-directory', { fields: ['SKU', 'Status'] });

    expect(fetchMock).toHaveBeenCalledWith('/api/airtable/configured-records?source=inventory-directory&fields=SKU%2CStatus', {
      headers: { Accept: 'application/json' },
    });
    expect(result).toEqual([{ id: 'recSlim', fields: { SKU: 'ABC' }, createdTime: 'later' }]);
  });

  it('calls the Lambda configured single-record endpoint when Lambda mode is on', async () => {
    vi.stubEnv('VITE_USE_LAMBDA_AIRTABLE', 'true');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: 'recInv1', fields: { SKU: 'ABC' }, createdTime: 'now' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await getConfiguredRecord('inventory-directory', 'recInv1');

    expect(fetchMock).toHaveBeenCalledWith('/api/airtable/configured-records/inventory-directory/recInv1', {
      headers: { Accept: 'application/json' },
    });
    expect(result).toEqual({ id: 'recInv1', fields: { SKU: 'ABC' }, createdTime: 'now' });
  });

  it('delegates configured users writes to the direct Airtable service when Lambda mode is off', async () => {
    vi.stubEnv('VITE_AIRTABLE_USERS_TABLE_REF', 'appUsers/tblUsers');
    vi.stubEnv('VITE_AIRTABLE_USERS_TABLE_NAME', 'Users');
    vi.mocked(airtableService.getRecordsFromReference).mockResolvedValue([{ id: 'user1', fields: {}, createdTime: 'now' }]);
    vi.mocked(airtableService.createRecordFromReference).mockResolvedValue({ id: 'user2', fields: { Name: 'User' }, createdTime: 'now' });
    vi.mocked(airtableService.updateRecordFromReference).mockResolvedValue({ id: 'user2', fields: { Name: 'Updated' }, createdTime: 'later' });

    const created = await createConfiguredRecord('users', { Name: 'User' }, { typecast: true });
    const updated = await updateConfiguredRecord('users', 'user2', { Name: 'Updated' }, { typecast: true });
    await deleteConfiguredRecord('users', 'user2');

    expect(airtableService.createRecordFromReference).toHaveBeenCalledWith('appUsers/tblUsers', 'Users', { Name: 'User' }, { typecast: true });
    expect(airtableService.updateRecordFromReference).toHaveBeenCalledWith('appUsers/tblUsers', 'Users', 'user2', { Name: 'Updated' }, { typecast: true });
    expect(airtableService.deleteRecordFromReference).toHaveBeenCalledWith('appUsers/tblUsers', 'Users', 'user2');
    expect(created).toEqual({ id: 'user2', fields: { Name: 'User' }, createdTime: 'now' });
    expect(updated).toEqual({ id: 'user2', fields: { Name: 'Updated' }, createdTime: 'later' });
  });

  it('calls the Lambda configured users write endpoints when Lambda mode is on', async () => {
    vi.stubEnv('VITE_USE_LAMBDA_AIRTABLE', 'true');
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'user2', fields: { Name: 'User' }, createdTime: 'now' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'user2', fields: { Name: 'Updated' }, createdTime: 'later' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ deleted: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

    const created = await createConfiguredRecord('users', { Name: 'User' }, { typecast: true });
    const updated = await updateConfiguredRecord('users', 'user2', { Name: 'Updated' }, { typecast: true });
    await deleteConfiguredRecord('users', 'user2');

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/airtable/configured-records/users', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: { Name: 'User' }, typecast: true }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/airtable/configured-records/users/user2', {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: { Name: 'Updated' }, typecast: true }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/airtable/configured-records/users/user2', {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
      },
    });
    expect(created).toEqual({ id: 'user2', fields: { Name: 'User' }, createdTime: 'now' });
    expect(updated).toEqual({ id: 'user2', fields: { Name: 'Updated' }, createdTime: 'later' });
  });

  it('supports inventory-directory configured writes in Lambda mode', async () => {
    vi.stubEnv('VITE_USE_LAMBDA_AIRTABLE', 'true');
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'recInv1', fields: { SKU: 'ABC' }, createdTime: 'now' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'recInv1', fields: { SKU: 'XYZ' }, createdTime: 'later' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

    const created = await createConfiguredRecord('inventory-directory', { SKU: 'ABC' }, { typecast: true });
    const updated = await updateConfiguredRecord('inventory-directory', 'recInv1', { SKU: 'XYZ' }, { typecast: true });

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/airtable/configured-records/inventory-directory', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: { SKU: 'ABC' }, typecast: true }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/airtable/configured-records/inventory-directory/recInv1', {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: { SKU: 'XYZ' }, typecast: true }),
    });
    expect(created).toEqual({ id: 'recInv1', fields: { SKU: 'ABC' }, createdTime: 'now' });
    expect(updated).toEqual({ id: 'recInv1', fields: { SKU: 'XYZ' }, createdTime: 'later' });
  });

  it('resolves approval writes through the direct Airtable service when Lambda mode is off', async () => {
    vi.stubEnv('VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF', 'appShopify/viwShopify');
    vi.stubEnv('VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME', 'tblShopifyApproval');
    vi.mocked(airtableService.createRecordFromReference).mockResolvedValue({
      id: 'recApproval1',
      fields: { Title: 'Draft' },
      createdTime: 'now',
    });
    vi.mocked(airtableService.updateRecordFromReference).mockResolvedValue({
      id: 'recApproval1',
      fields: { Title: 'Published' },
      createdTime: 'later',
    });

    const created = await createRecordFromResolvedSource(
      'appShopify/viwShopify',
      'tblShopifyApproval',
      { Title: 'Draft' },
      { typecast: true },
    );
    const updated = await updateRecordFromResolvedSource(
      'appShopify/viwShopify',
      'tblShopifyApproval',
      'recApproval1',
      { Title: 'Published' },
      { typecast: true },
    );

    expect(airtableService.createRecordFromReference).toHaveBeenCalledWith(
      'appShopify/viwShopify',
      'tblShopifyApproval',
      { Title: 'Draft' },
      { typecast: true },
    );
    expect(airtableService.updateRecordFromReference).toHaveBeenCalledWith(
      'appShopify/viwShopify',
      'tblShopifyApproval',
      'recApproval1',
      { Title: 'Published' },
      { typecast: true },
    );
    expect(created).toEqual({ id: 'recApproval1', fields: { Title: 'Draft' }, createdTime: 'now' });
    expect(updated).toEqual({ id: 'recApproval1', fields: { Title: 'Published' }, createdTime: 'later' });
  });

  it('resolves approval writes through the Lambda configured-record endpoint when Lambda mode is on', async () => {
    vi.stubEnv('VITE_USE_LAMBDA_AIRTABLE', 'true');
    vi.stubEnv('VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF', 'appShopify/viwShopify');
    vi.stubEnv('VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME', 'tblShopifyApproval');
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'recApproval1', fields: { Title: 'Draft' }, createdTime: 'now' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'recApproval1', fields: { Title: 'Published' }, createdTime: 'later' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

    const created = await createRecordFromResolvedSource(
      'appShopify/viwShopify',
      'tblShopifyApproval',
      { Title: 'Draft' },
      { typecast: true },
    );
    const updated = await updateRecordFromResolvedSource(
      'appShopify/viwShopify',
      'tblShopifyApproval',
      'recApproval1',
      { Title: 'Published' },
      { typecast: true },
    );

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/airtable/configured-records/approval-shopify', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: { Title: 'Draft' }, typecast: true }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/airtable/configured-records/approval-shopify/recApproval1', {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: { Title: 'Published' }, typecast: true }),
    });
    expect(created).toEqual({ id: 'recApproval1', fields: { Title: 'Draft' }, createdTime: 'now' });
    expect(updated).toEqual({ id: 'recApproval1', fields: { Title: 'Published' }, createdTime: 'later' });
  });

  it('resolves Shopify approval reads by reference when the Shopify approval table name is missing', async () => {
    vi.stubEnv('VITE_USE_LAMBDA_AIRTABLE', 'true');
    vi.stubEnv('VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF', 'appShopify/viwShopify');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ id: 'recApproval1', fields: { Title: 'Draft' }, createdTime: 'now' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const records = await getRecordsFromResolvedSource('appShopify/viwShopify', undefined);

    expect(fetchMock).toHaveBeenCalledWith('/api/airtable/configured-records?source=approval-shopify', {
      headers: { Accept: 'application/json' },
    });
    expect(records).toEqual([{ id: 'recApproval1', fields: { Title: 'Draft' }, createdTime: 'now' }]);
  });

  it('resolves approval deletes through the Lambda configured-record endpoint when Lambda mode is on', async () => {
    vi.stubEnv('VITE_USE_LAMBDA_AIRTABLE', 'true');
    vi.stubEnv('VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF', 'appShopify/viwShopify');
    vi.stubEnv('VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME', 'tblShopifyApproval');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ deleted: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await deleteRecordFromResolvedSource('appShopify/viwShopify', 'tblShopifyApproval', 'recApproval1');

    expect(fetchMock).toHaveBeenCalledWith('/api/airtable/configured-records/approval-shopify/recApproval1', {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
      },
    });
  });

  it('calls the Lambda configured metadata endpoint when Lambda mode is on', async () => {
    vi.stubEnv('VITE_USE_LAMBDA_AIRTABLE', 'true');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ id: 'fld1', name: 'Status', type: 'singleSelect', options: { choices: [{ name: 'Ready' }] } }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await getConfiguredFieldMetadata('inventory-directory');

    expect(fetchMock).toHaveBeenCalledWith('/api/airtable/configured-metadata?source=inventory-directory', {
      headers: { Accept: 'application/json' },
    });
    expect(result).toEqual([{ id: 'fld1', name: 'Status', type: 'singleSelect', options: { choices: [{ name: 'Ready' }] } }]);
  });

  it('calls the Lambda configured attachment endpoint when Lambda mode is on', async () => {
    vi.stubEnv('VITE_USE_LAMBDA_AIRTABLE', 'true');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ uploaded: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const file = new File(['abc'], 'photo.jpg', { type: 'image/jpeg' });
    await uploadConfiguredAttachment('inventory-directory', 'rec123', 'fldMXp0EaUHGglU8M', file);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/airtable/configured-attachments/inventory-directory/rec123/fldMXp0EaUHGglU8M');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
    expect(typeof init.body).toBe('string');
    expect(JSON.parse(init.body as string)).toMatchObject({
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
    });
  });
});