import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { PROJECT_REPOSITORY, ProjectRepositoryPort } from '../../domain/repository/project-repository.port';
import { ProjectEntity } from '../../domain/entity/project.entity';
import { ProjectScopeService } from '../service/project-scope.service';

export interface ListProjectsInput {
  userId: string;
  actorRoles: string[];
  limit?: number;
  offset?: number;
}

export interface ListProjectsOutput {
  entities: ProjectEntity[];
  isAdminBypass: boolean;
}

@Injectable()
export class ListProjectsUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projectRepo: ProjectRepositoryPort,
    private readonly scope: ProjectScopeService,
  ) {}

  async execute(input: ListProjectsInput): Promise<ListProjectsOutput> {
    if (input.limit !== undefined) {
      if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100) {
        throw new BadRequestException('Limit không hợp lệ (1-100)');
      }
    }
    if (input.offset !== undefined) {
      if (!Number.isInteger(input.offset) || input.offset < 0) {
        throw new BadRequestException('Offset không hợp lệ (phải >= 0)');
      }
    }

    const accessibleIds = await this.scope.resolveAccessibleProjectIds({
      userId: input.userId,
      actorRoles: input.actorRoles,
    });

    const isAdminBypass = accessibleIds === null;

    if (accessibleIds !== null && accessibleIds.length === 0) {
      return { entities: [], isAdminBypass };
    }

    // Query at repository layer with scope filter — not post-filter in memory
    // If accessibleIds is null (admin), fetch all; otherwise filtered via repository
    let entities: ProjectEntity[];
    if (isAdminBypass) {
      entities = await this.projectRepo.findAll({ limit: input.limit, offset: input.offset });
    } else {
      // Fetch only member projects; repository handles filtering at query
      // For efficiency, fetch by IDs then paginate in memory if repository lacks filtered findAll
      // But we prefer to have repository support filtered query — here we fetch by IDs
      const all = await this.projectRepo.findByIds(accessibleIds!);
      // Sort by createdAt desc? repository already sorts, but ensure stable
      const limit = input.limit ?? 20;
      const offset = input.offset ?? 0;
      entities = all.slice(offset, offset + limit);
    }

    return { entities, isAdminBypass };
  }
}
