# ORG-SRS-008 — E2E Evidence: Điều kiện nhận việc / eligibility (issue #31)

> **Loại bằng chứng:** Browser E2E thật (UI → API → PostgreSQL → UI) + HTTP-level checks bằng token thật, screenshot trong repo.
> **Ngày chạy:** 2026-09-06 UTC (`e2e-driver-org-srs-008.cjs`, 3 runs: run 1 = 10/11 do 1 bug sản phẩm thật (§4a.1);
> run 2 = 10/11 do build production của fix §4a.1 fail typecheck (§4a.2 — driver giữ nguyên, không phải lỗi driver);
> run 3 sau fix đúng = **11/11 PASS**).
> **Trạng thái tổng:** **11/11 PASS** — phát hiện và sửa 1 bug UI thật (§4a.1) + 1 lỗi typecheck của chính fix đó (§4a.2).
> **Phạm vi:** file mới dưới `docs/evidence/org-srs-008/` + **1 fix sản phẩm** `src/web/src/features/eligibility/components/MyEligibility.tsx`
> (+ 1 test trong `MyEligibility.spec.tsx`, cùng slice #31) — **không commit**, không đụng GitHub.

---

## 1. Môi trường

| Hạng mục | Giá trị |
| --- | --- |
| Repo | `/home/trung/Documents/2026/project/buildflow` |
| Commit HEAD | `ffdffef` — `feat(org): crew member management with effective periods (ORG-SRS-007, #30)` (+ working tree chưa commit của API/Web/Mobile slice #31 + fix §4a) |
| API base | `http://localhost:3000` (container `buildflow-api-1`, healthy) |
| Web base | `http://localhost:3001` (container `buildflow-web-1`, healthy, rebuild sau fix §4a) |
| Mobile base | `http://localhost:19006` (container `buildflow-mobile-1`, healthy — Expo Metro dev serving web bundle, `npm start`; static export chỉ dùng cho proof `npm run build`) |
| PostgreSQL | `docker exec buildflow-postgres-1 psql -U buildflow -d buildflow` |
| Browser | Google Chrome 151.0.7922.173 headless qua playwright-core (launch `/usr/bin/google-chrome --no-sandbox`) |
| DB migrations | không migration mới trong slice này (dùng `resource_trades` + `crew_members` sẵn có) |

> ⚠️ **Stack đã rebuild từ working tree cho E2E này** (image cũ chưa có route eligibility — probe `GET /api/v1/eligibility/me` trả `Cannot GET` trước rebuild).
> Rebuild lần 1 (đầu slice): `up -d --build api web mobile` → probe `GET /api/v1/eligibility/me` **404 đúng contract** (`RESOURCE_NOT_FOUND`, admin STAFF không hồ sơ worker).
> Rebuild lần 2 (sau fix §4a): `up -d --build web` → web healthy, `/my-eligibility` **200**, verify chuỗi fix có trong bundle production (`.next/server/chunks/9369.js`).

## 2. Tài khoản

| Email | Vai trò | Password E2E |
| --- | --- | --- |
| `admin@example.com` | ADMIN | `E2EAdmin@2025` (giữ từ ORG-SRS-001/002) |
| `pm@example.com` | PROJECT_MANAGER | `E2EPm@2025` (giữ từ ORG-SRS-003) |
| `worker1@example.com` | WORKER | `E2EWorker@2025` (dùng cho 403 + self-check) |

Seed E2E8 (driver tạo qua API, cleanup cuối run): `e2e8-zero@example.com` (zero-trade, fail-closed),
`e2e8-skill3@example.com` (trade `THO-CAT` Lv3), crew `E2E8-CREW` (leader worker2, member worker1, trade `THO-CAT` Lv3 qua `seed-008.sql`).
Không reset password — cả 3 login gốc đều còn hiệu lực.

## 3. Seed / cleanup

- **2 workers E2E8 tạo qua API (driver, admin token):** POST `/api/v1/workers`
  `e2e8-zero` (không trades) + `e2e8-skill3` (`trades: [{ tradeId: THO-CAT, skillLevel: 3 }]`), password `E2EWorker@2025`.
- **Crew E2E8 tạo qua API:** POST `/api/v1/crews` `{ code: E2E8-CREW, leaderUserId: worker2 }` +
  POST `/crews/:id/members` `{ userId: worker1 }` + file `seed-008.sql`
  (INSERT `resource_trades` `('CREW', crew, THO-CAT, Lv3)`, idempotent — crew không có API capability công khai).
- **Cleanup (driver tự chạy đầu + cuối mỗi run, audit giữ nguyên — append-only):**
  xóa crew_members + resource_trades của crew/workers E2E8 → crew E2E8 → user_roles + users E2E8.
  Đã verify sau run quyết định: crews `E2E8-%` = 0, seed users rest = 0; crew `E2E4-CREW` có sẵn không bị đụng.
  Audit tăng 461 → 471 qua run (tạo/suspend/activate/xóa entity — hợp lệ; riêng eligibility GET delta 0 ở S11).

## 4. Kịch bản & kết quả (run 3 — run quyết định, 11/11 PASS)

**Ký hiệu:** 🟢 PASS · 🔴 FAIL · 📸 ảnh trong `docs/evidence/org-srs-008/shots/`

| # | Bước (UI → HTTP → DB verify) | Kết quả | Bằng chứng |
| --- | --- | --- | --- |
| S1 | ADMIN `/workers/:worker1` → checklist đủ 5 conditions (ĐẠT/KHÔNG ĐÁNH GIÁ ĐƯỢC cho SCHEDULE_CONFLICT NOT_EVALUABLE) + verdict + `Mã đối chiếu:` khớp correlationId response bị chặn (route.fetch); API shape `resourceType/resourceId/eligible/checkedAt/correlationId/conditions/crews[]`, thứ tự condition chuẩn | 🟢 PASS | `S1-checklist.png` + HTTP §5 |
| S2 | Worker zero-trade → `CAPABILITY_DATA_MISSING`, `eligible=false`, verdict lỗi + badge KHÔNG ĐẠT (API + UI) | 🟢 PASS | `S2-failclosed.png` + HTTP §5 |
| S3 | Skill-3 worker `?tradeId=THO-CAT&skillLevel=3` → ĐẠT, `eligible=true`; `skillLevel=5` → `SKILL_LEVEL_TOO_LOW` + `eligible=false`; `tradeId` xấu → 400 | 🟢 PASS | HTTP outputs §5 |
| S4 | `Tạm ngừng` worker (dialog + reason) → `RESOURCE_INACTIVE` + `eligible=false` (API + `Kiểm tra lại` thấy `không ở trạng thái hiệu lực`); `Kích hoạt lại` → `RESOURCE_ACTIVE` OK (current-data rule) | 🟢 PASS | `S4-suspended/reactivated.png` |
| S5 | PM xem được checklist + `Mã đối chiếu:`; worker1 API eligibility 403 + UI `/workers/:id` 403 `Không có quyền truy cập` | 🟢 PASS | `S5-pm/worker403.png` |
| S6 | `/my-eligibility` worker1: checklist + crews `E2E8-CREW` (fix §4a.1); admin: 404 empty `Tài khoản không có hồ sơ worker` | 🟢 PASS | `S6-myeligibility/admin404.png` |
| S7 | `/crews/:id` checklist `MEMBER_COVERAGE` OK + `Khối lượng công việc`, `eligible=true`; suspend crew → `RESOURCE_INACTIVE` + false; activate → true lại | 🟢 PASS | `S7-crew/crew-suspended.png` |
| S8 | Mobile login worker1 → `Xem hồ sơ` → `Xem điều kiện nhận việc` → verdict `Chưa đủ điều kiện nhận việc` + conditions + crews `E2E8-CREW` từ API thật | 🟢 PASS | `S8-mobile.png` |
| S9 | Mobile login admin → eligibility → `Tài khoản không có hồ sơ worker` (404, không alert) | 🟢 PASS | `S9-mobile404.png` |
| S10 | Mobile route-intercept request đầu 500 → lỗi + `Thử lại`; retry → verdict + `Mã đối chiếu:` (2 requests) | 🟢 PASS | `S10-retry-error/retried.png` |
| S11 | `X-Correlation-Id` hợp lệ được reuse, xấu → generate UUID; `Cache-Control: no-store`; `audit_logs` 471→471 (delta 0 qua 3 eligibility GET) | 🟢 PASS | HTTP/DB §5 |

**Tổng: 11 PASS / 0 FAIL / 11 mục.**

### 4a. Fixes — FAIL run 1 (10/11) → fix → run 2 (10/11) → fix → run 3 (11/11)

**4a.1 — BUG SẢN PHẨM THẬT (đã fix trong slice): `/my-eligibility` không hiện crews membership dù API trả `crews[]`.**

- *Triệu chứng:* S6 run 1: worker1 (member `E2E8-CREW`, API `/me` trả `crews[]` đúng — mobile S8 cùng run thấy `E2E8-CREW`)
  nhưng trang web `/my-eligibility` không hề chứa mã đội (body text + screenshot xác nhận vắng mặt).
- *Nguyên nhân:* `EligibilityChecklist` dùng chung (`src/web/src/features/eligibility/components/EligibilityChecklist.tsx`)
  chỉ render verdict + conditions + checkedAt/correlationId, không render `crews[]`/`members[]`; `MyEligibility`
  (`.../eligibility/components/MyEligibility.tsx:109`) cũng không có section nào cho crews — dữ liệu bị đánh rơi ở UI.
- *Fix* (`MyEligibility.tsx`, local — không đụng checklist dùng chung của Worker/CrewDetail): thêm Card
  `Đội thi công` liệt kê `crewCode · crewName` + `Vai trò · Hiệu lực: from – to/'hiện tại'`, rỗng → `Chưa thuộc đội nào`
  (parity mobile `EligibilityScreen.tsx:129`). Thêm 1 unit test crews/empty trong `MyEligibility.spec.tsx`.
- *Verify:* unit `MyEligibility.spec.tsx` 5/5 pass; rebuild web; run 3: S6 UI hiện `E2E8-CREW` (`S6-myeligibility.png`).

**4a.2 — Lỗi typecheck của chính fix §4a.1 (không phải bug driver, không phải bug runtime):**

- *Triệu chứng:* run 2 vẫn 10/11 (S6 fail y hệt) — kiểm tra container thấy `MyEligibility.tsx` trong image **không có**
  chuỗi fix; `docker compose build web` chạy tay lộ `RUN npm run build` **exit 1** (lần `up` trước nuốt log do chỉ lấy tail).
- *Nguyên nhân:* nhánh return cuối của `MyEligibility` dùng `result.crews` trực tiếp — TS narrowing không loại được `null`
  (`error && result === null` đã return sớm nhưng TS vẫn báo `TS18047 'result' is possibly 'null'` ở 2 dòng mới).
  `next build` chạy typecheck nên image mới không bao giờ được tạo, container cũ vẫn phục vụ.
- *Fix:* `const crews = result?.crews ?? [];` trước return cuối (dự phòng unreachable-state, checklist vẫn tự xử `result null`
  bằng `Không có dữ liệu.`). `tsc --noEmit` sạch, `next lint` 0 warning, `next build` xanh, verify chuỗi fix có trong
  `.next/server/chunks/9369.js` của container đang chạy → run 3: **11/11**.
- *Bài học:* mọi `up -d --build` sau sửa web phải xác nhận image mới chứa chuỗi đổi (grep `.next`) thay vì chỉ tin `web:200`.

## 5. HTTP + DB outputs thật (run 3)

```
setup zero=d3811a9d-e064-436a-ab86-a3b51006c236 skill3=3b010c8b-82b3-4480-8916-4a00842c12b3 crew=28d9959a-96dd-4d96-995e-ae1b01cdae71 today=2026-09-06
S1  UI đủ 5 conditions + verdict + Mã đối chiếu 71877f75-243a-4f10-9fe2-4eb9bf74522a (khớp response bị chặn); API shape chuẩn, eligible=false (worker1 zero-trade)
    thứ tự RESOURCE_ACTIVE,TRADE_SKILL_MATCH,TRADE_CAPABILITY_DATA,WORKLOAD,SCHEDULE_CONFLICT; SCHEDULE null/NOT_EVALUABLE
S2  API eligible=false + TRADE_CAPABILITY_DATA CAPABILITY_DATA_MISSING; UI verdict lỗi + badge KHÔNG ĐẠT
S3  match ĐẠT eligible=true; skill5 SKILL_LEVEL_TOO_LOW eligible=false; tradeId xấu 400
S4  suspend (UI dialog + reason) → RESOURCE_INACTIVE eligible=false (UI Kiểm tra lại thấy 'không ở trạng thái hiệu lực'); activate → RESOURCE_ACTIVE OK + 'Đã kích hoạt lại worker'
S5  PM checklist + Mã đối chiếu; worker API eligibility 403 + UI 403 'Không có quyền truy cập'
S6  worker1 checklist + crews E2E8-CREW (sau fix §4a.1); /me crews[] chứa E2E8-CREW; admin empty 'Tài khoản không có hồ sơ worker'
S7  crew API resourceType=CREW + members[]; MEMBER_COVERAGE OK + WORKLOAD OK, eligible=true; suspend → RESOURCE_INACTIVE false; activate → true
S8  mobile worker1 verdict 'Chưa đủ điều kiện nhận việc' + TRADE_CAPABILITY_DATA + Mã đối chiếu + E2E8-CREW + Kiểm tra lại (API thật)
S9  mobile admin empty 'Tài khoản không có hồ sơ worker', không alert
S10 request1 500 'E2E8 loi gia lap' → lỗi + Thử lại; retry → verdict + Mã đối chiếu (tổng 2 requests)
S11 reuse a66fe2ab-694f-45ec-8c10-366e5348ce9e; corr xấu → generate UUID; Cache-Control: no-store; audit 471→471 (delta 0)
cleanup: crews rest=0, seedusers rest=0, audit 461→471 (tăng do suspend/activate + tạo/xóa entity; eligibility GET delta 0 ở S11)
```

## 6. Cách tái sinh

```bash
# 1. Rebuild stack từ working tree (gồm fix §4a)
DOCKER_CONFIG=/tmp/bfhome/.docker DOCKER_HOST=unix:///home/trung/.docker/desktop/docker.sock \
  docker compose -f infra/docker/compose.yaml up -d --build api web mobile
# 2. Chạy driver (tự seed E2E8 + crew, tự cleanup cuối run, audit giữ nguyên)
node docs/evidence/org-srs-008/e2e-driver-org-srs-008.cjs
# 3. Seed thủ công (nếu cần): xem seed-008.sql (crew trade THO-CAT Lv3 cho E2E8-CREW)
# 4. Verify image mới chứa fix (bài học §4a.2):
DOCKER_HOST=unix:///home/trung/.docker/desktop/docker.sock \
  docker exec buildflow-web-1 grep -rl "Chưa thuộc" /app/.next/server | head -n 2
```

## 7. Rủi ro / ghi chú

- **Waiver native-emulator:** mobile proof = Expo web export E2E (S8/S9/S10, API thật qua `EXPO_PUBLIC_API_URL=http://localhost:3000`)
  + jest + typecheck/lint per `MOBILE.md:106`; native device smoke deferred, reason: no SDK/emulator in env.
  Mobile container chạy Expo Metro dev (`npm start`, bundle `dev=true`) — load lần đầu chậm (timeout driver 60–120s); static export chỉ dùng cho proof `npm run build` (`dist/`, git-ignored).
- Fix §4a.1 chỉ chạm `MyEligibility` (crews của self-check). `WorkerDetail`/`CrewDetail` dùng checklist chung vẫn không render
  `crews[]`/`members[]` — có chủ ý: WorkerDetail không có yêu cầu crews trong slice; CrewDetail đã có panel `CrewMembers` đầy đủ.
- `at` chỉ chấp nhận `YYYY-MM-DD` strict (kế thừa #30) — driver dùng `TODAY` cho `effectiveFrom`; không kiểm full-ISO (ngoài phạm vi).
- `checkMyEligibility` hỗ trợ query `tradeId/skillLevel/at` nhưng trang `/my-eligibility` gọi bare (không UI filter) — giữ theo stage-2 scope.
- Playwright import kiểu `docs/evidence/org-srs-007` (absolute path `playwright-core` trong `@playwright/mcp`), Chrome `/usr/bin/google-chrome --no-sandbox` —
  `playwright-core` không có trong `node_modules` của repo nên không `require('playwright-core')` trần được.
