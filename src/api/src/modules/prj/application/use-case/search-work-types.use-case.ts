import { Inject, Injectable } from '@nestjs/common';
import { PRJ_WORK_TYPE_REPOSITORY, WorkTypeFilter, WorkTypeRepositoryPort } from '../../domain/repository/work-type-repository.port';
import { WorkTypeEntity } from '../../domain/entity/work-type.entity';

export interface SearchWorkTypesInput {
  status?: 'ACTIVE' | 'INACTIVE' | 'ALL';
  group?: string;
  tradeId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface SearchWorkTypesOutput {
  entities: WorkTypeEntity[];
  total: number;
}

/**
 * PRJ-SRS-004 (issue #35) — tra cứu loại công việc (filter status/group/trade,
 * pagination). Read-only: không tx, không audit.
 */
@Injectable()
export class SearchWorkTypesUseCase {
  constructor(
    @Inject(PRJ_WORK_TYPE_REPOSITORY) private readonly workTypeRepo: WorkTypeRepositoryPort,
  ) {}

  async execute(input: SearchWorkTypesInput): Promise<SearchWorkTypesOutput> {
    const filter: WorkTypeFilter = {
      status: input.status ?? 'ALL',
      group: input.group?.trim() ? input.group.trim() : undefined,
      tradeId: input.tradeId?.trim() ? input.tradeId.trim() : undefined,
      search: input.search?.trim() ? input.search.trim() : undefined,
      limit: input.limit,
      offset: input.offset,
    };
    return this.workTypeRepo.search(filter);
  }
}
