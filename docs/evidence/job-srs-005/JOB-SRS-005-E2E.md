# JOB-SRS-005 — E2E Evidence: Xem Job Board (issue #45)

> **Loại bằng chứng:** API thật → PostgreSQL thật → Expo UI thật (mobile web export),
> HTTP-level checks bằng token thật, screenshot trong repo.
> **Ngày chạy:** 2026-09-09 UTC (`e2e-driver-job-srs-005.cjs`).
> **Runs quyết định (post-fix HOLD, trên image api/mobile đã rebuild cùng ngày):
> A-refresh (`digits=254859`) + C (`digits=146126`) — 8/8 PASS ×2 liên tiếp.**
> Run B (`digits=478790`, pre-fix, text S0 đã đúng) 8/8 PASS giữ làm lịch sử.
> **Trạng thái tổng:** **8/8 PASS** — không phát hiện bug sản phẩm #45.
> **Artifacts riêng từng run:** `run-A.stdout.log` + `e2e-vars-A.json` (run A-refresh),
> `run-B.stdout.log` + `e2e-vars-B.json` (run B),
> `run-C.stdout.log` + `e2e-vars-C.json` (run C);
> `shots/` giữ ảnh run mới nhất (shots bị overwrite giữa các run, chỉ run cuối còn).
> **Lưu ý tracking (F017):** `run-*.stdout.log` bị rule `*.log` trong root
> `.gitignore` chặn nên là artifact local, không commit (precedent #44 —
> `run-*.log` của `job-srs-004` cũng không được track); proof được track là
> E2E.md + driver + `e2e-vars-*.json` + `shots/`.
> **Phạm vi:** file dưới `docs/evidence/job-srs-005/` — **không commit**, không đụng GitHub.

> **Chuẩn hóa realistic (docs/demo-data.md, ADR-0003):** creds `@vinacons.vn`,
> WO tiếng Việt (`Sửa chữa mặt bằng <KIND> <digits>`). Không dùng `E2E%`/`test%`
> trong dữ liệu hiển thị; uniqueness bằng suffix digits; cleanup theo id
> (`e2e-vars-<label>.json` tương ứng từng run); audit giữ nguyên (append-only).
> Dùng tài khoản canonical nguyên trạng (không reset password, không tạo user).

> **TRUNG THỰC (đọc trước khi cite):**
> 1. Specs in-memory (`src/api/test/job-board-list.e2e.spec.ts` + unit/mapper/PG specs)
>    **KHÔNG phải real-DB proof** — proof real-DB duy nhất là driver này (header tương tự
>    đã ghi trong spec file).
> 2. Claim được **MÔ PHỎNG bằng psql INSERT** (S5) vì claim write thuộc #47 —
>    driver chỉ chứng minh refresh semantics (item biến khỏi response tiếp theo),
>    không phải round-trip claim.

---

## 1. Môi trường

| Hạng mục | Giá trị |
| --- | --- |
| Repo | `/home/trung/Documents/2026/project/buildflow` (working tree, không commit) |
| API base | `http://localhost:3000` (container `buildflow-api-1`, healthy — image `buildflow-api:local` rebuild 2026-09-09 trước runs A-refresh/C: `docker compose build api mobile && up -d`, smoke `GET /api/v1/status` 200 + `GET /job-board` anon 401) |
| Mobile base | `http://localhost:19006` (container `buildflow-mobile-1`, healthy — image `buildflow-mobile:local` rebuild cùng đợt, smoke `/` 200) |
| PostgreSQL | `docker exec buildflow-postgres-1 psql -U buildflow -d buildflow` |
| Browser | Google Chrome headless qua playwright-core |
| DB migrations | không migration mới (cột `job_board_*` + `assignments` + `ux_assignments_current` từ baseline 0001) |

## 2. Tài khoản & fixtures

| Email | Vai trò | Membership | Dùng trong |
| --- | --- | --- | --- |
| `quoc.tran@vinacons.vn` | STAFF (PM) | MANAGER PRA + PRB (write-scope) | S1 tạo/mở demo, S3 scope isolation |
| `ba.nguyen@vinacons.vn` | WORKER | QC member PRA | S2/S4/S5 viewer, S6 Expo login |
| (không outsider login) | — | — | out-of-scope chứng minh bằng WO demo PRB mà worker PRA không thấy (S2/S3); không reset password canonical để lấy outsider |

