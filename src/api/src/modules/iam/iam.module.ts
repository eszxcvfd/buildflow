import { Module } from '@nestjs/common';
import { AuthController } from './api/rest/controller/auth.controller';
import { ProfileController } from './api/rest/controller/profile.controller';
import { AdminController } from './api/rest/controller/admin.controller';
import { AdminRolesController } from './api/rest/controller/admin-roles.controller';
import { ProjectsController } from './api/rest/controller/projects.controller';
import { AuditController } from './api/rest/controller/audit.controller';
import { PasswordController } from './api/rest/controller/password.controller';
import { LoginUseCase } from './application/use-case/login.use-case';
import { LogoutUseCase } from './application/use-case/logout.use-case';
import { GetProfileUseCase } from './application/use-case/get-profile.use-case';
import { UpdateProfileUseCase } from './application/use-case/update-profile.use-case';
import { CreateUserUseCase } from './application/use-case/create-user.use-case';
import { UpdateUserUseCase } from './application/use-case/update-user.use-case';
import { ChangeUserStatusUseCase } from './application/use-case/change-user-status.use-case';
import { ListUsersUseCase, GetUserUseCase } from './application/use-case/list-users.use-case';
import { GetUserRolesUseCase } from './application/use-case/get-user-roles.use-case';
import { AssignRolesUseCase } from './application/use-case/assign-roles.use-case';
import { GetProjectUseCase } from './application/use-case/get-project.use-case';
import { ListProjectsUseCase } from './application/use-case/list-projects.use-case';
import { QueryAuditLogsUseCase } from './application/use-case/query-audit-logs.use-case';
import { ChangePasswordUseCase } from './application/use-case/change-password.use-case';
import { RequestPasswordResetUseCase } from './application/use-case/request-password-reset.use-case';
import { ResetPasswordUseCase } from './application/use-case/reset-password.use-case';
import { ProjectScopeService } from './application/service/project-scope.service';
import { PgUserRepository } from './infrastructure/database/pg-user.repository';
import { PgRoleRepository } from './infrastructure/database/pg-role.repository';
import { PgAuditRepository } from './infrastructure/database/pg-audit.repository';
import { PgTransactionManager } from './infrastructure/database/pg-transaction.manager';
import { PgProjectRepository } from './infrastructure/database/pg-project.repository';
import { PgProjectMembershipRepository } from './infrastructure/database/pg-project-membership.repository';
import { PgAuditLogRepository } from './infrastructure/database/pg-audit-log.repository';
import { PgPasswordResetRepository } from './infrastructure/database/pg-password-reset.repository';
import { BcryptHasherService } from './infrastructure/security/bcrypt-hasher.service';
import { JwtTokenService } from './infrastructure/security/jwt-token.service';
import { USER_REPOSITORY } from './domain/repository/user-repository.port';
import { ROLE_REPOSITORY } from './domain/repository/role-repository.port';
import { PROJECT_REPOSITORY } from './domain/repository/project-repository.port';
import { PROJECT_MEMBERSHIP_REPOSITORY } from './domain/repository/project-membership-repository.port';
import { AUDIT_LOG_REPOSITORY } from './domain/repository/audit-log-repository.port';
import { HASHER_PORT } from './application/port/hasher.port';
import { TOKEN_PORT } from './application/port/token.port';
import { AUDIT_PORT } from './application/port/audit.port';
import { TRANSACTION_PORT } from './application/port/transaction.port';
import { PASSWORD_RESET_REPOSITORY } from './domain/repository/password-reset.repository.port';
import { JwtAuthGuard } from './api/rest/guard/jwt-auth.guard';

@Module({
  controllers: [AuthController, ProfileController, AdminController, AdminRolesController, ProjectsController, AuditController, PasswordController],
  providers: [
    LoginUseCase,
    LogoutUseCase,
    GetProfileUseCase,
    UpdateProfileUseCase,
    CreateUserUseCase,
    UpdateUserUseCase,
    ChangeUserStatusUseCase,
    ListUsersUseCase,
    GetUserUseCase,
    GetUserRolesUseCase,
    AssignRolesUseCase,
    GetProjectUseCase,
    ListProjectsUseCase,
    QueryAuditLogsUseCase,
    ChangePasswordUseCase,
    RequestPasswordResetUseCase,
    ResetPasswordUseCase,
    ProjectScopeService,
    JwtTokenService,
    JwtAuthGuard,
    { provide: USER_REPOSITORY, useClass: PgUserRepository },
    { provide: ROLE_REPOSITORY, useClass: PgRoleRepository },
    { provide: PROJECT_REPOSITORY, useClass: PgProjectRepository },
    { provide: PROJECT_MEMBERSHIP_REPOSITORY, useClass: PgProjectMembershipRepository },
    { provide: AUDIT_LOG_REPOSITORY, useClass: PgAuditLogRepository },
    { provide: PASSWORD_RESET_REPOSITORY, useClass: PgPasswordResetRepository },
    { provide: HASHER_PORT, useClass: BcryptHasherService },
    { provide: TOKEN_PORT, useClass: JwtTokenService },
    { provide: AUDIT_PORT, useClass: PgAuditRepository },
    { provide: TRANSACTION_PORT, useClass: PgTransactionManager },
    // TOKEN_REVOCATION_PORT is provided app-wide by TokenRevocationModule (shared singleton)
  ],
  exports: [JwtAuthGuard, JwtTokenService, USER_REPOSITORY, ROLE_REPOSITORY, TOKEN_PORT],
})
export class IamModule {}
