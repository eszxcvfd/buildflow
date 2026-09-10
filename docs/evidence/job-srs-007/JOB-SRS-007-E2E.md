# JOB-SRS-007 E2E — Chi tiết công việc còn trống (issue #47)

> **Phạm vi:** mobile lane (T5) + evidence + docker của plan `docs/plans-job-srs-007.md`
> (backend lane T1–T4 đã xong ở stage trước: endpoint `GET /api/v1/job-board/:id` +
> policy BD-3 + use case scope-first + mapper `toJobBoardDetailResponse` + docs contract
> §20.2 + unit/mapper/controller/PG/in-memory specs xanh).
> Driver: `e2e-driver-job-srs-007.cjs` (fork pattern driver-006, label mới `-S7R*`).
> Ba run ALL-PASS: `run-S7R1.stdout.log` + `e2e-vars-S7R1.json` (audit rows=4225),
> `run-S7R2.stdout.log` + `e2e-vars-S7R2.json` (audit rows=4238),
> `run-S7R3.stdout.log` + `e2e-vars-S7R3.json` (audit rows=4251 — rerun sau fix
> HOLD F001/F002, driver assert 28 keys sau khi bổ sung `dueAt` + `workTypeGroup`).
> Shots: `shots/S7-*-S7R1.png`, `shots/S7-*-S7R2.png`, `shots/S7-*-S7R3.png`
> (5 shots/run, tên mới — không đè history 005/006).
>
> > **Note supersede (điều kiện HOLD #47):** commit cũ `b997837` thuộc kỷ nguyên
> > trước reset (mở rộng `GET /api/v1/work-orders/:id` + driver cũ) KHÔNG còn là
> > lịch sử chuẩn của driver này. Run hiện hành là S7R1/S7R2 trên `13f528b`
> > (endpoint mới `GET /api/v1/job-board/:id`, driver `e2e-driver-job-srs-007.cjs`
> > hiện tại); mọi run sau (S7R3+) nối tiếp lineage này.

## 1. Trung thực (đọc trước)

1. **In-memory specs KHÔNG phải real-DB proof.** `src/api/test/job-board-detail.e2e.spec.ts`
   chạy trên repository in-memory — proof real-DB duy nhất là driver này
   (API thật → PostgreSQL thật → Expo UI thật).
2. **CTA "Nhận việc" là placeholder #48.** onPress chỉ re-fetch re-check (không POST,
   không route, không command) — driver chứng minh bằng `assignments` count không đổi
   qua 2 lần nhấn + audit delta 0. Mọi log/note ghi rõ "hint #48". Claim write thật
   thuộc #48.
3. **Nhánh 409 `JOB_BOARD_CONFIG_INVALID` KHÔNG chạy ở driver này.** FK
   `work_type_id NOT NULL` khiến nhánh này defensive/wiring — phủ bởi unit backend
   (`job-board-detail.use-case.spec.ts` 409/config-error), không ép bằng psql phá FK.
4. **Mobile test bằng Expo web** (`http://localhost:19006`, Chrome headless) — cùng build
   image với native (Dockerfile một image), interaction qua accessibilityLabel thật.
   Native device smoke (emulator) chưa chạy — ghi nhận residual.
5. **Driver hardening trung thực:** lần chạy đầu lộ 3 lỗi setup driver (thiếu
   `customFields.anh_ban_ve` bắt buộc của work-type DIEN; keyword assert sai tên trade
   seed `Tho cat gach`; click nút dưới fold bị intercept → chuyển sang `goBack()`
   theo tiền lệ 006) + 1 orphan DRAFT đã dọn tay bằng psql có verify (`rest=0`).
   Mọi run FAIL trung gian đã cleanup; artifacts chỉ giữ các run ALL-PASS (S7R1/S7R2 tiền-fix + S7R3 hậu-fix HOLD).

## 2. Seed matrix (planned = run-time now+1d → +2d, window mở ngay)

| WO | Project | Area | WorkType | Trade | Vai trò |
|---|---|---|---|---|---|
| A | PRA | KQ01 | BT-CT | THO-CAT | detail chính (checklist per-type + generic) |
| B | PRA | KQ01 | DIEN | DIEN | state-change (PM đóng giữa 2 GET) |
| C | PRB | GAA03 | BT-CT | THO-CAT | ngoài scope worker (403 thật) |

`customFields` đúng `required_fields` từng work-type (DIEN: `so_diem_dien` + `anh_ban_ve`).

