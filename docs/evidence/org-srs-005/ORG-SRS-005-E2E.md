# ORG-SRS-005 — E2E Evidence: Resource Directory Read-Only (issue #28)

> **Loại bằng chứng:** Browser E2E thật (UI → API → PostgreSQL → UI) + HTTP-level checks bằng token thật, screenshot trong repo.
> **Ngày chạy:** 2026-09-07 UTC (`e2e-driver-org-srs-005.cjs` tái chạy sau chuẩn hóa realistic + fix kỳ vọng S7).
> **Trạng thái tổng:** **12/12 PASS** (main) + **7/7 PASS** (pagination §10).
> **Phạm vi:** chỉ file dưới `docs/evidence/org-srs-005/` — **không commit**, không sửa product code, không đụng GitHub.
>
> **Chuẩn hóa realistic 2026-09-07 (theo [`docs/demo-data.md`](../demo-data.md)):** DB live đã
> đổi tên (emails `@vinacons.vn`, tên Việt, mã VCC/PRD/SON-NUOC/DD-CD…); driver + seed + doc này
> dùng toàn tên mới. Lịch sử chạy cũ (§4a, S2-fix) giữ nguyên tên pre-rename làm baseline.
> **Mapping note: audit_logs append-only — các dòng audit lịch sử vẫn giữ identifier cũ
> (`admin@example.com`, `E2E4-PRJ`, …) là có chủ ý**, không phải dữ liệu bẩn.

---

## 1. Môi trường

