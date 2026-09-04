import { Module } from '@nestjs/common';
import { WorkersController } from './api/rest/controller/workers.controller';
import { ContractorsController } from './api/rest/controller/contractors.controller';
import { CreateWorkerUseCase } from './application/use-case/create-worker.use-case';
import { UpdateWorkerUseCase } from './application/use-case/update-worker.use-case';
import { GetWorkerUseCase } from './application/use-case/get-worker.use-case';
import { SearchWorkersUseCase } from './application/use-case/search-workers.use-case';
import { CreateContractorUseCase } from './application/use-case/create-contractor.use-case';
import { UpdateContractorUseCase } from './application/use-case/update-contractor.use-case';
import { GetContractorUseCase } from './application/use-case/get-contractor.use-case';
import { SearchContractorsUseCase } from './application/use-case/search-contractors.use-case';
import { PgWorkerRepository } from './infrastructure/database/pg-worker.repository';
import { PgTradeRepository } from './infrastructure/database/pg-trade.repository';
import { PgContractorRepository } from './infrastructure/database/pg-contractor.repository';
import { WORKER_REPOSITORY } from './domain/repository/worker-repository.port';
import { TRADE_REPOSITORY } from './domain/repository/trade-repository.port';
import { CONTRACTOR_REPOSITORY } from './domain/repository/contractor-repository.port';
import { PgAuditRepository } from '../iam/infrastructure/database/pg-audit.repository';
import { PgTransactionManager } from '../iam/infrastructure/database/pg-transaction.manager';
import { BcryptHasherService } from '../iam/infrastructure/security/bcrypt-hasher.service';
import { JwtTokenService } from '../iam/infrastructure/security/jwt-token.service';
import { JwtAuthGuard } from '../iam/api/rest/guard/jwt-auth.guard';
import { AUDIT_PORT } from '../iam/application/port/audit.port';
import { TRANSACTION_PORT } from '../iam/application/port/transaction.port';
import { HASHER_PORT } from '../iam/application/port/hasher.port';
import { TOKEN_PORT } from '../iam/application/port/token.port';
import { TOKEN_REVOCATION_PORT } from '../iam/application/port/token-revocation.port';
import { InMemoryTokenRevocationService } from '../iam/infrastructure/security/in-memory-token-revocation.service';
import { PgUserRepository } from '../iam/infrastructure/database/pg-user.repository';
import { USER_REPOSITORY } from '../iam/domain/repository/user-repository.port';

@Module({
  controllers: [WorkersController, ContractorsController],
  providers: [
    CreateWorkerUseCase,
    UpdateWorkerUseCase,
    GetWorkerUseCase,
    SearchWorkersUseCase,
    CreateContractorUseCase,
    UpdateContractorUseCase,
    GetContractorUseCase,
    SearchContractorsUseCase,
    JwtAuthGuard,
    JwtTokenService,
    { provide: WORKER_REPOSITORY, useClass: PgWorkerRepository },
    { provide: TRADE_REPOSITORY, useClass: PgTradeRepository },
    { provide: CONTRACTOR_REPOSITORY, useClass: PgContractorRepository },
    { provide: AUDIT_PORT, useClass: PgAuditRepository },
    { provide: TRANSACTION_PORT, useClass: PgTransactionManager },
    { provide: HASHER_PORT, useClass: BcryptHasherService },
    { provide: TOKEN_PORT, useClass: JwtTokenService },
    { provide: TOKEN_REVOCATION_PORT, useClass: InMemoryTokenRevocationService },
    { provide: USER_REPOSITORY, useClass: PgUserRepository },
  ],
})
export class OrgModule {}
