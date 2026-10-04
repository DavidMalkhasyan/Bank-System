import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

import { AppError } from '../utils/errors.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found`, details: null });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    res.status(400).json({
      success: false,
      message: firstIssue?.message ?? 'Invalid request',
      details: { fieldErrors: error.flatten().fieldErrors },
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      details: error.publicDetails ?? null,
    });
    return;
  }

  // Malformed JSON body from express.json().
  if (error?.type === 'entity.parse.failed') {
    res.status(400).json({ success: false, message: 'Request body must be valid JSON', details: null });
    return;
  }

  // PostgreSQL: unique violation / invalid text representation (e.g. bad UUID).
  if (error?.code === '23505') {
    res.status(409).json({ success: false, message: 'This record already exists', details: null });
    return;
  }
  if (error?.code === '22P02') {
    res.status(400).json({ success: false, message: 'Invalid identifier', details: null });
    return;
  }

  console.error(error);
  res.status(500).json({ success: false, message: 'Internal server error', details: null });
};
