-- Cleanup E2E leftovers — plan v2 T1 (2026-09-09).
--
-- RÀNG BUỘC CỨNG (không được vi phạm khi sửa script này):
--   1. `audit_logs` là append-only (trigger chặn UPDATE/DELETE/TRUNCATE) — KHÔNG đụng.
--      Các dòng audit có entity_id trỏ tới user/WO bị xoá GIỮ NGUYÊN CÓ CHỦ Ý
--      (actor là admin 11111111-...; chỉ là tham chiếu entity_id, không có FK).
--   2. `schema_migrations` KHÔNG đụng. Không đổi schema, không đổi password hash
--      của user hiện hữu (2 UPDATE rename bên dưới chỉ đổi email/full_name/
--      employee_code, giữ nguyên UUID + password_hash + status).
--   3. Key theo UUID CHÍNH XÁC — không LIKE title, không fallback created_at.
--   4. Idempotent: chạy lại = no-op (DELETE theo id, UPDATE gán giá trị tuyệt đối).
--   5. Delta `audit_logs` kỳ vọng = 0 (INSERT/DELETE trực tiếp không qua app nên
--      không sinh audit; đã verify không có trigger audit trên các bảng này —
--      DB hiện chỉ có 2 trigger append-only trên chính `audit_logs`).
--
-- Re-verify live 2026-09-09 trước khi chạy (khớp plan, 1 điểm làm rõ):
--   * luc.tran.s7qrjp (cc570440-9489-4095-8ea3-282c66ddb7e4) và
--     khoi.pham.283393 (14cad2a6-30fa-40a9-b7e6-ff211b7987ff) có dòng audit
--     entity_id (2 + 4, action ORG_WORKER_*) nhưng actor_user_id = 0 cho cả hai
--     → "0-audit" trong plan được hiểu là 0 actor-pin; DELETE users FK-an toàn,
--     audit rows giữ nguyên có chủ ý. dbg.503 (1) và e2e.sync11 (1) là
--     AUTH_LOGIN_SUCCESS tự trỏ mình → audit-ghim → RENAME, không DELETE.
--   * resource_trades của 2 user: 4 dòng (2 luc→NK-S7QRJP, 2 khoi→THO-CAT).
--   * 2 trade S7QRJP: work_orders/work_types trỏ tới = 0; resource_trades trỏ tới
--     chỉ còn 2 dòng của luc (xoá cùng script, đúng thứ tự) → sau bước 1 = 0.
--   * crew_members của khoi: 1 dòng (DD-CD/MEMBER).
--   * 4 WO rác: mọi bảng con = 0 NGOẠI TRỪ work_order_state_history = 4 dòng.
--   * contractor XD-283393: users.contractor_id = 0, crews.contractor_id = 0.
--   * email/employee_code mới (duc.tran@, manh.pham@, TX-0022, TX-0023): chưa tồn tại.
-- Thứ tự FK: resource_trades → crew_members → state_history → work_orders →
-- trades → users → contractor (contractor XD không còn tham chiếu nào nên vị trí
-- sau users cũng an toàn) → rename 2 user audit-ghim.

BEGIN;

-- 1. resource_trades của luc.tran.s7qrjp + khoi.pham.283393 (4 dòng).
DELETE FROM resource_trades
 WHERE user_id IN ('cc570440-9489-4095-8ea3-282c66ddb7e4',
                   '14cad2a6-30fa-40a9-b7e6-ff211b7987ff');

-- 2. crew_members của khoi.pham.283393 (1 dòng DD-CD/MEMBER).
DELETE FROM crew_members
 WHERE user_id = '14cad2a6-30fa-40a9-b7e6-ff211b7987ff';

-- 3. work_order_state_history của 4 WO rác (4 dòng).
DELETE FROM work_order_state_history
 WHERE work_order_id IN ('09a5bafc-33e9-4561-a909-f46eb0448c3d',
                         'bfd1ba6c-bd97-4749-bc9e-8e074279f704',
                         'f9d6fee3-15ee-42db-829f-63b6658a3579',
                         'd2823e19-2961-4a59-b1a9-912642670cb6');

-- 4. 4 work_orders rác (PRA, OPEN, job_board mở — xoá làm board sạch hơn cho driver).
DELETE FROM work_orders
 WHERE id IN ('09a5bafc-33e9-4561-a909-f46eb0448c3d',
              'bfd1ba6c-bd97-4749-bc9e-8e074279f704',
              'f9d6fee3-15ee-42db-829f-63b6658a3579',
              'd2823e19-2961-4a59-b1a9-912642670cb6');

-- 5. 2 trades rác (0 tham chiếu còn lại sau bước 1 — đã verify live).
DELETE FROM trades
 WHERE id IN ('a58e8896-6d8f-48a8-a313-6c3fbedfb965',
              '8bb709ed-56e5-4cc6-8fd2-df3bca020495');

-- 6. 2 user rác (0 actor-audit, 0 FK còn lại — đã verify live; audit entity_id giữ nguyên).
DELETE FROM users
 WHERE id IN ('cc570440-9489-4095-8ea3-282c66ddb7e4',
              '14cad2a6-30fa-40a9-b7e6-ff211b7987ff');

-- 7. contractor XD-283393 nếu tồn tại và 0 tham chiếu (đã verify live).
DELETE FROM contractors
 WHERE id = '950631ee-df0d-478d-98cb-bc0b8729c206';

-- 8. RENAME 2 user audit-ghim (giữ UUID/hash/status; email + code mới đã verify trống).
UPDATE users
   SET email = 'duc.tran@vinacons.vn',
       full_name = 'Trần Quốc Đức',
       employee_code = 'TX-0022',
       updated_at = CURRENT_TIMESTAMP
 WHERE id = 'e855b04a-c1cb-46be-8eb1-09c2680e017e';

UPDATE users
   SET email = 'manh.pham@vinacons.vn',
       full_name = 'Phạm Văn Mạnh',
       employee_code = 'TX-0023',
       updated_at = CURRENT_TIMESTAMP
 WHERE id = '84c65266-d6de-4b92-aede-0fe2a73aa24d';

-- Verify trong transaction (kỳ vọng toàn 0 / rename đúng).
SELECT count(*) AS resource_trades_left FROM resource_trades
 WHERE user_id IN ('cc570440-9489-4095-8ea3-282c66ddb7e4',
                   '14cad2a6-30fa-40a9-b7e6-ff211b7987ff');
SELECT count(*) AS crew_members_left FROM crew_members
 WHERE user_id = '14cad2a6-30fa-40a9-b7e6-ff211b7987ff';
SELECT count(*) AS wo_left FROM work_orders
 WHERE id IN ('09a5bafc-33e9-4561-a909-f46eb0448c3d',
              'bfd1ba6c-bd97-4749-bc9e-8e074279f704',
              'f9d6fee3-15ee-42db-829f-63b6658a3579',
              'd2823e19-2961-4a59-b1a9-912642670cb6');
SELECT count(*) AS trades_left FROM trades
 WHERE id IN ('a58e8896-6d8f-48a8-a313-6c3fbedfb965',
              '8bb709ed-56e5-4cc6-8fd2-df3bca020495');
SELECT count(*) AS contractor_left FROM contractors
 WHERE id = '950631ee-df0d-478d-98cb-bc0b8729c206';
SELECT id, email, full_name, employee_code, status FROM users
 WHERE id IN ('e855b04a-c1cb-46be-8eb1-09c2680e017e',
              '84c65266-d6de-4b92-aede-0fe2a73aa24d')
 ORDER BY email;

COMMIT;
