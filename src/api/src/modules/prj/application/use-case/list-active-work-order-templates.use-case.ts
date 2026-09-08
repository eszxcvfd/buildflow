import { Inject, Injectable } from '@nestjs/common';
import { PRJ_WORK_ORDER_TEMPLATE_REPOSITORY, WorkOrderTemplateRepositoryPort } from '../../domain/repository/work-order-template-repository.port';
import { WorkOrderTemplateEntity } from '../../domain/entity/work-order-template.entity';

export interface ListActiveWorkOrderTemplatesOutput {
  entities: WorkOrderTemplateEntity[];
}

/**
 * PRJ-SRS-008 (issue #39) — picker cho JOB (tạo Work Order mới): chỉ mẫu ACTIVE,
 * sắp theo name. JOB-SRS-001 prefill bằng `GET /active` + `GET /:id` rồi copy
 * giá trị (snapshot, cho phép chỉnh trước khi lưu) — không có endpoint `/apply`
 * ở slice này (JOB chưa tồn tại; xem ENDPOINTS.md §16).
 * Read-only: không tx, không audit.
 */
@Injectable()
export class ListActiveWorkOrderTemplatesUseCase {
  constructor(
    @Inject(PRJ_WORK_ORDER_TEMPLATE_REPOSITORY) private readonly repo: WorkOrderTemplateRepositoryPort,
  ) {}

  async execute(): Promise<ListActiveWorkOrderTemplatesOutput> {
    const entities = await this.repo.findAllActive();
    return { entities };
  }
}
