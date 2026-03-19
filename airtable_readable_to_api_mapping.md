# Airtable Readable To API Mapping

This guide links the human-readable Airtable headers to the API key/value structures they represent.

Use it when you need to convert a readable column such as `Shopify REST Variant 1 Price` into the exact payload shape and a concrete key/value example.

## How To Read The Tables

- `Readable Header Pattern` is the column name from the Airtable CSV.
- `API Path` is the payload path used by Shopify or eBay.
- `Example Key/Value Pair` shows the shape you would send in the request body.
- `Notes` explains index handling or special behavior.

## Core Link Field

| Readable Header Pattern | API Path | Example Key/Value Pair | Notes |
| --- | --- | --- | --- |
| `Listing Key` | Not sent to Shopify or eBay | `"listing_key": "LISTING-0001"` | Internal Airtable/import key only. |

## Shopify REST Mapping

| Readable Header Pattern | API Path | Example Key/Value Pair | Notes |
| --- | --- | --- | --- |
| `Shopify REST Title` | `product.title` | `"title": "McIntosh MA8900 Integrated Amplifier"` | Root product field. |
| `Shopify REST Body HTML` | `product.body_html` | `"body_html": "<p>Flagship integrated amplifier...</p>"` | HTML allowed. |
| `Shopify REST Vendor` | `product.vendor` | `"vendor": "McIntosh"` | Root product field. |
| `Shopify REST Product Type` | `product.product_type` | `"product_type": "Integrated Amplifier"` | Merchant-defined type. |
| `Shopify REST Handle` | `product.handle` | `"handle": "mcintosh-ma8900-integrated-amplifier"` | URL slug. |
| `Shopify REST Published At` | `product.published_at` | `"published_at": "2026-03-19T18:00:00Z"` | Optional. |
| `Shopify REST Published Scope` | `product.published_scope` | `"published_scope": "web"` | Legacy REST publication field. |
| `Shopify REST Status` | `product.status` | `"status": "draft"` | Typical values: `draft`, `active`, `archived`. |
| `Shopify REST Template Suffix` | `product.template_suffix` | `"template_suffix": "premium-audio"` | Optional theme template suffix. |
| `Shopify REST Tag N` | `product.tags` | `"tags": "mcintosh, integrated amplifier, used"` | Airtable splits tags into separate columns; Shopify REST receives a comma-separated string. |
| `Shopify REST Option N Name` | `product.options[N-1].name` | `"name": "Condition"` | One option object per slot. |
| `Shopify REST Option N Value M` | `product.options[N-1].values[M-1]` | `"values": ["Used", "Open Box"]` | Multiple Airtable value slots collapse into one values array. |
| `Shopify REST Variant N Price` | `product.variants[N-1].price` | `"price": "4999.00"` | Variant object field. |
| `Shopify REST Variant N SKU` | `product.variants[N-1].sku` | `"sku": "MCINTOSHMA8900-120V"` | Variant object field. |
| `Shopify REST Variant N Inventory Quantity` | `product.variants[N-1].inventory_quantity` | `"inventory_quantity": 1` | Numeric quantity. |
| `Shopify REST Variant N Inventory Management` | `product.variants[N-1].inventory_management` | `"inventory_management": "shopify"` | Usually `shopify` or blank. |
| `Shopify REST Variant N Inventory Policy` | `product.variants[N-1].inventory_policy` | `"inventory_policy": "deny"` | Common values: `deny`, `continue`. |
| `Shopify REST Variant N Compare At Price` | `product.variants[N-1].compare_at_price` | `"compare_at_price": "5499.00"` | Optional strike-through price. |
| `Shopify REST Variant N Barcode` | `product.variants[N-1].barcode` | `"barcode": "123456789012"` | UPC/EAN/ISBN style value. |
| `Shopify REST Variant N Fulfillment Service` | `product.variants[N-1].fulfillment_service` | `"fulfillment_service": "manual"` | Often `manual`. |
| `Shopify REST Variant N Option 1` | `product.variants[N-1].option1` | `"option1": "Used"` | Selected value for option 1. |
| `Shopify REST Variant N Option 2` | `product.variants[N-1].option2` | `"option2": "120V"` | Selected value for option 2. |
| `Shopify REST Variant N Option 3` | `product.variants[N-1].option3` | `"option3": "Black"` | Selected value for option 3. |
| `Shopify REST Variant N Taxable` | `product.variants[N-1].taxable` | `"taxable": true` | Boolean. |
| `Shopify REST Variant N Requires Shipping` | `product.variants[N-1].requires_shipping` | `"requires_shipping": true` | Boolean. |
| `Shopify REST Variant N Weight` | `product.variants[N-1].weight` | `"weight": 75` | Numeric weight. |
| `Shopify REST Variant N Weight Unit` | `product.variants[N-1].weight_unit` | `"weight_unit": "lb"` | Common values: `lb`, `oz`, `kg`, `g`. |
| `Shopify REST Variant N Image Src` | `product.images[*].src` plus variant association logic | `"src": "https://example.com/ma8900-front.jpg"` | Helper for downstream association logic. |
| `Shopify REST Variant N Image Alt` | `product.images[*].alt` | `"alt": "Front view of McIntosh MA8900"` | Helper for the linked image. |
| `Shopify REST Image N Src` | `product.images[N-1].src` | `"src": "https://example.com/ma8900-front.jpg"` | One image object per slot. |
| `Shopify REST Image N Alt` | `product.images[N-1].alt` | `"alt": "Front view of McIntosh MA8900"` | Image alt text. |
| `Shopify REST Image N Position` | `product.images[N-1].position` | `"position": 1` | Image sort order. |
| `Shopify REST Image N Variant SKU` | Derived mapping to a matching variant | `"variant_ids": [1234567890]` | Implementation must resolve SKU to Shopify variant ID if explicit linkage is needed. |
| `Shopify REST Metafield N Namespace` | `product.metafields[N-1].namespace` | `"namespace": "custom"` | One metafield object per slot. |
| `Shopify REST Metafield N Key` | `product.metafields[N-1].key` | `"key": "condition_notes"` | Metafield key. |
| `Shopify REST Metafield N Type` | `product.metafields[N-1].type` | `"type": "single_line_text_field"` | Shopify metafield type. |
| `Shopify REST Metafield N Value` | `product.metafields[N-1].value` | `"value": "Excellent cosmetic condition"` | Stored metafield value. |

## Shopify GraphQL Mapping

| Readable Header Pattern | API Path | Example Key/Value Pair | Notes |
| --- | --- | --- | --- |
| `Shopify GraphQL Title` | `input.title` | `title: "McIntosh MA8900 Integrated Amplifier"` | Used in `productCreate(input: ...)`. |
| `Shopify GraphQL Description HTML` | `input.descriptionHtml` | `descriptionHtml: "<p>Flagship integrated amplifier...</p>"` | HTML allowed. |
| `Shopify GraphQL Vendor` | `input.vendor` | `vendor: "McIntosh"` | Root GraphQL input field. |
| `Shopify GraphQL Product Type` | `input.productType` | `productType: "Integrated Amplifier"` | Merchant-defined type. |
| `Shopify GraphQL Handle` | `input.handle` | `handle: "mcintosh-ma8900-integrated-amplifier"` | URL slug. |
| `Shopify GraphQL Category ID` | `input.category` | `category: "gid://shopify/TaxonomyCategory/123"` | Taxonomy category ID. |
| `Shopify GraphQL Combined Listing Role` | `input.combinedListingRole` | `combinedListingRole: PARENT` | Enum-style value when used. |
| `Shopify GraphQL Gift Card` | `input.giftCard` | `giftCard: false` | Boolean. |
| `Shopify GraphQL Gift Card Template Suffix` | `input.giftCardTemplateSuffix` | `giftCardTemplateSuffix: "holiday"` | Optional. |
| `Shopify GraphQL Requires Selling Plan` | `input.requiresSellingPlan` | `requiresSellingPlan: false` | Boolean. |
| `Shopify GraphQL SEO Title` | `input.seo.title` | `title: "McIntosh MA8900 Integrated Amplifier for Sale"` | Nested SEO object. |
| `Shopify GraphQL SEO Description` | `input.seo.description` | `description: "Used McIntosh MA8900 integrated amplifier in excellent condition."` | Nested SEO object. |
| `Shopify GraphQL Status` | `input.status` | `status: DRAFT` | Common values: `DRAFT`, `ACTIVE`, `ARCHIVED`. |
| `Shopify GraphQL Template Suffix` | `input.templateSuffix` | `templateSuffix: "premium-audio"` | Optional. |
| `Shopify GraphQL Claim Ownership Bundles` | `input.claimOwnership.bundles` | `bundles: true` | Nested claim ownership object. |
| `Shopify GraphQL Collection N ID` | `collectionsToJoin[N-1]` | `"gid://shopify/Collection/1234567890"` | Separate list of collection IDs. |
| `Shopify GraphQL Option N Name` | `productOptions[N-1].name` | `name: "Condition"` | Product option definition. |
| `Shopify GraphQL Option N Value M` | `productOptions[N-1].values[M-1].name` | `name: "Used"` | Values are nested option value objects. |
| `Shopify GraphQL Metafield N Namespace` | `input.metafields[N-1].namespace` | `namespace: "custom"` | One metafield object per slot. |
| `Shopify GraphQL Metafield N Key` | `input.metafields[N-1].key` | `key: "condition_notes"` | GraphQL metafield key. |
| `Shopify GraphQL Metafield N Type` | `input.metafields[N-1].type` | `type: "single_line_text_field"` | GraphQL metafield type. |
| `Shopify GraphQL Metafield N Value` | `input.metafields[N-1].value` | `value: "Excellent cosmetic condition"` | GraphQL metafield value. |
| `Shopify GraphQL Tag N` | `input.tags[N-1]` | `"mcintosh"` | Airtable splits tags into one column per array element. |
| `Shopify GraphQL Media N Original Source` | `media[N-1].originalSource` | `originalSource: "https://example.com/ma8900-front.jpg"` | Media input sent alongside product creation or follow-up mutation. |
| `Shopify GraphQL Media N Content Type` | `media[N-1].mediaContentType` | `mediaContentType: IMAGE` | Enum-style value. |
| `Shopify GraphQL Media N Alt` | `media[N-1].alt` | `alt: "Front view of McIntosh MA8900"` | Alt text for media. |

