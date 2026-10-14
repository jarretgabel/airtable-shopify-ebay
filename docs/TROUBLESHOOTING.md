# Troubleshooting Guide

Common issues and solutions for local development, sync, and deployment.

## Local Development
- **Problem:** Dev server won’t start
  - **Solution:** Check `.env.local` for missing/invalid values. Run `npm install`.
- **Problem:** TypeScript errors after pulling main
  - **Solution:** Run `npm install` and `npm run build`. Check for breaking changes in `PROJECT_REFERENCE_SUMMARY.md`.

## Sync Issues
- **Problem:** Images not syncing to Airtable
  - **Solution:** Ensure Google Drive token is valid. Check logs from `scripts/sync_drive_images_to_airtable.ts`.
- **Problem:** Intake images not showing in gallery
  - **Solution:** By design, intake images only show in the intake snapshot section. See `PROJECT_REFERENCE_SUMMARY.md` for image display rules.
- **Problem:** Seller Hub shows no active listings after an eBay publish
  - **Solution:** Use **eBay Seller** to open the unfiltered `https://www.ebay.com/sh/lst/active` page and confirm you are signed into the seller account connected to the app. The app's Inventory API offer ID is not a Seller Hub listing filter. After a takedown and republish, use **eBay Listing** for the current listing ID; the previous listing URL remains ended. If a different app tab still has the old URL, refresh that tab.
- **Problem:** Saving reports that `__ebay_body_template_copy_override__` is not writable
  - **Solution:** Create `eBay Template Copy` as a long-text field with rich text disabled. **Save Updates** saves the editor's HTML there, independently of the rendered listing body. Existing embedded copy is loaded as a fallback and moved into this field on the next save. Blank copy adds nothing to a template; without a template it stays saved and does not modify manually authored listing HTML. HEAA About Copy still uses the rendered body's `about` section. Do not add the internal `__...__` editor fields to Airtable.
- **Problem:** Listed At is blank after takedown and republish
  - **Solution:** Takedown clears the saved date and its in-page value. After successful publishing, the app reads the current Airtable record and restores a missing or invalid `Listed At`; updating an existing live listing preserves its saved date. A rejected `Listed At` write is reported explicitly rather than silently dropped. Repair an older affected record only from a known publish timestamp, not today's date or an assumed original publication time.
- **Problem:** Lifecycle Status shows only one channel when both listings are live
  - **Solution:** The Airtable workflow has single-channel status values. The lifecycle panel verifies the linked channels and displays both when Shopify is `ACTIVE` with an Online Store URL and eBay is `PUBLISHED`. A status-check failure is shown as a warning; saved IDs alone are not treated as proof that listings remain live.
- **Problem:** Shopify reports an active product but its storefront link is 404
  - **Solution:** GraphQL product creation/update and sales-channel publication are separate operations. Approval publishing now explicitly publishes the active product to Online Store and verifies its URL before reporting success. Publication failures are channel failures, not successful listing creation. An existing active product can be published through the authenticated local product-set API's `publish-online-store` action without recreating it or changing price, variants or images.
- **Problem:** Every eBay update uploads the approved images again
  - **Solution:** Image preparation now saves each source image's SHA-256 fingerprint and eBay URL in the existing `Workflow Image Metadata JSON`. The first update of an older listing still uploads its images once to establish trustworthy mappings. Later updates show **Checking eBay images** and reuse unchanged, accessible images; only additions, changed content, or missing/expired hosted images are uploaded. Reordering and excluding images change the gallery URL list without re-uploading unchanged files. Original source files are downloaded to verify their content, so image checking still takes some time.
  - **If verification or cache saving fails:** The publish action reports the error and does not publish an uncertain image list. Successful image preparations are saved before offer publishing, allowing retries to reuse them. No new Airtable field is required; do not manually edit `ebayHostedImageCache` values.

## Deployment
- **Problem:** Build fails on CI
  - **Solution:** Ensure all doc updates are committed. Check for missing/invalid env vars.

## More Help
- See `docs/GOTCHAS_AND_FAQ.md`
- Ask in team chat or open an issue
