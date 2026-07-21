import type { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const message = err instanceof Error ? err.message : 'INTERNAL_ERROR';

  const map: Record<string, number> = {
    PRODUCT_NOT_FOUND: 404,
    INVALID_CONTACT_PAYLOAD: 400,
    VALIDATION_ERROR: 400,
  };

  const status = map[message] ?? 500;

  res.status(status).json({
    error: message,
    status,
  });
}
