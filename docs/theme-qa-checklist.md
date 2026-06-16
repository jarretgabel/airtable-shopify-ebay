# Theme QA Checklist

Use this checklist for every UI change that touches layout, color, controls, overlays, or status surfaces.

## Core Behavior

- Theme toggle appears in the top header next to notifications.
- Toggle switches between dark and light immediately (no reload).
- Preference persists per user session and across reloads (session/local storage fallback).
- Logging out and switching users does not leak one user's theme preference to another user's key.

## Readability and Contrast

- Verify text, borders, chips, and buttons are readable in both themes.
- Ensure warning/success/error/info banners remain legible in both themes.
- Validate form controls have visible focus treatment in both themes.
- Confirm icons and chevrons inherit theme-aware color tokens.

## Surface and Token Usage

- Prefer semantic shared classes from `src/components/tabs/uiClasses.ts`.
- Prefer theme tokens from `src/index.css` over hardcoded slate-only classes.
- Avoid introducing new `bg-slate-*`, `text-slate-*`, or `bg-white/5` in workflow surfaces unless intentionally required.

## High-Traffic Screen Smoke Test

- Dashboard
- Notifications dropdown and page
- Testing form
- Photos form
- Parking Lot group/record pages
- Trash Review group/record pages
- Listing approval workflow ops panel

## Responsive and Interaction Checks

- Test at mobile and desktop widths.
- Verify hover, focus, disabled, and pressed states in both themes.
- Verify dropdowns/modals/overlays remain readable in both themes.

## Regression Commands

- `npm run build --silent`
- Run relevant unit tests for changed UI modules.

## Done Criteria

- Build passes.
- Updated files use shared semantic classes where available.
- No obvious dark-only color regressions in light mode.
