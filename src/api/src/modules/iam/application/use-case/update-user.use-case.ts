import { Inject, Injectable, NotFoundException, ConflictException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { USER_REPOSITORY, UserRepositoryPort } from '../../domain/repository/user-repository.port';
import { AUDIT_PORT, AuditPort } from '../port/audit.port';
import { UserEntity } from '../../domain/entity/user.entity';

function isUniqueViolationError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const err = e as Record<string, unknown>;
  if (err['code'] === '23505') return true;
  const constraint = String(err['constraint'] ?? '');
  if (/ux_users/i.test(constraint)) return true;
  const msg = String((err['message'] as string) ?? '');
  if (/duplicate key|unique constraint|23505|ux_users/i.test(msg)) return true;
  const detail = String((err['detail'] as string) ?? '');
  if (/already exists/i.test(detail)) return true;
  return false;
}

function mapUniqueViolation(e: unknown): string {
  const err = e as Record<string, unknown>;
  const constraint = String(err['constraint'] ?? '');
  const detail = String((err['detail'] as string) ?? err['message'] ?? '');
  if (/ux_users_email_lower/i.test(constraint) || /lower\(email\)/i.test(detail)) return 'Email đã tồn tại';
  if (/ux_users_phone/i.test(constraint) || /\(phone\)/i.test(detail)) return 'Số điện thoại đã tồn tại';
  if (/ux_users_employee_code/i.test(constraint) || /\(employee_code\)/i.test(detail)) return 'Mã nhân viên đã tồn tại';
  if (/employee_code/i.test(detail)) return 'Mã nhân viên đã tồn tại';
  if (/phone/i.test(detail)) return 'Số điện thoại đã tồn tại';
  return 'Email đã tồn tại';
}

export interface UpdateUserInput {
  targetUserId: string;
  email?: string;
  fullName?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  employeeCode?: string | null;
  userType?: 'STAFF' | 'WORKER';
  contractorId?: string | null;
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface UpdateUserOutput {
  entity: UserEntity;
}

@Injectable()
export class UpdateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
  ) {}

  async execute(input: UpdateUserInput): Promise<UpdateUserOutput> {
    const user = await this.userRepo.findById(input.targetUserId);
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    const before = user.toPublicProfile();

    // Uniqueness checks before domain mutation
    if (input.email !== undefined) {
      const normalized = input.email.trim().toLowerCase();
      const existing = await this.userRepo.findByEmail(normalized);
      if (existing && existing.id !== input.targetUserId) {
        throw new ConflictException('Email đã tồn tại');
      }
    }

    if (input.employeeCode !== undefined && input.employeeCode !== null && input.employeeCode !== '') {
      if (this.userRepo.findByEmployeeCode) {
        const byCode = await this.userRepo.findByEmployeeCode(input.employeeCode.trim());
        if (byCode && byCode.id !== input.targetUserId) {
          throw new ConflictException('Mã nhân viên đã tồn tại');
        }
      }
    }

    try {
      user.updateAdmin(
        {
          email: input.email,
          fullName: input.fullName,
          phone: input.phone,
          avatarUrl: input.avatarUrl,
          employeeCode: input.employeeCode,
          userType: input.userType,
          contractorId: input.contractorId,
        },
        new Date(),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Dữ liệu không hợp lệ';
      throw new BadRequestException(msg);
    }

    try {
      await this.userRepo.save(user);
    } catch (e) {
      if (e instanceof ConflictException) throw e;
      if (isUniqueViolationError(e)) {
        throw new ConflictException(mapUniqueViolation(e));
      }
      throw e;
    }

    const after = user.toPublicProfile();

    try {
      await this.audit.log({
        actorUserId: input.actorUserId,
        action: 'IAM_USER_UPDATED',
        entityType: 'USER',
        entityId: input.targetUserId,
        beforeData: before,
        afterData: after,
        result: 'SUCCESS',
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      });
    } catch (e) {
      if (e instanceof ConflictException || e instanceof BadRequestException) throw e;
      throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
    }

    return { entity: user };
  }
}
