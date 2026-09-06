import { BadRequestException } from '@nestjs/common';
import { SearchCrewsUseCase } from './search-crews.use-case';
import { CrewRepositoryPort } from '../../domain/repository/crew-repository.port';
import { CrewEntity } from '../../domain/entity/crew.entity';

function makeCrew(id: string, status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE'): CrewEntity {
  return new CrewEntity({
    id,
    code: `CREW-${id.slice(0, 3)}`,
    name: `Đội ${id}`,
    status,
    createdBy: '22222222-2222-4222-8222-222222222222',
    createdAt: new Date('2026-08-26T00:00:00.000Z'),
    updatedAt: new Date('2026-08-27T00:00:00.000Z'),
  });
}

describe('SearchCrewsUseCase ORG-SRS-006 (issue #29)', () => {
  let repo: jest.Mocked<CrewRepositoryPort>;
  let useCase: SearchCrewsUseCase;

  beforeEach(() => {
    repo = {
      findById: jest.fn(),
      findByCode: jest.fn(),
      findMany: jest.fn(async () => ({ entities: [makeCrew('11111111-1111-4111-8111-111111111111')], total: 1 })),
      create: jest.fn(),
      save: jest.fn(),
      insertLeadWithClient: jest.fn(),
      deactivateActiveLeadWithClient: jest.fn(),
      countOpenAssignments: jest.fn(async () => 0),
    } as unknown as jest.Mocked<CrewRepositoryPort>;
    useCase = new SearchCrewsUseCase(repo);
  });

  it('filter status/search/sort/order/limit/offset forward đúng', async () => {
    await useCase.execute({ status: 'ACTIVE', search: 'alpha', sort: 'name', order: 'asc', limit: 10, offset: 5 });
    expect(repo.findMany).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ACTIVE', search: 'alpha', sort: 'name', order: 'asc', limit: 10, offset: 5,
    }));
  });

  it('eligibleOnly → status ACTIVE', async () => {
    await useCase.execute({ eligibleOnly: true });
    expect(repo.findMany).toHaveBeenCalledWith(expect.objectContaining({ status: 'ACTIVE' }));
  });

  it('eligibleOnly + INACTIVE → 400 fieldErrors', async () => {
    const err = await useCase.execute({ status: 'INACTIVE', eligibleOnly: true }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).getResponse()).toEqual({
      statusCode: 400,
      message: 'Không thể lọc eligibleOnly với INACTIVE',
      fieldErrors: { eligibleOnly: ['Không thể lọc eligibleOnly với INACTIVE'] },
    });
    expect(repo.findMany).not.toHaveBeenCalled();
  });

  it('status/sort/order/limit/offset sai → 400 fieldErrors shape', async () => {
    for (const input of [
      { status: 'LOCKED' },
      { sort: 'nope' as never },
      { order: 'nope' as never },
      { limit: 0 },
      { limit: 101 },
      { offset: -1 },
    ]) {
      const err = await useCase.execute(input).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      const res = (err as BadRequestException).getResponse() as { fieldErrors: unknown };
      expect(res.fieldErrors).toBeDefined();
    }
    expect(repo.findMany).not.toHaveBeenCalled();
  });
});
