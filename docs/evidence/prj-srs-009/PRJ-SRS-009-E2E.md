# PRJ-SRS-009 — E2E Evidence: Tài liệu đính kèm (issue #40)

> **Loại bằng chứng:** Browser E2E thật (UI → API → PostgreSQL → UI) + HTTP-level checks bằng token thật, screenshot trong repo.
> **Ngày chạy:** 2026-09-08 UTC (`e2e-driver-prj-srs-009.cjs`, **9/9 PASS ×2 runs**).
> **Trạng thái tổng:** **9/9 PASS** — không phát hiện bug sản phẩm #40.
> **Phạm vi:** file dưới `docs/evidence/prj-srs-009/` — **không commit**, không đụng GitHub.
>
> **Chuẩn hóa realistic (docs/demo-data.md, ADR-0003):** creds `@vinacons.vn`,
> project canonical `PRA` Trung tâm thương mại Sunshine Plaza (+ WO canonical
> `PRD-B1-001` cho L5), file tiếng Việt (`Bản vẽ mặt bằng tầng 1`, `Ảnh tiến độ`).
> Cleanup theo id (`e2e-vars.json` `attIds` + files uploads mới); audit giữ
> nguyên (append-only). Dùng tài khoản canonical nguyên trạng (không reset
> password, không tạo user). **Không seed SQL** — project/member/WO đã có sẵn
> (đúng chỉ đạo "seed SQL chỉ tạo project/member nếu cần" — ở đây không cần).

---

## 1. Môi trường

