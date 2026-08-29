import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { USER_REPOSITORY, UserRepositoryPort } from '../../domain/repository/user-repository.port';
import { ROLE_REPOSITORY, RoleRepositoryPort } from '../../domain/repository/role-repository.port';

export interface GetUserRolesInput {
  targetUserId: string;
  actorUserId: string;
  actorRoles: string[]; // server-derived, never trust UI
}

export interface GetUserRolesOutput {
  targetUserId: string;
  roles: Array<{ id: string; code: string; name: string }>;
  effectivePolicy: string; // documents session policy
}

@Injectable()
export class GetUserRolesUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepositoryPort,
    @Inject(ROLE_REPOSITORY) private readonly roleRepo: RoleRepositoryPort,
  ) {}

  async execute(input: GetUserRolesInput): Promise<GetUserRolesOutput> {
    // Server-side authorization: every operation checks admin privilege server-side
    if (!input.actorRoles.includes('ADMIN')) {
      throw new ForbiddenException('Không có quyền truy cập');
    }

    const user = await this.userRepo.findById(input.targetUserId);
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    // Use roleRepo if available, else fallback to userRepo
    let roles: Array<{ id: string; code: string; name: string }>;
    if (this.roleRepo.findActiveRolesByUserId) {
      roles = await this.roleRepo.findActiveRolesByUserId(input.targetUserId);
    } else {
      roles = await this.userRepo.findActiveRolesByUserId(input.targetUserId);
    }

    return {
      targetUserId: input.targetUserId,
      roles,
      // IAM-SRS-005 session policy: permission effective from next access
      effectivePolicy: 'PERMISSION_EFFECTIVE_NEXT_LOGIN',
    };
  }
}
