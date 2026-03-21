# Airtable Flat Import Instructions

This is the non-JSON version of the import setup.

Some Shopify file names and column names keep older technical labels because they match the existing CSV files. You do not need to understand those labels to use this setup.

Instead of putting arrays or nested objects into one cell as JSON, this flat import set uses:
- one main listings CSV for scalar fields
- one child CSV per repeatable field group
- a shared `listing_key` column to link rows across files

If you want one single-sheet version instead of separate child tables, use:
- `airtable_combined_readable_main.csv`
- `airtable_combined_readable_main_sample.csv`

That file folds the main table and child tables into one wide CSV with readable headers.
Repeatable fields are flattened into numbered columns such as `Shopify REST Tag 1`, `Shopify REST Tag 2`, `eBay Inventory Aspect 1 Name`, and `eBay Offer Responsible Person 2 Email`.

For field meanings, use:
- `airtable_listing_import_field_reference.md`
- `airtable_readable_to_api_mapping.md`
- `airtable_common_enum_values.md`
- `airtable_base_schema_checklist.md`

That reference is organized around the human-readable header names from the combined CSV and explains what each field is doing in practical terms.
The mapping guide shows how those same readable headers translate back into Shopify and eBay payload keys.
The enum guide helps with common status, format, unit, and boolean values.
The base schema checklist shows how to set up Airtable using either the combined CSV or the normalized flat tables.

## Files To Import

Main table:
- `airtable_flat_listings_main.csv`

Shopify main child tables:
- `airtable_flat_shopify_rest_tags.csv`
- `airtable_flat_shopify_rest_options.csv`
- `airtable_flat_shopify_rest_variants.csv`
- `airtable_flat_shopify_rest_images.csv`
- `airtable_flat_shopify_rest_metafields.csv`

Shopify extra child tables:
- `airtable_flat_shopify_graphql_collections.csv`
- `airtable_flat_shopify_graphql_options.csv`
- `airtable_flat_shopify_graphql_metafields.csv`
- `airtable_flat_shopify_graphql_tags.csv`
- `airtable_flat_shopify_graphql_media.csv`

eBay inventory child tables:
- `airtable_flat_ebay_inventory_aspects.csv`
- `airtable_flat_ebay_inventory_availability_distributions.csv`
- `airtable_flat_ebay_inventory_pickup_locations.csv`
- `airtable_flat_ebay_inventory_condition_descriptors.csv`
- `airtable_flat_ebay_inventory_identifiers.csv`

eBay offer child tables:
- `airtable_flat_ebay_offer_store_categories.csv`
- `airtable_flat_ebay_offer_compliance_policies.csv`
- `airtable_flat_ebay_offer_shipping_cost_overrides.csv`
- `airtable_flat_ebay_offer_regulatory_documents.csv`
- `airtable_flat_ebay_offer_hazmat_labels.csv`
- `airtable_flat_ebay_offer_product_safety_labels.csv`
- `airtable_flat_ebay_offer_responsible_persons.csv`

## How The Linking Works

- Each listing gets one unique `listing_key`.
- The same `listing_key` is reused in the main row and every child row tied to that listing.
- In Airtable, import each CSV as its own table and link them by `listing_key`.

Example:
- Main row: `listing_key = LISTING-0001`
- Shopify variant row: `listing_key = LISTING-0001`, `variant_index = 1`, `sku = MCINTOSHMA8900`
- eBay aspect row: `listing_key = LISTING-0001`, `aspect_name = Brand`, `aspect_value = McIntosh`

## What Goes In The Main CSV

Put only scalar properties in `airtable_flat_listings_main.csv`.

Examples:
- product title
- product description
- condition
- category ID
- marketplace ID
- price value
- return policy ID
- manufacturer address fields

## What Goes In Child CSVs

Use child CSVs for anything that repeats or has multiple values.

Examples:
- multiple Shopify tags
- multiple Shopify variants
- multiple Shopify images
- multiple eBay aspects
- multiple eBay product identifiers like UPC or EAN
- multiple eBay regulatory documents
- multiple eBay responsible persons

## Child Table Meanings

### `airtable_flat_shopify_rest_tags.csv`
- One row per Shopify tag in the main Shopify field group.

### `airtable_flat_shopify_rest_options.csv`
- One row per Shopify option value in the main Shopify field group.
- Use `option_index` to group values under the same option name.

### `airtable_flat_shopify_rest_variants.csv`
- One row per Shopify variant in the main Shopify field group.
- Use `variant_index` to keep variants ordered.

### `airtable_flat_shopify_rest_images.csv`
- One row per Shopify image in the main Shopify field group.
- Use `variant_sku` when an image should map to a specific variant.

