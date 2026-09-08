import {
  UPDATABLE_WORK_ORDER_FIELDS,
  decideUpdateField,
  evaluateUpdateRequest,
} from './work-order-update.policy';
import { WorkOrderStatus } from '../entity/work-order.entity';

describe('work-order-update.policy (JOB-SRS-003)', () => {
  it('DRAFT/READY: sửa được tất cả 8 field, không đòi reason', () => {
    for (const status of ['DRAFT', 'READY'] as WorkOrderStatus[]) {
      const result = evaluateUpdateRequest(status, [...UPDATABLE_WORK_ORDER_FIELDS], {
        isAdmin: false,
        reason: null,
      });
      expect(result.fieldErrors).toEqual({});
      expect(result.exceptionEdit).toBe(false);
    }
  });

  it.each(['description', 'instructions', 'dueAt'] as const)(
    'OPEN: cho sửa %s',
    (field) => {
      const result = evaluateUpdateRequest('OPEN', [field], { isAdmin: false, reason: null });
      expect(result.fieldErrors).toEqual({});
    },
  );

  it.each(['priority', 'plannedStartAt', 'plannedEndAt', 'requiredTradeId', 'workTypeId'] as const)(
    'OPEN: khóa %s → fieldErrors (đổi phải qua đóng board trước)',
    (field) => {
      const result = evaluateUpdateRequest('OPEN', [field], { isAdmin: false, reason: null });
      expect(result.fieldErrors[field]).toBeDefined();
      expect(result.fieldErrors[field][0]).toMatch(/đóng board/);
    },
  );

  it.each(['description', 'instructions'] as const)('ASSIGNED/IN_PROGRESS: cho sửa %s không cần reason', (field) => {
    for (const status of ['ASSIGNED', 'IN_PROGRESS'] as WorkOrderStatus[]) {
      const result = evaluateUpdateRequest(status, [field], { isAdmin: false, reason: null });
      expect(result.fieldErrors).toEqual({});
    }
  });

  it.each(['plannedStartAt', 'plannedEndAt', 'requiredTradeId', 'workTypeId'] as const)(
    'ASSIGNED/IN_PROGRESS: đổi %s thiếu reason → 400 reason; kèm reason → pass',
    (field) => {
      for (const status of ['ASSIGNED', 'IN_PROGRESS'] as WorkOrderStatus[]) {
        const missing = evaluateUpdateRequest(status, [field], { isAdmin: false, reason: null });
        expect(missing.fieldErrors['reason']).toBeDefined();
        const ok = evaluateUpdateRequest(status, [field], { isAdmin: false, reason: 'Dời lịch theo yêu cầu CĐT' });
        expect(ok.fieldErrors).toEqual({});
        expect(ok.reasonGovernedFields).toEqual([field]);
      }
    },
  );

  it('ASSIGNED/IN_PROGRESS: dueAt + priority khóa (ngoài allow-list, không thuộc nhóm reason)', () => {
    for (const field of ['dueAt', 'priority'] as const) {
      const result = evaluateUpdateRequest('ASSIGNED', [field], {
        isAdmin: false,
        reason: 'Có lý do nhưng field vẫn khóa',
      });
      expect(result.fieldErrors[field]).toBeDefined();
    }
  });

  it.each(['WORK_DONE', 'CLOSED', 'CANCELLED'] as WorkOrderStatus[])(
    '%s: non-ADMIN toàn bộ khóa kể cả kèm reason',
    (status) => {
      const result = evaluateUpdateRequest(status, ['description'], {
        isAdmin: false,
        reason: 'Lý do dài đủ mười ký tự trở lên',
      });
      expect(result.fieldErrors['description']).toBeDefined();
      expect(result.exceptionEdit).toBe(false);
    },
  );

  it.each(['WORK_DONE', 'CLOSED', 'CANCELLED'] as WorkOrderStatus[])(
    '%s: ADMIN thiếu reason / reason ngắn → fieldErrors reason; đủ ≥10 ký tự → exceptionEdit',
    (status) => {
      const missing = evaluateUpdateRequest(status, ['description'], { isAdmin: true, reason: null });
      expect(missing.fieldErrors['reason']).toBeDefined();
      const short = evaluateUpdateRequest(status, ['description'], { isAdmin: true, reason: 'ngắn quá' });
      expect(short.fieldErrors['reason']).toBeDefined();
      const ok = evaluateUpdateRequest(status, ['description', 'priority'], {
        isAdmin: true,
        reason: 'Sửa sai mã cần hiệu chỉnh',
      });
      expect(ok.fieldErrors).toEqual({});
      expect(ok.exceptionEdit).toBe(true);
    },
  );

  it('decideUpdateField: terminal non-ADMIN disallow + exceptionEdit flag; ADMIN allow + requiresReason', () => {
    expect(decideUpdateField('CLOSED', 'description', { isAdmin: false })).toMatchObject({
      allowed: false,
      exceptionEdit: true,
    });
    expect(decideUpdateField('CLOSED', 'description', { isAdmin: true })).toMatchObject({
      allowed: true,
      requiresReason: true,
      exceptionEdit: true,
    });
  });
});
