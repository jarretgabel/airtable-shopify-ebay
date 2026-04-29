import ebayListingInsertTemplate from '@/templates/ebay/ebay-listing-insert.html?raw';
import ebayListingImpactSlateTemplate from '@/templates/ebay/ebay-listing-impact-slate.html?raw';
import ebayListingImpactLuxeTemplate from '@/templates/ebay/ebay-listing-impact-luxe.html?raw';

export const EBAY_IMAGE_LIST_FIELD_CANDIDATES = [
  'eBay Inventory Product Image URLs JSON',
  'eBay Inventory Product ImageURLs JSON',
  'ebay_inventory_product_imageurls_json',
  'Shopify REST Images JSON',
  'shopify_rest_images_json',
  'Shopify Images JSON',
  'shopify_images_json',
  'Images',
  'images',
  'Image URL',
  'Image URLs',
  'Image-URL',
  'Image-URLs',
  'image_url',
  'image_urls',
] as const;

export const EBAY_TITLE_FIELD_CANDIDATES = [
  'eBay Inventory Product Title',
  'Item Title',
  'Title',
  'Name',
] as const;

export const EBAY_PRICE_FIELD_CANDIDATES = [
  'Buy It Now/Starting Price',
  'Buy It Now / Starting Price',
  'Buy It Now/Starting Bid',
  'eBay Offer Price Value',
  'eBay Offer Auction Start Price Value',
  'Buy It Now USD',
  'Starting Bid USD',
  'Price',
] as const;

export const EBAY_VENDOR_FIELD_CANDIDATES = [
  'eBay Inventory Product Brand',
  'Brand',
  'Vendor',
  'Manufacturer',
] as const;

export const EBAY_QTY_FIELD_CANDIDATES = [
  'eBay Inventory Ship To Location Quantity',
  'Quantity',
  'Qty',
] as const;

export const EBAY_FORMAT_FIELD_CANDIDATES = [
  'eBay Offer Format',
  'Listing Format',
  'Status',
] as const;

export const EBAY_DURATION_FIELD_CANDIDATES = [
  'eBay Listing Duration',
  'Listing Duration',
] as const;

export const EBAY_DOMESTIC_SHIPPING_FEES_FIELD_CANDIDATES = [
  'eBay Domestic Shipping Fees',
  'Domestic Shipping Fees',
  'ebay_domestic_shipping_fees',
  'domestic_shipping_fees',
] as const;

export const EBAY_INTERNATIONAL_SHIPPING_FEES_FIELD_CANDIDATES = [
  'eBay International Shipping Fees',
  'International Shipping Fees',
  'ebay_international_shipping_fees',
  'international_shipping_fees',
] as const;

export const EBAY_DOMESTIC_SHIPPING_FLAT_FEE_FIELD_CANDIDATES = [
  'eBay Domestic Shipping Flat Fee',
  'Domestic Shipping Flat Fee',
  'eBay Domestic Shipping Flat Fee USD',
  'Domestic Shipping Flat Fee USD',
] as const;

