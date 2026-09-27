import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { forbidden, unauthorized } from '../utils/errors.js';
import type { AuthUser, UserRole } from '../types/auth.js';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export const requireAuth = (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(unauthorized());
  }

  const token = header.split(' ')[1];
  if (!token) {
    return next(unauthorized());
  }

  try {
    const payload = jwt.verify(token, env.jwtAccessSecret) as { sub: string; email: string; role: UserRole };
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    return next();
  } catch {
    return next(unauthorized('Invalid or expired access token'));
  }
};

export const requireRole = (...roles: UserRole[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(unauthorized());
    }

    if (!roles.includes(req.user.role)) {
      return next(forbidden('You do not have permission to access this resource'));
    }

    return next();
  };
};
