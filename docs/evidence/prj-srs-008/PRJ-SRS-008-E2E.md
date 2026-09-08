# PRJ-SRS-008 — E2E Evidence: Quản lý mẫu công việc (issue #39)

> **Loại bằng chứng:** Browser E2E thật (UI → API → PostgreSQL → UI) + HTTP-level checks bằng token thật, screenshot trong repo.
> **Ngày chạy:** 2026-09-08 UTC (`e2e-driver-prj-srs-008.cjs`, **8/8 PASS ×2 runs**).
> **Trạng thái tổng:** **8/8 PASS** — không phát hiện bug sản phẩm #39.
> **Phạm vi:** file dưới `docs/evidence/prj-srs-008/` — **không commit**, không đụng GitHub.
>
> **Chuẩn hóa realistic (docs/demo-data.md, ADR-0003):** creds `@vinacons.vn`,
> work type `BT-CT` / trades `OP-LAT`/`DIEN` thật đang ACTIVE, template tiếng Việt
> (`Đổ bê tông dầm sàn chuẩn`, skill `Thợ điện công trình`, checklist cốp pha —
> mác bê tông — bảo dưỡng). Cleanup theo id/code (`e2e-vars.json`); audit giữ
> nguyên (append-only). Dùng 2 tài khoản canonical nguyên trạng (không reset
> password, không tạo user).

---

## 1. Môi trường

| Hạng mục | Giá trị |
| --- | --- |
| Repo | `/home/trung/Documents/2026/project/buildflow` (working tree, không commit) |
| API base | `http://localhost:3000` (container `buildflow-api-1`, healthy — **rebuild từ working tree cho run này**, xem §4a F1) |
| Web base | `http://localhost:3001` (container `buildflow-web-1`, healthy) |
| PostgreSQL | `docker exec buildflow-postgres-1 psql -U buildflow -d buildflow` |
| Browser | Google Chrome headless qua playwright-core (launch `/usr/bin/google-chrome --no-sandbox`) |
| DB migrations | không migration mới trong slice này (dùng `work_order_templates` 0008 + `work_types`/`trades` sẵn có) |

## 2. Tài khoản

| Email | Vai trò | Password E2E | Dùng cho |
| --- | --- | --- | --- |
| `quoc.tran@vinacons.vn` | PROJECT_MANAGER | `E2EPm@2025` | UI browser + mọi write API (đúng roles ADMIN+PROJECT_MANAGER của slice) |
| `hoang.anh@vinacons.vn` | ADMIN | `E2EAdmin@2025` | đọc `/audit-logs` |

> _Note: Throwaway E2E-only demo credentials (seed/reset per evidence docs). Never production._

## 3. Seed / cleanup

- **Seed (`seed-prj-srs-008.sql`, fixed UUID, `ON CONFLICT DO NOTHING`, tái chạy an toàn):**
  trade INACTIVE `THO-NGUNG-KS` (M7) + template ACTIVE `WOT-BE-TONG-COT`
  'Đổ bê tông cột chuẩn' + template DRAFT `WOT-SON-TUONG` 'Sơn tường hoàn thiện'
  (cả hai gắn work type `BT-CT` + trade `OP-LAT` thật, skill `DIEN`/`OP-LAT`
  ACTIVE, checklist 3 mục tiếng Việt).
- **Driver KHÔNG tạo user/work-type/trade thật** — dùng canonical nguyên trạng.
  Template driver `WOT-E2E-BE-TONG` tạo qua UI dialog ở M1 (transient, cleanup cuối run).
- **Cleanup id-based (driver chạy đầu + cuối mỗi run, audit giữ nguyên):**
  `work_order_templates` theo code driver + 2 id seed; `trades` theo id seed INACTIVE.
  Đã verify sau run quyết định: `rest=0/0`.
- **Audit:** append-only, giữ nguyên; run quyết định `audit 2407→2412`, run lặp
  `audit 2414→2419` (writes create/activate/update/deactivate + audit rows hợp lệ;
  409/400 không ghi audit). Run lặp 8/8 sạch khi host idle.

## 4. Kịch bản & kết quả (run quyết định, 8/8 PASS)

**Ký hiệu:** 🟢 PASS · 🔴 FAIL · 📸 ảnh trong `docs/evidence/prj-srs-008/shots/`

