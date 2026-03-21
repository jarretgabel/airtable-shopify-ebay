# Quick Decision Guide

Use this flowchart to make common architectural decisions quickly.

## "Where should I put this code?"

### Is it a React component (renders JSX)?
- **Yes** → Place in `src/components/{domain}/` (see [Naming & Organization](./naming-and-organization.md#folder-structure-patterns))
  - If shared across domains → `src/components/app/` or `src/components/tabs/`
  - If domain-specific (e.g., eBay-only) → `src/components/{domain}/`
  - Example: `src/components/approval/ApprovalFormFields.tsx`

- **No** → Continue below

### Is it state (data that can be stale, needs updates, used by multiple components)?
- **Yes** → Create Zustand store in `src/stores/{domain}/` (see [State Management](./state-management.md#zustand-store-architecture))
  - Needs simple fetch + refetch? → Use hook instead (see "Is it data fetching..." below)
  - Example: `src/stores/approval/approvalStore.ts`

- **No** → Continue below

### Is it data fetching/polling (API call + lifecycle)?
- **Yes** → Create hook in `src/hooks/` or `src/hooks/{domain}/` (see [State Management § Hook-Based State](./state-management.md#hook-based-state-for-complex-logic))
  - Simple one-time fetch? → Custom hook with `useState`
  - Needs polling? → `useEffect` with interval
  - Complex derived state? → `useMemo` + multiple `useState`
  - Example: `src/hooks/useJotFormInquiries.ts`

- **No** → Continue below

### Is it an external API interaction (HTTP call, auth, database)?
- **Yes** → Create service in `src/services/{platform}/` (see [Service Organization](./service-organization.md))
  - Config/env? → `{feature}Config.ts`
  - Request building? → `{feature}Request.ts`
  - Response transformation? → `{feature}Mappers.ts`
  - Types? → `{feature}Types.ts`
  - Example: `src/services/ebay/listing.ts`

- **No** → Continue below

### Is it pure logic (no side effects, no state)?
- **Yes** → Create helper file in appropriate domain
  - Data transformation? → `src/hooks/{domain}/helpers.ts` or `src/services/{domain}/{feature}Mappers.ts`
  - Utility function? → `src/{domain}/helpers.ts` or next to component as `helpers.ts`
  - Constant? → `src/{domain}/constants.ts` or `*Constants.ts` file
  - Type definition? → `src/types/{domain}.ts` or colocated `*Types.ts`
  - Example: `src/stores/approval/approvalStoreFieldUtils.ts`

- **No** → Probably UI state (use `useState` in component)

---

## "How should I organize this so it fits the patterns?"

### I have a component with lots of logic
1. **Extract** pure helper functions to `helpers.ts` in same folder
2. **Extract** heavy computation to `useMemo` or separate hook
3. **Extract** reusable UI blocks to new components in same folder
4. **Keep** current component focused on orchestration and wiring
5. Max file size: 220 lines

**Example refactor:**
```
src/components/approval/
├── ApprovalFormFields.tsx           (now 95 lines, focused)
├── helpers.ts                       (125 lines, field helpers extracted)
└── ApprovalFormFields.test.tsx
```

### I have a service with many responsibilities
1. **Extract** request builders to `{feature}Request.ts`
2. **Extract** response mappers to `{feature}Mappers.ts`
3. **Extract** types to `{feature}Types.ts`
4. **Extract** constants to `{feature}Constants.ts`
5. **Keep** main `{feature}.ts` as thin orchestration (< 200 lines)
6. **Re-export** types and constants from main file (barrel pattern)

**Example structure:**
```
src/services/ebay/
├── listing.ts                       (Orchestration, re-exports)
├── listingConfig.ts                 (Env + constants)
├── listingRequest.ts                (Payload builders)
├── listingMappers.ts                (Response transforms)
├── listingTypes.ts                  (TypeScript types)
└── listing.test.ts
```

### I have a Zustand store with lots of logic
1. **Extract** field validation to `{feature}StoreFieldUtils.ts`
2. **Extract** constants to `{feature}StoreConstants.ts`
3. **Extract** types to `{feature}StoreTypes.ts`
4. **Keep** store file (`{feature}Store.ts`) as orchestration
5. **Re-export** types and utilities from main store file

**Example structure:**
```
src/stores/approval/
├── approvalStore.ts                 (40 lines, uses extract of helpers + constants)
├── approvalStoreTypes.ts            (Interface Store { ... })
├── approvalStoreConstants.ts        (CONSTANTS, defaults)
├── approvalStoreFieldUtils.ts       (Pure helper functions)
└── approvalStore.test.ts
```

---

## "When should I create/split/merge something?"

### Split a file when:
- ✂️ Approaching 220 lines (component), 250 lines (service/store), 180 lines (hook)
- ✂️ File has multiple clear responsibilities (query logic + transform logic + UI)
- ✂️ Logic will be reused outside the current file
- ✂️ Tests would be clearer in separate files

### Keep in one file when:
- 📌 Closely related (request builder + one-off mapper for same endpoint)
- 📌 Would require frequent co-edits (tightly coupled)
- 📌 Under size limit and single clear responsibility

### Don't break apart when:
- ❌ Already at good size and clear
- ❌ Changes would break existing import paths for consumers
- ❌ It's truly one-off or test-only code

---

## "What naming should I use?"

### Components
```
✅ ApprovalFormFields.tsx        (PascalCase, descriptive)
✅ ApprovalFormFieldsProps       (Component name + "Props")
❌ ApprovalFields.tsx            (Too generic, could be confusing)
❌ approval-form-fields.tsx      (Wrong casing, use PascalCase)
```

### Hooks
```
✅ useApprovalQueueSummary()     (use* prefix, camelCase)
✅ useShopifyProducts()          (clear noun/domain)
✅ useDashboardMetrics()         (clear what data it provides)
❌ useApprovalData()             (Too broad, be specific)
❌ getApprovalData()             (Wrong prefix, should be "use")
```

### Stores
```
✅ useApprovalStore              (use* prefix + Store suffix)
✅ useShopifyApprovalSummaryStore (long but clear: domain + feature + Store)
✅ useEbayListingStore           (platform + feature + Store)
❌ approvalStore                 (Missing "use" prefix)
❌ useApprovals                  (Missing "Store" suffix)
```

### Helper Functions
```
✅ buildDashboardInsights()      (build* prefix for constructors)
✅ computeSubmissionMetrics()    (compute* for calculations)
✅ parseDate()                   (parse* for parsers)
✅ formatPrice()                 (format* for formatters)
✅ isApprovedValue()             (is* for predicates/booleans)
❌ getData()                     (Too generic)
❌ doSomething()                 (Vague intent)
```

See [Naming & Organization](./naming-and-organization.md#naming-conventions) for complete guide.

---

## "Type, interface, or something else?"

### Use `interface` for:
- Component props: `interface ApprovalFormFieldsProps { ... }`
- Store types: `interface ApprovalStore { ... }`
- API responses: `interface EbayApiResponse { ... }`
- Domain types: `interface EbayListing { ... }`

### Use `type` for:
- Union types: `type Status = 'active' | 'inactive'`
- Tuple types: `type Coordinates = [number, number]`
- Mapped types: `type Readonly<T> = { readonly [K in keyof T]: T[K] }`
- Type aliases for brevity: `type ID = string & { readonly __id: unique symbol }`

### Use `enum` for:
- Fixed options: `enum UserRole { ADMIN = 'admin', VIEWER = 'viewer' }`
- Status values: `enum ListingStatus { ACTIVE, DRAFT, ARCHIVE }`

### Use `const` for:
- Constants: `const MAX_ITEMS = 50`
- Config: `const API_BASE = 'https://api.example.com'`

---

## "How much should I test?"

### Always test (critical path):
- ✅ Pure logic functions (mappers, builders, validators)
- ✅ Store state mutations (Zustand with `renderHook`)
- ✅ Route/page access checks (AuthContext + guards)
- ✅ Complex calculations (metrics, insights, summaries)

### Test when affected (surface changes):
- ✅ Component interactions (form submission, button clicks)
- ✅ Data fetching flows (happy path + error case)
- ✅ Navigation wiring (route changes, tab switches)

### Test manually (end-to-end):
- ✅ Desktop and mobile viewports
- ✅ Keyboard navigation (Tab, Enter, Escape)
- ✅ Approval workflows (save, publish, error states)
- ✅ Export to PDF (if touching print flow)

### Can skip testing:
- ❌ Simple render-only components (just displaying props)
- ❌ UI-only state that's tested via manual testing
- ❌ Reused third-party components (trust library tests)

See **Before Merge** section in [Code Review Checklist](./code-review-checklist.md#before-merge).

---

## "Should I use Zustand, useState, Context, or useReducer?"

| Use Case | Pattern | Why |
|----------|---------|-----|
| Feature state (listings, approvals, user data) | Zustand Store | Persistent, testable, reusable across components |
| Form inputs, toggled panels | `useState` | Simple, component-scoped, quick iterations |
| Auth, theme, user session | Context | App-wide, rarely changes, needs propagation down tree |
| Complex state machines | `useReducer` | Predictable transitions, easier reasoning |
| Data fetching + lifecycle | Custom hook | Encapsulates side effects, reusable |

**Quick decision:** Start with `useState`, extract to hook if side effects, extract to Zustand if multiple components need it.

See [State Management](./state-management.md) for detailed patterns.

---

## "What's the import path convention?"

### Use absolute imports with `@/` alias:
```typescript
✅ import { useApprovalQueueSummary } from '@/hooks/useApprovalQueueSummary'
✅ import type { ApprovalStore } from '@/stores/approval/approvalStoreTypes'
✅ import { buildDashboardInsights } from '@/hooks/dashboard/insights'
❌ import { useApprovalQueueSummary } from '../../../hooks/useApprovalQueueSummary'
❌ import { useApprovalQueueSummary } from '../../hooks'
```

**Why:** Avoids brittle relative paths, clearer intent, refactoring-safe.

**Barrel exports:** Main entry re-exports types/helpers so consumers don't need to know internal structure:
```typescript
// src/stores/approval/approvalStore.ts
export { useApprovalStore } from './approvalStore'
export type { ApprovalStore } from './approvalStoreTypes'
export { inferFieldKind } from './approvalStoreFieldUtils'

// Consumer - clean import, doesn't break if we reorganize internals
import { useApprovalStore, inferFieldKind } from '@/stores/approvalStore'
```

---

## "How do I know if my code is production-ready?"

### Pre-commit checklist:
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes  
- [ ] `npm run test` passes
- [ ] `npm run build` succeeds
- [ ] Tested in browser at desktop + mobile
- [ ] No console errors or warnings
- [ ] No dead code or commented-out lines

### Before posting PR:
- [ ] Description explains what + why
- [ ] All boxes in PR template checked
- [ ] No secrets or API keys
- [ ] Scoped and focused (related changes only)
- [ ] Reviewed own changes first

See [Code Review Checklist](./code-review-checklist.md) for full pre-merge gate.

---

## Quick Links

- **Need naming help?** → [Naming & Organization](./naming-and-organization.md#naming-conventions)
- **Need folder structure?** → [Naming & Organization](./naming-and-organization.md#folder-structure-patterns)
- **Need store pattern?** → [State Management](./state-management.md#zustand-store-architecture)
- **Need service pattern?** → [Service Organization](./service-organization.md)
- **Need code review tips?** → [Code Review Checklist](./code-review-checklist.md)
- **Need architecture guidance?** → [Architecture Conventions](../docs/architecture-conventions.md)
