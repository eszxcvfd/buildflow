import { Inject, Injectable, ConflictException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PoolClient } from 'pg';
import { CONTRACTOR_REPOSITORY, ContractorRepositoryPort } from '../../domain/repository/contractor-repository.port';
import { AUDIT_PORT, AuditPort } from '../../../iam/application/port/audit.port';
import { TRANSACTION_PORT, TransactionPort } from '../../../iam/application/port/transaction.port';
import { ContractorEntity } from '../../domain/entity/contractor.entity';

export interface CreateContractorInput {
  code: string;
  name: string;
  contactName: string;
  phone?: string | null;
  email?: string | null;
  scope: string;
  status?: 'ACTIVE' | 'INACTIVE';
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface CreateContractorOutput {
  entity: ContractorEntity;
}

@Injectable()
export class CreateContractorUseCase {
  constructor(
    @Inject(CONTRACTOR_REPOSITORY) private readonly contractorRepo: ContractorRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
  ) {}

  async execute(input: CreateContractorInput): Promise<CreateContractorOutput> {
    const trimmedCode = input.code.trim();
    if (trimmedCode.length < 2 || trimmedCode.length > 50) {
      throw new BadRequestException('Mã nhà thầu phải từ 2 đến 50 ký tự');
    }
    if (!/^[A-Za-z0-9_-]+$/.test(trimmedCode)) {
      throw new BadRequestException('Mã nhà thầu chỉ cho phép chữ, số, _ và -');
    }

    const byCode = await this.contractorRepo.findByCode(trimmedCode);
    if (byCode) throw new ConflictException('Mã nhà thầu đã tồn tại');

    const trimmedName = input.name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 200) {
      throw new BadRequestException('Tên nhà thầu phải từ 2 đến 200 ký tự');
    }

    if (input.status && !['ACTIVE', 'INACTIVE'].includes(input.status)) {
      throw new BadRequestException('Trạng thái không hợp lệ');
    }

    // ORG-SRS-002 / issue #25: thiếu contact/scope phải reject (thiếu định danh/contact/scope)
    if (!input.contactName || String(input.contactName).trim().length === 0) {
      throw new BadRequestException('Thông tin liên hệ không được để trống');
    }
    if (input.contactName.trim().length > 150) {
      throw new BadRequestException('Tên liên hệ tối đa 150 ký tự');
    }
    if (!input.scope || String(input.scope).trim().length === 0) {
      throw new BadRequestException('Phạm vi công việc không được để trống');
    }
    if (input.scope.trim().length > 1000) {
      throw new BadRequestException('Phạm vi công việc tối đa 1000 ký tự');
    }

    const now = new Date();
    const id = randomUUID();

    let entity: ContractorEntity;
    try {
      entity = new ContractorEntity({
        id,
        code: trimmedCode,
        name: trimmedName,
        contactName: input.contactName,
        phone: input.phone ?? null,
        email: input.email ?? null,
        status: input.status ?? 'ACTIVE',
        scope: input.scope,
        createdBy: input.actorUserId,
        createdAt: now,
        updatedAt: now,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Dữ liệu không hợp lệ';
      throw new BadRequestException(msg);
    }

    await this.tx.withTransaction(async (client: PoolClient) => {
      try {
        if (this.contractorRepo.createWithClient) {
          await this.contractorRepo.createWithClient(client, entity);
        } else {
          await this.contractorRepo.create(entity);
        }
      } catch (e) {
        if (e instanceof ConflictException) throw e;
        const err = e as Record<string, unknown>;
        const code = String(err['code'] ?? '');
        const constraint = String(err['constraint'] ?? '');
        if (code === '23505' || /ux_contractors/i.test(constraint)) {
          throw new ConflictException('Mã nhà thầu đã tồn tại');
        }
        throw e;
      }

      try {
        const payload = {
          actorUserId: input.actorUserId,
          action: 'ORG_CONTRACTOR_CREATED',
          entityType: 'CONTRACTOR',
          entityId: id,
          afterData: entity.toPublic(),
          result: 'SUCCESS' as const,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
        };
        if (this.audit.logWithClient) await this.audit.logWithClient(client, payload);
        else await this.audit.log(payload);
      } catch (e) {
        if (e instanceof ConflictException || e instanceof BadRequestException) throw e;
        throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
      }
    });

    return { entity };
  }
}
