/**
 * Service layer barrel.
 *
 * Layer contract: services contain business rules and orchestration. They may
 * import repositories and shared contracts; they must never import Express
 * types or touch the database directly.
 */
export * from './user.service';
