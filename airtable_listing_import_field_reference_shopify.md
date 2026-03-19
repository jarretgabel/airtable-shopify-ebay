# Airtable Listing Import Field Reference: Shopify

This guide explains the Shopify fields in plain language and shows an example for each field.

## Start Here

If you are filling out Shopify for the first time, start with these fields first:
- `Shopify Title`
- `Shopify Body HTML`
- `Shopify Vendor`
- `Shopify Product Type`
- `Shopify Handle`
- `Shopify Variant N Price`
- `Shopify Variant N SKU`
- `Shopify Variant N Inventory Quantity`
- `Shopify Status`
- `Shopify Image 1 Src`

Leave the extra Shopify fields blank unless you specifically need collections, SEO text, category IDs, gift card settings, subscriptions, or extra media.

Use the `Usually Fill?` column this way:
- `Yes` means most listings will use it.
- `Maybe` means some listings use it often.
- `No` means leave it blank unless you specifically need it.

## How To Read This Page

- If a field name includes `N`, that means the same kind of field can repeat. Example: `Shopify Variant N SKU` means `Variant 1 SKU`, `Variant 2 SKU`, and so on.
- Most people can fill the main Shopify fields first and ignore the extra Shopify fields unless they need categories, collections, SEO text, or extra media.
- If you want the exact CSV column labels, use `airtable_listing_import_field_reference_shopify_main_technical_detail.md` and `airtable_listing_import_field_reference_shopify_extra_technical_detail.md`.

## Basic Product Fields

| Field Name | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `Shopify Title` | Yes | The product name customers will see. | `Marantz Model 2230 Stereo Receiver` |
| `Shopify Body HTML` | Yes | The main product description where you explain the item. | `<p>Fully serviced vintage receiver with walnut case.</p>` |
| `Shopify Vendor` | Yes | The brand or maker name. | `Marantz` |
| `Shopify Product Type` | Yes | Your own category name inside Shopify. | `Stereo Receiver` |
| `Shopify Handle` | Yes | The end of the product page web address. | `marantz-model-2230-stereo-receiver` |
| `Shopify Published At` | Maybe | The date and time you want the product to go live. | `2026-03-19T15:00:00Z` |
| `Shopify Published Scope` | No | An older visibility setting. Most stores can leave this blank. | `web` |
| `Shopify Status` | Yes | Whether the product is live, draft, or archived. | `active` |
| `Shopify Template Suffix` | No | A special page layout name if your theme uses one. | `audio-gear` |

Common values for these fields:
- `Shopify Status`: `draft` means saved but not live, `active` means live for customers, `archived` means kept for records but not actively sold.
- `Shopify Published Scope`: `web` is the older value most people would use only if they need it.

## Tags

| Field Name Pattern | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `Shopify Tag 1` through `Shopify Tag 10` | Maybe | Adds search and filter labels to the product. Put one tag in each field. | `Shopify Tag 1 = Vintage Audio` |

## Options

Options describe the choices a customer can pick, like size, color, finish, or condition.

| Field Name Pattern | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `Shopify Option 1 Name` | Maybe | The label for the first choice group. | `Condition` |
| `Shopify Option 1 Value 1` through `Shopify Option 1 Value 5` | Maybe | The allowed choices for option 1. | `Excellent` |
| `Shopify Option 2 Name` | No | The label for the second choice group. | `Voltage` |
| `Shopify Option 2 Value 1` through `Shopify Option 2 Value 5` | No | The allowed choices for option 2. | `120V` |
| `Shopify Option 3 Name` | No | The label for the third choice group. | `Finish` |
| `Shopify Option 3 Value 1` through `Shopify Option 3 Value 5` | No | The allowed choices for option 3. | `Walnut` |

## Variants

Each variant is one sellable version of the product.

| Field Name Pattern | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `Shopify Variant N Price` | Yes | The selling price for that version. | `899.00` |
| `Shopify Variant N SKU` | Yes | Your internal item code for that version. | `MAR2230-EXC-120V` |
| `Shopify Variant N Inventory Quantity` | Yes | How many you have available. | `1` |
| `Shopify Variant N Inventory Management` | Yes | Tells Shopify who should track stock. | `shopify` |
| `Shopify Variant N Inventory Policy` | Yes | Decides what happens when stock reaches zero. | `deny` |
| `Shopify Variant N Compare At Price` | Maybe | A higher old price to show savings or original retail. | `999.00` |
| `Shopify Variant N Barcode` | Maybe | The UPC, EAN, ISBN, or barcode for that version. | `123456789012` |
| `Shopify Variant N Fulfillment Service` | Maybe | The shipping source for that version. | `manual` |
| `Shopify Variant N Option 1` | Maybe | The chosen value for option 1 on that version. | `Excellent` |
| `Shopify Variant N Option 2` | No | The chosen value for option 2 on that version. | `120V` |
| `Shopify Variant N Option 3` | No | The chosen value for option 3 on that version. | `Walnut` |
| `Shopify Variant N Taxable` | Yes | Says whether tax should apply. | `TRUE` |
| `Shopify Variant N Requires Shipping` | Yes | Says whether it is a physical item that ships. | `TRUE` |
| `Shopify Variant N Weight` | Maybe | The weight of that version. | `38` |
| `Shopify Variant N Weight Unit` | Maybe | The unit for the weight. | `lb` |
| `Shopify Variant N Image Src` | Maybe | A picture that belongs to that version. | `https://example.com/images/marantz-front.jpg` |
| `Shopify Variant N Image Alt` | Maybe | Short text describing that picture. | `Front view of Marantz 2230 receiver` |

