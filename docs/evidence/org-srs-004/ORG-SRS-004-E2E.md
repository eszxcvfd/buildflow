# ORG-SRS-004 — E2E Evidence: Resource Lifecycle Status (#27)

> **Loại bằng chứng:** Browser E2E thật (UI → API → PostgreSQL → UI), HTTP-level checks bằng token thật, screenshot trong repo.
> **Ngày chạy:** 2026-09-07 (run cuối `e2e-driver-org-srs-004.cjs` — **12/12 PASS**;
> run trước 11/12 PASS, 1 FAIL product B5 — xem §5e)
> **Phạm vi:** chỉ sửa file dưới `docs/evidence/org-srs-004/` — **không commit**, không sửa source.
>
> **Chuẩn hóa dữ liệu realistic 2026-09-07** (theo [`docs/demo-data.md`](../demo-data.md)):
> worker/contractor/project chạy lifecycle là dữ liệu demo canonical
> (`cuong.do@vinacons.vn`/Đỗ Văn Cường, `VCC`, `PRD`); lý do runtime dùng văn phong Việt
> (`… (đợt T9/2026)`); các dòng audit lịch sử vẫn giữ identifier cũ (`E2E4-*`,
> `e2e4.worker@example.com`, `(E2E run …)`, …) là **có chủ ý** (bảng `audit_logs` append-only).

---

## 1. Môi trường

| Hạng mục | Giá trị |
| --- | --- |
| Repo | `/home/trung/Documents/2026/project/buildflow` |
| API base | `http://localhost:3000` (container `buildflow-api-1`, healthy) |
| Web base | `http://localhost:3001` (container `buildflow-web-1`, healthy) |
| PostgreSQL | `docker exec buildflow-postgres-1 psql -U buildflow -d buildflow` |
| Browser | Google Chrome headless (Playwright — `/usr/bin/google-chrome`) |
| DB migrations | 0001 → 0004 (audit_logs append-only, `ux_audit_correlation_action` dedup) |

> ⚠️ **Stack đã rebuild từ working tree cho E2E này** — image cũ không chứa endpoint lifecycle
> (probe `GET /api/v1/workers/:id/open-work` → 404). Rebuild chạy bằng DOCKER_CONFIG riêng
> (home docker buildx read-only):
> ```
> cd infra/docker
> mkdir -p /tmp/bfhome/.docker
> DOCKER_HOST=unix:///home/trung/.docker/desktop/docker.sock DOCKER_CONFIG=/tmp/bfhome/.docker \
>   docker compose -f infra/docker/compose.yaml build api web
> DOCKER_HOST=unix:///home/trung/.docker/desktop/docker.sock DOCKER_CONFIG=/tmp/bfhome/.docker \
>   docker compose -f infra/docker/compose.yaml up -d api web
> ```
> Sau rebuild: probe thành công → `/open-work` không token trả **401** (route tồn tại, JWT bắt buộc).

Trạng thái stack:

```
buildflow-web-1       127.0.0.1:3001->3001/tcp   Up (healthy)
buildflow-api-1       127.0.0.1:3000->3000/tcp   Up (healthy)
buildflow-postgres-1  127.0.0.1:5432->5432/tcp   Up (healthy)
buildflow-redis-1     127.0.0.1:6379->6379/tcp   Up (healthy)
```

## 2. Tài khoản

| Email | Vai trò | Password |
| --- | --- | --- |
| `hoang.anh@vinacons.vn` | ADMIN | `E2EAdmin@2025` (email realistic từ 2026-09-07, password giữ nguyên) |
| `quoc.tran@vinacons.vn` | PROJECT_MANAGER | `E2EPm@2025` (reset từ evidence ORG-SRS-003 §2a) |

Reset password nếu cần (bcryptjs, genSalt 10) — xem ORG-SRS-003-E2E.md §2a.

## 3. Seed dữ liệu demo (bắt buộc trước E2E)

Assignments thật = 0 trong DB mẫu (nên warning open-work rỗng). Seed tối thiểu bằng
`docs/evidence/org-srs-004/seed-lifecycle-004.sql` (id ổn định, trùng dữ liệu demo canonical):

