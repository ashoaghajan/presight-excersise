/**
 * Public surface of the filters feature.
 *
 * Everything here is presentational — the feature receives facets and
 * selections as props and reports changes through callbacks. It never fetches
 * and never touches the URL, which is what keeps it independent of the `users`
 * feature (see `features/README.md`).
 */
export * from './components';
export * from './model/filter-semantics';
