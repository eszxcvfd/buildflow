# JOB-SRS-002 — E2E Evidence: Kiểm tra điều kiện công bố Work Order (issue #42)

> **Loại bằng chứng:** Browser E2E thật (UI → API → PostgreSQL → UI) + HTTP-level checks bằng token thật, screenshot trong repo.
> **Ngày chạy:** 2026-09-08 UTC (`e2e-driver-job-srs-002.cjs`, **8/8 PASS ×2 runs**).
> **Trạng thái tổng:** **8/8 PASS** — không phát hiện bug sản phẩm #42.
> **Phạm vi:** file dưới `docs/evidence/job-srs-002/` — **không commit**, không đụng GitHub,
> không đụng `docs/evidence/job-srs-001/` của session khác.

> **Chuẩn hóa realistic (docs/demo-data.md, ADR-0003):** creds `@vinacons.vn`,
> WO tiếng Việt (`Thi công ván khuôn cột C2 tầng trệt <digits>`), lý do tiếng Việt
> (`Tạm dừng phục vụ kiểm thử công bố (đợt T9/2026) <digits>`). Không dùng `E2E%`/`test%`
> trong dữ liệu hiển thị; uniqueness bằng suffix digits; cleanup theo id
> (`e2e-vars.json`); audit giữ nguyên (append-only).
> Dùng tài khoản canonical nguyên trạng (không reset password, không tạo user).

---

## 1. Môi trường

