# Copilot Instructions

These are the default implementation rules for this repository.

## Core Rules
- Use Tailwind CSS v4 utility classes for all component styling changes.
- Do not introduce new component-scoped global CSS in `src/App.css`.
- Keep behavior changes separate from styling refactors unless explicitly requested.
- Preserve existing data flow, API payload shapes, and user-visible copy unless requirements say otherwise.

## UI and Styling Rules
- Prefer expressive utility composition directly in JSX over custom class-name systems.
- Reuse existing shared class constants/helpers where available (for example in `src/components/app` and `src/components/tabs`).
- Default to the dark-mode theme for all screens and components; do not introduce light-theme variants unless explicitly requested.
- Keep mobile-first responsive behavior intact (`sm:`, `md:`, `lg:`, `xl:`).
- Preserve accessibility semantics: labels, focus states, button types, keyboard support, and contrast.

## Architecture Rules
- Keep tabs/components focused; extract reusable UI blocks into `src/components/app` or `src/components/tabs` helpers.
- Keep business logic in hooks/services (`src/hooks`, `src/services`) and UI state in components.
- Avoid large monolithic edits when smaller extraction-based refactors are safer.

## File Size and Efficiency Rules
- Keep files bite-sized: target <= 220 lines for components/hooks when practical; at > 250 lines, prefer extracting helpers/hooks/types in the same domain folder.
- Keep components orchestration-focused: move heavy data shaping, mapping, and calculations into pure helpers (`src/app`, `src/hooks/**`, `src/components/**/helpers`).
- Apply the same pattern to dense service modules: keep transport/orchestration entry points focused and move token/storage/request-building logic into sibling helpers in the same service folder.
- For compatibility-safe extractions, preserve existing exported function names/signatures and barrel exports, and avoid changing API payload shapes unless explicitly requested.
- When splitting shared utility service files, keep a thin compatibility wrapper module that re-exports the prior public surface to avoid import churn.
- Avoid repeated array scans inside render paths; compute once and reuse derived values.
- Prefer single-purpose helper functions with stable input/output shapes over inline multi-step blocks.
- When refactoring large files, preserve behavior first, then reduce complexity via extractions; avoid mixing functional changes with structural cleanup.

## Data and Auth Rules
- Respect page access gates from `AuthContext` and page definitions in `src/auth/pages.ts`.
- Do not bypass role checks for `users` routes or controls.
- Do not remove session restore, reset-password, or OAuth callback handling.

## Validation Rules
- After meaningful UI or structural edits, run `npm run build`.
- If changing auth, listing, or eBay logic, verify related tabs render and actions remain wired.
- Remove dead style selectors/helpers when migrations eliminate their usage.
- After extraction refactors, ensure original side effects and navigation flows are unchanged.
