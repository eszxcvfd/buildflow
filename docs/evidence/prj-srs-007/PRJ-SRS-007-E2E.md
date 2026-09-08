# PRJ-SRS-007 — E2E Evidence: Vòng đời dữ liệu nền (issue #38)

> **Loại bằng chứng:** Browser E2E thật (UI → API → PostgreSQL → UI) + HTTP-level checks bằng token thật, screenshot trong repo.
> **Ngày chạy:** 2026-09-08 UTC (`e2e-driver-prj-srs-007.cjs`, **6/6 PASS ×2 runs**).
> **Trạng thái tổng:** **6/6 PASS** — không phát hiện bug sản phẩm #38.
> **Phạm vi:** file dưới `docs/evidence/prj-srs-007/` — **không commit**, không đụng GitHub.
>
> **Chuẩn hóa realistic (docs/demo-data.md, ADR-0003):** creds `@vinacons.vn`,
> dự án tiếng Việt (`Khu dân cư Phước Long`, mã `DA-PHUOC-LONG`), areas tiếng Việt
> (`Khu tháp A/B`, `Khu thương mại – dịch vụ`), lý do tiếng Việt
> (`Gộp khu tháp A vào khu tháp B (đợt T9/2026)`…). Không dùng `E2E%`/`test%`
> trong dữ liệu hiển thị (chỉ suffix ngẫu nhiên `E2E7-xxxxxx` cho code kỹ thuật
> trades/work-types/crews seed để tái chạy an toàn — không hiển thị trên UI);
> cleanup theo id (`e2e-vars.json`); audit giữ nguyên (append-only).
> Dùng 2 tài khoản canonical nguyên trạng (không reset password, không tạo user).

---

## 1. Môi trường

| Hạng mục | Giá trị |
| --- | --- |
| Repo | `/home/trung/Documents/2026/project/buildflow` (working tree, không commit) |
| API base | `http://localhost:3000` (container `buildflow-api-1`, healthy — rebuild từ working tree cho run này) |
| Web base | `http://localhost:3001` (container `buildflow-web-1`, healthy — rebuild từ working tree cho run này) |
| PostgreSQL | `docker exec buildflow-postgres-1 psql -U buildflow -d buildflow` |
| Browser | Google Chrome headless qua playwright-core (launch `/usr/bin/google-chrome --no-sandbox`) |
| DB migrations | không migration mới trong slice này (dùng `projects` + `project_members` + `project_areas` + `work_orders` + `work_types` + `trades` + `resource_trades` + `crews` sẵn có) |

## 2. Tài khoản

| Email | Vai trò | Password E2E | Membership seed |
| --- | --- | --- | --- |
| `hoang.anh@vinacons.vn` | ADMIN | `E2EAdmin@2025` | không member P (read audit, tạo trade) |
| `quoc.tran@vinacons.vn` | PROJECT_MANAGER | `E2EPm@2025` | MANAGER của P (tạo/retire/rename areas, work-types, crews) |
| `thang.nguyen@vinacons.vn` | WORKER | _(không dùng login — chỉ id)_ | WORKER của P; crew leader seed L5; `resource_trades` owner |

> _Note: Throwaway E2E-only demo credentials (seed/reset per evidence docs). Never production._

## 3. Seed / cleanup

- **Seed (`seed-prj-srs-007.sql`, fixed UUID, `ON CONFLICT DO NOTHING`, tái chạy an toàn):**
  P `DA-PHUOC-LONG` Khu dân cư Phước Long (ACTIVE, manager quoc.tran) + 2 memberships
  active (MANAGER pm, WORKER thang).
- **Runtime (driver tạo qua API + SQL để có audit rows):** 3 areas A1/A2/A3 qua
  `POST /projects/:id/areas`; work-type `LOAI-E2E7-*` qua `POST /work-types`;
  2 work_orders qua SQL trực tiếp (WO1 `OPEN`→A3 cho L4, WO2 `READY`→A2 cho L6 —
  forward-ref JOB: module JOB chưa tồn tại nên seed SQL là đường duy nhất tạo WO);
  trade + `resource_trades` + work-type thứ hai + crew cho L5.
- **Cleanup id-based (driver chạy đầu + cuối mỗi run, audit giữ nguyên):**
  `work_orders` → `project_areas` → `work_types` (ids runtime) →
  `resource_trades`/`trades` (prefix `NGHE-E2E7-%`) → `crew_members` → `crews`
  → `project_members` → `projects` theo id P.
  Đã verify sau run quyết định: `projects/areas/work_orders/trades/work_types/crews rest=0`.