## eBay Inventory Mapping

| Readable Header Pattern | API Path | Example Key/Value Pair | Notes |
| --- | --- | --- | --- |
| `eBay Inventory SKU` | `sku` | `"sku": "MCINTOSHMA8900-120V"` | Path parameter and logical record key. |
| `eBay Inventory Condition` | `condition` | `"condition": "USED_EXCELLENT"` | Enum-like eBay condition value. |
| `eBay Inventory Condition Description` | `conditionDescription` | `"conditionDescription": "Excellent cosmetic condition..."` | Free text. |
| `eBay Inventory Ship To Location Quantity` | `availability.shipToLocationAvailability.quantity` | `"quantity": 1` | Nested quantity field. |
| `eBay Inventory Distribution N Merchant Location Key` | `availability.shipToLocationAvailability.availabilityDistributions[N-1].merchantLocationKey` | `"merchantLocationKey": "main-warehouse"` | One distribution object per slot. |
| `eBay Inventory Distribution N Quantity` | `availability.shipToLocationAvailability.availabilityDistributions[N-1].quantity` | `"quantity": 1` | Distribution quantity. |
| `eBay Inventory Distribution N Fulfillment Time Unit` | `availability.shipToLocationAvailability.availabilityDistributions[N-1].fulfillmentTime.unit` | `"unit": "DAY"` | Nested fulfillment time object. |
| `eBay Inventory Distribution N Fulfillment Time Value` | `availability.shipToLocationAvailability.availabilityDistributions[N-1].fulfillmentTime.value` | `"value": 2` | Numeric handling time. |
| `eBay Inventory Pickup Location N Merchant Location Key` | `availability.pickupAtLocationAvailability.merchantLocationKey` | `"merchantLocationKey": "showroom"` | Combined sheet helper for pickup availability data. |
| `eBay Inventory Pickup Location N Availability Type` | `availability.pickupAtLocationAvailability.availabilityType` | `"availabilityType": "IN_STOCK"` | Enum-like value. |
| `eBay Inventory Pickup Location N Quantity` | `availability.pickupAtLocationAvailability.quantity` | `"quantity": 1` | Quantity at pickup location. |
| `eBay Inventory Pickup Location N Fulfillment Time Unit` | `availability.pickupAtLocationAvailability.fulfillmentTime.unit` | `"unit": "HOUR"` | Pickup readiness unit. |
| `eBay Inventory Pickup Location N Fulfillment Time Value` | `availability.pickupAtLocationAvailability.fulfillmentTime.value` | `"value": 4` | Pickup readiness value. |
| `eBay Inventory Condition Descriptor N Name` | `product.conditionDescriptors[N-1].name` | `"name": "Cosmetic"` | Structured descriptor object. |
| `eBay Inventory Condition Descriptor N Value 1` | `product.conditionDescriptors[N-1].values[0]` | `"values": ["Excellent"]` | Values array. |
| `eBay Inventory Condition Descriptor N Value 2` | `product.conditionDescriptors[N-1].values[1]` | `"values": ["Excellent", "Tested"]` | Second array value when used. |
| `eBay Inventory Condition Descriptor N Additional Info` | `product.conditionDescriptors[N-1].additionalInfo` | `"additionalInfo": "Minor hairline marks on top cover only"` | Optional. |
| `eBay Inventory Package Type` | `packageWeightAndSize.packageType` | `"packageType": "BOX"` | Shipping package field. |
| `eBay Inventory Shipping Irregular` | `packageWeightAndSize.shippingIrregular` | `"shippingIrregular": false` | Boolean. |
| `eBay Inventory Package Length` | `packageWeightAndSize.dimensions.length` | `"length": 26` | Numeric dimension. |
| `eBay Inventory Package Width` | `packageWeightAndSize.dimensions.width` | `"width": 22` | Numeric dimension. |
| `eBay Inventory Package Height` | `packageWeightAndSize.dimensions.height` | `"height": 15` | Numeric dimension. |
| `eBay Inventory Package Dimension Unit` | `packageWeightAndSize.dimensions.unit` | `"unit": "INCH"` | Enum-like unit. |
| `eBay Inventory Package Weight Value` | `packageWeightAndSize.weight.value` | `"value": 92` | Numeric weight. |
| `eBay Inventory Package Weight Unit` | `packageWeightAndSize.weight.unit` | `"unit": "POUND"` | Enum-like unit. |
| `eBay Inventory Product Title` | `product.title` | `"title": "McIntosh MA8900 Integrated Amplifier"` | Inventory product field. |
| `eBay Inventory Product Description` | `product.description` | `"description": "<p>Used McIntosh MA8900...</p>"` | HTML allowed. |
| `eBay Inventory Product Brand` | `product.brand` | `"brand": "McIntosh"` | Product brand. |
| `eBay Inventory Product MPN` | `product.mpn` | `"mpn": "MA8900"` | Manufacturer Part Number. |
| `eBay Inventory Product ePID` | `product.epid` | `"epid": "123456789"` | Catalog reference when known. |
| `eBay Inventory Product Subtitle` | `product.subtitle` | `"subtitle": "Original box included"` | Optional paid field. |
| `eBay Inventory Aspect N Name` | `product.aspects.<AspectName>` | `"Brand": ["McIntosh"]` | The aspect name becomes the object key. |
| `eBay Inventory Aspect N Value 1` | `product.aspects.<AspectName>[0]` | `"Brand": ["McIntosh"]` | First array value. |
| `eBay Inventory Aspect N Value 2` | `product.aspects.<AspectName>[1]` | `"Color": ["Black", "Silver"]` | Second array value. |
| `eBay Inventory Aspect N Value 3` | `product.aspects.<AspectName>[2]` | `"Inputs": ["XLR", "RCA", "USB"]` | Third array value. |
| `eBay Inventory EAN N` | `product.ean[N-1]` | `"ean": ["4001234567890"]` | Identifier array. |
| `eBay Inventory ISBN N` | `product.isbn[N-1]` | `"isbn": ["9781234567890"]` | Identifier array. |
| `eBay Inventory UPC N` | `product.upc[N-1]` | `"upc": ["123456789012"]` | Identifier array. |
| `eBay Inventory Video ID N` | `product.videoIds[N-1]` | `"videoIds": ["v1234567890"]` | eBay-hosted video ID array. |

