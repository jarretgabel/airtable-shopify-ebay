# Gotchas & FAQ

## Common Pitfalls
- Image metadata and attachments must be in sync for images to display everywhere.
- Intake images are only shown in intake snapshot sections, not in the main listing gallery.
- Only images with `includedInListing: true` (and correct stage) appear in the main gallery.
- All new forms must update the schema, service, and UI files, and be documented in `docs/forms/`.
- When adding a new workflow, update all navigation, docs, and summary files.

## Frequently Asked Questions

**Q: Why aren’t my intake images showing in the listing gallery?**
A: Intake images are only shown in intake snapshot sections. Only testing/photography images with `includedInListing: true` appear in the main gallery.

**Q: Where do I document a new workflow or pattern?**
A: Always update `docs/PROJECT_REFERENCE_SUMMARY.md` and any relevant instruction files.

**Q: What do I do if a PR fails the summary sync check?**
A: Update `docs/PROJECT_REFERENCE_SUMMARY.md` to reflect your changes, then re-push.

**Q: How do I add a new integration?**
A: Follow the onboarding guides, update all relevant docs, and reference the change in your PR.

**Q: Where do I find example data or payloads?**
A: See `docs/examples/` or the code blocks in the summary and form docs.
