import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PRJ_WORK_ORDER_TEMPLATE_REPOSITORY, WorkOrderTemplateRepositoryPort } from '../../domain/repository/work-order-template-repository.port';
import { WorkOrderTemplateEntity } from '../../domain/entity/work-order-template.entity';

export interface GetWorkOrderTemplateInput {
  templateId: string;
}

export interface GetWorkOrderTemplateOutput {
  entity: WorkOrderTemplateEntity;
}

/**
 * PRJ-SRS-008 (issue #39) — chi tiết mẫu công việc (mọi status đều đọc được;
 * JOB prefill dùng bản ACTIVE qua endpoint này + `/active`).
 * Read-only: không tx, không audit.
 */
@Injectable()
export class GetWorkOrderTemplateUseCase {
  constructor(
    @Inject(PRJ_WORK_ORDER_TEMPLATE_REPOSITORY) private readonly repo: WorkOrderTemplateRepositoryPort,
  ) {}

  async execute(input: GetWorkOrderTemplateInput): Promise<GetWorkOrderTemplateOutput> {
    const entity = await this.repo.findById(input.templateId);
    if (!entity) throw new NotFoundException('Không tìm thấy mẫu công việc');
    return { entity };
  }
}
