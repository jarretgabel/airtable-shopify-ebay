# UI Style Rules

## Visual Direction
- Keep the app's high-contrast dashboard aesthetic: dark shell, elevated cards, cyan/blue accent actions.
- Always design and implement UI in dark mode by default; only add light-mode support when explicitly requested.
- Use the design tokens already in use (`--ink`, `--muted`, `--panel`, `--line`, `--accent`) when token-driven color is needed.

## Tailwind v4 Standards
- Write utility-first JSX; avoid introducing CSS files for component styling.
- Prefer concise, composable class strings and extract repeated button/surface classes into constants.
- Use arbitrary values only when standard Tailwind scales cannot represent required spacing/size.

## Interaction Standards
- Buttons: include visible hover and disabled states.
- Inputs/selects: include clear focus ring or border transition.
- Cards/lists: preserve current spacing rhythm and content hierarchy.

## Responsive Standards
- Build mobile-first and verify at small, medium, and large breakpoints.
- Avoid fixed widths that break under 600px unless there is overflow handling.
- Keep table-heavy views horizontally scrollable where needed.

## Accessibility Standards
- Keep semantic elements (`button`, `label`, `table`, headings) intact.
- Ensure keyboard paths for interactive controls (drop zones, toggles, tab buttons).
- Do not replace meaningful text with icon-only actions unless labels/aria are provided.
