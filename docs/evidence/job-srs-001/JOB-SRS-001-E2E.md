# JOB-SRS-001 — E2E Evidence: Tạo Work Order nháp (issue #41)

> **Loại bằng chứng:** Browser E2E thật (UI → API → PostgreSQL → UI) + HTTP-level checks bằng token thật, screenshot trong repo.
> **Ngày chạy:** 2026-09-08 UTC (`e2e-driver-job-srs-001.cjs`, **9/9 PASS ×2 runs liên tiếp**).
> **Trạng thái tổng:** **9/9 PASS** — không phát hiện bug sản phẩm #41 (W1–W8 giữ nguyên scenario, +W9 gate G3).
> **Phạm vi:** file dưới `docs/evidence/job-srs-001/` — **không commit**, không đụng GitHub.

> **Chuẩn hóa realistic (docs/demo-data.md, ADR-0003):** creds `@vinacons.vn`,
> WO tiếng Việt (`Thi công sàn B1 khu KQ-01 <digits>`), lý do tiếng Việt
> (`Tạm dừng loại tạm phục vụ E2E (đợt T9/2026) <digits>`). Không dùng `E2E%`/`test%`
> trong dữ liệu hiển thị; uniqueness bằng suffix digits; cleanup theo id
> (`e2e-vars.json`); audit giữ nguyên (append-only).
> Dùng tài khoản canonical nguyên trạng (không reset password, không tạo user).

---

## 1. Môi trường

| Hạng mục | Giá trị |
| --- | --- |
| Repo | `/home/trung/Documents/2026/project/buildflow` (working tree, không commit) |
| API base | `http://localhost:3000` (container `buildflow-api-1`, healthy — **đã rebuild sau API-fixes slice G1/G2/G3**) |
| Web base | `http://localhost:3001` (container `buildflow-web-1`, healthy) |
| PostgreSQL | `docker exec buildflow-postgres-1 psql -U buildflow -d buildflow` |
| Browser | Google Chrome headless qua playwright-core (launch `/usr/bin/google-chrome --no-sandbox`) |
| DB migrations | không migration mới (dùng `work_orders` + `projects` + `work_types` + `project_areas` sẵn có) |

## 2. Tài khoản & fixtures

| Email | Vai trò | Membership PRA (seed canonical) | Dùng trong |
| --- | --- | --- | --- |
| `hoang.anh@vinacons.vn` | ADMIN | không member (bypass audited) | W1–W6, W8, W9 |
| `quoc.tran@vinacons.vn` | PM | member PRA | W7 create 201 |
| `thang.nguyen@vinacons.vn` | WORKER | **không** ∈ PRA (member PRD) | W7 hidden + 403 PRA, 200 PRD |
| `ba.nguyen@vinacons.vn` | OUTSIDER | không member | W7 403 |

Fixtures resolve qua API thật mỗi run: project `PRA` (ACTIVE), `PRD` (ACTIVE), `PRC` (DRAFT — cho W9),
area `KQ-01`/`TM-02` ∈ PRA, work type `BT-CT` (active), trade `THO-CAT` (active),
WO seed `PRD-B1-001` (ASSIGNED — cho W4 dup-code).

> _Note: Throwaway E2E-only demo credentials (seed/reset per evidence docs). Never production._

## 3. Seed / cleanup

- **Không seed project/area/type mới (trừ temp của run):** dùng fixtures canonical nguyên trạng.
  Driver tạo mỗi run: 3 WO (W2 UI, W3 API replay, W7 PM UI) + 1 temp work type `WT-GACH-OP-<digits>`
  (tạo → deactivate → xóa) + 1 temp area `E2E-G3-<digits>` ∈ PRC (W9, tạo → dùng → xóa SQL trong `finally`).
