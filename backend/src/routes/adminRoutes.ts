import { Router } from 'express';
import { z } from 'zod';

import { requireAuth, requireRole } from '../middleware/auth.js';
import * as accountServiceModule from '../services/accountService.js';

const accountService = (accountServiceModule as any).accountService ?? (accountServiceModule as any).default ?? accountServiceModule;
import { userRepository } from '../repositories/userRepository.js';
import { auditRepository } from '../repositories/auditRepository.js';
import { query } from '../db/index.js';

const router = Router();

router.use(requireAuth, requireRole('ADMIN'));

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

router.get('/users', async (req, res, next) => {
  try {
    const users = await userRepository.list();
    return res.status(200).json({ success: true, data: users });
  } catch (error) {
    return next(error);
  }
});

router.get('/accounts', async (_req, res, next) => {
  try {
    const accounts = await accountService.getAllAccountsForAdmin();
    return res.status(200).json({ success: true, data: accounts });
  } catch (error) {
    return next(error);
  }
});

router.get('/transactions', async (req, res, next) => {
  try {
    const params = listQuerySchema.parse(req.query);
    const rows = await accountService.getAllTransactionsForAdmin({ page: params.page, pageSize: params.pageSize });
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
});

router.get('/audit-logs', async (req, res, next) => {
  try {
    const params = listQuerySchema.parse(req.query);
    const rows = await auditRepository.listAll(params.page, params.pageSize);
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
});

export { router as adminRouter };
