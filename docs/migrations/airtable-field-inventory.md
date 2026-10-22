# Airtable Field Inventory

Generated for Phase 0 of [aws-postgres-database-plan.md](./aws-postgres-database-plan.md) from the read-only schema snapshot of base `apprsAm2FOohEmL2u` (schema only, no record data).

"Referenced" means the exact field name appears as a string literal in non-test code under `aws/src` (AWS) or `src` (frontend). Fields accessed through dynamic or normalized names (for example price and status variants) may show as unreferenced. Whether a reference reads or writes is not distinguished; see the read and write patterns in the plan.

Table 1, Shopify Listing and Ebay Listing are not primary sources; matches on common names such as `Title` or `Images` may belong to other tables.

## Summary

| Table | Fields | Referenced in code |
|---|---|---|
| Table 1 | 25 | 17 |
| Imported table | 494 | n/a (generic names match by accident) |
| Ebay Listing | 31 | 18 |
| Shopify Listing | 35 | 14 |
| Users | 9 | 9 |
| Listings | 163 | 144 |
| User Guide | 49 | 40 |
| Vendors | 1 | 1 |
| Image Roles | 6 | 2 |

## Table 1 (`tblgA8olAJtkRNZvK`)

Referenced fields (17 of 25):

| Field | Type | AWS files | Frontend files | Examples |
|---|---|---|---|---|
| SKU | singleLineText | 5 | 26 | receiveWebhook.ts, approvalDraft.ts, approvalDraftBody.ts |
| Brand | singleLineText | 3 | 12 | approvalDraft.ts, approvalDraftBody.ts, approvalDraftProduct.ts |
| Model | singleLineText | 4 | 23 | approvalDraft.ts, workflowIngest.ts, approvalDraftBody.ts |
| Component Type | singleLineText | 4 | 25 | approvalDraft.ts, workflowIngest.ts, approvalDraftBody.ts |
| Price | singleLineText | 5 | 13 | getConfiguredRecords.ts, approvalDraft.ts, approvalDraftBody.ts |
| Serial Number | singleLineText | 3 | 15 | approvalBodyTemplate.ts, approvalDraftBody.ts, usedGearIntakeFields.ts |
| Audiogon Rating | singleLineText | 2 | 17 | approvalBodyTemplate.ts, approvalDraftBody.ts, ApprovalFormFieldsSupplementalEditors.tsx |
| Voltage | singleLineText | 2 | 11 | approvalBodyTemplate.ts, approvalDraftBody.ts, ApprovalFormFieldsSupplementalEditors.tsx |
| Original Box | singleLineText | 3 | 19 | approvalBodyTemplate.ts, approvalDraftBody.ts, usedGearIntakeFields.ts |
| Manual | singleLineText | 1 | 18 | approvalDraftBody.ts, ApprovalFormFieldsSupplementalEditors.tsx, ListingApprovalCombinedSharedSection.tsx |
| Remote | singleLineText | 1 | 17 | approvalDraftBody.ts, ApprovalFormFieldsSupplementalEditors.tsx, ListingApprovalCombinedSharedSection.tsx |
| Power Cable | singleLineText | 3 | 20 | approvalBodyTemplate.ts, approvalDraftBody.ts, usedGearIntakeFields.ts |
| Shipping Method | singleLineText | 3 | 13 | approvalBodyTemplate.ts, approvalDraftBody.ts, usedGearIntakeFields.ts |
| Shipping Dimensions | singleLineText | 4 | 8 | approvalBodyTemplate.ts, approvalDraft.ts, approvalDraftBody.ts |
| Images | multipleAttachments | 1 | 13 | approvalDraft.ts, ListingApprovalCombinedSharedSection.tsx, ShopifySnapshotRecordPage.tsx |
| Inventory Notes | singleLineText | 1 | 14 | usedGearIntakeFields.ts, InventoryRecordEditorPage.tsx, WorkflowFormSnapshotSection.tsx |
| Status | singleSelect | 0 | 13 | ShopifySnapshotRecordPage.tsx, useListingApprovalPublishFieldState.ts, InventoryDirectoryListSection.tsx |

Not referenced by literal name (8): Distributor (singleLineText); Link (url); UPDATED PRICE (singleLineText); Scott Notes (singleLineText); Cosmetic Condition Notes (singleLineText); Link to eBay (url); Notes (multilineText); Assignee (singleCollaborator)

## Imported table (`tblYqqs0xvnSveIK0`)

494 multilineText fields, 0 records. Not used by any source. Candidate to exclude from the mirror.

## Ebay Listing (`tbl3yTb0JkzUMFNnS`)

Referenced fields (18 of 31):

