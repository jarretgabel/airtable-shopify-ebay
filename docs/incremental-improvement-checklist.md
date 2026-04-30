# Incremental Improvement Checklist

This checklist orders the highest-impact changes first so the app gets lighter, more reliable, and harder to misuse without mixing too many risk areas in one pass.

## Phase 1: Startup Weight

- [x] Lazy-load major tab screens instead of importing them all at startup.
- [x] Add `Suspense` fallbacks for lazily loaded tabs.
- [x] Keep login, reset-password, and shell bootstrap on the critical path.
- [x] Re-check bundle output after lazy loading to confirm heavy features are deferred.
- [x] Verify the default post-login path still feels responsive.

## Phase 2: Data Loading

- [x] Stop fetching every major data source on app startup.
- [x] Load Airtable inventory data only when inventory or dashboard needs it.
- [x] Load Shopify products only when Shopify or dashboard needs them.
- [x] Load approval summaries only when approval screens or dashboard need them.
- [x] Load JotForm submissions only when JotForm or dashboard needs them.
- [x] Stop background polling for tabs the user has never opened.
- [x] Add simple cache or TTL behavior for revisited tabs.
- [x] Prefer summary or count endpoints over full dataset fetches where possible.

## Phase 3: Runtime Resilience

- [x] Add an app-level error boundary.
- [x] Add a friendly runtime-config failure screen.
- [x] Catch bootstrap and config load failures before the app hard-crashes.
- [x] Show actionable missing-config guidance instead of raw thrown errors.
- [x] Define which config is required to boot the app and which is feature-specific.
- [x] Add a degraded-mode path for non-critical missing config.

## Phase 4: Operator Safety

- [x] Add unsaved-changes protection on approval and edit forms.
- [x] Add route-leave confirmation for dirty forms.
- [x] Add browser refresh and tab-close protection for dirty forms.
- [x] Replace `window.confirm` flows with app-styled confirmation modals.
- [x] Add clearer destructive-action copy for publish, reset, and delete flows.
- [x] Keep cancel and confirm affordances visually distinct.

## Phase 5: Publish And Save Guardrails

- [x] Add a preflight summary before publish actions.
- [x] Show target channel or channels before publish.
- [x] Show required missing fields before publish.
- [x] Show record identity and intended action before publish.
- [x] Add clearer success and failure summaries after save or publish.
- [x] Consider typed confirmation for irreversible actions.

## Phase 6: Approval Surface Simplification

Current status: the approval tab has been reduced to a thinner orchestrator, with selected-record status, editor, payload, queue, selected-record branch composition, selected-record panel assembly, Shopify preview/action support wiring, interaction-state wiring, record action composition, approval tab panel-prop assembly, and eBay supplemental save-field persistence now split into focused helpers and view components.

Latest bundle-shaping pass: the selected-record editor now lazy-loads the main approval form module, Vite emits deferred approval editor, combined-section, and payload-panel code in separate approval subchunks instead of folding those lazy boundaries back into the eager `feature-approval` file, the combined Shopify/eBay drawers now reuse the shared payload-preview module instead of carrying duplicate payload/debug markup, payload serialization/docs-example generation now live inside the lazy payload module instead of the main preview-state hook, and the selected-record payload panels stay unmounted until the operator explicitly opens the payload preview drawer.

- [x] Split approval form state from save and publish side effects.
- [x] Extract validation logic into dedicated modules.
- [x] Extract field-resolution and schema-fallback logic into a normalization layer.
- [x] Separate Shopify-specific and eBay-specific approval behavior behind focused adapters.
- [x] Reduce large approval components into orchestration-focused containers.
- [x] Reduce large approval store responsibilities into smaller focused units.
- [x] Add tests around schema normalization and fallback field resolution.
- [x] Add broader tests around combined shared and channel-specific approval rendering.

## Phase 7: UX Perceived Performance

