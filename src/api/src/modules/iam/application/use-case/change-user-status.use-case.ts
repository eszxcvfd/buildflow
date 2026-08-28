import { Inject, Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { USER_REPOSITORY, UserRepositoryPort } from '../../domain/repository/user-repository.port';
import { AUDIT_PORT, AuditPort } from '../port/audit.port';
import { UserEntity, UserStatus } from '../../domain/entity/user.entity';

export interface ChangeUserStatusInput {
  targetUserId: string;
  status: UserStatus;
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface ChangeUserStatusOutput {
  entity: UserEntity;
}

@Injectable()
export class ChangeUserStatusUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
  ) {}

  async execute(input: ChangeUserStatusInput): Promise<ChangeUserStatusOutput> {
    const user = await this.userRepo.findById(input.targetUserId);
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    const beforeStatus = user.status;
    const before = user.toPublicProfile();

    try {
      user.changeStatus(input.status, new Date());
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Trạng thái không hợp lệ';
      throw new BadRequestException(msg);
    }

    await this.userRepo.save(user);

    const after = user.toPublicProfile();

    // Audit per IAM-SRS-008: log actor + timestamp + result
    // Action naming: IAM_USER_LOCKED / UNLOCKED / DEACTIVATED / REACTIVATED
    let action = 'IAM_USER_STATUS_CHANGED';
    if (input.status === 'LOCKED' && beforeStatus !== 'LOCKED') action = 'IAM_USER_LOCKED';
    else if (input.status === 'ACTIVE' && beforeStatus === 'LOCKED') action = 'IAM_USER_UNLOCKED';
    else if (input.status === 'INACTIVE') action = 'IAM_USER_DEACTIVATED';
    else if (input.status === 'ACTIVE' && beforeStatus === 'INACTIVE') action = 'IAM_USER_REACTIVATED';

    try {
      await this.audit.log({
        actorUserId: input.actorUserId,
        action,
        entityType: 'USER',
        entityId: input.targetUserId,
        beforeData: before,
        afterData: after,
        result: 'SUCCESS',
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      });
    } catch (e) {
      if (e instanceof BadRequestException || e instanceof NotFoundException) throw e;
      throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
    }

    return { entity: user };
  }
}
