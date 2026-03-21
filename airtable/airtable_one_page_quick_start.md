# Airtable Listing Import One-Page Quick Start

This is the shortest version of the setup.

Use this when you want to know which fields to fill first without reading the full reference guides.

Print note:
- This page is designed to work as a simple checklist you can print or keep beside the CSV.

## Start Here

- Use `airtable_combined_readable_main_sample.csv` if you want example rows to copy.
- Use `airtable_combined_readable_main.csv` if you want a blank template.
- Fill only the fields that apply to your item.

## Shopify Checklist

Check these off first for most Shopify listings.

- [ ] `Shopify Title`: product name. Example: `Marantz Model 2230 Stereo Receiver`
- [ ] `Shopify Body HTML`: short description. Example: `<p>Fully serviced vintage receiver with walnut case.</p>`
- [ ] `Shopify Vendor`: brand or maker. Example: `Marantz`
- [ ] `Shopify Product Type`: your own category. Example: `Stereo Receiver`
- [ ] `Shopify Handle`: clean web address ending. Example: `marantz-model-2230-stereo-receiver`
- [ ] `Shopify Status`: usually `draft` until ready
- [ ] `Shopify Variant 1 Price`: selling price. Example: `899.00`
- [ ] `Shopify Variant 1 SKU`: your item code. Example: `MAR2230-EXC-120V`
- [ ] `Shopify Variant 1 Inventory Quantity`: quantity on hand. Example: `1`
- [ ] `Shopify Variant 1 Inventory Management`: usually `shopify`
- [ ] `Shopify Variant 1 Inventory Policy`: usually `deny`
- [ ] `Shopify Variant 1 Requires Shipping`: usually `true` for physical items
- [ ] `Shopify Variant 1 Taxable`: usually `true` for normal product sales
- [ ] `Shopify Image 1 Src`: main image URL
- [ ] `Shopify Image 1 Alt`: short description of that image

## Shopify: Fill These Only If Needed

- Tags: for search and filtering
- Options and more variants: if the item has choices like size, finish, or condition
- Extra Shopify fields: if you need collections, SEO text, category IDs, or extra media
- Metafields: if you want to store extra details outside the description

## eBay Checklist

Check these off first for most eBay listings.

- [ ] `eBay Inventory SKU`: your eBay item code. Example: `MAR2230-EXC-120V`
- [ ] `eBay Inventory Condition`: official eBay condition. Example: `USED_EXCELLENT`
- [ ] `eBay Inventory Condition Description`: short buyer-facing condition note
- [ ] `eBay Inventory Ship To Location Quantity`: quantity you can ship
- [ ] `eBay Inventory Product Title`: listing title
- [ ] `eBay Inventory Product Description`: full item description
- [ ] `eBay Inventory Product Brand`: brand name
- [ ] `eBay Inventory Product MPN`: model or maker part number
- [ ] `eBay Offer Marketplace ID`: usually `EBAY_US` if selling on US eBay
- [ ] `eBay Offer Format`: usually `FIXED_PRICE` unless it is an auction
- [ ] `eBay Offer Available Quantity`: quantity this listing can sell
- [ ] `eBay Offer Category ID`: main eBay category
- [ ] `eBay Offer Listing Description`: live buyer-facing description
- [ ] `eBay Offer Listing Duration`: usually `GTC` for fixed-price listings
- [ ] `eBay Offer Merchant Location Key`: existing eBay location key
- [ ] `eBay Offer Price Value`: selling price
- [ ] `eBay Offer Price Currency`: usually `USD`
- [ ] `eBay Offer Fulfillment Policy ID`: shipping policy ID
- [ ] `eBay Offer Payment Policy ID`: payment policy ID
- [ ] `eBay Offer Return Policy ID`: return policy ID

## eBay: Fill These Only If Needed

- Aspects: when the category wants details like model, color, or type
- Package size and weight: when shipping details matter
- Best Offer fields: only if you want offers
- Compliance, hazmat, safety, and responsible person fields: only when the category or selling region requires them
- Auction fields: only for auction listings

## Common Values Most People Use

| Situation | Common Value |
| --- | --- |
| Shopify live later | `draft` |
| Shopify live now | `active` |
| Shopify track stock | `shopify` |
| Shopify stop selling at zero | `deny` |
| Shopify physical item | `true` |
| eBay US marketplace | `EBAY_US` |
| eBay fixed-price listing | `FIXED_PRICE` |
| eBay good-til-cancelled | `GTC` |
| eBay US dollars | `USD` |

## Simple Rule

- Shopify: describe the product, add price and SKU, add one image, then add tags or extra fields only if needed.
- eBay: describe the item in Inventory, then describe how it sells in Offer.
- If a field does not apply to your item, leave it blank.

## Final Review Checklist

- [ ] I filled the core title, description, price, and SKU fields.
- [ ] I added at least one good image.
- [ ] I checked quantity and inventory settings.
- [ ] I left non-applicable fields blank instead of guessing.
- [ ] For eBay, I added the policy IDs and marketplace/category fields.