# Engineering Rules

## Refactor Safety
- For large component refactors, change structure incrementally and keep feature parity.
- Avoid touching unrelated files during focused migrations.
- If a migration removes legacy classes, prune matching CSS selectors in the same change.

## Code Organization
- Shared visual primitives belong in `src/components/app`.
- Tab-specific helpers belong in `src/components/tabs`.
- Data transforms and calculations belong in hooks (for example, dashboard metrics in `src/hooks/useDashboardMetrics.ts`).

## API/Service Safety
- Keep eBay service contracts stable (`src/services/ebay.ts`).
- Keep Airtable/Shopify/JotForm mappings and identifier usage unchanged unless schema changes are requested.
- Handle error states with user-readable messaging and avoid silent failures.

## Auth and Permissions
- User/page permissions must be enforced through `useAuth()` and page definitions.
- Admin-only capabilities must remain protected in UI and routing behavior.

## Validation Checklist for PRs
- Build passes with `npm run build`.
- Dark-mode theme remains the default UX (no unrequested light-theme variants).
- No removed focus/keyboard affordances.
- No new global CSS blocks for component styling.
- No orphaned helper classes or dead selectors after migration.
