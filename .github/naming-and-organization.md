# Naming Conventions and File Organization

## Overview
This document defines naming patterns and folder organization to ensure consistency across the codebase and reduce decision-making during development.

## Naming Conventions

### Components
- **PascalCase**, exported as named exports
- Folder structure: `src/components/{domain}/{ComponentName}.tsx`
- File name matches export name exactly
- Props interface: `{ComponentName}Props`, exported alongside component
- Example: `src/components/approval/ApprovalFormFields.tsx` exports `ApprovalFormFields` and `ApprovalFormfieldsProps`

### Hooks
- **camelCase**, prefix with `use`
- Folder structure: `src/hooks/` (top-level) or `src/hooks/{domain}/`
- Return tuple or object with `{ data, loading, error, refetch }`
- Example: `src/hooks/useApprovalQueueSummary.ts` exports `useApprovalQueueSummary`
- Domain hooks: `src/hooks/dashboard/useDashboardMetrics.ts`

### Stores (Zustand)
- **camelCase**, follow pattern: `use{Feature}Store` or `use{Feature}SummaryStore`
- Place in subfolder: `src/stores/{domain}/{feature}SummaryStore.ts`
- Companion files:
  - `{feature}StoreTypes.ts` - Type definitions (interface `Store`)
  - `{feature}StoreConstants.ts` - Constants used by store
  - `{feature}StoreUtils.ts` or `{feature}FieldUtils.ts` - Helper functions
- Main store file (`{feature}Store.ts`) acts as barrel export re-exporting types and helpers
- Example: `src/stores/approval/approvalStore.ts` exports from sibling `approvalStoreTypes.ts`, `approvalStoreConstants.ts`, `approvalStoreFieldUtils.ts`

### Services
- **camelCase** with descriptive name
- Entry point: `src/services/{platform}/{feature}.ts` (orchestration + exports)
- Companion files for large services:
  - `{feature}Config.ts` - Environment and configuration
  - `{feature}Request.ts` - Request building and payload shapes
  - `{feature}Mappers.ts` - Response/data transformation
  - `{feature}Types.ts` - Type definitions for domain
- Example: `src/services/ebay/config.ts` wraps `configEnv.ts` and `configRuntime.ts`

### Types and Interfaces
- **PascalCase**
- Place in: `src/types/{domain}.ts` or colocated if private to module
- Naming patterns:
  - **Interfaces**: `{Domain}{Concept}` (e.g., `AirtableRecord`, `ShopifyProductFull`)
  - **Component Props**: `{ComponentName}Props` (e.g., `ApprovalFormFieldsProps`)
  - **View Models**: `{Feature}ViewModel` (e.g., `ApprovalTabViewModel`)
  - **Store Types**: `{Feature}Store` (e.g., `ApprovalStore`)
  - **API Response/Request**: `{Service}{Action}Response`, `{Service}{Action}Request`

### Utilities and Helpers
- **camelCase** for functions, **UPPER_SNAKE_CASE** for constants
- Place in: `src/{domain}/helpers.ts` or `{folder}/helpers.ts`
- Pure functions with single responsibility
- Naming: `build{Thing}`, `compute{Thing}`, `parse{Thing}`, `format{Thing}`, etc.
- Example: `buildDashboardInsights()`, `computeSubmissionMetrics()`, `parseDateValue()`

### Constants
- **UPPER_SNAKE_CASE**
- Place in dedicated `*Constants.ts` or alongside feature
- Group by domain in separate files
- Example: `FALLBACK_LISTING_FORMAT_OPTIONS`, `SHIPPING_SERVICE_FIELD`

### Test Files
- Place adjacent to implementation: `src/path/to/Module.test.ts` or `Module.test.tsx`
- Match module name exactly
- Example: `src/app/useAppRouteState.test.ts` tests `useAppRouteState.ts`

## Folder Structure Patterns

### Component Domain Folder
```
src/components/{domain}/
├── ComponentName.tsx          # Main export (PascalCase)
├── ComponentName.test.tsx     # Tests
├── helpers.ts                 # Private helpers (if needed)
└── helpers.test.ts            # Helper tests (if needed)
```

### Hook (Domain)
```
src/hooks/{domain}/
├── useFeatureName.ts          # Main export
├── useFeatureName.test.ts     # Tests
├── featureTypes.ts            # Type definitions
├── featureUtils.ts            # Shared helpers
└── featureComputation.ts      # Heavy computation logic
```

### Store (Zustand)
```
src/stores/{domain}/
├── featureStore.ts            # Main export (barrel, re-exports)
├── featureStoreTypes.ts       # interface Store { ... }
├── featureStoreConstants.ts   # Constants
├── featureStoreUtils.ts       # Helper functions
└── featureStore.test.ts       # Tests
```

