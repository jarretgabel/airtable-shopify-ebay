import { API } from './config';
import { getValidUserToken } from './token';

interface EbayCategoryTreeResponse {
  categoryTreeId?: string;
}

interface EbayCategorySuggestionNode {
  category?: {
    categoryId?: string;
    categoryName?: string;
  };
  categoryTreeNodeLevel?: number;
  categoryTreeNodeAncestors?: Array<{
    categoryName?: string;
  }>;
}

interface EbayCategorySuggestionsResponse {
  categorySuggestions?: EbayCategorySuggestionNode[];
}

interface EbayCategoryTreeNodeResponse {
  category?: {
    categoryId?: string;
    categoryName?: string;
  };
  childCategoryTreeNodes?: EbayCategoryTreeNodeResponse[];
  leafCategoryTreeNode?: boolean;
  categoryTreeNodeLevel?: number;
  categoryTreeNodeAncestors?: Array<{
    categoryName?: string;
  }>;
}

interface EbayCategoryTreeFullResponse {
  rootCategoryNode?: EbayCategoryTreeNodeResponse;
}

interface EbayCategorySubtreeResponse {
  categorySubtreeNode?: EbayCategoryTreeNodeResponse;
}

export interface EbayCategorySuggestion {
  id: string;
  name: string;
  path: string;
  level: number;
}

export interface EbayCategoryTreeNode {
  id: string;
  name: string;
  path: string;
  level: number;
  hasChildren: boolean;
}

const treeIdByMarketplace = new Map<string, string>();
const rootNodesByMarketplace = new Map<string, EbayCategoryTreeNode[]>();
const childNodesByMarketplaceAndParent = new Map<string, EbayCategoryTreeNode[]>();

async function getDefaultCategoryTreeId(marketplaceId: string): Promise<string> {
  const normalizedMarketplaceId = marketplaceId.trim().toUpperCase() || 'EBAY_US';
  const cached = treeIdByMarketplace.get(normalizedMarketplaceId);
  if (cached) return cached;

  const token = await getValidUserToken();
  const res = await fetch(
    `${API}/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=${encodeURIComponent(normalizedMarketplaceId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Accept-Language': 'en-US',
      },
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`get_default_category_tree_id ${res.status}: ${JSON.stringify(err)}`);
  }

  const data = (await res.json()) as EbayCategoryTreeResponse;
  const treeId = data.categoryTreeId?.trim();
  if (!treeId) {
    throw new Error('No default eBay category tree ID was returned for the selected marketplace.');
  }

  treeIdByMarketplace.set(normalizedMarketplaceId, treeId);
  return treeId;
}

export async function searchEbayCategorySuggestions(
  query: string,
  marketplaceId = 'EBAY_US',
): Promise<EbayCategorySuggestion[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const treeId = await getDefaultCategoryTreeId(marketplaceId);
  const token = await getValidUserToken();

  const res = await fetch(
    `${API}/commerce/taxonomy/v1/category_tree/${encodeURIComponent(treeId)}/get_category_suggestions?q=${encodeURIComponent(normalizedQuery)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Accept-Language': 'en-US',
      },
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`get_category_suggestions ${res.status}: ${JSON.stringify(err)}`);
  }

  const data = (await res.json()) as EbayCategorySuggestionsResponse;

  return (data.categorySuggestions ?? [])
    .map((node) => {
      const id = node.category?.categoryId?.trim() ?? '';
      const name = node.category?.categoryName?.trim() ?? '';
      if (!id || !name) return null;

      const ancestors = (node.categoryTreeNodeAncestors ?? [])
        .map((ancestor) => ancestor.categoryName?.trim() ?? '')
        .filter((value) => value.length > 0);

      return {
        id,
        name,
        path: [...ancestors, name].join(' > '),
        level: typeof node.categoryTreeNodeLevel === 'number' ? node.categoryTreeNodeLevel : 0,
      } as EbayCategorySuggestion;
    })
    .filter((item): item is EbayCategorySuggestion => item !== null);
}

