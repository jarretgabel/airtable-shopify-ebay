# Architecture And Conventions

## App Shell

- Keep orchestration in [src/App.tsx](../src/App.tsx) focused on route-level wiring.
- Move heavy derivations and transport details into hooks under [src/app](../src/app) or [src/hooks](../src/hooks).
- Prefer domain view-model objects over large prop surfaces when adding new tabs.

## Services

- Keep each service entry module thin and focused on orchestration.
- Extract request building, mappers, and constants into sibling helpers.
- Validate required environment variables at module boundaries using [src/config/runtimeEnv.ts](../src/config/runtimeEnv.ts).

## UI

- Reuse shared state surfaces and class constants before introducing new one-off UI patterns.
- Prefer component utilities in [src/components/app](../src/components/app) and [src/components/tabs](../src/components/tabs).
- Keep all styling in Tailwind utility classes; avoid introducing component-scoped global CSS.

## Testing

- Unit tests should live beside implementation files as `*.test.ts` or `*.test.tsx`.
- Cover domain helpers and route-state behavior first, then key UI interactions.
- CI must pass `typecheck`, `lint`, `test`, and `build` before merge.

## Accessibility

- Dropdown triggers must support keyboard open/close behavior.
- Menus should expose `role="menu"` and items should expose `role="menuitem"`.
- Preserve visible focus behavior for all interactive controls.
