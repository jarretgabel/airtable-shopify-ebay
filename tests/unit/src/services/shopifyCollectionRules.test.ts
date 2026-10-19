import { describe, expect, it } from 'vitest';
import {
  collectRuleTagVocabulary,
  evaluateSmartCollection,
  type ListingCollectionFacts,
} from '@/services/shopifyCollectionRules';
import type { ShopifyCollectionMatch } from '@/services/shopify';

const facts: ListingCollectionFacts = {
  tags: ['Pre-Owned Hifi', 'Cables'],
  productType: 'Audio & Video Cables',
  vendor: 'MIT',
  title: 'MIT MI-330 Interconnect',
  price: 1200,
  inventory: 1,
};

const preOwnedCables: ShopifyCollectionMatch = {
  id: '1', title: 'Pre-Owned Cables', handle: 'pre-owned-cables', isSmartCollection: true, appliedDisjunctively: false,
  rules: [
    { column: 'TAG', relation: 'EQUALS', condition: 'Pre-Owned Hifi' },
    { column: 'TYPE', relation: 'CONTAINS', condition: 'Cable' },
    { column: 'VARIANT_INVENTORY', relation: 'GREATER_THAN', condition: '0' },
  ],
};

const cables: ShopifyCollectionMatch = {
  id: '2', title: 'Cables', handle: 'cables', isSmartCollection: true, appliedDisjunctively: true,
  rules: [
    { column: 'TAG', relation: 'EQUALS', condition: 'cables' },
    { column: 'TAG', relation: 'EQUALS', condition: 'Speaker Cables' },
  ],
};

describe('shopifyCollectionRules', () => {
  it('joins when every conjunctive rule matches, ignoring case', () => {
    expect(evaluateSmartCollection(preOwnedCables, facts)?.status).toBe('joins');
    expect(evaluateSmartCollection(cables, facts)?.status).toBe('joins');
  });

  it('does not join when a conjunctive rule fails and reports which one', () => {
    const result = evaluateSmartCollection(preOwnedCables, { ...facts, tags: ['Cables'] });
    expect(result?.status).toBe('does-not-join');
    expect(result?.unmetRules).toEqual([{ column: 'TAG', relation: 'EQUALS', condition: 'Pre-Owned Hifi' }]);
  });

  it('joins a disjunctive collection when any rule matches and not when none do', () => {
    expect(evaluateSmartCollection(cables, { ...facts, tags: ['Speaker Cables'] })?.status).toBe('joins');
    expect(evaluateSmartCollection(cables, { ...facts, tags: ['Amplifiers'] })?.status).toBe('does-not-join');
  });

  it('reports unknown when a rule depends on something not on the form', () => {
    const collection: ShopifyCollectionMatch = {
      id: '3', title: 'Sale', handle: 'sale', isSmartCollection: true, appliedDisjunctively: false,
      rules: [{ column: 'IS_PRICE_REDUCED', relation: 'IS_SET', condition: '' }],
    };
    expect(evaluateSmartCollection(collection, facts)?.status).toBe('unknown');
  });

  it('ignores manual collections', () => {
    expect(evaluateSmartCollection({ id: '4', title: 'Tweaks', handle: 'tweaks' }, facts)).toBeNull();
  });

  it('collects unique tag names that rules look for', () => {
    expect(collectRuleTagVocabulary([preOwnedCables, cables])).toEqual(['cables', 'Pre-Owned Hifi', 'Speaker Cables']);
  });
});
