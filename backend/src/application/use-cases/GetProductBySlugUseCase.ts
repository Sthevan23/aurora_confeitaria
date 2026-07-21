import type { Product } from '../../domain/entities/Product.js';
import type { IProductRepository } from '../../domain/repositories/IProductRepository.js';

export class GetProductBySlugUseCase {
  constructor(private readonly products: IProductRepository) {}

  async execute(slug: string): Promise<Product> {
    const product = await this.products.findBySlug(slug);
    if (!product) {
      throw new Error('PRODUCT_NOT_FOUND');
    }
    return product;
  }
}
