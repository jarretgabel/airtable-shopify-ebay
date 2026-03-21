# Airtable Listing Import Field Reference

This guide puts the Shopify and eBay field references in one place and explains them in everyday language.

Use it with these combined CSV files:
- `airtable_combined_readable_main.csv`
- `airtable_combined_readable_main_sample.csv`

If you want the shortest possible version first, open:
- `airtable_one_page_quick_start.md`

If you want platform-specific pages, open:
- `airtable_listing_import_field_reference_shopify.md`
- `airtable_listing_import_field_reference_ebay.md`

## How To Read This Guide

- If a field name includes `N`, that means the same kind of field can repeat. Example: `Shopify Variant N SKU` means `Variant 1 SKU`, `Variant 2 SKU`, and so on.
- If a field does not apply to your item, leave it blank.
- `Usually Fill? = Yes` means it is part of the normal first-pass fields for most listings.
- `Usually Fill? = Maybe` means some sellers use it often, but not every listing needs it.
- `Usually Fill? = No` means leave it blank unless you have a specific reason to use it.
- If you need the exact CSV column labels, use the technical-detail Shopify pages.

## Shopify Main Product Fields

These are the main Shopify fields most people use first.

| Field Name | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `Shopify Title` | Yes | The product name customers will see. | `Marantz Model 2230 Stereo Receiver` |
| `Shopify Body HTML` | Yes | The main product description. This is where you describe the item and its highlights. | `<p>Fully serviced vintage receiver with walnut case.</p>` |
| `Shopify Vendor` | Yes | The brand or maker name. | `Marantz` |
| `Shopify Product Type` | Yes | Your own product category name inside Shopify. | `Stereo Receiver` |
| `Shopify Handle` | Yes | The end of the product page web address. | `marantz-model-2230-stereo-receiver` |
| `Shopify Published At` | Maybe | The date and time you want the product to go live. | `2026-03-19T15:00:00Z` |
| `Shopify Published Scope` | No | An older visibility setting. Most stores can leave this blank. | `web` |
| `Shopify Status` | Yes | Whether the product is live, saved as draft, or archived. | `active` |
| `Shopify Template Suffix` | No | A special page layout name if your theme uses one. | `audio-gear` |

Common values for these fields:
- `Shopify Status`: `draft` means saved but not live yet, `active` means live for customers, `archived` means kept for records but not actively sold.
- `Shopify Published Scope`: `web` is the older value most people would only use if needed.

## Shopify Tags

| Field Name Pattern | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `Shopify Tag 1` through `Shopify Tag 10` | Maybe | Adds search and filter labels to the product. Put one tag in each field. | `Shopify Tag 1 = Vintage Audio` |

## Shopify Options

Options describe the choices a customer can pick, like size, color, or condition.

| Field Name Pattern | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `Shopify Option 1 Name` | Maybe | The label for the first choice group. | `Condition` |
| `Shopify Option 1 Value 1` through `Shopify Option 1 Value 5` | Maybe | The allowed choices for option 1. | `Excellent` |
| `Shopify Option 2 Name` | No | The label for the second choice group. | `Voltage` |
| `Shopify Option 2 Value 1` through `Shopify Option 2 Value 5` | No | The allowed choices for option 2. | `120V` |
| `Shopify Option 3 Name` | No | The label for the third choice group. | `Finish` |
| `Shopify Option 3 Value 1` through `Shopify Option 3 Value 5` | No | The allowed choices for option 3. | `Walnut` |

## Shopify Variants

Variants are the actual versions of the product you sell.

