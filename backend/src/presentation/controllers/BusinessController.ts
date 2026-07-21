import type { Request, Response, NextFunction } from 'express';
import type { GetBusinessInfoUseCase } from '../../application/use-cases/GetBusinessInfoUseCase.js';

export class BusinessController {
  constructor(private readonly getBusinessInfo: GetBusinessInfoUseCase) {}

  info = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const info = await this.getBusinessInfo.execute();
      res.json({ data: info });
    } catch (error) {
      next(error);
    }
  };
}
