import { Router } from 'express';

import { query } from '../db/index.js';

const router = Router();

router.get('/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ ok: true, status: 'healthy', database: 'up' });
  } catch {
    res.status(503).json({ ok: false, status: 'degraded', database: 'down' });
  }
});

export { router as healthRouter };
