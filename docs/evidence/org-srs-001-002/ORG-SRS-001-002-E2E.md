# ORG-SRS-001/002 — E2E Evidence: Workers (#24) & Contractors (#25)

> **Loại bằng chứng:** Browser E2E thật (UI → API → PostgreSQL → UI), chụp screenshot lưu trong repo.
> **Ngày chạy:** 2026-09-05 (giờ UTC, theo `created_at` trong DB) — **B2 re-run sau fix #25: 2026-09-05 16:50 UTC**
> **Trạng thái tổng:** 17/17 bước PASS — B2 (edit nhà thầu, issue #25) đã **PASS sau fix** (xem §6b)
> **Phạm vi:** chỉ tạo file mới dưới `docs/evidence/` — **không commit**, không sửa source.

---

## 1. Môi trường

| Hạng mục | Giá trị |
| --- | --- |
| Repo | `/home/trung/Documents/2026/project/buildflow` |
| Commit HEAD | `7f12d239a77c7abcc41214a063e271fe8d9014b4` — `feat(org): worker management web vertical slice ORG-SRS-001 #24` |
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
| `admin@example.com` | ADMIN + STAFF | **Password đã bị reset** cho E2E (xem dưới) |
| `pm@example.com` | PROJECT_MANAGER | không dùng |
| `worker1@example.com`, `worker2@example.com` | WORKER | seed, không dùng |

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
   WHERE email='admin@example.com' RETURNING email, status, user_type;"
```

Xác minh login qua API:

```
$ curl -X POST http://localhost:3000/api/v1/auth/login -H 'Content-Type: application/json' \
    -d '{"email":"admin@example.com","password":"E2EAdmin@2025"}'
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
| A2 | Tạo worker `e2e.w.<uniq>@example.com` kèm trade + skill Lv3 | 🟢 PASS | `A2-2.png` (worker xuất hiện trong list) | 1 users row WORKER/ACTIVE + 1 resource_trades (xem §5) |
| A3 | Tạo trùng email → lỗi 409 theo field | 🟢 PASS | `A3-2.png` ("Email đã tồn tại") | API 409 |
| A3b | Tạo trùng employee code → lỗi 409 theo field | 🟢 PASS | (cùng form; log console 409) | API 409 |
| A4 | Tạo với trade không tồn tại → lỗi 400 field-level | 🟢 PASS | `A4-2.png` ("Trade không tồn tại hoặc đã ngừng hoạt động: ...") | API 400 |
| A5 | Search worker theo employee code | 🟢 PASS | `A5.png` (chỉ 1 card khớp) | — |
| A6 | Edit đổi tên worker → save | 🟢 PASS | `A6-2.png` (list hiển thị tên mới) | `full_name` đổi (xem §5) + audit `ORG_WORKER_UPDATED` |
| A7 | Deactivate worker (confirm dialog) | 🟢 PASS | `A7-final-confirm.png` (dialog), `A7-final-list.png` (INACTIVE trên list) | status INACTIVE + audit `IAM_USER_DEACTIVATED` có actor + before/after |
| A8 | Reactivate worker | 🟢 PASS | `A8-final-list.png` (nút "Ngừng hoạt động" trở lại) | status ACTIVE + audit `IAM_USER_REACTIVATED` |
| A9 | Mở `/admin/audit-logs` thấy ORG/IAM entries | 🟢 PASS | `A9-IAM_USER_DEACTIVATED.png` (bộ lọc action) | 6 audit rows cho worker E2E |

### B. Contractors (issue #25)

| # | Bước | Kết quả | Bằng chứng UI | Bằng chứng DB |
| --- | --- | --- | --- | --- |
| B1 | Tạo contractor mới | 🟢 PASS | `B1p3-list.png` (contractor P2 trong list) | 3 contractors `E2E%` được tạo (xem §5) |
| B2 | **Edit contact/scope contractor** | 🟢 **PASS** (sau fix #25) | `B2-fix-active-edit-form.png` / `B2-fix-active-detail.png` (ACTIVE), `B2-fix-inactive-edit-form.png` / `B2-fix-inactive-detail.png` (INACTIVE) | PATCH → **200** cả contractor ACTIVE lẫn INACTIVE; contact/scope đổi trong DB; audit **`ORG_CONTRACTOR_UPDATED`** có before/after (xem §5 B2-fix) |
| B3 | Deactivate contractor (confirm) | 🟢 PASS | `B3p3-detail.png` (detail INACTIVE sau confirm) | status INACTIVE + audit `ORG_CONTRACTOR_STATUS_CHANGED` |
| B4 | List filter `eligibleOnly` / `status` | 🟢 PASS | `B4p3-eligible.png` (eligibleOnly=true ẩn INACTIVE) | — |
| B5 | Detail contractor INACTIVE vẫn xem được (không hard delete) | 🟢 PASS | `B5p3-detail.png` (detail INACTIVE render bình thường) | contractors INACTIVE vẫn tồn tại trong DB |

**Tổng: 17 PASS / 17 bước** (tính cả A3b) — 0 FAIL sau fix #25.

## 5. DB verification (output thật từ `psql`)

### A6: rename worker

```
$ SELECT full_name, employee_code, status FROM users WHERE id='0e825034-...';
         full_name         | employee_code | status
---------------------------+---------------+--------
 E2E Worker Renamed ol9ob9 | E2EWOL9OB9    | ACTIVE
```

Audit trail worker đầy đủ (create → update rename → deact/react ×2 do chạy lại kịch bản):

```
        action        |    b     |    a     |             n
----------------------+----------+----------+---------------------------
 ORG_WORKER_CREATED   |          | ACTIVE   | E2E Worker ol9ob9
 ORG_WORKER_UPDATED   | ACTIVE   | ACTIVE   | E2E Worker Renamed ol9ob9
 IAM_USER_DEACTIVATED | ACTIVE   | INACTIVE | E2E Worker Renamed ol9ob9
 IAM_USER_REACTIVATED | INACTIVE | ACTIVE   | E2E Worker Renamed ol9ob9
 IAM_USER_DEACTIVATED | ACTIVE   | INACTIVE | E2E Worker Renamed ol9ob9
 IAM_USER_REACTIVATED | INACTIVE | ACTIVE   | E2E Worker Renamed ol9ob9
```

### A7: deactivate — trạng thái + audit (actor = admin `11111111-...`)

```
          email           |         full_name         |  status
--------------------------+---------------------------+----------
 e2e.w.ol9ob9@example.com | E2E Worker Renamed ol9ob9 | INACTIVE

            actor_user_id             |        action        | entity_type |              entity_id               | before_status | after_status
--------------------------------------+----------------------+-------------+--------------------------------------+---------------+--------------
 11111111-1111-4111-8111-111111111111 | IAM_USER_DEACTIVATED | USER        | 0e825034-8c97-4359-b01f-45ffbce8fff7 | ACTIVE        | INACTIVE
```

### A8: reactivate

```
          email           | status
--------------------------+--------
 e2e.w.ol9ob9@example.com | ACTIVE

        action        |    b     |   a
----------------------+----------+--------
 IAM_USER_REACTIVATED | INACTIVE | ACTIVE
```

### B1–B3: contractors E2E cuối phiên

```
    code     |              name               |  status  |              note               |  contact_name
-------------+---------------------------------+----------+---------------------------------+----------------
 E2ECOL9OB9  | E2E Nhà thầu ol9ob9             | INACTIVE | E2E thi công phần thô           | Nguyễn E2E
 E2EC2OL9OB9 | E2E Nhà thầu P2 ol9ob9          | INACTIVE | E2E P2: thi công cốp pha        | Nguyễn P2
 E2EC3OL9OB9 | E2E P2 Active Contractor ol9ob9 | ACTIVE   | E2E active: thi công hoàn thiện | Active Người A
```

Audit contractor (P1 — có `ORG_CONTRACTOR_STATUS_CHANGED` với before/after):

```
            action             |   b    |    a     |           s
-------------------------------+--------+----------+-----------------------
 ORG_CONTRACTOR_CREATED        |        | ACTIVE   | E2E thi công phần thô
 ORG_CONTRACTOR_STATUS_CHANGED | ACTIVE | INACTIVE | E2E thi công phần thô
```

Audit contractor (P2):

```
            action             |   b    |    a     |            s             |     c
-------------------------------+--------+----------+--------------------------+-----------
 ORG_CONTRACTOR_CREATED        |        | ACTIVE   | E2E P2: thi công cốp pha | Nguyễn P2
 ORG_CONTRACTOR_STATUS_CHANGED | ACTIVE | INACTIVE | E2E P2: thi công cốp pha | Nguyễn P2
```

Tổng audit actions cho 3 entity E2E:

```
 IAM_USER_DEACTIVATED          |     2
 IAM_USER_REACTIVATED          |     2
 ORG_CONTRACTOR_CREATED        |     2
 ORG_CONTRACTOR_STATUS_CHANGED |     2
```

> Lưu ý: **không có `ORG_CONTRACTOR_UPDATED`** — bằng chứng cho FAIL B2 (trước fix).

### B2 re-run sau fix #25 (2026-09-05 16:50 UTC) — DB + audit

Contractor thật sau 2 lần edit qua UI (status KHÔNG đổi — ACTIVE giữ ACTIVE, INACTIVE giữ INACTIVE):

```
SELECT code, name, status, contact_name AS contact, note AS scope FROM contractors
WHERE code IN ('E2EFXOMCZUC','E2EFX2OMCZUC') ORDER BY code;

     code     |          name           |  status  |           contact           |             scope
--------------+-------------------------+----------+-----------------------------+--------------------------------
 E2EFX2OMCZUC | E2E Fix Inactive OMCZUC | INACTIVE | Nguyễn E2E Fix Inactive Mới | E2E fix: cốp pha + cốt thép
 E2EFXOMCZUC  | E2E Fix Active OMCZUC   | ACTIVE   | Nguyễn E2E Fix Mới          | E2E fix: phần thô + hoàn thiện
```

Audit contractor — cả 2 edit same-status đều ghi `ORG_CONTRACTOR_UPDATED` (status không đổi → action UPDATED, không phải STATUS_CHANGED; phase INACTIVE có thêm STATUS_CHANGED của bước deactivate trước khi edit):

```
            action             | entity_type |              entity_id               |   b_contact    |          a_contact          |            a_scope             | result
-------------------------------+-------------+--------------------------------------+----------------+-----------------------------+--------------------------------+---------
 ORG_CONTRACTOR_CREATED        | CONTRACTOR  | 3a09498e-42f2-4146-8f0c-a9e6305d6332 |                | Nguyễn E2E Fix              | E2E fix: thi công phần thô     | SUCCESS
 ORG_CONTRACTOR_UPDATED        | CONTRACTOR  | 3a09498e-42f2-4146-8f0c-a9e6305d6332 | Nguyễn E2E Fix | Nguyễn E2E Fix Mới          | E2E fix: phần thô + hoàn thiện | SUCCESS
 ORG_CONTRACTOR_CREATED        | CONTRACTOR  | 13873e6b-5e8e-4334-9b4e-95962631492e |                | Nguyễn E2E Fix              | E2E fix: thi công phần thô     | SUCCESS
 ORG_CONTRACTOR_STATUS_CHANGED | CONTRACTOR  | 13873e6b-5e8e-4334-9b4e-95962631492e | Nguyễn E2E Fix | Nguyễn E2E Fix              | E2E fix: thi công phần thô     | SUCCESS
 ORG_CONTRACTOR_UPDATED        | CONTRACTOR  | 13873e6b-5e8e-4334-9b4e-95962631492e | Nguyễn E2E Fix | Nguyễn E2E Fix Inactive Mới | E2E fix: cốp pha + cốt thép    | SUCCESS
```

### B5: contractor INACTIVE vẫn truy được (không hard delete)

```
SELECT count(*) AS active_non_e2e FROM contractors WHERE status='ACTIVE' AND code NOT LIKE 'E2E%'; -- 2 (seed)

-- Entity E2E sau cleanup (xem §7):
   email | full_name
-------+-----------
(0 rows)   -- users E2E đã xóa (chỉ giữ seed)
   code
------
(0 rows)   -- contractors E2E đã xóa
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

## 7. Cleanup đã thực hiện

Sau khi ghi bằng chứng, các entity test đã được xóa khỏi DB (giữ nguyên seed):

```bash
docker exec buildflow-postgres-1 psql -U buildflow -d buildflow -c \
  "DELETE FROM resource_trades WHERE user_id='0e825034-8c97-4359-b01f-45ffbce8fff7';"
docker exec buildflow-postgres-1 psql -U buildflow -d buildflow -c \
  "DELETE FROM contractors WHERE id IN ('ac9f887f-...','6f0131d2-...','3e42e88d-...');"
docker exec buildflow-postgres-1 psql -U buildflow -d buildflow -c \
  "DELETE FROM users WHERE id='0e825034-...';"
docker exec buildflow-postgres-1 psql -U buildflow -d buildflow -c \
  "DELETE FROM contractors WHERE id IN ('3a09498e-42f2-4146-8f0c-a9e6305d6332','13873e6b-5e8e-4334-9b4e-95962631492e');"
```

> Audit rows **không xóa được** (append-only guard IAM-SRS-008 đúng thiết kế) — 11 audit rows E2E còn lại như trace lịch sử.

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
node e2e-driver.cjs          # phase 1: login, create worker, dupl 409, bad trade 400, search, contractor P1
node e2e-driver-p2.cjs       # phase 2: worker rename + deactivate/reactivate + contractor edit (UI)
node e2e-driver-p3.cjs w-deact      # deactivate worker (confirm) → chụp ảnh
# → verify DB: SELECT ... IAM_USER_DEACTIVATED ...
node e2e-driver-p3.cjs w-reactivate # reactivate → chụp ảnh
# → verify DB: IAM_USER_REACTIVATED
node e2e-driver-p3.cjs ctr-full     # create P2, edit (FAIL bug), deactivate → chụp ảnh
# → verify DB: contractors + audit
node e2e-driver-p3.cjs views        # filters + detail + audit-logs deep-link → chụp ảnh
node e2e-driver-p2b.cjs             # tạo contractor ACTIVE + thử edit (repro bug B2) → chụp FAIL
node e2e-driver-b2-fix.cjs          # [sau fix] edit contact/scope status KHÔNG đổi (ACTIVE + INACTIVE) → PASS, PATCH 200
```

Yêu cầu runtime:
- Node ≥ 18, Chrome tại `/usr/bin/google-chrome` (đổi `executablePath` nếu khác máy)
- Playwright core: `require('/…/node_modules/@playwright/mcp/node_modules/playwright')` — cài `npm i -g @playwright/mcp` cho playwright-core; hoặc `npm i playwright-core` và đổi require.

Các lệnh DB verify nên chạy **giữa** các phase (xem §5), theo đúng id/UUID mới sinh trong `e2e-vars.json`.

## 9. Files trong evidence này

```
docs/evidence/org-srs-001-002/
├── ORG-SRS-001-002-E2E.md        ← file này
├── e2e-driver.cjs, e2e-driver-p2.cjs, e2e-driver-p3.cjs, e2e-driver-p2b.cjs
├── e2e-driver-b2-fix.cjs         (re-run B2 sau fix #25 — mới)
├── e2e-vars.json                 (uniq + ids dùng)
├── e2e-results*.json             (kết quả từng phase)
├── e2e-b2fix-patch-responses.json (HTTP status thật của PATCH — mới)
└── shots/                        (15 ảnh + 4 ảnh B2-fix: B2-fix-active-edit-form/-detail, B2-fix-inactive-edit-form/-detail)
```