export interface ShopifyProductIdWritebackParams {
  fieldName: string;
  productId: number | string;
  recordId: string;
  tableReference?: string;
  tableName?: string;
}

export interface ShopifyProductIdWritebackDependencies {
  updateRecord: (
    tableReference: string | undefined,
    tableName: string | undefined,
    recordId: string,
    fields: Record<string, string | number>,
  ) => Promise<unknown>;
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
  params: ShopifyProductIdWritebackParams,
  dependencies: ShopifyProductIdWritebackDependencies,
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