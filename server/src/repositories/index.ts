/**
 * Repository layer barrel.
 *
 * Layer contract: repositories own SQL and return persistence-shaped rows.
 * They must not import from `services/`, `routes/` or `middleware/`.
 *
 * All four query methods derive their WHERE clause from `buildUserFilter`, so
 * the page, the total and both facet lists always describe the same set.
 */
export * from './user.repository';
export * from './facet.repository';
export * from './user-filter';