### Service
```
src/services/{platform}/
├── feature.ts                 # Main entry point (thin orchestration)
├── featureConfig.ts           # Configuration and env vars
├── featureRequest.ts          # Request building, payload shapes
├── featureMappers.ts          # Response transformations
├── featureTypes.ts            # Type definitions
└── feature.test.ts            # Tests
```

### Types
```
src/types/
├── airtable.ts                # Airtable domain types
├── shopify.ts                 # Shopify domain types
├── ebay.ts                    # eBay domain types
├── jotform.ts                 # JotForm domain types
└── hifishark.ts               # HiFiShark domain types
```

## Import Path Conventions

### Absolute Imports (using `@/` alias)
- **Always use** `@/` for cross-domain imports
- Example: `import { useApprovalQueueSummary } from '@/hooks/useApprovalQueueSummary'`
- Never use relative paths for cross-folder imports

### Re-exports and Barrel Files
- Main entry point re-exports types and utilities when extracting
- Example: `src/stores/approval/approvalStore.ts` re-exports from `approvalStoreTypes.ts`, `approvalStoreFieldUtils.ts`
- Preserves import paths for consumers: `import { useApprovalStore } from '@/stores/approvalStore'`

### Compatibility Wrappers
- When splitting large services, keep original exported surface
- Example: `src/services/ebay/config.ts` re-exports from `configEnv.ts` + `configRuntime.ts`
- Prevents downstream import churn

## Environment Variables

### Naming
- **VITE_** prefix for frontend variables (Vite build-time)
- **VITE_{PLATFORM}_{FEATURE}** pattern (e.g., `VITE_AIRTABLE_API_KEY`, `VITE_SHOPIFY_STORE_DOMAIN`)
- Template file (`.env`) contains all available variables
- Runtime file (`.env.local`) contains actual values

### Documentation
- List all environment variables in `.env` with placeholder values
- Document required vs optional in code comments or README
- Example: `VITE_AIRTABLE_API_KEY=your_airtable_personal_access_token`

## File Size Guidelines

### Target Sizes
- **Components**: ≤ 220 lines (split if heavy DOM + logic)
- **Hooks**: ≤ 180 lines (extract computation/mapping)
- **Services/Stores**: ≤ 250 lines (extract helpers, types, constants)
- **Utility modules**: ≤ 200 lines (each function ~30-50 lines max)

### Extraction Signals
- **Components**: Heavy computation after `useMemo`, large render blocks, multiple concerns
- **Hooks**: Complex state setup, heavy transformations, multiple data fetches
- **Services**: Multiple request types, complex mappers, lengthy initialization
- **Extract to**: Same domain folder (e.g., `helpers.ts`, `mappers.ts`, `utils.ts`)

### Recomputation Prevention
- Compute expensive filters/reductions **once** and reuse
- Example: `const nonEmptyListings = airtable.listings.filter(...)`
- Return derived collection from hook, pass as prop

## Data Flow Patterns

### Props Interface Naming
- Use specific role-based names: `{Role}Props`, `{Feature}Props`
- Never generic `Props` (use `*Props` suffix)
- Document required vs optional fields
- Example: `AppFrameHeaderProps`, `ApprovalFormFieldsProps`

### View Model Pattern
- Create `{Feature}ViewModel` for complex tabs
- Group related state, handlers, and UI data
- Keep VMs simple: no heavy computation (extract to hooks/services)
- Pass as prop to tab component

### Store Selector Patterns
- Use primitive/function selectors to avoid infinite loops
- Avoid selectors that return fresh arrays/objects each render
- Memoize with `shallow` if needed: `useApprovalStore(useShallow(s => [s.records, s.error]))`

## Reserved Patterns

### Files That Signal Breaking Changes
- `appNavigation.ts` - Tab definitions and route mappings (changing affects routing)
- `pages.ts` - Page/role definitions (changing affects auth)
- Root-level exports in services (changing breaks downstream imports)

### Protected Patterns
- **Auth flow**: Route guards in `useAuthRouteGuard.ts` and `AuthContext`
- **Page access**: `canAccessPage()` checks in `useAuth()` + page definitions
- **Admin operations**: Protected through UI and auth context role checks

## Checklist for New Features

- [ ] Component/hook/store follows naming convention (`Use*`, `*Store`, PascalCase components)
- [ ] File in correct domain folder (`src/components/{domain}/`, `src/hooks/`, `src/stores/{domain}/`)
- [ ] Companion files created if needed (`*Types.ts`, `*Constants.ts`, `*Utils.ts`)
- [ ] Main file acts as barrel export (re-exports helpers/types)
- [ ] Types exported from correct module (types file, not implementation)
- [ ] All cross-domain imports use `@/` alias
- [ ] File size under limits; extraction at 250+ lines
- [ ] Props interface defined and exported (`{ComponentName}Props`)
- [ ] Test file created: `{Module}.test.ts` in same folder
- [ ] Environment variables documented in `.env` template
