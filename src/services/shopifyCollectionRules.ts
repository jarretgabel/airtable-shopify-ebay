import type { ShopifyCollectionMatch, ShopifyCollectionRule } from '@/services/shopify';

export interface ListingCollectionFacts {
  tags: string[];
  productType: string;
  vendor: string;
  title: string;
  price?: number;
  compareAtPrice?: number;
  inventory?: number;
}

export type SmartCollectionStatus = 'joins' | 'unknown' | 'does-not-join';

export interface SmartCollectionEvaluation {
  collection: ShopifyCollectionMatch;
  status: SmartCollectionStatus;
  unmetRules: ShopifyCollectionRule[];
}

function compareText(value: string, relation: string, condition: string): boolean | null {
  const left = value.trim().toLowerCase();
  const right = condition.trim().toLowerCase();
  switch (relation) {
    case 'EQUALS': return left === right;
    case 'NOT_EQUALS': return left !== right;
    case 'CONTAINS': return left.includes(right);
    case 'NOT_CONTAINS': return !left.includes(right);
    case 'STARTS_WITH': return left.startsWith(right);
    case 'ENDS_WITH': return left.endsWith(right);
    case 'IS_SET': return left.length > 0;
    case 'IS_NOT_SET': return left.length === 0;
    default: return null;
  }
}

function compareNumber(value: number | undefined, relation: string, condition: string): boolean | null {
  if (value === undefined || !Number.isFinite(value)) return null;
  const target = Number(condition);
  switch (relation) {
    case 'EQUALS': return value === target;
    case 'NOT_EQUALS': return value !== target;
    case 'GREATER_THAN': return value > target;
    case 'LESS_THAN': return value < target;
    case 'IS_SET': return true;
    default: return null;
  }
}

// Returns null when the rule cannot be judged from what is entered on the form.
export function evaluateCollectionRule(rule: ShopifyCollectionRule, facts: ListingCollectionFacts): boolean | null {
  switch (rule.column) {
    case 'TAG': {
      if (rule.relation === 'IS_SET') return facts.tags.length > 0;
      if (rule.relation === 'IS_NOT_SET') return facts.tags.length === 0;
      const results = facts.tags.map((tag) => compareText(tag, rule.relation, rule.condition));
      if (results.includes(null)) return null;
      // Negative relations must hold for every tag; positive relations for at least one.
      return rule.relation.startsWith('NOT_')
        ? results.every(Boolean)
        : results.some(Boolean);
    }
    case 'TYPE': return compareText(facts.productType, rule.relation, rule.condition);
    case 'VENDOR': return compareText(facts.vendor, rule.relation, rule.condition);
    case 'TITLE': return compareText(facts.title, rule.relation, rule.condition);
    case 'VARIANT_PRICE': return compareNumber(facts.price, rule.relation, rule.condition);
    case 'VARIANT_COMPARE_AT_PRICE': return compareNumber(facts.compareAtPrice, rule.relation, rule.condition);
    case 'VARIANT_INVENTORY': return compareNumber(facts.inventory, rule.relation, rule.condition);
    default: return null;
  }
}

export function evaluateSmartCollection(
  collection: ShopifyCollectionMatch,
  facts: ListingCollectionFacts,
): SmartCollectionEvaluation | null {
  const rules = collection.rules ?? [];
  if (!collection.isSmartCollection || rules.length === 0) return null;

  const results = rules.map((rule) => ({ rule, result: evaluateCollectionRule(rule, facts) }));
  const unmetRules = results.filter((entry) => entry.result === false).map((entry) => entry.rule);
  const hasUnknown = results.some((entry) => entry.result === null);

  let status: SmartCollectionStatus;
  if (collection.appliedDisjunctively) {
    status = results.some((entry) => entry.result === true) ? 'joins' : hasUnknown ? 'unknown' : 'does-not-join';
  } else if (unmetRules.length > 0) {
    status = 'does-not-join';
  } else {
    status = hasUnknown ? 'unknown' : 'joins';
  }

  return { collection, status, unmetRules };
}

export function evaluateSmartCollections(
  collections: ShopifyCollectionMatch[],
  facts: ListingCollectionFacts,
): SmartCollectionEvaluation[] {
  return collections
    .map((collection) => evaluateSmartCollection(collection, facts))
    .filter((evaluation): evaluation is SmartCollectionEvaluation => evaluation !== null);
}

export function describeCollectionRule(rule: ShopifyCollectionRule): string {
  const column = rule.column.toLowerCase().replace(/^variant_/, '').replace(/_/g, ' ');
  const relation = rule.relation.toLowerCase().replace(/_/g, ' ');
  return rule.relation === 'IS_SET' || rule.relation === 'IS_NOT_SET'
    ? `${column} ${relation}`
    : `${column} ${relation} "${rule.condition}"`;
}

// Tags that smart collection rules look for, so the AI can suggest tags that actually place a product.
export function collectRuleTagVocabulary(collections: ShopifyCollectionMatch[]): string[] {
  const tags = new Map<string, string>();
  collections.forEach((collection) => {
    (collection.rules ?? []).forEach((rule) => {
      if (rule.column !== 'TAG' || rule.relation !== 'EQUALS') return;
      const tag = rule.condition.trim();
      if (tag && !tags.has(tag.toLowerCase())) tags.set(tag.toLowerCase(), tag);
    });
  });
  return Array.from(tags.values()).sort((left, right) => left.localeCompare(right));
}
