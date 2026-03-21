# Code Review Checklist

Use this checklist for pull request reviews and self-review before posting PRs. Organize by concern area.

## Architecture & Organization

### File Structure & Naming
- [ ] Component/hook/store follows naming convention (PascalCase components, `use*` hooks, `*Store` stores)
- [ ] File placed in correct domain folder (`src/components/{domain}/`, `src/hooks/`, `src/stores/{domain}/`, etc.)
- [ ] Companion files created if needed (`*Types.ts`, `*Constants.ts`, `*Utils.ts`)
- [ ] Main entry file acts as barrel export (re-exports types and helpers)
- [ ] Test file placed adjacent to implementation: `{Module}.test.ts` or `{Module}.test.tsx`
- [ ] All cross-domain imports use `@/` alias (no relative paths)

### File Size & Complexity
- [ ] Components are <= 220 lines (split if heavy DOM logic + state management)
- [ ] Services/Stores are <= 250 lines (split heavy transformations to helpers)
- [ ] Hooks are <= 180 lines (extract expensive computations)
- [ ] Utility functions are <= 50 lines each
- [ ] Large functions extracted to step-by-step helpers where logic is reusable

### Data Flow & Recomputation
- [ ] Expensive filters/reductions computed once and reused, not in render path
- [ ] Props interfaces properly typed (`{ComponentName}Props`, not generic `Props`)
- [ ] View models grouped by domain responsibility (`{Feature}ViewModel`)
- [ ] If multiple derived values needed from store, split into separate selectors (not object literal)
- [ ] Store selectors use primitives/functions (avoid `useShallow` unless absolutely necessary)

## Type Safety

### TypeScript & Interfaces
- [ ] All function parameters have explicit types
- [ ] All public exports have TypeScript types
- [ ] React component props use interface (not inline type)
- [ ] Optional vs required fields documented and correct
- [ ] No `any` types (use `unknown` with type guard if needed)
- [ ] Generic types used where appropriate (e.g., `Record<string, T>`)
- [ ] `enum` used instead of union literals for fixed option sets

### Props & State Management
- [ ] Props interface exported alongside component (e.g., `export interface {Component}Props`)
- [ ] Props passed explicitly; no spreading unknown objects
- [ ] Event handlers typed correctly (`React.ChangeEvent<HTMLInputElement>`, not `any`)
- [ ] State updates in stores use `set()` with immutable patterns
- [ ] No object mutation in reducer/state setter functions

## State Management

### Zustand Stores
- [ ] Store follows three-file pattern: `*Store.ts`, `*StoreTypes.ts`, `*StoreConstants.ts`
- [ ] Helper functions extracted to sibling `*StoreUtils.ts` or specific `*FieldUtils.ts`
- [ ] Main store re-exports types and utilities
- [ ] Loading and error states included (if async operations)
- [ ] All async operations have try/catch with error state handling
- [ ] Environment variables with fallback defaults (no hard-coded values)

### React Hooks (useState/useEffect)
- [ ] Dependencies array correct for `useEffect` (no missing or extraneous deps)
- [ ] `useCallback` used if function passed as prop (prevents unnecessary child re-renders)
- [ ] `useMemo` used if expensive computation or returning object/array (prevents re-renders)
- [ ] No direct state mutations; always immutable updates
- [ ] Cleanup functions in `useEffect` when needed (intervals, listeners, subscriptions)

### Data Fetching Hooks
- [ ] Return value follows standard shape: `{ data, loading, error, refetch }`
- [ ] Error state is `Error | null`, not string (or both with clear naming)
- [ ] Loading state prevents race conditions (check latest result timestamp)
- [ ] Polling/intervals cleared on unmount
- [ ] API calls retry on network errors (if applicable)

## Code Quality

### Readability & Maintainability
- [ ] Function names clearly express intent (`buildXxx`, `computeXxx`, `parseXxx`, `formatXxx`)
- [ ] Variable names are descriptive (no single letters outside loops/params)
- [ ] Complex logic broken into step-by-step helper functions
- [ ] Inline comments explain "why" (not "what"), especially for non-obvious logic
- [ ] Constants extracted to `*Constants.ts` files (no magic strings/numbers)
- [ ] No dead code or commented-out blocks left behind

### Error Handling
- [ ] All promise rejections caught with `.catch()` or `try/catch`
- [ ] Error messages user-friendly (not raw API errors)
- [ ] Null/undefined checks for required values before use
- [ ] Optional chaining (`?.`) and nullish coalescing (`??`) used appropriately
- [ ] No silent failures (always log or return error state)

### Performance
- [ ] No N+1 query patterns (fetch in batches, not loops)
- [ ] Derived collections memoized if used in multiple places
- [ ] Expensive computations happen in `useMemo` or service layer, not render
- [ ] No inline function definitions in render (use `useCallback` if needed)
- [ ] List renders use stable keys (not index if list can reorder)

## UI & Styling

### Tailwind CSS v4
- [ ] Styling done exclusively with Tailwind utility classes
- [ ] No new component-scoped global CSS in `src/App.css` or other CSS files
- [ ] Repeated class patterns extracted to constants (`buttonClass`, `inputClass`, etc.)
- [ ] Responsive prefixes correct (`sm:`, `md:`, `lg:` for mobile-first)
- [ ] Design tokens used for colors (`--ink`, `--muted`, `--panel`, `--line`, `--accent`)
- [ ] No hardcoded colors; use CSS vars or Tailwind design tokens

### Dark Mode
- [ ] Dark mode is default theme (no light-mode variants unless explicitly requested)
- [ ] Contrast maintained for readability (text on backgrounds meets AA standards)
- [ ] Focus states visible and styled (blue borders, not removed)
- [ ] Hover states included for interactive controls

