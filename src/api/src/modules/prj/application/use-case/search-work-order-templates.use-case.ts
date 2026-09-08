import { Inject, Injectable } from '@nestjs/common';
import { PRJ_WORK_ORDER_TEMPLATE_REPOSITORY, TemplateWorkTypeRef, WorkOrderTemplateFilter, WorkOrderTemplateRepositoryPort } from '../../domain/repository/work-order-template-repository.port';
import { WorkOrderTemplateEntity } from '../../domain/entity/work-order-template.entity';

export interface SearchWorkOrderTemplatesInput {
  status?: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ALL';
  workTypeId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface SearchWorkOrderTemplatesOutput {
  entities: WorkOrderTemplateEntity[];
  total: number;
  /**
   * Enrichment cho list: ref hiển thị loại công việc theo workTypeId
   * (batch 1 query, tránh N+1 — mirror crews `enrichments`). Id không có
   * trong map → mapper mặc định `workType: null`.
   */
  workTypeRefs: Map<string, TemplateWorkTypeRef>;
}

/**
 * PRJ-SRS-008 (issue #39) — tra cứu mẫu công việc (filter status/workTypeId,
 * pagination). Read-only: không tx, không audit.
 */
@Injectable()
export class SearchWorkOrderTemplatesUseCase {
  constructor(
    @Inject(PRJ_WORK_ORDER_TEMPLATE_REPOSITORY) private readonly repo: WorkOrderTemplateRepositoryPort,
  ) {}

  async execute(input: SearchWorkOrderTemplatesInput): Promise<SearchWorkOrderTemplatesOutput> {
    const filter: WorkOrderTemplateFilter = {
      status: input.status ?? 'ALL',
      workTypeId: input.workTypeId?.trim() ? input.workTypeId.trim() : undefined,
      search: input.search?.trim() ? input.search.trim() : undefined,
      limit: input.limit,
      offset: input.offset,
    };
    const { entities, total } = await this.repo.search(filter);
    const ids = [...new Set(entities.map((e) => e.workTypeId).filter((id): id is string => id !== null))];
    const workTypeRefs = await this.repo.findWorkTypeRefs(ids);
    return { entities, total, workTypeRefs };
  }
}
