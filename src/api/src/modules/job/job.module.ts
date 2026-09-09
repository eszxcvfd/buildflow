import { Module } from '@nestjs/common';
import { WorkOrdersController } from './api/rest/controller/work-orders.controller';
import { JobBoardController } from './api/rest/controller/job-board.controller';
import { WorkOrderPublishCheckController } from './api/rest/controller/work-order-publish-check.controller';
import { CreateWorkOrderUseCase } from './application/use-case/create-work-order.use-case';
import { GetWorkOrderUseCase } from './application/use-case/get-work-order.use-case';
import { SearchWorkOrdersUseCase } from './application/use-case/search-work-orders.use-case';
import { SearchJobBoardUseCase } from './application/use-case/search-job-board.use-case';
import { UpdateWorkOrderUseCase } from './application/use-case/update-work-order.use-case';
import { CheckWorkOrderPublishUseCase } from './application/use-case/check-work-order-publish.use-case';
import { OpenWorkOrderJobBoardUseCase } from './application/use-case/open-work-order-job-board.use-case';
import { CloseWorkOrderJobBoardUseCase } from './application/use-case/close-work-order-job-board.use-case';
import { PgWorkOrderRepository } from './infrastructure/database/pg-work-order.repository';
import { JOB_WORK_ORDER_REPOSITORY } from './domain/repository/work-order-repository.port';
import { PgWorkOrderPublishCheckReadAdapter } from './infrastructure/database/pg-work-order-publish-check.read-adapter';
import { JOB_PUBLISH_CHECK_READ_PORT } from './domain/repository/work-order-publish-check.read-port';
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
 * JOB-SRS-003 (issue #43) — thêm `PATCH /api/v1/work-orders/:id` (state
 * policy + optimistic lock + audit/notification tx-embedded).
 * Scope qua `ProjectScopeService` dùng chung (import `IamModule` — mirror
 * `PrjModule`): write = ADMIN bypass hoặc ACTIVE member MANAGER/COORDINATOR;
 * read = ADMIN bypass hoặc bất kỳ ACTIVE member nào (kể cả WORKER).
 * Gán người thực hiện / job board thuộc slice sau (#42/#44) — không endpoint
 * ở đây. Chi tiết xem ENDPOINTS.md §17.
 * JOB-SRS-002 (issue #42) — thêm `GET /:id/publish-check` (advisory read-only,
 * read-port riêng, không đụng port/repo/entity/controller của #41/#43).
 */
@Module({
  imports: [IamModule],
  controllers: [WorkOrdersController, WorkOrderPublishCheckController, JobBoardController],
  providers: [
    CreateWorkOrderUseCase,
    GetWorkOrderUseCase,
    SearchWorkOrdersUseCase,
    SearchJobBoardUseCase,
    UpdateWorkOrderUseCase,
    CheckWorkOrderPublishUseCase,
    OpenWorkOrderJobBoardUseCase,
    CloseWorkOrderJobBoardUseCase,
    JwtAuthGuard,
    JwtTokenService,
    { provide: JOB_WORK_ORDER_REPOSITORY, useClass: PgWorkOrderRepository },
    { provide: JOB_PUBLISH_CHECK_READ_PORT, useClass: PgWorkOrderPublishCheckReadAdapter },
    { provide: AUDIT_PORT, useClass: PgAuditRepository },
    { provide: TRANSACTION_PORT, useClass: PgTransactionManager },
    { provide: HASHER_PORT, useClass: BcryptHasherService },
    { provide: TOKEN_PORT, useClass: JwtTokenService },
    // TOKEN_REVOCATION_PORT is provided app-wide by TokenRevocationModule (shared singleton)
    { provide: USER_REPOSITORY, useClass: PgUserRepository },
  ],
})
export class JobModule {}
