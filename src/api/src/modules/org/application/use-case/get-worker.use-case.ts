import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { WORKER_REPOSITORY, WorkerRepositoryPort } from '../../domain/repository/worker-repository.port';
import { WorkerEntity } from '../../domain/entity/worker.entity';

export interface GetWorkerInput { workerId: string; }

@Injectable()
export class GetWorkerUseCase {
  constructor(@Inject(WORKER_REPOSITORY) private readonly workerRepo: WorkerRepositoryPort) {}
  async execute(input: GetWorkerInput): Promise<{ entity: WorkerEntity }> {
    const entity = await this.workerRepo.findById(input.workerId);
    if (!entity) throw new NotFoundException('Không tìm thấy hồ sơ worker');
    return { entity };
  }
}