| Field | Type | AWS files | Frontend files | Examples |
|---|---|---|---|---|
| Item Title | multilineText | 6 | 20 | getConfiguredRecords.ts, approvalDraft.ts, workflowIngest.ts |
| Description | richText | 4 | 10 | approvalDraft.ts, client.ts, approvalDraftBody.ts |
| Ebay Body (HTML) | multilineText | 2 | 2 | approvalDraft.ts, approvalPreview.ts, useListingApprovalPublishActions.ts |
| Key Features (Key, Value) | multilineText | 2 | 7 | approvalDraft.ts, approvalDraftBody.ts, listingApprovalEbayConstants.ts |
| Images (comma-separated) | multilineText | 1 | 0 | approvalDraft.ts |
| Images Alt Text (comma separated) | singleLineText | 1 | 0 | approvalDraftImages.ts |
| Ebay Categories | multipleSelects | 0 | 7 | useApprovalFormEbayCategorySetup.ts, useListingApprovalPublishFieldState.ts, InventoryRecordEditorPage.tsx |
| Ebay Listing Format | singleSelect | 0 | 3 | combinedListingsReadyForPublishing.ts, listingApprovalEbayConstants.ts, approvalStorePersistence.ts |
| Duration | singleSelect | 1 | 2 | approvalDraft.ts, EbaySnapshotRecordPage.tsx, ebayDraftFromAirtable.ts |
| Domestic Shipping Fees | multilineText | 0 | 3 | listingApprovalEbayConstants.ts, useApprovalFormEbayEditorSetup.ts, approvalStorePersistence.ts |
| Ebay Package Type | singleSelect | 1 | 1 | approvalDraft.ts, ebayDraftFromAirtable.ts |
| Item Zip Code | number | 1 | 1 | publish.ts, ListingApprovalCombinedEbaySection.tsx |
| Ebay Domestic Service 1 | singleSelect | 0 | 5 | useListingApprovalFieldNames.ts, useListingApprovalPreviewState.ts, useApprovalPreview.ts |
| Ebay Domestic Service 2 | singleSelect | 0 | 4 | useListingApprovalPreviewState.ts, useApprovalPreview.ts, approvalStorePersistence.ts |
| International Shipping Fees | multilineText | 0 | 3 | listingApprovalEbayConstants.ts, useApprovalFormEbayEditorSetup.ts, approvalStorePersistence.ts |
| International Service 1 | singleSelect | 0 | 6 | useApprovalFormEbayEditorSetup.ts, useListingApprovalPreviewState.ts, useApprovalPreview.ts |
| International Service 2 | singleSelect | 0 | 6 | useApprovalFormEbayEditorSetup.ts, useListingApprovalPreviewState.ts, useApprovalPreview.ts |
| Ebay Approved | singleSelect | 0 | 3 | InventoryRecordEditorPage.tsx, WorkflowSnapshotPage.tsx, usedGearQueue.ts |

Not referenced by literal name (13): Template Name (multilineText); Custom Label SKU (multilineText); Ebay Condition (singleSelect); Ebay Buy It Now/Starting Bid (currency); Ebay Quantity (number); Ebay Allow Offers (multilineText); Ebay International Destinations (singleSelect); Ebay Use Global Shipping Program (checkbox); Excluded Locations (singleSelect); Ebay Handling Cost USD (currency); Ebay Combined Shipping Discount Enabled (checkbox); Combined Shipping Discount Profile (multilineText); Ebay Handling Time Days (number)

## Shopify Listing (`tblqh6yC0p74UrHZo`)

Referenced fields (14 of 35):

| Field | Type | AWS files | Frontend files | Examples |
|---|---|---|---|---|
| Handle | multilineText | 1 | 4 | approvalDraftBody.ts, ShopifySnapshotRecordPage.tsx, listingApprovalTabPanels.ts |
| Title | multilineText | 5 | 14 | getConfiguredRecords.ts, approvalDraft.ts, approvalDraftBody.ts |
| Description | richText | 4 | 10 | approvalDraft.ts, client.ts, approvalDraftBody.ts |
| Key Features (Key, Value) | multilineText | 2 | 7 | approvalDraft.ts, approvalDraftBody.ts, listingApprovalEbayConstants.ts |
| Shopify Body (HTML) | multilineText | 1 | 2 | approvalDraftBody.ts, listingApprovalShopifyConstants.ts, shopifyDraftFromAirtableBody.ts |
| Shopify Type | multilineText | 4 | 6 | approvalDraft.ts, approvalDraftTypes.ts, approvalPreviewFieldResolvers.ts |
| Shopify Collections | multipleSelects | 1 | 2 | approvalDraftCollections.ts, shopifyDraftFromAirtableAssets.ts, approvalStorePersistence.ts |
| Shopify Tags | multipleSelects | 1 | 7 | approvalDraftTags.ts, approvalFormFieldsShopifyTagHelpers.ts, useListingApprovalFieldNames.ts |
| Shopify Price | number | 4 | 11 | getConfiguredRecords.ts, approvalDraftProduct.ts, approvalPublish.ts |
| Images (comma-separated) | multilineText | 1 | 0 | approvalDraft.ts |
| Images Alt Text (comma separated) | multilineText | 1 | 0 | approvalDraftImages.ts |
| Shopify Condition | singleSelect | 2 | 3 | approvalDraftBody.ts, approvalDraftProduct.ts, shopifyDraftFromAirtableBody.ts |
| Shopify Approved | singleSelect | 2 | 5 | getConfiguredRecords.ts, sources.ts, useListingApprovalPublishFieldState.ts |
| Shopify REST Product ID | singleLineText | 4 | 8 | receiveWebhook.ts, approvalPreview.ts, approvalPublish.ts |

