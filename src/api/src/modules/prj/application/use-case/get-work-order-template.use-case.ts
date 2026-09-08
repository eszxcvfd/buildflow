import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PRJ_WORK_ORDER_TEMPLATE_REPOSITORY, TemplateWorkTypeRef, WorkOrderTemplateRepositoryPort } from '../../domain/repository/work-order-template-repository.port';
import { WorkOrderTemplateEntity } from '../../domain/entity/work-order-template.entity';

export interface GetWorkOrderTemplateInput {
  templateId: string;
}

export interface GetWorkOrderTemplateOutput {
  entity: WorkOrderTemplateEntity;
  /** Enrichment `workType` cho detail (null-map khi `work_type_id` NULL). */
  workTypeRefs: Map<string, TemplateWorkTypeRef>;
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
    const workTypeRefs = await this.repo.findWorkTypeRefs(entity.workTypeId ? [entity.workTypeId] : []);
    return { entity, workTypeRefs };
  }
}
