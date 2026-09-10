import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { JOB_WORK_ORDER_REPOSITORY, WorkOrderListRef, WorkOrderRepositoryPort } from '../../domain/repository/work-order-repository.port';
import { ProjectScopeService } from '../../../iam/application/service/project-scope.service';

export interface JobBoardFilterOption {
  id: string;
  name: string;
}

export interface GetJobBoardFilterOptionsOutput {
  projects: JobBoardFilterOption[];
  areas: JobBoardFilterOption[];
  workTypes: JobBoardFilterOption[];
  trades: JobBoardFilterOption[];
  /** Clock server (parity `SearchJobBoardUseCase` — caller dùng chung instant). */
  now: Date;
}

/**
 * JOB-SRS-006 (issue #46, BD13) — nguồn cho filter picker
 * (`GET /api/v1/job-board/filter-options`, read-only, không audit — parity
 * BD8/BD18): DISTINCT `project_id`/`area_id`/`work_type_id`/
 * `required_trade_id` trên ĐÚNG WHERE availability+scope (shared
 * condition-builder với `searchJobBoard` — không leak row ngoài scope).
 * Membership rỗng → 4 mảng rỗng (BD2 parity, không 403); ADMIN → toàn board.
 * KHÔNG áp filter người dùng (option set tĩnh — tránh combinatorial API).
 * Enrich name qua batch refs có sẵn (mirror search use case).
 */
@Injectable()
export class GetJobBoardFilterOptionsUseCase {
  constructor(
    @Inject(JOB_WORK_ORDER_REPOSITORY) private readonly workOrderRepo: WorkOrderRepositoryPort,
    private readonly scope: ProjectScopeService,
  ) {}

  async execute(input: {
    actorUserId: string;
    actorRoles?: string[];
  }): Promise<GetJobBoardFilterOptionsOutput> {
    const accessibleIds = await this.scope.resolveAccessibleProjectIds({
      userId: input.actorUserId,
      actorRoles: input.actorRoles ?? [],
    });
    const now = new Date();
    const empty: GetJobBoardFilterOptionsOutput = {
      projects: [],
      areas: [],
      workTypes: [],
      trades: [],
      now,
    };
    if (accessibleIds !== null && accessibleIds.length === 0) {
      return empty;
    }
    // Fail-closed: method thiếu là lỗi wiring máy chủ → 500 (mirror
    // `SearchJobBoardUseCase` F002), KHÔNG fail-open rỗng.
    const findOptions = this.workOrderRepo.findJobBoardFilterOptions;
    if (typeof findOptions !== 'function') {
      throw new InternalServerErrorException('Không thể tải gợi ý bộ lọc');
    }
    const ids = await findOptions.call(this.workOrderRepo, {
      projectIds: accessibleIds ?? undefined,
      now,
    });
    const [projectRefs, areaRefs, workTypeRefs, tradeRefs] = await Promise.all([
      this.workOrderRepo.findProjectRefs(ids.projectIds),
      this.workOrderRepo.findAreaRefs
        ? this.workOrderRepo.findAreaRefs(ids.areaIds)
        : Promise.resolve(new Map<string, WorkOrderListRef>()),
      this.workOrderRepo.findWorkTypeRefs(ids.workTypeIds),
      this.workOrderRepo.findTradeRefs
        ? this.workOrderRepo.findTradeRefs(ids.tradeIds)
        : Promise.resolve(new Map<string, WorkOrderListRef>()),
    ]);
    const pick = (idList: string[], refs: Map<string, WorkOrderListRef>): JobBoardFilterOption[] =>
      idList
        .map((id) => ({ id, name: refs.get(id)?.name ?? id }))
        .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    return {
      projects: pick(ids.projectIds, projectRefs),
      areas: pick(ids.areaIds, areaRefs),
      workTypes: pick(ids.workTypeIds, workTypeRefs),
      trades: pick(ids.tradeIds, tradeRefs),
      now,
    };
  }
}