## eBay Offer Mapping

| Readable Header Pattern | API Path | Example Key/Value Pair | Notes |
| --- | --- | --- | --- |
| `eBay Offer Marketplace ID` | `marketplaceId` | `"marketplaceId": "EBAY_US"` | Required offer field. |
| `eBay Offer Format` | `format` | `"format": "FIXED_PRICE"` | Common values: `FIXED_PRICE`, `AUCTION`. |
| `eBay Offer Available Quantity` | `availableQuantity` | `"availableQuantity": 1` | Offer quantity. |
| `eBay Offer Category ID` | `categoryId` | `"categoryId": "14969"` | Primary category. |
| `eBay Offer Secondary Category ID` | `secondaryCategoryId` | `"secondaryCategoryId": "50597"` | Optional. |
| `eBay Offer Listing Description` | `listingDescription` | `"listingDescription": "<p>Used McIntosh MA8900...</p>"` | HTML allowed. |
| `eBay Offer Listing Duration` | `listingDuration` | `"listingDuration": "GTC"` | Common fixed-price duration. |
| `eBay Offer Listing Start Date` | `listingStartDate` | `"listingStartDate": "2026-03-20T16:00:00.000Z"` | Optional scheduling field. |
| `eBay Offer Lot Size` | `lotSize` | `"lotSize": 1` | Used for lot listings. |
| `eBay Offer Merchant Location Key` | `merchantLocationKey` | `"merchantLocationKey": "main-warehouse"` | Must match configured location. |
| `eBay Offer Include Catalog Product Details` | `includeCatalogProductDetails` | `"includeCatalogProductDetails": false` | Boolean. |
| `eBay Offer Hide Buyer Details` | `hideBuyerDetails` | `"hideBuyerDetails": false` | Boolean. |
| `eBay Offer Quantity Limit Per Buyer` | `quantityLimitPerBuyer` | `"quantityLimitPerBuyer": 1` | Numeric limit. |
| `eBay Offer Store Category N` | `storeCategoryNames[N-1]` or implementation-specific store category mapping | `"storeCategoryNames": ["Amplifiers"]` | Depending on implementation, this may be stored as names or IDs before translation. |
| `eBay Offer Charity ID` | `charity.charityId` | `"charityId": "12345"` | Nested charity block. |
| `eBay Offer Charity Donation Percentage` | `charity.donationPercentage` | `"donationPercentage": 10.0` | Numeric percentage. |
| `eBay Offer EPR Eco Participation Fee Value` | `extendedProducerResponsibility.ecoParticipationFee.value` | `"value": "3.50"` | Regional compliance field. |
| `eBay Offer EPR Eco Participation Fee Currency` | `extendedProducerResponsibility.ecoParticipationFee.currency` | `"currency": "EUR"` | Currency code. |
| `eBay Offer Price Value` | `pricingSummary.price.value` | `"value": "4999.00"` | Nested pricing object. |
| `eBay Offer Price Currency` | `pricingSummary.price.currency` | `"currency": "USD"` | Currency code. |
| `eBay Offer Auction Start Price Value` | `pricingSummary.auctionStartPrice.value` | `"value": "999.00"` | Auction only. |
| `eBay Offer Auction Start Price Currency` | `pricingSummary.auctionStartPrice.currency` | `"currency": "USD"` | Auction only. |
| `eBay Offer Auction Reserve Price Value` | `pricingSummary.auctionReservePrice.value` | `"value": "1500.00"` | Auction only. |
| `eBay Offer Auction Reserve Price Currency` | `pricingSummary.auctionReservePrice.currency` | `"currency": "USD"` | Auction only. |
| `eBay Offer Minimum Advertised Price Value` | `pricingSummary.minimumAdvertisedPrice.value` | `"value": "4799.00"` | MAP programs only. |
| `eBay Offer Minimum Advertised Price Currency` | `pricingSummary.minimumAdvertisedPrice.currency` | `"currency": "USD"` | MAP programs only. |
| `eBay Offer Original Retail Price Value` | `pricingSummary.originalRetailPrice.value` | `"value": "7500.00"` | Strike-through pricing support. |
| `eBay Offer Original Retail Price Currency` | `pricingSummary.originalRetailPrice.currency` | `"currency": "USD"` | Strike-through pricing support. |
| `eBay Offer Originally Sold For Retail Price On` | `pricingSummary.originallySoldForRetailPriceOn` | `"originallySoldForRetailPriceOn": "ON_EBAY"` | Enum-like value. |
| `eBay Offer Pricing Visibility` | `pricingSummary.pricingVisibility` | `"pricingVisibility": "PRE_CHECKOUT"` | MAP-related control. |
| `eBay Offer Fulfillment Policy ID` | `listingPolicies.fulfillmentPolicyId` | `"fulfillmentPolicyId": "1234567890"` | Nested policies block. |
| `eBay Offer Payment Policy ID` | `listingPolicies.paymentPolicyId` | `"paymentPolicyId": "1234567890"` | Nested policies block. |
| `eBay Offer Return Policy ID` | `listingPolicies.returnPolicyId` | `"returnPolicyId": "1234567890"` | Nested policies block. |
| `eBay Offer Best Offer Enabled` | `listingPolicies.bestOfferTerms.bestOfferEnabled` | `"bestOfferEnabled": true` | Nested Best Offer block. |
| `eBay Offer Best Offer Auto Accept Price Value` | `listingPolicies.bestOfferTerms.autoAcceptPrice.value` | `"value": "4800.00"` | Best Offer threshold. |
| `eBay Offer Best Offer Auto Accept Price Currency` | `listingPolicies.bestOfferTerms.autoAcceptPrice.currency` | `"currency": "USD"` | Best Offer threshold currency. |
| `eBay Offer Best Offer Auto Decline Price Value` | `listingPolicies.bestOfferTerms.autoDeclinePrice.value` | `"value": "4300.00"` | Best Offer threshold. |
| `eBay Offer Best Offer Auto Decline Price Currency` | `listingPolicies.bestOfferTerms.autoDeclinePrice.currency` | `"currency": "USD"` | Best Offer threshold currency. |
| `eBay Offer eBay Plus If Eligible` | `listingPolicies.ebayPlusIfEligible` | `"ebayPlusIfEligible": false` | Boolean. |
| `eBay Offer Global Product Compliance Policy N` | `regulatory.productCompliancePolicies.globalPolicies[N-1]` | `"globalPolicies": ["policy-id-1"]` | Repeated policy list. |
| `eBay Offer Regional Product Compliance Country N` | `regulatory.productCompliancePolicies.regionalPolicies[N-1].region` | `"region": "DE"` | Paired with policy ID. |
| `eBay Offer Regional Product Compliance Policy N` | `regulatory.productCompliancePolicies.regionalPolicies[N-1].policyId` | `"policyId": "policy-id-de"` | Paired with region. |
| `eBay Offer Take Back Policy ID` | `regulatory.takeBackPolicies.globalPolicyId` | `"globalPolicyId": "takeback-1"` | Global take-back field. |
| `eBay Offer Regional Take Back Country N` | `regulatory.takeBackPolicies.regionalPolicies[N-1].region` | `"region": "DE"` | Paired with policy ID. |
| `eBay Offer Regional Take Back Policy N` | `regulatory.takeBackPolicies.regionalPolicies[N-1].policyId` | `"policyId": "takeback-de"` | Paired with region. |
| `eBay Offer Shipping Override N Service Type` | `shippingCostOverrides[N-1].shippingServiceType` | `"shippingServiceType": "UPS_GROUND"` | One override object per slot. |
| `eBay Offer Shipping Override N Priority` | `shippingCostOverrides[N-1].priority` | `"priority": 1` | Numeric priority. |
| `eBay Offer Shipping Override N Shipping Cost Value` | `shippingCostOverrides[N-1].shippingCost.value` | `"value": "0.00"` | Nested amount. |
| `eBay Offer Shipping Override N Shipping Cost Currency` | `shippingCostOverrides[N-1].shippingCost.currency` | `"currency": "USD"` | Nested amount currency. |
| `eBay Offer Shipping Override N Additional Shipping Cost Value` | `shippingCostOverrides[N-1].additionalShippingCost.value` | `"value": "15.00"` | Optional. |
| `eBay Offer Shipping Override N Additional Shipping Cost Currency` | `shippingCostOverrides[N-1].additionalShippingCost.currency` | `"currency": "USD"` | Optional. |
| `eBay Offer Shipping Override N Surcharge Value` | `shippingCostOverrides[N-1].surcharge.value` | `"value": "10.00"` | Optional. |
| `eBay Offer Shipping Override N Surcharge Currency` | `shippingCostOverrides[N-1].surcharge.currency` | `"currency": "USD"` | Optional. |
| `eBay Offer Tax Apply Tax` | `tax.applyTax` | `"applyTax": false` | Boolean. |
| `eBay Offer Tax Third Party Tax Category` | `tax.thirdPartyTaxCategory` | `"thirdPartyTaxCategory": "AUDIO_EQUIPMENT"` | Optional. |
| `eBay Offer Tax VAT Percentage` | `tax.vatPercentage` | `"vatPercentage": 19.0` | Numeric VAT percent. |
| `eBay Offer Regulatory Document N` | `regulatory.documents[N-1].documentId` or implementation reference | `"documentId": "doc-123"` | Combined sheet often stores external refs or URLs that need resolution before submission. |
| `eBay Offer Energy Efficiency Image Description` | `regulatory.energyEfficiencyLabel.imageDescription` | `"imageDescription": "Rear panel label photo"` | Nested energy label block. |
| `eBay Offer Energy Efficiency Image URL` | `regulatory.energyEfficiencyLabel.imageUrl` | `"imageUrl": "https://example.com/ma8900-label.jpg"` | Nested energy label block. |
| `eBay Offer Energy Efficiency Product Information Sheet` | `regulatory.energyEfficiencyLabel.productInformationSheet` | `"productInformationSheet": "https://example.com/docs/spec-sheet.pdf"` | Nested energy label block. |
| `eBay Offer Hazmat Component` | `hazardousMaterials.component` | `"component": "Lithium button cell in remote"` | Nested hazmat block. |
| `eBay Offer Hazmat Signal Word` | `hazardousMaterials.signalWord` | `"signalWord": "Warning"` | Enum-like or controlled value. |
| `eBay Offer Hazmat Pictogram N` | `hazardousMaterials.pictograms[N-1]` | `"pictograms": ["GHS02"]` | Array of codes. |
| `eBay Offer Hazmat Statement N` | `hazardousMaterials.statements[N-1]` | `"statements": ["Contains small lithium battery..."]` | Array of statements or codes. |
| `eBay Offer Manufacturer Company Name` | `regulatory.manufacturer.companyName` | `"companyName": "McIntosh Laboratory, Inc."` | Nested manufacturer block. |
| `eBay Offer Manufacturer Address Line 1` | `regulatory.manufacturer.address.addressLine1` | `"addressLine1": "2 Chambers Street"` | Nested address block. |
| `eBay Offer Manufacturer Address Line 2` | `regulatory.manufacturer.address.addressLine2` | `"addressLine2": "Suite 100"` | Optional. |
| `eBay Offer Manufacturer City` | `regulatory.manufacturer.address.city` | `"city": "Binghamton"` | Nested address block. |
| `eBay Offer Manufacturer State Or Province` | `regulatory.manufacturer.address.stateOrProvince` | `"stateOrProvince": "NY"` | Nested address block. |
| `eBay Offer Manufacturer Postal Code` | `regulatory.manufacturer.address.postalCode` | `"postalCode": "13903"` | Nested address block. |
| `eBay Offer Manufacturer Country` | `regulatory.manufacturer.address.country` | `"country": "US"` | Country code. |
| `eBay Offer Manufacturer Email` | `regulatory.manufacturer.email` | `"email": "support@example.com"` | Contact field. |
| `eBay Offer Manufacturer Phone` | `regulatory.manufacturer.phone` | `"phone": "+1-607-000-0000"` | Contact field. |
| `eBay Offer Manufacturer Contact URL` | `regulatory.manufacturer.contactUrl` | `"contactUrl": "https://www.mcintoshlabs.com"` | Contact field. |
| `eBay Offer Product Safety Component` | `productSafety.component` | `"component": "Power amplifier chassis"` | Nested product safety block. |
| `eBay Offer Product Safety Pictogram N` | `productSafety.pictograms[N-1]` | `"pictograms": ["Safety01"]` | Array of codes. |
| `eBay Offer Product Safety Statement N` | `productSafety.statements[N-1]` | `"statements": ["Disconnect from mains before servicing"]` | Array of statements or codes. |
| `eBay Offer Repair Score` | `productSafety.repairScore` | `"repairScore": 7` | Numeric repairability field. |
| `eBay Offer Responsible Person N Company Name` | `regulatory.responsiblePersons[N-1].companyName` | `"companyName": "EU Audio Imports GmbH"` | One responsible person object per slot. |
| `eBay Offer Responsible Person N Address Line 1` | `regulatory.responsiblePersons[N-1].address.addressLine1` | `"addressLine1": "Musterstrasse 1"` | Nested address field. |
| `eBay Offer Responsible Person N Address Line 2` | `regulatory.responsiblePersons[N-1].address.addressLine2` | `"addressLine2": "2nd Floor"` | Optional. |
| `eBay Offer Responsible Person N City` | `regulatory.responsiblePersons[N-1].address.city` | `"city": "Berlin"` | Nested address field. |
| `eBay Offer Responsible Person N State Or Province` | `regulatory.responsiblePersons[N-1].address.stateOrProvince` | `"stateOrProvince": "BE"` | Nested address field. |
| `eBay Offer Responsible Person N Postal Code` | `regulatory.responsiblePersons[N-1].address.postalCode` | `"postalCode": "10115"` | Nested address field. |
| `eBay Offer Responsible Person N Country` | `regulatory.responsiblePersons[N-1].address.country` | `"country": "DE"` | Country code. |
| `eBay Offer Responsible Person N Email` | `regulatory.responsiblePersons[N-1].email` | `"email": "compliance@example.eu"` | Contact field. |
| `eBay Offer Responsible Person N Phone` | `regulatory.responsiblePersons[N-1].phone` | `"phone": "+49-30-000000"` | Contact field. |
| `eBay Offer Responsible Person N Contact URL` | `regulatory.responsiblePersons[N-1].contactUrl` | `"contactUrl": "https://example.eu/contact"` | Contact field. |
| `eBay Offer Responsible Person N Type 1` | `regulatory.responsiblePersons[N-1].types[0]` | `"types": ["MANUFACTURER"]` | First role entry. |
| `eBay Offer Responsible Person N Type 2` | `regulatory.responsiblePersons[N-1].types[1]` | `"types": ["MANUFACTURER", "IMPORTER"]` | Second role entry when used. |

## Value Crosswalk Notes

- Shopify REST tags look like separate readable values in Airtable, but they collapse into one comma-separated `tags` string in the REST payload.
- eBay aspect names become dynamic object keys. For example, `eBay Inventory Aspect 1 Name = Brand` and `eBay Inventory Aspect 1 Value 1 = McIntosh` becomes `"Brand": ["McIntosh"]`.
- Many eBay compliance fields are nested objects or arrays. The readable columns exist to make those structures editable in Airtable without JSON blobs.
- Some readable helper columns, such as image-to-variant SKU linkage or document URLs, may require transformation before submission because the upstream API expects IDs or nested object references instead of the raw readable value.