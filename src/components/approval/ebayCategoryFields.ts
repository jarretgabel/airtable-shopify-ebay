function normalizeCategoryToken(token: string): string {
  return token
    .trim()
    .replace(/^['"\[{\(]+/, '')
    .replace(/['"\]}\)]+$/, '')
    .trim()
}

function parseCategoryIds(raw: string): string[] {
  const trimmed = raw.trim()
  if (!trimmed) return []

  const values: string[] = []
  const pushValue = (value: unknown) => {
    if (value === null || value === undefined) return
    const normalized = normalizeCategoryToken(String(value))
    if (normalized) values.push(normalized)
  }

  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) {
      parsed.forEach((item) => {
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>
          pushValue(record.categoryId ?? record.id ?? record.name ?? record.title ?? record.value)
          return
        }
        pushValue(item)
      })
    } else if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>
      pushValue(record.categoryId ?? record.id ?? record.name ?? record.title ?? record.value)
    } else {
      pushValue(parsed)
    }
  } catch {
    trimmed
      .split(/[\n,;|]/)
      .forEach((token) => pushValue(token))
  }

  const seen = new Set<string>()
  return values.filter((token) => {
    const key = token.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
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

  const seen = new Set<string>()
  return [...categories, primaryCategory, secondaryCategory]
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
