# Features

A feature is a vertical slice of the product: its data access, its state and its
UI live together, so a change to "how filtering works" touches one folder.

Every feature uses the same internal shape:

| Folder        | Contains                                                         |
| ------------- | ---------------------------------------------------------------- |
| `api/`        | Typed calls built on `shared/api/http-client` (no React)          |
| `model/`      | Types, URL/query codecs, pure helpers (no React, no JSX)          |
| `hooks/`      | React state and data hooks — the bridge between `api/` and UI     |
| `components/` | Presentational React components (no `fetch`, no route knowledge)  |

## Dependency rules

- `components/` -> `hooks/` -> `api/` -> `shared/api`. Never the reverse.
- A feature may import from `shared/`. **A feature must not import from another
  feature** — shared needs get promoted into `shared/`, and cross-feature
  composition happens in `pages/`.
- Only `pages/` and `app/` may import features.

These rules are what keep the UI/API separation the plan asks for: a component
never knows a URL, and an `api/` module never knows a React hook exists.