| # | Bước (UI → HTTP → DB verify) | Kết quả | Bằng chứng |
| --- | --- | --- | --- |
| M1 | Tạo mẫu qua dialog "Thêm mới" (code+tên+mô tả, loại BT-CT, trade OP-LAT, 150 phút, HIGH, skill DIEN, checklist 3 mục kiểu YES_NO/TEXT/YES_NO) → toast `Tạo mẫu công việc thành công`, dialog đóng, list hiện mã; API `GET /:id` = DRAFT version 1, checklist=3 | 🟢 PASS | `M1-created.png` + HTTP §5 |
| M2 | Detail → `Kích hoạt` → reason tiếng Việt → `Xác nhận` → badge `Hoạt động`; API status ACTIVE + audit `PRJ_WO_TEMPLATE_STATUS_CHANGED` query được qua `/audit-logs` | 🟢 PASS | `M2-active.png` + §5 |
| M3 | `GET /active` chứa mẫu driver + seed ACTIVE `WOT-BE-TONG-COT`, loại seed DRAFT — picker cho JOB-SRS-001 | 🟢 PASS | HTTP §5 |
| M6a | Chụp `checklist_snapshot` làm bản copy "giả định WO" tại thời điểm áp dụng (3 mục, DB bytes=436) | 🟢 PASS | HTTP/DB §5 |
| M4 | Detail → `Sửa` (prefill đúng code) → đổi tên + tiêu đề checklist #1 → `Lưu thay đổi` → success + detail hiện tên mới; API version 1→2, persists; `PATCH expectedVersion:1` stale → **409** `WORK_ORDER_TEMPLATE_CONFIG_CONFLICT`, dữ liệu nguyên vẹn | 🟢 PASS | `M4-editdialog.png` + §5 |
| M6b | WO copy byte-equal trước/sau sửa template (item1 giữ `Kiểm tra cốp pha dầm sàn`); template v2 item1 đã đổi — snapshot semantics đúng | 🟢 PASS | HTTP §5 |
| M5 | Detail → `Ngừng hoạt động` → `Xác nhận` → badge `Ngừng hoạt động`; API INACTIVE (detail vẫn đọc = lịch sử); `/active` không còn mẫu | 🟢 PASS | `M5-inactive.png` + §5 |
| M7 | `PATCH requiredTradeId` = trade INACTIVE → **400** fieldErrors; `POST` checklist thiếu title → **400** nêu title; không bản ghi lạ | 🟢 PASS | HTTP/DB §5 |

**Tổng: 8 PASS / 0 FAIL / 8 mục, lặp lại 8/8 ở run 2.**

### 4a. Fixes & findings (driver/harness — không fix sản phẩm)