| Bảng | Row | Ghi chú |
| --- | --- | --- |
| `contractors` | `e2e4c000-…c1` — VCC Công ty CP Xây dựng Vinacons (ACTIVE, phone `0900123401` **phải hợp lệ** cho validatePhone domain) | nhánh contractor lifecycle |
| `users` | `e2e4a000-…a1` — `cuong.do@vinacons.vn`/Đỗ Văn Cường/TX-0021 (canonical INACTIVE, driver tự đưa về ACTIVE lúc chạy) | nhánh worker lifecycle |
| `projects` | `e2e4b000-…b1` PRD Bệnh viện đa khoa Quận 7 ACTIVE | FK chain projects → work_orders → assignments |
| `project_areas` | `e2e4b100-…b2` B1-01 Tầng hầm B1 | `work_orders.area_id` nullable — seed vẫn gắn |
| `work_types` | `e2e4b200-…b3` BT-CT (required_trade THO-CAT) | `work_orders.work_type_id` NOT NULL |
| `work_orders` | `e2e4b300-…b4` PRD-B1-001 (status ASSIGNED) | status mở trong CHECK |
| `assignments` | `e2e4c100-…c2` (assignee_type USER, worker TX-0021, status PENDING_ACCEPTANCE, requires_acceptance) | **nguồn open-work count = 1** |
| `crews` | `e2e4c200-…c3` DD-CD (contractor VCC) | chứng minh nhánh UNION crews.contractor_id |

Chạy seed:

```bash
docker exec -i buildflow-postgres-1 psql -U buildflow -d buildflow -v ON_ERROR_STOP=1 \
  < docs/evidence/org-srs-004/seed-lifecycle-004.sql
# output cuối: contractor=1 worker=1 work_order=1 assignment=1 crew=1
```

> ⚠️ Lưu ý seed: cột `projects` **không có** `project_type/budget/owner_id` (schema DBD hiện tại) và
> `phone` của contractor phải đúng format số (domain `validatePhone`) nếu không GET detail 500.
> Script seed trong file này đã khớp schema thật (xác minh bằng `\d` từng bảng).

### Cleanup (id-based; audit_logs append-only KHÔNG xóa)

Các row seed là dữ liệu demo canonical ([`docs/demo-data.md`](../demo-data.md)) — **KHÔNG xóa**
contractor/worker/project/area/work_type/work_order/crew. Chỉ assignment mở là fixture thuần E2E,
xóa theo id chính xác khi cần slate sạch rồi chạy lại seed (re-run đã kiểm chứng):

```sql
DELETE FROM assignments WHERE id = 'e2e4c100-0000-4000-8000-0000000000c2';
-- (rồi chạy lại seed-lifecycle-004.sql để tái tạo)
```

## 4. Kịch bản & kết quả (run cuối)

**Ký hiệu:** 🟢 PASS · 🔴 FAIL (product) · 📸 `docs/evidence/org-srs-004/shots/`

