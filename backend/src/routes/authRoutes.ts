import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import { env } from '../config/env.js';
import { asyncHandler, currentUser, requireAuth } from '../middleware/auth.js';
import { authService } from '../services/authService.js';
import { emailField, fullNameField, passwordField } from './schemas.js';

const router = Router();

// Slows down password guessing; tests run without the limit.
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.isTest,
  message: { success: false, message: 'Too many attempts, please try again in a few minutes', details: null },
});

const registerSchema = z.object({ email: emailField, password: passwordField, fullName: fullNameField });
const loginSchema = z.object({ email: emailField, password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required') });
const refreshSchema = z.object({ refreshToken: z.string({ required_error: 'Refresh token is required' }).min(1) });
const profileSchema = z.object({ fullName: fullNameField });
const changePasswordSchema = z.object({
  currentPassword: z.string({ required_error: 'Current password is required' }).min(1, 'Current password is required'),
  newPassword: passwordField,
});

router.post(
  '/register',
  credentialLimiter,
  asyncHandler(async (req, res) => {
    const payload = registerSchema.parse(req.body);
    res.status(201).json({ success: true, data: await authService.register(payload) });
  }),
);

router.post(
  '/login',
  credentialLimiter,
  asyncHandler(async (req, res) => {
    const payload = loginSchema.parse(req.body);
    const result = await authService.login(payload.email, payload.password, { ip: req.ip, userAgent: req.get('user-agent') });
    res.json({ success: true, data: result });
  }),
);

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const payload = refreshSchema.parse(req.body);
    res.json({ success: true, data: await authService.refresh(payload.refreshToken) });
  }),
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const refreshToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : '';
    await authService.logout(refreshToken);
    res.json({ success: true, message: 'Logged out successfully' });
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await authService.me(currentUser(req).id) });
  }),
);

router.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = profileSchema.parse(req.body);
    res.json({ success: true, data: await authService.updateProfile(currentUser(req).id, payload.fullName) });
  }),
);

router.post(
  '/change-password',
  requireAuth,
  credentialLimiter,
  asyncHandler(async (req, res) => {
    const payload = changePasswordSchema.parse(req.body);
    const result = await authService.changePassword(currentUser(req).id, payload.currentPassword, payload.newPassword);
    res.json({ success: true, data: result });
  }),
);

export { router as authRouter };
