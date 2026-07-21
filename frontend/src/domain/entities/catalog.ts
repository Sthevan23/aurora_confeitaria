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

export interface BusinessInfo {
  brandName: string;
  tagline: string;
  city: string;
  state: string;
  instagramUrl: string;
  instagramHandle: string;
  whatsapp: string;
  whatsappUrl: string;
  categories: string[];
}

export interface ContactPayload {
  name: string;
  email: string;
  phone: string;
  message: string;
}

export const categoryLabels: Record<ProductCategory | 'all', string> = {
  all: 'Todos',
  copos: 'Copos Brownie',
  sandubrownies: 'Sandubrownies',
  cookies: 'Cookies',
  potes: 'Potes',
  bolos: 'Bolos',
  especiais: 'Especiais',
};
