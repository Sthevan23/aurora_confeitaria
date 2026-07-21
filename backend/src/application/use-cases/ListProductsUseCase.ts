import type { Product } from '../../domain/entities/Product.js';
import type { IProductRepository } from '../../domain/repositories/IProductRepository.js';

export class ListProductsUseCase {
  constructor(private readonly products: IProductRepository) {}

  execute(): Promise<Product[]> {
    return this.products.findAll();
  }
}
