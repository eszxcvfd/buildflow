import { Inject, Injectable } from '@nestjs/common';
import { PRJ_WORK_TYPE_REPOSITORY, WorkTypeRepositoryPort } from '../../domain/repository/work-type-repository.port';
import { WorkTypeEntity } from '../../domain/entity/work-type.entity';

export interface ListActiveWorkTypesOutput {
  entities: WorkTypeEntity[];
}

/**
 * PRJ-SRS-004 (issue #35) — picker cho JOB (tạo Work Order mới) và form builder:
 * chỉ loại còn hoạt động, sắp theo name. Contract sẵn sàng cho JOB module
 * (chưa tồn tại): `requiredFields` + `configVersion` đi kèm mỗi item để JOB
 * publish kiểm tra required data và snapshot version áp dụng (QUA-SRS-002).
 * Read-only: không tx, không audit.
 */
@Injectable()
export class ListActiveWorkTypesUseCase {
  constructor(
    @Inject(PRJ_WORK_TYPE_REPOSITORY) private readonly workTypeRepo: WorkTypeRepositoryPort,
  ) {}

  async execute(): Promise<ListActiveWorkTypesOutput> {
    const entities = await this.workTypeRepo.findAllActive();
    return { entities };
  }
}
