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
  sort?: 'name' | 'createdAt';
  order?: 'asc' | 'desc';
}

export interface SearchContractorsOutput {
  entities: ContractorEntity[];
  total: number;
}

@Injectable()
export class SearchContractorsUseCase {
  constructor(@Inject(CONTRACTOR_REPOSITORY) private readonly contractorRepo: ContractorRepositoryPort) {}

  async execute(input: SearchContractorsInput): Promise<SearchContractorsOutput> {
    // ORG-SRS-005 (issue #28) — filter errors carry fieldErrors alongside the
    // unchanged message text (object literal, no presentation import: the
    // application layer must not depend on api/rest).
    if (input.status && !['ACTIVE', 'INACTIVE'].includes(input.status)) {
      throw new BadRequestException({ statusCode: 400, message: 'Trạng thái không hợp lệ', fieldErrors: { status: ['Trạng thái không hợp lệ'] } });
    }
    if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100)) {
      throw new BadRequestException({ statusCode: 400, message: 'Limit không hợp lệ (1-100)', fieldErrors: { limit: ['Limit không hợp lệ (1-100)'] } });
    }
    if (input.offset !== undefined && (!Number.isInteger(input.offset) || input.offset < 0)) {
      throw new BadRequestException({ statusCode: 400, message: 'Offset không hợp lệ (phải >= 0)', fieldErrors: { offset: ['Offset không hợp lệ (phải >= 0)'] } });
    }
    if (input.sort !== undefined && !['name', 'createdAt'].includes(input.sort)) {
      throw new BadRequestException({ statusCode: 400, message: 'Sort không hợp lệ (name|createdAt)', fieldErrors: { sort: ['Sort không hợp lệ (name|createdAt)'] } });
    }
    if (input.order !== undefined && !['asc', 'desc'].includes(input.order)) {
      throw new BadRequestException({ statusCode: 400, message: 'Order không hợp lệ (asc|desc)', fieldErrors: { order: ['Order không hợp lệ (asc|desc)'] } });
    }

    const filter: ContractorFilter = {
      status: input.status,
      search: input.search,
      scope: input.scope,
      sort: input.sort,
      order: input.order,
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
