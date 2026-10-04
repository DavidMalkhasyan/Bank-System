import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, currentUser, requireAuth } from '../middleware/auth.js';
import { accountService } from '../services/accountService.js';
import { amountField, descriptionField, uuidParam } from './schemas.js';

const router = Router();

const transferSchema = z
  .object({
    sourceAccountId: uuidParam,
    destinationAccountId: uuidParam.optional(),
    destinationAccountNumber: z
      .string()
      .transform((value) => value.replace(/\D/g, ''))
      .pipe(z.string().length(16, 'Account numbers have 16 digits'))
      .optional(),
    amount: amountField,
    description: descriptionField,
  })
  .refine((value) => value.destinationAccountId || value.destinationAccountNumber, {
    message: 'Choose a destination account',
    path: ['destinationAccountId'],
  });

router.use(requireAuth);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = transferSchema.parse(req.body);
    res.status(201).json({ success: true, data: await accountService.transfer(currentUser(req), payload) });
  }),
);

export { router as transferRouter };
