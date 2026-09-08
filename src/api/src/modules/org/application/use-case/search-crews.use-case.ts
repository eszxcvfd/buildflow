import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { CREW_REPOSITORY, CrewRepositoryPort, CrewFilter, CrewListEnrichment } from '../../domain/repository/crew-repository.port';
import { CrewEntity } from '../../domain/entity/crew.entity';

export interface SearchCrewsInput {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
  eligibleOnly?: boolean;
  sort?: 'name' | 'createdAt';
  order?: 'asc' | 'desc';
}

export interface SearchCrewsOutput {
  entities: CrewEntity[];
  total: number;
  /**
   * ORG-05 — enrichment cho list: leaderName + memberCount theo crew id
   * (batch 1 query, tránh N+1). Đội không có trong map → mapper mặc định
   * `{ leaderName: null, memberCount: 0 }`.
   */
  enrichments: Map<string, CrewListEnrichment>;
}

function fieldError(field: string, message: string): never {
  throw new BadRequestException({ statusCode: 400, message, fieldErrors: { [field]: [message] } });
}

/**
 * ORG-SRS-006 (issue #29) — tìm kiếm đội (pattern search-workers/contractors +
 * fieldErrors shape). `eligibleOnly` = chỉ đội ACTIVE (đội ngừng hoạt động
 * không nhận phân công mới).
 * ORG-05 — kèm enrichment leaderName/memberCount (1 query batch).
 */
@Injectable()
export class SearchCrewsUseCase {
  constructor(@Inject(CREW_REPOSITORY) private readonly crewRepo: CrewRepositoryPort) {}

  async execute(input: SearchCrewsInput): Promise<SearchCrewsOutput> {
    if (input.status && !['ACTIVE', 'INACTIVE'].includes(input.status)) {
      fieldError('status', 'Trạng thái không hợp lệ');
    }
    if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100)) {
      fieldError('limit', 'Limit không hợp lệ (1-100)');
    }
    if (input.offset !== undefined && (!Number.isInteger(input.offset) || input.offset < 0)) {
      fieldError('offset', 'Offset không hợp lệ (phải >= 0)');
    }
    if (input.sort !== undefined && !['name', 'createdAt'].includes(input.sort)) {
      fieldError('sort', 'Sort không hợp lệ (name|createdAt)');
    }
    if (input.order !== undefined && !['asc', 'desc'].includes(input.order)) {
      fieldError('order', 'Order không hợp lệ (asc|desc)');
    }
    if (input.eligibleOnly && input.status === 'INACTIVE') {
      fieldError('eligibleOnly', 'Không thể lọc eligibleOnly với INACTIVE');
    }

    const filter: CrewFilter = {
      status: input.eligibleOnly ? 'ACTIVE' : input.status,
      search: input.search,
      sort: input.sort,
      order: input.order,
      limit: input.limit,
      offset: input.offset,
    };

    const { entities, total } = await this.crewRepo.findMany(filter);
    const enrichments = await this.crewRepo.findListEnrichments(entities.map((e) => e.id));
    return { entities, total, enrichments };
  }
}
