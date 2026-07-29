/**
 * Liveness endpoint. Used by `docker-compose` healthchecks and by the client's
 * dev proxy to tell "server not started" apart from "request failed".
 */

import { Router } from 'express';

export function createHealthRouter(): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  return router;
}
