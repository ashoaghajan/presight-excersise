/**
 * Public surface of the sorting feature.
 *
 * Presentational only — it renders the options from `@presight/shared` and
 * emits changes upward. Sharing those constants with the server is what stops
 * the UI offering a sort the API would reject.
 */
export * from './components/SortControls';
export * from './model/sort-labels';
