# ORG-SRS-007 — E2E Evidence: Quản lý thành viên đội (issue #30)

> **Loại bằng chứng:** Browser E2E thật (UI → API → PostgreSQL → UI) + HTTP-level checks bằng token thật, screenshot trong repo.
> **Ngày chạy:** 2026-09-07 UTC (`e2e-driver-org-srs-007.cjs`, run realistic sau chuẩn hóa — **11/11 PASS** ngay lần đầu).
> **Trạng thái tổng:** **11/11 PASS** — không phát hiện bug sản phẩm mới (bug §4a.1 đã fix từ slice gốc).
> **Phạm vi:** file dưới `docs/evidence/org-srs-007/` — **không commit**, không sửa product code, không đụng GitHub.
>
> **Chuẩn hóa realistic 2026-09-07 (theo [`docs/demo-data.md`](../demo-data.md)):** crews runtime
> `DTA-xxx/DTB-xxx` (`Đội thi công A/B …`), seed worker3/worker4 = Trần Minh Đức / Lê Văn Sơn
> (`@vinacons.vn`), member chính hau.le = `Lê Văn Hậu`, reasons tiếng Việt không tag E2E.
> Lịch sử §4a giữ tên pre-rename làm baseline.
> **Mapping note: audit_logs append-only — các dòng audit lịch sử vẫn giữ identifier cũ là có chủ ý.**

---

## 1. Môi trường

