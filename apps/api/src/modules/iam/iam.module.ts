import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { USER_REPOSITORY } from './domain/repository/user.repository.port';
import { PrismaUserRepository } from './infrastructure/database/prisma-user.repository';
import { PrismaAuditRepository } from './infrastructure/database/prisma-audit.repository';
import { BcryptHasherService } from './infrastructure/security/bcrypt-hasher.service';
import { JwtTokenService } from './infrastructure/security/jwt-token.service';
import { InMemoryLoginLimiterService } from './infrastructure/security/in-memory-login-limiter.service';
import { HASHER_PORT } from './application/port/hasher.port';
import { TOKEN_PORT } from './application/port/token.port';
import { AUDIT_PORT } from './application/port/audit.port';
import { LOGIN_LIMITER_PORT } from './application/port/login-limiter.port';
import { LoginUseCase } from './application/use-case/login.use-case';
import { AuthController } from './api/rest/controller/auth.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [
    LoginUseCase,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: HASHER_PORT, useClass: BcryptHasherService },
    { provide: TOKEN_PORT, useClass: JwtTokenService },
    { provide: AUDIT_PORT, useClass: PrismaAuditRepository },
    { provide: LOGIN_LIMITER_PORT, useClass: InMemoryLoginLimiterService },
  ],
  exports: [],
})
export class IamModule {}
