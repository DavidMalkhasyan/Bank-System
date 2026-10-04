import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler, currentUser, requireAuth, requireRole } from '../middleware/auth.js';
import { accountRepository } from '../repositories/accountRepository.js';
import { auditRepository } from '../repositories/auditRepository.js';
import { transactionRepository } from '../repositories/transactionRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { adminService } from '../services/adminService.js';
import type { AccountStatus, TransactionType } from '../types/domain.js';
import { paginationQuery, sendPage, transactionQuery, uuidParam } from './schemas.js';

const router = Router();

const searchQuery = paginationQuery.extend({ search: z.string().trim().max(100).optional() });
const accountQuery = searchQuery.extend({ status: z.enum(['ACTIVE', 'FROZEN', 'CLOSED']).optional() });
const auditQuery = paginationQuery.extend({ action: z.string().trim().max(100).optional() });
const statusSchema = z.object({
  status: z.enum(['ACTIVE', 'FROZEN'], { errorMap: () => ({ message: 'Status must be ACTIVE or FROZEN' }) }),
  reason: z.string().trim().max(200).optional(),
});
const roleSchema = z.object({
  role: z.enum(['CUSTOMER', 'ADMIN'], { errorMap: () => ({ message: 'Role must be CUSTOMER or ADMIN' }) }),
});

router.use(requireAuth, requireRole('ADMIN'));

router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await adminService.stats() });
  }),
);

router.get(
  '/users',
  asyncHandler(async (req, res) => {
    sendPage(res, await userRepository.list(searchQuery.parse(req.query)));
  }),
);

router.patch(
  '/users/:id/role',
  asyncHandler(async (req, res) => {
    const id = uuidParam.parse(req.params.id);
    const { role } = roleSchema.parse(req.body);
    res.json({ success: true, data: await adminService.setUserRole(currentUser(req), id, role) });
  }),
);

router.get(
  '/accounts',
  asyncHandler(async (req, res) => {
    const params = accountQuery.parse(req.query);
    sendPage(res, await accountRepository.listAll({ ...params, status: params.status as AccountStatus | undefined }));
  }),
);

router.patch(
  '/accounts/:id/status',
  asyncHandler(async (req, res) => {
    const id = uuidParam.parse(req.params.id);
    const { status, reason } = statusSchema.parse(req.body);
    res.json({ success: true, data: await adminService.setAccountStatus(currentUser(req), id, status, reason) });
  }),
);

router.get(
  '/transactions',
  asyncHandler(async (req, res) => {
    const filter = transactionQuery.parse(req.query);
    sendPage(res, await transactionRepository.listAll({ ...filter, type: filter.type as TransactionType | undefined }));
  }),
);

router.get(
  '/audit-logs',
  asyncHandler(async (req, res) => {
    sendPage(res, await auditRepository.list(auditQuery.parse(req.query)));
  }),
);

router.get(
  '/audit-logs/actions',
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await auditRepository.listActions() });
  }),
);

export { router as adminRouter };
