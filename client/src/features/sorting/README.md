# feature: sorting

The sort field and direction controls that live in the sticky header.

Like `filters`, this is presentational: it renders the options from
`SORT_FIELDS`/`SORT_DIRECTIONS` in `@presight/shared` and emits changes upward.
Sharing those constants with the server is what stops the UI from offering a
sort the API would reject.

Planned modules (none implemented yet):

- `components/SortControls.tsx` — field select + direction toggle.
- `model/sort-labels.ts` — display labels for the raw field names
  (`first_name` -> "First name").
