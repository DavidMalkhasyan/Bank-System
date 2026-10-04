import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import type { AuthUser, UserRole } from '../types/domain.js';
import { forbidden, unauthorized } from '../utils/errors.js';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export const requireAuth = (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    return next(unauthorized());
  }

  try {
    const payload = jwt.verify(token, env.jwtAccessSecret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
    req.user = {
      id: String(payload.sub),
      email: String(payload.email),
      role: payload.role === 'ADMIN' ? 'ADMIN' : 'CUSTOMER',
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

/** Returns the authenticated user or throws 401; use after requireAuth. */
export const currentUser = (req: AuthenticatedRequest): AuthUser => {
  if (!req.user) {
    throw unauthorized();
  }
  return req.user;
};

/** Forwards rejected promises from async route handlers to the error handler. */
export const asyncHandler =
  (handler: (req: AuthenticatedRequest, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    handler(req as AuthenticatedRequest, res).catch(next);
  };
