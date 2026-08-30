import { Inject, Injectable, NotFoundException, ConflictException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { CONTRACTOR_REPOSITORY, ContractorRepositoryPort } from '../../domain/repository/contractor-repository.port';
import { AUDIT_PORT, AuditPort } from '../../../iam/application/port/audit.port';
import { TRANSACTION_PORT, TransactionPort } from '../../../iam/application/port/transaction.port';

export interface UpdateContractorInput {
  contractorId: string;
  code?: string;
  name?: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  scope?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class UpdateContractorUseCase {
  constructor(
    @Inject(CONTRACTOR_REPOSITORY) private readonly contractorRepo: ContractorRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
  ) {}

  async execute(input: UpdateContractorInput): Promise<{ entity: import('../../domain/entity/contractor.entity').ContractorEntity }> {
    const contractor = await this.contractorRepo.findById(input.contractorId);
    if (!contractor) throw new NotFoundException('Không tìm thấy hồ sơ nhà thầu');

    const before = contractor.toPublic();

    if (input.code !== undefined) {
      const trimmed = input.code.trim();
      if (trimmed.length < 2 || trimmed.length > 50) throw new BadRequestException('Mã nhà thầu phải từ 2 đến 50 ký tự');
      if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) throw new BadRequestException('Mã nhà thầu chỉ cho phép chữ, số, _ và -');
      if (trimmed.toLowerCase() !== contractor.code.toLowerCase()) {
        const byCode = await this.contractorRepo.findByCode(trimmed);
        if (byCode && byCode.id !== input.contractorId) throw new ConflictException('Mã nhà thầu đã tồn tại');
      }
    }

    if (input.status !== undefined && !['ACTIVE', 'INACTIVE'].includes(input.status)) {
      throw new BadRequestException('Trạng thái không hợp lệ');
    }

    // ORG-SRS-002: warn if inactive contractor has history but still allow (don't hard delete)
    // If transitioning to INACTIVE, check hasHistory for warning audit
    let hasHistoryWarning = false;
    if (input.status === 'INACTIVE' && contractor.isActive()) {
      if (this.contractorRepo.hasHistory) {
        try {
          hasHistoryWarning = await this.contractorRepo.hasHistory(input.contractorId);
        } catch {
          hasHistoryWarning = false;
        }
      }
    }

    await this.tx.withTransaction(async (client: PoolClient) => {
      try {
        // Handle code change separately (need to mutate props)
        if (input.code !== undefined) {
          const trimmed = input.code.trim();
          // Directly update via entity props mutation for code (no dedicated method)
          // Validate via constructor logic; we set via internal props
          const props = contractor.getProps();
          props.code = trimmed;
          // Re-validate by creating temp entity
          const { ContractorEntity } = await import('../../domain/entity/contractor.entity');
          const tmp = new ContractorEntity({ ...props, updatedAt: new Date() });
          // apply back
          (contractor as unknown as { props: typeof props }).props = tmp.getProps();
        }

        if (input.name !== undefined || input.contactName !== undefined || input.phone !== undefined || input.email !== undefined || input.scope !== undefined) {
          try {
            contractor.updateDetails(
              {
                name: input.name,
                contactName: input.contactName,
                phone: input.phone,
                email: input.email,
                scope: input.scope,
              },
              new Date(),
            );
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Dữ liệu không hợp lệ';
            throw new BadRequestException(msg);
          }
        }

        if (input.status !== undefined && input.status !== contractor.status) {
          try {
            contractor.changeStatus(input.status as 'ACTIVE' | 'INACTIVE', new Date());
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Trạng thái không hợp lệ';
            throw new BadRequestException(msg);
          }
        } else if (input.status !== undefined && input.status === contractor.status) {
          throw new BadRequestException(`Nhà thầu đã ở trạng thái ${input.status}`);
        }
      } catch (e) {
        if (e instanceof BadRequestException || e instanceof ConflictException || e instanceof NotFoundException) throw e;
        const msg = e instanceof Error ? e.message : 'Dữ liệu không hợp lệ';
        throw new BadRequestException(msg);
      }

      try {
        if (this.contractorRepo.saveWithClient) await this.contractorRepo.saveWithClient(client, contractor);
        else await this.contractorRepo.save(contractor);
      } catch (e) {
        const err = e as Record<string, unknown>;
        const code = String(err['code'] ?? '');
        const constraint = String(err['constraint'] ?? '');
        if (code === '23505' || /ux_contractors/i.test(constraint)) {
          throw new ConflictException('Mã nhà thầu đã tồn tại');
        }
        throw e;
      }

      try {
        const payload: Record<string, unknown> = {
          actorUserId: input.actorUserId,
          action: input.status !== undefined && input.status !== before.status ? 'ORG_CONTRACTOR_STATUS_CHANGED' : 'ORG_CONTRACTOR_UPDATED',
          entityType: 'CONTRACTOR',
          entityId: input.contractorId,
          beforeData: before,
          afterData: contractor.toPublic(),
          result: 'SUCCESS' as const,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
        };
        if (hasHistoryWarning) {
          (payload.afterData as Record<string, unknown>)['_warning'] = 'Nhà thầu có lịch sử công việc, không xóa liên kết';
        }
        if (this.audit.logWithClient) await this.audit.logWithClient(client, payload as never);
        else await this.audit.log(payload as never);
      } catch (e) {
        if (e instanceof ConflictException || e instanceof BadRequestException) throw e;
        throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
      }
    });

    return { entity: contractor };
  }
}
