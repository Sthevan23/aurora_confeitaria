import type { BusinessInfo } from '../../domain/entities/BusinessInfo.js';
import type { IBusinessRepository } from '../../domain/repositories/IBusinessRepository.js';

export class GetBusinessInfoUseCase {
  constructor(private readonly business: IBusinessRepository) {}

  execute(): Promise<BusinessInfo> {
    return this.business.getInfo();
  }
}
