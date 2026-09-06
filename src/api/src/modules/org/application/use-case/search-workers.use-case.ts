import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { WORKER_REPOSITORY, WorkerRepositoryPort, WorkerFilter } from '../../domain/repository/worker-repository.port';
import { WorkerEntity } from '../../domain/entity/worker.entity';

export interface SearchWorkersInput {
  status?: string;
  search?: string;
  tradeId?: string;
  skillLevel?: number;
  sort?: 'name' | 'createdAt';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface SearchWorkersOutput {
  entities: WorkerEntity[];
  total: number;
}

@Injectable()
export class SearchWorkersUseCase {
  constructor(@Inject(WORKER_REPOSITORY) private readonly workerRepo: WorkerRepositoryPort) {}

  async execute(input: SearchWorkersInput): Promise<SearchWorkersOutput> {
    // ORG-SRS-005 (issue #28) — filter errors carry fieldErrors alongside the
    // unchanged message text (object literal, no presentation import: the
    // application layer must not depend on api/rest).
    if (input.status && !['ACTIVE', 'INACTIVE', 'LOCKED'].includes(input.status)) {
      throw new BadRequestException({ statusCode: 400, message: 'Trạng thái không hợp lệ', fieldErrors: { status: ['Trạng thái không hợp lệ'] } });
    }
    if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100)) {
      throw new BadRequestException({ statusCode: 400, message: 'Limit không hợp lệ (1-100)', fieldErrors: { limit: ['Limit không hợp lệ (1-100)'] } });
    }
    if (input.offset !== undefined && (!Number.isInteger(input.offset) || input.offset < 0)) {
      throw new BadRequestException({ statusCode: 400, message: 'Offset không hợp lệ (phải >= 0)', fieldErrors: { offset: ['Offset không hợp lệ (phải >= 0)'] } });
    }
    if (input.tradeId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.tradeId)) {
      throw new BadRequestException({ statusCode: 400, message: 'Trade ID không hợp lệ', fieldErrors: { tradeId: ['Trade ID không hợp lệ'] } });
    }
    if (input.skillLevel !== undefined && (!Number.isInteger(input.skillLevel) || input.skillLevel < 1 || input.skillLevel > 5)) {
      throw new BadRequestException({ statusCode: 400, message: 'Skill level phải là 1-5', fieldErrors: { skillLevel: ['Skill level phải là 1-5'] } });
    }
    if (input.sort !== undefined && !['name', 'createdAt'].includes(input.sort)) {
      throw new BadRequestException({ statusCode: 400, message: 'Sort không hợp lệ (name|createdAt)', fieldErrors: { sort: ['Sort không hợp lệ (name|createdAt)'] } });
    }
    if (input.order !== undefined && !['asc', 'desc'].includes(input.order)) {
      throw new BadRequestException({ statusCode: 400, message: 'Order không hợp lệ (asc|desc)', fieldErrors: { order: ['Order không hợp lệ (asc|desc)'] } });
    }

    const filter: WorkerFilter = {
      status: input.status,
      search: input.search,
      tradeId: input.tradeId,
      skillLevel: input.skillLevel,
      sort: input.sort,
      order: input.order,
      limit: input.limit,
      offset: input.offset,
    };

    return this.workerRepo.findMany(filter);
  }
}