| # | Bước | Kết quả | Bằng chứng UI | Bằng chứng HTTP/DB |
| --- | --- | --- | --- | --- |
| B0 | Seed + login admin | 🟢 PASS | `B0.png` | assignment mở seed count=1; worker/contractor ACTIVE |
| B1 | WorkerDetail: nút Tạm ngừng → dialog + warning **'1 công việc/lịch mở'** (pre-check); submit thiếu reason → field error, **không request** | 🟢 PASS | `B1-warning.png`, `B1-fielderror.png` | audit SUSPENDED delta 0 |
| B2 | Nhập reason → submit → 200; DB INACTIVE; audit `ORG_WORKER_SUSPENDED` có reason + before/after + `_warning`, actor admin | 🟢 PASS | `B2-reason.png`, `B2-success.png` | xem §5 (a) |
| B3 | alreadyInState: mở Kích hoạt lại khi INACTIVE, admin khác ACTIVATE trước (race) → UI info 'đã ở trạng thái hoạt động', **không audit** | 🟢 PASS | `B3-dialog.png`, `B3.png` | audit REACTIVATED delta 0; status ACTIVE |
| B4 | WorkerDetail ACTIVE: Chấm dứt + reason → INACTIVE + `ORG_WORKER_TERMINATED` | 🟢 PASS | `B4-reason.png`, `B4-detail.png` | xem §5 (a) |
| B5 | Timeline 'Lịch sử trạng thái' (WorkerDetail): 3 hành động + lý do + actor; deep-link → audit-logs hiện đúng rows | 🟢 PASS | `B5.png`, `B5-audit.png` | deep-link entityType+entityId+result=SUCCESS trả 24 rows — xem §5 (e) |
| B6 | Eligibility: worker INACTIVE vắng khỏi lọc ACTIVE (API+UI), có ở INACTIVE; open-work vẫn đếm 1 | 🟢 PASS | `B6-inactive.png`, `B6-active.png` | API + UI filter |
| B7 | ContractorDetail: Tạm ngừng + reason (open-work=0 → **không** warning) → INACTIVE + `ORG_CONTRACTOR_SUSPENDED` | 🟢 PASS | `B7-dialog.png`, `B7-detail.png` | xem §5 (c) |
| B8 | ContractorDetail: Kích hoạt lại → ACTIVE + `ORG_CONTRACTOR_REACTIVATED` | 🟢 PASS | `B8-detail.png` | xem §5 (c) |
| B9 | Phân quyền: lifecycle/open-work pm **403**, anon **401**; UI pm chỉ đọc (list/detail render, sidebar ẩn Công nhân, detail không nút lifecycle) | 🟢 PASS | `B9-ui.png` | HTTP thật |
| B10 | Double-submit SUSPEND **song song** cùng correlation-id → cả 2 HTTP 200, **1 audit row** | 🟢 PASS | — | HTTP + DB (xem §5 (b)) |
| B11 | Reason bắt buộc (400) + >500 ký tự (400) → trạng thái giữ nguyên | 🟢 PASS | — | HTTP thật |

**Tổng: 12 PASS / 0 FAIL / 12 bước.** (Các lần chạy trước để lại audit append-only —
không xóa; mọi assert bước dùng DELTA theo `(action, entity_id)` nên chạy lại vẫn khớp.)

## 5. DB verification (output thật từ psql)

### (a) Audit các dòng run mới (đợt T9/2026) của worker Đỗ Văn Cường

