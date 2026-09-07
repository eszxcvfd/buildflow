# ORG-SRS-001/002 — E2E Evidence: Workers (#24) & Contractors (#25)

> **Loại bằng chứng:** Browser E2E thật (UI → API → PostgreSQL → UI), chụp screenshot lưu trong repo.
> **Ngày chạy:** 2026-09-07 (giờ UTC, theo `created_at` trong DB; run realistic-data UNIQ=r4pcgq/DIGITS=785626, b2-fix UNIQ=273192) — **B2 re-run sau fix #25: PASS (xem §6b + §5 B2-fix)**
> **Trạng thái tổng:** 17/17 bước PASS — B2 (edit nhà thầu, issue #25) đã **PASS sau fix** (xem §6b)
> **Phạm vi:** chỉ sửa file dưới `docs/evidence/` — **không commit**, không sửa source.
>
> **Chuẩn hóa dữ liệu realistic 2026-09-07** (theo [`docs/demo-data.md`](../demo-data.md)):
> mọi identifier runtime trong evidence này dùng tên Việt + email `@vinacons.vn` + mã `TX-9xxx`/`XD-*`/`SCC-*`;
> các dòng audit lịch sử vẫn giữ identifier cũ (`admin@example.com`, `E2E*`, …) là **có chủ ý**
> (bảng `audit_logs` append-only).

---

## 1. Môi trường

| Hạng mục | Giá trị |
| --- | --- |
| Repo | `/home/trung/Documents/2026/project/buildflow` |
| Commit HEAD | `cb1fa86` (main) |
| API base | `http://localhost:3000` (container `buildflow-api-1`, healthy) |
| Web base | `http://localhost:3001` (container `buildflow-web-1`, healthy) |
| PostgreSQL | `localhost:5432` — `docker exec buildflow-postgres-1 psql -U buildflow -d buildflow` |
| Redis | `localhost:6379` (container `buildflow-redis-1`) |
| Mobile | `localhost:19006` (container `buildflow-mobile-1`) |
| Browser | Google Chrome 151.0.7922.173 (headless) qua Playwright 1.61 (playwright-core từ `@playwright/mcp`) |
| DB migrations | 0001 baseline → 0004 audit retention (4/4, xem `schema_migrations`) |

Trạng thái stack (chụp lúc test):

```
buildflow-web-1       127.0.0.1:3001->3001/tcp   Up (healthy)
buildflow-api-1       127.0.0.1:3000->3000/tcp   Up (healthy)
buildflow-postgres-1  127.0.0.1:5432->5432/tcp   Up (healthy)
buildflow-redis-1     127.0.0.1:6379->6379/tcp   Up (healthy)
buildflow-mobile-1    127.0.0.1:19006->19006/tcp Up (healthy)
```

## 2. Tài khoản sử dụng + cách cấp quyền

| Email | Vai trò | Ghi chú |
| --- | --- | --- |
| `hoang.anh@vinacons.vn` | ADMIN + STAFF | **Password đã bị reset** cho E2E (xem dưới; email realistic từ 2026-09-07, password `E2EAdmin@2025` giữ nguyên) |
| `quoc.tran@vinacons.vn` | PROJECT_MANAGER | không dùng |
| `thang.nguyen@vinacons.vn`, `hau.le@vinacons.vn` | WORKER | seed realistic, không dùng |

### Reset password admin (đã thực hiện — để tái sinh)

Password cũ không biết (`POST /api/v1/auth/login` với dự đoán mặc định → `401`). Đã reset bằng bcryptjs (đúng `BcryptHasherService`: `genSalt(10)`):

```bash
cd src/api
node -e "console.log(require('bcryptjs').hashSync('E2EAdmin@2025', require('bcryptjs').genSaltSync(10)))"
```

Lấy hash `$2b$10$hQAuuPyiOmq699uMWg5rBuMAoiTWnY8oPp.M0FGqxbTesLzbglpOe` rồi:

```bash
docker exec buildflow-postgres-1 psql -U buildflow -d buildflow -c \
  "UPDATE users SET password_hash='\$2b\$10\$hQAuuPyiOmq699uMWg5rBuMAoiTWnY8oPp.M0FGqxbTesLzbglpOe', updated_at=now()
   WHERE email='hoang.anh@vinacons.vn' RETURNING email, status, user_type;"
```

Xác minh login qua API:

```
$ curl -X POST http://localhost:3000/api/v1/auth/login -H 'Content-Type: application/json' \
    -d '{"email":"hoang.anh@vinacons.vn","password":"E2EAdmin@2025"}'
{"accessToken":"eyJhbGciOiJIUzI1NiIs...","roles":["ADMIN","STAFF"],...}
```

> ⚠️ Sau khi test, password admin đã được giữ là `E2EAdmin@2025` (để tái sinh). Nếu cần trả về password cũ, phải reset lại.

## 3. Dữ liệu seed liên quan

- Trade hợp lệ duy nhất: `11111111-1111-4111-8111-111111111111` (Tho cat gach)
- Contractor seed: `20000000-...-0001` (Công ty TNHH Xây dựng Nam Tiến), `20000000-...-0002` (Công ty CP Hạ tầng Bình Minh) — cả 2 ACTIVE
- Kiểm tra schema trước (tên cột thật): `users` có `user_type`, `employee_code`, `status`; `contractors` có `status`, `note` (ánh xạ field `scope`), **không có cột `scope`**; `audit_logs` có trigger **append-only** (chặn DELETE/UPDATE)

## 4. Kịch bản & kết quả từng bước

**Ký hiệu:** 🟢 PASS · 🔴 FAIL (bug thật) · 📸 ảnh trong `docs/evidence/org-srs-001-002/shots/`

### A. Workers (issue #24)

| # | Bước | Kết quả | Bằng chứng UI | Bằng chứng DB |
| --- | --- | --- | --- | --- |
| A1 | Login admin → redirect `/dashboard` | 🟢 PASS | `A1.png` (form login) | — |
| A2 | Tạo worker `khoi.pham.<digits>@vinacons.vn` (mã `TX-9xxx`) kèm trade + skill Lv3 | 🟢 PASS | `A2-2.png` (worker xuất hiện trong list) | 1 users row WORKER/ACTIVE + 1 resource_trades (xem §5) |
| A3 | Tạo trùng email → lỗi 409 theo field | 🟢 PASS | `A3-2.png` ("Email đã tồn tại") | API 409 |
| A3b | Tạo trùng employee code → lỗi 409 theo field | 🟢 PASS | (cùng form; log console 409) | API 409 |
| A4 | Tạo với trade không tồn tại → 400 (kiểm qua API; UI giờ là `<select>` chỉ chứa trade ACTIVE nên không nhập tay trade lạ) | 🟢 PASS | `A4.png` (form) | API 400 `"Trade không tồn tại..."` |
| A5 | Search worker theo employee code | 🟢 PASS | `A5.png` (chỉ 1 card khớp) | — |
| A6 | Edit đổi tên worker (`Phạm Văn Khôi <digits>` → `… Mới`) → save | 🟢 PASS | `A6-2.png` (list hiển thị tên mới) | `full_name` đổi (xem §5) + audit `ORG_WORKER_UPDATED` |
| A7 | Tạm ngừng worker (dialog lifecycle + lý do) | 🟢 PASS | `A7-final-confirm.png` (dialog), `A7-final-list.png` (INACTIVE trên list) | status INACTIVE + audit `ORG_WORKER_SUSPENDED` có reason + before/after |
| A8 | Kích hoạt lại worker | 🟢 PASS | `A8-final-list.png` (nút "Tạm ngừng" trở lại) | status ACTIVE + audit `ORG_WORKER_REACTIVATED` |
| A9 | Mở `/admin/audit-logs` thấy ORG entries | 🟢 PASS | `A9-ORG_WORKER_SUSPENDED.png` (bộ lọc action) | audit rows cho worker run |

### B. Contractors (issue #25)

| # | Bước | Kết quả | Bằng chứng UI | Bằng chứng DB |
| --- | --- | --- | --- | --- |
| B1 | Tạo contractor mới (`XD-<digits>` / `XD2-<digits>`) | 🟢 PASS | `B1p3-list.png` (contractor P2 trong list) | contractors run `XD-*` (xem §5) |
| B2 | **Edit contact/scope contractor** | 🟢 **PASS** (sau fix #25) | `B2-fix-active-edit-form.png` / `B2-fix-active-detail.png` (ACTIVE), `B2-fix-inactive-edit-form.png` / `B2-fix-inactive-detail.png` (INACTIVE) | PATCH → **200** cả contractor ACTIVE lẫn INACTIVE; contact/scope đổi trong DB; audit **`ORG_CONTRACTOR_UPDATED`** có before/after (xem §5 B2-fix) |
| B3 | Tạm ngừng contractor (dialog lifecycle + lý do) | 🟢 PASS | `B3p3-detail.png` (detail INACTIVE sau dialog) | status INACTIVE + audit `ORG_CONTRACTOR_SUSPENDED` |
| B4 | List filter `eligibleOnly` / `status` | 🟢 PASS | `B4p3-eligible.png` (eligibleOnly=true ẩn INACTIVE) | — |
| B5 | Detail contractor INACTIVE vẫn xem được (không hard delete) | 🟢 PASS | `B5p3-detail.png` (detail INACTIVE render bình thường) | contractors INACTIVE vẫn tồn tại trong DB |

**Tổng: 17 PASS / 17 bước** (tính cả A3b) — 0 FAIL sau fix #25.

## 5. DB verification (output thật từ `psql`)

### A6: rename worker (run realistic 2026-09-07, id `006b1e11-…`)

```
$ SELECT full_name, employee_code, status FROM users WHERE id='006b1e11-...';
        full_name         | employee_code | status
--------------------------+---------------+--------
 Phạm Văn Khôi 785626 Mới | TX-95626      | ACTIVE
```

Audit trail worker (create → update rename → suspend/reactivate ×4 qua các phase A7/A8/p2/p3 — tổng 12 rows, mẫu mỗi chu kỳ):

```
         action         |    b     |    a     |                       n
------------------------+----------+----------+-----------------------------------------------
 ORG_WORKER_CREATED     |          | ACTIVE   |
 ORG_WORKER_UPDATED     | ACTIVE   | ACTIVE   |
 ORG_WORKER_SUSPENDED   | ACTIVE   | INACTIVE | Tạm ngừng để luân chuyển sang công trình khác
 ORG_WORKER_REACTIVATED | INACTIVE | ACTIVE   | Tiếp nhận lại vào đội thi công
```

### A7: tạm ngừng lifecycle — trạng thái + audit (actor = admin `11111111-...`)

```
          email           |         full_name         |  status
--------------------------+---------------------------+----------
 khoi.pham.785626@vinacons.vn | Phạm Văn Khôi 785626 Mới | INACTIVE (sau A7-final; ACTIVE trở lại sau A8)

            actor_user_id             |        action        | entity_type |              entity_id               | before_status | after_status
--------------------------------------+----------------------+-------------+--------------------------------------+---------------+--------------
 11111111-1111-4111-8111-111111111111 | ORG_WORKER_SUSPENDED | WORKER      | 006b1e11-7b7a-41e0-8358-dcc1efada418 | ACTIVE        | INACTIVE
```

### A8: kích hoạt lại

```
          email           | status
--------------------------+--------
 khoi.pham.785626@vinacons.vn | ACTIVE

        action        |    b     |   a
----------------------+----------+--------
 ORG_WORKER_REACTIVATED | INACTIVE | ACTIVE
```

### B1–B3: contractors run cuối phiên (2026-09-07)

```
    code    |                name                 |  status  |                  note                  | contact_name
------------+-------------------------------------+----------+----------------------------------------+---------------
 XD-785626  | Công ty TNHH Xây dựng An Khang 5626 | INACTIVE | Thi công phần thô và hoàn thiện khu B1 | Trần Văn Bình
 XD2-785626 | Công ty CP Cơ khí Đông Anh 5626     | INACTIVE | Thi công cốp pha và cốt thép           | Trần Văn Đông
 XD3-785626 | Công ty TNHH Hoàn thiện Sao Mai 5626| ACTIVE   | Thi công hoàn thiện và sơn nước        | Vũ Văn Hải Mới
```

Audit contractor P1 (`XD-785626` — UPDATED của B2 edit, rồi SUSPENDED của B3):

```
          action          |   b    |    a     |                  reason
--------------------------+--------+----------+------------------------------------------
 ORG_CONTRACTOR_CREATED   |        | ACTIVE   |
 ORG_CONTRACTOR_UPDATED   | ACTIVE | ACTIVE   |
 ORG_CONTRACTOR_SUSPENDED | ACTIVE | INACTIVE | Tạm ngừng do chậm tiến độ tập kết vật tư
```

Audit contractor P2 (`XD2-785626` — cùng mẫu CREATED → UPDATED → SUSPENDED).

> Lưu ý: từ khi ContractorDetail/WorkerList dùng luồng lifecycle, audit đổi trạng thái là
> `ORG_*_SUSPENDED`/`ORG_*_REACTIVATED` (kèm `reason`); các dòng `ORG_CONTRACTOR_STATUS_CHANGED` /
> `IAM_USER_DEACTIVATED` của các run cũ vẫn nằm trong lịch sử append-only (xem ghi chú chuẩn hóa ở đầu file).

> Lưu ý: **không có `ORG_CONTRACTOR_UPDATED`** — bằng chứng cho FAIL B2 (trước fix).

### B2 re-run sau fix #25 (run realistic 2026-09-07, UNIQ=273192) — DB + audit

Contractor thật sau 2 lần edit qua UI (status KHÔNG đổi — ACTIVE giữ ACTIVE, INACTIVE giữ INACTIVE):

```
SELECT code, status, contact_name AS contact, note AS scope FROM contractors
WHERE code IN ('SCC-273192','SCC2-273192') ORDER BY code;

    code     |  status  |     contact_name     |                   note
-------------+----------+----------------------+-------------------------------------------
 SCC-273192  | ACTIVE   | Phạm Văn Sửa Mới     | Sửa chữa phần thô và hoàn thiện nhà xưởng
 SCC2-273192 | INACTIVE | Phạm Văn Cải Tạo Mới | Cải tạo cốp pha và cốt thép
```

Audit contractor — cả 2 edit same-status đều ghi `ORG_CONTRACTOR_UPDATED` (PATCH 200; phase
INACTIVE có thêm `ORG_CONTRACTOR_SUSPENDED` của bước tạm ngừng trước khi edit; audit dùng key
`contactName`/`scope`):

```
         action          |    b_contact   |      a_contact       |                 scope                | result
--------------------------+----------------+----------------------+--------------------------------------+--------
 ORG_CONTRACTOR_CREATED   |                | Phạm Văn Sửa         | Sửa chữa phần thô nhà xưởng          | SUCCESS
 ORG_CONTRACTOR_UPDATED   | Phạm Văn Sửa   | Phạm Văn Sửa Mới     | Sửa chữa phần thô và hoàn thiện ...  | SUCCESS
 ORG_CONTRACTOR_CREATED   |                | Phạm Văn Sửa         | Sửa chữa phần thô nhà xưởng          | SUCCESS
 ORG_CONTRACTOR_SUSPENDED |                |                      |                                      | SUCCESS
 ORG_CONTRACTOR_UPDATED   | Phạm Văn Sửa   | Phạm Văn Cải Tạo Mới | Cải tạo cốp pha và cốt thép          | SUCCESS
```

### B5: contractor INACTIVE vẫn truy được (không hard delete)

```
-- Contractors seed realistic (VCC/NTA/HTB) không bị ảnh hưởng; contractors run XD-*/SCC-* INACTIVE vẫn tồn tại:
SELECT code, status FROM contractors WHERE code LIKE 'XD%' OR code LIKE 'SCC%' ORDER BY code;
    code    |  status
------------+----------
 XD-785626  | INACTIVE
 XD2-785626 | INACTIVE
 XD3-785626 | ACTIVE
 SCC-273192 | ACTIVE
 SCC2-273192| INACTIVE
```

## 6. 🔴 BUG REPORT (FAIL B2 — issue #25, Edit nhà thầu)

### Hiện tượng
Không thể **sửa contact/scope của contractor** qua UI `ContractorForm` — mọi submit **đều bị API từ chối 400** kể cả khi chỉ đổi contact/scope (không đổi trạng thái).

### Nguyên nhân (trace qua network)
1. `ContractorForm` (web) **luôn gửi `status` trong PATCH**, giá trị mặc định là status hiện tại (ACTIVE cho contractor ACTIVE; INACTIVE cho contractor INACTIVE):
   ```
   PATCH /api/v1/contractors/6f0131d2-...  400
   {"message":"Nhà thầu đã ở trạng thái INACTIVE","error":"Bad Request","statusCode":400}
   PATCH /api/v1/contractors/3e42e88d-...  400
   {"message":"Nhà thầu đã ở trạng thái ACTIVE","error":"Bad Request","statusCode":400}
   ```
2. `update-contractor.use-case.ts` (API) **reject mọi request có `status` trùng với status hiện tại**:
   ```ts
   } else if (input.status !== undefined && input.status === contractor.status) {
     throw new BadRequestException(`Nhà thầu đã ở trạng thái ${input.status}`);
   }
   ```
   ⇒ Bất kỳ edit nào qua form cũng trả 400; **không ghi `ORG_CONTRACTOR_UPDATED`**, DB không đổi.

### Ảnh hưởng
- B2 (edit contact/scope) **không hoạt động** cho cả contractor ACTIVE lẫn INACTIVE.
- B3 (đổi trạng thái) vẫn hoạt động vì kịch bản đó cố tình đổi `status` → giá trị gửi đi khác status hiện tại (và confirm dialog UI gửi đúng `{ status }`).

### Gợi ý sửa (ngoài phạm vi — không sửa source theo task)
- Web: chỉ gửi `status` khi người dùng thật sự đổi nó (như `WorkerForm` đã làm — worker edit không gửi status, nên A6 PASS).
- Hoặc API: bỏ reject khi `input.status === contractor.status` (coi như no-op + audit `ORG_CONTRACTOR_UPDATED`).

> Không có unit test cho `ContractorForm` (chỉ có `contractor.schema.spec.ts`), nên lỗi này không bị bắt ở tầng test web.

### 6b. ✅ Đã fix (cùng đợt ghi evidence này, bên ngoài phạm vi docs)
- **API (`src/api/.../update-contractor.use-case.ts`):** bỏ nhánh `throw BadRequestException('Nhà thầu đã ở trạng thái X')` khi `input.status === contractor.status` — same-status giờ là no-op; `changeStatus` chỉ chạy khi status thực sự đổi; audit action vẫn tính đúng theo `before.status` (`ORG_CONTRACTOR_UPDATED` cho same-status + đổi field khác, `ORG_CONTRACTOR_STATUS_CHANGED` khi status đổi).
- **Web (`src/web/.../ContractorForm.tsx`):** chỉ đưa `status` vào PATCH khi nó thực sự đổi so với giá trị ban đầu; giữ nguyên status → omit khỏi payload. Confirm dialog ACTIVE→INACTIVE giữ nguyên (giờ là gate chặn submit tới khi xác nhận).
- Re-run E2E (driver `e2e-driver-b2-fix.cjs`): cả 2 PATCH edit same-status trả **HTTP 200**, DB + audit cập nhật như §5 B2-fix → **B2 PASS**.

## 7. Cleanup (id-based + fallback cửa sổ created_at)

Driver phase 1 (`e2e-driver.cjs`) tự dọn dư liệu run trước **trước khi tạo mới**, theo id đã ghi trong
`e2e-vars.json` / `e2e-b2fix-ids.json` (chỉ xóa khi mã vẫn là mã run `TX-8/TX-9xxx`, `XD*`, `SCC*` —
không đụng mã canonical `TX-00xx`, `VCC`/`NTA`/`HTB`), fallback xóa hàng run-pattern
tạo trong 12h gần nhất:

```sql
DELETE FROM resource_trades WHERE user_id IN (<workerId run trước>);
DELETE FROM users WHERE id IN (<workerId run trước>) AND employee_code LIKE 'TX-9%';
DELETE FROM contractors WHERE code IN (<mã XD*/SCC* run trước>);
-- fallback:
DELETE FROM users WHERE employee_code LIKE 'TX-9%' AND created_at > now() - interval '12 hours';
DELETE FROM contractors WHERE (code LIKE 'XD%' OR code LIKE 'SCC%') AND created_at > now() - interval '12 hours';
```

Dữ liệu run cuối (worker `khoi.pham.785626@vinacons.vn` + 5 contractors `XD-*`/`SCC-*`) được **giữ lại**
làm bằng chứng cho §5; run sau sẽ dọn sạch trước khi chạy (re-run đã kiểm chứng sạch).

> Audit rows **không xóa được** (append-only guard IAM-SRS-008 đúng thiết kế) — audit các run còn lại như trace lịch sử.

## 8. Cách tái sinh (từ repo / máy có node + chrome)

### Điều kiện tiên quyết
```bash
docker compose up -d            # trong infra/docker (services healthy)
curl -s http://localhost:3001/  # web 200
cd src/api && node -e "console.log(require('bcryptjs').hashSync('E2EAdmin@2025', require('bcryptjs').genSaltSync(10)))"
# update password_hash admin (xem §2)
```

### Chạy driver
```bash
cd docs/evidence/org-srs-001-002
node e2e-driver.cjs          # phase 1: cleanup run cũ + login, create worker, dupl 409, bad trade 400 (API), search, contractor P1
node e2e-driver-p2.cjs       # phase 2: worker rename + suspend/reactivate lifecycle + contractor edit (UI)
node e2e-driver-p3.cjs w-deact      # tạm ngừng worker (dialog lifecycle) → chụp ảnh
# → verify DB: SELECT ... ORG_WORKER_SUSPENDED ...
node e2e-driver-p3.cjs w-reactivate # kích hoạt lại → chụp ảnh
# → verify DB: ORG_WORKER_REACTIVATED
node e2e-driver-p3.cjs ctr-full     # create P2, edit, tạm ngừng lifecycle → chụp ảnh
# → verify DB: contractors + audit
node e2e-driver-p3.cjs views        # filters + detail + audit-logs deep-link → chụp ảnh
node e2e-driver-p2b.cjs             # tạo contractor ACTIVE XD3-* + edit contact/scope → chụp ảnh
node e2e-driver-b2-fix.cjs          # [sau fix] edit contact/scope status KHÔNG đổi (ACTIVE + INACTIVE) → PASS, PATCH 200
```

Yêu cầu runtime:
- Node ≥ 18, Chrome tại `/usr/bin/google-chrome` (đổi `executablePath` nếu khác máy)
- Playwright core: `require('/…/node_modules/@playwright/mcp/node_modules/playwright')` — cài `npm i -g @playwright/mcp` cho playwright-core; hoặc `npm i playwright-core` và đổi require.

Các lệnh DB verify nên chạy **giữa** các phase (xem §5), theo đúng id/UUID mà driver đã resolve vào `e2e-vars.json`
(`workerId`, `contractorId`, `contractorId2` — không còn hardcode UUID trong driver).
`e2e-vars.json` mẫu run cuối: `uniq=r4pcgq`, `digits=785626`, worker `khoi.pham.785626@vinacons.vn`/`TX-95626`,
contractors `XD-785626`/`XD2-785626` (+`XD3-785626` từ p2b), b2-fix `SCC-273192`/`SCC2-273192`.

## 9. Files trong evidence này

```
docs/evidence/org-srs-001-002/
├── ORG-SRS-001-002-E2E.md        ← file này
├── e2e-driver.cjs, e2e-driver-p2.cjs, e2e-driver-p3.cjs, e2e-driver-p2b.cjs
├── e2e-driver-b2-fix.cjs         (re-run B2 sau fix #25)
├── e2e-vars.json                 (uniq + digits + worker/contractor ids đã resolve)
├── e2e-b2fix-ids.json            (ids 2 contractors B2-fix)
├── e2e-results*.json             (kết quả từng phase)
├── e2e-b2fix-patch-responses.json (HTTP status thật của PATCH)
└── shots/                        (ảnh regenerate 2026-09-07: A1–A9, B1–B5, p3 phases, B2-fix)
```