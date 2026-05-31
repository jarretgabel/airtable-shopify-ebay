# Example Error Scenarios

## 1. Missing Google Drive Token
- **Symptom:** Sync script fails with `Missing Google Drive access token`.
- **Resolution:** Ensure the token is set in `.env.local` and valid.

## 2. Image Not Included in Gallery
- **Symptom:** Intake image does not appear in listing gallery.
- **Resolution:** By design, only images with `included: true` and `stage: listing` are shown in the gallery.

## 3. Shopify API Error
- **Symptom:** `400 Bad Request` when syncing to Shopify.
- **Resolution:** Check for missing required fields in the payload. See `shopify_payload_example.json`.