### Accessibility
- [ ] Semantic elements used (`button`, `label`, `table`, headings)
- [ ] Form inputs have associated labels (not placeholder-only)
- [ ] Interactive controls keyboard-accessible (Tab, Enter, Escape, arrow keys as appropriate)
- [ ] Focus indicators visible (not hidden with `outline: none`)
- [ ] Icons paired with text or have `aria-label`
- [ ] Dropdowns have `role="menu"` and items have `role="menuitem"`
- [ ] Buttons have clear text or `aria-label` (not icon-only)

## Services & External Integration

### Service Organization
- [ ] Service entry file (`{feature}.ts`) <= 200 lines and purely orchestration
- [ ] Config file validates required env vars at module boundary
- [ ] Request builders are pure functions (no side effects)
- [ ] Mappers transform API responses to domain types
- [ ] Types clearly separate API shapes from app domain types
- [ ] Re-exports maintain original import paths (no breaking changes)

### Environment Variables
- [ ] All env vars documented in `.env` template file
- [ ] Required vars validated at service module boundary using `requireEnv()`
- [ ] Optional vars have fallback defaults
- [ ] Prefix is `VITE_*` for frontend build-time variables
- [ ] `.env.local` is in `.gitignore` and not committed

### API & Error Handling
- [ ] API calls wrapped with error handling (try/catch or .catch())
- [ ] User-friendly error messages (not raw API errors)
- [ ] Network failures don't crash app (graceful degradation)
- [ ] Rate limit awareness documented (if applicable)
- [ ] Logging captured for service errors (not silent failures)

## Auth & Permissions

### Access Control
- [ ] Page access checks use `canAccessPage()` and role-based guards
- [ ] Auth context gates sensitive flows (no bypasses in UI)
- [ ] Admin-only UI elements hidden when user lacks permission
- [ ] Session restore flow preserved (users not logged out on refresh)
- [ ] Reset password and OAuth flows unchanged

### Protected Routes
- [ ] Routes wrapped in `useAuthRouteGuard()` if auth required
- [ ] Page definitions in `src/auth/pages.ts` match available tabs
- [ ] User role checks in PR match role in AuthContext
- [ ] Sensitive actions require explicit user role (not just presence)

## Testing

### Unit Tests
- [ ] Created alongside implementation: `{Module}.test.ts` in same folder
- [ ] Pure functions tested independently (no side effects)
- [ ] Edge cases covered (null, undefined, empty, boundary values)
- [ ] Store state mutations tested with `renderHook` and `act`
- [ ] Error cases and fallbacks tested

### Integration Tests
- [ ] Happy path verified end-to-end
- [ ] Navigation flows wired (if changed)
- [ ] Data properly fetches and displays (if data layer touched)
- [ ] Form submission works (if forms modified)
- [ ] Auth flows work (if auth or page access changed)

### Manual Testing
- [ ] Changes tested locally at desktop breakpoint
- [ ] Changes tested at mobile breakpoint
- [ ] Dark mode verified (default theme)
- [ ] Keyboard navigation works (Tab through controls)
- [ ] Focus visible on all interactive elements
- [ ] Print/export still works (if print flow exists)

## Build & Quality Gates

### Before Merge
- [ ] `npm run typecheck` passes (no TypeScript errors)
- [ ] `npm run lint` passes (no ESLint violations)
- [ ] `npm run test` passes (all unit tests passing)
- [ ] `npm run build` succeeds (no build errors or warnings)
- [ ] No console errors or warnings in browser dev console

### Code Review Gate
- [ ] PR description explains what changed and why
- [ ] No unrelated changes (keep scope focused)
- [ ] Breaking changes clearly documented (if any)
- [ ] Dependencies not added/updated without explanation
- [ ] No secrets or API keys committed

## Behavioral Preservation

### Features That Must Work After Changes
- [ ] Dashboard renders correctly with all metrics
- [ ] Airtable, Shopify, eBay listings display properly
- [ ] Approval workflows (eBay and Shopify) function correctly
- [ ] Export to PDF works (if export flow touched)
- [ ] Inquiry polling and display works (if JotForm touched)
- [ ] Market prices fetch and display correctly
- [ ] User authentication and role-based access works
- [ ] All tabs accessible to authorized users
- [ ] Page refresh preserves session (if auth touched)

### Dead Code Removal
- [ ] Unused imports removed (from `*.test.ts` additions)
- [ ] Orphaned CSS selectors removed (if migration completed)
- [ ] Unused helper functions deleted (after extraction)
- [ ] Dead type definitions removed
- [ ] No commented-out code blocks left behind

## PR Template Self-Check

Before posting:
- [ ] Checked the `Standards Checklist` in PR template (all boxes apply)
- [ ] Ran validation locally (`npm run build`, `npm run test`, `npm run lint`)
- [ ] Tested affected screens at mobile and desktop
- [ ] Explained any intentional behavior changes in PR description
- [ ] Listed any follow-up tasks needed
- [ ] Identified any risks or edge cases

---

## Review Priorities (Fast → Thorough)

**Fast Review (<15 min):**
- Architecture, naming, file placement
- Build/typecheck/lint/test passing
- No dead code or secrets

**Standard Review (15-30 min):**
- + Type safety, props, state management
- + Error handling, null checks
- + Tailwind styling, dark mode, accessibility

**Thorough Review (30+ min):**
- + Data flow, recomputation, selectors
- + Service/hook organization
- + Auth/permissions correctness
- + Manual testing on device/sizes
- + Behavioral preservation (impact assessment)
