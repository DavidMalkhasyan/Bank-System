import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../middleware/auth.js';
import * as accountServiceModule from '../services/accountService.js';

const accountService = (accountServiceModule as any).accountService ?? (accountServiceModule as any).default ?? accountServiceModule;
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

const transferSchema = z.object({
  sourceAccountId: z.string().uuid(),
  destinationAccountId: z.string().uuid(),
  amount: z.string().min(1),
  description: z.string().max(255).optional(),
});

router.use(requireAuth);

router.post('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const payload = transferSchema.parse(req.body);
    const user = req.user;

    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const result = await accountService.transfer({
      sourceAccountId: payload.sourceAccountId,
      destinationAccountId: payload.destinationAccountId,
      amountRaw: payload.amount,
      requesterId: user.id,
      requesterRole: user.role,
      description: payload.description,
    });

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
});

export { router as transferRouter };
