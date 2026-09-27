import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { transactionRepository } from '../repositories/transactionRepository.js';

const router = Router();

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(['DEPOSIT', 'WITHDRAWAL', 'TRANSFER']).optional(),
  accountId: z.string().uuid().optional(),
});

router.use(requireAuth);

router.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const params = listSchema.parse(req.query);
    const rows = await transactionRepository.listForUser(user.id, params);
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
});

export { router as transactionRouter };