| Hạng mục | Giá trị |
| --- | --- |
| Repo | `/home/trung/Documents/2026/project/buildflow` (working tree, không commit) |
| API base | `http://localhost:3000` (container `buildflow-api-1`, healthy — **rebuild từ working tree cho run này**, xem §4a F1) |
| Web base | `http://localhost:3001` (container `buildflow-web-1`, healthy, đã có slice #40) |
| PostgreSQL | `docker exec buildflow-postgres-1 psql -U buildflow -d buildflow` |
| Storage | `UPLOADS_DIR=/app/uploads` (named volume, baseline **trống** khi setup) |
| Browser | Google Chrome headless qua playwright-core (launch `/usr/bin/google-chrome --no-sandbox`) |
| DB migrations | không migration mới trong slice này (dùng `attachments` 0010 sẵn có) |

## 2. Tài khoản

| Email | Vai trò project | Password E2E | Dùng cho |
| --- | --- | --- | --- |
| `quoc.tran@vinacons.vn` | PROJECT_MANAGER · MANAGER của PRA + PRD | `E2EPm@2025` | UI browser + mọi write API |
| `hau.le@vinacons.vn` | WORKER của PRA, **∉ PRD** | `E2EWorker2@2025` | A7 member-read + L5 outsider + UI ẩn nút |
| `thang.nguyen@vinacons.vn` | **∉ PRA**, WORKER của PRD | `E2EWorker@2025` | A7 non-member 403 |
| `hoang.anh@vinacons.vn` | ADMIN | `E2EAdmin@2025` | đọc `/audit-logs` |

> _Note: Throwaway E2E-only demo credentials (seed/reset per evidence docs). Never production._

## 3. Seed / cleanup

- **Không seed SQL** (không file seed): project `PRA` (`10000000-…-000000000001`),
  project `PRD` + WO `PRD-B1-001` (`e2e4b300-…`) là dữ liệu canonical có sẵn;
  memberships nguyên trạng. Mọi attachment tạo hoàn toàn qua API/UI trong driver.
- **Cleanup id-based (driver chạy đầu + cuối mỗi run, audit giữ nguyên):**
  `DELETE FROM attachments WHERE id IN (<attIds driver>)` + xóa files uploads
  mới (so với baseline đầu run — baseline trống cả hai project).
  Đã verify sau run quyết định: `attachments=0`, `/app/uploads/` trống
  (2 thư mục project rỗng sót lại đã `rmdir` thủ công sau run).
- **Audit:** append-only, giữ nguyên; run quyết định `audit(UPLOADED+RETIRED) 0→6`
  (5 upload: A1 + A2×2 + A8×1 + L5×1; 1 retire: A6), run lặp `6→12` (+6 tương tự).

## 4. Kịch bản & kết quả (run quyết định, 9/9 PASS)

**Ký hiệu:** 🟢 PASS · 🔴 FAIL · 📸 ảnh trong `docs/evidence/prj-srs-009/shots/`

| # | Bước (UI → HTTP → DB verify) | Kết quả | Bằng chứng |
| --- | --- | --- | --- |
| A1 | Upload PDF qua UI dialog (file thật + caption tiếng Việt) → toast `Đã tải lên`, row hiện tên; API metadata đúng name/type(`application/pdf`)/size/caption/`isActive`, `uploaded_by`=PM (DB), profile OMIT `storageKey`/`requestKey`, list có `no-store` | 🟢 PASS | `A1-uploaded.png` + HTTP/DB §5 |
| A2 | Upload JPEG + WebP qua API → **201** + mime sniff đúng cả hai | 🟢 PASS | HTTP §5 |
| A3 | File txt / EXE (`MZ`) đổi tên `.jpg` → **400** `fieldErrors.file` cả hai; không DB row, **không chạm disk** | 🟢 PASS | HTTP + uploads listing §5 |
| A4 | File JPEG-magic >10MB (10485860 B) → **400** nêu lý do kích thước; không DB row, không chạm disk | 🟢 PASS | HTTP + uploads listing §5 |
| A5 | Download A1 → sha256 **khớp** file gốc; `Content-Disposition: attachment` + `no-store` | 🟢 PASS | HTTP §5 |
| A6 | Retire qua UI (reason tiếng Việt) → toast + badge `Đã ngừng`, row **vẫn trong list**; API `isActive=false` + `deactivate_reason` đúng; audit `PRJ_ATTACHMENT_RETIRED` query được; download sau retire vẫn 200 byte-equal; retire lần 2 → `alreadyInactive`, **không audit mới** | 🟢 PASS | `A6-retired.png` + §5 |
| A7 | WORKER PRA upload → **403**, retire → **403**; WORKER list 200 + download 200 byte-equal; non-member PRA list/upload/download → **403**, body không leak tên project; không DB row lạ; UI WORKER: **ẩn nút `Tải lên`**, vẫn thấy list | 🟢 PASS | `A7-worker.png` + HTTP/DB §5 |
| A8 | Upload 2 lần cùng `requestKey` → **201** rồi **200**+`idempotentReplay` cùng id; list total +1; audit `UPLOADED` cho entity = 1 (replay không audit) | 🟢 PASS | HTTP/DB §5 |
| L5 | WO extension: upload PDF lên WO → **201** `ownerType=WORK_ORDER` + `workOrderId`/`projectId`(resolve từ WO) đúng; WO list chứa file; outsider PRD (hau.le) upload/list → **403** | 🟢 PASS | HTTP §5 |

**Tổng: 9 PASS / 0 FAIL / 9 mục, lặp lại 9/9 ở run 2.**

### 4a. Fixes & findings (driver/harness — không fix sản phẩm)

- **F1 — API container stale (đã fix phía harness):** probe đầu run
  `GET /projects/<PRA>/attachments` (token PM hợp lệ) trả **404** — `buildflow-api-1`
  đang phục vụ image cũ (build trước API slice #40, working tree chưa build).
  Fix: `docker compose up -d --build api` từ working tree → list `200`,
  run quyết định **9/9 PASS**. Bài học (như PRJ-SRS-006 §4a F1, PRJ-SRS-008 §4a F1):
  mọi E2E sau sửa API phải rebuild + probe route trước khi chạy.
- Ghi nhận (đúng thiết kế, không fix): web suite có `WorkerCrews.spec.tsx`
  flaky dưới tải song song (fail 2/5 run full, pass 8/8 khi chạy lẻ + pass full
  ở các run còn lại — cùng flake đã ghi ở PRJ-SRS-008 §4a F2, ngoài slice #40,
  file này không bị chạm bởi #40).

## 5. HTTP + DB outputs thật (run quyết định)

```
setup: PRA list probe=200 total=0; uploads baseline PRA/PRD rỗng
A1  UI upload OK; metadata name/type/size/uploader đúng; no-store; id=7db96035…
A2  JPEG 201 + WebP 201, mime sniff đúng; ids=7eeab1be…/5610a784…
A3  txt/exe rename .jpg → 400 fieldErrors.file; không DB row, không chạm disk
A4  >10MB (10485860B) → 400 lý do rõ; không DB row, không chạm disk
A5  sha256 khớp 165f1bed7edec5f5…; attachment + no-store
A6  badge Đã ngừng + audit 5620fd6d…; history giữ + download ok; alreadyInactive không audit
A7  WORKER upload/retire 403 + list/download ok; non-member 403 không leak; UI ẩn nút
A8  201 → 200+idempotentReplay cùng id; total +1; audit=1
L5  WO upload 201 ownerType=WORK_ORDER + list thấy; outsider 403; id=b468cd9b…
cleanup: rest(attachments/files)=0/0, audit(UPLOADED+RETIRED) 0→6
```

## 6. Acceptance mapping (SRS.md:381 + PRJ-SRS-009)

| Tiêu chí SRS / nghiệm thu | Scenario chứng minh |
| --- | --- |
| Upload PDF hợp lệ qua UI dialog, metadata đúng (name/type/size/uploader) | A1 (dialog thật + API verify + `uploaded_by` DB + profile OMIT đúng §18) |
| Upload JPEG + WebP ok | A2 (201 + sniff magic, không tin header) |
| Sai loại (txt/exe rename .jpg — server magic-byte reject) lý do rõ | A3 (400 `fieldErrors.file`; không chạm disk) |
| Quá 10MB reject | A4 (400 lý do kích thước; không chạm disk) |
| Tải xuống — nội dung byte-equal file gốc (hash so sánh) | A5 (sha256 khớp + `attachment` + `no-store`) |
| Ngừng sử dụng + reason → badge + audit; file vẫn trong list với cờ (history giữ) | A6 (badge `Đã ngừng` UI + `isActive=false` + audit `RETIRED` + download sau retire + `alreadyInactive` không audit) |
| Permission: WORKER member upload → 403 + list/download ok; non-member → 403 không leak | A7 (write 403 / read 200 / non-member 403 + body không leak + UI ẩn nút Tải lên) |
| Retry idempotent: 2 lần cùng requestKey → 1 file (`idempotentReplay`) | A8 (201→200 replay cùng id, total +1, không audit mới) |
| WO attach (L5-style, slice API có route work-orders) | L5 (upload + list trên WO, `ownerType=WORK_ORDER`, outsider 403) |

**Ngoài phạm vi E2E này:** anon 401, bad `X-Correlation-Id` 400, caption/reason dài
400, scope-bind att↔path 404, race 23505, orphan cleanup, audit-fail 500 đã cover
ở api-slice e2e (`project-attachments.e2e.spec.ts`); 400 classify client, replay/
alreadyInactive notice UI, 403 graceful đã cover ở web-slice specs (17 tests).

## 7. Cách tái sinh

```bash
# 1. Stack từ working tree (api PHẢI rebuild sau stage-1 — xem §4a F1):
DOCKER_HOST=unix:///home/trung/.docker/desktop/docker.sock \
  docker compose -f infra/docker/compose.yaml up -d --build api web
# 2. Chạy driver (tự pre-cleanup + cleanup id-based, audit giữ nguyên, không seed):
node docs/evidence/prj-srs-009/e2e-driver-prj-srs-009.cjs
# → TỔNG: 9/9 PASS (ids + sha256 ghi vào e2e-vars.json)
```

## 8. Rủi ro / ghi chú

- Playwright import kiểu `docs/evidence/org-srs-008` (absolute path `playwright-core` trong `@playwright/mcp`), Chrome `/usr/bin/google-chrome --no-sandbox`.
- Writes API kèm `X-Correlation-Id` UUID mới mỗi request (partial unique `ux_audit_correlation_action`).
- Fixture files sinh trong `os.tmpdir()` mỗi run (magic bytes thật theo đúng
  sniff policy) — không file fixture nào commit vào repo.
- Uploader chứng minh qua DB `uploaded_by` (đúng thiết kế profile §18 OMIT
  uploader — UI stage-2 đã quyết định không cột 'Người tải').
- Big file A4 (~10MB) gửi qua fetch localhost — qua nhanh, không ảnh hưởng các run.
- Suite `npm test`: api 130 suites pass (1 skip có sẵn), **1092 passed**;
  web 100 suites / **641 passed** (có flake `WorkerCrews` song song đã biết —
  pass lẻ 8/8 + pass full ở run cuối); `lint` api+web sạch; `build` api (tsc) +
  web (next build) OK.
