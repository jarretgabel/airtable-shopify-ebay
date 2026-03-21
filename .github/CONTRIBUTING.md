# Contributing Standards

This project uses a strict implementation baseline so the app remains visually consistent and safe to evolve.

## Required UI and Theme Rules
- Use Tailwind CSS v4 utility classes for styling changes.
- Keep dark mode as the default theme across all screens/components.
- Do not introduce light-theme variants unless explicitly requested.
- Do not add component-scoped global CSS in src/App.css.
- Preserve responsive behavior at small, medium, and large breakpoints.

## Architecture and Behavior Rules
- Keep business logic in hooks/services.
- Keep UI state and rendering concerns in components.
- Preserve existing data contracts and API payload shapes unless requirements demand changes.
- Keep auth and route/page access checks aligned with AuthContext and src/auth/pages.ts.
- Implement changes with an advanced senior-level quality bar: prioritize durable architecture, clear separation of concerns, and long-term maintainability.

## Accessibility Requirements
- Preserve semantic elements and labels.
- Keep keyboard interaction and focus-visible behavior for all controls.
- Maintain readable contrast in dark mode.

## Validation Before Merge
1. Run npm run build.
2. Verify changed screens on desktop and mobile sizes.
3. Verify impacted flows (auth, listing approval, eBay publish/draft, exports) when touched.
4. Remove dead helpers/selectors/tokens if the change makes them obsolete.

## Pull Request Guidance
- Keep behavior changes separate from styling-only refactors unless explicitly requested.
- Keep PRs scoped and explain any intentional behavior changes clearly.
