# Airtable Base Schema And Import Checklist

This checklist is for setting up an Airtable base to hold the listing import data from this repo.

You have two workable layouts:
- one wide table using the combined readable CSV
- a normalized multi-table base using the flat main CSV plus child CSVs

## Option 1: One Wide Table

Use this when you want the fastest setup and the least Airtable relationship work.

Recommended source files:
- `airtable_combined_readable_main.csv`
- `airtable_combined_readable_main_sample.csv`

### Suggested Table Name

- `Listings`

### Suggested Primary Field

- `Listing Key`

### Suggested Airtable Field Types

| Field Pattern | Suggested Airtable Type | Notes |
| --- | --- | --- |
| `Listing Key` | Single line text | Primary key for each listing. |
| title, handle, SKU, vendor, brand, policy ID, category ID fields | Single line text | Use text unless you have a strict numeric workflow. |
| description or HTML fields | Long text | Keeps long listing copy readable. |
| price, compare-at price, fee, VAT, quantity, repair score, weight, dimensions | Number | Use decimals where needed. |
| `... Currency`, `... Country`, `... Status`, `... Format`, `... Type`, `... Unit` | Single select or text | Start with text if you want easier imports; convert to single select later if helpful. |
| `... Taxable`, `... Requires Shipping`, `... Apply Tax`, `... Best Offer Enabled` | Checkbox or text | Checkbox is cleaner, but text is easier when importing raw CSV values. |
| image URLs, document URLs, contact URLs | URL | Optional but useful. |
| published date, listing start date | Date with time | If you want scheduling in Airtable. |

### Import Checklist For One Wide Table

1. Create a new Airtable base.
2. Create a table named `Listings`.
3. Set the primary field to `Listing Key` or import the CSV and then convert the first field into the primary field.
4. Import `airtable_combined_readable_main.csv` if you want an empty template.
5. Import `airtable_combined_readable_main_sample.csv` if you want working example rows to start from.
6. Review long text fields and convert description-style columns to long text if Airtable imported them as single line text.
7. Review numeric fields and convert prices, weights, dimensions, and quantities to number fields if you want Airtable calculations.
8. Add filtered views such as `Shopify Main Fields Ready`, `Shopify Extra Fields Ready`, and `eBay Ready` if you want workflow separation.

## Option 2: Normalized Multi-Table Base

Use this when you want repeatable structures stored cleanly instead of spread across numbered columns.

Recommended source files:
- `airtable_flat_listings_main.csv`
- all related `airtable_flat_*.csv` files you plan to use

### Suggested Tables

- `Listings`
- `Shopify REST Tags`
- `Shopify REST Options`
- `Shopify REST Variants`
- `Shopify REST Images`
- `Shopify REST Metafields`
- `Shopify GraphQL Collections`
- `Shopify GraphQL Options`
- `Shopify GraphQL Metafields`
- `Shopify GraphQL Tags`
- `Shopify GraphQL Media`
- `eBay Inventory Aspects`
- `eBay Inventory Availability Distributions`
- `eBay Inventory Pickup Locations`
- `eBay Inventory Condition Descriptors`
- `eBay Inventory Identifiers`
- `eBay Offer Store Categories`
- `eBay Offer Compliance Policies`
- `eBay Offer Shipping Cost Overrides`
- `eBay Offer Regulatory Documents`
- `eBay Offer Hazmat Labels`
- `eBay Offer Product Safety Labels`
- `eBay Offer Responsible Persons`

### Suggested Primary Fields

| Table | Suggested Primary Field |
| --- | --- |
| `Listings` | `listing_key` |
| Child tables | Formula or concatenated text based on `listing_key` plus index/value |

Examples:
- Shopify variant primary field: `{listing_key} & "-VAR-" & {variant_index}`
- eBay aspect primary field: `{listing_key} & "-ASP-" & {aspect_index} & "-" & {aspect_name}`

### Import Order For Normalized Base

1. Import `airtable_flat_listings_main.csv` first.
2. Import the Shopify child tables you need.
3. Import the eBay inventory child tables.
4. Import the eBay offer child tables.
5. Create linked-record fields from each child table back to `Listings` using `listing_key`.

### Linking Checklist

1. In each child table, keep `listing_key` as text until all imports are complete.
2. After imports, create a linked-record field to the `Listings` table.
3. Use Airtable’s field conversion or automation to link child rows to the matching `Listings` record by `listing_key`.
4. Keep the raw `listing_key` text column if you want a stable external import key.

## Recommended Views

Suggested views for either layout:
- `Needs Shopify Review`
- `Needs eBay Review`
- `Missing Policy IDs`
- `Missing Category`
- `Has Compliance Data`
- `Ready To Export`

## Recommended Formula Or Helper Fields

Suggested helpers for the one-table layout:
- `Has Shopify Main Data`: checks whether the main Shopify fields are filled.
- `Has Shopify Extra Data`: checks whether the extra Shopify fields are filled.
- `Has eBay Data`: checks whether core eBay inventory and offer fields are filled.
- `Is Missing Required Policy`: checks for blank eBay policy IDs.
- `Is Missing SKU`: checks for blank Shopify or eBay SKU fields.

Suggested helpers for the normalized layout:
- count variants per listing
- count images per listing
- count eBay aspects per listing
- count responsible persons per listing

## Practical Recommendation

- Use the combined one-table CSV if the goal is quick import and hand editing inside Airtable.
- Use the normalized flat CSV set if the goal is cleaner repeatable data modeling and easier automation later.
- If you are starting from scratch, begin with the combined CSV and move to the normalized base only if the numbered column limits become a problem.