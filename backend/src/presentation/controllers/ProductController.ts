import type { Request, Response, NextFunction } from 'express';
import type { ListProductsUseCase } from '../../application/use-cases/ListProductsUseCase.js';
import type { ListProductsByCategoryUseCase } from '../../application/use-cases/ListProductsByCategoryUseCase.js';
import type { GetProductBySlugUseCase } from '../../application/use-cases/GetProductBySlugUseCase.js';
import type { ListHighlightProductsUseCase } from '../../application/use-cases/ListHighlightProductsUseCase.js';
import type { ProductCategory } from '../../domain/entities/Product.js';

const categories: ProductCategory[] = [
  'copos',
  'sandubrownies',
  'cookies',
  'potes',
  'bolos',
  'especiais',
];

export class ProductController {
  constructor(
    private readonly listProducts: ListProductsUseCase,
    private readonly listByCategory: ListProductsByCategoryUseCase,
    private readonly getBySlug: GetProductBySlugUseCase,
    private readonly listHighlights: ListHighlightProductsUseCase,
  ) {}

  list = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const products = await this.listProducts.execute();
      res.json({ data: products });
    } catch (error) {
      next(error);
    }
  };

  highlights = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const products = await this.listHighlights.execute();
      res.json({ data: products });
    } catch (error) {
      next(error);
    }
  };

  byCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = req.params.category as ProductCategory;
      if (!categories.includes(category)) {
        res.status(400).json({ error: 'INVALID_CATEGORY', status: 400 });
        return;
      }
      const products = await this.listByCategory.execute(category);
      res.json({ data: products });
    } catch (error) {
      next(error);
    }
  };

  bySlug = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const product = await this.getBySlug.execute(req.params.slug);
      res.json({ data: product });
    } catch (error) {
      next(error);
    }
  };
}
