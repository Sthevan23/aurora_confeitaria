import { apiClient } from '../../infrastructure/api/apiClient';
import type { BusinessInfo } from '../../domain/entities/catalog';

const fallback: BusinessInfo = {
  brandName: 'Aurora Confeitaria Artesanal',
  tagline: 'Feito com amor',
  city: 'Boa Esperança',
  state: 'MG',
  instagramUrl: 'https://www.instagram.com/a.aurora.confeitaria/',
  instagramHandle: '@a.aurora.confeitaria',
  whatsapp: '(35) 98721-6486',
  whatsappUrl: 'https://wa.me/5535987216486',
  categories: [
    'Copos Brownie',
    'Sandubrownies',
    'Cookies',
    'Potes',
    'Bolos',
    'Especiais',
  ],
};

export class GetBusinessInfo {
  async execute(): Promise<BusinessInfo> {
    try {
      return await apiClient.getBusinessInfo();
    } catch {
      return fallback;
    }
  }
}
