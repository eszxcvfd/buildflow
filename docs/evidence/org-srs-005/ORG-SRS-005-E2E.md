# ORG-SRS-005 — E2E Evidence: Resource Directory Read-Only (issue #28)

> **Loại bằng chứng:** Browser E2E thật (UI → API → PostgreSQL → UI) + HTTP-level checks bằng token thật, screenshot trong repo.
> **Ngày chạy:** 2026-09-06 UTC (`e2e-driver-org-srs-005.cjs` + 1 re-run S2-fix + 1 re-run sau fix UI race).
> **Trạng thái tổng:** **13/13 PASS** — S2 FAIL gốc (minor UI race, §4a) đã fix trong `ResourceDirectory.tsx`, tái chạy driver: **12/12 PASS**, S5 persist không regression.
> **Phạm vi:** fix web slice + file mới/cập nhật dưới `docs/evidence/org-srs-005/` — **không commit**, không sửa API, không đụng GitHub.

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
| `admin@example.com` | ADMIN + STAFF | `E2EAdmin@2025` (giữ từ ORG-SRS-001/002) |
| `pm@example.com` | PROJECT_MANAGER | `E2EPm@2025` (giữ từ ORG-SRS-003) |
| `worker1@example.com` | WORKER | `E2EWorker@2025` (**reset mới trong lần này** — xem dưới) |

### Reset password worker1 (đã thực hiện — để tái sinh)

Password cũ unknown (`POST /api/v1/auth/login` → 401). Reset bằng bcryptjs đúng `BcryptHasherService` (`genSalt(10)`):

```bash
cd src/api
node -e "console.log(require('bcryptjs').hashSync('E2EWorker@2025', require('bcryptjs').genSaltSync(10)))"
# → $2b$10$x559fcmNdbdnTURNfPVMYO92dCTAo.d3NeNk0lGlQH5IYMite2Opu
docker exec buildflow-postgres-1 psql -U buildflow -d buildflow -c \
  "UPDATE users SET password_hash='\$2b\$10\$x559fcmNdbdnTURNfPVMYO92dCTAo.d3NeNk0lGlQH5IYMite2Opu', updated_at=now() \
   WHERE email='worker1@example.com';"
```

Xác minh: login → 200, `roles: ["WORKER"]`, `userType: "WORKER"`, status ACTIVE.

> ⚠️ Password worker1 hiện là `E2EWorker@2025`. Không đụng password admin/pm.

## 3. Dữ liệu nền (không seed mới — dùng DB mẫu sẵn)

- Workers (`user_type='WORKER'`): 5 rows — `worker1`, `worker2` (ACTIVE, không trade),
  `e2e.t.onzfuf` (ACTIVE + trade E2E-TONZFUF Lv3), `e2e.t.oo1cby` (ACTIVE + trade E2E-TOO1CBY Lv3),
  `e2e4.worker` (INACTIVE, seed ORG-SRS-004).
- Contractors: 3 rows ACTIVE (`NTA`, `HTB`, `E2E4-CON`).
- Trades: `THO-CAT` + E2E rows (`is_active=true`, không cột `status`).
- Trade dùng cho filter kết hợp: `e8f974e9-3d12-4f25-97cb-32bd81b843fd` (E2E-TONZFUF).
- Worker dùng cho S10 (suspend → restore): `worker2@example.com` (Lê Văn Thợ, ACTIVE, không trade).
- Contractor dùng cho S12 (scope → revert): `e2e4c000-…c1` (E2E4-CON, scope gốc `seed ORG-SRS-004`
  — cột DB là `note`, đã verify hoàn nguyên đúng qua `SELECT note`).

## 4. Kịch bản & kết quả

**Ký hiệu:** 🟢 PASS · 🔴 FAIL · 📸 ảnh trong `docs/evidence/org-srs-005/shots/`

