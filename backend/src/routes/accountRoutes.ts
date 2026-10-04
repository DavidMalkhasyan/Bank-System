import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, currentUser, requireAuth } from '../middleware/auth.js';
import { accountService } from '../services/accountService.js';
import type { AccountType, Currency } from '../types/domain.js';
import { accountTypeField, amountField, currencyField, descriptionField, uuidParam } from './schemas.js';

const router = Router();

const createAccountSchema = z.object({
  currency: currencyField,
  type: accountTypeField.default('CHECKING'),
  name: z.string().trim().max(60, 'Name must be 60 characters or fewer').optional(),
});
const renameSchema = z.object({
  name: z.string({ required_error: 'Name is required' }).trim().min(1, 'Name is required').max(60, 'Name must be 60 characters or fewer'),
});
const moneySchema = z.object({ amount: amountField, description: descriptionField });
const lookupSchema = z.object({
  number: z.string({ required_error: 'Account number is required' }).transform((value) => value.replace(/\D/g, '')).pipe(
    z.string().length(16, 'Account numbers have 16 digits'),
  ),
});

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await accountService.listAccounts(currentUser(req).id) });
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = createAccountSchema.parse(req.body);
    const account = await accountService.createAccount(currentUser(req), {
      currency: payload.currency as Currency,
      type: payload.type as AccountType,
      name: payload.name,
    });
    res.status(201).json({ success: true, data: account });
  }),
);

// Declared before '/:id' so "lookup" is not parsed as an id.
router.get(
  '/lookup',
  asyncHandler(async (req, res) => {
    const { number } = lookupSchema.parse(req.query);
    res.json({ success: true, data: await accountService.lookup(number, currentUser(req)) });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = uuidParam.parse(req.params.id);
    res.json({ success: true, data: await accountService.getAccount(id, currentUser(req)) });
  }),
);

router.get(
  '/:id/balance',
  asyncHandler(async (req, res) => {
    const id = uuidParam.parse(req.params.id);
    const account = await accountService.getAccount(id, currentUser(req));
    res.json({ success: true, data: { accountId: account.id, currency: account.currency, balance: account.balance } });
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = uuidParam.parse(req.params.id);
    const payload = renameSchema.parse(req.body);
    res.json({ success: true, data: await accountService.renameAccount(id, currentUser(req), payload.name) });
  }),
);

router.post(
  '/:id/close',
  asyncHandler(async (req, res) => {
    const id = uuidParam.parse(req.params.id);
    res.json({ success: true, data: await accountService.closeAccount(id, currentUser(req)) });
  }),
);

router.post(
  '/:id/deposit',
  asyncHandler(async (req, res) => {
    const id = uuidParam.parse(req.params.id);
    const payload = moneySchema.parse(req.body);
    res.json({ success: true, data: await accountService.deposit(id, currentUser(req), payload.amount, payload.description) });
  }),
);

router.post(
  '/:id/withdraw',
  asyncHandler(async (req, res) => {
    const id = uuidParam.parse(req.params.id);
    const payload = moneySchema.parse(req.body);
    res.json({ success: true, data: await accountService.withdraw(id, currentUser(req), payload.amount, payload.description) });
  }),
);

export { router as accountRouter };
