
# Project Patterns & Functionality Reference

## 1. Documentation & Instruction Sources
- `.github/copilot-instructions.md`: Engineering, UI, and workflow rules for all contributors.
- `docs/`: Architecture, workflow, operator/user guides, form patterns, and conventions.
- `src/services/userGuideContent.ts`, `src/components/tabs/workflowGuideContent.ts`: Programmatic workflow rules, page/module guides, role quick starts.

## 2. Architecture Patterns
### App Shell & Routing
- Route-level orchestration in `src/App.tsx`.
- Heavy logic and data derivation in hooks (`src/hooks/`) and services (`src/services/`).
- Domain view-model objects preferred over large prop surfaces.

### Service Layer
- Service entry modules are thin; request building, mappers, and constants are in helpers.
- All API integrations (Airtable, Shopify, eBay) use REST, with request/response validation.
- Environment variables validated at module boundaries (`src/config/runtimeEnv.ts`).

### UI Composition
- Components are focused and orchestration-centric; reusable UI blocks in `src/components/app` or `src/components/tabs`.
- Tailwind CSS v4 for all styling; no component-scoped global CSS.
- Shared class constants and helpers reused before introducing new patterns.
- Mobile-first responsive design, dark mode by default.

### State Management
- React Hooks and Context API for most state; Zustand or Redux for complex state.
- Shared state surfaces for workflow, listing, and approval context.

### File Structure
- Components, hooks, services, types, utils, context, and pages are organized by domain and function.
- Unit tests mirror source structure under `tests/unit/`.

## 3. Data Model & Mapping Patterns
### Inventory & Listing Data
- All forms and workflow actions target the `SB Inventory` Airtable table.
- Data model and field rules documented in `docs/used-gear-workflow/data-model-and-approvals.md`.
- Field mapping and schema patterns in `docs/forms/README.md` and `docs/forms/templates/README.md`.

### Image Metadata
- Images uploaded to the `Images` attachment field after record creation.
- Shared image metadata in `Workflow Image Metadata JSON` (array of objects with attachmentId, url, filename, sourceStage, includedInListing, etc).
- Intake images: `sourceStage: "intake"` (shown in intake snapshot, regardless of `includedInListing`).
- Testing/Photography images: `sourceStage: "testing"` or `"photos"`, shown in main listing gallery only if `includedInListing: true`.
- Attachments and metadata must be in sync for images to display everywhere.

### Sync & Mapping
- Bi-directional sync between Airtable, Shopify, and eBay.
- Mapping management for Airtable records to Shopify/eBay products.
- Conflict resolution and scheduled syncs (hourly, daily, on-demand).

## 4. Workflow & Functional Patterns
### Workflow Surfaces
- Intake > Processing > Listings > Post-Publish.
- Utility pages: User Guide, Market Research, JotForm, Image Lab, Settings, Notifications, User Management.

### Workflow Advancement
- Intake leaves Parking Lot after qualification decision and notes.
- Accepted rows stay in Parking Lot for arrival-stage handling; rejected rows move to Trash Review.
- Testing and Photography must be complete before Listings.
- Listings move to live status only after review and publish action.
- Post-publish work handled in Active Listings or Post-Publish, not Listings.

### Approval & Listing Flow
- Approval queues and listing review use shared UI conventions and change-tracking.
- Shopify/eBay listing forms are structurally aligned; channel-specific differences isolated in helpers.
- ApprovalQueueTable suppresses channel-irrelevant columns by passing `''` as the field name prop.

### Activity & Logging
- Real-time logging of sync events, filterable by platform, date, and status.
- Activity timeline and statistics panel for operational visibility.

## 5. UI/UX & Accessibility Patterns
- Tailwind-only component styling; no custom CSS except for global cross-cutting needs.
- Consistent color palette for status indicators (green=success, red=error, yellow=warning).
- Responsive design with breakpoints for tablet/desktop.
- Accessibility: ARIA labels, semantic HTML, keyboard navigation, visible focus states.
- Loading states: skeletons and spinners for async operations.
- Error boundaries for major sections.

## 6. Forms & Validation
- Local React forms for all inventory processing (not Airtable embeds).
- Field order, labels, and defaults defined in schema files.
- Airtable field names and payload transforms in service files.
- Select options loaded from Airtable table metadata at runtime.
- Images uploaded to `Images` field after record creation.
- Shared validation and error handling in `utils/validators.ts`.

## 7. Error Handling, Logging, and Activity Tracking
- Graceful degradation and retry logic for sync jobs.
- Comprehensive logs of all sync operations and conflicts.
- Error handling with user-friendly messages and error boundaries.
- Monitoring and alerting for failed syncs.

## 8. Testing, CI, and Deployment
- Unit tests for sync logic, integration tests for platform connections.
- Unit tests named `*.test.ts(x)` and live under `tests/unit/`.
- CI must pass typecheck, lint, test, and build before merge.
- Use SQLite for dev, PostgreSQL for production.
- API keys encrypted in env vars; HTTPS for all API comms.
- Rate limiting awareness and background job queues for heavy syncs.

## 9. Notable Code Conventions & Best Practices
- Prefer single-purpose helper functions with stable input/output shapes.
- Avoid repeated array scans in render paths; compute once and reuse.
- Extract reusable UI blocks and helpers for maintainability.
- Preserve original side effects and navigation flows after refactors.
- Remove dead style selectors/helpers when migrations eliminate their usage.

---

**For further details, see:**
- `docs/used-gear-workflow/operator-guide.md` (operator workflow, page/module breakdown)
- `src/services/userGuideContent.ts` and `src/components/tabs/workflowGuideContent.ts` (programmatic workflow rules, quick answers)
- `docs/forms/README.md` and `docs/forms/templates/README.md` (form and schema patterns)
- `.github/copilot-instructions.md` (engineering and review rules)

This file is a living reference. Update as new patterns, rules, or workflows are added.
