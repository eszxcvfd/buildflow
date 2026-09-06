import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { WORKER_REPOSITORY, WorkerRepositoryPort } from '../../domain/repository/worker-repository.port';

/**
 * ORG-SRS-004 (issue #27) — pre-check open work của worker trước khi admin xác
 * nhận SUSPEND/TERMINATE. Chỉ đếm, không chặn, không ghi audit.
 */
export interface GetWorkerOpenWorkInput { workerId: string; }

export interface GetWorkerOpenWorkOutput { openAssignments: number; }

@Injectable()
export class GetWorkerOpenWorkUseCase {
  constructor(@Inject(WORKER_REPOSITORY) private readonly workerRepo: WorkerRepositoryPort) {}

  async execute(input: GetWorkerOpenWorkInput): Promise<GetWorkerOpenWorkOutput> {
    const worker = await this.workerRepo.findById(input.workerId);
    if (!worker) throw new NotFoundException('Không tìm thấy hồ sơ worker');
    const openAssignments = await this.workerRepo.countOpenAssignments(input.workerId);
    return { openAssignments };
  }
}
