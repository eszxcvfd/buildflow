import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoginUseCase } from './application/use-case/login.use-case';
import { USER_REPOSITORY } from './domain/repository/user-repository.port';
import { SESSION_REPOSITORY } from './domain/repository/session-repository.port';
import { PrismaUserRepository } from './infrastructure/database/repository/prisma-user.repository';
import { PrismaSessionRepository } from './infrastructure/database/repository/prisma-session.repository';
import { AuthController } from './api/rest/auth.controller';
import { MeController } from './api/rest/me.controller';
import { BearerAuthGuard } from './api/guard/bearer-auth.guard';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController, MeController],
  providers: [
    LoginUseCase,
    BearerAuthGuard,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: SESSION_REPOSITORY, useClass: PrismaSessionRepository },
  ],
  exports: [BearerAuthGuard, USER_REPOSITORY, SESSION_REPOSITORY],
})
export class AuthModule {}
