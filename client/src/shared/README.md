# shared

Cross-feature building blocks. Nothing here may know what a "user", a "hobby" or
a "nationality" is — the moment a module needs that knowledge it belongs in a
feature.

- `api/` — the single `fetch` wrapper and the endpoint path table.
- `config/` — typed `import.meta.env` access.
- `ui/` — generic presentational primitives (Button, Checkbox, Badge, Skeleton,
  Spinner, VisuallyHidden). Design-system pieces, not product components.
- `hooks/` — generic hooks (`useDebouncedValue` for the search input,
  `useMediaQuery` for the desktop/mobile split).
- `lib/` — pure utilities (class-name join, formatters).
