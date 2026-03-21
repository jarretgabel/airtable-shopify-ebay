## Summary
- What changed:
- Why it changed:

## Standards Checklist
- [ ] Uses Tailwind CSS v4 utilities for UI changes.
- [ ] Does not add component-scoped global CSS in src/App.css.
- [ ] Keeps dark mode as the default theme (no light variant unless explicitly requested).
- [ ] Uses dark-theme-compatible table/list row hover states where applicable (no light-only hover palettes).
- [ ] Preserves existing behavior, data flow, API payload shapes, and user-visible copy unless required.
- [ ] Preserves accessibility semantics (labels, focus states, keyboard support, button types, contrast).
- [ ] Keeps auth/page access gates enforced through AuthContext and src/auth/pages.ts.
- [ ] Keeps business logic in hooks/services and UI state in components.
- [ ] Removes dead selectors/helpers/tokens introduced by the change.

## Validation
- [ ] npm run build passes locally.
- [ ] Changed tabs/screens render correctly at mobile and desktop breakpoints.
- [ ] Auth/listing/eBay flows remain wired when touched.

## Notes
- Risks:
- Follow-up tasks:
