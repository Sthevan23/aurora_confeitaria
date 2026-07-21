import type { Request, Response, NextFunction } from 'express';
import type { CreateContactMessageUseCase } from '../../application/use-cases/CreateContactMessageUseCase.js';

export class ContactController {
  constructor(private readonly createContact: CreateContactMessageUseCase) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const message = await this.createContact.execute(req.body);
      res.status(201).json({ data: message });
    } catch (error) {
      next(error);
    }
  };
}
