# Airtable Common Enum And Value Guide

This guide helps you pick common fill-in values for the readable Airtable columns.

Use it when you know what a field is for, but you want help choosing a typical value to type into the sheet.

Important:
- Shopify and eBay can change accepted values over time.
- eBay values can depend on the marketplace, category, and compliance rules.
- Treat this as a practical guide, not a guarantee that every value works everywhere.

## Shopify Values People Use Often

### Product Status

| Field | Common Value | What It Means | Example Use |
| --- | --- | --- | --- |
| `Shopify Status` | `draft` | The product is saved but not live yet. | You are still working on the listing. |
| `Shopify Status` | `active` | The product is live for customers. | You are ready for people to buy it. |
| `Shopify Status` | `archived` | The product is kept for records and not actively sold. | You sold out and want to keep the history. |
| `Shopify Extra Status` | `DRAFT` | Draft status in the extra Shopify field group. | You want the item saved but hidden. |
| `Shopify Extra Status` | `ACTIVE` | Live status in the extra Shopify field group. | You want the item available now. |
| `Shopify Extra Status` | `ARCHIVED` | Archived status in the extra Shopify field group. | You are retiring the product. |

### Inventory Tracking

| Field | Common Value | What It Means | Example Use |
| --- | --- | --- | --- |
| `Shopify Variant N Inventory Management` | `shopify` | Shopify should track your stock count. | You want quantity to go down after each sale. |
| `Shopify Variant N Inventory Management` | blank | Shopify should not track stock. | You do not want inventory tracking for this item. |
| `Shopify Variant N Inventory Policy` | `deny` | Stop selling when stock reaches zero. | You have one unit and do not want overselling. |
| `Shopify Variant N Inventory Policy` | `continue` | Keep selling even if stock goes below zero. | You allow backorders or custom-order sales. |

### True Or False Fields

| Field | Common Value | What It Means | Example Use |
| --- | --- | --- | --- |
| `Shopify Variant N Taxable` | `true` | Tax should apply to the item. | A normal physical product sale. |
| `Shopify Variant N Taxable` | `false` | Tax should not apply to the item. | A tax-exempt product or special case. |
| `Shopify Variant N Requires Shipping` | `true` | It is a physical item that ships. | An amplifier, turntable, or speaker. |
| `Shopify Variant N Requires Shipping` | `false` | It does not need shipping. | A digital item or service. |
| `Shopify Extra Gift Card` | `true` | The product is a gift card. | A digital gift certificate. |
| `Shopify Extra Gift Card` | `false` | The product is not a gift card. | A normal product listing. |
| `Shopify Extra Requires Selling Plan` | `true` | The product must be sold through a plan or subscription. | A subscription item. |
| `Shopify Extra Requires Selling Plan` | `false` | The product can be bought normally. | A one-time purchase item. |
| `Shopify Extra Claim Ownership Bundles` | `true` | The bundle setup is controlled by your app or flow. | A special bundle integration. |
| `Shopify Extra Claim Ownership Bundles` | `false` | No special bundle ownership is being claimed. | A normal product. |

### Weight Units

| Field | Common Value | What It Means | Example Use |
| --- | --- | --- | --- |
| `Shopify Variant N Weight Unit` | `lb` | Pounds. | A heavy receiver in the US. |
| `Shopify Variant N Weight Unit` | `oz` | Ounces. | A small accessory or cartridge. |
| `Shopify Variant N Weight Unit` | `kg` | Kilograms. | Stores working in metric shipping. |
| `Shopify Variant N Weight Unit` | `g` | Grams. | Small lightweight parts. |

### Metafield Types