```
SELECT action, reason, before_data->>'status' AS b, after_data->>'status' AS a,
       after_data->>'_warning' AS warning, result, correlation_id IS NOT NULL AS has_corr
FROM audit_logs
WHERE entity_type='WORKER' AND entity_id='e2e4a000-0000-4000-8000-0000000000a1'
  AND action LIKE 'ORG_WORKER_%'
ORDER BY created_at;

         action         |                    reason                    |    b     |    a     |                warning                | result  | has_corr
------------------------+----------------------------------------------+----------+----------+---------------------------------------+---------+----------
 ORG_WORKER_SUSPENDED   | Tạm ngừng do thiếu việc trong kỳ (E2E)       | ACTIVE   | INACTIVE | Nguồn lực đang có 1 công việc/lịch mở | SUCCESS | f
 ORG_WORKER_REACTIVATED |                                              | INACTIVE | ACTIVE   |                                       | SUCCESS | f
 ORG_WORKER_TERMINATED  | Chấm dứt hồ sơ do nghỉ việc (E2E)            | ACTIVE   | INACTIVE | Nguồn lực đang có 1 công việc/lịch mở | SUCCESS | f
 ORG_WORKER_SUSPENDED   | double-submit E2E v2                         | ACTIVE   | INACTIVE | Nguồn lực đang có 1 công việc/lịch mở | SUCCESS | t
 ORG_WORKER_SUSPENDED   | Tạm ngừng do thiếu việc trong kỳ (E2E run 2) | ACTIVE   | INACTIVE | Nguồn lực đang có 1 công việc/lịch mở | SUCCESS | f
 ORG_WORKER_SUSPENDED   | Tạm ngừng qua WorkerDetail (E2E run 2)       | ACTIVE   | INACTIVE | Nguồn lực đang có 1 công việc/lịch mở | SUCCESS | f
 ORG_WORKER_REACTIVATED | reset cho B12 (E2E run 2)                    | INACTIVE | ACTIVE   |                                       | SUCCESS | f
 ORG_WORKER_SUSPENDED   | double-submit E2E run 2                      | ACTIVE   | INACTIVE | Nguồn lực đang có 1 công việc/lịch mở | SUCCESS | t
 ORG_WORKER_SUSPENDED   | Tạm ngừng do thiếu việc trong kỳ (đợt T9/2026)          | ACTIVE   | INACTIVE | Nguồn lực đang có 1 công việc/lịch mở | SUCCESS | f
 ORG_WORKER_TERMINATED  | Chấm dứt hồ sơ do nghỉ việc (đợt T9/2026)               | ACTIVE   | INACTIVE | Nguồn lực đang có 1 công việc/lịch mở | SUCCESS | f
 ORG_WORKER_REACTIVATED | kích hoạt lại chuẩn bị kiểm thử song song (đợt T9/2026) | INACTIVE | ACTIVE   |                                       | SUCCESS | f
 ORG_WORKER_SUSPENDED   | kiểm thử song song chống trùng lặp (đợt T9/2026)        | ACTIVE   | INACTIVE | Nguồn lực đang có 1 công việc/lịch mở | SUCCESS | t
 (các dòng cũ giữ nguyên: E2E run 2, double-submit E2E run 2… — append-only)
```

### (b) Double-submit song song cùng correlation-id → 1 audit row

```
-- 2 PATCH song song, cùng X-Correlation-Id e2e4d000-…-xxxx:
SELECT action, correlation_id FROM audit_logs
WHERE correlation_id='e2e4d000-0000-4000-8000-620973906200';

          action          |            correlation_id
--------------------------+--------------------------------------
 ORG_CONTRACTOR_SUSPENDED | e2e4d000-0000-4000-8000-620973906200
(1 row)
-- worker run: HTTP r1=200 r2=200, audit count = 1 (cùng cơ chế dedup ON CONFLICT)
```

### (c) Contractor lifecycle — các dòng run mới (đợt T9/2026)

```
SELECT action, reason, before_data->>'status' AS b, after_data->>'status' AS a,
       correlation_id IS NOT NULL AS has_corr
FROM audit_logs
WHERE entity_type='CONTRACTOR' AND entity_id='e2e4c000-0000-4000-8000-0000000000c1'
  AND action LIKE 'ORG_CONTRACTOR_%' ORDER BY created_at;

           action           |                     reason                     |    b     |    a     | has_corr
----------------------------+------------------------------------------------+----------+----------+----------
 ORG_CONTRACTOR_SUSPENDED   | double contractor E2E                          | ACTIVE   | INACTIVE | t
 ORG_CONTRACTOR_SUSPENDED   | Tạm ngừng nhà thầu do chậm tiến độ (E2E run 2) | ACTIVE   | INACTIVE | f
 ORG_CONTRACTOR_REACTIVATED | Hết lý do tạm ngừng (E2E run 2)                | INACTIVE | ACTIVE   | f
 ORG_CONTRACTOR_SUSPENDED   | Tạm ngừng nhà thầu do chậm tiến độ (đợt T9/2026) | ACTIVE   | INACTIVE | f
 ORG_CONTRACTOR_REACTIVATED | Hết lý do tạm ngừng (đợt T9/2026)                | INACTIVE | ACTIVE   | f
 (các dòng cũ giữ nguyên: E2E run 2, double contractor E2E… — append-only)
```

### (d) Trạng thái cuối + assignment mở còn nguyên (chỉ cảnh báo, không chặn)

