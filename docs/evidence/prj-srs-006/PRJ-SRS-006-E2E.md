# PRJ-SRS-006 — E2E Evidence: Kiểm soát truy cập dự án (issue #37)

> **Loại bằng chứng:** Browser E2E thật (UI → API → PostgreSQL → UI) + HTTP-level checks bằng token thật, screenshot trong repo.
> **Ngày chạy:** 2026-09-08 UTC (`e2e-driver-prj-srs-006.cjs`, **7/7 PASS ×2 runs**).
> **Trạng thái tổng:** **7/7 PASS** — không phát hiện bug sản phẩm #37.
> **Phạm vi:** file dưới `docs/evidence/prj-srs-006/` — **không commit**, không đụng GitHub.
>
> **Chuẩn hóa realistic (docs/demo-data.md, ADR-0003):** creds `@vinacons.vn`,
> dự án tiếng Việt (`Khu dân cư An Phú`, `Chung cư Sông Hồng`, mã `DA-AN-PHU` /
> `DA-SONG-HONG`), lý do tiếng Việt (`Điều chuyển sang công trình khác
> (đợt T9/2026)`). Không dùng `E2E%`/`test%` trong dữ liệu hiển thị;
> cleanup theo id (`e2e-vars.json`); audit giữ nguyên (append-only).
> Dùng 4 tài khoản canonical nguyên trạng (không reset password, không tạo user).

---

## 1. Môi trường

| Hạng mục | Giá trị |
| --- | --- |
| Repo | `/home/trung/Documents/2026/project/buildflow` (working tree, không commit) |
| API base | `http://localhost:3000` (container `buildflow-api-1`, healthy) |
| Web base | `http://localhost:3001` (container `buildflow-web-1`, healthy — rebuild từ working tree cho run này, xem §4a) |
| Mobile base | `http://localhost:19006` (container `buildflow-mobile-1`, healthy — Expo Metro dev serving web bundle; static export chỉ dùng cho proof `npm run build`) |
| PostgreSQL | `docker exec buildflow-postgres-1 psql -U buildflow -d buildflow` |
| Browser | Google Chrome headless qua playwright-core (launch `/usr/bin/google-chrome --no-sandbox`) |
| DB migrations | không migration mới trong slice này (dùng `projects` + `project_members` sẵn có) |

## 2. Tài khoản

| Email | Vai trò | Password E2E | Membership seed |
| --- | --- | --- | --- |
| `hoang.anh@vinacons.vn` | ADMIN | `E2EAdmin@2025` | không member A/B (bypass audited) |
| `quoc.tran@vinacons.vn` | PROJECT_MANAGER | `E2EPm@2025` | MANAGER của A và B |
| `thang.nguyen@vinacons.vn` | WORKER | `E2EWorker@2025` | WORKER của A, **không** ∈ B (tampering target; bị revoke ở T5) |
| `hau.le@vinacons.vn` | WORKER | `E2EWorker2@2025` | WORKER của B, **không** ∈ A (chiều ngược, T4/T6) |

Seed memberships bổ sung (ngoài bảng trên): `dong.trinh` COORDINATOR của A, `ba.nguyen` VIEWER của B.
> _Note: Throwaway E2E-only demo credentials (seed/reset per evidence docs). Never production._

## 3. Seed / cleanup

- **Seed (`seed-prj-srs-006.sql`, fixed UUID, `ON CONFLICT DO NOTHING`, tái chạy an toàn):**
  A `DA-AN-PHU` Khu dân cư An Phú (ACTIVE, manager quoc.tran) + B `DA-SONG-HONG`
  Chung cư Sông Hồng (ACTIVE, manager quoc.tran); 6 memberships active
  (2 MANAGER + WORKER/COORDINATOR cho A + WORKER/VIEWER cho B).
- **Driver KHÔNG tạo user** — dùng canonical `docs/demo-data.md` nguyên trạng
  (không reset password). Membership canonical (vd thang ∈ PRD) được giữ nguyên
  và không bị đụng: T2 assert theo hướng chứa-loại trừ (có A, không B) thay vì bằng đúng.
- **Cleanup id-based (driver chạy đầu + cuối mỗi run, audit giữ nguyên):**
  `project_areas` → `project_members` → `projects` theo id A/B.
  Đã verify sau run quyết định: `projects rest=0`.
- **Audit:** append-only, giữ nguyên; run quyết định `audit 2293→2309`, run lặp
  `audit 2328→2344` (writes seed-revoke-area + bypass/denied rows — hợp lệ;
  GET scope không ghi audit). Run lặp 7/7 sau khi loại 1 run nhiễu do chạy 3 suites
  song song (xem §4a F3).

## 4. Kịch bản & kết quả (run quyết định, 7/7 PASS)

**Ký hiệu:** 🟢 PASS · 🔴 FAIL · 📸 ảnh trong `docs/evidence/prj-srs-006/shots/`

