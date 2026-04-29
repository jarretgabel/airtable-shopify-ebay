import { resolveConfiguredRecordsSource, type AirtableConfiguredRecordsSource } from '@/services/app-api/airtableSources';
import type { AirtableRecord } from '@/types/airtable';
import type { ShopifyProduct } from '@/types/shopify';

export interface ShopifyApprovalNotice {
  tone: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
}

export function resolveApprovalPublishSource(
  approvalChannel: 'shopify' | 'ebay' | 'combined',
  tableReference: string | undefined,
  tableName: string | undefined,
): AirtableConfiguredRecordsSource {
  return resolveConfiguredRecordsSource(tableReference, tableName)
    || (approvalChannel === 'shopify'
      ? 'approval-shopify'
      : approvalChannel === 'combined'
        ? 'approval-combined'
        : 'approval-ebay');
}

export async function createNewShopifyListingRecord(params: {
  defaultTitle: string;
  tableReference: string;
  tableName?: string;
  titleCandidates: string[];
}, dependencies: {
  createRecord: (
    nextTableReference: string,
    nextTableName: string | undefined,
    fields: Record<string, string>,
    options: { typecast: boolean },
  ) => Promise<AirtableRecord>;
}): Promise<AirtableRecord> {
  const { defaultTitle, tableReference, tableName, titleCandidates } = params;
  const { createRecord } = dependencies;

  const normalizedTitleCandidates = Array.from(new Set(
    titleCandidates
      .map((fieldName) => fieldName.trim())
      .filter((fieldName) => fieldName.length > 0),
  ));

  let createdRecord: AirtableRecord | null = null;
  let lastError: unknown = null;

  for (const titleField of normalizedTitleCandidates) {
    try {
      createdRecord = await createRecord(
        tableReference,
        tableName,
        { [titleField]: defaultTitle },
        { typecast: true },
      );
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!createdRecord) {
    throw lastError ?? new Error('Unable to create a new Shopify listing row in Airtable.');
  }

  return createdRecord;
}

export function buildShopifyProductIdWritebackAttempts(
  fieldName: string,
  productId: number | string,
): Array<Record<string, string | number>> {
  const productIdStr = String(productId);
  const productIdNum = Number(productId);

  return Number.isFinite(productIdNum)
    ? [
        { [fieldName]: productIdNum },
        { [fieldName]: productIdStr },
      ]
    : [{ [fieldName]: productIdStr }];
}

export async function writeShopifyProductIdToAirtable(
  params: {
    fieldName: string;
    productId: number | string;
    recordId: string;
    tableReference?: string;
    tableName?: string;
  },
  dependencies: {
    updateRecord: (
      nextTableReference: string | undefined,
      nextTableName: string | undefined,
      recordId: string,
      fields: Record<string, string | number>,
    ) => Promise<unknown>;
  },
): Promise<{ productId: string; wrote: boolean; lastError: unknown | null }> {
  const { fieldName, productId, recordId, tableReference, tableName } = params;
  const { updateRecord } = dependencies;

  const productIdStr = String(productId);
  const writebackAttempts = buildShopifyProductIdWritebackAttempts(fieldName, productId);

  let lastError: unknown | null = null;

  for (const fields of writebackAttempts) {
    try {
      await updateRecord(tableReference, tableName, recordId, fields);
      return {
        productId: productIdStr,
        wrote: true,
        lastError: null,
      };
    } catch (error) {
      lastError = error;
    }
  }

  return {
    productId: productIdStr,
    wrote: false,
    lastError,
  };
}

export async function updateApprovedShopifyListing(
  params: {
    existingProductId: string;
    record: AirtableRecord;
  },
  dependencies: {
    syncExistingShopifyListing: (record: AirtableRecord, productId: number) => Promise<void>;
    describeError: (error: unknown) => string;
  },
): Promise<ShopifyApprovalNotice> {
  const { existingProductId, record } = params;
  const { describeError, syncExistingShopifyListing } = dependencies;

  const normalizedProductId = existingProductId.trim();
  const parsedExistingId = Number(normalizedProductId);

  if (!Number.isFinite(parsedExistingId) || parsedExistingId <= 0) {
    return {
      tone: 'error',
      title: 'Listing update failed',
      message: 'A valid Shopify REST Product ID is required to update an approved listing.',
    };
  }

  try {
    await syncExistingShopifyListing(record, parsedExistingId);
    return {
      tone: 'success',
      title: 'Shopify listing updated',
      message: `Listing #${normalizedProductId} was updated with the latest saved fields.`,
    };
  } catch (error) {
    return {
      tone: 'error',
      title: 'Shopify listing update failed',
      message: describeError(error),
    };
  }
}

export async function ensureShopifyDraftBeforeApproval(
  params: {
    existingProductId: string;
    productIdFieldName: string;
    createPayload: ShopifyProduct;
    record: AirtableRecord;
    collectionIds: string[];
    tableReference?: string;
    tableName?: string;
  },
  dependencies: {
    getShopifyProduct: (productId: number) => Promise<unknown>;
    syncExistingShopifyListing: (record: AirtableRecord, productId: number) => Promise<void>;
    describeError: (error: unknown) => string;
    resolveShopifyCategoryId: () => Promise<string | undefined>;
    upsertShopifyProductWithCollectionFallback: (params: {
      product: ShopifyProduct;
      categoryId?: string;
      collectionIds?: string[];
      existingProductId?: number;
    }) => Promise<{ id: number }>;
    writeShopifyProductIdToAirtable: (params: {
      fieldName: string;
      productId: number | string;
      recordId: string;
      tableReference?: string;
      tableName?: string;
    }) => Promise<{ productId: string; wrote: boolean; lastError: unknown | null }>;
  },
): Promise<{
  notices: ShopifyApprovalNotice[];
  nextProductIdFieldValue?: string;
  createdProductId?: number;
  status: 'existing-updated' | 'created' | 'update-failed' | 'creation-failed';
}> {
  const {
    collectionIds,
    createPayload,
    existingProductId,
    productIdFieldName,
    record,
    tableName,
    tableReference,
  } = params;
  const {
    describeError,
    getShopifyProduct,
    resolveShopifyCategoryId,
    syncExistingShopifyListing,
    upsertShopifyProductWithCollectionFallback,
    writeShopifyProductIdToAirtable,
  } = dependencies;

  const normalizedExistingProductId = existingProductId.trim();
  let nextProductIdFieldValue: string | undefined;

  if (normalizedExistingProductId) {
    const parsedExistingId = Number(normalizedExistingProductId);

    if (Number.isFinite(parsedExistingId) && parsedExistingId > 0) {
      const existingProduct = await getShopifyProduct(parsedExistingId);

      if (existingProduct) {
        try {
          await syncExistingShopifyListing(record, parsedExistingId);
          return {
            status: 'existing-updated',
            notices: [
              {
                tone: 'success',
                title: 'Shopify draft updated',
                message: `Draft product #${normalizedExistingProductId} was updated with the latest listing fields before approval.`,
              },
              {
                tone: 'info',
                title: 'Shopify draft already exists',
                message: `Product #${normalizedExistingProductId} already existed, so it was updated instead of creating a duplicate draft.`,
              },
            ],
          };
        } catch (error) {
          return {
            status: 'update-failed',
            notices: [{
              tone: 'error',
              title: 'Shopify draft update failed',
              message: describeError(error),
            }],
          };
        }
      }

      nextProductIdFieldValue = '';
      const categoryId = await resolveShopifyCategoryId();
      try {
        const createdProduct = await upsertShopifyProductWithCollectionFallback({
          product: createPayload,
          categoryId,
          collectionIds,
        });
        const writebackResult = await writeShopifyProductIdToAirtable({
          fieldName: productIdFieldName,
          productId: createdProduct.id,
          recordId: record.id,
          tableReference,
          tableName,
        });

        return {
          status: 'created',
          createdProductId: createdProduct.id,
          nextProductIdFieldValue: writebackResult.wrote ? writebackResult.productId : '',
          notices: [
            {
              tone: 'warning',
              title: 'Cleared stale Shopify product ID',
              message: `Saved product ID #${normalizedExistingProductId} was not found in Shopify. Creating a new draft now.`,
            },
            ...(writebackResult.wrote ? [] : [{
              tone: 'warning' as const,
              title: 'Draft created, ID writeback failed',
              message: 'Shopify draft was created, but writing Shopify REST Product ID to Airtable failed. You may need to save the ID manually.',
            }]),
            {
              tone: 'success',
              title: 'Shopify draft created',
              message: `Draft product #${writebackResult.productId} was created before approval completion.`,
            },
          ],
        };
      } catch (error) {
        return {
          status: 'creation-failed',
          nextProductIdFieldValue,
          notices: [
            {
              tone: 'warning',
              title: 'Cleared stale Shopify product ID',
              message: `Saved product ID #${normalizedExistingProductId} was not found in Shopify. Creating a new draft now.`,
            },
            {
              tone: 'error',
              title: 'Shopify draft creation failed',
              message: describeError(error),
            },
          ],
        };
      }
    }

    nextProductIdFieldValue = '';
  }

  const categoryId = await resolveShopifyCategoryId();

  try {
    const createdProduct = await upsertShopifyProductWithCollectionFallback({
      product: createPayload,
      categoryId,
      collectionIds,
    });
    const writebackResult = await writeShopifyProductIdToAirtable({
      fieldName: productIdFieldName,
      productId: createdProduct.id,
      recordId: record.id,
      tableReference,
      tableName,
    });

    return {
      status: 'created',
      createdProductId: createdProduct.id,
      nextProductIdFieldValue: writebackResult.wrote ? writebackResult.productId : nextProductIdFieldValue ?? '',
      notices: [
        ...(writebackResult.wrote ? [] : [{
          tone: 'warning' as const,
          title: 'Draft created, ID writeback failed',
          message: 'Shopify draft was created, but writing Shopify REST Product ID to Airtable failed. You may need to save the ID manually.',
        }]),
        {
          tone: 'success',
          title: 'Shopify draft created',
          message: `Draft product #${writebackResult.productId} was created before approval completion.`,
        },
      ],
    };
  } catch (error) {
    return {
      status: 'creation-failed',
      nextProductIdFieldValue,
      notices: [{
        tone: 'error',
        title: 'Shopify draft creation failed',
        message: describeError(error),
      }],
    };
  }
}