Not referenced by literal name (21): Shopify Template-Variant-Name (singleSelect); Shopify Variant-Option (multilineText); Shopify Option-Values (multilineText); Shopify Variant-SKU (multilineText); Shopify Variant-Weight (number); Shopify Variant-Source (multilineText); Shopify Variant-Status (number); Shopify Variant-Fulfillment (multilineText); Shopify Variant-Price (multilineText); Shopify Variant-Requires-Shipping (singleSelect); Shopify Variant-Taxable (singleSelect); Image-Position (number); Shopify Image-Weight-Unit (number); Shopify Variant-Barcode (multilineText); Shopify Variant-Color (multilineText); Shopify Variant-Connector-Type (multilineText); Shopify Variant-Connection-Type (multilineText); Shopify Variant-Power-Type (multilineText); Shopify Variant-Unit-Type (multilineText); Shopify Variant-Style (multilineText); Shopify Variant-Status-Active (multilineText)

## Users (`tblj2Gt9USORo6Vi5`)

Referenced fields (9 of 9):

| Field | Type | AWS files | Frontend files | Examples |
|---|---|---|---|---|
| Name | singleLineText | 4 | 13 | upsertConfiguredRecord.ts, users.ts, approvalDraftBody.ts |
| User Id | singleLineText | 2 | 2 | upsertConfiguredRecord.ts, users.ts, roleNotificationDefaults.ts |
| Email | email | 2 | 1 | upsertConfiguredRecord.ts, users.ts, authStorage.ts |
| Password | singleLineText | 1 | 2 | users.ts, SettingsTab.tsx, authStorage.ts |
| Role | singleLineText | 2 | 1 | upsertConfiguredRecord.ts, users.ts, authStorage.ts |
| Allowed Pages | singleLineText | 2 | 1 | upsertConfiguredRecord.ts, users.ts, authStorage.ts |
| Notifications | singleLineText | 1 | 7 | upsertConfiguredRecord.ts, appNavigation.ts, pages.ts |
| Updated At | date | 1 | 2 | upsertConfiguredRecord.ts, ShopifySnapshotRecordPage.tsx, authStorage.ts |
| Created At | date | 0 | 2 | ShopifySnapshotRecordPage.tsx, authStorage.ts |

## Listings (`tbl0K0nFQL64jQMx8`)

Referenced fields (144 of 163):