| Field Name Pattern | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `Shopify Variant N Price` | Yes | The selling price for that version of the product. | `899.00` |
| `Shopify Variant N SKU` | Yes | Your internal item code for that version. | `MAR2230-EXC-120V` |
| `Shopify Variant N Inventory Quantity` | Yes | How many of that version you have available. | `1` |
| `Shopify Variant N Inventory Management` | Yes | Tells Shopify who should track the stock count. | `shopify` |
| `Shopify Variant N Inventory Policy` | Yes | Decides what happens when stock runs out. | `deny` |
| `Shopify Variant N Compare At Price` | Maybe | A higher old price to show savings or original retail. | `999.00` |
| `Shopify Variant N Barcode` | Maybe | The UPC, EAN, ISBN, or other barcode for that version. | `123456789012` |
| `Shopify Variant N Fulfillment Service` | Maybe | The shipping source for that version. Most stores use their normal setup. | `manual` |
| `Shopify Variant N Option 1` | Maybe | The chosen value for option 1 on that version. | `Excellent` |
| `Shopify Variant N Option 2` | No | The chosen value for option 2 on that version. | `120V` |
| `Shopify Variant N Option 3` | No | The chosen value for option 3 on that version. | `Walnut` |
| `Shopify Variant N Taxable` | Yes | Says whether sales tax should apply to that version. | `TRUE` |
| `Shopify Variant N Requires Shipping` | Yes | Says whether it is a physical item that needs shipping. | `TRUE` |
| `Shopify Variant N Weight` | Maybe | The weight of that version. | `38` |
| `Shopify Variant N Weight Unit` | Maybe | The unit for the weight. | `lb` |
| `Shopify Variant N Image Src` | Maybe | A picture that belongs to that version. | `https://example.com/images/marantz-front.jpg` |
| `Shopify Variant N Image Alt` | Maybe | Short text describing that version's picture. | `Front view of Marantz 2230 receiver` |

Common values for these fields:
- `Shopify Variant N Inventory Management`: `shopify` means Shopify tracks stock, blank means it does not.
- `Shopify Variant N Inventory Policy`: `deny` stops sales at zero stock, `continue` allows overselling or backorders.
- `Shopify Variant N Taxable`: `true` means tax applies, `false` means it does not.
- `Shopify Variant N Requires Shipping`: `true` means it is a physical item, `false` means it does not need shipping.
- `Shopify Variant N Weight Unit`: common values are `lb`, `oz`, `kg`, and `g`.

## Shopify Images

| Field Name Pattern | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `Shopify Image 1 Src` through `Shopify Image 5 Src` | Yes | The web address for a product photo Shopify should import. | `https://example.com/images/marantz-angle.jpg` |
| `Shopify Image 1 Alt` through `Shopify Image 5 Alt` | Maybe | A short description of the photo for accessibility and search. | `Angled view of the receiver with walnut cabinet` |
| `Shopify Image 1 Position` through `Shopify Image 5 Position` | Maybe | The order the photos should appear on the product page. | `1` |
| `Shopify Image 1 Variant SKU` through `Shopify Image 5 Variant SKU` | No | Links a photo to one specific variant if needed. | `MAR2230-EXC-120V` |

## Shopify Custom Product Details

These fields let you save extra details that do not fit the main product fields.

| Field Name Pattern | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `Shopify Metafield N Namespace` | No | The group name for the extra detail. | `specs` |
| `Shopify Metafield N Key` | No | The short name of the extra detail. | `power_output` |
| `Shopify Metafield N Type` | No | The kind of information you are storing. | `single_line_text_field` |
| `Shopify Metafield N Value` | No | The actual value for that extra detail. | `30 watts per channel` |

Common values for these fields:
- `Shopify Metafield N Type`: `single_line_text_field` for short text, `multi_line_text_field` for longer notes, `boolean` for true/false, `number_integer` for whole numbers, `number_decimal` for decimals, and `url` for web links.

## Shopify Extra Product Fields

These are the extra Shopify fields for category, collections, search text, and extra media.

