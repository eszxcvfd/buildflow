import { Module } from '@nestjs/common';
import { PrjProjectsController } from './api/rest/controller/projects.controller';
import { CreateProjectUseCase } from './application/use-case/create-project.use-case';
import { UpdateProjectUseCase } from './application/use-case/update-project.use-case';
import { TransitionProjectStatusUseCase } from './application/use-case/transition-project-status.use-case';
import { AddProjectMemberUseCase } from './application/use-case/add-project-member.use-case';
import { RemoveProjectMemberUseCase } from './application/use-case/remove-project-member.use-case';
import { ListProjectMembersUseCase } from './application/use-case/list-project-members.use-case';
import { PgProjectRepository } from './infrastructure/database/pg-project.repository';
import { PRJ_PROJECT_REPOSITORY } from './domain/repository/project-repository.port';
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

/**
 * PRJ-SRS-001 (issue #32) — prj module (clean architecture, mirror org module).
 * Sở hữu POST/PATCH projects; reads ở lại iam (scope-integrated) — xem
 * ENDPOINTS.md §10. Fine-grained project-scope write checks defer #37.
 */
@Module({
  controllers: [PrjProjectsController],
  providers: [
    CreateProjectUseCase,
    UpdateProjectUseCase,
    TransitionProjectStatusUseCase,
    AddProjectMemberUseCase,
    RemoveProjectMemberUseCase,
    ListProjectMembersUseCase,
    JwtAuthGuard,
    JwtTokenService,
    { provide: PRJ_PROJECT_REPOSITORY, useClass: PgProjectRepository },
    { provide: AUDIT_PORT, useClass: PgAuditRepository },
    { provide: TRANSACTION_PORT, useClass: PgTransactionManager },
    { provide: HASHER_PORT, useClass: BcryptHasherService },
    { provide: TOKEN_PORT, useClass: JwtTokenService },
    // TOKEN_REVOCATION_PORT is provided app-wide by TokenRevocationModule (shared singleton)
    { provide: USER_REPOSITORY, useClass: PgUserRepository },
  ],
})
export class PrjModule {}
