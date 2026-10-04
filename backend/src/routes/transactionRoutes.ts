import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, currentUser, requireAuth } from '../middleware/auth.js';
import { accountService } from '../services/accountService.js';
import { transactionRepository } from '../repositories/transactionRepository.js';
import type { Currency, TransactionType } from '../types/domain.js';
import { notFound } from '../utils/errors.js';
import { currencyField, sendPage, transactionQuery, uuidParam } from './schemas.js';

const router = Router();

const cashflowQuery = z.object({
  currency: currencyField.default('USD'),
  days: z.coerce.number().int().min(7).max(365).default(30),
});

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const filter = transactionQuery.parse(req.query);
    if (filter.accountId) {
      // Throws 404 unless the account belongs to the user.
      await accountService.getAccount(filter.accountId, { ...user, role: 'CUSTOMER' });
    }
    const page = await transactionRepository.listForUser(user.id, { ...filter, type: filter.type as TransactionType | undefined });
    sendPage(res, page);
  }),
);

router.get(
  '/cashflow',
  asyncHandler(async (req, res) => {
    const { currency, days } = cashflowQuery.parse(req.query);
    res.json({ success: true, data: await transactionRepository.cashflow(currentUser(req).id, currency as Currency, days) });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = uuidParam.parse(req.params.id);
    const transaction = await transactionRepository.findForViewer(id, currentUser(req).id);
    if (!transaction) throw notFound('Transaction not found');
    res.json({ success: true, data: transaction });
  }),
);

export { router as transactionRouter };