| # | Bước (UI → HTTP → DB verify) | Kết quả | Bằng chứng |
| --- | --- | --- | --- |
| S1 | PM login → sidebar thấy `Tra cứu nguồn lực`, KHÔNG thấy Công nhân/Ngành nghề/Tài khoản/Nhật ký → mở `/resources` render tablist | 🟢 PASS | `S1-nav.png`, `S1-directory.png` |
| S2 | Workers filter kết hợp status=ACTIVE + trade + skill=3 → đúng 1 (E2E Worker ONZFUF); SQL COUNT cùng WHERE; đổi search → kết quả cập nhật | 🟢 **PASS (sau fix §4a)** — 3 select dồn dập, URL cuối đủ 3 param, Tổng=1 = API = SQL | `S2-combined.png` (mới, post-fix), `S2-search-fix.png` |
| S2-fix | Re-run S2 tuần tự (đợi URL sau mỗi select) + direct URL (trước fix — giữ làm baseline lịch sử) | 🟢 PASS — UI Tổng=1 = API total=1 = SQL count=1; search sau đó → Tổng=0 + empty | `S2-combined-fix.png`, `S2-search-fix.png` |
| S3 | Sort Tên asc/desc: API đảo nhau đúng; UI 2 phần tử đầu khớp cả 2 chiều | 🟢 PASS — asc đầu `E2E Worker ONZFUF / E2E Worker Renamed / E2E4 Worker Lifecycle` | `S3-desc.png` |
| S4 | Pagination API `limit=2`: trang1 ≠ trang2, total khớp; UI `?page=2` Tổng khớp (empty vì PAGE_SIZE=20 > dataset — đúng thiết kế) | 🟢 PASS — total=5 | `S4-page2.png` |
| S5 | Empty state search lạ → empty + hướng dẫn; `Xóa bộ lọc` → Tổng=5 = DB; URL giữ filter sau refresh + back | 🟢 PASS | `S5-empty.png`, `S5-persist.png` |
| S6 | Contractors: Tổng=3 khớp API; filter INACTIVE (SQL=0) → empty; sort asc/desc đảo đúng; search `Nam Tiến` khớp | 🟢 PASS | `S6-inactive.png`, `S6-search.png` |
| S7 | Tab Đội disabled + note `Sắp có — ORG-SRS-006` | 🟢 PASS | `S7.png` |
| S8 | PM mở `/workers/[id]` từ directory: profile hiện, ghi chú chỉ-xem + history admin-only, KHÔNG nút lifecycle; PM `GET open-work` → 403 | 🟢 PASS | `S8-detail.png` |
| S9 | PM `PATCH workers/:id/status` → 403; PM `PATCH contractors` inline → 403; WORKER-role `GET workers` + `GET contractors` → 403; anon → 401 ×2; PM detail UUID ghost → 404 ×2; status sau tamper không đổi | 🟢 PASS | HTTP outputs §5 |
| S10 | `Cache-Control: no-store` trên GET search + contractors; admin SUSPEND worker2 → PM search thấy INACTIVE ngay (API + UI); restore ACTIVE | 🟢 PASS | `S10-fresh.png`, header trace §5 |
| S11 | `sort=sai` → 400 keys=`[sort]`; `skillLevel=9` → 400 keys=`[skillLevel]`; contractors `order=sai` → 400 keys=`[order]` | 🟢 PASS | body outputs §5 |
| S12 | Admin smoke: list/search/detail workers + contractors + trades 200; `PATCH` scope E2E4-CON rồi revert đúng; admin mở `/resources` | 🟢 PASS | `S12-admin.png` |

**Tổng: 13 PASS / 0 FAIL / 13 mục** (S2-fix là re-run lịch sử trước fix, giữ nguyên làm baseline).

### 4a. S2 FAIL gốc — nguyên nhân + fix (đã PASS sau fix)

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
UI Tổng=1 · API total=1 (names=["E2E Worker ONZFUF"]) · SQL count=1
driver: ===== TỔNG: 12 PASS / 0 FAIL / 12 bước =====
```

## 5. DB / HTTP output thật

### S2 — SQL đối chiếu filter kết hợp (post-fix, output thật 2026-09-06)

```
-- users WORKER + ACTIVE + trade E2E-TONZFUF + skill 3
count = 1
-- API:  GET /api/v1/workers?status=ACTIVE&tradeId=e8f974e9-…&skillLevel=3 (token PM)
total = 1, names = ['E2E Worker ONZFUF']
-- UI 3 select dồn dập (không chờ) → FINAL-URL:
http://localhost:3001/resources?tab=workers&status=ACTIVE&trade=e8f974e9-3d12-4f25-97cb-32bd81b843fd&skill=3&sort=createdAt&order=desc
→ "Tổng: 1 hồ sơ · Hiển thị 1" (= API = SQL — race đã hết)
-- driver S2: combined: API total=1 = SQL count=1 = UI Tổng=1 (E2E Worker ONZFUF); search đổi Tổng → 0
-- API thiếu skill: total = 1 (cùng worker — trade này chỉ 1 người)
-- UI direct URL ?tab=workers&status=ACTIVE&trade=…&skill=3 → "Tổng: 1 hồ sơ · Hiển thị 1"
-- UI re-run tuần tự (pre-fix) → URL ...&status=ACTIVE&trade=…&skill=3&sort=createdAt&order=desc, "Tổng: 1 hồ sơ"
```

### S4 — pagination API (`sort=name&order=asc`)

```
trang1 (limit=2 offset=0): [E2E Worker ONZFUF, E2E Worker Renamed] total=5
trang2 (limit=2 offset=2): [E2E4 Worker Lifecycle, Lê Văn Thợ] total=5
UI ?tab=workers&page=2 → Tổng=5 (empty list — PAGE_SIZE=20 > 5 rows)
```

### S9 — permission matrix (HTTP thật)

```
PM PATCH /api/v1/workers/:id/status {SUSPEND}      → 403
PM PATCH /api/v1/contractors/:id {scope}           → 403
WORKER GET /api/v1/workers / GET /contractors      → 403 / 403
anon GET /api/v1/workers / GET /contractors/:id    → 401 / 401
PM GET /api/v1/workers/00000000-…-000099           → 404
PM GET /api/v1/contractors/00000000-…-000099       → 404
users.status sau tamper                            → INACTIVE (worker E2E4, không đổi)
```

### S10 — header trace + freshness

```
GET /api/v1/workers?status=ACTIVE&limit=5 (PM) → cache-control: 'no-store'
GET /api/v1/contractors?limit=5 (PM)          → cache-control: 'no-store'
admin PATCH worker2 SUSPEND → 200; PM search worker2 → status 'INACTIVE' (API + UI "Ngừng hoạt động")
admin PATCH worker2 ACTIVATE (restore) → 200; users.status worker2 = 'ACTIVE'
```

### S11 — field errors (HTTP thật)

```
GET /workers?sort=sai&order=asc        → 400 fieldErrors keys=[sort], message='Sort không hợp lệ (name|createdAt)'
GET /workers?skillLevel=9              → 400 fieldErrors keys=[skillLevel], message='Skill level phải là 1-5'
GET /contractors?sort=name&order=sai   → 400 fieldErrors keys=[order]
```

### S12 — admin smoke (HTTP thật)

```
GET workers list / search('Thợ' total=2) / detail      → 200 / 200 / 200
GET contractors list / E2E4-CON detail / trades list   → 200 / 200 / 200
PATCH E2E4-CON scope → 200, verify 'seed ORG-SRS-004 (E2E28)', revert → 200, final 'seed ORG-SRS-004'
```

## 6. Files trong evidence này

```
docs/evidence/org-srs-005/
├── ORG-SRS-005-E2E.md              (file này)
├── e2e-driver-org-srs-005.cjs      (driver S1–S12, playwright-core + Chrome)
├── e2e-vars.json                   (kết quả machine-readable 12 PASS / 0 FAIL — post-fix, khớp driver §4a)
└── shots/ (15 ảnh)
    ├── S1-nav.png / S1-directory.png
    ├── S2-combined.png (post-fix — 3 select dồn dập, Tổng=1) / S2-combined-fix.png / S2-search-fix.png
    ├── S3-desc.png / S4-page2.png / S5-empty.png / S5-persist.png
    ├── S6-inactive.png / S6-search.png / S7.png / S8-detail.png
    └── S10-fresh.png / S12-admin.png
