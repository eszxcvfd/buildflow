# PRJ-SRS-004 — E2E Evidence: Loại công việc (issue #35)

> **Loại bằng chứng:** Browser E2E thật (UI → API → PostgreSQL → UI) + HTTP-level checks bằng token thật, screenshot trong repo.
> **Ngày chạy:** 2026-09-08 UTC (`e2e-driver-prj-srs-004.cjs`, **9/9 PASS**).
> **Trạng thái tổng:** **9/9 PASS** — không phát hiện bug sản phẩm #35.
> **Phạm vi:** file dưới `docs/evidence/prj-srs-004/` — **không commit**, không đụng GitHub.
>
> **Chuẩn hóa realistic (docs/demo-data.md, ADR-0003):** creds `@vinacons.vn`,
> loại công việc tiếng Việt kiểu doanh nghiệp (`Thi công sơn nước`,
> `Lắp đặt điện`, `Thi công ốp lát`, `Đổ bê tông thủ công`), mã suffix tự
> nhiên (`WT-SON-NUOC`, `WT-OP-LAT-TUONG`, trade tạm `THO-DA`), lý do tiếng
> Việt (`…(đợt T9/2026)`). Không dùng `E2E%`/`test%` trong dữ liệu hiển thị;
> cleanup theo id (`e2e-vars.json`) + fallback `created_at`.

---

## 1. Môi trường

| Hạng mục | Giá trị |
| --- | --- |
| Repo | `/home/trung/Documents/2026/project/buildflow` (working tree, không commit) |
| API base | `http://localhost:3000` (container `buildflow-api-1`, healthy) |
| Web base | `http://localhost:3001` (container `buildflow-web-1`, healthy — đã chứa web slice `/work-types`) |
| PostgreSQL | `docker exec buildflow-postgres-1 psql -U buildflow -d buildflow` |
| Browser | Google Chrome headless qua playwright-core (launch `/usr/bin/google-chrome --no-sandbox`) |
| DB migrations | 0007 `prj_srs004_work_types` đã apply (`work_type_group`, `required_fields`, `config_version`) |

> Không rebuild cho run quyết định (không đổi product code — evidence-only).

## 2. Tài khoản

| Email | Vai trò | Password E2E |
| --- | --- | --- |
| `hoang.anh@vinacons.vn` | ADMIN | `E2EAdmin@2025` |

Mọi thao tác chạy dưới ADMIN (read + write work-types mở cho ADMIN + PROJECT_MANAGER theo ENDPOINTS §14).
> _Note: Throwaway E2E-only demo credentials (seed/reset per evidence docs). Never production. Creds trong driver env-overridable (`E2E_ADMIN_PASS`, default giữ giá trị bảng trên để driver chạy được ngay)._

## 3. Seed / cleanup

- **Seed (`seed-prj-srs-004.sql`, fixed UUID, driver KHÔNG xóa):** 4 loại demo,
  `INSERT ... ON CONFLICT (code) DO NOTHING` (tái chạy an toàn, không reset trạng thái):
  `WT-SON-NUOC` Thi công sơn nước (Hoàn thiện / trade SON-NUOC / 2 fields),
  `WT-DIEN` Lắp đặt điện (Cơ điện / trade DIEN / 2 fields),
  `WT-OP-LAT` Thi công ốp lát (Hoàn thiện / trade OP-LAT / 2 fields),
  `WT-BE-TONG-TC` Đổ bê tông thủ công (Kết cấu / không trade / 1 field).
- **Lịch sử seed:** setup của driver DEACTIVATE `WT-BE-TONG-TC` qua API thật
  (lý do `Kết thúc biện pháp thi công thủ công…`, tạo audit
  `PRJ_WORK_TYPE_STATUS_CHANGED` thật); run sau thấy đã INACTIVE thì giữ nguyên.
  Trạng thái cuối: 3 ACTIVE + 1 INACTIVE (`config_version` giữ 1 — status change không bump version, đúng W4).