| Field | Common Value | What It Means | Example Use |
| --- | --- | --- | --- |
| `Shopify Metafield N Type` | `single_line_text_field` | Short text. | `Walnut cabinet included` |
| `Shopify Metafield N Type` | `multi_line_text_field` | Longer text. | Restoration notes or service history. |
| `Shopify Metafield N Type` | `boolean` | True or false. | `cartridge_included = false` |
| `Shopify Metafield N Type` | `number_integer` | Whole number. | `channels = 2` |
| `Shopify Metafield N Type` | `number_decimal` | Decimal number. | `wow_flutter = 0.08` |
| `Shopify Metafield N Type` | `url` | Web address. | A manual or spec sheet link. |
| `Shopify Extra Metafield N Type` | `single_line_text_field` | Short text in the extra Shopify section. | A short spec detail. |
| `Shopify Extra Metafield N Type` | `multi_line_text_field` | Longer text in the extra Shopify section. | Detailed notes. |
| `Shopify Extra Metafield N Type` | `boolean` | True or false in the extra Shopify section. | A yes or no feature flag. |

### Media Type And Product Grouping

| Field | Common Value | What It Means | Example Use |
| --- | --- | --- | --- |
| `Shopify Extra Media N Content Type` | `IMAGE` | Standard product image. | Front, rear, and detail photos. |
| `Shopify Extra Media N Content Type` | `VIDEO` | Uploaded product video. | A demo clip. |
| `Shopify Extra Media N Content Type` | `EXTERNAL_VIDEO` | Video hosted elsewhere. | A YouTube product walk-through. |
| `Shopify Extra Media N Content Type` | `MODEL_3D` | A 3D model. | Interactive product model. |
| `Shopify Extra Combined Listing Role` | `PARENT` | The main grouped product. | A parent product with child items under it. |
| `Shopify Extra Combined Listing Role` | `CHILD` | One item under a grouped product. | A child version in a grouped listing. |

## eBay Values People Use Often

### Item Condition

These are common examples, but the exact allowed values can vary by category.

| Field | Common Value | What It Means | Example Use |
| --- | --- | --- | --- |
| `eBay Inventory Condition` | `NEW` | Brand new item. | Factory-sealed product. |
| `eBay Inventory Condition` | `LIKE_NEW` | Very close to new where supported. | Barely used item in excellent shape. |
| `eBay Inventory Condition` | `NEW_OTHER` | New but open box or similar. | Open-box product with all accessories. |
| `eBay Inventory Condition` | `USED_EXCELLENT` | Used in excellent condition. | Clean item with very minor wear. |
| `eBay Inventory Condition` | `USED_VERY_GOOD` | Used in very good condition. | Light wear but strong overall condition. |
| `eBay Inventory Condition` | `USED_GOOD` | Used in good condition. | Visible wear but fully working. |
| `eBay Inventory Condition` | `CERTIFIED_REFURBISHED` | Professionally refurbished where supported. | Refurbished product with approval status. |
| `eBay Inventory Condition` | `SELLER_REFURBISHED` | Refurbished by the seller where supported. | Restored item sold by a specialist shop. |

### Time Units

| Field | Common Value | What It Means | Example Use |
| --- | --- | --- | --- |
| `eBay Inventory Distribution N Fulfillment Time Unit` | `DAY` | Handling time is counted in days. | Ships in 2 business days. |
| `eBay Inventory Pickup Location N Fulfillment Time Unit` | `HOUR` | Pickup readiness is counted in hours. | Ready in 4 hours. |
| `eBay Inventory Pickup Location N Fulfillment Time Unit` | `DAY` | Pickup readiness is counted in days. | Ready tomorrow. |

### Package Units And Shape

