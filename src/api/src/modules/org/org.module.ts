import { Module } from '@nestjs/common';
import { WorkersController } from './api/rest/controller/workers.controller';
import { ContractorsController } from './api/rest/controller/contractors.controller';
import { TradesController } from './api/rest/controller/trades.controller';
import { CrewsController } from './api/rest/controller/crews.controller';
import { CreateWorkerUseCase } from './application/use-case/create-worker.use-case';
import { UpdateWorkerUseCase } from './application/use-case/update-worker.use-case';
import { GetWorkerUseCase } from './application/use-case/get-worker.use-case';
import { SearchWorkersUseCase } from './application/use-case/search-workers.use-case';
import { CreateContractorUseCase } from './application/use-case/create-contractor.use-case';
import { UpdateContractorUseCase } from './application/use-case/update-contractor.use-case';
import { GetContractorUseCase } from './application/use-case/get-contractor.use-case';
import { SearchContractorsUseCase } from './application/use-case/search-contractors.use-case';
import { CreateTradeUseCase } from './application/use-case/create-trade.use-case';
import { UpdateTradeUseCase } from './application/use-case/update-trade.use-case';
import { ChangeTradeStatusUseCase } from './application/use-case/change-trade-status.use-case';
import { GetTradeUseCase } from './application/use-case/get-trade.use-case';
import { SearchTradesUseCase } from './application/use-case/search-trades.use-case';
import { StatusTransitionWorkerUseCase } from './application/use-case/status-transition-worker.use-case';
import { StatusTransitionContractorUseCase } from './application/use-case/status-transition-contractor.use-case';
import { StatusTransitionCrewUseCase } from './application/use-case/status-transition-crew.use-case';
import { CreateCrewUseCase } from './application/use-case/create-crew.use-case';
import { UpdateCrewUseCase } from './application/use-case/update-crew.use-case';
import { GetCrewUseCase } from './application/use-case/get-crew.use-case';
import { SearchCrewsUseCase } from './application/use-case/search-crews.use-case';
import { GetCrewOpenWorkUseCase } from './application/use-case/get-crew-open-work.use-case';
import { AddCrewMemberUseCase } from './application/use-case/add-crew-member.use-case';
import { RemoveCrewMemberUseCase } from './application/use-case/remove-crew-member.use-case';
import { ListCrewMembersUseCase } from './application/use-case/list-crew-members.use-case';
import { GetWorkerOpenWorkUseCase } from './application/use-case/get-worker-open-work.use-case';
import { GetContractorOpenWorkUseCase } from './application/use-case/get-contractor-open-work.use-case';
import { PgWorkerRepository } from './infrastructure/database/pg-worker.repository';
import { PgTradeRepository } from './infrastructure/database/pg-trade.repository';
import { PgContractorRepository } from './infrastructure/database/pg-contractor.repository';
import { PgCrewRepository } from './infrastructure/database/pg-crew.repository';
import { WORKER_REPOSITORY } from './domain/repository/worker-repository.port';
import { TRADE_REPOSITORY } from './domain/repository/trade-repository.port';
import { CONTRACTOR_REPOSITORY } from './domain/repository/contractor-repository.port';
import { CREW_REPOSITORY } from './domain/repository/crew-repository.port';
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

@Module({
  controllers: [WorkersController, ContractorsController, TradesController, CrewsController],
  providers: [
    CreateWorkerUseCase,
    UpdateWorkerUseCase,
    GetWorkerUseCase,
    SearchWorkersUseCase,
    CreateContractorUseCase,
    UpdateContractorUseCase,
    GetContractorUseCase,
    SearchContractorsUseCase,
    CreateTradeUseCase,
    UpdateTradeUseCase,
    ChangeTradeStatusUseCase,
    GetTradeUseCase,
    SearchTradesUseCase,
    StatusTransitionWorkerUseCase,
    StatusTransitionContractorUseCase,
    StatusTransitionCrewUseCase,
    CreateCrewUseCase,
    UpdateCrewUseCase,
    GetCrewUseCase,
    SearchCrewsUseCase,
    GetCrewOpenWorkUseCase,
    AddCrewMemberUseCase,
    RemoveCrewMemberUseCase,
    ListCrewMembersUseCase,
    GetWorkerOpenWorkUseCase,
    GetContractorOpenWorkUseCase,
    JwtAuthGuard,
    JwtTokenService,
    { provide: WORKER_REPOSITORY, useClass: PgWorkerRepository },
    { provide: TRADE_REPOSITORY, useClass: PgTradeRepository },
    { provide: CONTRACTOR_REPOSITORY, useClass: PgContractorRepository },
    { provide: CREW_REPOSITORY, useClass: PgCrewRepository },
    { provide: AUDIT_PORT, useClass: PgAuditRepository },
    { provide: TRANSACTION_PORT, useClass: PgTransactionManager },
    { provide: HASHER_PORT, useClass: BcryptHasherService },
    { provide: TOKEN_PORT, useClass: JwtTokenService },
    // TOKEN_REVOCATION_PORT is provided app-wide by TokenRevocationModule (shared singleton)
    { provide: USER_REPOSITORY, useClass: PgUserRepository },
  ],
})
export class OrgModule {}