- **Driver tạo (cleanup cuối run theo id + fallback `created_at` 12h, audit giữ nguyên):**
  `WT-OP-LAT-TUONG` Thi công ốp lát tường (S1–S7) + trade tạm `THO-DA` Thợ đá hoa cương (S8).
  Đã verify sau run quyết định: `WT-OP-LAT-TUONG rest=0`, trade tạm `rest=0`, seed `4/4`.
- **Audit:** append-only, giữ nguyên; run quyết định in `baseline audit=2175`,
  `audit 2175→2186` (driver log §5; per-scenario audit assert ở S1/S5).

## 4. Kịch bản & kết quả (run quyết định, 9/9 PASS)

**Ký hiệu:** 🟢 PASS · 🔴 FAIL · 📸 ảnh trong `docs/evidence/prj-srs-004/shots/`

| # | Bước (UI → HTTP → DB verify) | Kết quả | Bằng chứng |
| --- | --- | --- | --- |
| S1 | Mở `/work-types` thấy seed `Thi công sơn nước`; tạo `WT-OP-LAT-TUONG` qua Dialog Thêm mới (trade OP-LAT + 2 fields Diện tích/Ảnh nghiệm thu) → toast `Tạo loại công việc thành công` + hiện trong list; `GET search` thấy row `configVersion=1`; psql `WT-OP-LAT-TUONG\|1`; audit `PRJ_WORK_TYPE_CREATED` actor admin | 🟢 PASS | `S1-created.png` + HTTP/DB §5 |
| S2 | Detail: profile-card (h1 + chip code + badge Hoạt động) + def-grid (Mô tả, Nhóm `Hoàn thiện`, Ngành nghề `OP-LAT`, `v1`, `Được phép — chọn được cho work order mới`) + bảng required fields (Diện tích/Ảnh nghiệm thu); API `GET :id` đủ `configVersion=1` + `usage:{workOrders}` | 🟢 PASS | `S2-detail.png` + §5 |
| S3 | Sửa qua dialog Sửa (prefill code đúng) — thêm field `Ngày thi công` (DATE) → toast `Cập nhật loại công việc thành công` → detail `v2` + field mới; API `configVersion=2`, 3 fields | 🟢 PASS | `S3-updated.png` + §5 |
| S4 | Dialog Sửa đang mở (stale v2) + PATCH API bump group → v3 (`versionChanged:true`); submit dialog → notice `Version cấu hình đã thay đổi (hiện tại: 3)` + nút `Tải lại`; PATCH stale trực tiếp → **409** `WORK_TYPE_CONFIG_CONFLICT` + `fieldErrors.expectedConfigVersion`; version giữ 3 (không mất thay đổi) | 🟢 PASS | `S4-conflict.png` + §5 |
| S5 | Ngừng hoạt động qua StatusDialog + reason (`Tạm dừng để rà soát định mức…`) → success `Đã chuyển sang Ngừng hoạt động` + badge `Ngừng hoạt động`; psql `is_active=false` (**row còn — no hard delete**); audit `STATUS_CHANGED` reason đủ | 🟢 PASS | `S5-deactivated.png` + §5 |
| S6 | `GET /work-types/active` `total=4` (3 seed active + BT-CT demo có sẵn): KHÔNG chứa `WT-OP-LAT-TUONG` vừa deactivate lẫn seed BETONG inactive; toàn row `ACTIVE` — contract picker cho Work Order mới (JOB chưa có, picker là bằng chứng) | 🟢 PASS | HTTP §5 |
| S7 | Detail loại inactive vẫn load đủ: badge `Ngừng hoạt động`, `Phiên bản cấu hình`, `Bị chặn — loại ngừng hiệu lực…`, bảng fields đủ; API `GET :id` **200** (không 404) `status=INACTIVE` + `configVersion` | 🟢 PASS | `S7-inactive-detail.png` + §5 |
| S8 | Tạo trade tạm `THO-DA` → DEACTIVATE → POST work-type với trade inactive → **400** `fieldErrors.requiredTradeId="Ngành nghề không tồn tại hoặc đã ngừng hoạt động"`; không tạo bản ghi (`count=0`); trade tạm đã cleanup | 🟢 PASS | `S8-validation.png` (giữ trang S7 — S8 API-only) + §5 |
| S9 | Edit dialog đổi `Thời lượng` → `180` + `Ưu tiên` → `Cao`: panel `Xem trước cấu hình` trong dialog hiện đúng `180 phút`/`Cao`; lưu → toast `Cập nhật loại công việc thành công`; API `configVersion` giữ nguyên (v3 — chỉ đổi duration/priority không bump, đúng W4), `defaultDurationMinutes=180`, `defaultPriority=HIGH` | 🟢 PASS | `S9-duration-priority.png` + §5 |