- **Cleanup id-based (cuối mỗi run, audit giữ nguyên):** `DELETE work_orders WHERE id=<woId>`;
  `DELETE work_types WHERE id=<tempWtId>`; temp area W9 xóa ngay trong `finally` từng run.
  Đã verify sau cả 2 runs quyết định: `WO rest=0`, `tempWT rest=0`, `tempArea rest=0`.
- **Audit:** append-only, giữ nguyên (W3 assert replay không ghi audit mới: `audit 11→12→12` run A, `14→15→15` run B).

## 4. Kịch bản & kết quả (2 runs quyết định, 9/9 PASS ×2)

**Ký hiệu:** 🟢 PASS · 🔴 FAIL · 📸 ảnh trong `docs/evidence/job-srs-001/shots/`
Run A digits=`185220`, run B digits=`345187`. Bảng dưới ghi kết quả run B (quyết định); run A đồng nhất 9/9
(logs console đầy đủ tái tạo được bằng cách chạy lại driver — xem §8; ids mỗi run ghi vào `e2e-vars.json`, ảnh ở `shots/`).

| # | Bước (UI → API → DB verify) | Run B | Run A | Bằng chứng |
| --- | --- | --- | --- | --- |
| W1 | Admin mở PRA detail: nút `Tạo Work Order` + dialog + 3 picker đủ (BT-CT/KQ-01/TM-02/THO-CAT) | 🟢 `worktypes=5 areas=3 trades=7` | 🟢 đồng nhất | `W1-dialog-pickers.png` |
| W2 | Happy create qua UI → summary `Đã tạo Work Order WO-… (id …)` + DB `DRAFT` + `request_key` not-null; footer Đóng (D1) | 🟢 `WO-MTSP056ZJE60`, db `DRAFT\|t` | 🟢 `WO-MTSOWPSNFKET`, db `DRAFT\|t` | `W2-form-filled.png`, `W2-created.png` |
| W3 | Replay cùng requestKey: lần 1 **201**, lần 2 **200 `idempotentReplay=true`** cùng id; WO/audit không tăng | 🟢 `wo 2→3→3; audit 14→15→15` | 🟢 `wo 2→3→3; audit 11→12→12` | HTTP log §5 |
| W4 | Dup code `PRD-B1-001` qua UI → **409** field error `Mã công việc đã tồn tại`, dialog ở lại | 🟢 | 🟢 | `W4-dup-code.png` |
| W5 | Validation client: title+worktype rỗng → 2 field errors; planned range ngược → lỗi `phải sau thời điểm bắt đầu`; không WO mới | 🟢 `WO theo digits=2` | 🟢 đồng nhất | `W5-empty-errors.png`, `W5-range-error.png` |
| W6 | Temp WT tạo → deactivate → **ABSENT** khỏi picker | 🟢 `ABSENT khỏi 5 options` | 🟢 đồng nhất | `W6-picker-absent.png` |
| W7 | PM tạo 201 qua UI; worker **ẩn nút** + `GET WO PRA` 403, `GET PRD-B1-001` 200; outsider 403 | 🟢 `WO-MTSP07QVTM4H` | 🟢 `WO-MTSOWSEO4Z1W` | `W7-pm-created.png`, `W7-worker-hidden.png` |
| W8 | Audit-logs UI `entityType=WORK_ORDER` hiện `JOB_WORK_ORDER_CREATED` + actor; DB `actor_user_id` (D2) | 🟢 `actor=true` | 🟢 đồng nhất | `W8-audit-logs.png` |
| W9 | **G3 gate:** temp area ∈ PRC (DRAFT) → `POST /work-orders` → **400 `WORK_ORDER_PROJECT_NOT_ACTIVE`** + `fieldErrors.projectId`, không WO mới; temp area xóa trong `finally` | 🟢 `WO 4→4` | 🟢 `WO 4→4` | HTTP log §5 |

**Tổng: 9 PASS / 0 FAIL / 9 mục ×2 runs liên tiếp. Cleanup cả 2 runs: `WO rest=0, tempWT rest=0, tempArea rest=0`.**