### `airtable_flat_shopify_rest_metafields.csv`
- One row per Shopify custom field in the main Shopify field group.

### `airtable_flat_shopify_graphql_collections.csv`
- One row per Shopify collection in the extra Shopify field group.

### `airtable_flat_shopify_graphql_options.csv`
- One row per Shopify option value in the extra Shopify field group.

### `airtable_flat_shopify_graphql_metafields.csv`
- One row per Shopify custom field in the extra Shopify field group.

### `airtable_flat_shopify_graphql_tags.csv`
- One row per Shopify tag in the extra Shopify field group.

### `airtable_flat_shopify_graphql_media.csv`
- One row per Shopify media item in the extra Shopify field group.

### `airtable_flat_ebay_inventory_aspects.csv`
- One row per eBay aspect value.
- Use `aspect_index` to group values under the same aspect name.

### `airtable_flat_ebay_inventory_availability_distributions.csv`
- One row per warehouse quantity allocation.

### `airtable_flat_ebay_inventory_pickup_locations.csv`
- One row per in-store pickup location.

### `airtable_flat_ebay_inventory_condition_descriptors.csv`
- One row per condition descriptor value.

### `airtable_flat_ebay_inventory_identifiers.csv`
- One row per identifier value.
- Supported `identifier_type` values usually include `EAN`, `ISBN`, `UPC`, and `VIDEO_ID`.

### `airtable_flat_ebay_offer_store_categories.csv`
- One row per eBay Store category path.

### `airtable_flat_ebay_offer_compliance_policies.csv`
- One row per eBay compliance or take-back policy assignment.
- Use `policy_type` such as `PRODUCT_COMPLIANCE` or `TAKE_BACK`.
- Use `scope` as `GLOBAL` or `REGIONAL`.

### `airtable_flat_ebay_offer_shipping_cost_overrides.csv`
- One row per shipping override entry.

### `airtable_flat_ebay_offer_regulatory_documents.csv`
- One row per regulatory document ID.

### `airtable_flat_ebay_offer_hazmat_labels.csv`
- One row per hazmat code.
- Use `label_type` as `PICTOGRAM` or `STATEMENT`.

### `airtable_flat_ebay_offer_product_safety_labels.csv`
- One row per product safety code.
- Use `label_type` as `PICTOGRAM` or `STATEMENT`.

### `airtable_flat_ebay_offer_responsible_persons.csv`
- One row per responsible person record.
- If a responsible person has multiple types, use multiple rows with the same `responsible_person_index` and different `type` values.

## Suggested Airtable Setup

- Import each CSV into its own table.
- Keep `listing_key` as a primary or linked key field.
- Create linked-record relationships from each child table back to the main listings table.
- If you later build automation, transform child rows back into arrays for the target Shopify or eBay API payload.

## Relationship To The Older JSON Templates

- `airtable_listing_import_template.csv` and `airtable_listing_import_template_readable_headers.csv` keep the original single-row, JSON-in-cell format.
- The `airtable_flat_*.csv` files are the recommended set if you want every nested value represented as individual properties and rows instead of JSON blobs.
- `airtable_combined_readable_main.csv` is the recommended file if you want a single import sheet with readable headers and no JSON cells, and you are comfortable with indexed limits for repeating fields.
- `airtable_combined_readable_main_sample.csv` is a one-row example you can copy from or import as a starting template.

## Indexed Limits In The Combined Main CSV

The combined single-sheet CSV uses fixed slots for repeatable data:
- Shopify main field group tags: 10
- Shopify main field group options: 3 options with 5 values each
- Shopify main field group variants: 5
- Shopify main field group images: 5
- Shopify main field group custom fields: 5
- Shopify extra field group collections: 5
- Shopify extra field group options: 3 options with 5 values each
- Shopify extra field group custom fields: 5
- Shopify extra field group tags: 10
- Shopify extra field group media items: 5
- eBay inventory availability distributions: 3
- eBay inventory pickup locations: 3
- eBay inventory condition descriptors: 3
- eBay inventory aspects: 10 with up to 3 values each
- eBay inventory identifiers: 3 each for EAN, ISBN, UPC, and video IDs
- eBay store categories: 2
- eBay global product compliance policies: 3
- eBay regional product compliance policies: 2
- eBay regional take-back policies: 2
- eBay shipping overrides: 2
- eBay regulatory documents: 3
- eBay hazmat pictograms: 3
- eBay hazmat statements: 3
- eBay product safety pictograms: 3
- eBay product safety statements: 3
- eBay responsible persons: 3 with up to 2 types each