export const EBAY_INTERNATIONAL_SHIPPING_FLAT_FEE_FIELD_CANDIDATES = [
  'eBay International Shipping Flat Fee',
  'International Shipping Flat Fee',
  'eBay International Shipping Flat Fee USD',
  'International Shipping Flat Fee USD',
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

export const EBAY_SECONDARY_CATEGORY_FIELD_CANDIDATES = [
  'eBay Offer Secondary Category ID',
  'ebay_offer_secondary_category_id',
  'Secondary Category',
  'secondary_category',
] as const;

export const EBAY_PRIMARY_CATEGORY_NAME_FIELD_CANDIDATES = [
  'Primary Category Name',
  'primary_category_name',
  'eBay Offer Primary Category Name',
  'ebay_offer_primary_category_name',
] as const;

export const EBAY_SECONDARY_CATEGORY_NAME_FIELD_CANDIDATES = [
  'Secondary Category Name',
  'secondary_category_name',
  'eBay Offer Secondary Category Name',
  'ebay_offer_secondary_category_name',
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

export const EBAY_BODY_HTML_FIELD_CANDIDATES = [
  'Body HTML',
  'Body (HTML)',
  'body_html',
  'eBay Body HTML',
  'eBay Body (HTML)',
  'ebay_body_html',
] as const;

export const EBAY_BODY_HTML_TEMPLATE_FIELD_CANDIDATES = [
  'eBay Body HTML Template',
  'eBay Listing Template',
  'eBay Template',
  'Body HTML Template',
  'Listing Template',
  'ebay_body_html_template',
  'ebay_listing_template',
] as const;

export type EbayListingTemplateId = 'classic' | 'impact-slate' | 'impact-luxe';

export const EBAY_LISTING_TEMPLATE_OPTIONS: ReadonlyArray<{ id: EbayListingTemplateId; label: string }> = [
  { id: 'classic', label: 'Classic Heritage' },
  { id: 'impact-slate', label: 'Impact Slate' },
  { id: 'impact-luxe', label: 'Impact Luxe' },
] as const;

const EBAY_LISTING_TEMPLATE_HTML_BY_ID: Record<EbayListingTemplateId, string> = {
  classic: ebayListingInsertTemplate,
  'impact-slate': ebayListingImpactSlateTemplate,
  'impact-luxe': ebayListingImpactLuxeTemplate,
};

export const EBAY_BODY_KEY_FEATURES_FIELD_CANDIDATES = [
  'Key Features (Key, Value)',
  'eBay Body Key Features JSON',
  'eBay Body Key Features',
  'eBay Listing Key Features JSON',
  'eBay Listing Key Features',
  'Key Features JSON',
  'Key Features',
  'Features JSON',
  'Features',
  'ebay_body_key_features_json',
  'ebay_body_key_features',
  'ebay_listing_key_features_json',
  'ebay_listing_key_features',
] as const;

export const EBAY_TESTING_NOTES_FIELD_CANDIDATES = [
  'Testing Notes',
  'Testing Notes JSON',
  'eBay Testing Notes',
  'eBay Testing Notes JSON',
  'eBay Body Testing Notes',
  'eBay Body Testing Notes JSON',
  'eBay Listing Testing Notes',
  'eBay Listing Testing Notes JSON',
  'testing_notes',
  'testing_notes_json',
  'ebay_testing_notes',
  'ebay_testing_notes_json',
  'ebay_body_testing_notes',
  'ebay_body_testing_notes_json',
  'ebay_listing_testing_notes',
  'ebay_listing_testing_notes_json',
] as const;

export const EBAY_ATTRIBUTES_FIELD_CANDIDATES = [
  'eBay Inventory Product Aspects JSON',
  'eBay Inventory Product Aspects',
  'eBay Inventory Aspects',
  'eBay Product Aspects',
  'eBay Aspects',
  'ebay_inventory_product_aspects_json',
  'ebay_inventory_product_aspects',
  'ebay_inventory_aspects',
] as const;

export function normalizeEbayListingTemplateId(value: string): EbayListingTemplateId {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return 'classic';

  if (normalized === 'classic' || normalized.includes('insert') || normalized.includes('legacy') || normalized.includes('heritage')) {
    return 'classic';
  }

  if (normalized === 'impact-slate' || normalized === 'slate' || normalized.includes('impact slate')) {
    return 'impact-slate';
  }

  if (normalized === 'impact-luxe' || normalized === 'luxe' || normalized.includes('impact luxe')) {
    return 'impact-luxe';
  }

  return 'classic';
}

export function resolveEbayListingTemplateHtml(templateId: EbayListingTemplateId): string {
  return EBAY_LISTING_TEMPLATE_HTML_BY_ID[templateId] ?? ebayListingInsertTemplate;
}

export const EBAY_DRAFT_PAYLOAD_DOCS_EXAMPLE = {
  inventoryItem: {
    sku: 'EXAMPLE-SKU-1',
    product: {
      title: 'Example Product Title',
      description: '<p>Example eBay inventory item description.</p>',
      imageUrls: ['https://example.com/image-1.jpg'],
      brand: 'Example Brand',
      mpn: 'EXAMPLE-MPN',
      aspects: {
        Brand: ['Example Brand'],
      },
    },
    condition: 'USED_EXCELLENT',
    conditionDescription: 'Example condition details.',
    availability: {
      shipToLocationAvailability: {
        quantity: 1,
      },
    },
  },
  offer: {
    sku: 'EXAMPLE-SKU-1',
    marketplaceId: 'EBAY_US',
    format: 'FIXED_PRICE',
    availableQuantity: 1,
    categoryId: '3276',
    listingDescription: '<p>Example offer description.</p>',
    listingDuration: 'GTC',
    pricingSummary: {
      price: {
        value: '99.99',
        currency: 'USD',
      },
    },
    quantityLimitPerBuyer: 1,
    includeCatalogProductDetails: false,
  },
};