| Field | Type | AWS files | Frontend files | Examples |
|---|---|---|---|---|
| Item Title | multilineText | 6 | 20 | getConfiguredRecords.ts, approvalDraft.ts, workflowIngest.ts |
| Description | richText | 4 | 10 | approvalDraft.ts, client.ts, approvalDraftBody.ts |
| Ebay Body (HTML) | multilineText | 2 | 2 | approvalDraft.ts, approvalPreview.ts, useListingApprovalPublishActions.ts |
| Key Features (Key, Value) | multilineText | 2 | 7 | approvalDraft.ts, approvalDraftBody.ts, listingApprovalEbayConstants.ts |
| Images (comma-separated) | multilineText | 1 | 0 | approvalDraft.ts |
| Images Alt Text (comma separated) | singleLineText | 1 | 0 | approvalDraftImages.ts |
| Ebay Categories | multipleSelects | 0 | 7 | useApprovalFormEbayCategorySetup.ts, useListingApprovalPublishFieldState.ts, InventoryRecordEditorPage.tsx |
| Ebay Listing Format | singleSelect | 0 | 3 | combinedListingsReadyForPublishing.ts, listingApprovalEbayConstants.ts, approvalStorePersistence.ts |
| Quantity | number | 4 | 7 | getConfiguredRecords.ts, approvalDraft.ts, approvalDraftProduct.ts |
| Ebay Domestic Shipping Fees | singleSelect | 0 | 1 | approvalStorePersistence.ts |
| Ebay Package Type | singleSelect | 1 | 1 | approvalDraft.ts, ebayDraftFromAirtable.ts |
| Item Zip Code | number | 1 | 1 | publish.ts, ListingApprovalCombinedEbaySection.tsx |
| Ebay Domestic Service 1 | singleSelect | 0 | 5 | useListingApprovalFieldNames.ts, useListingApprovalPreviewState.ts, useApprovalPreview.ts |
| Ebay International Shipping Fees | multilineText | 0 | 1 | approvalStorePersistence.ts |
| Ebay International Service 1 | singleSelect | 0 | 4 | useListingApprovalPreviewState.ts, useApprovalPreview.ts, approvalStorePersistence.ts |
| Ebay International Service 2 | singleSelect | 0 | 4 | useListingApprovalPreviewState.ts, useApprovalPreview.ts, approvalStorePersistence.ts |
| Ebay Approved | singleSelect | 0 | 3 | InventoryRecordEditorPage.tsx, WorkflowSnapshotPage.tsx, usedGearQueue.ts |
| Shopify Body (HTML) | multilineText | 1 | 2 | approvalDraftBody.ts, listingApprovalShopifyConstants.ts, shopifyDraftFromAirtableBody.ts |
| Shopify Type | singleLineText | 4 | 6 | approvalDraft.ts, approvalDraftTypes.ts, approvalPreviewFieldResolvers.ts |
| Shopify Collections | multipleSelects | 1 | 2 | approvalDraftCollections.ts, shopifyDraftFromAirtableAssets.ts, approvalStorePersistence.ts |
| Shopify Tags | multipleSelects | 1 | 7 | approvalDraftTags.ts, approvalFormFieldsShopifyTagHelpers.ts, useListingApprovalFieldNames.ts |
| Shopify Price | number | 4 | 11 | getConfiguredRecords.ts, approvalDraftProduct.ts, approvalPublish.ts |
| Ebay Price | currency | 3 | 9 | getConfiguredRecords.ts, approvalDraft.ts, usedGearPostPublish.ts |
| Condition | singleSelect | 3 | 12 | approvalDraft.ts, approvalDraftBody.ts, approvalDraftProduct.ts |
| Shopify Approved | singleSelect | 2 | 5 | getConfiguredRecords.ts, sources.ts, useListingApprovalPublishFieldState.ts |
| Shopify REST Product ID | singleLineText | 4 | 8 | receiveWebhook.ts, approvalPreview.ts, approvalPublish.ts |
| Arrival Date | date | 1 | 20 | usedGearIntakeFields.ts, AirtableTab.tsx, InventoryRecordEditorPage.tsx |
| Acquired From | singleLineText | 1 | 9 | usedGearIntakeFields.ts, InventoryRecordEditorPage.tsx, WorkflowSnapshotPage.tsx |
| Cost | currency | 2 | 10 | approvalDraftProduct.ts, shopifyUnitCost.ts, ListingApprovalCombinedIntakeSection.tsx |
| Status | singleSelect | 0 | 13 | ShopifySnapshotRecordPage.tsx, useListingApprovalPublishFieldState.ts, InventoryDirectoryListSection.tsx |
| Make | singleLineText | 4 | 23 | approvalDraft.ts, workflowIngest.ts, approvalDraftBody.ts |
| Model | singleLineText | 4 | 23 | approvalDraft.ts, workflowIngest.ts, approvalDraftBody.ts |
| Component Type | multipleSelects | 4 | 25 | approvalDraft.ts, workflowIngest.ts, approvalDraftBody.ts |
| Serial Number | singleLineText | 3 | 15 | approvalBodyTemplate.ts, approvalDraftBody.ts, usedGearIntakeFields.ts |
| Voltage | singleLineText | 2 | 11 | approvalBodyTemplate.ts, approvalDraftBody.ts, ApprovalFormFieldsSupplementalEditors.tsx |
| Inventory Notes | multilineText | 1 | 14 | usedGearIntakeFields.ts, InventoryRecordEditorPage.tsx, WorkflowFormSnapshotSection.tsx |
| Images | multipleAttachments | 1 | 13 | approvalDraft.ts, ListingApprovalCombinedSharedSection.tsx, ShopifySnapshotRecordPage.tsx |
| Testing Cosmetic Notes | multilineText | 2 | 15 | approvalDraftBody.ts, usedGearIntakeFields.ts, listingApprovalTestingSection.tsx |
| Original Box | multipleSelects | 3 | 19 | approvalBodyTemplate.ts, approvalDraftBody.ts, usedGearIntakeFields.ts |
| Manual | multipleSelects | 1 | 18 | approvalDraftBody.ts, ApprovalFormFieldsSupplementalEditors.tsx, ListingApprovalCombinedSharedSection.tsx |
| Remote | multipleSelects | 1 | 17 | approvalDraftBody.ts, ApprovalFormFieldsSupplementalEditors.tsx, ListingApprovalCombinedSharedSection.tsx |
| Power Cable | multipleSelects | 3 | 20 | approvalBodyTemplate.ts, approvalDraftBody.ts, usedGearIntakeFields.ts |
| Additional Items | multilineText | 3 | 19 | approvalBodyTemplate.ts, approvalDraftBody.ts, usedGearIntakeFields.ts |
| Weight | singleLineText | 4 | 9 | approvalDraft.ts, approvalDraftBody.ts, approvalDraftProduct.ts |
| Shipping Dims | singleLineText | 5 | 14 | approvalDraft.ts, approvalDraftBody.ts, approvalDraftProduct.ts |
| Shipping Method | multipleSelects | 3 | 13 | approvalBodyTemplate.ts, approvalDraftBody.ts, usedGearIntakeFields.ts |
| Audiogon Rating | multipleSelects | 2 | 17 | approvalBodyTemplate.ts, approvalDraftBody.ts, ApprovalFormFieldsSupplementalEditors.tsx |
| Shipping Weight | singleLineText | 5 | 12 | approvalBodyTemplate.ts, approvalDraft.ts, approvalDraftBody.ts |
| Testing Notes | multilineText | 2 | 17 | approvalBodyTemplate.ts, approvalDraftBody.ts, ApprovalFormFieldsSupplementalEditors.tsx |
| Testing Time | duration | 0 | 7 | InventoryRecordEditorPage.tsx, WorkflowSnapshotPage.tsx, InventoryRecordEditor.tsx |
| Service Notes | multilineText | 0 | 4 | InventoryRecordEditor.tsx, testingFormSchema.ts, inventoryDirectory.ts |
| Service Time | duration | 0 | 4 | InventoryRecordEditor.tsx, testingFormSchema.ts, inventoryDirectory.ts |
| Tested | date | 0 | 6 | InventoryRecordEditorPage.tsx, WorkflowSnapshotPage.tsx, testingFormSchema.ts |
| Photo'd | date | 0 | 6 | listingApprovalPhotographySection.tsx, InventoryRecordEditorPage.tsx, InventoryRecordEditor.tsx |
| SKU | barcode | 5 | 26 | receiveWebhook.ts, approvalDraft.ts, approvalDraftBody.ts |
| Stale Recovery Status | singleSelect | 1 | 6 | usedGearPostPublish.ts, ListingApprovalWorkflowOpsPanel.tsx, InventoryRecordEditorPage.tsx |
| Stale Recovery Notes | multilineText | 1 | 3 | usedGearPostPublish.ts, ListingApprovalWorkflowOpsPanel.tsx, usedGearQueue.ts |
| Stale Recovery Updated At | dateTime | 1 | 2 | usedGearPostPublish.ts, usedGearQueue.ts, usedGearWorkflowLifecycle.ts |
| Relisted At | dateTime | 1 | 4 | usedGearPostPublish.ts, InventoryRecordEditorPage.tsx, WorkflowSnapshotPage.tsx |
| Workflow Source | singleSelect | 1 | 8 | usedGearIntakeFields.ts, AirtableTab.tsx, UsedGearWorkflowSourceDirectoryPage.tsx |
| Pick Up ID | singleLineText | 2 | 11 | usedGearIntakeFields.ts, usedGearPostPublish.ts, UsedGearPendingReviewGroupPage.tsx |
| Trash Status | singleSelect | 1 | 4 | usedGearIntakeFields.ts, manualIntakeForm.ts, usedGearOperationalRouting.ts |
| Accepted By | singleLineText | 1 | 4 | usedGearIntakeFields.ts, usedGearParkingLotPresentation.ts, usedGearQueue.ts |
| Accepted At | dateTime | 1 | 6 | usedGearIntakeFields.ts, usedGearParkingLotPresentation.ts, usedGearQueue.ts |
| Processing Signed By | singleLineText | 0 | 4 | usedGearQueue.ts, usedGearWorkflow.ts, usedGearWorkflowLastTouched.ts |
| Processing Signed At | dateTime | 0 | 6 | usedGearQueue.ts, usedGearWorkflow.ts, usedGearWorkflowAging.ts |
| Testing Signed By | singleLineText | 0 | 5 | testingForm.ts, usedGearQueue.ts, usedGearWorkflow.ts |
| Testing Signed At | dateTime | 0 | 6 | testingForm.ts, usedGearQueue.ts, usedGearWorkflow.ts |
| Photography Signed By | singleLineText | 0 | 5 | photosForm.ts, usedGearQueue.ts, usedGearWorkflow.ts |
| Photography Signed At | dateTime | 0 | 6 | WorkflowSnapshotPage.tsx, photosForm.ts, usedGearQueue.ts |
| Pre-Listing Reviewed By | singleLineText | 0 | 5 | ListingApprovalWorkflowSummary.tsx, useListingApprovalApproveAction.ts, usedGearQueue.ts |
| Pre-Listing Reviewed At | dateTime | 0 | 4 | useListingApprovalApproveAction.ts, usedGearQueue.ts, usedGearWorkflow.ts |
| Qualification Notes | multilineText | 1 | 6 | usedGearIntakeFields.ts, UsedGearPendingReviewGroupPage.tsx, UsedGearPendingReviewRecordPage.tsx |
| Qualification Complete | checkbox | 1 | 4 | usedGearIntakeFields.ts, usedGearParkingLotPresentation.ts, usedGearIntakeSnapshot.ts |
| Unqualified Reason | multilineText | 1 | 8 | usedGearIntakeFields.ts, UsedGearParkingLotArrivalGroupPage.tsx, UsedGearParkingLotArrivalRecordPage.tsx |
| Customer Cosmetic Notes | multilineText | 2 | 13 | approvalDraftBody.ts, usedGearIntakeFields.ts, useListingApprovalPreviewState.ts |
| Customer Functional Notes | multilineText | 1 | 9 | usedGearIntakeFields.ts, InventoryRecordEditorPage.tsx, WorkflowSnapshotPage.tsx |
| Customer Inclusion Notes | multilineText | 1 | 9 | usedGearIntakeFields.ts, ListingApprovalCombinedIntakeSection.tsx, WorkflowSnapshotPage.tsx |
| Internal Cosmetic Notes | multilineText | 1 | 8 | approvalDraftBody.ts, useListingApprovalPreviewState.ts, InventoryRecordEditor.tsx |
| Internal Functional Notes | multilineText | 0 | 3 | usedGearIntakeSnapshot.ts, usedGearQueue.ts, approvalStoreWorkflowPrefill.ts |
| Internal Inclusion Notes | multilineText | 0 | 4 | ListingApprovalCombinedIntakeSection.tsx, usedGearIntakeSnapshot.ts, usedGearQueue.ts |
| Offer Amount | currency | 0 | 3 | UsedGearPendingReviewGroupPage.tsx, usedGearIntakeSnapshot.ts, usedGearQueue.ts |
| Paid Amount | currency | 2 | 3 | receiveWebhook.ts, receiveWebhook.ts, UsedGearPendingReviewGroupPage.tsx |
| Confirmed Grand Total | currency | 0 | 3 | UsedGearPendingReviewGroupPage.tsx, usedGearIntakeSnapshot.ts, usedGearQueue.ts |
| Allocation Mode | singleSelect | 0 | 3 | UsedGearPendingReviewGroupPage.tsx, usedGearIntakeSnapshot.ts, usedGearQueue.ts |
| Allocation Notes | multilineText | 0 | 3 | UsedGearPendingReviewGroupPage.tsx, usedGearIntakeSnapshot.ts, usedGearQueue.ts |
| Workflow Status | singleSelect | 5 | 27 | getConfiguredRecords.ts, workflowIngest.ts, soldReadyWorkflow.ts |
| Awaiting Pre-Listing Review At | dateTime | 0 | 5 | photosForm.ts, usedGearQueue.ts, usedGearWorkflowAging.ts |
| Approved For Publish At | dateTime | 0 | 5 | useListingApprovalApproveAction.ts, usedGearQueue.ts, usedGearWorkflowAging.ts |
| Listed At | dateTime | 1 | 10 | usedGearPostPublish.ts, ListingApprovalWorkflowOpsPanel.tsx, listingApprovalTabPanels.ts |
| Stale Listing At | dateTime | 1 | 3 | usedGearPostPublish.ts, usedGearQueue.ts, usedGearWorkflowAnalytics.ts |
| Sold Ready To Ship At | dateTime | 2 | 8 | soldReadyWorkflow.ts, usedGearPostPublish.ts, ListingApprovalSoldReadyPanel.tsx |
| Shipped At | dateTime | 1 | 8 | usedGearPostPublish.ts, ListingApprovalSoldReadyPanel.tsx, ListingApprovalWorkflowOpsPanel.tsx |
| eBay Published At | dateTime | 1 | 4 | crossChannelClose.ts, ListingApprovalWorkflowOpsPanel.tsx, listingApprovalTabPanels.ts |
| eBay Offer ID | singleLineText | 2 | 6 | receiveWebhook.ts, crossChannelClose.ts, ListingApprovalWorkflowOpsPanel.tsx |
| eBay Listing ID | singleLineText | 2 | 5 | receiveWebhook.ts, crossChannelClose.ts, ListingApprovalWorkflowOpsPanel.tsx |
| Workflow Owner | singleLineText | 1 | 4 | usedGearPostPublish.ts, UsedGearWorkflowPostPublishSection.tsx, usedGearQueue.ts |
| Workflow Owner Assigned At | dateTime | 1 | 2 | usedGearPostPublish.ts, usedGearQueue.ts, usedGearWorkflowLastTouched.ts |
| Photography Cosmetic Notes | multilineText | 0 | 8 | listingApprovalPhotographySection.tsx, InventoryRecordEditorPage.tsx, WorkflowSnapshotPage.tsx |
| Workflow Image Metadata JSON | multilineText | 4 | 15 | approvalDraft.ts, workflowBackfill.ts, workflowIngest.ts |
| JotForm Submission ID | singleLineText | 3 | 4 | workflowBackfill.ts, workflowIngest.ts, usedGearIntakeFields.ts |
| Seller Email | singleLineText | 1 | 5 | usedGearIntakeFields.ts, WorkflowSnapshotPage.tsx, manualIntakeFormSchema.ts |
| Seller Phone | singleLineText | 1 | 5 | usedGearIntakeFields.ts, WorkflowSnapshotPage.tsx, manualIntakeFormSchema.ts |
| Shipment Follow-Through Notes | multilineText | 0 | 5 | ListingApprovalSoldReadyPanel.tsx, ListingApprovalWorkflowOpsPanel.tsx, UsedGearWorkflowPostPublishSection.tsx |
| Shipment Follow-Through Updated At | lastModifiedTime | 0 | 4 | ListingApprovalSoldReadyPanel.tsx, ListingApprovalWorkflowOpsPanel.tsx, usedGearQueue.ts |
| Seller Zip Code | singleLineText | 1 | 5 | usedGearIntakeFields.ts, WorkflowSnapshotPage.tsx, manualIntakeFormSchema.ts |
| Seller Location | singleSelect | 1 | 5 | usedGearIntakeFields.ts, WorkflowSnapshotPage.tsx, manualIntakeFormSchema.ts |
| How Did You Hear | singleSelect | 1 | 5 | usedGearIntakeFields.ts, WorkflowSnapshotPage.tsx, manualIntakeFormSchema.ts |
| Original Owner | singleSelect | 1 | 5 | usedGearIntakeFields.ts, WorkflowSnapshotPage.tsx, manualIntakeFormSchema.ts |
| Smoke Exposure | singleSelect | 1 | 5 | usedGearIntakeFields.ts, WorkflowSnapshotPage.tsx, manualIntakeFormSchema.ts |
| Mailing List Opt In | checkbox | 1 | 3 | usedGearIntakeFields.ts, WorkflowSnapshotPage.tsx, usedGearIntakeSnapshot.ts |
| Shopify Order ID | singleLineText | 1 | 0 | receiveWebhook.ts |
| Shopify Order Name | singleLineText | 1 | 0 | receiveWebhook.ts |
| Shopify Last Webhook Event ID | singleLineText | 1 | 0 | receiveWebhook.ts |
| Shopify Last Webhook Event | singleLineText | 1 | 0 | receiveWebhook.ts |
| Shopify Last Webhook At | date | 1 | 0 | receiveWebhook.ts |
| Shopify Sync Locked | checkbox | 1 | 0 | receiveWebhook.ts |
| Shopify Closed At | date | 1 | 0 | crossChannelClose.ts |
| Shopify Close Result | singleLineText | 1 | 0 | crossChannelClose.ts |
| eBay Closed At | date | 1 | 0 | crossChannelClose.ts |
| eBay Close Result | singleLineText | 1 | 0 | crossChannelClose.ts |
| Post-Sale Outcome | singleSelect | 3 | 3 | receiveWebhook.ts, receiveWebhook.ts, usedGearPostPublish.ts |
| Post-Sale Outcome At | lastModifiedTime | 3 | 3 | receiveWebhook.ts, receiveWebhook.ts, usedGearPostPublish.ts |
| eBay Sync Locked | checkbox | 1 | 1 | receiveWebhook.ts, usedGearQueue.ts |
| Post-Sale Notes | multilineText | 2 | 3 | receiveWebhook.ts, usedGearPostPublish.ts, usedGearQueue.ts |
| Refund Amount | currency | 3 | 3 | receiveWebhook.ts, receiveWebhook.ts, usedGearPostPublish.ts |
| Refund Reason | singleLineText | 3 | 4 | receiveWebhook.ts, receiveWebhook.ts, usedGearPostPublish.ts |
| Return Received At | dateTime | 2 | 3 | receiveWebhook.ts, usedGearPostPublish.ts, usedGearQueue.ts |
| Restock Disposition | singleSelect | 1 | 3 | usedGearPostPublish.ts, usedGearQueue.ts, usedGearWorkflowAnalytics.ts |
| Vendor | singleLineText | 3 | 11 | getConfiguredRecords.ts, approvalDraftBody.ts, approvalDraftProduct.ts |
| eBay Offer Fulfillment Policy ID | singleLineText | 1 | 3 | ebayApproval.ts, listingApprovalEbayFieldPersistence.ts, useApprovalFormEbayEditorSetup.ts |
| eBay Offer Payment Policy ID | singleLineText | 1 | 3 | ebayApproval.ts, listingApprovalEbayFieldPersistence.ts, useApprovalFormEbayEditorSetup.ts |
| eBay Offer Return Policy ID | singleLineText | 1 | 3 | ebayApproval.ts, listingApprovalEbayFieldPersistence.ts, useApprovalFormEbayEditorSetup.ts |
| Ebay Domestic Shipping Flat Fee | currency | 0 | 1 | approvalStorePersistence.ts |
| Ebay International Shipping Flat Fee | currency | 0 | 1 | approvalStorePersistence.ts |
| Shipping Width | number | 1 | 1 | approvalDraftProduct.ts, shopifyDraftFromAirtableProduct.ts |
| Shipping Depth | number | 1 | 1 | approvalDraftProduct.ts, shopifyDraftFromAirtableProduct.ts |
| Shipping Height | number | 1 | 1 | approvalDraftProduct.ts, shopifyDraftFromAirtableProduct.ts |
| Shopify Inventory Quantity | number | 2 | 2 | approvalDraftProduct.ts, approvalPublish.ts, listingApprovalShopifyConstants.ts |
| Shopify Taxonomy Attributes JSON | multilineText | 2 | 3 | approvalPreviewFieldResolvers.ts, taxonomyAttributes.ts, listingApprovalShopifyConstants.ts |
| eBay Inventory Condition | singleSelect | 2 | 5 | approvalDraft.ts, approvalDraftProduct.ts, listingApprovalEbayConstants.ts |
| eBay Template Copy | multilineText | 1 | 3 | approvalPreview.ts, listingApprovalEbayConstants.ts, listingApprovalEbayFieldPersistence.ts |
| Shopify Extra SEO Title | singleLineText | 1 | 3 | approvalDraftProduct.ts, ShopifySeoFieldsEditor.tsx, shopifyDraftFromAirtableProduct.ts |
| Shopify Extra SEO Description | multilineText | 1 | 3 | approvalDraftProduct.ts, ShopifySeoFieldsEditor.tsx, shopifyDraftFromAirtableProduct.ts |