| Field Name | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `Shopify Extra Title` | No | Another title field in the extra Shopify section. Use the same product name if you are filling this section. | `Marantz Model 2230 Stereo Receiver` |
| `Shopify Extra Description HTML` | No | Another description field in the extra Shopify section. | `<p>Classic receiver with warm analog sound.</p>` |
| `Shopify Extra Vendor` | No | The brand or maker name. | `Marantz` |
| `Shopify Extra Product Type` | No | Your own category label inside Shopify. | `Stereo Receiver` |
| `Shopify Extra Handle` | No | The end of the product page web address. | `marantz-model-2230-stereo-receiver` |
| `Shopify Extra Category ID` | Maybe | Shopify's own category ID if you want more structured categorization. | `gid://shopify/TaxonomyCategory/aa-1-12` |
| `Shopify Extra Combined Listing Role` | No | Used only when one product is acting as a parent or child in a grouped listing. | `PARENT` |
| `Shopify Extra Gift Card` | No | Says whether the product is a gift card. | `FALSE` |
| `Shopify Extra Gift Card Template Suffix` | No | A special page layout for gift cards if your store uses one. | `holiday-card` |
| `Shopify Extra Requires Selling Plan` | No | Says whether the item must be sold through a subscription or plan. | `FALSE` |
| `Shopify Extra SEO Title` | Maybe | The title you want search engines to show. | `Marantz 2230 Stereo Receiver for Sale` |
| `Shopify Extra SEO Description` | Maybe | The short search-engine summary for the product page. | `Shop restored Marantz 2230 receivers with detailed condition notes.` |
| `Shopify Extra Status` | No | Whether the product is live, draft, or archived. | `ACTIVE` |
| `Shopify Extra Template Suffix` | No | A special page layout name for the product page. | `vintage-hi-fi` |
| `Shopify Extra Claim Ownership Bundles` | No | A bundle-related setting most sellers can leave blank. | `FALSE` |

Common values for these fields:
- `Shopify Extra Status`: `DRAFT` means saved but hidden, `ACTIVE` means live, `ARCHIVED` means retired.
- `Shopify Extra Gift Card`: `true` means the product is a gift card, `false` means it is not.
- `Shopify Extra Requires Selling Plan`: `true` means the product must be sold through a subscription or selling plan, `false` means normal one-time purchase.
- `Shopify Extra Claim Ownership Bundles`: `true` means a bundle flow controls the setup, `false` means no special bundle ownership is being claimed.

## Shopify Collections

| Field Name Pattern | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `Shopify Extra Collection 1 ID` through `Shopify Extra Collection 5 ID` | Maybe | Places the product into one or more Shopify collections. | `gid://shopify/Collection/1234567890` |

## Shopify Extra Options

| Field Name Pattern | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `Shopify Extra Option 1 Name` | No | The first choice group in the extra Shopify section. | `Condition` |
| `Shopify Extra Option 1 Value 1` through `Shopify Extra Option 1 Value 5` | No | The allowed choices for option 1. | `Excellent` |
| `Shopify Extra Option 2 Name` | No | The second choice group in the extra Shopify section. | `Voltage` |
| `Shopify Extra Option 2 Value 1` through `Shopify Extra Option 2 Value 5` | No | The allowed choices for option 2. | `120V` |
| `Shopify Extra Option 3 Name` | No | The third choice group in the extra Shopify section. | `Finish` |
| `Shopify Extra Option 3 Value 1` through `Shopify Extra Option 3 Value 5` | No | The allowed choices for option 3. | `Walnut` |

## Shopify Extra Custom Details

| Field Name Pattern | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `Shopify Extra Metafield N Namespace` | No | The group name for an extra saved detail. | `specs` |
| `Shopify Extra Metafield N Key` | No | The short name of that saved detail. | `phono_stage` |
| `Shopify Extra Metafield N Type` | No | The kind of information being stored. | `single_line_text_field` |
| `Shopify Extra Metafield N Value` | No | The actual extra detail you want to save. | `Built-in moving magnet phono input` |

Common values for these fields:
- `Shopify Extra Metafield N Type`: common values include `single_line_text_field`, `multi_line_text_field`, and `boolean`.

## Shopify Extra Tags And Media

| Field Name Pattern | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `Shopify Extra Tag 1` through `Shopify Extra Tag 10` | No | Adds tags in the extra Shopify section. | `Restored` |
| `Shopify Extra Media N Original Source` | No | A web address for an extra image or media file. | `https://example.com/images/marantz-back.jpg` |
| `Shopify Extra Media N Content Type` | No | Tells Shopify what kind of media file it is. | `IMAGE` |
| `Shopify Extra Media N Alt` | No | Short text describing that image or media item. | `Rear panel showing inputs and speaker terminals` |

Common values for these fields:
- `Shopify Extra Media N Content Type`: `IMAGE` for normal product photos, `VIDEO` for uploaded video, `EXTERNAL_VIDEO` for a hosted video link, and `MODEL_3D` for a 3D model.

## eBay Inventory Basic Fields

These fields describe the item itself before you describe how it should be sold on eBay.