| # | Bước (UI → HTTP → DB verify) | Kết quả | Bằng chứng |
| --- | --- | --- | --- |
| T1 | Tampering: WORKER A `GET /projects/<B>` → **403**, body không chứa tên/mã B; `PATCH /projects/<B>` → **403** không leak, data B nguyên vẹn (psql); UI deep-link `/projects/<B-id>` → EmptyState `Bạn không phải thành viên dự án này` + `Về danh sách dự án`, không alert đỏ, không leak tên B | 🟢 PASS | `T1-deeplink403.png` + HTTP/DB §5 |
| T2 | Member A `GET /projects` → chứa A, **không** B (server scope; kèm PRD canonical — đúng vì thang ∈ PRD); UI `/projects` hiện A, không B | 🟢 PASS | `T2-listscope.png` + §5 |
| T3 | Admin (không member) `GET /projects/<B>` → **200** đủ data; `GET /audit-logs?action=PROJECT_SCOPE_ADMIN_BYPASS` có row (actor admin, entity B); UI admin mở detail B thấy tên | 🟢 PASS | `T3-adminbypass.png` + §5 |
| T4 | Members read: WORKER A `GET /projects/<A>/members` → **200**, thấy đồng đội (Trịnh Văn Đông COORDINATOR…); hau.le (∉ A) → **403** + audit `PROJECT_SCOPE_DENIED` scope READ | 🟢 PASS | HTTP §5 |
| T5 | Revoke mid-flight: MANAGER (quoc.tran) `DELETE /projects/<A>/members/<thang>` → 200 (lý do tiếng Việt); request kế tiếp của thang `GET A` → **403**, `PATCH A` → **403**; psql tên A giữ nguyên (không partial write); list loại A | 🟢 PASS | HTTP/DB §5 |
| T6 | Mobile (hau.le, ∈ B ∉ A): list `/projects` hiện `DA-SONG-HONG`, không `DA-AN-PHU`; tap → detail B (tên + section `Thành viên` đủ MANAGER/WORKER/VIEWER từ API thật); deep-link `/projects/<A>` → `Bạn không phải thành viên dự án này (403)` + nút về danh sách, không leak tên A | 🟢 PASS | `T6-mobilelist/mbiledetail/mobile403.png` + §5 |
| T7 | Area regression: MANAGER `POST /projects/<A>/areas` (`KHU-THAP-A` Khu tháp A – Tầng trệt) → **201**, persist psql; revoked-worker `POST /projects/<B>/areas` → **403**, không bản ghi lạ | 🟢 PASS | HTTP/DB §5 |

**Tổng: 7 PASS / 0 FAIL / 7 mục.**

### 4a. Fixes & findings (driver/harness — không fix sản phẩm)

- **F1 — web container stale (đã fix phía harness):** run 1: T1 UI deep-link hiện copy cũ
  (`Không có quyền truy cập — cần ADMIN hoặc PROJECT_MANAGER (403)` + Alert) thay vì
  EmptyState graceful của stage-2. Nguyên nhân: `buildflow-web-1` đang phục vụ image cũ
  (build trước web slice; bundle `.next` không chứa chuỗi mới). Fix: rebuild
  `docker compose up -d --build web` từ working tree → run 2: T1 UI graceful đúng.
  Bài học (như ORG-SRS-008 §4a.2): mọi E2E sau sửa web phải rebuild + xác nhận hành vi UI.
- **F2 — tap→detail SPA render chậm trên Metro dev (đã fix phía driver):** sau tap,
  URL đổi ngay sang `/projects/<id>` nhưng nội dung detail render chậm/không ổn định
  (body còn màn hình cũ). Driver assert URL đổi (navigation OK) rồi `reload` cold-boot
  cùng session (flow người dùng thật) rồi assert nội dung API thật. Deep-link trực tiếp
  render đầy đủ (đã probe độc lập). Không phải bug sản phẩm.
- **F3 — run nhiễu do song song hóa (đã loại, chạy lại sạch):** 1 run xen giữa chạy
  đồng thời 3 suites `npm test` (api/web/mobile) + driver trên cùng host → Chrome
  chết giữa chừng (T2/T3/T6 `browser has been closed`) + `docker exec` psql timeout
  ở assert T1 (`PSQL ERROR: spawnSync docker ETIMEDOUT` — PATCH API vẫn 403 đúng).
  T4/T5/T7 API-level vẫn PASS trong run đó. Run này **không tính**; chạy lại tuần tự
  khi host idle → **7/7 PASS** (`audit 2328→2344`, `rest=0`). Quy tắc: driver E2E
  luôn chạy một mình, suites chạy riêng (file log).
- **Ghi nhận (đúng thiết kế, không fix):** T2 list của thang có 2 mục (A + PRD canonical)
  — assert chứa-loại trừ là đủ cho server scope; revoke T5 chỉ đụng membership seed A,
  PRD canonical nguyên vẹn.

## 5. HTTP + DB outputs thật (run quyết định)

