import { Module } from '@nestjs/common';
import { AuthController } from './api/rest/controller/auth.controller';
import { ProfileController } from './api/rest/controller/profile.controller';
import { AdminController } from './api/rest/controller/admin.controller';
import { AdminRolesController } from './api/rest/controller/admin-roles.controller';
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
import { PgUserRepository } from './infrastructure/database/pg-user.repository';
import { PgRoleRepository } from './infrastructure/database/pg-role.repository';
import { PgAuditRepository } from './infrastructure/database/pg-audit.repository';
import { PgTransactionManager } from './infrastructure/database/pg-transaction.manager';
import { BcryptHasherService } from './infrastructure/security/bcrypt-hasher.service';
import { JwtTokenService } from './infrastructure/security/jwt-token.service';
import { USER_REPOSITORY } from './domain/repository/user-repository.port';
import { ROLE_REPOSITORY } from './domain/repository/role-repository.port';
import { HASHER_PORT } from './application/port/hasher.port';
import { TOKEN_PORT } from './application/port/token.port';
import { AUDIT_PORT } from './application/port/audit.port';
import { TRANSACTION_PORT } from './application/port/transaction.port';
import { TOKEN_REVOCATION_PORT } from './application/port/token-revocation.port';
import { InMemoryTokenRevocationService } from './infrastructure/security/in-memory-token-revocation.service';
import { JwtAuthGuard } from './api/rest/guard/jwt-auth.guard';

@Module({
  controllers: [AuthController, ProfileController, AdminController, AdminRolesController],
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
    JwtTokenService,
    JwtAuthGuard,
    { provide: USER_REPOSITORY, useClass: PgUserRepository },
    { provide: ROLE_REPOSITORY, useClass: PgRoleRepository },
    { provide: HASHER_PORT, useClass: BcryptHasherService },
    { provide: TOKEN_PORT, useClass: JwtTokenService },
    { provide: AUDIT_PORT, useClass: PgAuditRepository },
    { provide: TRANSACTION_PORT, useClass: PgTransactionManager },
    { provide: TOKEN_REVOCATION_PORT, useClass: InMemoryTokenRevocationService },
  ],
  exports: [JwtAuthGuard, JwtTokenService, USER_REPOSITORY, ROLE_REPOSITORY, TOKEN_PORT],
})
export class IamModule {}