## 5. HTTP + DB outputs thật (run B quyết định, digits=345187)

```
fixtures PRA=10000000-...0001 KQ-01=589c0681-... BT-CT=e2e4b200-... THO-CAT=11111111-... PRD-B1-001=e2e4b300-...
W2  UI create → code=WO-MTSP056ZJE60 id=5b7c85c4-...; db: WO-MTSP056ZJE60|Thi công sàn B1 khu KQ-01 345187|DRAFT|t
W3  1st=201 2nd=200 replay id=bb0da9d5-...; wo 2→3→3; audit 14→15→15
W7  PM WO-MTSP07QVTM4H; worker PRA hidden+403; worker PRD 200; outsider 403
W9  POST PRC/DRAFT-area → 400 code=WORK_ORDER_PROJECT_NOT_ACTIVE + fieldErrors.projectId; WO 4→4 (không mới)
cleanup: WO rest=0, tempWT rest=0, tempArea rest=0
```

## 6. Acceptance mapping (SRS.md:394 — JOB-SRS-001)

| Tiêu chí SRS / nghiệm thu (issue #41: J1–J5) | Scenario chứng minh |
| --- | --- |
| **J1 scope-first** — non-member không đọc/sửa ngoài phạm vi | W7 (worker ẩn nút + 403 WO PRA; outsider 403; worker member PRD đọc 200), W9 (gate project-status chạy **sau** scope check) |
| **J2 draft-minimal** — thiếu dữ liệu bắt buộc chỉ cho lưu Nháp | W1 (dialog + 3 picker), W2 (tạo DRAFT đủ trường tối thiểu), W5 (title/workType rỗng + planned range ngược → field errors, không WO mới) |
| **J3 replay không tạo mới** — gửi lặp cùng requestKey | W3 (201 → 200 `idempotentReplay`, cùng id; WO/audit không tăng) |
| **J4 code 409** — mã công việc trùng | W4 (dup `PRD-B1-001` → 409 `Mã công việc đã tồn tại`, dialog ở lại) |
| **J5 audit** — tạo WO ghi lịch sử actor/thời điểm | W8 (UI `JOB_WORK_ORDER_CREATED` + actor; DB `actor_user_id`) |
| **Nháp chưa phân công / chưa lên board** | **Assert tĩnh:** probe API ngoài driver — WO mới `status=DRAFT`, response không có assignee, `assignments=0`, đã cleanup `rest=0` (title `…778899`). Slice này chưa có endpoint công bố/lên board (lệnh #44) nên DRAFT không thể lên board — **verify động defer sang #44 G4**. |

## 7. Deviations (so với session cũ bỏ dở + API-fixes slice)

- **D1 — selector nút Đóng ambiguous (fix phía driver):** dialog success-summary có 2 nút tên `Đóng`
  (header × `aria-label="Đóng"` + footer `Button` text `Đóng`) → `getByRole 'Đóng'` strict-mode violation.
  Fix: `footerCloseBtn()` (`.bf-dialog__body button:has-text("Đóng")`) + `closeDialogQuiet()` dọn dialog
  tồn đọng ở đầu mỗi UI-step mở dialog (W4/W5/W6/W7) và sau W2/W6/W7 — chống cascade khi step FAIL.
  Không phải bug sản phẩm.
- **D2 — SQL cột `actor_id` (fix phía driver):** schema `audit_logs` không có `actor_id`; cột đúng là
  `actor_user_id` (đã verify `\d audit_logs`). W8 dùng `actor_user_id`. Không phải bug sản phẩm.
- **Rename (chọn phương án rename):** `e2e-driver-job-001.cjs` → `e2e-driver-job-srs-001.cjs`,
  `e2e-vars-job-001.json` → `e2e-vars.json` — nhất quán `prj-srs-006/009`, `job-srs-002`;
  đã grep toàn repo **không còn refs** tên cũ nên rename là phương án ít rủi ro (không giữ alias).
  Scenario W1–W8 giữ nguyên.
- **G2 race fix (sản phẩm, slice API fixes):** `request_key` race trong tx → outer-catch replay 200
  (không audit mới). Evidence động: W3 replay tuần tự (không tái hiện race 2-tx đồng thời ở E2E);
  race thật chỉ có unit-test (fake tx) — ghi nhận rủi ro, không integration-test DB-live.
- **G3 project-ACTIVE gate (sản phẩm, slice API fixes):** tạo WO chỉ trên project `ACTIVE`, code riêng
  `WORK_ORDER_PROJECT_NOT_ACTIVE` (phân biệt advisory `PROJECT_NOT_ACTIVE` của #42).
  Evidence E2E mới: **W9** (tạo WO trên PRC DRAFT → 400 + `fieldErrors.projectId`, không WO mới;
  dùng PRC DRAFT sẵn có nên không mutate status fixture; temp area dọn trong `finally`).
- **G1 rehydrate (sản phẩm):** `fromPersistence` fix GET mọi WO non-DRAFT 500 — phủ gián tiếp qua W4
  (đọc seed `PRD-B1-001` ASSIGNED cho dup-check) và W7 (worker đọc `PRD-B1-001` → 200).
- Probe tĩnh §6 tạo 1 WO (`…778899`) + xóa ngay (`rest=0`); chỉ để lại 1 audit row append-only hợp lệ.

## 8. Cách tái sinh

> **Vị trí log:** không lưu file log riêng trong repo — log là console output của
> driver, chạy lại lệnh dưới để tái tạo (driver idempotent id-based: tự tạo WO +
> temp WT/area rồi cleanup theo id cuối mỗi run, audit giữ nguyên append-only,
> nên chạy lại an toàn; ids mỗi run ghi vào `e2e-vars.json`, ảnh ở `shots/`).

```bash
# 1. Stack từ working tree (rebuild api sau G1/G2/G3):
docker compose -f infra/docker/compose.yaml up -d --build api web
# 2. Chạy driver (tự tạo WO + temp WT/area, cleanup id-based, audit giữ nguyên):
node docs/evidence/job-srs-001/e2e-driver-job-srs-001.cjs
# → TỔNG: 9/9 PASS (ids ghi vào e2e-vars.json; shots/ W1,W2×2,W4,W5×2,W6,W7×2,W8)
```

## 9. Rủi ro / ghi chú

- Playwright import kiểu `docs/evidence/org-srs-008` (absolute path `playwright-core` trong `@playwright/mcp`), Chrome `/usr/bin/google-chrome --no-sandbox`.
- Writes kèm `X-Correlation-Id` UUID mới mỗi request (partial unique `ux_audit_correlation_action`).
- Run 1 của session này (digits=`061899`, driver mới) đã chạy hết W1–W9 + shots đầy đủ và `cleanup rest=0`,
  nhưng log console step-by-step không lưu được (job output thất lạc) nên **không tính** vào 2 runs quyết định;
  2 runs quyết định là run A (`185220`) và run B (`345187`) có log đầy đủ.
- Suite api full: **133 passed / 1 skipped suites; 1126 passed / 11 skipped tests, EXIT=0**; `lint` + `build` api xanh.
  Suite web full (chạy đơn lẻ): **654/655 pass**; 1 fail `WorkerCrews.spec.tsx` (add happy path —
  slice ORG-03/ORG-05, không liên quan) **pass 8/8 khi chạy isolate** → flake timing đã ghi nhận ở
  `JOB-SRS-002-E2E.md` §8 (lần chạy full-suite đầu còn fail thêm 14 tests timeout 5s do chạy song song
  api+web dưới tải — chạy lại đơn lẻ chỉ còn 1 flake này); `lint` + `build` web xanh.
  Slice này không sửa web source.
