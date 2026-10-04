export class AppError extends Error {
  statusCode: number;
  publicDetails?: Record<string, unknown>;

  constructor(message: string, statusCode = 500, publicDetails?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.publicDetails = publicDetails;
  }
}

export const badRequest = (message: string, publicDetails?: Record<string, unknown>) =>
  new AppError(message, 400, publicDetails);
export const unauthorized = (message = 'Authentication required') => new AppError(message, 401);
export const forbidden = (message = 'Forbidden') => new AppError(message, 403);
export const notFound = (message: string) => new AppError(message, 404);
export const conflict = (message: string) => new AppError(message, 409);
