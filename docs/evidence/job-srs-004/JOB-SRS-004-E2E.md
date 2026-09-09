# JOB-SRS-004 — E2E Evidence: Mở và đóng Job Board (issue #44)

> **Loại bằng chứng:** Browser E2E thật (UI → API → PostgreSQL → UI) + HTTP-level checks bằng token thật, screenshot trong repo.
> **Ngày chạy:** 2026-09-09 UTC (`e2e-driver-job-srs-004.cjs`, **10/10 PASS ×2 runs liên tiếp**
> A/B + run D 10/10 sau round fix cuối trên image đã rebuild).
> **Trạng thái tổng:** **10/10 PASS** — không phát hiện bug sản phẩm #44.
> **Artifacts riêng từng run:** `run-A.stdout.log` + `e2e-vars-A.json` (run A),
> `run-B.stdout.log` + `e2e-vars-B.json` (run B),
> `run-D.stdout.log` + `e2e-vars-D.json` (run D — round fix cuối, image rebuild);
> `shots/` giữ ảnh run mới nhất (F031: shots bị overwrite giữa các run, chỉ run cuối còn).
> **Phạm vi:** file dưới `docs/evidence/job-srs-004/` — **không commit**, không đụng GitHub.

> **Chuẩn hóa realistic (docs/demo-data.md, ADR-0003):** creds `@vinacons.vn`,
> WO tiếng Việt (`Thi công dầm sàn tầng 3 khu KQ-01 <digits>`). Không dùng `E2E%`/`test%`
> trong dữ liệu hiển thị; uniqueness bằng suffix digits; cleanup theo id
> (`e2e-vars-<label>.json` tương ứng từng run); audit giữ nguyên (append-only).
> File `e2e-vars.json` cũ đã xóa (superseded bởi `vars-A/B` — F030).
> Dùng tài khoản canonical nguyên trạng (không reset password, không tạo user).

---

## 1. Môi trường

| Hạng mục | Giá trị |
| --- | --- |
| Repo | `/home/trung/Documents/2026/project/buildflow` (working tree, không commit) |
| API base | `http://localhost:3000` (container `buildflow-api-1`, healthy — **đã rebuild sau T6/T7**) |
| Web base | `http://localhost:3001` (container `buildflow-web-1`, healthy — **đã rebuild sau T6/T7**) |
| PostgreSQL | `docker exec buildflow-postgres-1 psql -U buildflow -d buildflow` |
| Browser | Google Chrome headless qua playwright-core (launch `/usr/bin/google-chrome --no-sandbox`) |
| DB migrations | không migration mới (dùng `work_orders` + `work_order_state_history` + `audit_logs` sẵn có) |

## 2. Tài khoản & fixtures

| Email | Vai trò | Membership PRA (seed canonical) | Dùng trong |
| --- | --- | --- | --- |
| `hoang.anh@vinacons.vn` | ADMIN | không member (bypass audited) | S0 tạo WO |
| `quoc.tran@vinacons.vn` | PM | MANAGER PRA (write-scope) | S1–S4, S6, S7 |
| `ba.nguyen@vinacons.vn` | QC | member PRA, **không** write-role | S5 badge không nút + API 403 |
| `thang.nguyen@vinacons.vn` | WORKER | member PRD, **LOCKED** — không login được | không dùng (ghi nhận) |

Fixtures resolve qua API thật mỗi run: project `PRA` (ACTIVE), area `KQ-01` ∈ PRA,
work type `BT-CT` (active, `required_trade_id` = THO-CAT), trade `THO-CAT` (active).
WO setup đủ readiness: schedule + `requiredTradeId` = THO-CAT khớp BT-CT
(`required_fields` = `[]`), `publish-check.ready = true` assert ở S0.

> _Note: Throwaway E2E-only demo credentials (seed/reset per evidence docs). Never production._

## 3. Seed / cleanup

- **Không seed project/area/type mới:** dùng fixtures canonical nguyên trạng.
  Driver tạo mỗi run: 1 WO DRAFT (S0).
- **Cleanup id-based (cuối mỗi run, audit giữ nguyên):**
  `DELETE work_order_state_history WHERE work_order_id=<id>` (FK trước) rồi
  `DELETE work_orders WHERE id=<id>`.
  Đã verify sau cả 2 runs quyết định: `WO rest=0`.
- **Audit:** append-only, giữ nguyên (S2/S4 assert replay không ghi audit mới).

## 4. Kịch bản & kết quả (2 runs quyết định, 10/10 PASS ×2 + run D sau fix cuối)

**Ký hiệu:** 🟢 PASS · 📸 ảnh trong `docs/evidence/job-srs-004/shots/`
Run A digits=`317422` (WO `WO-MTTVUQ0A0AJT`, log `run-A.stdout.log`, ids `e2e-vars-A.json`),
run B digits=`756171` (WO `WO-MTTW447OJVFT`, `run-B.stdout.log`, `e2e-vars-B.json`),
run D digits=`369088` (WO `WO-MTTXO4RKYK9W`, `run-D.stdout.log`, `e2e-vars-D.json` —
chạy sau round fix cuối trên image api/web đã rebuild, 10/10 PASS).
Bảng dưới ghi kết quả run B; run A và run D đồng nhất 10/10
(ảnh ở `shots/` là của run mới nhất — run cuối; F031).

