# Airtable Listing Import Field Reference: Shopify Main Technical Detail

This companion guide explains the main Shopify field group in plain language and shows an example for each field.

Use this page when you want the detailed breakdown of the main Shopify product, variant, image, tag, and custom-detail columns.

Use the `Usually Fill?` column this way:
- `Yes` means most listings will use it.
- `Maybe` means some listings use it often.
- `No` means leave it blank unless you specifically need it.

## Basic Product Fields

| Field Name | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `Shopify REST Title` | Yes | The product name customers will see. | `Marantz Model 2230 Stereo Receiver` |
| `Shopify REST Body HTML` | Yes | The main product description where you explain the item. | `<p>Fully serviced vintage receiver with walnut case.</p>` |
| `Shopify REST Vendor` | Yes | The brand or maker name. | `Marantz` |
| `Shopify REST Product Type` | Yes | Your own category name inside Shopify. | `Stereo Receiver` |
| `Shopify REST Handle` | Yes | The end of the product page web address. | `marantz-model-2230-stereo-receiver` |
| `Shopify REST Published At` | Maybe | The date and time you want the product to go live. | `2026-03-19T15:00:00Z` |
| `Shopify REST Published Scope` | No | An older visibility setting. Most stores can leave this blank. | `web` |
| `Shopify REST Status` | Yes | Whether the product is live, draft, or archived. | `active` |
| `Shopify REST Template Suffix` | No | A special page layout name if your theme uses one. | `audio-gear` |

## Tags

| Field Name Pattern | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `Shopify REST Tag 1` through `Shopify REST Tag 10` | Maybe | Adds search and filter labels to the product. Put one tag in each field. | `Shopify REST Tag 1 = Vintage Audio` |

## Options

Options describe the choices a customer can pick, like size, color, finish, or condition.

| Field Name Pattern | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `Shopify REST Option 1 Name` | Maybe | The label for the first choice group. | `Condition` |
| `Shopify REST Option 1 Value 1` through `Shopify REST Option 1 Value 5` | Maybe | The allowed choices for option 1. | `Excellent` |
| `Shopify REST Option 2 Name` | No | The label for the second choice group. | `Voltage` |
| `Shopify REST Option 2 Value 1` through `Shopify REST Option 2 Value 5` | No | The allowed choices for option 2. | `120V` |
| `Shopify REST Option 3 Name` | No | The label for the third choice group. | `Finish` |
| `Shopify REST Option 3 Value 1` through `Shopify REST Option 3 Value 5` | No | The allowed choices for option 3. | `Walnut` |

## Variants

Each variant is one sellable version of the product.

| Field Name Pattern | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `Shopify REST Variant N Price` | Yes | The selling price for that version. | `899.00` |
| `Shopify REST Variant N SKU` | Yes | Your internal item code for that version. | `MAR2230-EXC-120V` |
| `Shopify REST Variant N Inventory Quantity` | Yes | How many you have available. | `1` |
| `Shopify REST Variant N Inventory Management` | Yes | Tells Shopify who should track stock. | `shopify` |
| `Shopify REST Variant N Inventory Policy` | Yes | Decides what happens when stock reaches zero. | `deny` |
| `Shopify REST Variant N Compare At Price` | Maybe | A higher old price to show savings or original retail. | `999.00` |
| `Shopify REST Variant N Barcode` | Maybe | The UPC, EAN, ISBN, or barcode for that version. | `123456789012` |
| `Shopify REST Variant N Fulfillment Service` | Maybe | The shipping source for that version. | `manual` |
| `Shopify REST Variant N Option 1` | Maybe | The chosen value for option 1 on that version. | `Excellent` |
| `Shopify REST Variant N Option 2` | No | The chosen value for option 2 on that version. | `120V` |
| `Shopify REST Variant N Option 3` | No | The chosen value for option 3 on that version. | `Walnut` |
| `Shopify REST Variant N Taxable` | Yes | Says whether tax should apply. | `TRUE` |
| `Shopify REST Variant N Requires Shipping` | Yes | Says whether it is a physical item that ships. | `TRUE` |
| `Shopify REST Variant N Weight` | Maybe | The weight of that version. | `38` |
| `Shopify REST Variant N Weight Unit` | Maybe | The unit for the weight. | `lb` |
| `Shopify REST Variant N Image Src` | Maybe | A picture that belongs to that version. | `https://example.com/images/marantz-front.jpg` |
| `Shopify REST Variant N Image Alt` | Maybe | Short text describing that picture. | `Front view of Marantz 2230 receiver` |

## Images

| Field Name Pattern | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `Shopify REST Image 1 Src` through `Shopify REST Image 5 Src` | Yes | The web address for a product photo Shopify should import. | `https://example.com/images/marantz-angle.jpg` |
| `Shopify REST Image 1 Alt` through `Shopify REST Image 5 Alt` | Maybe | A short description of the photo for accessibility and search. | `Angled view of the receiver with walnut cabinet` |
| `Shopify REST Image 1 Position` through `Shopify REST Image 5 Position` | Maybe | The order the photos should appear on the product page. | `1` |
| `Shopify REST Image 1 Variant SKU` through `Shopify REST Image 5 Variant SKU` | No | Links a photo to one specific variant if needed. | `MAR2230-EXC-120V` |

## Metafields

These fields let you save extra details that do not fit the main product fields.

| Field Name Pattern | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `Shopify REST Metafield N Namespace` | No | The group name for the extra detail. | `specs` |
| `Shopify REST Metafield N Key` | No | The short name of the extra detail. | `power_output` |
| `Shopify REST Metafield N Type` | No | The kind of information being stored. | `single_line_text_field` |
| `Shopify REST Metafield N Value` | No | The actual extra detail you want to save. | `30 watts per channel` |

## Practical Guidance

- Start with title, description, price, SKU, quantity, images, and tags.
- Fill option names and allowed values before filling the variant option selections.
- Use metafields for details that do not belong in the main description.