| Hạng mục | Giá trị |
| --- | --- |
| Repo | `/home/trung/Documents/2026/project/buildflow` (working tree, không commit) |
| API base | `http://localhost:3000` (container `buildflow-api-1`, healthy) |
| Web base | `http://localhost:3001` (container `buildflow-web-1`, healthy — đã rebuild sau slices #41/#42) |
| PostgreSQL | `docker exec buildflow-postgres-1 psql -U buildflow -d buildflow` |
| Browser | Google Chrome headless qua playwright-core (launch `/usr/bin/google-chrome --no-sandbox`) |
| DB migrations | không migration mới trong slice này (dùng `work_orders` + `projects` + `work_types` + `project_areas` sẵn có) |

## 2. Tài khoản & fixtures

| Email | Vai trò | Membership PRA (seed canonical) | Dùng trong |
| --- | --- | --- | --- |
| `hoang.anh@vinacons.vn` | ADMIN | không member (bypass audited) | tạo WO, mọi check |
| `thang.nguyen@vinacons.vn` | WORKER | **không** ∈ PRA (member PRD) | K7 403 |
| `hau.le@vinacons.vn` | WORKER | WORKER ∈ PRA | K7 200 read scope |

Fixtures resolve qua API thật mỗi run: project `PRA` (ACTIVE), area `KQ-01` ∈ PRA,
work type `BT-CT` (active, `required_trade_id = THO-CAT`, `required_fields = []`),
trade `THO-CAT` (active), 1 area active ∈ `PRD` (cho `AREA_INVALID`).

> _Note: Throwaway E2E-only demo credentials (seed/reset per evidence docs). Never production._

## 3. Seed / cleanup

- **Không seed project/area/type mới** — dùng fixtures canonical PRA/KQ-01/BT-CT/THO-CAT nguyên trạng.
  Driver chỉ tạo: 1 WO (`POST /api/v1/work-orders`, title + digits) và 1 temp work type
  `WT-TAM-KS-<digits>` trong K5 (tạo → deactivate → trỏ WO sang → restore → xóa).
- **Cleanup id-based (cuối mỗi run, audit giữ nguyên):** `DELETE work_orders WHERE id=<woId>`;
  `DELETE work_types WHERE id=<tempWtId>`. Đã verify sau cả 2 runs: `WO rest=0`, `tempWT rest=0`.
- **Audit:** append-only, giữ nguyên; run quyết định `audit 2584→2605`
  (writes: create-WO + temp-WT lifecycle + `PROJECT_SCOPE_*` scope rows — hợp lệ;
  check không ghi audit nghiệp vụ — xem K8).
- **Không đụng data job-srs-001:** cleanup theo id WO/temp-WT của run này;
  verify `title LIKE %<digits>%` về 0 (digits khác mỗi run nên không giao nhau).

## 4. Kịch bản & kết quả (run quyết định, 8/8 PASS)

**Ký hiệu:** 🟢 PASS · 🔴 FAIL · 📸 ảnh trong `docs/evidence/job-srs-002/shots/`

| # | Bước (API → SQL → UI → DB verify) | Kết quả | Bằng chứng |
| --- | --- | --- | --- |
| K1 | `POST /work-orders` (PRA/KQ-01/BT-CT, **không** schedule/trade) → 201; `GET :id/publish-check` → **200** `ready=false`, `unmet=[MISSING_SCHEDULE ×2, MISSING_REQUIRED_SKILL]`, `workOrderId` khớp, `checkedAt` có, `Cache-Control: no-store`; `assignments` của WO = 0 | 🟢 PASS | HTTP §5 |
| K2 | UI `/work-orders/<id>` (admin): panel **“Điều kiện công bố”** + badge `Chưa đủ điều kiện` + liệt kê `MISSING_SCHEDULE` + nút **Công bố/Phân công disabled** | 🟢 PASS | `K2-panel-unmet.png` |
| K3 | `UPDATE work_orders SET planned_start/end` (SQL — không có PATCH, xem D1) → check lại → unmet **3→1 đúng** `[MISSING_REQUIRED_SKILL]`, `ready` vẫn false | 🟢 PASS | HTTP §5 |
| K4 | `UPDATE projects SET status='PAUSED'` → `PROJECT_NOT_ACTIVE` **đứng đầu** (đúng thứ tự catalog); `ACTIVE` lại → biến mất; verify `status='ACTIVE'` | 🟢 PASS | HTTP/DB §5 |
| K5 | Temp WT tạo → deactivate → trỏ WO sang → `WORK_TYPE_INACTIVE`; restore BT-CT sạch; `area_id` → area PRD → `AREA_INVALID`; restore KQ-01 sạch (verify check lại không còn 2 codes) | 🟢 PASS | HTTP/DB §5 |
| K6 | `UPDATE required_trade_id=THO-CAT` → **ready=true, unmet=[]**; UI reload → badge xanh **“Đủ điều kiện công bố”** + note chờ lệnh, Công bố **vẫn disabled** (lệnh #44 chưa mở) | 🟢 PASS | `K6-panel-ready.png` + §5 |
| K7 | Non-member PRA (thang) `GET check` → **403** (và `GET :id` → 403); WORKER member PRA (hau.le) → **200 ready=true** (read scope); anon → **401**; id sai → **400** | 🟢 PASS | HTTP §5 |
| K8 | Gọi check **2 lần** → body đồng nhất (trừ `checkedAt`); `assignments 0→0`; audit nghiệp vụ WO (`JOB_%`/`WORK_ORDER`) **không đổi** (§5: 4→4, chỉ +`PROJECT_SCOPE_*` scope rows theo J6) — không partial side-effect | 🟢 PASS | DB §5 |

**Tổng: 8 PASS / 0 FAIL / 8 mục. Run lặp độc lập: 8/8 PASS (digits khác, `rest=0`).**

### 4a. Fixes & findings (driver/assert — không fix sản phẩm)

- **F1 — K8 assert tổng audit sai (đã fix phía driver):** bản đầu assert `audit_logs` tổng
  không đổi giữa 2 lần check → FAIL `2555→2557`. Điều tra: 2 rows mới là
  `PROJECT_SCOPE_ADMIN_BYPASS` — scope service audit ADMIN-bypass trên **mọi** GET của
  admin (đúng thiết kế J6: publish-check “scope service vẫn audit ADMIN-bypass/DENIED
  như `GET :id`”; check chỉ “không audit nghiệp vụ”). Fix: K8 assert audit nghiệp vụ WO
  (`action LIKE 'JOB_%' OR entity_type='WORK_ORDER'`) + assignments → **3→3, 0→0 PASS**.
  Không phải bug sản phẩm.
- **Ghi nhận (đúng thiết kế):** K1 có thêm `MISSING_REQUIRED_SKILL` vì BT-CT yêu cầu
  trade THO-CAT mà WO mới tạo chưa gắn trade — tạo chuỗi giảm unmet đẹp K1(3)→K3(1)→K6(0).
  K5 area-PRD kèm `MISSING_REQUIRED_SKILL` (WO lúc đó chưa gắn trade) — assert `contains`
  là đủ, restore đã verify sạch.

## 5. HTTP + DB outputs thật (run quyết định, digits=341600)

```
fixtures PRA=10000000-... KQ-01=589c0681-... BT-CT=e2e4b200-... THO-CAT=11111111-... PRD-area=832b8214-...
K1  POST /work-orders → 201 id=da026aa7-...; check → 200 ready=false
    codes=[MISSING_SCHEDULE,MISSING_SCHEDULE,MISSING_REQUIRED_SKILL]; no-store; assignments=0
K2  UI panel: 'Điều kiện công bố' + 'Chưa đủ điều kiện' + MISSING_SCHEDULE; Công bố/Phân công disabled
K3  SQL schedule → re-check: unmet 3→1 [MISSING_REQUIRED_SKILL], ready=false
K4  PAUSED → [PROJECT_NOT_ACTIVE,MISSING_REQUIRED_SKILL] (đầu); ACTIVE → [MISSING_REQUIRED_SKILL]; status=ACTIVE
K5  temp WT inactive → [WORK_TYPE_INACTIVE]; area PRD → [AREA_INVALID,MISSING_REQUIRED_SKILL]; restore sạch
K6  SQL trade → ready=true unmet=[]; UI 'Đủ điều kiện công bố' + note chờ lệnh; Công bố vẫn disabled
K7  thang check → 403, GET WO → 403; hau.le check → 200 ready=true; anon → 401; bad-id → 400
K8  2× check đồng nhất (trừ checkedAt); assignments 0→0; audit WO 4→4 (chỉ +PROJECT_SCOPE_* scope rows theo J6)
cleanup: WO rest=0, tempWT rest=0, audit 2584→2605
```

## 6. Acceptance mapping (SRS.md:395)

| Tiêu chí SRS / nghiệm thu | Scenario chứng minh |
| --- | --- |
| Kiểm tra trước khi công bố/phân công (advisory, read-only) | K1 (check trả `ready` + `unmet` mà không mutate: assignments=0), K2/K6 (UI panel; nút Công bố/Phân công luôn disabled ở slice này) |
| Unmet liệt kê cụ thể từng mục | K1 (`MISSING_SCHEDULE ×2` per-field + `MISSING_REQUIRED_SKILL`), K3 (giảm 3→1 đúng), K4/K5 (mỗi code xuất hiện/biến mất đúng điều kiện) |
| Không assignment một phần (không side-effect khi kiểm tra) | K8 (2 lần cùng kết quả; `assignments 0→0`; audit nghiệp vụ WO không đổi) |
| Gate theo project/work-type/area/schedule/skill/status | K4 (`PROJECT_NOT_ACTIVE`), K5 (`WORK_TYPE_INACTIVE`, `AREA_INVALID`), K1/K3 (schedule), K3/K6 (skill), K1/K6 (status DRAFT publishable → ready) |
| Phân quyền đọc check (member mọi role; non-member 403; anon 401) | K7 (WORKER member 200; non-member 403 cả check lẫn GET; anon 401; id sai 400) |
| UI phản ánh đúng trạng thái readiness | K2 (unmet + disabled), K6 (badge xanh + note chờ JOB-SRS-004, Công bố vẫn disabled) |

**Ngoài phạm vi E2E này:** lệnh công bố (#44) và phân công (#47) chưa mở (nút disabled theo
thiết kế); `INVALID_STATUS_FOR_PUBLISH` / `ALREADY_ON_JOB_BOARD` / `WORK_TYPE_MISSING` /
`MISSING_REQUIRED_FIELD` đã cover ở unit policy 15 tests + api e2e slice (không lái E2E
trình duyệt vì cần mutate status/job-board ngoài scope read-only).
`M src/web/...work-order-templates.spec.ts` + `BRD.md` + `docs/evidence/job-srs-001/`
là của session khác — không đụng.

## 7. Cách tái sinh

```bash
# 1. Stack từ working tree:
DOCKER_HOST=unix:///home/trung/.docker/desktop/docker.sock \
  docker compose -f infra/docker/compose.yaml up -d --build api web
# 2. Chạy driver (tự tạo WO + temp WT, cleanup id-based, audit giữ nguyên):
node docs/evidence/job-srs-002/e2e-driver-job-srs-002.cjs
# → TỔNG: 8/8 PASS (ids ghi vào e2e-vars.json; shots/ K2 + K6)
```

## 8. Rủi ro / ghi chú

- Playwright import kiểu `docs/evidence/org-srs-008` (absolute path `playwright-core` trong `@playwright/mcp`), Chrome `/usr/bin/google-chrome --no-sandbox`.
- Writes kèm `X-Correlation-Id` UUID mới mỗi request (partial unique `ux_audit_correlation_action`); các `GET` check không gửi correlation (server chỉ validate cho write).
- Suite web full: 654/655 pass; 1 fail `WorkerCrews.spec.tsx` (add happy path — slice ORG-03/ORG-05, không liên quan) **pass 8/8 khi chạy isolate** → flake timing khi chạy full-suite dưới tải, ghi nhận không fix trong slice này.
- Suite api full: 133 suites / 1118 tests pass (11 skipped sẵn); `lint` + `build` api+web xanh; route `ƒ /work-orders/[id]` có trong build output.