Not referenced by literal name (19): Template Name (multilineText); Ebay Duration (singleSelect); Ebay Allow Offers (multilineText); Ebay International Destinations (singleSelect); Ebay Excluded Locations (singleSelect); Ebay Combined Shipping Discount Enabled (checkbox); Ebay Combined Shipping Discount Profile (multilineText); Ebay Handling Time Days (number); Shopify Variant-Status (number); Shopify Variant-Fulfillment (multilineText); Shopify Variant-Requires-Shipping (singleSelect); Shopify Variant-Taxable (singleSelect); Images (comma-separated) 2 (multilineText); Image-Position (number); Images Alt Text (comma separated) 2 (multilineText); Shopify Variant-Barcode (multilineText); Shopify Variant-Status-Active (multilineText); Pick Up # (singleLineText); Submission Group ID (singleLineText)

## User Guide (`tblquB9pdwSRXsI7c`)

Referenced fields (40 of 49):

| Field | Type | AWS files | Frontend files | Examples |
|---|---|---|---|---|
| Name | singleLineText | 4 | 13 | upsertConfiguredRecord.ts, users.ts, approvalDraftBody.ts |
| Content Key | singleLineText | 0 | 1 | userGuideContent.ts |
| Content Type | singleSelect | 0 | 1 | userGuideContent.ts |
| Sort Order | number | 0 | 1 | userGuideContent.ts |
| Role | singleSelect | 2 | 1 | upsertConfiguredRecord.ts, users.ts, authStorage.ts |
| Tone | singleSelect | 0 | 1 | userGuideContent.ts |
| Role Summary | multilineText | 0 | 1 | userGuideContent.ts |
| Summary | multilineText | 0 | 1 | userGuideContent.ts |
| Detail | multilineText | 0 | 1 | userGuideContent.ts |
| Page 1 | singleSelect | 0 | 1 | userGuideContent.ts |
| Page 2 | singleSelect | 0 | 1 | userGuideContent.ts |
| Page 3 | singleSelect | 0 | 1 | userGuideContent.ts |
| Quick Start Title | singleLineText | 0 | 1 | userGuideContent.ts |
| Quick Start Summary | multilineText | 0 | 1 | userGuideContent.ts |
| Quick Start Item 1 | multilineText | 0 | 1 | userGuideContent.ts |
| Quick Start Item 2 | multilineText | 0 | 1 | userGuideContent.ts |
| Quick Start Item 3 | multilineText | 0 | 1 | userGuideContent.ts |
| Flow Summary | multilineText | 0 | 1 | userGuideContent.ts |
| Flow Step 1 Title | singleLineText | 0 | 1 | userGuideContent.ts |
| Flow Step 1 Detail | multilineText | 0 | 1 | userGuideContent.ts |
| Flow Step 2 Title | singleLineText | 0 | 1 | userGuideContent.ts |
| Flow Step 2 Detail | multilineText | 0 | 1 | userGuideContent.ts |
| Flow Step 3 Title | singleLineText | 0 | 1 | userGuideContent.ts |
| Flow Step 3 Detail | multilineText | 0 | 1 | userGuideContent.ts |
| Flow Step 4 Title | singleLineText | 0 | 1 | userGuideContent.ts |
| Flow Step 4 Detail | multilineText | 0 | 1 | userGuideContent.ts |
| Question 1 | multilineText | 0 | 1 | userGuideContent.ts |
| Answer 1 | multilineText | 0 | 1 | userGuideContent.ts |
| Question 2 | multilineText | 0 | 1 | userGuideContent.ts |
| Answer 2 | multilineText | 0 | 1 | userGuideContent.ts |
| Module 1 | multilineText | 0 | 1 | userGuideContent.ts |
| Module 2 | multilineText | 0 | 1 | userGuideContent.ts |
| Module 3 | multilineText | 0 | 1 | userGuideContent.ts |
| Module 4 | multilineText | 0 | 1 | userGuideContent.ts |
| Workflow Use 1 | multilineText | 0 | 1 | userGuideContent.ts |
| Workflow Use 2 | multilineText | 0 | 1 | userGuideContent.ts |
| Workflow Use 3 | multilineText | 0 | 1 | userGuideContent.ts |
| Surface 1 | multilineText | 0 | 1 | userGuideContent.ts |
| Surface 2 | multilineText | 0 | 1 | userGuideContent.ts |
| Surface 3 | multilineText | 0 | 1 | userGuideContent.ts |