```

## 7. Cách tái sinh

```bash
# 1. Rebuild api + web từ working tree (bắt buộc nếu image cũ: probe PM GET /workers → 403)
DOCKER_CONFIG=/tmp/bfhome/.docker DOCKER_HOST=unix:///home/trung/.docker/desktop/docker.sock \
  docker compose -f infra/docker/compose.yaml up -d --build api web

# 2. Đảm bảo password E2E (admin/pm giữ cũ; worker1 xem §2)
curl -X POST http://localhost:3000/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"worker1@example.com","password":"E2EWorker@2025"}'  # → 200 roles ["WORKER"]

# 3. Chạy driver (không seed mới; S10/S12 tự hoàn nguyên)
node docs/evidence/org-srs-005/e2e-driver-org-srs-005.cjs
# → ===== TỔNG: 11 PASS / 1 FAIL / 12 bước ===== (S2 FAIL như §4a là đúng kỳ vọng)

# 4. Re-run S2 tuần tự: mở /resources, chọn status → đợi URL → trade → đợi URL → skill
#    (kỳ vọng Tổng: 1) — hoặc tải trực tiếp URL có đủ 4 param như §5/S2.

# 5. Re-run sau fix UI race (§4a): rebuild web từ working tree rồi chạy lại driver nguyên bản
#    (3 select dồn dập, không chờ) — kỳ vọng: ===== TỔNG: 12 PASS / 0 FAIL / 12 bước =====
#    S2 PASS với URL cuối đủ 3 param, S5 persist không regression.
```

Chạy lại không phá DB: S10 restore worker2 về ACTIVE, S12 revert scope E2E4-CON;
audit_logs chỉ tăng (append-only) — đúng thiết kế.

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

## 9. Rủi ro / việc không làm

- S2 FAIL gốc (minor UI race) đã fix triệt để (§4a) và tái chạy driver PASS 12/12 — không còn việc tồn đọng.
- Slice là read-only (GET) không ghi DB/audit → double-submit/retry N/A cho tra cứu; đã test ở các slice write (lifecycle #27).
- Sort ORDER BY chỉ có SQL-assert ở unit test (cùng mức proof các slice trước); E2E này assert thứ tự qua API+UI với dataset 5 workers.
- Pagination UI không có dataset > 20 để hiện nút Trang trước/sau — chỉ verify `page` param + total (trung thực, không giả vờ có nav).
- Không browser-E2E cho role ADMIN trên `/resources` ngoài smoke mở trang (S12); matrix write-admin đã có ở ORG-SRS-004.
- worker1 password giữ `E2EWorker@2025` (ghi §2); không trả về password cũ vì unknown từ trước.