| Hạng mục | Giá trị |
| --- | --- |
| Repo | `/home/trung/Documents/2026/project/buildflow` |
| Commit HEAD | `91e364e` — `feat(org): crew management slice ORG-SRS-006 #29` (+ working tree chưa commit của API slice #30 và web slice #30 + fix §4a.1) |
| API base | `http://localhost:3000` (container `buildflow-api-1`, healthy) |
| Web base | `http://localhost:3001` (container `buildflow-web-1`, healthy, rebuild sau fix) |
| PostgreSQL | `docker exec buildflow-postgres-1 psql -U buildflow -d buildflow` |
| Browser | Google Chrome 151.0.7922.173 headless qua playwright-core (launch `/usr/bin/google-chrome --no-sandbox`) |
| DB migrations | không migration mới trong slice này (schema `crew_members` đã đủ — đã verify DDL: `ux_crew_member_active`, `crew_members_revocation_ck`, `crew_members_effective_dates_ck`) |

> ⚠️ **Stack đã rebuild từ working tree cho E2E này** (image cũ chưa có route members).
> Rebuild lần 1 (đầu slice): `up -d --build api web` → probe `GET /api/v1/crews/:id/members` **200**.
> Rebuild lần 2 (sau fix §4a.1): `up -d --build web` → web healthy, `/login` **200**.

## 2. Tài khoản

| Email | Vai trò | Password E2E |
| --- | --- | --- |
| `hoang.anh@vinacons.vn` | ADMIN | `E2EAdmin@2025` (giữ từ ORG-SRS-001/002) |
| `quoc.tran@vinacons.vn` | PROJECT_MANAGER | `E2EPm@2025` (giữ từ ORG-SRS-003) |
| `thang.nguyen@vinacons.vn` | WORKER | `E2EWorker@2025` (giữ từ ORG-SRS-005 §2, dùng cho check 403) |

Member pool: `hau.le@vinacons.vn` (Lê Văn Hậu, ACTIVE WORKER) — add/dup/overlap/remove;
leader 2 crews DT: `thang.nguyen@vinacons.vn` (Nguyễn Văn Thắng).
Seed thêm `duc.tran`/`son.le` (§3) cho double-submit + PM flow. Không reset password — cả 3 login gốc đều còn hiệu lực.

## 3. Seed / cleanup

- **Seed users (S10/S11):** file `seed-007.sql` — `duc.tran@vinacons.vn` (`5555…`, 'Trần Minh Đức')
  + `son.le@vinacons.vn` (`6666…`, 'Lê Văn Sơn'), `user_type='WORKER'`, `status='ACTIVE'`,
  `password_hash` copy từ thang.nguyen (tức password `E2EWorker@2025`), `user_roles` WORKER active.
  Idempotent (`ON CONFLICT DO NOTHING`).
- **2 crews DT tạo qua API (driver, admin token, leader thang.nguyen, DIGITS duy nhất mỗi run):**
  `DTA-<digits>` (`Đội thi công A <digits>`) + `DTB-<digits>` (`Đội thi công B <digits>`)
  (POST `/api/v1/crews` + `X-Correlation-Id` UUID).
- **Cleanup id-based (driver tự chạy đầu + cuối mỗi run, audit giữ nguyên — append-only):**
  xóa theo crewA/crewB ids đã ghi (`e2e-vars.json`) + seed user ids → fallback mã run-pattern
  `DTA-%`/`DTB-%` trong cửa sổ 12h (canonical `DD-CD` + `DCD-`/`DCT-` không khớp pattern).
  Đã verify sau run realistic: crews `DTA-%`/`DTB-%` = 0, seed users rest = 0; crew `DD-CD` có sẵn không bị đụng.

## 4. Kịch bản & kết quả (run realistic 2026-09-07, 11/11 PASS)

**Ký hiệu:** 🟢 PASS · 🔴 FAIL · 📸 ảnh trong `docs/evidence/org-srs-007/shots/`

| # | Bước (UI → HTTP → DB verify) | Kết quả | Bằng chứng |
| --- | --- | --- | --- |
| S1 | ADMIN login → `/crews` (table) → row crew A → Chi tiết → thêm hau.le (`effectiveFrom` today) → list hiện `Lê Văn Hậu · THÀNH VIÊN`; psql `MEMBER\|true\|today` + audit `ORG_CREW_MEMBER_ADDED=1` | 🟢 PASS | `S1-list/detail/form/added.png` |
| S2 | Thêm lại hau.le vào crew A → field error `Thành viên đã trong đội` (409); active rows = 1, audit vẫn 1 | 🟢 PASS | `S2-dup.png` + HTTP/DB §5 |
| S3 | Thêm hau.le vào crew B → success + banner `đang thuộc đội khác` (MEMBER_IN_OTHER_CREW); audit afterData chứa `_warning` | 🟢 PASS | `S3-warning.png` |
| S4 | Xóa hau.le khỏi crew B (`effectiveTo`=today + reason `Điều chuyển sang đội khác…`) → `Đã xóa…`; bật lịch sử → badge `Đã rời`; DB `false\|today`; audit `ORG_CREW_MEMBER_REMOVED` +1 có reason | 🟢 PASS | `S4-confirm/removed/history.png` |
| S5 | DELETE lại memberB → `{alreadyRemoved:true}`, audit REMOVED 1→1 (delta 0) | 🟢 PASS | HTTP outputs §5 |
| S6 | `at`=today trên crew B → hau.le vẫn hiện (point-in-time); row `from\|to\|active` trước/sau bằng nhau (nguyên vẹn); xóa mốc thời gian trả UI về mặc định | 🟢 PASS | `S6-at.png` |
| S7 | `Tạm ngừng` crew B + reason `Tạm ngừng: bảo trì thiết bị…` → `Tạm ngừng thành công`; form thêm báo `Đội đang không hoạt động` + select disabled; API POST worker3 (Trần Minh Đức) → 409 CREW_INACTIVE, không lọt row | 🟢 PASS | `S7-suspended.png` |
| S8 | thang.nguyen: panel members card 403 + API GET/POST/DELETE members đều 403 | 🟢 PASS | `S8-worker403.png` |
| S9 | `/resources?tab=workers` → select `Đội thi công` = crew A → URL `?crew=<id>`; API `total=2` (LEAD thang.nguyen + MEMBER hau.le); UI chỉ members crew A (không lọt Lê Văn Sơn); `crewId` ảo → 400 | 🟢 PASS | `S9-filter.png` |
| S10 | Double-submit add worker3 (2 POST đồng thời, corr-id khác nhau) → 201 + 409; active rows = 1; UI 1 dòng | 🟢 PASS | `S10-single.png` |
| S11 | PM login → crew A: thêm worker4 (Lê Văn Sơn, UI success) + xóa worker4 (UI success); audit ADDED/REMOVED `actor_user_id` = PM | 🟢 PASS | `S11-pm-added/pm-removed.png` |

**Tổng: 11 PASS / 0 FAIL / 11 mục.**

### 4a. Lịch sử runs 2026-09-06 (giữ làm baseline — tên pre-rename)

**4a.1 — BUG SẢN PHẨM THẬT (đã fix trong slice): success/warning notices của panel Thành viên bị xóa ngay sau khi hiện.**

- *Triệu chứng:* add/remove member qua UI: server tạo row + audit đầy đủ (timeline cập nhật, list reload thấy member),
  nhưng alert `Đã thêm…` / `Đã xóa…` / banner overlap `MEMBER_IN_OTHER_CREW` **không bao giờ hiện** (body text + MutationObserver đều xác nhận vắng mặt; chỉ 1 POST 201).
- *Nguyên nhân:* `CrewDetail.onChanged` gọi parent `load()` → `setLoading(true)` → early-return
  `if (loading)` (`CrewDetail.tsx:151`) **unmount toàn bộ cây con kể cả `<CrewMembers>`**, xóa mọi transient state
  (success/warning/notice). Khi load xong, `CrewMembers` remount tươi: list fetch lại (thấy member mới) nhưng notices đã mất.
- *Fix* (`src/web/src/features/crews/components/CrewDetail.tsx`): early-return loading/error chỉ khi **chưa có crew**
  (`loading && crew === null`, `error && crew === null`); khi đã có crew thì giữ cây con + hiện ghi chú
  `Đang tải lại…` inline (và Alert inline nếu reload lỗi mà vẫn còn dữ liệu cũ).
- *Verify:* unit `CrewDetail.spec.tsx` 5/5 pass; rebuild web; run 2+3: S1/S3/S4/S11 UI success + banner overlap hiện đầy đủ (screenshots).

**4a.2 — Lỗi driver (không phải bug sản phẩm), sửa trong driver:**

1. **S1:** `/crews` là table, link mở chi tiết có text `Chi tiết` (không chứa mã đội) → click theo `a:hasText(code)`
   timeout. Fix: `tr:hasText(code) a` (row → link Chi tiết).
2. **S7:** driver đợi text `Đã tạm ngừng`, nhưng API/Web dùng `Tạm ngừng thành công…` (đúng wording slice #29).
   Fix driver theo text thật.
3. **S11:** cột actor của `audit_logs` là `actor_user_id`, driver ghi nhầm `created_by` → PSQL ERROR.
   Fix tên cột (run 2 → run 3).

## 5. HTTP + DB outputs thật (run realistic 2026-09-07)

```
setup crewA=13024ac6-5fe7-4234-aa3c-b6700f9345d4 (DTA-R9FORO) crewB=0e9cb644-ce9b-49ee-acdc-bb62e788caf1 (DTB-R9FORO) today=2026-09-07
S1  DB MEMBER|true|2026-09-07 + audit ORG_CREW_MEMBER_ADDED=1 (afterData chứa hau.le)
S2  UI 409 field 'Thành viên đã trong đội'; active rows=1; audit vẫn 1 (409 không audit)
S3  UI success + banner overlap; audit afterData có _warning; memberB=02684c4e…
S4  DB false|2026-09-07; audit REMOVED reason='Điều chuyển sang đội khác (đợt T9/2026)' (+1)
S5  DELETE lại → 200 {alreadyRemoved:true}; audit REMOVED 1→1 (delta 0)
S6  at=2026-09-07 thấy Lê Văn Hậu; row 2026-09-07|2026-09-07|false trước=sau
S7  crewB INACTIVE; API POST worker3 → 409 CREW_INACTIVE; rows worker3@crewB=0
S8  worker GET/POST/DELETE members = 403/403/403; UI card 403
S9  API workers?crewId=crewA total=2 (thang.nguyen LEAD + hau.le MEMBER); URL tab=workers&crew=<id>&sort=createdAt&order=desc; crewId ảo → 400
S10 2×POST đồng thời → 201 + 409; active rows worker3@crewA=1
S11 PM add + remove worker4 (Lê Văn Sơn) qua UI; audit actor_user_id=22222222-… (PM) cả 2 chiều
cleanup: fbMembers DELETE 0, fbCrews rest=0, roles DELETE 2, seedusers rest=0 (audit giữ nguyên)
```

## 6. Cách tái sinh

```bash
# 1. Rebuild stack từ working tree (gồm fix §4a.1)
DOCKER_CONFIG=/tmp/bfhome/.docker DOCKER_HOST=unix:///home/trung/.docker/desktop/docker.sock \
  docker compose -f infra/docker/compose.yaml up -d --build api web
# 2. Chạy driver (tự pre-cleanup run trước + seed worker3/4 + tạo 2 crews DT, tự cleanup id-based cuối run, audit giữ nguyên)
node docs/evidence/org-srs-007/e2e-driver-org-srs-007.cjs
# → Tong: 11/11 PASS (crews DTA-/DTB-<digits> duy nhất mỗi run; ids ghi vào e2e-vars.json)
# 3. Seed thủ công (nếu cần): xem seed-007.sql (password copy từ thang.nguyen = E2EWorker@2025)
```

## 7. Rủi ro / ghi chú

- Fix §4a.1 chỉ chạm `CrewDetail` (giữ cây con khi reload). Cùng pattern `if (loading) return` unmount-cây-con
  có thể tồn tại ở trang Worker/Contractor — ngoài phạm vi slice này, chưa kiểm tra.
- Double-submit S10 ở mức API (2 corr-id khác nhau → 201+409 nhờ `ux_crew_member_active`); phía UI nút disable
  khi `addPending` (code-level, đã review — không ép timing trong E2E).
- Worker select/lookup giới hạn 100 ACTIVE (pattern CrewForm); worker3/4 seed hiện trong options — đã verify
  qua UI ở S10/S11.
- `effectiveFrom/To` dùng date input browser (YYYY-MM-DD), khớp ISO-date validation API (policy slice).
