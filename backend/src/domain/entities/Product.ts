export type ProductCategory =
  | 'copos'
  | 'sandubrownies'
  | 'cookies'
  | 'potes'
  | 'bolos'
  | 'especiais';

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: ProductCategory;
  highlight: boolean;
  imageUrl: string;
  priceLabel: string;
  flavors?: string[];
  size?: string;
  createdAt: string;
}
