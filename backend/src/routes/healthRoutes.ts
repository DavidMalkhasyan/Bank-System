import { Router } from 'express';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true, status: 'healthy' });
});

router.post('/debug/echo', (req, res) => {
  res.json({ authorization: req.headers.authorization ?? null, headers: req.headers });
});

export { router as healthRouter };