- **F1 — API container stale (đã fix phía harness):** run 1: `PATCH /:id` trả **404**
  `Cannot PATCH /api/v1/work-order-templates/...` — `buildflow-api-1` đang phục vụ
  image cũ (build trước API slice #39). Fix: `docker compose up -d --build api`
  từ working tree → route có (401 thay 404 khi thiếu token), run 2: **8/8 PASS**.
  Bài học (như PRJ-SRS-006 §4a F1): mọi E2E sau sửa API phải rebuild + xác nhận route.
- **F2 — driver (đã fix phía driver):** `waitForSelector` option trong `<select>`
  timeout vì option `hidden` (visible mặc định) — chuyển sang `{ state: 'attached' }`.
- **Ghi nhận (đúng thiết kế, không fix):** 1 run web suite xen giữa có
  `WorkerCrews.spec.tsx` fail rồi pass khi chạy lẻ + pass ở lần chạy full tiếp theo
  (flaky tải song song, ngoài slice #39 — driver E2E luôn chạy một mình).

## 5. HTTP + DB outputs thật (run quyết định)

```
setup seed templates=WOT-BE-TONG-COT,WOT-SON-TUONG inactive_trade=f
M1  UI dialog tạo OK; API DRAFT v1, checklist=3, id=1227cc59…
M2  ACTIVE + audit id=f3f34319-7e31-47b7-b954-0e129dcabb54; UI badge Hoạt động
M3  /active n=2: có driver + seed ACTIVE, không DRAFT
M6a WO copy giữ 3 mục; DB snapshot bytes=436
M4  UI sửa OK v1→v2 persists; stale expectedVersion=1 → 409 CONFLICT, dữ liệu nguyên vẹn
M6b WO copy byte-equal trước/sau (item1='Kiểm tra cốp pha dầm sàn'); template v2 item1='Kiểm tra cốp pha, cốt thép dầm sàn (sửa T9)'
M5  INACTIVE (detail đọc được lịch sử); /active n=1 không chứa mẫu
M7  trade INACTIVE → 400 fieldErrors; checklist thiếu title → 400; không bản ghi lạ
cleanup: rest(templates/trades)=0/0, audit 2407→2412
```

## 6. Acceptance mapping (SRS.md:380 + PRJ-SRS-008)

| Tiêu chí SRS / nghiệm thu | Scenario chứng minh |
| --- | --- |
| Sửa mẫu không thay đổi WO đã tạo (SRS:380) | M6a+M6b (WO copy byte-equal trước/sau template edit v1→v2) |
| Người dùng chỉnh được sau khi áp dụng (SRS:380) | M4 (sửa tên + checklist trên mẫu đã ACTIVE → v2 persists; UI dialog) |
| Template inactive không dùng cho giao dịch mới | M5 (`/active` loại mẫu INACTIVE; UI badge `Ngừng hoạt động` + note snapshot) |
| Template DRAFT → ACTIVE có kiểm soát (publish guard) | M2 (dialog cảnh báo publish guard + API 400 mẫu rỗng đã cover ở api-slice; mẫu driver đủ skill/checklist nên ACTIVATE 200) |
| Picker ACTIVE cho tạo WO mới (forward-ref JOB-SRS-001) | M3 (`/active` đúng tập ACTIVE; không `/apply` — prefill qua `GET /active` + `GET /:id`) |
| Chống mất thay đổi đồng thời (optimistic locking) | M4 (stale `expectedVersion` → 409 `WORK_ORDER_TEMPLATE_CONFIG_CONFLICT` + UI notice đã cover ở web-slice spec) |
| Tham chiếu nghiệp vụ hợp lệ (trade/work-type/skill) | M7 (trade INACTIVE → 400) + M1 (skill `DIEN` ACTIVE + work-type/trade ACTIVE qua select UI) |
| Audit vòng đời mẫu | M2 (`PRJ_WO_TEMPLATE_STATUS_CHANGED`; CREATE/UPDATE cùng cơ chế tx-embedded) |

**Ngoài phạm vi E2E này:** publish guard mẫu rỗng, 409 trùng code, `X-Correlation-Id`
sai, DEACTIVATE từ DRAFT → 400 đã cover ở api-slice e2e (`work-order-templates.e2e.spec.ts`);
409 conflict notice UI + validation client đã cover ở web-slice specs (31 tests).

## 7. Cách tái sinh

```bash
# 1. Stack từ working tree (api PHẢI rebuild sau stage-1 — xem §4a F1):
DOCKER_HOST=unix:///home/trung/.docker/desktop/docker.sock \
  docker compose -f infra/docker/compose.yaml up -d --build api web
# 2. Chạy driver (tự pre-cleanup + seed + cleanup id-based, audit giữ nguyên):
node docs/evidence/prj-srs-008/e2e-driver-prj-srs-008.cjs
# → TỔNG: 8/8 PASS (ids + WO copy ghi vào e2e-vars.json)
# 3. Seed thủ công (nếu cần — driver tự apply, re-runnable):
docker exec -i buildflow-postgres-1 psql -U buildflow -d buildflow -v ON_ERROR_STOP=1 \
  < docs/evidence/prj-srs-008/seed-prj-srs-008.sql
```

## 8. Rủi ro / ghi chú

- Playwright import kiểu `docs/evidence/org-srs-008` (absolute path `playwright-core` trong `@playwright/mcp`), Chrome `/usr/bin/google-chrome --no-sandbox`.
- Writes API kèm `X-Correlation-Id` UUID mới mỗi request (partial unique `ux_audit_correlation_action`).
- M6 là **forward-ref có chủ ý**: chưa có JOB endpoint nên WO copy được mô phỏng
  bằng snapshot-copy đúng semantics T4 (pass-by-value tại thời điểm áp dụng);
  khi JOB-SRS-001 land, E2E của nó sẽ thay M6 bằng prefill thật `GET /active` + `GET /:id`.
- UI status/edit đi qua dialog thật (reason → audit `reason`); M4 stale-409 là
  API-level (UI luôn gửi `expectedVersion` tươi — notice conflict đã cover ở web spec).
- Suite `npm test`: api 126/127 suites pass (1 skip có sẵn), 1058 tests pass;
  web 95 suites / 597 tests pass; lint + build + typecheck xanh (web có 1 flaky `WorkerCrews` ở run xen — F2 §4a, ngoài slice).
