import { describe, expect, it } from 'vitest';
import {
  getMissingRequiredFieldNames,
  isReadyForRequiredFields,
} from '@/components/approval/requiredFieldStatus';

describe('requiredFieldStatus', () => {
  it('matches an eBay condition stored under a non-synthetic field name', () => {
    expect(getMissingRequiredFieldNames(
      { 'eBay Inventory Condition': 'Used' },
      ['__Condition__'],
    )).toEqual([]);
  });

  it('uses the eBay editor default condition when the record has no condition field', () => {
    expect(isReadyForRequiredFields({}, ['__Condition__'])).toBe(true);
  });

  it('matches saved eBay category IDs across category field aliases', () => {
    expect(isReadyForRequiredFields(
      { 'Ebay Categories': ['852'] },
      ['Categories'],
    )).toBe(true);
  });

  it('requires eBay listing format and matches format aliases', () => {
    expect(isReadyForRequiredFields(
      { 'eBay Offer Format': 'FixedPrice' },
      ['Ebay Listing Format'],
    )).toBe(true);
    expect(getMissingRequiredFieldNames({}, ['Ebay Listing Format'])).toEqual(['Ebay Listing Format']);
  });

  it('does not treat a Shopify product category as a saved eBay category', () => {
    expect(isReadyForRequiredFields(
      { 'Shopify Product Category': 'Fountain' },
      ['Ebay Categories'],
    )).toBe(false);
  });
});
