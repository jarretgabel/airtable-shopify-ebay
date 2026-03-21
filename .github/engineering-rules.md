# Engineering Rules

## Refactor Safety
- For large component refactors, change structure incrementally and keep feature parity.
- Avoid touching unrelated files during focused migrations.
- If a migration removes legacy classes, prune matching CSS selectors in the same change.

## React DOM Rules
- Never use `querySelector`, `querySelectorAll`, `getElementById`, or any imperative DOM query against the React-rendered tree. Always use React refs (`useRef`), state, controlled props, or `autoFocus` to manage focus, read values, or interact with rendered elements.
- Exception: `querySelector`/`querySelectorAll` on a `Document` or `Element` returned by `DOMParser` (i.e. parsing fetched server HTML) is acceptable — that is standard HTML parsing, not React DOM manipulation.

## Code Organization
- Shared visual primitives belong in `src/components/app`.
- Tab-specific helpers belong in `src/components/tabs`.
- Data transforms and calculations belong in hooks (for example, dashboard metrics in `src/hooks/useDashboardMetrics.ts`).
- Keep files bite-sized and focused: if a file approaches ~250 lines or mixes orchestration with heavy transforms, split into helper/modules in the same domain folder.
- Use compatibility-safe extraction for dense services as well: keep the original service entry module as an orchestration wrapper and extract storage/auth/request helpers into sibling files.
- During extraction-first refactors, preserve exported signatures and existing import paths to avoid downstream breakage.
- Preserve default exports for shared services when they are part of existing import conventions (for example `@/services/airtable`).
- Prefer pure computation modules for expensive or multi-step derivations, and keep React components/hooks focused on wiring and state lifecycle.
- Reuse derived collections/aggregates instead of recomputing the same filters/reductions multiple times.

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
