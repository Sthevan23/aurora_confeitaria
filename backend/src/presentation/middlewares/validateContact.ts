import type { RequestHandler } from 'express';
import { z } from 'zod';

export const contactSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(160),
  phone: z.string().min(8).max(30),
  message: z.string().min(5).max(2000),
});

export const validateContactBody: RequestHandler = (req, _res, next) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    next(new Error('VALIDATION_ERROR'));
    return;
  }
  req.body = parsed.data;
  next();
};
