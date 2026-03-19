# Airtable Listing Import Field Reference: Shopify Extra Technical Detail

This companion guide explains the extra Shopify field group in plain language and shows an example for each field.

Use this page when you want the detailed breakdown of the less-common Shopify category, collection, SEO, media, and special-setup columns.

Use the `Usually Fill?` column this way:
- `Yes` means most listings will use it.
- `Maybe` means some listings use it often.
- `No` means leave it blank unless you specifically need it.

## Basic Product Fields

| Field Name | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `Shopify GraphQL Title` | No | Another title field in the extra Shopify section. Use the same product name if you fill this section. | `Marantz Model 2230 Stereo Receiver` |
| `Shopify GraphQL Description HTML` | No | Another description field in the extra Shopify section. | `<p>Classic receiver with warm analog sound.</p>` |
| `Shopify GraphQL Vendor` | No | The brand or maker name. | `Marantz` |
| `Shopify GraphQL Product Type` | No | Your own category label inside Shopify. | `Stereo Receiver` |
| `Shopify GraphQL Handle` | No | The end of the product page web address. | `marantz-model-2230-stereo-receiver` |
| `Shopify GraphQL Category ID` | Maybe | Shopify's own category ID if you want more structured categorization. | `gid://shopify/TaxonomyCategory/aa-1-12` |
| `Shopify GraphQL Combined Listing Role` | No | Used only when a product is acting as a parent or child in a grouped listing. | `PARENT` |
| `Shopify GraphQL Gift Card` | No | Says whether the product is a gift card. | `FALSE` |
| `Shopify GraphQL Gift Card Template Suffix` | No | A special page layout for gift cards if your store uses one. | `holiday-card` |
| `Shopify GraphQL Requires Selling Plan` | No | Says whether the item must be sold through a subscription or plan. | `FALSE` |
| `Shopify GraphQL SEO Title` | Maybe | The title you want search engines to show. | `Marantz 2230 Stereo Receiver for Sale` |
| `Shopify GraphQL SEO Description` | Maybe | The short search-engine summary for the product page. | `Shop restored Marantz 2230 receivers with detailed condition notes.` |
| `Shopify GraphQL Status` | No | Whether the product is live, draft, or archived. | `ACTIVE` |
| `Shopify GraphQL Template Suffix` | No | A special page layout name for the product page. | `vintage-hi-fi` |
| `Shopify GraphQL Claim Ownership Bundles` | No | A bundle-related setting most sellers can leave blank. | `FALSE` |

## Collections

| Field Name Pattern | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `Shopify GraphQL Collection 1 ID` through `Shopify GraphQL Collection 5 ID` | Maybe | Places the product into one or more Shopify collections. | `gid://shopify/Collection/1234567890` |

## Options

| Field Name Pattern | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `Shopify GraphQL Option 1 Name` | No | The first choice group in the extra Shopify section. | `Condition` |
| `Shopify GraphQL Option 1 Value 1` through `Shopify GraphQL Option 1 Value 5` | No | The allowed choices for option 1. | `Excellent` |
| `Shopify GraphQL Option 2 Name` | No | The second choice group in the extra Shopify section. | `Voltage` |
| `Shopify GraphQL Option 2 Value 1` through `Shopify GraphQL Option 2 Value 5` | No | The allowed choices for option 2. | `120V` |
| `Shopify GraphQL Option 3 Name` | No | The third choice group in the extra Shopify section. | `Finish` |
| `Shopify GraphQL Option 3 Value 1` through `Shopify GraphQL Option 3 Value 5` | No | The allowed choices for option 3. | `Walnut` |

## Metafields

| Field Name Pattern | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `Shopify GraphQL Metafield N Namespace` | No | The group name for an extra saved detail. | `specs` |
| `Shopify GraphQL Metafield N Key` | No | The short name of that saved detail. | `phono_stage` |
| `Shopify GraphQL Metafield N Type` | No | The kind of information being stored. | `single_line_text_field` |
| `Shopify GraphQL Metafield N Value` | No | The actual extra detail you want to save. | `Built-in moving magnet phono input` |

## Tags And Media

| Field Name Pattern | Usually Fill? | What It Is Doing | Example |
| --- | --- | --- | --- |
| `Shopify GraphQL Tag 1` through `Shopify GraphQL Tag 10` | No | Adds tags in the extra Shopify section. | `Restored` |
| `Shopify GraphQL Media N Original Source` | No | A web address for an extra image or media file. | `https://example.com/images/marantz-back.jpg` |
| `Shopify GraphQL Media N Content Type` | No | Tells Shopify what kind of media file it is. | `IMAGE` |
| `Shopify GraphQL Media N Alt` | No | Short text describing that image or media item. | `Rear panel showing inputs and speaker terminals` |

## Practical Guidance

- Use this section when you need collections, SEO details, category IDs, or extra media.
- If you do not know a collection ID or category ID yet, leave those fields blank.