**Tổng: 9 PASS / 0 FAIL / 9 mục**.

### 4a. Fixes & findings (driver/assert — không fix sản phẩm)

- **F1 — text notice conflict (đã fix):** UI hiển thị đúng field-error từ API
  (`Version cấu hình đã thay đổi (hiện tại: N)`); chuỗi `Cấu hình đã được người
  khác cập nhật` chỉ là fallback khi rỗng (`WorkTypeForm.tsx:209`). Driver assert theo text thật + nút `Tải lại`.
- **F2 — trùng `id="worktype-group"` (đã fix phía driver, quan sát sản phẩm):**
  `id` này tồn tại 2 lần khi dialog mở (`WorkTypesList.tsx:154` filter +
  `WorkTypeForm.tsx:248`) — selector document-wide strict-violation/chạm nhầm
  filter sau lưng (làm hụt field group ở 1 run). Driver scope mọi tương tác vào
  `.bf-dialog`. Không chặn nghiệm thu; đề xuất web slice đổi id filter (minor a11y).
- **Ghi nhận (đúng thiết kế, không fix):** deactivate không bump `configVersion`
  (BETONG giữ v1); UI select ngành nghề chỉ liệt kê trade ACTIVE nên S8 chạy
  bằng API trực tiếp; `/active total=4` gồm `BT-CT` demo có sẵn ngoài seed.

## 5. HTTP + DB outputs thật (run quyết định)

```
baseline audit=2175
setup BETONG đã INACTIVE (giữ nguyên); audit STATUS_CHANGED rows=1
S1  UI toast 'Tạo loại công việc thành công' + list Thi công ốp lát tường
    GET search: {code:WT-OP-LAT-TUONG|group:Hoàn thiện|configVersion:1|fields:2}
    psql: WT-OP-LAT-TUONG|1 (code|config_version)
    audit: 11111111-…|PRJ_WORK_TYPE_CREATED (actor admin)
S2  UI đủ h1+chip+badge+def-grid (Nhóm Hoàn thiện, OP-LAT, v1, Được phép)+bảng fields
    GET :id: {configVersion:1|usage:{workOrders:number}}
S3  UI toast 'Cập nhật loại công việc thành công' + v2 + Ngày thi công
    GET :id: {configVersion:2|fields:3}
S4  API bump: 200 {versionChanged:true} → v3
    UI notice 'Version cấu hình đã thay đổi (hiện tại: 3)' + nút Tải lại
    API stale: 409 {"code":"WORK_TYPE_CONFIG_CONFLICT",fieldErrors:{expectedConfigVersion}}
    GET :id: configVersion=3 (không mất thay đổi)
S5  UI 'Đã chuyển sang Ngừng hoạt động…' + badge Ngừng hoạt động
    psql is_active=false (row còn — không hard delete)
    audit STATUS_CHANGED reason='Tạm dừng để rà soát định mức nghiệm thu ốp lát (đợt T9/2026)'
S6  GET /active total=4 [BT-CT,WT-DIEN,WT-OP-LAT,WT-SON-NUOC]; loại trừ WT-OP-LAT-TUONG + WT-BE-TONG-TC
S7  UI badge Ngừng hoạt động + 'Bị chặn…' + fields đủ
    GET :id inactive → 200 {status:INACTIVE|configVersion:3}
S8  trade tạm THO-DA tạo (201) → INACTIVE (200)
    POST work-type trade inactive → 400 fieldErrors.requiredTradeId='Ngành nghề không tồn tại hoặc đã ngừng hoạt động'
    psql WT-DA-HOA-CUONG count=0
S9  dialog preview dl.bf-def-grid hiện '180 phút' + 'Cao' sau khi đổi input
    UI toast 'Cập nhật loại công việc thành công'
    GET :id: {configVersion:3 (giữ nguyên, không bump)|defaultDurationMinutes:180|defaultPriority:HIGH}
cleanup: WT-OP-LAT-TUONG rest=0, trade tạm rest=0, seed=4/4, audit 2175→2186
```