Not referenced by literal name (9): Primary Role 1 (singleSelect); Primary Role 2 (singleSelect); Primary Role 3 (singleSelect); Primary Role 4 (singleSelect); Support Role 1 (singleSelect); Support Role 2 (singleSelect); Support Role 3 (singleSelect); Support Role 4 (singleSelect); Last Seeded At (dateTime)

## Vendors (`tblF0B5TUhy20hJCv`)

Referenced fields (1 of 1):

| Field | Type | AWS files | Frontend files | Examples |
|---|---|---|---|---|
| Name | singleLineText | 4 | 13 | upsertConfiguredRecord.ts, users.ts, approvalDraftBody.ts |

## Image Roles (`tblkoqoSKypAaZRZe`)

Referenced fields (2 of 6):

| Field | Type | AWS files | Frontend files | Examples |
|---|---|---|---|---|
| Name | singleLineText | 4 | 13 | upsertConfiguredRecord.ts, users.ts, approvalDraftBody.ts |
| Status | singleSelect | 0 | 13 | ShopifySnapshotRecordPage.tsx, useListingApprovalPublishFieldState.ts, InventoryDirectoryListSection.tsx |

Not referenced by literal name (4): Notes (multilineText); Assignee (singleCollaborator); Attachments (multipleAttachments); Attachment Summary (aiText)
