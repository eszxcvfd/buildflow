import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { WORKER_REPOSITORY, WorkerRepositoryPort, WorkerFilter } from '../../domain/repository/worker-repository.port';
import { WorkerEntity } from '../../domain/entity/worker.entity';

export interface SearchWorkersInput {
  status?: string;
  search?: string;
  tradeId?: string;
  skillLevel?: number;
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
    if (input.status && !['ACTIVE', 'INACTIVE', 'LOCKED'].includes(input.status)) {
      throw new BadRequestException('Trạng thái không hợp lệ');
    }
    if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100)) {
      throw new BadRequestException('Limit không hợp lệ (1-100)');
    }
    if (input.offset !== undefined && (!Number.isInteger(input.offset) || input.offset < 0)) {
      throw new BadRequestException('Offset không hợp lệ (phải >= 0)');
    }
    if (input.tradeId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.tradeId)) {
      throw new BadRequestException('Trade ID không hợp lệ');
    }
    if (input.skillLevel !== undefined && (!Number.isInteger(input.skillLevel) || input.skillLevel < 1 || input.skillLevel > 5)) {
      throw new BadRequestException('Skill level phải là 1-5');
    }

    const filter: WorkerFilter = {
      status: input.status,
      search: input.search,
      tradeId: input.tradeId,
      skillLevel: input.skillLevel,
      limit: input.limit,
      offset: input.offset,
    };

    return this.workerRepo.findMany(filter);
  }
}
