import type { BusinessInfo } from '../entities/BusinessInfo.js';

export interface IBusinessRepository {
  getInfo(): Promise<BusinessInfo>;
}
