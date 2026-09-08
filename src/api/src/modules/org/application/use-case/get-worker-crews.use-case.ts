import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { WORKER_REPOSITORY, WorkerRepositoryPort } from '../../domain/repository/worker-repository.port';
import { CREW_REPOSITORY, CrewRepositoryPort, WorkerCrewMembership } from '../../domain/repository/crew-repository.port';

export interface GetWorkerCrewsInput { workerId: string; }

export interface GetWorkerCrewsOutput { memberships: WorkerCrewMembership[]; }

/**
 * ORG-03/ORG-05 (Worker ↔ Crew link) — tra cứu đội của worker.
 * Read-only (mirror open-work): chỉ pool reads (findById + memberships),
 * KHÔNG transaction, KHÔNG ghi audit_logs. Chỉ active memberships
 * (is_active); lịch sử cũ (is_active=false) KHÔNG trả.
 */
@Injectable()
export class GetWorkerCrewsUseCase {
  constructor(
    @Inject(WORKER_REPOSITORY) private readonly workerRepo: WorkerRepositoryPort,
    @Inject(CREW_REPOSITORY) private readonly crewRepo: CrewRepositoryPort,
  ) {}

  async execute(input: GetWorkerCrewsInput): Promise<GetWorkerCrewsOutput> {
    const worker = await this.workerRepo.findById(input.workerId);
    if (!worker) throw new NotFoundException('Không tìm thấy hồ sơ worker');
    const memberships = await this.crewRepo.findMembershipsByUser(input.workerId);
    return { memberships };
  }
}
