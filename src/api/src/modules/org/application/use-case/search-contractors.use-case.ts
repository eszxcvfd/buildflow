import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { CONTRACTOR_REPOSITORY, ContractorRepositoryPort, ContractorFilter } from '../../domain/repository/contractor-repository.port';
import { ContractorEntity } from '../../domain/entity/contractor.entity';

export interface SearchContractorsInput {
  status?: string;
  search?: string;
  scope?: string;
  limit?: number;
  offset?: number;
  eligibleOnly?: boolean;
}

export interface SearchContractorsOutput {
  entities: ContractorEntity[];
  total: number;
}

@Injectable()
export class SearchContractorsUseCase {
  constructor(@Inject(CONTRACTOR_REPOSITORY) private readonly contractorRepo: ContractorRepositoryPort) {}

  async execute(input: SearchContractorsInput): Promise<SearchContractorsOutput> {
    if (input.status && !['ACTIVE', 'INACTIVE'].includes(input.status)) {
      throw new BadRequestException('Trạng thái không hợp lệ');
    }
    if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100)) {
      throw new BadRequestException('Limit không hợp lệ (1-100)');
    }
    if (input.offset !== undefined && (!Number.isInteger(input.offset) || input.offset < 0)) {
      throw new BadRequestException('Offset không hợp lệ (phải >= 0)');
    }

    const filter: ContractorFilter = {
      status: input.status,
      search: input.search,
      scope: input.scope,
      limit: input.limit,
      offset: input.offset,
    };

    // ORG-SRS-002: eligibility filtering - active contractors only for new assignments
    if (input.eligibleOnly) {
      filter.status = 'ACTIVE';
    }

    return this.contractorRepo.findMany(filter);
  }
}
