---
description: Use when adding or changing routes, menu placement, access-control wiring, or navigation grouping for Inventory Processing forms.
applyTo: src/auth/pages.ts,src/app/appNavigation.ts,src/app/appShellNav.ts,src/app/AppTabContent.tsx,src/components/app/AppFrameHeader.tsx,src/components/app/AppFrame.tsx,src/components/app/appFrameTypes.ts,src/app/useAppShellControls.ts,src/stores/auth/authContextHelpers.ts,src/app/useAppRouteState.test.ts,src/stores/auth/authContextHelpers.test.ts,docs/forms/**
---

# Inventory Processing Routing Pattern

Use this guidance when a new Inventory Processing form is added or when an existing form route is renamed, regrouped, or removed.

## Navigation Placement

- Inventory Processing forms belong under the `Inventory Processing` dropdown.
- Do not add these forms as unrelated top-level tabs unless requirements explicitly change.
- Keep the dropdown behavior aligned with the existing grouped-menu pattern used in the app header.

## Required Update Points

When adding a new Inventory Processing form, update all of the following together:

1. `src/auth/pages.ts`
   - Add the route key to `APP_PAGES`.
   - Add the label and path to `PAGE_DEFINITIONS`.
   - Decide whether the page should be excluded from `ASSIGNABLE_PAGES`.

2. `src/app/appNavigation.ts`
   - Add the route key to `INVENTORY_PROCESSING_TABS`.
   - Add or update the display label in `NAV_LABELS` if needed.

3. `src/app/AppTabContent.tsx`
   - Add the route case and render the new tab component.

4. `src/stores/auth/authContextHelpers.ts`
   - Update always-accessible page logic if the form should be available to all authenticated users.
   - Update accessible-page normalization if the route behaves like the existing inventory-processing forms.

5. Tests
   - Update route-state tests when path names or route keys change.
   - Update auth helper tests when access behavior changes.

6. Documentation
   - Update `docs/forms/README.md`.
   - Add or update a form-specific doc in `docs/forms/`.

## Route-Key Rules

- Use stable, descriptive route keys like `incoming-gear` instead of temporary or UI-derived names.
- Keep the route key, route path, and form purpose aligned.
- If renaming a route key, update every code reference in the same change rather than leaving aliases behind.

## Access-Control Rules

- Respect the current auth model in `src/stores/auth/authContextHelpers.ts`.
- If a form is intended to be universally available to authenticated users, handle it the same way as the existing inventory-processing forms.
- Do not bypass user/admin checks outside the established helper functions.

## Header Menu Rules

- Keep Inventory Processing in its own dropdown bucket.
- Reuse the same dropdown trigger and menu list behavior already used for grouped tabs.
- Preserve keyboard open/close behavior and menu roles.

## Validation Checklist

After route or menu changes:

1. Run `npm run build`.
2. Confirm the form appears under `Inventory Processing` and nowhere else unexpectedly.
3. Confirm direct navigation to the route path still resolves the intended tab.
4. Confirm access-control helpers still return the expected pages for non-admin users.
5. Update tests if route names, access behavior, or page definitions changed.