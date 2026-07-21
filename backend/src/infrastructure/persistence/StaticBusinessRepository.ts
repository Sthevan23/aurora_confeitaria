import type { BusinessInfo } from '../../domain/entities/BusinessInfo.js';
import type { IBusinessRepository } from '../../domain/repositories/IBusinessRepository.js';

const businessInfo: BusinessInfo = {
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

export class StaticBusinessRepository implements IBusinessRepository {
  async getInfo(): Promise<BusinessInfo> {
    return businessInfo;
  }
}