| Hạng mục | Giá trị |
| --- | --- |
| Repo | `/home/trung/Documents/2026/project/buildflow` |
| Commit HEAD | `9f973c5` — `feat(org): resource lifecycle status slice ORG-SRS-004 #27` (+ working tree chưa commit của API slice #28 và web slice #28) |
| API base | `http://localhost:3000` (container `buildflow-api-1`, healthy) |
| Web base | `http://localhost:3001` (container `buildflow-web-1`, healthy) |
| PostgreSQL | `docker exec buildflow-postgres-1 psql -U buildflow -d buildflow` |
| Browser | Google Chrome 151.0.7922.173 headless qua playwright-core (launch `/usr/bin/google-chrome --no-sandbox`) |
| DB migrations | 0001 → 0004 (không migration mới trong slice này) |

> ⚠️ **Stack đã rebuild từ working tree cho E2E này** — image cũ chưa có phân quyền PM cho `GET /workers`
> (probe token PM → **403** `{"message":"Không có quyền truy cập"}`). Rebuild:
>
> ```
> DOCKER_CONFIG=/tmp/bfhome/.docker DOCKER_HOST=unix:///home/trung/.docker/desktop/docker.sock \
>   docker compose -f infra/docker/compose.yaml up -d --build api web
> ```
>
> Sau rebuild: probe token PM `GET /api/v1/workers?limit=2` → **200** + `Cache-Control: no-store`;
> `GET /resources` (web) → **200**.

Trạng thái stack lúc chạy:

```
buildflow-api-1       127.0.0.1:3000->3000/tcp   Up (healthy)
buildflow-web-1       127.0.0.1:3001->3001/tcp   Up (healthy)
buildflow-postgres-1  127.0.0.1:5432->5432/tcp   Up (healthy)
buildflow-redis-1     127.0.0.1:6379->6379/tcp   Up (healthy)
```

## 2. Tài khoản

| Email | Vai trò | Password E2E |
| --- | --- | --- |
| `hoang.anh@vinacons.vn` | ADMIN + STAFF | `E2EAdmin@2025` (giữ từ ORG-SRS-001/002) |
| `quoc.tran@vinacons.vn` | PROJECT_MANAGER | `E2EPm@2025` (giữ từ ORG-SRS-003) |
| `thang.nguyen@vinacons.vn` | WORKER | `E2EWorker@2025` (giữ từ ORG-SRS-005 §2 — xem dưới) |

### Reset password worker1 (đã thực hiện từ slice gốc — để tái sinh)

Password cũ unknown (`POST /api/v1/auth/login` → 401). Reset bằng bcryptjs đúng `BcryptHasherService` (`genSalt(10)`):

```bash
cd src/api
node -e "console.log(require('bcryptjs').hashSync('E2EWorker@2025', require('bcryptjs').genSaltSync(10)))"
# → $2b$10$x559fcmNdbdnTURNfPVMYO92dCTAo.d3NeNk0lGlQH5IYMite2Opu
docker exec buildflow-postgres-1 psql -U buildflow -d buildflow -c \
  "UPDATE users SET password_hash='\$2b\$10\$x559fcmNdbdnTURNfPVMYO92dCTAo.d3NeNk0lGlQH5IYMite2Opu', updated_at=now() \
   WHERE email='thang.nguyen@vinacons.vn';"
```

Xác minh: login → 200, `roles: ["WORKER"]`, `userType: "WORKER"`, status ACTIVE.

> ⚠️ Password worker1 (thang.nguyen) hiện là `E2EWorker@2025`. Không đụng password admin/pm.

## 3. Dữ liệu nền (không seed mới — dùng DB mẫu realistic theo `docs/demo-data.md`)

- Workers (`user_type='WORKER'`): 6 rows — `thang.nguyen` (Nguyễn Văn Thắng, ACTIVE),
  `hau.le` (Lê Văn Hậu, ACTIVE), `tuan.pham` (Phạm Văn Tuấn, ACTIVE + trade SON-NUOC Lv3),
  `dong.trinh` (Trịnh Văn Đông, ACTIVE + trade DIEN Lv3),
  `cuong.do` (Đỗ Văn Cường, INACTIVE), `ba.nguyen` (Nguyễn Văn Ba, ACTIVE).
- Contractors: 3 rows ACTIVE (`NTA` Công ty TNHH Xây dựng Nam Tiến, `HTB`, `VCC` Công ty CP Xây dựng Vinacons).
- Trades: `THO-CAT` + `OP-LAT` + `SON-NUOC` (+ `DIEN`; + 2 rows run-pattern nhóm A ngoài phạm vi slice này).
- Trade dùng cho filter kết hợp: `e8f974e9-3d12-4f25-97cb-32bd81b843fd` (SON-NUOC `Thợ sơn nước`).
- Worker dùng cho S10 (suspend → restore): `hau.le@vinacons.vn` (Lê Văn Hậu, ACTIVE, không trade).
- Contractor dùng cho S12 (scope → revert): `e2e4c000-…c1` (VCC, scope gốc `Tổng thầu thi công kết cấu và hoàn thiện`
  — cột DB là `note`, đã verify hoàn nguyên đúng qua `SELECT note`).

## 4. Kịch bản & kết quả

**Ký hiệu:** 🟢 PASS · 🔴 FAIL · 📸 ảnh trong `docs/evidence/org-srs-005/shots/`

| # | Bước (UI → HTTP → DB verify) | Kết quả | Bằng chứng |
| --- | --- | --- | --- |
| S1 | PM login → sidebar thấy `Tra cứu nguồn lực`, KHÔNG thấy Công nhân/Ngành nghề/Tài khoản/Nhật ký → mở `/resources` render tablist | 🟢 PASS | `S1-nav.png`, `S1-directory.png` |
| S2 | Workers filter kết hợp status=ACTIVE + trade SON-NUOC + skill=3 → đúng 1 (Phạm Văn Tuấn); SQL COUNT cùng WHERE; đổi search `Nguyễn Văn Thắng` → kết quả cập nhật (Tổng 1→0) | 🟢 PASS — Tổng=1 = API = SQL | `S2-combined.png`, `S2-search.png` |
| S2-fix | Re-run S2 tuần tự + direct URL (trước fix UI race — giữ làm baseline lịch sử; tên trong log cũ là pre-rename) | 🟢 PASS (lịch sử) — UI Tổng=1 = API total=1 = SQL count=1 | `S2-combined-fix.png`, `S2-search-fix.png` |
| S3 | Sort Tên asc/desc: API đảo nhau đúng; UI 2 phần tử đầu khớp cả 2 chiều | 🟢 PASS — asc đầu `Lê Văn Hậu / Nguyễn Văn Ba / Nguyễn Văn Thắng` | `S3-desc.png` |
| S4 | Pagination API `limit=2`: trang1 ≠ trang2, total khớp; UI `?page=2` Tổng khớp (empty vì PAGE_SIZE=20 > dataset — đúng thiết kế) | 🟢 PASS — total=6 | `S4-page2.png` |
| S5 | Empty state search lạ → empty + hướng dẫn; `Xóa bộ lọc` → Tổng=6 = DB; URL giữ filter sau refresh + back | 🟢 PASS | `S5-empty.png`, `S5-persist.png` |
| S6 | Contractors: Tổng=3 khớp API; filter INACTIVE (SQL=0) → empty; sort asc/desc đảo đúng; search `Nam Tiến` khớp | 🟢 PASS | `S6-inactive.png`, `S6-search.png` |
| S7 | Tab Đội **enabled** (ORG-SRS-006 đã landed — kỳ vọng cũ 'disabled + note Sắp có' đã lỗi thời, xem §4b) → `?tab=crews` Tổng=1 = API, thấy DD-CD | 🟢 PASS | `S7.png` |
| S8 | PM mở `/workers/[id]` từ directory: profile hiện (Lê Văn Hậu), ghi chú chỉ-xem + history admin-only, KHÔNG nút lifecycle; PM `GET open-work` → 403 | 🟢 PASS | `S8-detail.png` |
| S9 | PM `PATCH workers/:id/status` → 403; PM `PATCH contractors` inline → 403; WORKER-role `GET workers` + `GET contractors` → 403; anon → 401 ×2; PM detail UUID ghost → 404 ×2; status sau tamper không đổi (ACTIVE) | 🟢 PASS | HTTP outputs §5 |
| S10 | `Cache-Control: no-store` trên GET search + contractors; admin SUSPEND hau.le → PM search thấy INACTIVE ngay (API + UI); restore ACTIVE | 🟢 PASS | `S10-fresh.png`, header trace §5 |
| S11 | `sort=sai` → 400 keys=`[sort]`; `skillLevel=9` → 400 keys=`[skillLevel]`; contractors `order=sai` → 400 keys=`[order]` | 🟢 PASS | body outputs §5 |
| S12 | Admin smoke: list/search/detail workers + contractors + trades 200; `PATCH` scope VCC rồi revert đúng; admin mở `/resources` | 🟢 PASS | `S12-admin.png` |

**Tổng: 12 PASS / 0 FAIL / 12 mục** (S2-fix là re-run lịch sử trước fix UI race, giữ nguyên làm baseline).

### 4b. S7 FAIL lần chạy đầu 2026-09-07 — kỳ vọng driver lỗi thời (KHÔNG phải bug sản phẩm)

Driver assert tab Đội disabled + note `Sắp có — ORG-SRS-006`, nhưng ORG-SRS-006 đã landed sau slice này:
tab Đội đã enabled có chủ ý và hiện directory crews thật (`GET /api/v1/crews` PM → 200, total=1 DD-CD).
Fix driver: assert tab enabled + `?tab=crews` Tổng=1 = API + thấy `DD-CD` + không còn note `Sắp có`.
Tái chạy: **12/12 PASS**. Không sửa product code.

### 4a. S2 FAIL gốc — nguyên nhân + fix (đã PASS sau fix; log dưới giữ tên pre-rename 2026-09-06)

Driver gốc chọn 3 select liên tiếp (`status` → `trade` → `skill`), mỗi select gọi `router.replace`
ngay. Lần re-render chưa kịp cập nhật `query` memo giữa 2 lần `apply` liên tiếp nên param `trade`
bị rớt khỏi URL → UI thực chất lọc `status=ACTIVE + skill=3` (thiếu trade) → Tổng=2
(ONZFUF + Renamed, cả 2 ACTIVE Lv3) thay vì 1. API/SQL/direct URL luôn đúng → **filter server đúng,
bug nằm ở client**.

**Fix gốc rễ** (`src/web/src/features/resource-directory/components/ResourceDirectory.tsx`,
không đổi API, giữ behavior URL persist): `apply` đổi URL từ MỘT nguồn state duy nhất —
`queryRef` (ref giữ query MỚI NHẤT đã apply, đồng bộ lại từ URL khi URL đổi từ ngoài),
mỗi thay đổi field = merge lên `queryRef.current` (state mới nhất + field đổi) rồi
`router.replace` MỘT lần; đổi tab/filter reset `page=1`; guard bỏ qua khi URL đích trùng URL
hiện tại (`window.location.search`) hoặc trùng lần push ngay trước đó (chống loop/replace thừa
khi `router.replace` async chưa kịp đổi URL).

**Proof sau fix** — tái chạy driver NGUYÊN BẢN (3 select dồn dập, không chờ):
URL cuối giữ CẢ 3 param, UI Tổng=1 = API total=1 = SQL count=1; S5 persist vẫn PASS (không regression):

```
FINAL-URL: http://localhost:3001/resources?tab=workers&status=ACTIVE
  &trade=e8f974e9-3d12-4f25-97cb-32bd81b843fd&skill=3&sort=createdAt&order=desc
UI Tổng=1 · API total=1 (names=["E2E Worker ONZFUF"] — tên pre-rename, hiện tại là Phạm Văn Tuấn) · SQL count=1
driver: ===== TỔNG: 12 PASS / 0 FAIL / 12 bước =====
```

## 5. DB / HTTP output thật

### S2 — SQL đối chiếu filter kết hợp (run 2026-09-07, tên realistic)

```
-- users WORKER + ACTIVE + trade SON-NUOC + skill 3
count = 1
-- API:  GET /api/v1/workers?status=ACTIVE&tradeId=e8f974e9-…&skillLevel=3 (token PM)
total = 1, names = ['Phạm Văn Tuấn']
-- UI 3 select dồn dập → FINAL-URL:
http://localhost:3001/resources?tab=workers&status=ACTIVE&trade=e8f974e9-3d12-4f25-97cb-32bd81b843fd&skill=3&sort=createdAt&order=desc
→ "Tổng: 1 hồ sơ · Hiển thị 1" (= API = SQL)
-- driver S2: combined: API total=1 = SQL count=1 = UI Tổng=1 (Phạm Văn Tuấn); search 'Nguyễn Văn Thắng' đổi Tổng 1 → 0
-- API thiếu skill: total = 1 (trade SON-NUOC chỉ 1 người)
```
Log pre-rename 2026-09-06 (§4a, tên `E2E Worker ONZFUF`) giữ làm baseline lịch sử.

### S4 — pagination API (`sort=name&order=asc`, run 2026-09-07)

```
trang1 (limit=2 offset=0): [Lê Văn Hậu, Nguyễn Văn Ba] total=6
trang2 (limit=2 offset=2): [Nguyễn Văn Thắng, Phạm Văn Tuấn] total=6
UI ?tab=workers&page=2 → Tổng=6 (empty list — PAGE_SIZE=20 > 6 rows)
```

### S9 — permission matrix (HTTP thật)

```
PM PATCH /api/v1/workers/:id/status {SUSPEND}      → 403
PM PATCH /api/v1/contractors/:id {scope}           → 403
WORKER GET /api/v1/workers / GET /contractors      → 403 / 403
anon GET /api/v1/workers / GET /contractors/:id    → 401 / 401
PM GET /api/v1/workers/00000000-…-000099           → 404
PM GET /api/v1/contractors/00000000-…-000099       → 404
users.status sau tamper                            → ACTIVE (worker đầu sort mặc định, không đổi)
```

### S10 — header trace + freshness

```
GET /api/v1/workers?status=ACTIVE&limit=5 (PM) → cache-control: 'no-store'
GET /api/v1/contractors?limit=5 (PM)          → cache-control: 'no-store'
admin PATCH hau.le SUSPEND → 200; PM search hau.le → status 'INACTIVE' (API + UI "Ngừng hoạt động")
admin PATCH hau.le ACTIVATE (restore) → 200; users.status hau.le = 'ACTIVE'
```

### S11 — field errors (HTTP thật)

```
GET /workers?sort=sai&order=asc        → 400 fieldErrors keys=[sort], message='Sort không hợp lệ (name|createdAt)'
GET /workers?skillLevel=9              → 400 fieldErrors keys=[skillLevel], message='Skill level phải là 1-5'
GET /contractors?sort=name&order=sai   → 400 fieldErrors keys=[order]
```

### S12 — admin smoke (HTTP thật)

```
GET workers list / search('Thợ' total=0 — không còn tên chứa 'Thợ' sau rename) / detail → 200 / 200 / 200
GET contractors list / VCC detail / trades list   → 200 / 200 / 200
PATCH VCC scope → 200, verify 'Tổng thầu thi công kết cấu và hoàn thiện (đợt T9/2026)', revert → 200, final 'Tổng thầu thi công kết cấu và hoàn thiện'
```

## 6. Files trong evidence này

```
docs/evidence/org-srs-005/
├── ORG-SRS-005-E2E.md              (file này)
├── e2e-driver-org-srs-005.cjs      (driver S1–S12, playwright-core + Chrome)
├── e2e-driver-pagination.cjs       (driver P1–P7 pagination dataset >20 — §10)
├── seed-pagination-005.sql         (seed 20 workers realistic TX-801..820 — §10)
├── e2e-vars.json                   (kết quả machine-readable main 12/12 PASS)
├── e2e-vars-pagination.json        (ids seed TX-8% + kết quả pagination 7/7 — §10)
└── shots/ (15 ảnh + 7 ảnh pagination §10)
     ├── S1-nav.png / S1-directory.png
     ├── S2-combined.png / S2-search.png (S2-combined-fix.png / S2-search-fix.png: baseline lịch sử pre-fix)
     ├── S3-desc.png / S4-page2.png / S5-empty.png / S5-persist.png
     ├── S6-inactive.png / S6-search.png / S7.png (mới: tab Đội enabled, directory DD-CD) / S8-detail.png
     ├── S10-fresh.png / S12-admin.png
     └── P1-page1.png / P2-page2.png / P3-sort-page2.png / P4-filter.png / P5-back.png / P6-contractors.png / P7-edge.png
```

## 7. Cách tái sinh

```bash
# 1. Rebuild api + web từ working tree (bắt buộc nếu image cũ: probe PM GET /workers → 403)
DOCKER_CONFIG=/tmp/bfhome/.docker DOCKER_HOST=unix:///home/trung/.docker/desktop/docker.sock \
  docker compose -f infra/docker/compose.yaml up -d --build api web

# 2. Đảm bảo password E2E (admin/pm giữ cũ; worker1 thang.nguyen xem §2)
curl -X POST http://localhost:3000/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"thang.nguyen@vinacons.vn","password":"E2EWorker@2025"}'  # → 200 roles ["WORKER"]

# 3. Chạy driver (không seed mới; S10/S12 tự hoàn nguyên)
node docs/evidence/org-srs-005/e2e-driver-org-srs-005.cjs
# → ===== TỔNG: 12 PASS / 0 FAIL / 12 bước =====
```

Chạy lại không phá DB: S10 restore hau.le về ACTIVE, S12 revert scope VCC;
audit_logs chỉ tăng (append-only) — đúng thiết kế (dòng audit lịch sử giữ identifier cũ).

## 8. Proof code (số thật — chạy từ working tree)

| Suite | Kết quả |
| --- | --- |
| `src/api` `npm test` | ✅ 64 suites pass (1 skipped có sẵn) / **588 pass**, 11 skipped |
| `src/api` `typecheck` (`tsc --noEmit`) | ✅ sạch |
| `src/api` `lint` (`eslint src --ext .ts`) | ✅ 0 errors, 2 warnings (= baseline: `contractor.entity.ts` có sẵn + `validateScope` unused) |
| `src/web` `npm test` (`jest --ci`) | ✅ 43 suites / **283 pass** (+2 role-alias review #28 so với 281 lúc chạy E2E) |
| `src/web` `typecheck` | ✅ sạch |
| `src/web` `lint` | ✅ 1 warning (= baseline `ContractorList` exhaustive-deps) |
| `src/web` `build` (`next build`) | ✅ pass, route `/resources` 8.48 kB (dynamic ƒ) trong route map |

## 10. Pagination với dataset >20 (follow-up — run realistic 2026-09-07 UTC)

> **Bối cảnh:** §4/S4 đã ghi pagination UI cần dataset >20 (PAGE_SIZE=20).
> Seed tạm 20 workers realistic (mã TX-801..820) → 26 workers (25 ACTIVE) → chạy driver
> pagination riêng → cleanup toàn bộ seed theo ids đã ghi (id-based).
> **Kết quả: 7/7 PASS.** Driver KHÔNG mutate dữ liệu (chỉ GET UI/API + SQL COUNT).

### 10.1 Seed SQL realistic (`seed-pagination-005.sql` — đã chạy, admin-side trực tiếp SQL)

```sql
-- users: user_type WORKER, status ACTIVE, bcrypt hash dùng chung của thang.nguyen@vinacons.vn
-- (tức E2EWorker@2025); tên Việt + email @vinacons.vn + mã TX-801..820
-- (dải mã run, không đụng mã canonical TX-00xx). Idempotent theo lower(email).
WITH seed(full_name, email, code) AS (VALUES
  ('Hoàng Văn An','an.hoang.01@vinacons.vn','TX-801'), ('Vũ Văn Bình','binh.vu.02@vinacons.vn','TX-802'),
  ('Đặng Văn Chiến','chien.dang.03@vinacons.vn','TX-803'), ('Bùi Văn Dũng','dung.bui.04@vinacons.vn','TX-804'),
  ('Phan Văn Giang','giang.phan.05@vinacons.vn','TX-805'), ('Vũ Văn Hải','hai.vu.06@vinacons.vn','TX-806'),
  ('Đinh Văn Hùng','hung.dinh.07@vinacons.vn','TX-807'), ('Phạm Văn Kiên','kien.pham.08@vinacons.vn','TX-808'),
  ('Hoàng Văn Long','long.hoang.09@vinacons.vn','TX-809'), ('Trần Văn Minh','minh.tran.10@vinacons.vn','TX-810'),
  ('Lê Văn Nam','nam.le.11@vinacons.vn','TX-811'), ('Đỗ Văn Phong','phong.do.12@vinacons.vn','TX-812'),
  ('Nguyễn Văn Quang','quang.nguyen.13@vinacons.vn','TX-813'), ('Trần Văn Sơn','son.tran.14@vinacons.vn','TX-814'),
  ('Phạm Văn Tài','tai.pham.15@vinacons.vn','TX-815'), ('Nguyễn Văn Vinh','vinh.nguyen.16@vinacons.vn','TX-816'),
  ('Trần Văn Xuân','xuan.tran.17@vinacons.vn','TX-817'), ('Lê Văn Yên','yen.le.18@vinacons.vn','TX-818'),
  ('Bùi Văn Bảo','bao.bui.19@vinacons.vn','TX-819'), ('Đinh Văn Công','cong.dinh.20@vinacons.vn','TX-820')
)
INSERT INTO users (email, password_hash, full_name, employee_code, user_type, status)
SELECT s.email, (SELECT password_hash FROM users WHERE email='thang.nguyen@vinacons.vn'),
       s.full_name, s.code, 'WORKER', 'ACTIVE'
FROM seed s
ON CONFLICT ((lower(email))) DO NOTHING;
-- role WORKER cho mã TX-8% (idempotent)
INSERT INTO user_roles (user_id, role_id, is_active)
SELECT u.id, (SELECT id FROM roles WHERE code='WORKER'), true
FROM users u
WHERE u.employee_code LIKE 'TX-8%'
  AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id
                  AND ur.role_id=(SELECT id FROM roles WHERE code='WORKER') AND ur.is_active);
-- output thật: INSERT 0 20 / INSERT 0 20
```

> **Ghi chú audit:** seed là SQL admin-side, không qua API nên **không sinh audit row**
> (verify: `SELECT count(*) FROM audit_logs a WHERE EXISTS (SELECT 1 FROM users u
> WHERE u.employee_code LIKE 'TX-8%' AND u.id = a.entity_id)` → **0**). Đó là dữ liệu demo thuần túy.

COUNT thật (run 2026-09-07):

| Thời điểm | workers all | workers ACTIVE | `TX-8%` | contractors | API `GET /workers?limit=1` total |
| --- | --- | --- | --- | --- | --- |
| Trước seed | 6 | 5 | 0 | 3 | — |
| Sau seed | **26** | **25** | 20 (+20 user_roles ACTIVE) | 3 | **26** |
| Sau cleanup (id-based) | 6 | 5 | **0** | 3 | **6** (+0 orphan user_roles) |

### 10.2 Kịch bản & kết quả (driver `e2e-driver-pagination.cjs`, login PM → `/resources`)

| # | Bước | Kết quả | Bằng chứng |
| --- | --- | --- | --- |
| P1 | Tab Workers: UI Tổng=26 = SQL all=26 = API total=26 (ACTIVE SQL=25); đúng 20 rows/trang; nav hiện `Trang 1/2`, `Trang trước` disabled, `Trang sau` enabled | 🟢 PASS | `P1-page1.png` |
| P2 | Bấm `Trang sau` → URL `?tab=workers&sort=createdAt&order=desc&page=2`; 6 rows (26−20) = 6 workers canonical, tên không trùng trang 1 (overlap=0), khớp API `offset=20&limit=20` sort mặc định: `[Nguyễn Văn Ba\|Đỗ Văn Cường\|Trịnh Văn Đông\|Phạm Văn Tuấn\|Nguyễn Văn Thắng\|Lê Văn Hậu]` | 🟢 PASS | `P2-page2.png` |
| P3 | Đổi sort=name asc → trang 1 `p1[0]=Bùi Văn Bảo, p1[19]=Vũ Văn Bình` khớp API (cả thứ tự đầu/cuối); trang 2 `[Vũ Văn Hải\|Đinh Văn Công\|Đinh Văn Hùng\|Đặng Văn Chiến\|Đỗ Văn Cường\|Đỗ Văn Phong]` khớp API `offset=20` sort mới, overlap=0 | 🟢 PASS | `P3-sort-page2.png` |
| P4 | Đang ở page=2, filter INACTIVE → URL rớt `page=2`, Tổng=1 = SQL INACTIVE=1, caption `Trang 1/1`, nav ẩn; combo ACTIVE → Tổng=25 = SQL, 20 rows, nav hiện lại `Trang 1/2` | 🟢 PASS | `P4-filter.png` |
| P5 | Giữ filter `status=ACTIVE` ở page=2 → mở detail `/workers/98230b1d-…` (Nguyễn Văn Ba) → back → URL vẫn `?tab=workers&status=ACTIVE&sort=createdAt&order=desc&page=2`, Tổng=25, `Trang 2/2` | 🟢 PASS | `P5-back.png` |
| P6 | Tab Contractors: UI Tổng=3 = API total=3, 3 rows, `nav[aria-label="Phân trang"]` **không render** (total ≤ limit) | 🟢 PASS | `P6-contractors.png` |
| P7 | Biên: trang 1 `prevDisabled=true/nextDisabled=false`; trang cuối 2/2 `prevDisabled=false/nextDisabled=true` | 🟢 PASS | `P7-edge.png` |

**Tổng pagination: 7 PASS / 0 FAIL** (`===== TỔNG PAGINATION: 7 PASS / 0 FAIL / 7 bước =====`).

### 10.3 Tái sinh + cleanup

```bash
# 1. Seed (SQL seed-pagination-005.sql — psql qua container postgres):
docker exec -i buildflow-postgres-1 psql -U buildflow -d buildflow -v ON_ERROR_STOP=1 \
  < docs/evidence/org-srs-005/seed-pagination-005.sql
# → INSERT 0 20 / INSERT 0 20 (26 workers / 25 ACTIVE, audit rows cho seed = 0)
# 2. Chạy driver (không mutate dữ liệu; cuối run ghi ids seed + results vào e2e-vars-pagination.json):
node docs/evidence/org-srs-005/e2e-driver-pagination.cjs
# → ===== TỔNG PAGINATION: 7 PASS / 0 FAIL / 7 bước =====
# 3. Cleanup seed id-based (ĐÃ CHẠY 2026-09-07 — DELETE 20 + DELETE 20 theo ids trong e2e-vars-pagination.json):
IDS=$(node -e "const v=require('./docs/evidence/org-srs-005/e2e-vars-pagination.json'); console.log(v.seedIds.map(s=>'\''+s+'\'').join(','))")
docker exec buildflow-postgres-1 psql -U buildflow -d buildflow -v ON_ERROR_STOP=1 \
  -c "DELETE FROM user_roles WHERE user_id IN ($IDS);" \
  -c "DELETE FROM users WHERE id IN ($IDS);"
# fallback (mã run TX-8% trong cửa sổ 12h):
#   DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE employee_code LIKE 'TX-8%' AND created_at > now() - interval '12 hours');
#   DELETE FROM users WHERE employee_code LIKE 'TX-8%' AND created_at > now() - interval '12 hours';
# verify: workers all=6, ACTIVE=5, TX-8%=0, contractors=3, API total=6, orphan user_roles=0
```

> ✅ **Đã cleanup**: seed pagination xóa toàn bộ theo ids đã ghi (users + user_roles, DELETE 20 + DELETE 20),
> COUNT về đúng như trước seed (6 workers / 5 ACTIVE / 3 contractors, orphan user_roles = 0) —
> workers list realistic cho các dir sau. Shots P1..P7 + driver + `e2e-vars-pagination.json` giữ lại làm bằng chứng.
> Không còn việc tồn đọng cho #28: pagination UI đã demo đủ với dataset >20 (nav, offset, sort,
> filter-reset, back-persist, biên, contractors-no-nav).

## 9. Rủi ro / việc không làm

- S2 FAIL gốc (minor UI race) đã fix triệt để (§4a) và tái chạy driver PASS 12/12 — không còn việc tồn đọng.
- Slice là read-only (GET) không ghi DB/audit → double-submit/retry N/A cho tra cứu; đã test ở các slice write (lifecycle #27).
- Sort ORDER BY chỉ có SQL-assert ở unit test (cùng mức proof các slice trước); E2E này assert thứ tự qua API+UI với dataset 6 workers.
- Pagination UI đã có bằng chứng dataset >20 ở **§10** (7/7 PASS, seed đã cleanup id-based) — dòng ghi nhận thiếu dataset ở bản trước được thay bằng §10.
- Không browser-E2E cho role ADMIN trên `/resources` ngoài smoke mở trang (S12); matrix write-admin đã có ở ORG-SRS-004.
- worker1 (thang.nguyen) password giữ `E2EWorker@2025` (ghi §2); không trả về password cũ vì unknown từ trước.
