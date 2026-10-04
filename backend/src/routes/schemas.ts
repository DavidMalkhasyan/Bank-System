import type { Response } from 'express';
import { z } from 'zod';

import { ACCOUNT_TYPES, CURRENCIES, TRANSACTION_TYPES, type Page } from '../types/domain.js';

export const uuidParam = z.string().uuid('Invalid identifier');

export const amountField = z
  .union([z.string(), z.number()], { required_error: 'Amount is required' })
  .transform((value) => String(value));

export const descriptionField = z.string().trim().max(140, 'Description must be 140 characters or fewer').optional();

export const passwordField = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters');

export const emailField = z.string({ required_error: 'Email is required' }).trim().email('Enter a valid email address').max(255);

export const fullNameField = z
  .string({ required_error: 'Full name is required' })
  .trim()
  .min(2, 'Full name must be at least 2 characters')
  .max(80, 'Full name must be at most 80 characters');

export const currencyField = z.enum(CURRENCIES as [string, ...string[]], {
  errorMap: () => ({ message: `Currency must be one of ${CURRENCIES.join(', ')}` }),
});

export const accountTypeField = z.enum(ACCOUNT_TYPES as [string, ...string[]], {
  errorMap: () => ({ message: 'Account type must be CHECKING or SAVINGS' }),
});

export const transactionTypeField = z.enum(TRANSACTION_TYPES as [string, ...string[]]);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates must use YYYY-MM-DD');

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const transactionQuery = paginationQuery.extend({
  type: transactionTypeField.optional(),
  accountId: uuidParam.optional(),
  search: z.string().trim().max(100).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

export const sendPage = <T>(res: Response, page: Page<T>) => {
  res.json({
    success: true,
    data: page.items,
    meta: { page: page.page, pageSize: page.pageSize, total: page.total, totalPages: Math.max(1, Math.ceil(page.total / page.pageSize)) },
  });
};
