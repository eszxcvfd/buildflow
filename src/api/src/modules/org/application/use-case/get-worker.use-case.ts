import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { WORKER_REPOSITORY, WorkerRepositoryPort } from '../../domain/repository/worker-repository.port';
import { CREW_REPOSITORY, CrewRepositoryPort, WorkerCrewRef } from '../../domain/repository/crew-repository.port';
import { WorkerEntity } from '../../domain/entity/worker.entity';

export interface GetWorkerInput { workerId: string; }

export interface GetWorkerOutput {
  entity: WorkerEntity;
  /** ORG-05 — active memberships của worker (kèm profile detail). */
  crews: WorkerCrewRef[];
}

@Injectable()
export class GetWorkerUseCase {
  constructor(
    @Inject(WORKER_REPOSITORY) private readonly workerRepo: WorkerRepositoryPort,
    @Inject(CREW_REPOSITORY) private readonly crewRepo: CrewRepositoryPort,
  ) {}
  async execute(input: GetWorkerInput): Promise<GetWorkerOutput> {
    const entity = await this.workerRepo.findById(input.workerId);
    if (!entity) throw new NotFoundException('Không tìm thấy hồ sơ worker');
    // ORG-05 — MỘT pool read memberships (không N+1 — detail chỉ có 1 worker).
    const memberships = await this.crewRepo.findMembershipsByUser(input.workerId);
    const crews: WorkerCrewRef[] = memberships.map((m) => ({
      crewId: m.crewId,
      crewCode: m.crewCode,
      crewName: m.crewName,
      memberRole: m.memberRole,
    }));
    return { entity, crews };
  }
}
