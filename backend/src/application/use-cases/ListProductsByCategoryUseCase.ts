import type { Product, ProductCategory } from '../../domain/entities/Product.js';
import type { IProductRepository } from '../../domain/repositories/IProductRepository.js';

export class ListProductsByCategoryUseCase {
  constructor(private readonly products: IProductRepository) {}

  execute(category: ProductCategory): Promise<Product[]> {
    return this.products.findByCategory(category);
  }
}