## 6. Acceptance mapping (issue #35)

| Tiêu chí SRS / kịch bản nghiệm thu tối thiểu | Scenario chứng minh |
| --- | --- |
| Tạo type với skill/required data hợp lệ | S1 (trade OP-LAT + 2 fields, 201 + audit) |
| Inactive type bị loại khỏi giao dịch mới | S6 (picker `/active` loại trừ; JOB đọc contract này) |
| Version/config cũ của WO không bị thay đổi khi type sửa | S3 + S4 (config_version bump có kiểm soát; conflict không mất thay đổi) |
| Test quyền (đúng role thành công) | S1–S5 dưới ADMIN (roles ADMIN+PM ở unit/e2e API slice; WORKER 403 đã cover ở api-slice e2e) |
| Test validation + trạng thái không hợp lệ | S8 (trade inactive → 400 đúng field) |
| Retry/double-submit | Idempotent `alreadyInState` đã cover ở api-slice; E2E này không tạo trùng (cleanup id-based) |
| UI dùng API thật, cập nhật đúng trạng thái | S1–S5, S7 (toast/list/detail/badge đều render từ API thật) |
| Dữ liệu cũ hiển thị đúng (inactive readable) | S7 |
| Hai admin cập nhật đồng thời → conflict | S4 (409 + UI notice + nút tải lại) |
| Đổi duration/priority không tăng version (semantics W4) | S9 (preview đúng + `configVersion` giữ nguyên) |
| Audit actor/before-after/reason | S1 (CREATED), S5 (STATUS_CHANGED + reason), setup BETONG |

**Ngoài phạm vi E2E này (JOB chưa tồn tại):** `JOB publish thiếu required data bị chặn`,
`Create/edit Work Order render field theo type` — contract (`/active`,
`requiredFields`, `configVersion`, `usage`) đã sẵn sàng và được assert ở S2/S6.

## 7. Cách tái sinh

```bash
# 1. Stack đã chạy canonical ports — nếu cần rebuild từ working tree:
DOCKER_HOST=unix:///home/trung/.docker/desktop/docker.sock \
  docker compose -f infra/docker/compose.yaml up -d --build api web
# 2. Seed thủ công (nếu cần — driver tự apply, re-runnable):
DOCKER_HOST=unix:///home/trung/.docker/desktop/docker.sock \
  docker exec -i buildflow-postgres-1 psql -U buildflow -d buildflow -v ON_ERROR_STOP=1 \
  < docs/evidence/prj-srs-004/seed-prj-srs-004.sql
# 3. Chạy driver (tự cleanup id-based + fallback created_at, audit giữ nguyên):
node docs/evidence/prj-srs-004/e2e-driver-prj-srs-004.cjs
```

## 8. Rủi ro / ghi chú

- Case-race `ux_work_types_code` (ghi trong api-slice) không covered ở E2E — cần 2 request đồng thời khác case; 409 path đã có unit test.
- `warning` khi config đổi/deactivate đang bị WO tham chiếu không covered (JOB chưa có → `usage.workOrders=0`; contract warning đã có unit test).
- WORKER read catalog (403) không bấm ở E2E này — đã có api-slice e2e (403 WORKER); UI 403 state có component test.
- Playwright import kiểu `docs/evidence/org-srs-008` (absolute path `playwright-core` trong `@playwright/mcp`), Chrome `/usr/bin/google-chrome --no-sandbox`.
- Writes kèm `X-Correlation-Id` UUID mới mỗi request (partial unique `ux_audit_correlation_action`).
- S6/S8 là API-level (S6 không có UI picker cho `/active` ở web slice — JOB sẽ dùng; S8 vì UI select chỉ liệt kê trade ACTIVE).