| # | Bước (UI → API → DB verify) | Run B | Run A | Bằng chứng |
|---|---|---|---|---|
| S0 | Setup WO DRAFT đủ readiness (API admin) | 🟢 | 🟢 | `publish-check.ready=true`, version 1 |
| S1 | PM mở qua UI dialog → badge AVAILABLE | 🟢 | 🟢 | `200 OPEN+AVAILABLE`, version 1→2, `audit JOB_BOARD_OPENED=1`, `history=1`, DB `true\|OPEN\|2`; 📸 `S1-dialog-filled`, `S1-opened` (+`S1-loading` best-effort); excerpt audit/history §8 |
| S2 | Double-submit cùng window (API) → alreadyOpen | 🟢 | 🟢 | `200 alreadyOpen`, version giữ 2, audit OPENED vẫn 1 |
| S3 | Đóng qua UI → badge CLOSED | 🟢 | 🟢 | `200 READY+CLOSED` (OPEN→READY), DB `false\|READY\|3`, `audit JOB_BOARD_CLOSED=1`; 📸 `S3-close-confirm`, `S3-closed`; excerpt audit §8 |
| S4 | Double-close (API) → alreadyClosed | 🟢 | 🟢 | `200 alreadyClosed`, audit CLOSED vẫn 1 |
| S5 | QC member: UI badge không nút + API 403 | 🟢 | 🟢 | card Job Board hiện, không nút Mở/Đóng; open+close API → 403; 📸 `S5-no-buttons` |
| S6 | 409 conflict UI: dialog cũ → notice + Tải lại | 🟢 | 🟢 | bump version qua API → submit UI cũ → Alert + nút Tải lại → reload về AVAILABLE; 📸 `S6-conflict` |
| S7 | Validation client: until ≤ from → lỗi đúng input | 🟢 | 🟢 | lỗi "Thời điểm kết thúc phải sau thời điểm bắt đầu" dưới ô Đến, không gọi API; 📸 `S7-validation` |
| S8 | AC3 real-DB: seed assignment ACTIVE → close giữ nguyên row | 🟢 | 🟢 | `200 READY` + badge `ASSIGNED`; `SELECT status\|assigned_at\|ended_at\|responded_at` before == after (excerpt §8) |
| S9 | AC4 real-DB: 2 POST open song song → 1 winner | 🟢 | 🟢 | `200+200` (1 mutate + 1 `alreadyOpen`), DB `OPEN\|true\|2`, `audit OPENED=1` |

## 5. Ánh xạ acceptance criteria issue #44

| AC | Bằng chứng |
|---|---|
| AC1 open valid → thấy trên Job Board | S1: `GET :id` trả `jobBoard.state=AVAILABLE`, DB `job_board_open=true`, `status=OPEN`, `version+1`, 1 row `work_order_state_history` DRAFT→OPEN |
| AC2 draft thiếu data / assigned / cancelled / expired không mở được | S0 real-DB (readiness gate qua `publish-check`) + S8/AC2 real-DB; scoping note (F018/F049): `src/api/test/work-order-job-board.e2e.spec.ts` là integration-in-memory (Map/fakeTx mock) — KHÔNG cite làm real-DB proof; real-DB chỉ ở driver S8/S9 + psql excerpts §8 |
| AC3 close không hủy assignment | S8 real-DB (seed `assignments` ACTIVE → close → `SELECT` row nguyên trạng, excerpt §8) + API e2e (mock assignment → close giữ assignment + audit CLOSED) |
| AC4 concurrent → 1 winner | S9 real-DB (`Promise.all` 2 POST open → 1 mutate + 1 `alreadyOpen`, `version+1` một lần, `audit==1`) + API e2e; claim-side thuộc #47 (deviation đã ghi ENDPOINTS §19) |
| AC5 quyền | S5 (QC 403 + ẩn nút) + API e2e matrix (401/403/404/400) + web unit (canManage=false ẩn nút) |
| AC6 validation & invalid-state | S7 (client) + API e2e (fieldErrors per-field) + web specs (fieldErrors render đúng input) |
| AC7 retry/double-submit | S2 (alreadyOpen, 1 audit) + S4 (alreadyClosed) + API e2e đếm audit/version |
| AC8 E2E UI dùng API thật | driver này (S1–S9) + shots |

## 6. Lệch & ghi nhận khi chạy driver

1. **SCHEDULED là đúng, không phải bug:** lần chạy đầu dùng `from` = ngày mai → API trả
   `state=SCHEDULED` ("Chưa mở cửa sổ") — đúng policy (ưu tiên `EXPIRED`/`SCHEDULED` trước
   `AVAILABLE`). Driver sửa dùng `from` = quá khứ 1h → `AVAILABLE`.
