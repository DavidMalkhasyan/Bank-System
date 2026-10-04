import { Router } from 'express';

import { query } from '../db/index.js';

const router = Router();

// Liveness: never touches the database, so the host's health checks and uptime
// monitors don't keep a scale-to-zero database (like Neon's free tier) awake.
router.get('/health', (_req, res) => {
  res.json({ ok: true, status: 'healthy' });
});

// Readiness: also checks that the database answers.
router.get('/health/ready', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ ok: true, status: 'ready', database: 'up' });
  } catch {
    res.status(503).json({ ok: false, status: 'degraded', database: 'down' });
  }
});

export { router as healthRouter };
