export const EBAY_TITLE_FIELD_CANDIDATES = [
  'eBay Inventory Product Title',
  'Item Title',
  'Title',
  'Name',
] as const;

export const EBAY_SKU_FIELD_CANDIDATES = [
  'eBay Inventory SKU',
  'SKU',
] as const;

export const EBAY_CONDITION_FIELD_CANDIDATES = [
  '__Condition__',
  'eBay Inventory Condition',
  'Item Condition',
  'Condition',
] as const;

export const EBAY_PRICE_FIELD_CANDIDATES = [
  'Buy It Now Price',
  'Buy It Now/Starting Bid Price',
  'Buy It Now / Starting Bid Price',
  'Starting Auction Price',
  'eBay Price',
  'Ebay Price',
  'Buy It Now/Starting Price',
  'Buy It Now / Starting Price',
  'Buy It Now/Starting Bid',
  'eBay Offer Price Value',
  'eBay Offer Auction Start Price Value',
  'ebay_offer_price_value',
  'ebay_offer_auctionStartPrice_value',
  'ebay_offer_pricingSummary_price_value',
  'ebay_offer_pricingSummary_auctionStartPrice_value',
  'Buy It Now USD',
  'Starting Bid USD',
  'Price',
] as const;

export const EBAY_FORMAT_FIELD_CANDIDATES = [
  'Ebay Listing Format',
  'eBay Offer Format',
  'Listing Format',
] as const;

export const EBAY_PRIMARY_CATEGORY_FIELD_CANDIDATES = [
  'eBay Offer Primary Category ID',
  'eBay Offer PrimaryCategoryID',
  'ebay_offer_primary_category_id',
  'ebay_offer_primarycategoryid',
  'eBay Offer Category ID',
  'ebay_offer_category_id',
  'Primary Category ID',
  'primary_category_id',
  'Primary Category',
  'primary_category',
] as const;

export const EBAY_CATEGORIES_FIELD_CANDIDATES = [
  'categories',
  'Categories',
] as const;

export const EBAY_DESCRIPTION_FIELD_CANDIDATES = [
  'Description',
  'Item Description',
  'eBay Inventory Product Description',
  'ebay_inventory_product_description',
] as const;

export const SHOPIFY_TITLE_FIELD_CANDIDATES = [
  'Shopify REST Title',
  'Shopify Title',
  'Item Title',
  'Title',
  'Name',
  'shopify_rest_title',
] as const;

export const SHOPIFY_PRICE_FIELD_CANDIDATES = [
  'Shopify Price',
  'Shopify REST Variant 1 Price',
  'Shopify Variant 1 Price',
  'Shopify REST Variant 1 Compare At Price',
  'Shopify Variant 1 Compare At Price',
  'Variant-Compare-Price',
  'Variant Compare Price',
  'Price',
  'shopify_rest_variant_1_price',
  'shopify_rest_variant_1_compare_at_price',
  'variant_compare_price',
] as const;

export const SHOPIFY_INVENTORY_QUANTITY_FIELD_CANDIDATES = [
  'Shopify Inventory Quantity',
  'Shopify REST Variant 1 Inventory Quantity',
  'Shopify Variant 1 Inventory Quantity',
  'Shopify Variant Quantity',
  'Available Quantity',
  'Available',
  'Inventory Quantity',
  'Quantity',
  'Qty',
  'Stock',
] as const;

export const SHOPIFY_PRODUCT_CATEGORY_FIELD_CANDIDATES = [
  'Shopify Type',
  'Type',
  'Product Type',
  'Shopify REST Product Type',
  'Shopify Product Type',
  'Shopify GraphQL Product Type',
  'Shopify REST Category',
  'Shopify Category',
  'Shopify Product Category',
  'Shopify REST Product Category',
  'Google Product Category',
  'Product Category',
  'Category',
  'shopify_rest_product_type',
  'shopify_product_type',
  'shopify_product_category',
  'shopify_rest_product_category',
  'google_product_category',
  'product_category',
] as const;

function normalizeFieldLookupKey(fieldName: string): string {
  return fieldName.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function findEbayPriceFieldName(fieldNames: string[]): string {
  const exact = fieldNames.find((name) =>
    EBAY_PRICE_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
  );
  if (exact) return exact;

  const fuzzy = fieldNames.find((name) => {
    const normalized = normalizeFieldLookupKey(name);
    return normalized === 'ebayprice'
      || normalized === 'ebayofferpricevalue'
      || normalized === 'ebayofferauctionstartpricevalue'
      || normalized.includes('buyitnowstartingbid')
      || normalized.includes('buyitnowstartingprice')
      || normalized.includes('startingbid')
      || normalized.includes('startingprice');
  });

  return fuzzy ?? '';
}
