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

## Deployment
- **Problem:** Build fails on CI
  - **Solution:** Ensure all doc updates are committed. Check for missing/invalid env vars.

## More Help
- See `docs/GOTCHAS_AND_FAQ.md`
- Ask in team chat or open an issue
