import { Inject, Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { USER_REPOSITORY, UserRepositoryPort } from '../../domain/repository/user-repository.port';
import { AUDIT_PORT, AuditPort } from '../port/audit.port';
import { TRANSACTION_PORT, TransactionPort } from '../port/transaction.port';
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
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
  ) {}

  async execute(input: ChangeUserStatusInput): Promise<ChangeUserStatusOutput> {
    const user = await this.userRepo.findById(input.targetUserId);
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    const beforeStatus = user.status;
    const before = user.toPublicProfile();

    // Audit per IAM-SRS-008: log actor + timestamp + result
    let action = 'IAM_USER_STATUS_CHANGED';
    if (input.status === 'LOCKED' && beforeStatus !== 'LOCKED') action = 'IAM_USER_LOCKED';
    else if (input.status === 'ACTIVE' && beforeStatus === 'LOCKED') action = 'IAM_USER_UNLOCKED';
    else if (input.status === 'INACTIVE') action = 'IAM_USER_DEACTIVATED';
    else if (input.status === 'ACTIVE' && beforeStatus === 'INACTIVE') action = 'IAM_USER_REACTIVATED';

    await this.tx.withTransaction(async (client: PoolClient) => {
      // Domain mutation inside transaction for atomic rollback
      try {
        user.changeStatus(input.status, new Date());
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Trạng thái không hợp lệ';
        throw new BadRequestException(msg);
      }

      const after = user.toPublicProfile();

      if (this.userRepo.saveWithClient) {
        await this.userRepo.saveWithClient(client, user);
      } else {
        await this.userRepo.save(user);
      }

      try {
        const payload = {
          actorUserId: input.actorUserId,
          action,
          entityType: 'USER',
          entityId: input.targetUserId,
          beforeData: before,
          afterData: after,
          result: 'SUCCESS' as const,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
        };
        if (this.audit.logWithClient) {
          await this.audit.logWithClient(client, payload);
        } else {
          await this.audit.log(payload);
        }
      } catch (e) {
        if (e instanceof BadRequestException || e instanceof NotFoundException) throw e;
        throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
      }
    });

    return { entity: user };
  }
}
