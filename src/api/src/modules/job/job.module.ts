import { Module } from '@nestjs/common';
import { WorkOrdersController } from './api/rest/controller/work-orders.controller';
import { CreateWorkOrderUseCase } from './application/use-case/create-work-order.use-case';
import { GetWorkOrderUseCase } from './application/use-case/get-work-order.use-case';
import { PgWorkOrderRepository } from './infrastructure/database/pg-work-order.repository';
import { JOB_WORK_ORDER_REPOSITORY } from './domain/repository/work-order-repository.port';
import { PgAuditRepository } from '../iam/infrastructure/database/pg-audit.repository';
import { PgTransactionManager } from '../iam/infrastructure/database/pg-transaction.manager';
import { BcryptHasherService } from '../iam/infrastructure/security/bcrypt-hasher.service';
import { JwtTokenService } from '../iam/infrastructure/security/jwt-token.service';
import { JwtAuthGuard } from '../iam/api/rest/guard/jwt-auth.guard';
import { AUDIT_PORT } from '../iam/application/port/audit.port';
import { TRANSACTION_PORT } from '../iam/application/port/transaction.port';
import { HASHER_PORT } from '../iam/application/port/hasher.port';
import { TOKEN_PORT } from '../iam/application/port/token.port';
import { PgUserRepository } from '../iam/infrastructure/database/pg-user.repository';
import { USER_REPOSITORY } from '../iam/domain/repository/user-repository.port';
import { IamModule } from '../iam/iam.module';

/**
 * JOB-SRS-001 (issue #41) — job module (clean architecture, mirror prj module).
 * Sở hữu `POST`/`GET /api/v1/work-orders` (tạo nháp + đọc chi tiết).
 * Scope qua `ProjectScopeService` dùng chung (import `IamModule` — mirror
 * `PrjModule`): write = ADMIN bypass hoặc ACTIVE member MANAGER/COORDINATOR;
 * read = ADMIN bypass hoặc bất kỳ ACTIVE member nào (kể cả WORKER).
 * Gán người thực hiện / job board thuộc slice sau (#42/#44) — không endpoint
 * ở đây. Chi tiết xem ENDPOINTS.md §17.
 */
@Module({
  imports: [IamModule],
  controllers: [WorkOrdersController],
  providers: [
    CreateWorkOrderUseCase,
    GetWorkOrderUseCase,
    JwtAuthGuard,
    JwtTokenService,
    { provide: JOB_WORK_ORDER_REPOSITORY, useClass: PgWorkOrderRepository },
    { provide: AUDIT_PORT, useClass: PgAuditRepository },
    { provide: TRANSACTION_PORT, useClass: PgTransactionManager },
    { provide: HASHER_PORT, useClass: BcryptHasherService },
    { provide: TOKEN_PORT, useClass: JwtTokenService },
    // TOKEN_REVOCATION_PORT is provided app-wide by TokenRevocationModule (shared singleton)
    { provide: USER_REPOSITORY, useClass: PgUserRepository },
  ],
})
export class JobModule {}
