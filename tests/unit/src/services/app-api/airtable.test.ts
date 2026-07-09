import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createConfiguredRecord,
  createRecordFromResolvedSource,
  deleteConfiguredRecord,
  deleteRecordFromResolvedSource,
  getConfiguredFieldMetadata,
  getConfiguredRecord,
  getConfiguredRecords,
  getConfiguredRecordsSummary,
  getListings,
  getRecordsFromResolvedSource,
  getRecordsSummaryFromResolvedSource,
  updateConfiguredRecord,
  updateRecordFromResolvedSource,
  uploadConfiguredAttachment,
} from '@/services/app-api/airtable';

describe('app-api airtable', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    window.__APP_RUNTIME_CONFIG__ = { VITE_APP_API_BASE_URL: '' };
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_APP_API_BASE_URL', '');
    vi.stubEnv('VITE_AIRTABLE_API_KEY', '');
    fetchMock.mockReset();
  });

  afterEach(() => {
    window.__APP_RUNTIME_CONFIG__ = {};
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('calls the Lambda listings endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ id: 'rec2', fields: { Name: 'Item' }, createdTime: 'later' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await getListings('tbl123', { view: 'viw123' });

    expect(fetchMock).toHaveBeenCalledWith('/api/airtable/listings?tableName=tbl123&view=viw123', {
      cache: 'no-store',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    expect(result).toEqual([{ id: 'rec2', fields: { Name: 'Item' }, createdTime: 'later' }]);
  });

  it('normalizes Lambda Airtable failures into the direct service error shape', async () => {
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

  it('calls the Lambda configured-records endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ id: 'rec3', fields: { Name: 'Inventory' }, createdTime: 'later' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await getConfiguredRecords('inventory-directory');

    expect(fetchMock).toHaveBeenCalledWith('/api/airtable/configured-records?source=inventory-directory', {
      cache: 'no-store',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    expect(result).toEqual([{ id: 'rec3', fields: { Name: 'Inventory' }, createdTime: 'later' }]);
  });

  it('supports requesting a shaped configured-records list in Lambda mode', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ id: 'recSlim', fields: { SKU: 'ABC' }, createdTime: 'later' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await getConfiguredRecords('inventory-directory', { fields: ['SKU', 'Status'] });

    expect(fetchMock).toHaveBeenCalledWith('/api/airtable/configured-records?source=inventory-directory&fields=SKU%2CStatus', {
      cache: 'no-store',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    expect(result).toEqual([{ id: 'recSlim', fields: { SKU: 'ABC' }, createdTime: 'later' }]);
  });

  it('supports requesting configured-record subsets in Lambda mode', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ id: 'recReady', fields: { Title: 'Amp' }, createdTime: 'later' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await getConfiguredRecords('approval-combined', { subset: 'ready-for-publishing' });

    expect(fetchMock).toHaveBeenCalledWith('/api/airtable/configured-records?source=approval-combined&subset=ready-for-publishing', {
      cache: 'no-store',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    expect(result).toEqual([{ id: 'recReady', fields: { Title: 'Amp' }, createdTime: 'later' }]);
  });

  it('supports requesting listings-page subset in Lambda mode', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ id: 'recList1', fields: { Title: 'Receiver' }, createdTime: 'later' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await getConfiguredRecords('approval-combined', { subset: 'listings-page' });

    expect(fetchMock).toHaveBeenCalledWith('/api/airtable/configured-records?source=approval-combined&subset=listings-page', {
      cache: 'no-store',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    expect(result).toEqual([{ id: 'recList1', fields: { Title: 'Receiver' }, createdTime: 'later' }]);
  });

  it('supports requesting maxRecords in Lambda mode', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ id: 'recList2', fields: { Title: 'Preamp' }, createdTime: 'later' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await getConfiguredRecords('approval-combined', { subset: 'listings-page', maxRecords: 150 });

    expect(fetchMock).toHaveBeenCalledWith('/api/airtable/configured-records?source=approval-combined&subset=listings-page&maxRecords=150', {
      cache: 'no-store',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    expect(result).toEqual([{ id: 'recList2', fields: { Title: 'Preamp' }, createdTime: 'later' }]);
  });

  it('calls the configured-records summary mode', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ total: 12, approved: 4, pending: 8 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await getConfiguredRecordsSummary('approval-ebay');

    expect(fetchMock).toHaveBeenCalledWith('/api/airtable/configured-records?source=approval-ebay&summary=queue', {
      cache: 'no-store',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    expect(result).toEqual({ total: 12, approved: 4, pending: 8 });
  });

  it('calls the Lambda configured single-record endpoint when Lambda mode is on', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: 'recInv1', fields: { SKU: 'ABC' }, createdTime: 'now' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await getConfiguredRecord('inventory-directory', 'recInv1');

    expect(fetchMock).toHaveBeenCalledWith('/api/airtable/configured-records/inventory-directory/recInv1', {
      cache: 'no-store',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    expect(result).toEqual({ id: 'recInv1', fields: { SKU: 'ABC' }, createdTime: 'now' });
  });

  it('calls the Lambda configured users write endpoints', async () => {
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
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: { Name: 'User' }, typecast: true }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/airtable/configured-records/users/user2', {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: { Name: 'Updated' }, typecast: true }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/airtable/configured-records/users/user2', {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });
    expect(created).toEqual({ id: 'user2', fields: { Name: 'User' }, createdTime: 'now' });
    expect(updated).toEqual({ id: 'user2', fields: { Name: 'Updated' }, createdTime: 'later' });
  });

  it('supports inventory-directory configured writes in Lambda mode', async () => {
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
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: { SKU: 'ABC' }, typecast: true }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/airtable/configured-records/inventory-directory/recInv1', {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: { SKU: 'XYZ' }, typecast: true }),
    });
    expect(created).toEqual({ id: 'recInv1', fields: { SKU: 'ABC' }, createdTime: 'now' });
    expect(updated).toEqual({ id: 'recInv1', fields: { SKU: 'XYZ' }, createdTime: 'later' });
  });

  it('supports used-gear-workflow configured writes in Lambda mode', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: 'recWorkflow1', fields: { 'Workflow Status': 'Pending Review' }, createdTime: 'now' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const updated = await updateConfiguredRecord('used-gear-workflow', 'recWorkflow1', {
      'Workflow Status': 'Accepted - Awaiting Arrival',
    }, { typecast: true });

    expect(fetchMock).toHaveBeenCalledWith('/api/airtable/configured-records/used-gear-workflow/recWorkflow1', {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: { 'Workflow Status': 'Accepted - Awaiting Arrival' },
        typecast: true,
      }),
    });
    expect(updated).toEqual({ id: 'recWorkflow1', fields: { 'Workflow Status': 'Pending Review' }, createdTime: 'now' });
  });

  it('resolves approval writes through the Lambda configured-record endpoint', async () => {
    window.__APP_RUNTIME_CONFIG__ = {
      VITE_APP_API_BASE_URL: '',
      VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF: 'appShopify/viwShopify',
      VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME: 'tblShopifyApproval',
    };
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
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields: { Title: 'Draft' }, typecast: true }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/airtable/configured-records/approval-shopify/recApproval1', {
      method: 'PATCH',
      credentials: 'include',
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
    window.__APP_RUNTIME_CONFIG__ = {
      VITE_APP_API_BASE_URL: '',
      VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF: 'appShopify/viwShopify',
    };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ id: 'recApproval1', fields: { Title: 'Draft' }, createdTime: 'now' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const records = await getRecordsFromResolvedSource('appShopify/viwShopify', undefined);

    expect(fetchMock).toHaveBeenCalledWith('/api/airtable/configured-records?source=approval-shopify', {
      cache: 'no-store',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    expect(records).toEqual([{ id: 'recApproval1', fields: { Title: 'Draft' }, createdTime: 'now' }]);
  });

  it('resolves approval summary reads through the Lambda configured-records summary mode', async () => {
    window.__APP_RUNTIME_CONFIG__ = {
      VITE_APP_API_BASE_URL: '',
      VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF: 'appShopify/viwShopify',
    };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ total: 9, approved: 3, pending: 6 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await getRecordsSummaryFromResolvedSource('appShopify/viwShopify', undefined);

    expect(fetchMock).toHaveBeenCalledWith('/api/airtable/configured-records?source=approval-shopify&summary=queue', {
      cache: 'no-store',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    expect(result).toEqual({ total: 9, approved: 3, pending: 6 });
  });

  it('prefers approval-combined when approval sources share the same Airtable reference', async () => {
    window.__APP_RUNTIME_CONFIG__ = {
      VITE_APP_API_BASE_URL: '',
      VITE_AIRTABLE_APPROVAL_TABLE_REF: 'appShared/tblShared/viwShared',
      VITE_AIRTABLE_APPROVAL_TABLE_NAME: 'tblShared',
      VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF: 'appShared/tblShared/viwShared',
      VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME: 'tblShared',
      VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF: 'appShared/tblShared/viwShared',
      VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME: 'tblShared',
    };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ id: 'recCombined1', fields: { Title: 'Combined' }, createdTime: 'now' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const records = await getRecordsFromResolvedSource('appShared/tblShared/viwShared', 'tblShared');

    expect(fetchMock).toHaveBeenCalledWith('/api/airtable/configured-records?source=approval-combined', {
      cache: 'no-store',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    expect(records).toEqual([{ id: 'recCombined1', fields: { Title: 'Combined' }, createdTime: 'now' }]);
  });

  it('resolves approval deletes through the Lambda configured-record endpoint', async () => {
    window.__APP_RUNTIME_CONFIG__ = {
      VITE_APP_API_BASE_URL: '',
      VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF: 'appShopify/viwShopify',
      VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME: 'tblShopifyApproval',
    };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ deleted: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await deleteRecordFromResolvedSource('appShopify/viwShopify', 'tblShopifyApproval', 'recApproval1');

    expect(fetchMock).toHaveBeenCalledWith('/api/airtable/configured-records/approval-shopify/recApproval1', {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    });
  });

  it('calls the Lambda configured metadata endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ id: 'fld1', name: 'Status', type: 'singleSelect', options: { choices: [{ name: 'Ready' }] } }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await getConfiguredFieldMetadata('inventory-directory');

    expect(fetchMock).toHaveBeenCalledWith('/api/airtable/configured-metadata?source=inventory-directory', {
      cache: 'no-store',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    expect(result).toEqual([{ id: 'fld1', name: 'Status', type: 'singleSelect', options: { choices: [{ name: 'Ready' }] } }]);
  });

  it('supports used-gear-workflow as a configured metadata source', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ id: 'fld2', name: 'Price', type: 'currency' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await getConfiguredFieldMetadata('used-gear-workflow');

    expect(fetchMock).toHaveBeenCalledWith('/api/airtable/configured-metadata?source=used-gear-workflow', {
      cache: 'no-store',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    expect(result).toEqual([{ id: 'fld2', name: 'Price', type: 'currency' }]);
  });

  it('calls the Lambda configured attachment endpoint', async () => {
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
    expect(init.credentials).toBe('include');
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

  it('supports archive-only workflow uploads and returns archive metadata', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        uploaded: false,
        archived: true,
        archive: {
          folderId: 'folder-1',
          original: {
            id: 'file-original',
            filename: 'testing-original.jpg',
            url: 'https://drive.google.com/uc?export=view&id=file-original',
          },
          processed: {
            id: 'file-processed',
            filename: 'testing-processed.jpg',
            url: 'https://drive.google.com/uc?export=view&id=file-processed',
          },
        },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const originalFile = new File(['original'], 'testing-original.jpg', { type: 'image/jpeg' });
    const processedFile = new File(['processed'], 'testing-processed.jpg', { type: 'image/jpeg' });
    const result = await uploadConfiguredAttachment('used-gear-workflow', 'rec123', 'fld1zIzmZEciQECah', processedFile, {
      archiveOnly: true,
      driveArchive: {
        stage: 'testing',
        originalFile,
      },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({
      filename: 'testing-processed.jpg',
      contentType: 'image/jpeg',
      archiveOnly: true,
      driveArchive: {
        stage: 'testing',
        original: {
          filename: 'testing-original.jpg',
          contentType: 'image/jpeg',
        },
      },
    });
    expect(result).toEqual({
      uploaded: false,
      archived: true,
      archive: {
        folderId: 'folder-1',
        original: {
          id: 'file-original',
          filename: 'testing-original.jpg',
          url: 'https://drive.google.com/uc?export=view&id=file-original',
        },
        processed: {
          id: 'file-processed',
          filename: 'testing-processed.jpg',
          url: 'https://drive.google.com/uc?export=view&id=file-processed',
        },
      },
    });
  });
});