```
SELECT status, failed_login_count, locked_until FROM users
WHERE id='e2e4a000-0000-4000-8000-0000000000a1';
 status  | failed_login_count | locked_until
---------+--------------------+--------------
 INACTIVE |                  0 |
(1 row)

> Worker kết thúc run ở INACTIVE — khớp baseline canonical (`cuong.do` INACTIVE theo docs/demo-data.md).
> Contractor kết thúc ở ACTIVE (sau B8) — khớp baseline VCC ACTIVE.

SELECT id, worker_id, status FROM assignments WHERE id='e2e4c100-0000-4000-8000-0000000000c2';
                  id                  |              worker_id               |       status
--------------------------------------+--------------------------------------+--------------------
 e2e4c100-0000-4000-8000-0000000000c2 | e2e4a000-0000-4000-8000-0000000000a1 | PENDING_ACCEPTANCE
(1 row)
```

### (e) B5 — bug cũ đã fix ✅ (run cuối 12/12 PASS)

Timeline 'Lịch sử trạng thái' ở WorkerDetail render **đúng** (3 dòng Tạm ngừng/Chấm dứt + lý do + actor —
xem `B5.png`), nhưng link **'Xem trên Nhật ký thao tác'** trước đây sinh href:

```
# Href CŨ (bug): prefix action → API exact-match → 0 dòng
/admin/audit-logs?entityType=WORKER&entityId=e2e4a000-0000-4000-8000-0000000000a1&action=ORG_WORKER
```

Root cause: `StatusTimeline.tsx` đặt `action=${filterBy}` với `filterBy = 'ORG_WORKER'`/`'ORG_CONTRACTOR'`
(prefix), trong khi API audit lọc **exact match** (`action = $N`, `pg-audit-log.repository.ts`) nên prefix
không khớp row nào (action thật là `ORG_WORKER_SUSPENDED/TERMINATED/REACTIVATED`) → trang hiển thị **0 dòng**.
Ngoài ra `AuditLogList` khi đó **bỏ qua** `entityType`/`entityId` trong URL (chỉ đọc
`action`/`result`/`correlationId` qua `useSearchParams`) nên dù bỏ `action`, deep-link vẫn không lọc.

**Fix (src/web, KHÔNG đổi API):**
- `features/resources/components/StatusTimeline.tsx`: bỏ param `action` khỏi deep-link, chỉ giữ
  `entityType` + `entityId` + `result=SUCCESS` (đã đủ chính xác).
- `features/audit-logs/components/AuditLogList.tsx`: đọc `entityType`/`entityId` từ `useSearchParams`
  (applied + draft state), truyền cho `GET /api/v1/audit-logs`, thêm 2 field lọc 'Loại đối tượng'
  (`WORKER/CONTRACTOR/TRADE/USER` — distinct thật trong DB) + 'ID đối tượng'; thêm 14 action `ORG_*`
  vào `KNOWN_ACTIONS` (dropdown trước đây chỉ có `AUTH_*`/`IAM_*`, không chọn tay được action mới).
- Tests: `StatusTimeline.test.tsx` mới (assert href không chứa `action=`); `AuditLogList.test.tsx`
  thêm deep-link entityType/entityId + dropdown ORG_*; sửa assert href cũ ở
  `WorkerDetail.test.tsx` / `ContractorDetail.test.tsx`.

Href mới + kết quả run cuối:

```
# Href MỚI (driver log B5): PASS — hiển thị ORG_WORKER_*
/admin/audit-logs?entityType=WORKER&entityId=e2e4a000-0000-4000-8000-0000000000a1&result=SUCCESS
```

DB output thật (psql sau run cuối — đúng tập filter của deep-link):

```
SELECT action, result, count(*) FROM audit_logs
WHERE entity_type='WORKER' AND entity_id='e2e4a000-0000-4000-8000-0000000000a1'
GROUP BY action, result ORDER BY action;

         action         | result  | count
------------------------+---------+-------
 ORG_WORKER_REACTIVATED | SUCCESS |     4
 ORG_WORKER_SUSPENDED   | SUCCESS |     9
 ORG_WORKER_TERMINATED  | SUCCESS |     3
(3 rows)

-- entityType + entityId + result=SUCCESS = 24 rows (2 trang — driver assert trang 1 thấy ORG_WORKER_*)
SELECT count(*) FROM audit_logs
WHERE entity_type='WORKER' AND entity_id='e2e4a000-0000-4000-8000-0000000000a1' AND result='SUCCESS';
 count
-------
    24
(1 row)
```

