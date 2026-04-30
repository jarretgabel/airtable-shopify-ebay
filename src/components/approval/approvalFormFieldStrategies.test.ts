import { describe, expect, it } from 'vitest';
import {
  parseShopifyCollectionIds,
  resolveShopifyCollectionFieldStrategy,
} from './approvalFormFieldsShopifyCollectionHelpers';
import { resolveShopifyTagFieldStrategy } from './approvalFormFieldsShopifyTagHelpers';

describe('approval form field strategies', () => {
  it('prefers writable compound collection fields in display then id order', () => {
    const strategy = resolveShopifyCollectionFieldStrategy({
      formValues: {},
      singleFieldNames: ['Shopify GraphQL Collection 1 ID'],
      compoundFieldNames: ['Shopify GraphQL Collection IDs', 'Collections'],
      writableFieldNames: ['Collections', 'Shopify GraphQL Collection IDs'],
    });

    expect(strategy.writeCompoundFields).toEqual(['Collections', 'Shopify GraphQL Collection IDs']);
    expect(strategy.sourceSingleFields).toEqual(['Shopify GraphQL Collection 1 ID']);
    expect(strategy.writeSingleFields).toEqual([]);
  });

  it('falls back to populated compound collection field when nothing is writable', () => {
    const strategy = resolveShopifyCollectionFieldStrategy({
      formValues: {
        'Shopify GraphQL Collections JSON': '["gid://shopify/Collection/123"]',
      },
      singleFieldNames: ['Shopify GraphQL Collection 1 ID'],
      compoundFieldNames: ['Shopify GraphQL Collections JSON', 'Collections'],
      writableFieldNames: [],
    });

    expect(strategy.sourceCompoundFields).toEqual(['Shopify GraphQL Collections JSON']);
    expect(strategy.writeCompoundFields).toEqual(['Shopify GraphQL Collections JSON']);
  });

  it('normalizes mixed Shopify collection id inputs and removes duplicates', () => {
    const ids = parseShopifyCollectionIds('["123", "gid://shopify/Collection/123", {"id":"456"}]');

    expect(ids).toEqual([
      'gid://shopify/Collection/123',
      'gid://shopify/Collection/456',
    ]);
  });

  it('prefers writable compound tag field over single tag slots', () => {
    const strategy = resolveShopifyTagFieldStrategy({
      formValues: {},
      singleFieldNames: ['Shopify Tag 1', 'Shopify Tag 2'],
      compoundFieldNames: ['Tags', 'Shopify REST Tags'],
      writableFieldNames: ['Shopify REST Tags'],
    });

    expect(strategy.writeCompoundFields).toEqual(['Shopify REST Tags']);
    expect(strategy.writeSingleFields).toEqual([]);
  });

  it('falls back to populated single tag fields when compound tags are unavailable', () => {
    const strategy = resolveShopifyTagFieldStrategy({
      formValues: {
        'Shopify Tag 1': 'tube',
        'Shopify Tag 2': 'vintage',
      },
      singleFieldNames: ['Shopify Tag 1', 'Shopify Tag 2'],
      compoundFieldNames: [],
      writableFieldNames: [],
    });

    expect(strategy.sourceSingleFields).toEqual(['Shopify Tag 1', 'Shopify Tag 2']);
    expect(strategy.writeSingleFields).toEqual(['Shopify Tag 1', 'Shopify Tag 2']);
  });
});