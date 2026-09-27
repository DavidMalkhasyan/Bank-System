import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors.js';

export const errorHandler = (error: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      details: error.publicDetails ?? null,
    });
  }

  const statusCode = 500;
  // Log unexpected errors for easier debugging during tests
  // (kept concise; remove or guard behind env in production)
  // eslint-disable-next-line no-console
  console.error(error);

  return res.status(statusCode).json({
    success: false,
    message: 'Internal server error',
    details: null,
  });
};
