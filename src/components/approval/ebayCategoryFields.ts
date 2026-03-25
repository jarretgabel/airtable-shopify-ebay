function normalizeCategoryToken(token: string): string {
  return token
    .trim()
    .replace(/^['"\[{\(]+/, '')
    .replace(/['"\]}\)]+$/, '')
    .trim()
}

function extractNumericCategoryIds(text: string): string[] {
  const matches = text.match(/\b\d{3,}\b/g)
  return matches ? matches : []
}

function parseCategoryIds(raw: unknown): string[] {
  if (raw === null || raw === undefined) return []

  if (Array.isArray(raw)) {
    const values: string[] = []
    raw.forEach((item) => {
      values.push(...parseCategoryIds(item))
    })

    const seen = new Set<string>()
    return values.filter((token) => {
      const key = token.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  if (typeof raw === 'object') {
    const record = raw as Record<string, unknown>
    const direct = parseCategoryIds(
      record.categoryId
      ?? record.category_id
      ?? record.primaryCategoryId
      ?? record.primary_category_id
      ?? record.secondaryCategoryId
      ?? record.secondary_category_id
      ?? record.ebayCategoryId
      ?? record.ebay_category_id
      ?? record.id
      ?? record.name
      ?? record.title
      ?? record.value,
    )
    if (direct.length > 0) return direct

    return Object.values(record).flatMap((value) => parseCategoryIds(value))
  }

  const text = String(raw)
  const trimmed = text.trim()
  if (!trimmed) return []

  const values: string[] = []
  const pushValue = (value: unknown) => {
    if (value === null || value === undefined) return
    const stringValue = String(value)
    const hasDelimiters = /[\n,;|]/.test(stringValue)
    if (hasDelimiters) {
      stringValue.split(/[\n,;|]/).forEach((part) => {
        const normalizedPart = normalizeCategoryToken(part)
        if (normalizedPart) values.push(normalizedPart)
      })
      return
    }

    const normalized = normalizeCategoryToken(stringValue)
    if (normalized) values.push(normalized)
  }

  try {
    const parsed = JSON.parse(trimmed)
    return parseCategoryIds(parsed)
  } catch {
    trimmed
      .split(/[\n,;|]/)
      .forEach((token) => pushValue(token))

    if (values.length === 0) {
      extractNumericCategoryIds(trimmed).forEach((token) => pushValue(token))
    }
  }

  const seen = new Set<string>()
  return values.filter((token) => {
    const key = token.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function isCategoryLikeFieldName(fieldName: string): boolean {
  const normalized = fieldName
    .trim()
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .trim()

  if (normalized === 'category') return true

  if (normalized.includes('categor')) {
    return normalized.includes('ebay')
      || normalized.includes('id')
      || normalized.includes('json')
      || normalized.includes('primary')
      || normalized.includes('secondary')
  }

  return normalized === 'categories'
    || normalized === 'category ids'
    || normalized === 'category_ids'
    || normalized === 'category id'
    || normalized === 'category_id'
    || normalized === 'ebay offer category id'
    || normalized === 'ebay offer primary category id'
    || normalized === 'ebay offer secondary category id'
    || normalized === 'ebay_offer_category_id'
    || normalized === 'ebay_offer_primary_category_id'
    || normalized === 'ebay_offer_primarycategoryid'
    || normalized === 'ebay_offer_secondary_category_id'
    || normalized === 'ebay_offer_secondarycategoryid'
    || normalized === 'primary category'
    || normalized === 'primary category id'
    || normalized === 'primary_category'
    || normalized === 'primary_category_id'
    || normalized === 'secondary category'
    || normalized === 'secondary category id'
    || normalized === 'secondary_category'
    || normalized === 'secondary_category_id'
}

export interface EbayCategoryFieldState {
  categoriesFieldName?: string
  primaryCategoryFieldName?: string
  secondaryCategoryFieldName?: string
}

export function resolveEbaySelectedCategoryIds(
  formValues: Record<string, string>,
  fields: EbayCategoryFieldState,
): string[] {
  const categories = fields.categoriesFieldName
    ? parseCategoryIds(formValues[fields.categoriesFieldName] ?? '')
    : []

  const primaryCategory = fields.primaryCategoryFieldName
    ? normalizeCategoryToken(formValues[fields.primaryCategoryFieldName] ?? '')
    : ''
  const secondaryCategory = fields.secondaryCategoryFieldName
    ? normalizeCategoryToken(formValues[fields.secondaryCategoryFieldName] ?? '')
    : ''

  const fallbackCategories = categories.length === 0 && !primaryCategory && !secondaryCategory
    ? Object.entries(formValues)
      .filter(([fieldName]) => isCategoryLikeFieldName(fieldName))
      .flatMap(([, value]) => parseCategoryIds(value))
    : []

  const seen = new Set<string>()
  return [...categories, primaryCategory, secondaryCategory, ...fallbackCategories]
    .filter((categoryId) => categoryId.length > 0)
    .filter((categoryId) => {
      const key = categoryId.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 2)
}

export function applyEbayCategoryIds(
  nextIds: string[],
  fields: EbayCategoryFieldState,
  setFormValue: (fieldName: string, value: string) => void,
): void {
  const normalizedIds = nextIds.map((id) => id.trim()).filter((id) => id.length > 0).slice(0, 2)

  if (fields.categoriesFieldName) {
    setFormValue(fields.categoriesFieldName, normalizedIds.join(', '))
  }
  if (fields.primaryCategoryFieldName) {
    setFormValue(fields.primaryCategoryFieldName, normalizedIds[0] ?? '')
  }
  if (fields.secondaryCategoryFieldName) {
    setFormValue(fields.secondaryCategoryFieldName, normalizedIds[1] ?? '')
  }
}
