import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PRJ_WORK_TYPE_REPOSITORY, WorkTypeRepositoryPort } from '../../domain/repository/work-type-repository.port';
import { WorkTypeEntity } from '../../domain/entity/work-type.entity';

export interface GetWorkTypeInput {
  workTypeId: string;
}

export interface GetWorkTypeOutput {
  entity: WorkTypeEntity;
  /** Số Work Order đang tham chiếu (trừ CANCELLED/CLOSED) — forward-ref JOB. */
  usage: { workOrders: number };
}

/**
 * PRJ-SRS-004 (issue #35) — chi tiết loại công việc kèm usage.
 * Dữ liệu cũ (kể cả inactive) vẫn đọc được — phục vụ hiển thị lịch sử WO.
 * Read-only: không tx, không audit.
 */
@Injectable()
export class GetWorkTypeUseCase {
  constructor(
    @Inject(PRJ_WORK_TYPE_REPOSITORY) private readonly workTypeRepo: WorkTypeRepositoryPort,
  ) {}

  async execute(input: GetWorkTypeInput): Promise<GetWorkTypeOutput> {
    const entity = await this.workTypeRepo.findById(input.workTypeId);
    if (!entity) throw new NotFoundException('Không tìm thấy loại công việc');
    const workOrders = await this.workTypeRepo.countActiveWorkOrders(input.workTypeId);
    return { entity, usage: { workOrders } };
  }
}
