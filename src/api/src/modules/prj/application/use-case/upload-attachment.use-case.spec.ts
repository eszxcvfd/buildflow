import { ForbiddenException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { UploadAttachmentUseCase } from './upload-attachment.use-case';
import { AttachmentEntity } from '../../domain/entity/attachment.entity';

// PRJ-SRS-009 (issue #40) — upload use-case unit: scope-first, replay trước
// khi ghi file, validate trước khi ghi, orphan cleanup, audit fail 500.

const P1 = '22222222-2222-4222-8222-222222222222';
const PM_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OUTSIDER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const REPLAY_KEY = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const WO1 = '33333333-3333-4333-8333-333333333333';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

function makeEntity(over: Partial<Record<string, unknown>> = {}): AttachmentEntity {
  return new AttachmentEntity({
    id: 'att-1',
    projectId: P1,
    workOrderId: null,
    ownerType: 'PROJECT',
    ownerId: P1,
    attachmentType: 'DOCUMENT',
    uploadedBy: PM_ID,
    fileName: 'a.jpg',
    storageKey: `${P1}/uuid-a.jpg`,
    mimeType: 'image/jpeg',
    sizeBytes: JPEG.length,
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
  writeScope?: (projectId: string) => Promise<unknown>;
  existingByKey?: AttachmentEntity | null;
  workOrder?: { id: string; projectId: string } | null | 'missing';
  txImpl?: (fn: (c: unknown) => Promise<unknown>) => Promise<unknown>;
  auditImpl?: () => Promise<unknown>;
} = {}) {
  const saved: string[] = [];
  const removed: string[] = [];
  const created: AttachmentEntity[] = [];
  const mockRepo = {
    findById: jest.fn(async () => null),
    findByRequestKey: jest.fn(async () => overrides.existingByKey ?? null),
    listByProjectId: jest.fn(async () => []),
    listByWorkOrderId: jest.fn(async () => []),
    findWorkOrderProjectById: jest.fn(async () => {
      if (overrides.workOrder === 'missing') return null;
      return overrides.workOrder ?? null;
    }),
    create: jest.fn(async (e: AttachmentEntity) => { created.push(e); }),
    createWithClient: jest.fn(async (_c: unknown, e: AttachmentEntity) => { created.push(e); }),
  };
  const mockStorage = {
    save: jest.fn(async (_p: string, _n: string, _b: Buffer) => {
      const key = `${P1}/saved-file`;
      saved.push(key);
      return key;
    }),
    read: jest.fn(async () => JPEG),
    remove: jest.fn(async (k: string) => { removed.push(k); }),
  };
  const mockScope = {
    assertProjectWriteScope: jest.fn(async ({ projectId }: { projectId: string }) => {
      if (overrides.writeScope) return overrides.writeScope(projectId);
      return { isAdminBypass: false };
    }),
    assertProjectMemberScope: jest.fn(async () => ({ isAdminBypass: false })),
  };
  const mockAudit = {
    log: jest.fn(async () => {}),
    logWithClient: jest.fn(overrides.auditImpl ?? (async () => {})),
  };
  const mockTx = {
    withTransaction: jest.fn(overrides.txImpl ?? (async (fn: (c: unknown) => Promise<unknown>) => fn({}))),
  };
  const useCase = new UploadAttachmentUseCase(
    mockRepo as never,
    mockStorage as never,
    mockAudit as never,
    mockTx as never,
    mockScope as never,
  );
  return { useCase, mockRepo, mockStorage, mockScope, mockAudit, mockTx, saved, removed, created };
}

const baseInput: {
  projectId: string | undefined;
  file: { buffer: Buffer; originalName: string; mimeType: string };
  caption: null;
  requestKey: null;
  actorUserId: string;
  actorRoles: string[];
} = {
  projectId: P1,
  file: { buffer: JPEG, originalName: 'a.jpg', mimeType: 'image/jpeg' },
  caption: null,
  requestKey: null,
  actorUserId: PM_ID,
  actorRoles: ['PROJECT_MANAGER'],
};

describe('upload-attachment.use-case (PRJ-SRS-009)', () => {
  it('scope-first: non-member 403 và KHÔNG ghi file (no-leak)', async () => {
    const { useCase, mockStorage } = setup({
      writeScope: async () => { throw new ForbiddenException('Không có quyền truy cập dự án này'); },
    });
    await expect(useCase.execute({ ...baseInput })).rejects.toBeInstanceOf(ForbiddenException);
    expect(mockStorage.save).not.toHaveBeenCalled();
  });

  it('replay: requestKey trùng → 200 hiện có, KHÔNG ghi file, KHÔNG audit', async () => {
    const existing = makeEntity({ requestKey: REPLAY_KEY });
    const { useCase, mockStorage, mockAudit } = setup({ existingByKey: existing });
    const out = await useCase.execute({ ...baseInput, requestKey: REPLAY_KEY });
    expect(out.idempotentReplay).toBe(true);
    expect(out.entity).toBe(existing);
    expect(mockStorage.save).not.toHaveBeenCalled();
    expect(mockAudit.logWithClient).not.toHaveBeenCalled();
  });

  it('validate trước khi ghi: fake-exe và quá hạn không chạm disk', async () => {
    const { useCase, mockStorage } = setup();
    const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
    await expect(
      useCase.execute({ ...baseInput, file: { buffer: exe, originalName: 'evil.pdf', mimeType: 'application/pdf' } }),
    ).rejects.toMatchObject({ status: 400 });
    const big = Buffer.alloc(10 * 1024 * 1024 + 1);
    await expect(
      useCase.execute({ ...baseInput, file: { buffer: big, originalName: 'big.png', mimeType: 'image/png' } }),
    ).rejects.toMatchObject({ status: 400 });
    expect(mockStorage.save).not.toHaveBeenCalled();
  });

  it('happy: sanitize traversal trong tên, owner PROJECT, audit PRJ_ATTACHMENT_UPLOADED', async () => {
    const { useCase, created, mockAudit } = setup();
    const out = await useCase.execute({
      ...baseInput,
      file: { buffer: JPEG, originalName: '../../evil.jpg', mimeType: 'image/jpeg' },
    });
    expect(out.idempotentReplay).toBe(false);
    expect(created[0].fileName).toBe('evil.jpg');
    expect(created[0].ownerType).toBe('PROJECT');
    expect(created[0].ownerId).toBe(P1);
    expect(created[0].attachmentType).toBe('DOCUMENT');
    expect(mockAudit.logWithClient).toHaveBeenCalledTimes(1);
    expect((mockAudit.logWithClient as jest.Mock).mock.calls[0][1]).toMatchObject({
      action: 'PRJ_ATTACHMENT_UPLOADED',
      entityType: 'ATTACHMENT',
    });
  });

  it('DB fail trong tx → xóa file vừa ghi (orphan cleanup)', async () => {
    const { useCase, removed } = setup({
      txImpl: async () => { throw new Error('db down'); },
    });
    await expect(useCase.execute({ ...baseInput })).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(removed).toEqual([`${P1}/saved-file`]);
  });

  it('audit fail → 500 + xóa file', async () => {
    const { useCase, removed, mockAudit } = setup({
      auditImpl: async () => { throw new Error('audit down'); },
    });
    await expect(useCase.execute({ ...baseInput })).rejects.toThrow('nhật ký kiểm toán');
    expect(mockAudit.logWithClient).toHaveBeenCalled();
    expect(removed).toEqual([`${P1}/saved-file`]);
  });

  it('race 23505 request_key → xóa file vừa ghi rồi replay row thắng', async () => {
    const winner = makeEntity({ requestKey: REPLAY_KEY });
    const calls: Array<AttachmentEntity | null> = [null, winner];
    const { useCase, removed } = setup({
      txImpl: async () => {
        const err = Object.assign(new Error('dup'), { code: '23505', constraint: 'ux_attachments_request_key' });
        throw err;
      },
    });
    useCase['attachments']['findByRequestKey'] = jest.fn(async () => calls.shift() ?? null);
    const out = await useCase.execute({ ...baseInput, requestKey: REPLAY_KEY });
    expect(out.idempotentReplay).toBe(true);
    expect(out.entity).toBe(winner);
    expect(removed).toEqual([`${P1}/saved-file`]);
  });

  it('WO extension: resolve project từ WO; WO missing → non-ADMIN 403 / ADMIN 404', async () => {
    const woSetup = setup({ workOrder: { id: WO1, projectId: P1 } });
    const out = await woSetup.useCase.execute({
      ...baseInput, projectId: undefined, workOrderId: WO1,
    });
    expect(out.idempotentReplay).toBe(false);
    expect(woSetup.created[0].ownerType).toBe('WORK_ORDER');
    expect(woSetup.created[0].workOrderId).toBe(WO1);
    expect(woSetup.mockScope.assertProjectWriteScope.mock.calls[0][0]).toMatchObject({ projectId: P1 });

    const missing = setup({ workOrder: 'missing' });
    await expect(
      missing.useCase.execute({ ...baseInput, projectId: undefined, workOrderId: WO1, actorRoles: ['WORKER'] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      missing.useCase.execute({ ...baseInput, projectId: undefined, workOrderId: WO1, actorRoles: ['ADMIN'] }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('outsider upload vào WO lạ → 403 từ scope (không leak)', async () => {
    const { useCase } = setup({
      workOrder: { id: WO1, projectId: P1 },
      writeScope: async () => { throw new ForbiddenException('Không có quyền truy cập dự án này'); },
    });
    await expect(
      useCase.execute({
        ...baseInput, projectId: undefined, workOrderId: WO1, actorUserId: OUTSIDER_ID, actorRoles: ['WORKER'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