- **Audit:** append-only, giữ nguyên; run quyết định `audit 2383→2400`, run lặp
  `audit 2364→2381` (writes areas + WO lifecycle + trades/work-types/crews — hợp lệ).

## 4. Kịch bản & kết quả (run quyết định, 6/6 PASS)

**Ký hiệu:** 🟢 PASS · 🔴 FAIL · 📸 ảnh trong `docs/evidence/prj-srs-007/shots/`

| # | Bước (UI → HTTP → DB verify) | Kết quả | Bằng chứng |
| --- | --- | --- | --- |
| L1 | Retire A1 qua UI confirm: mở dialog `Ngừng sử dụng khu vực "Khu tháp A"?`, nhập reason, `Xác nhận ngừng sử dụng` → notice success `Đã ngừng sử dụng khu vực … — lịch sử vẫn được giữ.` + badge `Ngừng sử dụng`; audit `PRJ_AREA_STATUS_CHANGED` (entity P, afterData chứa A1, `reason` đúng từng ký tự) | 🟢 PASS | `L1-confirm/L1-retired.png` + §5 |
| L2 | Picker `GET /projects/<P>/areas/active` → chỉ A2 + A3, loại A1 retired, không row `isActive=false` | 🟢 PASS | HTTP §5 |
| L3 | No-hard-delete: `DELETE /projects/<P>/areas/<A1>` → **404** (không endpoint xóa); `GET` list areas → A1 vẫn đủ (`isActive=false`, tên nguyên) — dữ liệu cũ đọc đủ | 🟢 PASS | HTTP §5 |
| L4 | Usage warning: WO1 `OPEN` gắn A3 → retire A3 qua UI → notice info `Đã ngừng sử dụng khu vực … — <warning> (đang có 1 work order đang hiệu lực).` + audit afterData gắn `_warning`; cleanup WO1 | 🟢 PASS | `L4-confirm/L4-warning.png` + §5 |
| L5 | Lifecycle regression: trade deactivate khi có `resource_trades` active → `warning: 'Danh mục đang được tham chiếu…'` + audit `ORG_TRADE_STATUS_CHANGED`; work-type `DEACTIVATE` → `/work-types/active` loại + audit `PRJ_WORK_TYPE_STATUS_CHANGED` (reactivate cleanup); crew/worker `open-work` → `200 {openAssignments: 0/0}`; crew `SUSPEND` + audit `ORG_CREW_SUSPENDED` | 🟢 PASS | HTTP §5 |
| L6 | Rename lan tỏa: `PATCH` A2 → tên mới; `WO-007-002` (seed trước rename) giữ nguyên `area_id` + `code`/`title` — kết quả đã lưu không đổi | 🟢 PASS | HTTP/DB §5 |

**Tổng: 6 PASS / 0 FAIL / 6 mục.**

### 4a. Fixes & findings (driver/harness — không fix sản phẩm)

- **F1 — crew leader phải là worker profile (đã fix phía driver):** run 1: L5 tạo crew
  với `leaderUserId` = pm → `400 Trưởng nhóm phải là worker đang hoạt động`.
  Đúng thiết kế (crew domain rule). Fix: dùng WORKER canonical `thang.nguyen`
  làm leader (đồng thời cho worker `open-work` read). Run 1 đạt 5/6 **không tính**;
  chạy lại sạch → **6/6 PASS ×2**.
- **Ghi nhận (đúng thiết kế, không fix):** `DELETE` area trả `404` (không route —
  Nest default), không `405`; chấp nhận cả hai trong driver vì cùng nghĩa "không
  endpoint xóa". Trade/work-type/crew seed dùng code prefix `E2E7-` + suffix ngẫu
  nhiên để tái chạy an toàn — là code kỹ thuật, không hiển thị trên UI retire flow.

## 5. HTTP + DB outputs thật (run quyết định)