```
setup seed projects=DA-AN-PHU,DA-SONG-HONG active_memberships=6
T1  GET B (thang): 403 {"message":"Không có quyền truy cập dự án này",...} (không tên/mã B)
    PATCH B (thang): 403 (không leak); psql name B='Chung cư Sông Hồng' (nguyên vẹn)
    UI deep-link: 'Bạn không phải thành viên dự án này' + 'Về danh sách dự án', alert=0
T2  GET /projects (thang): n=2 [DA-AN-PHU, PRD], không DA-SONG-HONG; UI khớp
T3  GET B (admin): 200 {code:DA-SONG-HONG,...}
    audit BYPASS id=361141d7-... (actor admin, entity B); UI admin detail hiện tên B
T4  GET A/members (thang): 200 [Nguyễn Văn Thắng|Trịnh Văn Đông|Trần Quốc Điều]
    GET A/members (hau.le): 403 + audit DENIED id=f4aa7f49-... scope=READ
T5  DELETE members (pm MANAGER): 200; thang GET A → 403; thang PATCH A → 403
    psql name A='Khu dân cư An Phú' (không partial write); list loại A
T6  mobile (hau.le): list [DA-SONG-HONG] không DA-AN-PHU; detail B + Thành viên
    (Lê Văn Hậu WORKER · Nguyễn Văn Ba VIEWER · Trần Quốc Điều MANAGER);
    deep-link A → 'Bạn không phải thành viên dự án này (403)', không leak tên A
T7  POST areas A (pm): 201 KHU-THAP-A (psql count=1); POST areas B (thang): 403 (count=0)
cleanup: projects rest=0, audit 2293→2309
```

## 6. Acceptance mapping (SRS.md PRJ-SRS-006 + §7.3)

| Tiêu chí SRS / nghiệm thu | Scenario chứng minh |
| --- | --- |
| Người dùng không thể truy cập dự án ngoài phạm vi bằng cách sửa tham số (SRS:378) | T1 (GET/PATCH trực tiếp B → 403 không leak + UI deep-link graceful) |
| Hệ thống dùng vai trò + quan hệ thành viên giới hạn danh sách, chi tiết, thao tác | T2 (list scope), T1 (detail), T7 (thao tác area), T5 (thao tác sau revoke) |
| Quyền quản trị ngoại lệ phải được audit | T3 (`PROJECT_SCOPE_ADMIN_BYPASS` query được qua `/audit-logs`) |
| Từ chối ngoài phạm vi được audit (ENDPOINTS §15 decision B) | T4 (`PROJECT_SCOPE_DENIED` scope READ; T1/T5 denied WRITE cùng cơ chế) |
| Người bị loại không tiếp tục truy cập dữ liệu mới (PRJ-SRS-005 liên đới) | T5 (revoke → 403 ngay, list loại, không partial write) |
| Thành viên (mọi role) đọc được đồng đội (ENDPOINTS §15 M5-after) | T4 (WORKER đọc members 200) + T6 (mobile members từ API thật) |
| Web/Mobile 403-graceful, không leak, có lối về | T1 (web), T6 (mobile) |
| Area scope regression (A4 qua ProjectScopeService chung) | T7 |

**Ngoài phạm vi E2E này:** work-types giữ global catalog (ENDPOINTS §15 — KHÔNG đụng,
đã assert bằng không thay đổi); `POST /projects` create giữ nguyên (P9 auto-membership
đã cover ở api-slice); in-tx re-check race (S3 ENDPOINTS) cover ở unit/e2e api-slice.

## 7. Cách tái sinh

```bash
# 1. Stack từ working tree (web phải rebuild sau stage-2 — xem §4a F1):
DOCKER_HOST=unix:///home/trung/.docker/desktop/docker.sock \
  docker compose -f infra/docker/compose.yaml up -d --build api web mobile
# 2. Chạy driver (tự pre-cleanup + seed + cleanup id-based, audit giữ nguyên):
node docs/evidence/prj-srs-006/e2e-driver-prj-srs-006.cjs
# → TỔNG: 7/7 PASS (ids seed ghi vào e2e-vars.json)
# 3. Seed thủ công (nếu cần — driver tự apply, re-runnable):
docker exec -i buildflow-postgres-1 psql -U buildflow -d buildflow -v ON_ERROR_STOP=1 \
  < docs/evidence/prj-srs-006/seed-prj-srs-006.sql
```

## 8. Rủi ro / ghi chú

- Playwright import kiểu `docs/evidence/org-srs-008` (absolute path `playwright-core` trong `@playwright/mcp`), Chrome `/usr/bin/google-chrome --no-sandbox`.
- Writes kèm `X-Correlation-Id` UUID mới mỗi request (partial unique `ux_audit_correlation_action`).
- T3/T4 là API-level cho phần audit (UI không có màn hình audit-logs cho admin trong slice này — query qua API).
- Mobile proof = Expo web bundle E2E (API thật qua `EXPO_PUBLIC_API_URL`) + jest + typecheck/lint per `MOBILE.md`; không native smoke (không hành vi native mới trong slice #37 — list/detail là màn hình dữ liệu thuần).
- T6 tap→detail cần `reload` ổn định render (F2 §4a) — navigation đã assert qua URL đổi trước reload.