| Field Name | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `eBay Inventory SKU` | Yes | Your item code for this product on eBay. | `MAR2230-EXC-120V` |
| `eBay Inventory Condition` | Yes | The official eBay condition for the item. | `USED_EXCELLENT` |
| `eBay Inventory Condition Description` | Yes | A short condition note for buyers. | `Fully tested with light cabinet wear and a recap in 2025.` |
| `eBay Inventory Ship To Location Quantity` | Yes | How many you can ship to buyers. | `1` |

Common values for these fields:
- `eBay Inventory Condition`: common values include `NEW`, `LIKE_NEW`, `NEW_OTHER`, `USED_EXCELLENT`, `USED_VERY_GOOD`, `USED_GOOD`, `CERTIFIED_REFURBISHED`, and `SELLER_REFURBISHED`.
- These condition values are category-dependent, so treat them as common examples, not a guaranteed list for every category.

## eBay Availability By Location

Use these if stock is stored in more than one place or if store pickup is offered.

| Field Name Pattern | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `eBay Inventory Distribution N Merchant Location Key` | Maybe | The name or code for a shipping location that holds stock. | `warehouse-main` |
| `eBay Inventory Distribution N Quantity` | Maybe | How many units are stored at that shipping location. | `1` |
| `eBay Inventory Distribution N Fulfillment Time Unit` | Maybe | The unit for how long handling takes at that location. | `DAY` |
| `eBay Inventory Distribution N Fulfillment Time Value` | Maybe | The number of those units of time. | `2` |
| `eBay Inventory Pickup Location N Merchant Location Key` | No | The name or code for a pickup location. | `showroom-atlanta` |
| `eBay Inventory Pickup Location N Availability Type` | No | Says whether local pickup is available. | `IN_STOCK` |
| `eBay Inventory Pickup Location N Quantity` | No | How many units can be picked up there. | `1` |
| `eBay Inventory Pickup Location N Fulfillment Time Unit` | No | The unit for how soon pickup can be ready. | `HOUR` |
| `eBay Inventory Pickup Location N Fulfillment Time Value` | No | The number of those time units. | `4` |

Common values for these fields:
- `eBay Inventory Distribution N Fulfillment Time Unit`: `DAY` is common for shipping handling time.
- `eBay Inventory Pickup Location N Fulfillment Time Unit`: `HOUR` is common for same-day pickup readiness and `DAY` is common for next-day pickup.
- `eBay Inventory Pickup Location N Availability Type`: `IN_STOCK` is the common value when pickup is available.

## eBay Condition Descriptors

These give more structured detail about condition when a category allows it.

| Field Name Pattern | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `eBay Inventory Condition Descriptor N Name` | No | The name or code of the condition detail you are filling in. | `FrameColor` |
| `eBay Inventory Condition Descriptor N Value 1` | No | The first value for that condition detail. | `Silver` |
| `eBay Inventory Condition Descriptor N Value 2` | No | A second value if the field allows more than one. | `Walnut` |
| `eBay Inventory Condition Descriptor N Additional Info` | No | A plain-language note about that condition detail. | `Original veneer with minor edge wear` |

## eBay Package Details

These help eBay calculate shipping and delivery expectations.

| Field Name | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `eBay Inventory Package Type` | Maybe | The kind of box or package being used. | `BOX` |
| `eBay Inventory Shipping Irregular` | No | Says whether the package is an unusual shape. | `FALSE` |
| `eBay Inventory Package Length` | Maybe | The package length. | `24` |
| `eBay Inventory Package Width` | Maybe | The package width. | `19` |
| `eBay Inventory Package Height` | Maybe | The package height. | `11` |
| `eBay Inventory Package Dimension Unit` | Maybe | The measurement unit for the package size. | `INCH` |
| `eBay Inventory Package Weight Value` | Maybe | The package weight. | `42` |
| `eBay Inventory Package Weight Unit` | Maybe | The measurement unit for the package weight. | `POUND` |

Common values for these fields:
- `eBay Inventory Package Dimension Unit`: common values are `INCH`, `FOOT`, `CENTIMETER`, and `METER`.
- `eBay Inventory Package Weight Unit`: common values are `POUND`, `OUNCE`, `KILOGRAM`, and `GRAM`.
- `eBay Inventory Shipping Irregular`: `true` means awkward or unusual packaging, `false` means a normal box.

