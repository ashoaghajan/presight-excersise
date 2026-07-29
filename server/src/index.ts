/**
 * Composition root and process entry point.
 *
 * This is the ONLY module that knows how the layers are wired together:
 * concrete repositories are constructed here, injected into the service, and
 * the service is injected into the app. Every other module depends on
 * interfaces, which is what makes the layers independently testable.
 */

import { closeDb, initializeDatabase } from './db';
import { config } from './config';
import { logger } from './lib/logger';
import { createFacetRepository, createUserRepository } from './repositories';
import { createUserService } from './services';
import { createApp } from './app';

function bootstrap(): void {
  // Opens the connection and applies any pending migrations before the first
  // request can arrive.
  const db = initializeDatabase();

  const userRepository = createUserRepository(db);
  const facetRepository = createFacetRepository(db);
  const userService = createUserService({ userRepository, facetRepository });

  const app = createApp({ userService });

  const server = app.listen(config.port, () => {
    logger.info(`API listening on http://localhost:${config.port} (${config.env})`);
  });

  // Graceful shutdown: stop accepting connections, then release the SQLite
  // handle so the WAL is checkpointed cleanly.
  const shutdown = (signal: string): void => {
    logger.info(`Received ${signal}, shutting down`);
    server.close(() => {
      closeDb();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap();
