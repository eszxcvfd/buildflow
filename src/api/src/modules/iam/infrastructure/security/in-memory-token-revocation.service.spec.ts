import { InMemoryTokenRevocationService } from './in-memory-token-revocation.service';

describe('InMemoryTokenRevocationService — user cutoff (IAM-SRS-007)', () => {
  let svc: InMemoryTokenRevocationService;

  beforeEach(() => {
    svc = new InMemoryTokenRevocationService();
  });

  describe('isUserRevokedBefore — nhánh cơ bản (chỉ dựa cutoff truyền vào)', () => {
    const cutoff = new Date(1_700_000_000_000);

    it('iat cũ hơn cutoff → true (phiên phát trước khi đổi mật khẩu bị từ chối)', async () => {
      const iat = Math.floor(cutoff.getTime() / 1000) - 10;
      await expect(svc.isUserRevokedBefore('u1', iat, cutoff)).resolves.toBe(true);
    });

    it('iat một giây trước cutoff (đúng second-precision biên) → true', async () => {
      // iat = giây (cutoffSec - 1) < floor(cutoffMs/1000) = cutoffSec → bị từ chối
      const cutoffSec = Math.floor(cutoff.getTime() / 1000);
      const iat = cutoffSec - 1;
      await expect(svc.isUserRevokedBefore('u1', iat, cutoff)).resolves.toBe(true);
    });

    it('iat cùng giây với cutoff (kể cả ms cutoff muộn hơn iat) → false (1-giây acceptance window)', async () => {
      // JWT iat có second-precision; token đúc cùng giây với cutoff (dù ms sớm hơn
      // password_changed_at) KHÔNG bị từ chối — fix race đúc token trong cùng giây.
      const cutoffSec = Math.floor(cutoff.getTime() / 1000);
      const iatSameSecond = cutoffSec;
      await expect(svc.isUserRevokedBefore('u1', iatSameSecond, cutoff)).resolves.toBe(false);
      // token phát tại giây X, mật khẩu đổi tại X.500ms → cùng giây → chấp nhận
      const cutoffWithMs = new Date(cutoff.getTime() + 500);
      await expect(svc.isUserRevokedBefore('u1', iatSameSecond, cutoffWithMs)).resolves.toBe(false);
    });

    it('iat*1000 trùng chính xác cutoff ms (biên equality) → false (chỉ token phát TRƯỚC cutoff bị chặn)', async () => {
      const iat = Math.floor(cutoff.getTime() / 1000);
      await expect(svc.isUserRevokedBefore('u1', iat, cutoff)).resolves.toBe(false);
    });

    it('iat mới hơn cutoff → false (token phát sau khi đổi mật khẩu còn hiệu lực)', async () => {
      const iat = Math.floor(cutoff.getTime() / 1000) + 10;
      await expect(svc.isUserRevokedBefore('u1', iat, cutoff)).resolves.toBe(false);
    });

    it('thiếu iat → true (fail-closed: không chứng minh được phát sau cutoff)', async () => {
      await expect(svc.isUserRevokedBefore('u1', undefined, cutoff)).resolves.toBe(true);
    });

    it('user lạ (không có in-memory cutoff) → false khi iat sau cutoff truyền vào', async () => {
      const iat = Math.floor(cutoff.getTime() / 1000) + 10;
      await expect(svc.isUserRevokedBefore('stranger', iat, cutoff)).resolves.toBe(false);
    });

    it('user lạ + thiếu iat → true (vẫn fail-closed vì cutoff truyền vào có giá trị)', async () => {
      await expect(svc.isUserRevokedBefore('stranger', undefined, cutoff)).resolves.toBe(true);
    });
  });

  describe('revokeAllForUserBefore + isUserRevokedBefore — phối hợp', () => {
    const dbCutoff = new Date(1_700_000_000_000);

    it('revokeAllForUserBefore đặt cutoff in-memory: iat cũ hơn → true', async () => {
      await svc.revokeAllForUserBefore('u1', dbCutoff, 3_600_000);
      const iat = Math.floor(dbCutoff.getTime() / 1000) - 1;
      await expect(svc.isUserRevokedBefore('u1', iat, new Date(0))).resolves.toBe(true);
    });

    it('revokeAllForUserBefore đặt cutoff in-memory: iat mới hơn → false', async () => {
      await svc.revokeAllForUserBefore('u1', dbCutoff, 3_600_000);
      const iat = Math.floor(dbCutoff.getTime() / 1000) + 1;
      await expect(svc.isUserRevokedBefore('u1', iat, new Date(0))).resolves.toBe(false);
    });

    it('cutoff in-memory và cutoff DB: lấy max (không hạ thấp bằng cutoff DB cũ hơn)', async () => {
      const laterCutoff = new Date(dbCutoff.getTime() + 60_000);
      await svc.revokeAllForUserBefore('u1', laterCutoff, 3_600_000);
      // iat nằm giữa dbCutoff cũ (được truyền) và laterCutoff (in-memory) → vẫn bị chặn
      const iat = Math.floor(dbCutoff.getTime() / 1000) + 5;
      await expect(svc.isUserRevokedBefore('u1', iat, dbCutoff)).resolves.toBe(true);
      // iat sau laterCutoff → cho qua
      const iatAfter = Math.floor(laterCutoff.getTime() / 1000) + 5;
      await expect(svc.isUserRevokedBefore('u1', iatAfter, dbCutoff)).resolves.toBe(false);
    });

    it('cutoff in-memory cũ hơn cutoff DB truyền vào: cutoff DB thắng', async () => {
      const earlierCutoff = new Date(dbCutoff.getTime() - 120_000);
      await svc.revokeAllForUserBefore('u1', earlierCutoff, 3_600_000);
      const iat = Math.floor(earlierCutoff.getTime() / 1000) + 5; // sau in-memory, trước DB
      await expect(svc.isUserRevokedBefore('u1', iat, dbCutoff)).resolves.toBe(true);
    });

    it('user lạ không bị ảnh hưởng bởi cutoff của user khác', async () => {
      await svc.revokeAllForUserBefore('u1', dbCutoff, 3_600_000);
      const iat = Math.floor(dbCutoff.getTime() / 1000) - 5;
      // u2 với cutoff DB = 0 → không bị ảnh hưởng bởi cutoff in-memory của u1
      await expect(svc.isUserRevokedBefore('u2', iat, new Date(0))).resolves.toBe(false);
    });
  });

  describe('jti denylist (IAM-SRS-002) — không hồi quy', () => {
    it('revoke + isRevoked + hết hạn tự xoá', async () => {
      await svc.revoke('jti-1', new Date(Date.now() + 50));
      await expect(svc.isRevoked('jti-1')).resolves.toBe(true);
      await new Promise((r) => setTimeout(r, 60));
      await expect(svc.isRevoked('jti-1')).resolves.toBe(false);
      expect(svc.size()).toBe(0);
    });
  });
});