Common values for these fields:
- `Shopify Variant N Inventory Management`: `shopify` means Shopify tracks your stock count, blank means it does not.
- `Shopify Variant N Inventory Policy`: `deny` stops sales at zero stock, `continue` allows overselling or backorders.
- `Shopify Variant N Taxable`: `true` means tax applies, `false` means it does not.
- `Shopify Variant N Requires Shipping`: `true` means it is a physical item, `false` means it does not need shipping.
- `Shopify Variant N Weight Unit`: common values are `lb`, `oz`, `kg`, and `g`.

## Images

| Field Name Pattern | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `Shopify Image 1 Src` through `Shopify Image 5 Src` | Yes | The web address for a product photo Shopify should import. | `https://example.com/images/marantz-angle.jpg` |
| `Shopify Image 1 Alt` through `Shopify Image 5 Alt` | Maybe | A short description of the photo for accessibility and search. | `Angled view of the receiver with walnut cabinet` |
| `Shopify Image 1 Position` through `Shopify Image 5 Position` | Maybe | The order the photos should appear on the product page. | `1` |
| `Shopify Image 1 Variant SKU` through `Shopify Image 5 Variant SKU` | No | Links a photo to one specific variant if needed. | `MAR2230-EXC-120V` |

## Custom Product Details

These fields let you save extra details that do not fit the main product fields.

| Field Name Pattern | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `Shopify Metafield N Namespace` | No | The group name for the extra detail. | `specs` |
| `Shopify Metafield N Key` | No | The short name of the extra detail. | `power_output` |
| `Shopify Metafield N Type` | No | The kind of information being stored. | `single_line_text_field` |
| `Shopify Metafield N Value` | No | The actual extra detail you want to save. | `30 watts per channel` |

Common values for these fields:
- `Shopify Metafield N Type`: `single_line_text_field` for short text, `multi_line_text_field` for longer notes, `boolean` for true/false, `number_integer` for whole numbers, `number_decimal` for decimals, and `url` for web links.

## Extra Shopify Fields

These are the less-common Shopify fields used for store organization, search appearance, and special selling setups.

| Field Name | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `Shopify Extra Category ID` | Maybe | Shopify's own category ID if you want more structured categorization. | `gid://shopify/TaxonomyCategory/aa-1-12` |
| `Shopify Extra Combined Listing Role` | No | Used only when a product is acting as a parent or child in a grouped listing. | `PARENT` |
| `Shopify Extra Gift Card` | No | Says whether the product is a gift card. | `FALSE` |
| `Shopify Extra Gift Card Template Suffix` | No | A special page layout for gift cards if your store uses one. | `holiday-card` |
| `Shopify Extra Requires Selling Plan` | No | Says whether the item must be sold through a subscription or plan. | `FALSE` |
| `Shopify Extra SEO Title` | Maybe | The title you want search engines to show. | `Marantz 2230 Stereo Receiver for Sale` |
| `Shopify Extra SEO Description` | Maybe | The short search-engine summary for the product page. | `Shop restored Marantz 2230 receivers with detailed condition notes.` |
| `Shopify Extra Template Suffix` | No | A special page layout name for the product page. | `vintage-hi-fi` |
| `Shopify Extra Claim Ownership Bundles` | No | A bundle-related setting most sellers can leave blank. | `FALSE` |

Common values for these fields:
- `Shopify Extra Status`: `DRAFT` means saved but hidden, `ACTIVE` means live, `ARCHIVED` means retired.
- `Shopify Extra Gift Card`: `true` means the product is a gift card, `false` means it is not.
- `Shopify Extra Requires Selling Plan`: `true` means the product must be sold through a subscription or selling plan, `false` means normal one-time purchase.
- `Shopify Extra Claim Ownership Bundles`: `true` means a bundle flow controls the setup, `false` means no special bundle ownership is being claimed.

## Collections

| Field Name Pattern | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `Shopify Extra Collection 1 ID` through `Shopify Extra Collection 5 ID` | Maybe | Places the product into one or more Shopify collections. | `gid://shopify/Collection/1234567890` |

## Extra Custom Details

| Field Name Pattern | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `Shopify Extra Metafield N Namespace` | No | The group name for an extra saved detail. | `specs` |
| `Shopify Extra Metafield N Key` | No | The short name of that saved detail. | `phono_stage` |
| `Shopify Extra Metafield N Type` | No | The kind of information being stored. | `single_line_text_field` |
| `Shopify Extra Metafield N Value` | No | The actual extra detail you want to save. | `Built-in moving magnet phono input` |

Common values for these fields:
- `Shopify Extra Metafield N Type`: common values include `single_line_text_field`, `multi_line_text_field`, and `boolean`.

## Extra Tags And Media

| Field Name Pattern | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `Shopify Extra Tag 1` through `Shopify Extra Tag 10` | No | Adds tags in the extra Shopify section. | `Restored` |
| `Shopify Extra Media N Original Source` | No | A web address for an extra image or media file. | `https://example.com/images/marantz-back.jpg` |
| `Shopify Extra Media N Content Type` | No | Tells Shopify what kind of media file it is. | `IMAGE` |
| `Shopify Extra Media N Alt` | No | Short text describing that image or media item. | `Rear panel showing inputs and speaker terminals` |

Common values for these fields:
- `Shopify Extra Media N Content Type`: `IMAGE` for normal product photos, `VIDEO` for uploaded video, `EXTERNAL_VIDEO` for a hosted video link, and `MODEL_3D` for a 3D model.

## Practical Guidance

- Start with title, description, vendor, product type, price, SKU, quantity, status, and images.
- Use tags if you want easier store filtering or internal organization.
- Use options only if the product has real customer-selectable choices.
- Use the extra Shopify fields only when you need collections, SEO text, category IDs, or extra media.