2. **`thang.nguyen` (WORKER canonical) bị LOCKED** → không login được; S5 dùng `ba.nguyen`
   (QC member PRA, không write-role): UI thấy badge không nút + API open/close 403.
   Gate WORKER-member ẩn nút phủ thêm bởi web unit spec (`canManage=false`).
3. **`ba.nguyen` là member PRA** (role QC) — không phải outsider; đọc 200 là đúng scope.
4. **Cleanup phải xóa `work_order_state_history` trước** (FK) rồi mới xóa `work_orders`.
5. **`S1-loading.png` là best-effort** (chụp ngay sau `waitUntil: commit` — có thể bắt hoặc
   hụt trạng thái "Đang tải"); các state loading khác phủ bởi web unit spec
   (nút `Đang xử lý…` + `aria-busy`).
6. **Shots bị overwrite giữa các run (F031):** driver ghi cùng tên file mỗi run nên
   chỉ shots run cuối còn lại; `shots/` hiện tại là của run D.
7. **Run C (flaky env, đã bỏ):** lần chạy trung gian sau rebuild gặp `Page crashed`
   ở S3/S6/S7 (playwright-core dự phòng 1.61-alpha lái Chrome 151) kéo S4 fail
   cascade; chạy lại nhãn D sạch → 10/10. Artifacts run C đã xóa, giữ A/B/D.

## 7. Tái chạy

```bash
cd /home/trung/Documents/2026/project/buildflow
docker compose -f infra/docker/compose.yaml ps   # api, web healthy (đã rebuild sau fix F001/F003/F004/F005)
# Mỗi run: label riêng → vars riêng + tee stdout làm artifact riêng (F012).
node docs/evidence/job-srs-004/e2e-driver-job-srs-004.cjs A 2>&1 | tee docs/evidence/job-srs-004/run-A.stdout.log
node docs/evidence/job-srs-004/e2e-driver-job-srs-004.cjs B 2>&1 | tee docs/evidence/job-srs-004/run-B.stdout.log
# kỳ vọng mỗi run 10/10 PASS, cleanup rest=0
ls docs/evidence/job-srs-004/shots/              # 8 ảnh (run B — run cuối)
```

Prereqs driver (ghi trong header `e2e-driver-job-srs-004.cjs`): `playwright-core`
resolvable từ cwd (`npm i playwright-core` trong repo) hoặc
`PLAYWRIGHT_CORE_PATH=<path>/playwright-core`; Chrome `/usr/bin/google-chrome`
hoặc `CHROME_PATH=<path>`; creds demo qua `E2E_ADMIN_PASS`/`E2E_PM_PASS`/`E2E_OUTSIDER_PASS`.

## 8. DB value asserts (excerpts psql từ stdout run B — F012)

S1 (sau open qua UI) và S3 (sau close qua UI) in excerpt trực tiếp từ DB
(`actor_user_id 22222222-… = quoc.tran@vinacons.vn`, PM thực hiện):

```text
db audit: 22222222-2222-4222-8222-222222222222|JOB_BOARD_OPENED|2026-09-09 09:22:38.101003+00
db audit before→after: {"status": "DRAFT", "version": 1, "jobBoardOpen": false, "jobBoardOpenFrom": null, "jobBoardOpenUntil": null} >>> {"status": "OPEN", "version": 2, "jobBoardOpen": true, "jobBoardOpenFrom": "2026-09-09T08:22:00.000Z", "jobBoardOpenUntil": "2026-10-09T09:22:00.000Z"}
db history: DRAFT→OPEN|22222222-2222-4222-8222-222222222222
db audit: 22222222-2222-4222-8222-222222222222|JOB_BOARD_CLOSED|2026-09-09 09:23:00.598204+00
db audit before→after: {"status": "OPEN", "version": 2, "jobBoardOpen": true, "jobBoardOpenFrom": "2026-09-09T08:22:00.000Z", "jobBoardOpenUntil": "2026-10-09T09:22:00.000Z"} >>> {"status": "READY", "version": 3, "jobBoardOpen": false, "jobBoardOpenFrom": "2026-09-09T08:22:00.000Z", "jobBoardOpenUntil": "2026-10-09T09:22:00.000Z"}
```

S8 (AC3 real-DB) in `assignment before:` / `assignment after:` (4 cột
`status|assigned_at|ended_at|responded_at` — phải giống hệt nhau):

```text
assignment before: ACTIVE|2026-09-09 09:23:25.697724+00|null|null
assignment after:  ACTIVE|2026-09-09 09:23:25.697724+00|null|null
```

S9 (AC4 real-DB) in `statuses`, `db row`, `auditOPENED`:

```text
statuses: 200,200 alreadyOpen: undefined,true
db row: OPEN|true|2 auditOPENED: 1
```