Latest perceived-performance pass: the Shopify collections selector now reuses cached collection search results and full collection hydration results for repeated openings, reducing repeated approval-editor wait time during Shopify collection edits.

- [x] Add skeleton or staged-loading states for heavy tabs.
- [x] Avoid blocking the whole shell while one tab loads.
- [x] Show progressive loading for dashboard sections.
- [x] Make revisiting tabs feel instant with cached data and background refresh.
- [x] Surface partial-data states cleanly when one source fails but others succeed.

## Phase 8: Build And Validation

Latest verification snapshot: approval-focused tests passed on 2026-04-29, including save-result, publish-result, publish-failure, mixed publish-result, approve-flow, publishing-wrapper, and publish typed-confirmation coverage, and `npm run build` passed after the latest shell/dashboard safety pass. Disabled degraded-mode shell navigation, unavailable dashboard action cards, unavailable dashboard KPI/workflow entry points, JotForm polling intent, and typed confirmation modal behavior also passed focused verification on 2026-04-29. Automated chunk tracking was added afterward: `npm run build`, `node scripts/report-bundle-size.mjs --write-baseline`, `npm run report:bundle`, and the combined `npm run build:bundle-report` flow all passed, with the stored baseline in `docs/bundle-size-baseline.json`. After the latest approval refactor, Shopify collections caching pass, approval subchunk split, payload-preview deduplication, payload-on-demand serialization move, and explicit payload expansion gate, `npm run test -- src/components/approval/shopifyCollectionsCache.test.ts`, `npm run test -- src/components/approval/listingApprovalCombinedSections.test.tsx src/components/approval/ListingApprovalSelectedRecordView.test.tsx`, `npm run build`, and `npm run report:bundle` all passed; the bundle report now aggregates feature families across multiple emitted files, and the current approval output is split across `feature-approval` (`268.78 kB` raw eager core), `feature-approval-editor` (`44.21 kB` raw), `feature-approval-combined` (`65.01 kB` raw), and `feature-approval-payloads` (`8.59 kB` raw). Total approval-family size is now `377.55 kB` raw / `93.02 kB` gzip, a delta of `+4.91 kB` raw / `+2.20 kB` gzip against baseline, while still keeping the eager approval chunk materially smaller than the old monolith and pushing payload/debug computation off the common approval path.

Current automated bundle baseline: `feature-account` is `99.04 kB` raw / `30.38 kB` gzip, `feature-approval` is `372.64 kB` raw / `90.82 kB` gzip, `feature-dashboard` is `53.48 kB` raw / `11.63 kB` gzip, `feature-ebay` is `28.54 kB` raw / `6.32 kB` gzip, `feature-tabs` is `89.79 kB` raw / `18.66 kB` gzip, and `feature-users` is `18.04 kB` raw / `4.41 kB` gzip. Use `npm run build:bundle-report` to rebuild and compare the current `feature-*` chunks against that baseline.

- [ ] Run `npm run build` after each major phase.
- [x] Track chunk-size deltas after lazy loading and fetch deferral.
- [x] Verify dashboard rendering after performance changes.
- [x] Verify approval flows still save and publish correctly.
- [x] Verify users, settings, and notifications still route correctly.
- [x] Verify JotForm polling only runs where intended.
- [x] Add or update tests where behavior changed.

## Suggested Execution Order

- [x] Lazy-load major tab screens.
- [x] Defer tab-specific data fetching.
- [x] Add error boundary and config-failure UI.
- [x] Add unsaved-changes protection.
- [x] Replace native confirm dialogs with proper modals.
- [x] Add publish and save preflight summaries.
- [~] Refactor the approval domain into smaller modules.
- [~] Polish perceived loading states and caching.
- [x] Keep the previous tab visible while the next lazy tab is loading.

## Definition Of Done Per Change

- [ ] The change is isolated and focused.
- [ ] `npm run build` passes.
- [ ] Relevant screen behavior is manually verified.
- [ ] Any new failure state is actionable.
- [ ] Tests are added or updated when behavior changes.