Fixtures resolve qua API thật mỗi run: project `PRA` (ACTIVE), area `KQ-01` ∈ PRA,
project `PRB` (ACTIVE), area `GA-A03` ∈ PRB,
work type `BT-CT` (active, `required_trade_id` = THO-CAT), trade `THO-CAT` (active).
WO setup đủ readiness: schedule + `requiredTradeId` = THO-CAT khớp BT-CT
(`publish-check.ready = true` assert ở S1 trước khi mở).

> _Note: Throwaway E2E-only demo credentials (seed/reset per evidence docs). Never production._

## 3. Seed / cleanup

- **Không seed project/area/type mới:** dùng fixtures canonical nguyên trạng.
  Driver tạo mỗi run: 5 WO demo (4 PRA + 1 PRB).
- **Cleanup id-based (cuối mỗi run, audit giữ nguyên):**
  `DELETE assignments` → `DELETE work_order_state_history` → `DELETE work_orders`
  theo đúng 5 id demo. Đã verify sau cả 2 runs: `WO rest=0`.
- **Audit:** append-only, giữ nguyên (S4 assert read không ghi audit mới).
- **Dữ liệu nhiễu có sẵn:** 4 WO `Dbg 503` (PRA, board mở) tồn tại từ debug trước —
  worker list `total=5` (4 nhiễu + 1 AVAIL demo); assert theo **set-inclusion theo code demo**,
  không assert total tuyệt đối. Ghi nhận trung thực, không đụng dữ liệu người khác.

## 4. Kịch bản & kết quả (2 runs quyết định, 8/8 PASS ×2)

**Ký hiệu:** 🟢 PASS · 📸 ảnh trong `docs/evidence/job-srs-005/shots/`
Run A-refresh digits=`254859` (log `run-A.stdout.log`, ids `e2e-vars-A.json`),
run C digits=`146126` (`run-C.stdout.log`, `e2e-vars-C.json`),
run B digits=`478790` (lịch sử pre-fix, `run-B.stdout.log`, `e2e-vars-B.json`).
Bảng dưới ghi kết quả run B; run A-refresh và run C đồng nhất 8/8
(ảnh ở `shots/` là của run mới nhất — run cuối).