```
setup seed project='Khu dân cư Phước Long' active_memberships=2
setup: areas A1=<uuid> A2=<uuid> A3=<uuid>
L1  UI retire A1 (reason 'Gộp khu tháp A vào khu tháp B (đợt T9/2026)')
    → notice 'Đã ngừng sử dụng khu vực "Khu tháp A" — lịch sử vẫn được giữ.' + badge
    audit PRJ_AREA_STATUS_CHANGED id=7f5aaa1d-... reason đúng từng ký tự
L2  GET /areas/active: n=2 [A2,A3], loại A1, không row isActive=false
L3  DELETE area → 404; GET list: A1 isActive=false, tên 'Khu tháp A' nguyên
setup: work_orders=2 (WO1 OPEN→A3, WO2 READY→A2)
L4  UI retire A3 → notice '… (đang có 1 work order đang hiệu lực).'
    audit afterData có _warning; WO1 cleanup
L5  trade deactivate → warning 'Danh mục đang được tham chiếu…' + audit ORG_TRADE_STATUS_CHANGED
    work-type DEACTIVATE (alreadyInState=false) → /active loại + audit PRJ_WORK_TYPE_STATUS_CHANGED
    crew open-work 200 {openAssignments:0}; worker open-work 200 {openAssignments:0}
    crew SUSPEND + audit ORG_CREW_SUSPENDED
L6  rename A2 → 'Khu tháp B – mở rộng (đợt T9/2026)'; WO-007-002 area_id+code/title unchanged
cleanup: projects rest=0, work_orders rest=0, audit 2383→2400
```

## 6. Acceptance mapping (SRS.md PRJ-SRS-007 + §7.3)

| Tiêu chí SRS / nghiệm thu | Scenario chứng minh |
| --- | --- |
| Không xóa cứng dữ liệu đang được tham chiếu (SRS:379) | L3 (không DELETE endpoint — 404; retired vẫn resolve đủ) + L1/L4 (retire giữ lịch sử, audit đầy đủ) |
| Danh sách chọn chỉ hiển thị bản ghi còn hoạt động cho giao dịch mới (SRS:379) | L2 (picker `/areas/active` loại retired) + L5 (picker `/work-types/active` tương đương) |
| Danh mục đã phát sinh giao dịch hỗ trợ trạng thái hoạt động/ngừng hoạt động | L1 (retire + reason + audit), L4 (retire khi có WO mở — cảnh báo không chặn), L5 (trades/work-types/crews status lifecycle) |
| Đổi tên lan tỏa label, không sửa kết quả đã lưu (ENDPOINTS §13.1 A9) | L6 (WO cũ giữ `area_id` + code/title sau rename) |
| Cảnh báo usage khi ngừng hoạt động dữ liệu đang dùng (ENDPOINTS §13.1 A7) | L4 (usage=1 + warning UI + `_warning` audit) + L5 (trade in-use warning) |
| Mọi transition trạng thái được audit với actor/reason (ENDPOINTS §13 A6) | L1 (STATUS_CHANGED + reason), L4 (`_warning`), L5 (4 audit actions), L6 (UPDATED qua rename) |

**Ngoài phạm vi E2E này:** deactivate-race 403/rollback (unit spec `#38`); skills
`skill_level` 1–5 worker-search khớp `is_active` (contract DB, không UI trong slice);
project/work-type `alreadyInactive`/`alreadyInState` idempotency (unit/e2e api-slice).

## 7. Cách tái sinh

```bash
# 1. Stack từ working tree (api+web rebuild sau stage #38):
DOCKER_HOST=unix:///home/trung/.docker/desktop/docker.sock \
  docker compose -f infra/docker/compose.yaml up -d --build api web
# 2. Chạy driver (tự pre-cleanup + seed + cleanup id-based, audit giữ nguyên):
node docs/evidence/prj-srs-007/e2e-driver-prj-srs-007.cjs
# → TỔNG: 6/6 PASS (ids seed ghi vào e2e-vars.json)
# 3. Seed thủ công (nếu cần — driver tự apply, re-runnable):
docker exec -i buildflow-postgres-1 psql -U buildflow -d buildflow -v ON_ERROR_STOP=1 \
  < docs/evidence/prj-srs-007/seed-prj-srs-007.sql
```

## 8. Rủi ro / ghi chú

- Playwright import kiểu `docs/evidence/org-srs-008` (absolute path `playwright-core` trong `@playwright/mcp`), Chrome `/usr/bin/google-chrome --no-sandbox`.
- Writes kèm `X-Correlation-Id` UUID mới mỗi request (partial unique `ux_audit_correlation_action`).
- WO seed qua SQL trực tiếp (forward-ref JOB — module JOB chưa tồn tại, API chưa có endpoint tạo WO); cleanup xóa theo `project_id`.
- L4 retire A3 qua UI nên warning được assert qua notice text (mirror trung thực giới hạn contract: list không trả `usage`, warning chỉ có sau PATCH — xem báo cáo lc-web stage-2).
- Crew leader seed phải là worker profile đang hoạt động (`thang.nguyen`) — rule domain, xem §4a F1.
