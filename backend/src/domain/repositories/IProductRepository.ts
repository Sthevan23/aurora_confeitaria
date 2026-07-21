import type { Product, ProductCategory } from '../entities/Product.js';

export interface IProductRepository {
  findAll(): Promise<Product[]>;
  findByCategory(category: ProductCategory): Promise<Product[]>;
  findBySlug(slug: string): Promise<Product | null>;
  findHighlights(): Promise<Product[]>;
}
