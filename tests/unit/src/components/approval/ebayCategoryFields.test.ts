import { applyEbayCategoryIds, resolveEbaySelectedCategoryIds, resolveEbaySelectedCategoryNames } from '@/components/approval/ebayCategoryFields'

describe('ebayCategoryFields', () => {
  it('reads selected ids from primary and secondary fields when Categories is absent', () => {
    const selected = resolveEbaySelectedCategoryIds(
      {
        'Primary Category': '14990',
        'Secondary Category': '15032',
      },
      {
        primaryCategoryFieldName: 'Primary Category',
        secondaryCategoryFieldName: 'Secondary Category',
      },
    )

    expect(selected).toEqual(['14990', '15032'])
  })

  it('writes back to primary and secondary fields without requiring Categories', () => {
    const calls: Array<{ fieldName: string; value: string }> = []

    applyEbayCategoryIds(
      ['14990', '15032'],
      {
        primaryCategoryFieldName: 'Primary Category',
        secondaryCategoryFieldName: 'Secondary Category',
      },
      (fieldName, value) => {
        calls.push({ fieldName, value })
      },
    )

    expect(calls).toEqual([
      { fieldName: 'Primary Category', value: '14990' },
      { fieldName: 'Secondary Category', value: '15032' },
    ])
  })

  it('writes Categories when that real Airtable field exists', () => {
    const calls: Array<{ fieldName: string; value: string }> = []

    applyEbayCategoryIds(
      ['14990', '15032'],
      {
        categoriesFieldName: 'Categories',
        primaryCategoryFieldName: 'Primary Category',
        secondaryCategoryFieldName: 'Secondary Category',
      },
      (fieldName, value) => {
        calls.push({ fieldName, value })
      },
    )

    expect(calls).toEqual([
      { fieldName: 'Categories', value: '14990, 15032' },
      { fieldName: 'Primary Category', value: '14990' },
      { fieldName: 'Secondary Category', value: '15032' },
    ])
  })

  it('parses categories from JSON array strings cleanly', () => {
    const selected = resolveEbaySelectedCategoryIds(
      {
        Categories: '["14990","15032"]',
      },
      {
        categoriesFieldName: 'Categories',
      },
    )

    expect(selected).toEqual(['14990', '15032'])
  })

  it('normalizes quoted/bracketed primary values and avoids duplicate second chip', () => {
    const selected = resolveEbaySelectedCategoryIds(
      {
        Categories: '["14990"]',
        'Primary Category': '"14990"',
      },
      {
        categoriesFieldName: 'Categories',
        primaryCategoryFieldName: 'Primary Category',
      },
    )

    expect(selected).toEqual(['14990'])
  })

  it('discovers categories from Airtable-linked alias fields', () => {
    const selected = resolveEbaySelectedCategoryIds(
      {
        'Categories Airtable': '["14990", "15032"]',
      },
      {},
    )

    expect(selected).toEqual(['14990', '15032'])
  })

  it('discovers primary and secondary category names from categories field', () => {
    const selected = resolveEbaySelectedCategoryNames(
      {
        Categories: JSON.stringify([
          { id: '14990', name: 'Receivers & Tuners' },
          { id: '15032', name: 'Vintage Amplifiers' },
        ]),
      },
      {
        categoriesFieldName: 'Categories',
      },
    )

    expect(selected).toEqual(['Receivers & Tuners', 'Vintage Amplifiers'])
  })
})