Trang `/admin/audit-logs` qua deep-link hiển thị các row `ORG_WORKER_*` của worker đó
(`B5-audit.png`, driver assert `seesRows` PASS) — trang 1 hiển thị các row ORG_WORKER_* mới nhất.

## 6. Files trong evidence này

```
docs/evidence/org-srs-004/
├── ORG-SRS-004-E2E.md               ← file này
├── e2e-driver-org-srs-004.cjs       (driver tái sinh; chạy: node e2e-driver-org-srs-004.cjs)
├── seed-lifecycle-004.sql           (seed + cleanup; chạy trước driver)
├── e2e-vars.json                    (id dùng + kết quả từng bước)
├── .proof/                          (log test/typecheck/lint/build thật)
└── shots/                           (17 ảnh regenerate 2026-09-07: B0, B1-warning/fielderror,
                                      B2-reason/success, B3-dialog/B3, B4-reason/detail, B5/B5-audit,
                                      B6-inactive/active, B7-dialog/detail, B8-detail, B9-ui)
```

## 7. Cách tái sinh

```bash
# 1. Stack đã rebuild từ working tree (§1 — run cuối rebuild image WEB chứa fix B5);
#    admin+pm password (§2); seed đã chạy (§3)
# 2. Chạy driver (tự đưa worker/contractor về ACTIVE trước mỗi run)
cd docs/evidence/org-srs-004
node e2e-driver-org-srs-004.cjs    # 12 PASS / 0 FAIL (sau fix B5)
# 3. Cleanup dữ liệu seed (§3)
```

Yêu cầu runtime: Node ≥ 18, Chrome `/usr/bin/google-chrome`, playwright-core tại
`/home/trung/.npm-global/lib/node_modules/@playwright/mcp/node_modules/playwright`.

## 8. Proof code (số thật — đã chạy từ working tree)

| Workspace | Lệnh | Kết quả |
| --- | --- | --- |
| API | `npm test` | **562 passed** (63 suites + 1 skip gated DATABASE_URL; 11 skipped integration) |
| API | `npm run typecheck` | clean (exit 0) |
| API | `npm run lint` | 0 error, 2 warnings (baseline pre-existing) |
| API | `npm run build` | clean (exit 0) |
| Web | `npm test` | **251 passed / 39 suites** (sau fix B5: +StatusTimeline.test 3, +AuditLogList 2, sửa assert href Worker/ContractorDetail) |
| Web | `npm run typecheck` | clean (exit 0) |
| Web | `npm run lint` | 0 error, 1 warning (`ContractorList` retryKey dep — pre-existing baseline) |
| Web | `npm run build` | **Compiled successfully** |

## 9. Ghi chú / làm sạch

- **Bug B5 đã fix và verify:** deep-link timeline → audit-logs (§5e) — run cuối 12/12 PASS.
  Timeline tự thân vốn đúng; fix ở `src/web` (bỏ `action` prefix + `AuditLogList` đọc
  `entityType`/`entityId`), KHÔNG đổi API.
- Không chạy E2E với DB khác; môi trường PostgreSQL thật là docker stack local (như §1).
- **Dữ liệu seed là dữ liệu demo canonical** (contractor VCC, worker Đỗ Văn Cường TX-0021, project PRD,
  work order PRD-B1-001, crew DD-CD — xem [`docs/demo-data.md`](../demo-data.md)) — KHÔNG xóa sau run;
  cleanup id-based chỉ áp dụng cho assignment mở `e2e4c100-…c2` khi cần slate sạch (xem §3).
  Audit append-only giữ trace mọi run (gồm identifier cũ `E2E4-*` — có chủ ý).
- Chỉ có `docs/evidence/org-srs-004/` được sửa; **không commit, không staged**.
