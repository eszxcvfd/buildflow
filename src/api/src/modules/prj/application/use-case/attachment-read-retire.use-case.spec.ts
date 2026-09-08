import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  ListAttachmentsUseCase,
  DownloadAttachmentUseCase,
  RetireAttachmentUseCase,
} from './attachment-read-retire.use-case';
import { AttachmentEntity } from '../../domain/entity/attachment.entity';

// PRJ-SRS-009 (issue #40) — read/retire use-case unit: permissions,
// scope-bind, retire idempotent, audit fail 500.

const P1 = '22222222-2222-4222-8222-222222222222';
const P2 = '99999999-9999-4999-8999-999999999999';
const PM_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const WORKER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ATT_ID = '11111111-1111-4111-8111-111111111111';

function makeEntity(over: Partial<Record<string, unknown>> = {}): AttachmentEntity {
  return new AttachmentEntity({
    id: ATT_ID,
    projectId: P1,
    workOrderId: null,
    ownerType: 'PROJECT',
    ownerId: P1,
    attachmentType: 'DOCUMENT',
    uploadedBy: PM_ID,
    fileName: 'a.jpg',
    storageKey: `${P1}/uuid-a.jpg`,
    mimeType: 'image/jpeg',
    sizeBytes: 8,
    caption: null,
    isActive: true,
    deactivatedAt: null,
    deactivatedBy: null,
    deactivateReason: null,
    requestKey: null,
    createdAt: new Date(),
    ...(over as object),
  } as never);
}

function setup(overrides: {
  memberScope?: (projectId: string) => Promise<unknown>;
  writeScope?: (projectId: string) => Promise<unknown>;
  byId?: AttachmentEntity | null;
  alreadyInactive?: boolean;
  auditImpl?: () => Promise<unknown>;
  storageImpl?: () => Promise<Buffer>;
} = {}) {
  const mockRepo = {
    findById: jest.fn(async () => overrides.byId ?? null),
    findByRequestKey: jest.fn(async () => null),
    listByProjectId: jest.fn(async () => [makeEntity()]),
    listByWorkOrderId: jest.fn(async () => []),
    findWorkOrderProjectById: jest.fn(async () => null),
    create: jest.fn(async () => {}),
    retireWithClient: jest.fn(async (_c: unknown, _id: string, input: { deactivatedBy: string; deactivatedAt: Date; reason: string | null }) => {
      if (overrides.alreadyInactive) return { entity: makeEntity({ isActive: false, deactivatedAt: new Date() }), alreadyInactive: true };
      return {
        entity: makeEntity({ isActive: false, deactivatedAt: input.deactivatedAt, deactivatedBy: input.deactivatedBy, deactivateReason: input.reason }),
        alreadyInactive: false,
      };
    }),
  };
  const mockStorage = {
    save: jest.fn(async () => 'k'),
    read: jest.fn(overrides.storageImpl ?? (async () => Buffer.from([1, 2, 3]))),
    remove: jest.fn(async () => {}),
  };
  const mockScope = {
    assertProjectWriteScope: jest.fn(async ({ projectId }: { projectId: string }) => {
      if (overrides.writeScope) return overrides.writeScope(projectId);
      return { isAdminBypass: false };
    }),
    assertProjectMemberScope: jest.fn(async ({ projectId }: { projectId: string }) => {
      if (overrides.memberScope) return overrides.memberScope(projectId);
      return { isAdminBypass: false };
    }),
  };
  const mockAudit = {
    log: jest.fn(async () => {}),
    logWithClient: jest.fn(overrides.auditImpl ?? (async () => {})),
  };
  const mockTx = {
    withTransaction: jest.fn(async (fn: (c: unknown) => Promise<unknown>) => fn({})),
  };
  return {
    list: new ListAttachmentsUseCase(mockRepo as never, mockScope as never),
    download: new DownloadAttachmentUseCase(mockRepo as never, mockStorage as never, mockScope as never),
    retire: new RetireAttachmentUseCase(mockRepo as never, mockAudit as never, mockTx as never, mockScope as never),
    mockRepo,
    mockStorage,
    mockScope,
    mockAudit,
  };
}

