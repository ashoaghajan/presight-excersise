# feature: filters

The sidebar: top-20 nationalities and top-20 hobbies with their counts, plus the
controls to apply and remove them.

Deliberately **presentational + stateless**. It receives the facet lists and the
current selections as props and reports changes through callbacks, which keeps
it free of any dependency on the `users` feature (see `features/README.md`).

Planned modules (none implemented yet):

- `components/FilterSidebar.tsx` — desktop sidebar (280px).
- `components/FilterGroup.tsx` — a titled, scrollable checkbox list.
- `components/FilterCheckbox.tsx` — `☑ UAE (134)`; label wired to the input for
  screen readers.
- `components/FilterDrawer.tsx` — the mobile presentation of the same content.
- `hooks/useFilterDrawer.ts` — open/close state, focus trapping, body scroll
  lock.
- `model/filter-semantics.ts` — a comment-level reminder that nationalities are
  OR and hobbies are AND, plus helpers for toggling a value in a selection
  array.
