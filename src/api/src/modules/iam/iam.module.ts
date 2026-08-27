import { Module } from '@nestjs/common';
import { AuthController } from './api/rest/controller/auth.controller';
import { LoginUseCase } from './application/use-case/login.use-case';
import { LogoutUseCase } from './application/use-case/logout.use-case';
import { PgUserRepository } from './infrastructure/database/pg-user.repository';
import { PgAuditRepository } from './infrastructure/database/pg-audit.repository';
import { BcryptHasherService } from './infrastructure/security/bcrypt-hasher.service';
import { JwtTokenService } from './infrastructure/security/jwt-token.service';
import { USER_REPOSITORY } from './domain/repository/user-repository.port';
import { HASHER_PORT } from './application/port/hasher.port';
import { TOKEN_PORT } from './application/port/token.port';
import { AUDIT_PORT } from './application/port/audit.port';
import { TOKEN_REVOCATION_PORT } from './application/port/token-revocation.port';
import { InMemoryTokenRevocationService } from './infrastructure/security/in-memory-token-revocation.service';
import { JwtAuthGuard } from './api/rest/guard/jwt-auth.guard';

@Module({
  controllers: [AuthController],
  providers: [
    LoginUseCase,
    LogoutUseCase,
    JwtTokenService,
    JwtAuthGuard,
    { provide: USER_REPOSITORY, useClass: PgUserRepository },
    { provide: HASHER_PORT, useClass: BcryptHasherService },
    { provide: TOKEN_PORT, useClass: JwtTokenService },
    { provide: AUDIT_PORT, useClass: PgAuditRepository },
    { provide: TOKEN_REVOCATION_PORT, useClass: InMemoryTokenRevocationService },
  ],
  exports: [JwtAuthGuard, JwtTokenService, USER_REPOSITORY, TOKEN_PORT],
})
export class IamModule {}