## 3. Kết quả step (khớp cả 3 run S7R1/S7R2/S7R3)

| Step | Nội dung | Kết quả |
|---|---|---|
| S0 | Login PM quoc.tran + worker ba.nguyen, baseline audit/notif | PASS |
| S1 | Tạo 3 WO qua API + publish-check + mở board (API thật) | PASS |
| S2 | Detail A 200 đủ 28 keys top-level §3.1 (`id,code,title,status,priority,projectId,projectName,areaId,areaName,workTypeId,workTypeName,workTypeDescription,workTypeRequiredFields,workTypeGroup,requiredTradeId,requiredTradeName,plannedStartAt,plannedEndAt,dueAt,plannedHeadcount,jobBoard,description,instructions,customFields,checklists,version,createdAt,updatedAt`) + checklist `{CLT-BT-COT, CLT-ATLD-DV}` ACTIVE (loại DRAFT/work-type khác) + items đủ keys; 403 unknown-id + 403 PRB + 401 + 400 UUID + PM đọc C 200 + R1 filter-options 200; không PII (`createdBy`/`requestKey`/`hasActiveAssignment` vắng) | PASS |
| S3 | PM đóng board B giữa 2 GET → AVAILABLE(v2)→CLOSED(v3), không command cũ từ worker | PASS |
| S4 | 3 GET-200 → audit delta 0, notif delta 0; 1 GET-403 → đúng 1 `PROJECT_SCOPE_DENIED` (audit từ chối kỳ vọng); checklist 5/5, seeded 3/3 | PASS |
| S5 | Expo UI: board → Xem chi tiết A → sections (thời gian/dự án/loại/thợ/checklist) + CTA Nhận việc → nhấn → hint #48 (assignments 0→0) → PM đóng A → nhấn CTA re-check → banner state-changed + CTA biến mất → Tải lại (banner mất, data CLOSED giữ) → back | PASS (5 shots/run) |
| S6 | Cleanup by-id: WO rest=0, assignments rest=0, seeded 3/3 | PASS |

**TỔNG: 7/7 PASS × 3 run (S7R1 audit 4225, S7R2 audit 4238, S7R3 audit 4251).**

## 4. AC map (bằng chứng)

- AC-1 (mở detail + re-check hiện hành): S2 (200 đủ sections) + S3 (GET-2 phản ánh state mới) + S5 (UI detail từ board).
- AC-2 (đủ thông tin quyết định): S2 (28 keys + enrich project/area/trade/work-type + customFields + checklists items) + S5 (sections render + shots `S7-detail-*`).
- AC-3 (CTA khi available, claim là #48): S5 (CTA khi AVAILABLE + nhấn → hint #48 + assignments 0→0; CTA biến mất khi CLOSED) + unit mobile (CTA matrix 5 state, không POST).
- AC-4 (state đổi → thông báo + tải lại, không command cũ): S3 (API) + S5 (banner `detail state changed` + `Tải lại` giữ data CLOSED + assignments 0) + shots `S7-changed-*`/`S7-reloaded-*`.
- AC-5 (scope + không PII): S2 (403 unknown-id + 403 PRB + trường cấm vắng ở API và UI) + unit mobile (403 xóa detail).
- AC-6 (reference lỗi → báo config, không hiển thị sai): unit backend 409 (driver không ép — mục 1.3) + unit mobile (banner `detail config error`, empty-checklist là state hợp lệ).
- AC-7 (permission mất → không stale): S5-driver (403 re-fetch xóa detail — phủ bởi unit mobile `403 on re-fetch`) + S4 (403 → audit `PROJECT_SCOPE_DENIED`).
- Checkbox 7 (read-only, không double-submit): S4 (delta 0) + S5 (assignments 0→0 qua CTA) — retry claim thật thuộc #48.
- Checkbox 8 (integration real-DB): driver này + shots.

## 5. Residual / chưa phủ

- 409 `JOB_BOARD_CONFIG_INVALID` end-to-end: chỉ unit (mục 1.3).
- Native emulator smoke: chưa chạy (Expo web interaction đã PASS).
- Accessibility iOS/Android kiểm tra tay: chưa (MOBILE.md checklist giữ `[ ]`).
- Run logs `run-*.stdout.log` bị `.gitignore` (`*.log`) — ngoại lệ có chủ đích: log là
  evidence của slice này, force-add (`git add -f`) để đính kèm khi commit.