| Field | Common Value | What It Means | Example Use |
| --- | --- | --- | --- |
| `eBay Inventory Package Dimension Unit` | `INCH` | Inches. | US shipping setup. |
| `eBay Inventory Package Dimension Unit` | `FOOT` | Feet. | Large item measurements. |
| `eBay Inventory Package Dimension Unit` | `CENTIMETER` | Centimeters. | Metric shipping setup. |
| `eBay Inventory Package Dimension Unit` | `METER` | Meters. | Very large item measurements. |
| `eBay Inventory Package Weight Unit` | `POUND` | Pounds. | Heavier US shipments. |
| `eBay Inventory Package Weight Unit` | `OUNCE` | Ounces. | Smaller packages. |
| `eBay Inventory Package Weight Unit` | `KILOGRAM` | Kilograms. | Metric shipping setup. |
| `eBay Inventory Package Weight Unit` | `GRAM` | Grams. | Small parts and accessories. |
| `eBay Inventory Shipping Irregular` | `true` | The box is an unusual shape or harder to ship. | Large, awkward, or fragile packaging. |
| `eBay Inventory Shipping Irregular` | `false` | The box is a normal package. | Standard rectangular shipping box. |

### Marketplace, Format, And Duration

| Field | Common Value | What It Means | Example Use |
| --- | --- | --- | --- |
| `eBay Offer Marketplace ID` | `EBAY_US` | United States eBay site. | Selling to US buyers. |
| `eBay Offer Marketplace ID` | `EBAY_GB` | United Kingdom eBay site. | Selling to UK buyers. |
| `eBay Offer Marketplace ID` | `EBAY_DE` | Germany eBay site. | Selling to Germany. |
| `eBay Offer Marketplace ID` | `EBAY_AU` | Australia eBay site. | Selling to Australia. |
| `eBay Offer Format` | `FIXED_PRICE` | Buy It Now listing. | Standard set-price sale. |
| `eBay Offer Format` | `AUCTION` | Auction listing. | Buyers bid against each other. |
| `eBay Offer Listing Duration` | `GTC` | Good 'Til Cancelled. | Standard fixed-price listing. |
| `eBay Offer Listing Duration` | `DAYS_7` | Seven-day listing. | Common auction length. |
| `eBay Offer Listing Duration` | `DAYS_10` | Ten-day listing. | Longer auction where supported. |

### True Or False Fields

| Field | Common Value | What It Means | Example Use |
| --- | --- | --- | --- |
| `eBay Offer Include Catalog Product Details` | `true` | Let eBay add catalog info when it can. | Common branded item with a catalog match. |
| `eBay Offer Include Catalog Product Details` | `false` | Use only your own listing details. | Custom or unusual item. |
| `eBay Offer Hide Buyer Details` | `true` | More private listing setup. | Private buyer visibility cases. |
| `eBay Offer Hide Buyer Details` | `false` | Standard listing setup. | Most listings. |
| `eBay Offer Best Offer Enabled` | `true` | Buyers can send offers. | You are open to negotiation. |
| `eBay Offer Best Offer Enabled` | `false` | No offers allowed. | Fixed-price only sale. |
| `eBay Offer Tax Apply Tax` | `true` | Tax rules should be applied. | Normal taxable sale. |
| `eBay Offer Tax Apply Tax` | `false` | No tax rule is being sent in the listing data. | Special or non-tax workflow. |

### Responsible Person Role Values

| Field | Common Value | What It Means | Example Use |
| --- | --- | --- | --- |
| `eBay Offer Responsible Person N Type 1` | `MANUFACTURER` | The responsible party is the manufacturer. | Brand is handling the compliance role. |
| `eBay Offer Responsible Person N Type 1` | `IMPORTER` | The responsible party is the importer. | Import company is handling the compliance role. |
| `eBay Offer Responsible Person N Type 1` | `EU_RESPONSIBLE_PERSON` | The responsible party is the EU compliance contact. | EU-region compliance contact. |

## General Fill Rules

- Use lowercase `true` and `false` in CSV cells unless your importer expects something different.
- Use country codes like `US`, `GB`, `DE`, and `JP` in country fields.
- Use currency codes like `USD`, `EUR`, and `GBP` in currency fields.
- Use date-time values like `2026-03-19T18:00:00Z` when a field wants a date and time.
- If an eBay value is category-specific, double-check it against the target category before publishing.