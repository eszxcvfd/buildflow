import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { PROJECT_REPOSITORY, ProjectRepositoryPort } from '../../domain/repository/project-repository.port';
import { ProjectEntity } from '../../domain/entity/project.entity';
import { ProjectScopeService } from '../service/project-scope.service';
import { isValidUuid } from '../../domain/service/project-scope.policy';

export interface GetProjectInput {
  projectId: string;
  userId: string;
  actorRoles: string[];
  correlationId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface GetProjectOutput {
  entity: ProjectEntity;
  isAdminBypass: boolean;
}

@Injectable()
export class GetProjectUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projectRepo: ProjectRepositoryPort,
    private readonly scope: ProjectScopeService,
  ) {}

  async execute(input: GetProjectInput): Promise<GetProjectOutput> {
    if (!isValidUuid(input.projectId)) {
      throw new BadRequestException('Project ID không hợp lệ');
    }

    // Enforce scope at service layer before any query — prevents ID tampering
    const { isAdminBypass } = await this.scope.assertAccess({
      userId: input.userId,
      actorRoles: input.actorRoles,
      projectId: input.projectId,
      correlationId: input.correlationId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });

    const entity = await this.projectRepo.findById(input.projectId);
    if (!entity) {
      // Should not happen if scope passed for admin (we checked exists), but for safety
      throw new NotFoundException('Không tìm thấy dự án');
    }

    return { entity, isAdminBypass };
  }
}
