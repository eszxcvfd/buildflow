import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CONTRACTOR_REPOSITORY, ContractorRepositoryPort } from '../../domain/repository/contractor-repository.port';
import { ContractorEntity } from '../../domain/entity/contractor.entity';

export interface GetContractorInput { contractorId: string; }

@Injectable()
export class GetContractorUseCase {
  constructor(@Inject(CONTRACTOR_REPOSITORY) private readonly contractorRepo: ContractorRepositoryPort) {}
  async execute(input: GetContractorInput): Promise<{ entity: ContractorEntity }> {
    const entity = await this.contractorRepo.findById(input.contractorId);
    if (!entity) throw new NotFoundException('Không tìm thấy hồ sơ nhà thầu');
    return { entity };
  }
}