function mapTreeNodes(nodes: EbayCategoryTreeNodeResponse[] | undefined, inheritedAncestors: string[] = []): EbayCategoryTreeNode[] {
  return (nodes ?? [])
    .map((node) => {
      const id = node.category?.categoryId?.trim() ?? '';
      const name = node.category?.categoryName?.trim() ?? '';
      if (!id || !name) return null;

      const ancestorsFromNode = (node.categoryTreeNodeAncestors ?? [])
        .map((ancestor) => ancestor.categoryName?.trim() ?? '')
        .filter((value) => value.length > 0);
      const ancestors = ancestorsFromNode.length > 0 ? ancestorsFromNode : inheritedAncestors;
      const path = [...ancestors, name].filter((value) => value.length > 0).join(' > ');

      return {
        id,
        name,
        path,
        level: typeof node.categoryTreeNodeLevel === 'number' ? node.categoryTreeNodeLevel : ancestors.length,
        hasChildren: Boolean(node.childCategoryTreeNodes && node.childCategoryTreeNodes.length > 0) || !node.leafCategoryTreeNode,
      } as EbayCategoryTreeNode;
    })
    .filter((item): item is EbayCategoryTreeNode => item !== null);
}

function normalizeMarketplaceId(marketplaceId: string): string {
  return marketplaceId.trim().toUpperCase() || 'EBAY_US';
}

export async function getEbayRootCategories(marketplaceId = 'EBAY_US'): Promise<EbayCategoryTreeNode[]> {
  const normalizedMarketplaceId = normalizeMarketplaceId(marketplaceId);
  const cached = rootNodesByMarketplace.get(normalizedMarketplaceId);
  if (cached) return cached;

  const treeId = await getDefaultCategoryTreeId(normalizedMarketplaceId);
  const token = await getValidUserToken();
  const res = await fetch(
    `${API}/commerce/taxonomy/v1/category_tree/${encodeURIComponent(treeId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Accept-Language': 'en-US',
      },
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`get_category_tree ${res.status}: ${JSON.stringify(err)}`);
  }

  const data = (await res.json()) as EbayCategoryTreeFullResponse;
  const roots = mapTreeNodes(data.rootCategoryNode?.childCategoryTreeNodes);
  rootNodesByMarketplace.set(normalizedMarketplaceId, roots);
  return roots;
}

export async function getEbayChildCategories(parentCategoryId: string, marketplaceId = 'EBAY_US'): Promise<EbayCategoryTreeNode[]> {
  const normalizedMarketplaceId = normalizeMarketplaceId(marketplaceId);
  const normalizedParentId = parentCategoryId.trim();
  if (!normalizedParentId) return [];

  const cacheKey = `${normalizedMarketplaceId}:${normalizedParentId}`;
  const cached = childNodesByMarketplaceAndParent.get(cacheKey);
  if (cached) return cached;

  const treeId = await getDefaultCategoryTreeId(normalizedMarketplaceId);
  const token = await getValidUserToken();
  const res = await fetch(
    `${API}/commerce/taxonomy/v1/category_tree/${encodeURIComponent(treeId)}/get_category_subtree?category_id=${encodeURIComponent(normalizedParentId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Accept-Language': 'en-US',
      },
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`get_category_subtree ${res.status}: ${JSON.stringify(err)}`);
  }

  const data = (await res.json()) as EbayCategorySubtreeResponse;
  const parentNode = data.categorySubtreeNode;
  const parentName = parentNode?.category?.categoryName?.trim() ?? '';
  const ancestors = parentName ? [parentName] : [];
  const children = mapTreeNodes(parentNode?.childCategoryTreeNodes, ancestors);
  childNodesByMarketplaceAndParent.set(cacheKey, children);
  return children;
}
