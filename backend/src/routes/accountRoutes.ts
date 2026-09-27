import { Router } from 'express';
import { z } from 'zod';

import { requireAuth, requireRole } from '../middleware/auth.js';
import * as accountServiceModule from '../services/accountService.js';

const accountService = (accountServiceModule as any).accountService ?? (accountServiceModule as any).default ?? accountServiceModule;
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

const createAccountSchema = z.object({
  currency: z.enum(['USD', 'EUR', 'AMD']),
});

const moneySchema = z.object({
  amount: z.string().min(1),
});

router.use(requireAuth);

router.get('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const accounts = await accountService.getUserAccounts(user.id);
    return res.status(200).json({ success: true, data: accounts });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    // DEBUG: log Authorization header to diagnose invalid-token issues
    // eslint-disable-next-line no-console
    console.log('DEBUG /accounts auth header:', req.headers.authorization);
    const payload = createAccountSchema.parse(req.body);
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const account = await accountService.createAccount(user.id, payload.currency);
    return res.status(201).json({ success: true, data: account });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const accountId = String(req.params.id);
    const account = await accountService.getAccountById(accountId, user.id, user.role);
    return res.status(200).json({ success: true, data: account });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id/balance', async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const accountId = String(req.params.id);
    const result = await accountService.getBalance(accountId, user.id, user.role);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/deposit', async (req: AuthenticatedRequest, res, next) => {
  try {
    const payload = moneySchema.parse(req.body);
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const accountId = String(req.params.id);
    const account = await accountService.deposit(accountId, payload.amount, user.id, user.role);
    return res.status(200).json({ success: true, data: account });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/withdraw', async (req: AuthenticatedRequest, res, next) => {
  try {
    const payload = moneySchema.parse(req.body);
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const accountId = String(req.params.id);
    const account = await accountService.withdraw(accountId, payload.amount, user.id, user.role);
    return res.status(200).json({ success: true, data: account });
  } catch (error) {
    return next(error);
  }
});

export { router as accountRouter };
