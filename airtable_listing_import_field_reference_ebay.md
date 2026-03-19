# Airtable Listing Import Field Reference: eBay

This guide explains the eBay fields in plain language and shows an example for each field.

Use the `Usually Fill?` column this way:
- `Yes` means most listings will use it.
- `Maybe` means some listings use it often.
- `No` means leave it blank unless you specifically need it.

## Inventory Basic Fields

| Field Name | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `eBay Inventory SKU` | Yes | Your item code for this product on eBay. | `MAR2230-EXC-120V` |
| `eBay Inventory Condition` | Yes | The official eBay condition for the item. | `USED_EXCELLENT` |
| `eBay Inventory Condition Description` | Yes | A short condition note for buyers. | `Fully tested with light cabinet wear and a recap in 2025.` |
| `eBay Inventory Ship To Location Quantity` | Yes | How many you can ship to buyers. | `1` |

Common values for these fields:
- `eBay Inventory Condition`: common values include `NEW`, `LIKE_NEW`, `NEW_OTHER`, `USED_EXCELLENT`, `USED_VERY_GOOD`, `USED_GOOD`, `CERTIFIED_REFURBISHED`, and `SELLER_REFURBISHED`.
- These condition values are category-dependent, so treat them as common examples, not a guaranteed list for every category.

## Availability By Location

| Field Name Pattern | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `eBay Inventory Distribution N Merchant Location Key` | Maybe | The name or code for a shipping location that holds stock. | `warehouse-main` |
| `eBay Inventory Distribution N Quantity` | Maybe | How many units are stored at that shipping location. | `1` |
| `eBay Inventory Distribution N Fulfillment Time Unit` | Maybe | The unit for how long handling takes there. | `DAY` |
| `eBay Inventory Distribution N Fulfillment Time Value` | Maybe | The number of those time units. | `2` |
| `eBay Inventory Pickup Location N Merchant Location Key` | No | The name or code for a pickup location. | `showroom-atlanta` |
| `eBay Inventory Pickup Location N Availability Type` | No | Says whether local pickup is available. | `IN_STOCK` |
| `eBay Inventory Pickup Location N Quantity` | No | How many units can be picked up there. | `1` |
| `eBay Inventory Pickup Location N Fulfillment Time Unit` | No | The unit for how soon pickup can be ready. | `HOUR` |
| `eBay Inventory Pickup Location N Fulfillment Time Value` | No | The number of those time units. | `4` |

Common values for these fields:
- `eBay Inventory Distribution N Fulfillment Time Unit`: `DAY` is common for shipping handling time.
- `eBay Inventory Pickup Location N Fulfillment Time Unit`: `HOUR` is common for same-day pickup readiness and `DAY` is common for next-day pickup.
- `eBay Inventory Pickup Location N Availability Type`: `IN_STOCK` is the common value when pickup is available.

## Condition Descriptors

| Field Name Pattern | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `eBay Inventory Condition Descriptor N Name` | No | The name or code of the condition detail you are filling in. | `FrameColor` |
| `eBay Inventory Condition Descriptor N Value 1` | No | The first value for that condition detail. | `Silver` |
| `eBay Inventory Condition Descriptor N Value 2` | No | A second value if the field allows more than one. | `Walnut` |
| `eBay Inventory Condition Descriptor N Additional Info` | No | A plain-language note about that condition detail. | `Original veneer with minor edge wear` |

## Package Details

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

## Product Details, Aspects, And Identifiers

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

## Offer Basic Listing Fields

| Field Name | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `eBay Offer Marketplace ID` | Yes | The eBay site where you want to sell it. | `EBAY_US` |
| `eBay Offer Format` | Yes | The selling style, like fixed price or auction. | `FIXED_PRICE` |
| `eBay Offer Available Quantity` | Yes | How many units this live offer should sell from inventory. | `1` |
| `eBay Offer Category ID` | Yes | The main eBay category where the item belongs. | `50597` |
| `eBay Offer Secondary Category ID` | No | A second category if you want the item shown in one more place. | `14981` |
| `eBay Offer Listing Description` | Yes | The buyer-facing description on the live listing. | `<p>Freshly serviced and ready to play.</p>` |
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

## Pricing And Policy Fields

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
| `eBay Offer Minimum Advertised Price Value` | No | A protected advertised price if brand rules require one. | `849.00` |
| `eBay Offer Minimum Advertised Price Currency` | No | The currency for that advertised price. | `USD` |
| `eBay Offer Original Retail Price Value` | Maybe | A former higher price used to show a markdown. | `1099.00` |
| `eBay Offer Original Retail Price Currency` | Maybe | The currency for the original retail price. | `USD` |
| `eBay Offer Originally Sold For Retail Price On` | No | Says where that original retail price was established. | `ON_EBAY` |
| `eBay Offer PricingVisibility` | No | Controls how certain protected prices are shown to buyers. | `PRE_CHECKOUT` |
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

## Shipping, Tax, And Compliance Fields

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

## Regulatory, Hazmat, Manufacturer, Product Safety, And Responsible Persons

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

## Practical Guidance

- Fill the inventory section to describe the item itself.
- Fill the offer section to describe price, category, policies, and selling setup.
- Category-specific required aspects and compliance fields can still vary by marketplace and category.