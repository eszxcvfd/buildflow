import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CONTRACTOR_REPOSITORY, ContractorRepositoryPort } from '../../domain/repository/contractor-repository.port';

/**
 * ORG-SRS-004 (issue #27) — pre-check open work của nhà thầu trước khi admin xác
 * nhận SUSPEND/TERMINATE. Chỉ đếm, không chặn, không ghi audit.
 */
export interface GetContractorOpenWorkInput { contractorId: string; }

export interface GetContractorOpenWorkOutput { openAssignments: number; }

@Injectable()
export class GetContractorOpenWorkUseCase {
  constructor(@Inject(CONTRACTOR_REPOSITORY) private readonly contractorRepo: ContractorRepositoryPort) {}

  async execute(input: GetContractorOpenWorkInput): Promise<GetContractorOpenWorkOutput> {
    const contractor = await this.contractorRepo.findById(input.contractorId);
    if (!contractor) throw new NotFoundException('Không tìm thấy hồ sơ nhà thầu');
    const openAssignments = await this.contractorRepo.countOpenAssignments(input.contractorId);
    return { openAssignments };
  }
}