## eBay Product Details, Aspects, And Identifiers

These help buyers find the item and help eBay understand what it is.

| Field Name Pattern | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `eBay Inventory Product Title` | Yes | The main listing title buyers will see. | `Marantz 2230 Stereo Receiver Fully Serviced` |
| `eBay Inventory Product Description` | Yes | A fuller description of the item. | `<p>Serviced receiver with warm sound and clean faceplate.</p>` |
| `eBay Inventory Product Brand` | Yes | The brand name. | `Marantz` |
| `eBay Inventory Product MPN` | Maybe | The maker's part number or model number. | `2230` |
| `eBay Inventory Product ePID` | No | An eBay catalog ID if one exists for the item. | `1801204376` |
| `eBay Inventory Product Subtitle` | No | A shorter extra line under the title on eBay if you choose to use it. | `Recapped and tested` |
| `eBay Inventory Aspect N Name` | Maybe | The name of a product detail buyers filter by. | `Model` |
| `eBay Inventory Aspect N Value 1` through `eBay Inventory Aspect N Value 3` | Maybe | The value or values for that product detail. | `2230` |
| `eBay Inventory EAN 1` through `eBay Inventory EAN 3` | No | European barcode numbers if you have them. | `4006381333931` |
| `eBay Inventory ISBN 1` through `eBay Inventory ISBN 3` | No | Book-style identifier numbers when the item uses them. | `9780306406157` |
| `eBay Inventory UPC 1` through `eBay Inventory UPC 3` | Maybe | UPC barcode numbers if you have them. | `123456789012` |
| `eBay Inventory Video ID 1` through `eBay Inventory Video ID 3` | No | An eBay-hosted video ID tied to the item. | `v1234567890` |

## eBay Offer Basic Listing Fields

These fields describe how the item should be sold on eBay.

| Field Name | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `eBay Offer Marketplace ID` | Yes | The eBay site where you want to sell it. | `EBAY_US` |
| `eBay Offer Format` | Yes | The selling style, like fixed price or auction. | `FIXED_PRICE` |
| `eBay Offer Available Quantity` | Yes | How many units this live offer should sell from the inventory. | `1` |
| `eBay Offer Category ID` | Yes | The main eBay category where the item belongs. | `50597` |
| `eBay Offer Secondary Category ID` | No | A second category if you want the item shown in one more place. | `14981` |
| `eBay Offer Listing Description` | Yes | The buyer-facing description on the live eBay offer. | `<p>Freshly serviced and ready to play.</p>` |
| `eBay Offer Listing Duration` | Yes | How long the listing should stay live. | `GTC` |
| `eBay Offer Listing Start Date` | Maybe | When the listing should go live. | `2026-03-20T14:00:00Z` |
| `eBay Offer Lot Size` | No | How many units are sold together as one purchase. | `1` |
| `eBay Offer Merchant Location Key` | Yes | Which inventory location this offer should pull from. | `warehouse-main` |
| `eBay Offer Include Catalog Product Details` | Maybe | Lets eBay fill in matching catalog details when available. | `TRUE` |
| `eBay Offer Hide Buyer Details` | No | Makes the listing more private if needed. | `FALSE` |
| `eBay Offer Quantity Limit Per Buyer` | Maybe | Caps how many one buyer can purchase. | `1` |
| `eBay Offer Store Category 1` | No | Places the item in one store category inside your eBay Store. | `Vintage Audio` |
| `eBay Offer Store Category 2` | No | Places the item in a second eBay Store category. | `Receivers` |

Common values for these fields:
- `eBay Offer Marketplace ID`: common values include `EBAY_US`, `EBAY_GB`, `EBAY_DE`, and `EBAY_AU`.
- `eBay Offer Format`: `FIXED_PRICE` is the normal Buy It Now format and `AUCTION` is for bidding.
- `eBay Offer Listing Duration`: `GTC` is common for fixed-price listings, while `DAYS_7` and `DAYS_10` are common auction durations where supported.
- `eBay Offer Include Catalog Product Details`: `true` lets eBay add matching catalog details, `false` uses only your own listing details.
- `eBay Offer Hide Buyer Details`: `true` is a more private setup, `false` is the normal setup.

## eBay Pricing And Policy Fields