const memberInput = { projectId: P1, actorUserId: WORKER_ID, actorRoles: ['WORKER'] };

describe('attachment read/retire (PRJ-SRS-009)', () => {
  it('list: WORKER member đọc được metadata (member scope, không write)', async () => {
    const { list, mockScope } = setup();
    const out = await list.execute({ ...memberInput });
    expect(out.data).toHaveLength(1);
    expect(mockScope.assertProjectMemberScope).toHaveBeenCalledTimes(1);
    expect(mockScope.assertProjectWriteScope).not.toHaveBeenCalled();
  });

  it('list/download: non-member 403 (không leak)', async () => {
    const denied = async () => { throw new ForbiddenException('Không có quyền truy cập dự án này'); };
    const { list, download } = setup({ memberScope: denied });
    await expect(list.execute({ ...memberInput })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(download.execute({ ...memberInput, attachmentId: ATT_ID })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('download: file thuộc project khác → 404 (scope-bind, không leak bytes)', async () => {
    const other = makeEntity({ projectId: P2, ownerId: P2 });
    const { download, mockStorage } = setup({ byId: other });
    await expect(download.execute({ ...memberInput, attachmentId: ATT_ID })).rejects.toBeInstanceOf(NotFoundException);
    expect(mockStorage.read).not.toHaveBeenCalled();
  });

  it('download: att missing → 404', async () => {
    const { download } = setup({ byId: null });
    await expect(download.execute({ ...memberInput, attachmentId: ATT_ID })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('retire: WORKER (không write-scope) 403; PM happy ghi audit PRJ_ATTACHMENT_RETIRED', async () => {
    const denied = async () => { throw new ForbiddenException('Không có quyền truy cập dự án này'); };
    const w = setup({ writeScope: denied, byId: makeEntity() });
    await expect(
      w.retire.execute({ ...memberInput, attachmentId: ATT_ID, reason: 'x' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const pm = setup({ byId: makeEntity() });
    const out = await pm.retire.execute({
      projectId: P1, actorUserId: PM_ID, actorRoles: ['PROJECT_MANAGER'], attachmentId: ATT_ID, reason: 'hết hiệu lực',
    });
    expect(out.alreadyInactive).toBe(false);
    expect(out.entity.isActive).toBe(false);
    expect(out.entity.deactivateReason).toBe('hết hiệu lực');
    expect(pm.mockAudit.logWithClient).toHaveBeenCalledTimes(1);
    expect((pm.mockAudit.logWithClient as jest.Mock).mock.calls[0][1]).toMatchObject({
      action: 'PRJ_ATTACHMENT_RETIRED',
      entityType: 'ATTACHMENT',
    });
  });

  it('retire idempotent: đã inactive → alreadyInactive, không audit mới', async () => {
    const { retire, mockAudit } = setup({ byId: makeEntity(), alreadyInactive: true });
    const out = await retire.execute({
      projectId: P1, actorUserId: PM_ID, actorRoles: ['PROJECT_MANAGER'], attachmentId: ATT_ID,
    });
    expect(out.alreadyInactive).toBe(true);
    expect(mockAudit.logWithClient).not.toHaveBeenCalled();
  });

  it('retire: audit fail → 500 rollback', async () => {
    const { retire } = setup({
      byId: makeEntity(),
      auditImpl: async () => { throw new Error('audit down'); },
    });
    await expect(
      retire.execute({ projectId: P1, actorUserId: PM_ID, actorRoles: ['PROJECT_MANAGER'], attachmentId: ATT_ID }),
    ).rejects.toThrow('nhật ký kiểm toán');
  });

  it('retire: reason quá dài → 400', async () => {
    const { retire } = setup({ byId: makeEntity() });
    await expect(
      retire.execute({
        projectId: P1, actorUserId: PM_ID, actorRoles: ['PROJECT_MANAGER'], attachmentId: ATT_ID, reason: 'x'.repeat(501),
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
