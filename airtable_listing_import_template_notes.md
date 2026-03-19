# Airtable Listing Import Template Notes

This template is designed for import into Airtable as a single wide table for new listing creation.

Files:
- `airtable_listing_import_template.csv` uses API-path style headers.
- `airtable_listing_import_template_readable_headers.csv` uses more human-readable Airtable headers in the same column order.
- `airtable_listing_import_field_reference.md` explains what each field maps to in the Shopify or eBay APIs.
- `airtable_listing_import_field_reference_shopify.md` is the human-readable Shopify field guide.
- `airtable_listing_import_field_reference_shopify_main_technical_detail.md` explains the main Shopify product, variant, image, and tag fields in more detailed form.
- `airtable_listing_import_field_reference_shopify_extra_technical_detail.md` explains the extra Shopify category, collection, SEO, and media fields in more detailed form.
- `airtable_listing_import_field_reference_ebay.md` is the eBay readable field guide.
- `airtable_one_page_quick_start.md` is the shortest starter guide for the most common fields to fill first.
- `airtable_readable_to_api_mapping.md` links readable Airtable headers to exact API paths and example key/value pairs.
- `airtable_common_enum_values.md` lists common Shopify and eBay controlled values for statuses, formats, units, and booleans.
- `airtable_base_schema_checklist.md` explains how to structure an Airtable base and import the CSV files.
- `airtable_flat_import_instructions.md` explains the normalized non-JSON import set.
- `airtable_combined_readable_main.csv` combines the flat main table and child-table fields into one readable single-sheet CSV.
- `airtable_combined_readable_main_sample.csv` is a sample-filled version of the combined readable CSV.

Human-readable field guide:
- `airtable_listing_import_field_reference.md` is now written against the readable headers from `airtable_combined_readable_main.csv` and explains what each field is doing in plain language.

Flat non-JSON import set:
- Use `airtable_flat_listings_main.csv` plus the related `airtable_flat_*.csv` child tables when you want single-property rows instead of JSON blobs in cells.

Coverage:
- the first Shopify column group covers the main product, variant, image, and tag fields
- the second Shopify column group covers extra product details such as category, collections, search text, and media
- `ebay_inventory_*` columns cover the item details for eBay
- `ebay_offer_*` columns cover how the item is sold on eBay

How to use the JSON columns:
- Any column ending in `_json` should contain a valid JSON array or JSON object string.
- Use JSON for repeating or category-dependent structures like Shopify variants, Shopify media, eBay aspects, eBay compliance policies, and eBay responsible persons.

Examples:
```json
[{"price":"4999.00","sku":"MCINTOSHMA8900","inventory_quantity":1,"inventory_management":"shopify"}]
```

```json
{"Brand":["McIntosh"],"Model":["MA8900"],"Type":["Integrated Amplifier"]}
```

Important limits and caveats:
- the sheet includes two Shopify field groups because the import setup supports more than one Shopify product layout
- most people can start with the main Shopify fields and only use the extra Shopify fields when they need category, collection, SEO, or media details
- eBay category-specific aspects, product identifiers, regulatory fields, and policy requirements vary by marketplace and category. The columns are present here, but whether a field is required depends on the target listing category and marketplace.
- eBay inventory locations are referenced here by `ebay_offer_merchantLocationKey`; the location itself must exist already in eBay.

Primary docs used:
- Shopify REST product, product variant, and product image docs
- Shopify GraphQL `productCreate`, `ProductCreateInput`, and `ProductInput` docs
- eBay Inventory API `createOrReplaceInventoryItem`, `createOffer`, and `publishOffer` docs
- eBay "Required fields for publishing an offer" guide