| Field Name Pattern | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `eBay Offer Charity ID` | No | The charity to receive a donation from the sale if you support one. | `12345` |
| `eBay Offer Charity Donation Percentage` | No | The percent of the sale to donate. | `10` |
| `eBay Offer EPR Eco Participation Fee Value` | No | An environmental fee amount where required. | `2.50` |
| `eBay Offer EPR Eco Participation Fee Currency` | No | The currency for that environmental fee. | `USD` |
| `eBay Offer Price Value` | Yes | The main selling price. | `899.00` |
| `eBay Offer Price Currency` | Yes | The currency for the selling price. | `USD` |
| `eBay Offer Auction Start Price Value` | No | The opening bid amount if it is an auction. | `499.00` |
| `eBay Offer Auction Start Price Currency` | No | The currency for the opening bid. | `USD` |
| `eBay Offer Auction Reserve Price Value` | No | The lowest auction result you are willing to accept. | `750.00` |
| `eBay Offer Auction Reserve Price Currency` | No | The currency for the reserve price. | `USD` |
| `eBay Offer Minimum Advertised Price Value` | No | A protected advertised price if your brand rules require one. | `849.00` |
| `eBay Offer Minimum Advertised Price Currency` | No | The currency for that advertised price. | `USD` |
| `eBay Offer Original Retail Price Value` | Maybe | A former higher price used to show a markdown. | `1099.00` |
| `eBay Offer Original Retail Price Currency` | Maybe | The currency for the original retail price. | `USD` |
| `eBay Offer Originally Sold For Retail Price On` | No | Says where that original retail price was established. | `ON_EBAY` |
| `eBay Offer Pricing Visibility` | No | Controls how certain protected prices are shown to buyers. | `PRE_CHECKOUT` |
| `eBay Offer Fulfillment Policy ID` | Yes | The shipping policy for the listing. | `620123456024` |
| `eBay Offer Payment Policy ID` | Yes | The payment policy for the listing. | `620123456025` |
| `eBay Offer Return Policy ID` | Yes | The return policy for the listing. | `620123456026` |
| `eBay Offer Best Offer Enabled` | Maybe | Turns the Best Offer button on or off. | `TRUE` |
| `eBay Offer Best Offer Auto Accept Price Value` | No | Automatically accepts offers at or above this amount. | `850.00` |
| `eBay Offer Best Offer Auto Accept Price Currency` | No | The currency for the auto-accept amount. | `USD` |
| `eBay Offer Best Offer Auto Decline Price Value` | No | Automatically rejects offers at or below this amount. | `700.00` |
| `eBay Offer Best Offer Auto Decline Price Currency` | No | The currency for the auto-decline amount. | `USD` |

Common values for these fields:
- `eBay Offer Price Currency`: `USD` is common for US listings.
- `eBay Offer Best Offer Enabled`: `true` turns on offers, `false` leaves the listing fixed-price only.
- `eBay Offer Originally Sold For Retail Price On`: `ON_EBAY` means that older reference price was established on eBay.

## eBay Shipping, Tax, And Compliance Fields

