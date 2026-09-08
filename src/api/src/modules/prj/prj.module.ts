import { Module } from '@nestjs/common';
import { PrjProjectsController } from './api/rest/controller/projects.controller';
import { WorkTypesController } from './api/rest/controller/work-types.controller';
import { WorkOrderTemplatesController } from './api/rest/controller/work-order-templates.controller';
import { CreateProjectUseCase } from './application/use-case/create-project.use-case';
import { UpdateProjectUseCase } from './application/use-case/update-project.use-case';
import { TransitionProjectStatusUseCase } from './application/use-case/transition-project-status.use-case';
import { AddProjectMemberUseCase } from './application/use-case/add-project-member.use-case';
import { RemoveProjectMemberUseCase } from './application/use-case/remove-project-member.use-case';
import { ListProjectMembersUseCase } from './application/use-case/list-project-members.use-case';
import { CreateProjectAreaUseCase } from './application/use-case/create-project-area.use-case';
import { UpdateProjectAreaUseCase } from './application/use-case/update-project-area.use-case';
import { ListProjectAreasUseCase } from './application/use-case/list-project-areas.use-case';
import { CreateWorkTypeUseCase } from './application/use-case/create-work-type.use-case';
import { SearchWorkTypesUseCase } from './application/use-case/search-work-types.use-case';
import { GetWorkTypeUseCase } from './application/use-case/get-work-type.use-case';
import { UpdateWorkTypeUseCase } from './application/use-case/update-work-type.use-case';
import { ChangeWorkTypeStatusUseCase } from './application/use-case/change-work-type-status.use-case';
import { ListActiveWorkTypesUseCase } from './application/use-case/list-active-work-types.use-case';
import { CreateWorkOrderTemplateUseCase } from './application/use-case/create-work-order-template.use-case';
import { SearchWorkOrderTemplatesUseCase } from './application/use-case/search-work-order-templates.use-case';
import { GetWorkOrderTemplateUseCase } from './application/use-case/get-work-order-template.use-case';
import { UpdateWorkOrderTemplateUseCase } from './application/use-case/update-work-order-template.use-case';
import { ChangeWorkOrderTemplateStatusUseCase } from './application/use-case/change-work-order-template-status.use-case';
import { ListActiveWorkOrderTemplatesUseCase } from './application/use-case/list-active-work-order-templates.use-case';
import { PgProjectRepository } from './infrastructure/database/pg-project.repository';
import { PgWorkTypeRepository } from './infrastructure/database/pg-work-type.repository';
import { PgWorkOrderTemplateRepository } from './infrastructure/database/pg-work-order-template.repository';
import { PRJ_PROJECT_REPOSITORY, PRJ_PROJECT_AREA_REPOSITORY } from './domain/repository/project-repository.port';
import { PRJ_WORK_TYPE_REPOSITORY } from './domain/repository/work-type-repository.port';
import { PRJ_WORK_ORDER_TEMPLATE_REPOSITORY } from './domain/repository/work-order-template-repository.port';
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
 * PRJ-SRS-001 (issue #32) — prj module (clean architecture, mirror org module).
 * Sở hữu POST/PATCH projects; reads ở lại iam (scope-integrated) — xem
 * ENDPOINTS.md §10. Fine-grained project-scope write checks defer #37.
 * PRJ-SRS-004 (issue #35) — thêm catalog loại công việc (`WorkTypesController`,
 * xem ENDPOINTS.md §14); roles read+write = ADMIN + PROJECT_MANAGER.
 * PRJ-SRS-006 (issue #37) — import `IamModule` để dùng chung singleton
 * `ProjectScopeService` (API scope chung iam+prj); work-types là catalog toàn
 * cục, KHÔNG qua scope này.
 * PRJ-SRS-008 (issue #39) — thêm catalog mẫu công việc
 * (`WorkOrderTemplatesController`, xem ENDPOINTS.md §16); roles read+write =
 * ADMIN + PROJECT_MANAGER (mirror work-types #35).
 */
@Module({
  imports: [IamModule],
  controllers: [PrjProjectsController, WorkTypesController, WorkOrderTemplatesController],
  providers: [
    CreateProjectUseCase,
    UpdateProjectUseCase,
    TransitionProjectStatusUseCase,
    AddProjectMemberUseCase,
    RemoveProjectMemberUseCase,
    ListProjectMembersUseCase,
    CreateProjectAreaUseCase,
    UpdateProjectAreaUseCase,
    ListProjectAreasUseCase,
    CreateWorkTypeUseCase,
    SearchWorkTypesUseCase,
    GetWorkTypeUseCase,
    UpdateWorkTypeUseCase,
    ChangeWorkTypeStatusUseCase,
    ListActiveWorkTypesUseCase,
    CreateWorkOrderTemplateUseCase,
    SearchWorkOrderTemplatesUseCase,
    GetWorkOrderTemplateUseCase,
    UpdateWorkOrderTemplateUseCase,
    ChangeWorkOrderTemplateStatusUseCase,
    ListActiveWorkOrderTemplatesUseCase,
    JwtAuthGuard,
    JwtTokenService,
    { provide: PRJ_PROJECT_REPOSITORY, useClass: PgProjectRepository },
    { provide: PRJ_PROJECT_AREA_REPOSITORY, useClass: PgProjectRepository },
    { provide: PRJ_WORK_TYPE_REPOSITORY, useClass: PgWorkTypeRepository },
    { provide: PRJ_WORK_ORDER_TEMPLATE_REPOSITORY, useClass: PgWorkOrderTemplateRepository },
    { provide: AUDIT_PORT, useClass: PgAuditRepository },
    { provide: TRANSACTION_PORT, useClass: PgTransactionManager },
    { provide: HASHER_PORT, useClass: BcryptHasherService },
    { provide: TOKEN_PORT, useClass: JwtTokenService },
    // TOKEN_REVOCATION_PORT is provided app-wide by TokenRevocationModule (shared singleton)
    { provide: USER_REPOSITORY, useClass: PgUserRepository },
  ],
})
export class PrjModule {}
