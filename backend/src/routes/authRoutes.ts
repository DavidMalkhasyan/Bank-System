import { Router } from 'express';
import { z } from 'zod';
import { authService } from '../services/authService.js';
import { badRequest } from '../utils/errors.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = registerSchema;

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

router.post('/register', async (req, res, next) => {
  try {
    const payload = registerSchema.parse(req.body);
    const result = await authService.register(payload.email, payload.password);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const payload = loginSchema.parse(req.body);
    const result = await authService.login(payload.email, payload.password);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const payload = refreshSchema.parse(req.body);
    const result = await authService.refresh(payload.refreshToken);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    const refreshToken = typeof payload.refreshToken === 'string' ? payload.refreshToken : '';
    await authService.logout(refreshToken);
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

export { router as authRouter };
