import type { AirtableRecord } from '@/types/airtable'

export interface CreateNewShopifyListingRecordParams {
  defaultTitle: string
  tableReference: string
  tableName?: string
  titleCandidates: string[]
}

export interface CreateNewShopifyListingRecordDependencies {
  createRecord: (
    tableReference: string,
    tableName: string | undefined,
    fields: Record<string, string>,
    options: { typecast: boolean },
  ) => Promise<AirtableRecord>
}

export async function createNewShopifyListingRecord(
  params: CreateNewShopifyListingRecordParams,
  dependencies: CreateNewShopifyListingRecordDependencies,
): Promise<AirtableRecord> {
  const { defaultTitle, tableReference, tableName, titleCandidates } = params
  const { createRecord } = dependencies

  const normalizedTitleCandidates = Array.from(new Set(
    titleCandidates
      .map((fieldName) => fieldName.trim())
      .filter((fieldName) => fieldName.length > 0),
  ))

  let createdRecord: AirtableRecord | null = null
  let lastError: unknown = null

  for (const titleField of normalizedTitleCandidates) {
    try {
      createdRecord = await createRecord(
        tableReference,
        tableName,
        { [titleField]: defaultTitle },
        { typecast: true },
      )
      break
    } catch (error) {
      lastError = error
    }
  }

  if (!createdRecord) {
    throw lastError ?? new Error('Unable to create a new Shopify listing row in Airtable.')
  }

  return createdRecord
}