| Field Name Pattern | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `eBay Offer eBay Plus If Eligible` | No | Joins an eBay premium shipping program where available. | `FALSE` |
| `eBay Offer Global Product Compliance Policy 1` through `eBay Offer Global Product Compliance Policy 3` | No | Applies product compliance rules that cover all locations. | `7823456` |
| `eBay Offer Regional Product Compliance Country 1` through `eBay Offer Regional Product Compliance Country 2` | No | Names the country for a location-specific compliance rule. | `DE` |
| `eBay Offer Regional Product Compliance Policy 1` through `eBay Offer Regional Product Compliance Policy 2` | No | The matching compliance rule ID for that country. | `8943210` |
| `eBay Offer Take Back Policy ID` | No | The main recycling or take-back policy for the item. | `4567891` |
| `eBay Offer Regional Take Back Country 1` through `eBay Offer Regional Take Back Country 2` | No | The country for a local take-back rule. | `FR` |
| `eBay Offer Regional Take Back Policy 1` through `eBay Offer Regional Take Back Policy 2` | No | The matching local take-back rule ID. | `5566778` |
| `eBay Offer Shipping Override N Service Type` | No | Says whether a special shipping price applies to domestic or international shipping. | `DOMESTIC` |
| `eBay Offer Shipping Override N Priority` | No | Matches the override to the shipping service order in your policy. | `1` |
| `eBay Offer Shipping Override N Shipping Cost Value` | No | Sets a custom base shipping price. | `49.00` |
| `eBay Offer Shipping Override N Shipping Cost Currency` | No | The currency for the custom shipping price. | `USD` |
| `eBay Offer Shipping Override N Additional Shipping Cost Value` | No | The extra shipping amount for each additional unit. | `0.00` |
| `eBay Offer Shipping Override N Additional Shipping Cost Currency` | No | The currency for the extra shipping amount. | `USD` |
| `eBay Offer Shipping Override N Surcharge Value` | No | An added shipping surcharge if needed. | `10.00` |
| `eBay Offer Shipping Override N Surcharge Currency` | No | The currency for the surcharge. | `USD` |
| `eBay Offer Tax Apply Tax` | Maybe | Says whether tax rules should be applied. | `TRUE` |
| `eBay Offer Tax Third Party Tax Category` | No | A special tax code used only in some approved tax setups. | `WASTE_RECYCLING_FEE` |
| `eBay Offer Tax VAT Percentage` | No | The VAT rate for the item where VAT is used. | `20` |

Common values for these fields:
- `eBay Offer Tax Apply Tax`: `true` means tax rules should be applied, `false` means no tax rule is being sent in the listing data.

## eBay Regulatory, Hazmat, Manufacturer, Safety, And Responsible Person Fields

Use these only when your category, item type, or selling region requires them.

| Field Name Pattern | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `eBay Offer Regulatory Document 1` through `eBay Offer Regulatory Document 3` | No | Adds a regulatory document reference to the listing. | `DOC-CE-2026-001` |
| `eBay Offer Energy Efficiency Image Description` | No | Describes the energy label image in plain words. | `EU energy label showing class F` |
| `eBay Offer Energy Efficiency Image URL` | No | The web address of the energy label image. | `https://example.com/docs/energy-label.jpg` |
| `eBay Offer Energy Efficiency Product Information Sheet` | No | The web address of the detailed product info sheet. | `https://example.com/docs/product-sheet.pdf` |
| `eBay Offer Hazmat Component` | No | Names the hazardous part or material if one applies. | `Lead solder` |
| `eBay Offer Hazmat Signal Word` | No | The safety word required for that hazard. | `WARNING` |
| `eBay Offer Hazmat Pictogram 1` through `eBay Offer Hazmat Pictogram 3` | No | The hazard symbol code or codes that apply. | `GHS07` |
| `eBay Offer Hazmat Statement 1` through `eBay Offer Hazmat Statement 3` | No | The hazard statement code or codes that apply. | `H302` |
| `eBay Offer Manufacturer Company Name` | No | The manufacturer's business name. | `Marantz` |
| `eBay Offer Manufacturer Address Line 1` through `eBay Offer Manufacturer Contact URL` | No | The manufacturer's address and contact details. | `Manufacturer Address Line 1 = 100 Corporate Dr` |
| `eBay Offer Product Safety Component` | No | Names the safety-related part or concern. | `Power cord` |
| `eBay Offer Product Safety Pictogram 1` through `eBay Offer Product Safety Pictogram 3` | No | Safety symbol codes for the item. | `W001` |
| `eBay Offer Product Safety Statement 1` through `eBay Offer Product Safety Statement 3` | No | Safety warning codes or statements. | `Keep away from moisture` |
| `eBay Offer Repair Score` | No | A score showing how repairable the product is where supported. | `7.5` |
| `eBay Offer Responsible Person N Company Name` through `eBay Offer Responsible Person N Type 2` | No | The contact details for the business or person responsible for compliance in a region. | `Responsible Person 1 Company Name = EU Import Compliance GmbH` |

## Simple Starting Rule

- For Shopify, start with title, description, price, SKU, quantity, images, and tags.
- For Shopify extra fields, only fill the collection, SEO, category, or extra media fields when you actually need them.
- For eBay, fill the inventory section to describe the item itself.
- For eBay, fill the offer section to describe price, policies, category, and selling settings.
- Leave anything blank that does not apply to that item.