| # | Bước (API → DB verify) | Run B | Run A | Bằng chứng |
|---|---|---|---|---|
| S0 | Login PM + worker qua API thật + baseline audit/notification | 🟢 | 🟢 | 2 login OK, `audit=4008 notif=0` |
| S1 | PM tạo 5 WO + mở board (AVAIL / ASSIGN-seed / FUTURE / EXPIRED / OUTSCOPE-PRB) | 🟢 | 🟢 | 5× `publish-check.ready=true` + open 200; FUTURE/EXPIRED chỉnh window bằng psql (deterministic); seed assignment `USER/SELF_ACCEPT/PENDING_ACCEPTANCE` đúng CHECK 0001 |
| S2 | Worker list: chỉ AVAIL, 4 demo kia vắng + shape BD6 + pagination | 🟢 | 🟢 | `total=5` (4 nhiễu Dbg + AVAIL); item AVAIL `state=AVAILABLE`, đủ `projectName/workTypeName/areaName/requiredTradeName`, không `createdBy`; psql excerpt 5 rows tồn tại nhưng 4 vắng response; limit=1 → 2 pages cùng total |
| S3 | anon 401 / PM thấy OUTSCOPE / `limit=0` 400 / unknown key ignore | 🟢 | 🟢 | 401; PM `total=6` chứa WO PRB (worker không thấy — scope isolation); 400 `fieldErrors`; `?projectId=<uuid>` → 200 (ignored) |
| S4 | AC7: 3 GET liên tiếp, audit/notification delta = 0 | 🟢 | 🟢 | `audit 4018→4018, notif 0→0` |
| S5 | AC3: seed assignment cho AVAIL → refresh → item biến, total 5→4 | 🟢 | 🟢 | claim mô phỏng ở DB (claim write là #47) |
| S6 | Expo UI login → profile → job board | 🟢 | 🟢 | 📸 `S6-login`, `S6-logged-in`, `S6-profile`, `S6-job-board`; không chữ "Nhận việc" |
| S7 | Cleanup id-based | 🟢 | 🟢 | `WO rest=0`, audit giữ `4019` rows |

## 5. AC mapping (issue #45 — 8 checkbox)

| AC | Kết quả | Proof |
|---|---|---|
| AC1 đúng scope thấy available | ✅ | S2: worker PRA thấy AVAIL demo, `state=AVAILABLE` |
| AC2 loại trừ 4 lớp + out-of-scope | ✅ | S2: ASSIGN (active assignment) / FUTURE (from tương lai) / EXPIRED (until quá khứ) / OUTSCOPE (PRB) đều vắng mặt dù tồn tại trong DB (psql excerpt) |
| AC3 refresh sau claim | ✅ | S5: total 5→4 sau INSERT assignment; mobile test pull-refresh refetch offset 0 |
| AC4 pagination/permission Mobile | ✅ pagination; ⚠️ filter = deviation | S2 pagination 2 pages; mobile test "Tải thêm" + pull-refresh; **filter theo loại/kỹ năng/khu vực thuộc #46** (BD9, đã ghi ENDPOINTS §20 + comment issue) |
| AC5 quyền | ✅ | S3: anon 401; worker không thấy WO PRB; PM thấy (đúng scope của PM); không param scope để tamper; unknown key ignore |
| AC6 validation | ✅ | S3: `limit=0` → 400 `fieldErrors` + message; mobile render + retry |
| AC7 retry/double-submit | ✅ (N/A-trung thực) | S4: read-only slice — 3 GET delta audit/notif = 0; non-application ghi ENDPOINTS §20 (BD8) |
| AC8 UI dùng API thật | ✅ | S6: Expo :19006 login thật → profile → job board, 4 screenshots; ≥2 runs ALL-PASS |

## 6. Lệch plan (ghi nhận trung thực)

1. **5 WO demo thay vì 4** (thêm 1 WO PRB ngoài scope worker) — superset, vì không có
   password demo của outsider canonical (tuan.pham/hau.le không rõ password,
   thang.nguyen LOCKED) và không reset password canonical; out-of-scope chứng minh
   bằng WO PRB mà worker PRA không thấy + PM (member PRB) thấy.
2. **Run A đầu tiên 1/8** (outsider login 401 do đoán password sai) — đã loại bỏ
   outsider login, rerun A sau fix 8/8. Artifact `run-A.stdout.log` đã được
   **refresh bằng rerun post-fix HOLD** (digits=`254859`, dòng S0 hiện
   `PM+worker login OK` — đúng 2 login PM+worker; text stale `3 login OK` của
   driver pre-fix đã loại tận gốc, không sửa tay log). Run C post-fix
   (digits=`146126`) 8/8 củng cố. Không giấu: chi tiết trong báo cáo stage.
3. **Window FUTURE/EXPIRED chỉnh bằng psql** sau khi mở board qua API (deterministic,
   tránh phụ thuộc validation window của #44) — open vẫn 100% API thật.
4. `total=5` thay vì 1 do 4 WO nhiễu `Dbg 503` có sẵn — assert set-inclusion, không
   assert total tuyệt đối; không xoá dữ liệu người khác.

## 7. Rerun trên dữ liệu vận hành seed (commit eac744f) — 2026-09-09 UTC

> Run `R1`: **8/8 PASS**, `rest=0`, trên DB sau cleanup+seed (`eac744f`).
> Artifacts: `run-R1.stdout.log` + `e2e-vars-R1.json` (`.log` gitignored — artifact
> local, xem F017 §đầu file); shots mới tên `-R1` (shots cũ giữ nguyên).
> Không sửa các mục lịch sử §§1–6. Fixtures UUID (:73-79) giữ nguyên.

**Driver đã sửa** (`e2e-driver-job-srs-005.cjs` — diff pattern cũ → mới):

| Vị trí cũ | Trước | Sau |
|---|---|---|
| title S1 (:159) | `` `Sửa chữa mặt bằng ${kind} ${DIG}` `` (kind-code + 6 digits trong title) | `TITLE_BY_KIND` — mỗi kind một nội dung tiếng Việt riêng, không digits: AVAIL `Trát tường khu thương mại tầng 2`, ASSIGN `Cán nền sảnh chính tầng 1`, FUTURE `Sơn lót tường khu thương mại tầng 2`, EXPIRED `Xây tường ngăn khu thương mại tầng 2`, OUTSCOPE `Trát tường căn hộ mẫu block A tầng 3` |
| rest-check S7 | đã id-based (`WHERE id IN (…)`) — giữ nguyên | giữ nguyên |
| shots S6 | tên cố định (đè run trước) | hậu tố `-${LABEL}` → `…-R1.png` |
| uniqueness | suffix digits | WO code hệ thống tự sinh + id (assert S2/S5 theo code/total, S7 theo id) |

S5 (total giảm đúng 1) + S7 (rest=0) + assert semantics giữ nguyên.

**Kết quả run R1** (log `run-R1.stdout.log`, ids/codes `e2e-vars-R1.json`):

| # | Bước | Kết quả |
|---|---|---|
| S0 | Login PM + worker + baseline | 🟢 `PM+worker login OK`, `audit=4097 notif=5` |
| S1 | PM tạo 5 WO + mở board | 🟢 5× `publish-check.ready=true` + open 200; FUTURE/EXPIRED chỉnh window psql; seed assignment `USER/SELF_ACCEPT/PENDING_ACCEPTANCE` |
| S2 | Worker list đúng tập + shape + pagination | 🟢 `total=1` (chỉ AVAIL; 4 demo kia vắng; seed WO board ĐÓNG + ngoài scope nên không nhiễu — khác run cũ `total=5` thời còn rác `Dbg`, assert set-inclusion theo code không đổi) |
| S3 | anon 401 / scope isolation / 400 / unknown key | 🟢 PM `total=2` chứa OUTSCOPE PRB |
| S4 | AC7: 3 GET, delta = 0 | 🟢 `audit 4107→4107, notif 5→5` |
| S5 | Seed assignment AVAIL → refresh → item biến | 🟢 `total 1→0` (giảm đúng 1; claim mô phỏng ở DB — claim write là #47) |
| S6 | Expo UI login → profile → job board | 🟢 không chữ "Nhận việc" |
| S7 | Cleanup id-based | 🟢 `WO rest=0`, audit giữ `4108` rows |

- **rest=0**: `SELECT count(*) FROM work_orders WHERE id IN (5 ids)` → `0`; verify thêm
  0 WO tồn dư mang 8 tiêu đề realistic mới + query `title ~ '[0-9]{6,}'` của
  `docs/demo-data.md` §8 trả 0 dòng.
- **Audit delta**: `audit_logs` `4095` → `4108` (**+13**, nguồn: `docker exec
  buildflow-postgres-1 psql -U buildflow -d buildflow -t -A -c "SELECT count(*) FROM
  audit_logs;"` trước/sau run).
- **Shots mới** (`shots/`, không đè cũ): `S6-login-R1.png`, `S6-logged-in-R1.png`,
  `S6-profile-R1.png`, `S6-job-board-R1.png`.
- **User dùng**: giữ `ba.nguyen@vinacons.vn` (ACTIVE, QC member PRA — đúng viewer PRA
  cho S2/S4/S5/S6; không cần outsider login). Đã kiểm tra user seed mới: `lan.tran`/
  `hung.vo` chỉ member PRT → worker PRT không thấy WO PRA (scope isolation) nên không
  thay thế được viewer PRA; `son.nguyen` là MANAGER PRT. Kết luận: giữ canonical,
  không đoán password.

**Ghi nhận va chạm seed (không phải bug):** S2 `total=1` thay vì `total=5` như run cũ —
do cleanup `eac744f` đã xóa 4 WO rác `Dbg 503` (đúng kỳ vọng seed); assert theo
set-inclusion code demo + S5 delta tuyệt đối −1 nên không cần chỉnh driver. S3 PM
`total=2` (thay vì 6) với cùng lý do. Không quay lại token giả.
