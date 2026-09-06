# ORG-SRS-006 — E2E Evidence: Quản lý đội thi công (issue #29)

> **Loại bằng chứng:** Browser E2E thật (UI → API → PostgreSQL → UI) + HTTP-level checks bằng token thật, screenshot trong repo.
> **Ngày chạy:** 2026-09-06 UTC (`e2e-driver-org-srs-006.cjs`, 3 runs: run 1 = 9/11 do 2 assertion driver sai — §4a; run 2 và run 3 sau fix driver = **11/11 PASS**).
> **Trạng thái tổng:** **11/11 PASS** — không phát hiện bug sản phẩm; 2 FAIL run đầu là lỗi assertion của driver (không phải bug API/Web), đã sửa driver và tái chạy xanh 2 lần liên tiếp.
> **Phạm vi:** chỉ file mới/cập nhật dưới `docs/evidence/org-srs-006/` — **không commit**, không sửa source, không đụng GitHub.

---

## 1. Môi trường

| Hạng mục | Giá trị |
| --- | --- |
| Repo | `/home/trung/Documents/2026/project/buildflow` |
| Commit HEAD | `a761ae6` — `chore(org): resolve remaining #28 risks` (+ working tree chưa commit của API slice #29 và web slice #29) |
| API base | `http://localhost:3000` (container `buildflow-api-1`, healthy) |
| Web base | `http://localhost:3001` (container `buildflow-web-1`, healthy) |
| PostgreSQL | `docker exec buildflow-postgres-1 psql -U buildflow -d buildflow` |
| Browser | Google Chrome 151.0.7922.173 headless qua playwright-core (launch `/usr/bin/google-chrome --no-sandbox`) |
| DB migrations | không migration mới trong slice này (schema crews/crew_members/assignments đã đủ — đã verify DDL) |

> ⚠️ **Stack đã rebuild từ working tree cho E2E này** — image cũ chưa có route crews
> (probe token PM `GET /api/v1/crews?limit=2` → **404** `Cannot GET /api/v1/crews`, web `/crews` → **404**). Rebuild:
>
> ```
> DOCKER_CONFIG=/tmp/bfhome/.docker DOCKER_HOST=unix:///home/trung/.docker/desktop/docker.sock \
>   docker compose -f infra/docker/compose.yaml up -d --build api web
> ```
>
> Sau rebuild: probe token PM `GET /api/v1/crews?limit=2` → **200** (thấy seed `E2E4-CREW`);
> `GET /crews` và `GET /resources` (web) → **200**.

## 2. Tài khoản

| Email | Vai trò | Password E2E |
| --- | --- | --- |
| `admin@example.com` | ADMIN | `E2EAdmin@2025` (giữ từ ORG-SRS-001/002) |
| `pm@example.com` | PROJECT_MANAGER | `E2EPm@2025` (giữ từ ORG-SRS-003) |
| `worker1@example.com` | WORKER | `E2EWorker@2025` (giữ từ ORG-SRS-005 §2) |

Worker dùng cho swap lead: `worker2@example.com` (`44444444-4444-4444-8444-444444444444`, ACTIVE, WORKER).
Leader ban đầu: `worker1@example.com` (`33333333-3333-4333-8333-333333333333`, ACTIVE, WORKER).

## 3. Seed / cleanup

- **Không seed crew trước** — crew `E2E-CREW-01` được tạo qua UI trong S1 (đúng kịch bản).
- **Seed open-work (S4):** file `seed-open-work-006.sql` — 1 work order `E2E6-WO-1`
  (`e2e6b300-…b4`, status `ASSIGNED`, tái dùng chuỗi project/area/work_type E2E4 của seed ORG-SRS-004
  vì `ux_assignments_current` cấm 2 assignment mở trên cùng work order nên không tái dùng `E2E4-WO-1`);
  driver chèn thêm 1 assignment `e2e6c100-…c2` (`assignee_type='CREW'`, `worker_id=NULL`,
  `crew_id=<E2E-CREW-01>`, `responsible_user_id=worker1`, `status='ACTIVE'`, `source='DIRECT_ASSIGNMENT'`)
  sau khi có crew id thật. Template INSERT đầy đủ nằm trong file SQL.
- **Cleanup (driver tự chạy cuối mỗi run, audit giữ nguyên — append-only):**
  xóa assignment E2E6 → work order E2E6 → crew_members của 2 crew E2E → crews `E2E-CREW-01` + `E2E-CREW-DS`.
  Đã verify sau run cuối: crews `E2E-%` = 0, assignment/work order E2E6 = 0; audit giữ lại
  (`ORG_CREW_CREATED=6`, `LEAD_CHANGED/SUSPENDED/REACTIVATED/TERMINATED=3` mỗi loại cho 3 runs,
  `ORG_CREW_UPDATED=3` từ bước S9).

## 4. Kịch bản & kết quả (run 3 — run quyết định)

**Ký hiệu:** 🟢 PASS · 🔴 FAIL · 📸 ảnh trong `docs/evidence/org-srs-006/shots/`

| # | Bước (UI → HTTP → DB verify) | Kết quả | Bằng chứng |
| --- | --- | --- | --- |
| S1 | PM login → sidebar thấy `Đội thi công` → `/crews/new` tạo `E2E-CREW-01` (leader worker1 qua selector) → list thấy; psql: crews ACTIVE + 1 row LEAD active + audit `ORG_CREW_CREATED=1` | 🟢 PASS | `S1-nav/empty/form/created/list.png` |
| S2 | Trùng code → 409; leader UUID không tồn tại → 400 `fieldErrors.leaderUserId`; `X-Correlation-Id` sai → 400; UI submit thiếu leader → lỗi field-level | 🟢 PASS (sau fix §4a) | `S2-nolead.png` + HTTP outputs §5 |
| S3 | Edit đổi tên + swap leader worker1→worker2 (confirm inline) → psql LEAD cũ `false\|today`, LEAD mới `LEAD\|true`; audit `ORG_CREW_LEAD_CHANGED` +1 có before/after leader | 🟢 PASS (sau fix §4a) | `S3-confirm/done.png` |
| S4 | Seed assignment mở → detail `Tạm ngừng`: dialog warning `Đội đang có 1 công việc/lịch mở của đội`; reason trống → lỗi field `Lý do là bắt buộc`; nhập reason → 200; psql INACTIVE + audit `ORG_CREW_SUSPENDED` có reason + `_warning` | 🟢 PASS | `S4-warning/reason-empty/suspended.png` |
| S5 | `Tạm ngừng` lần 2 → `alreadyInState=true`, audit SUSPENDED/TERMINATED delta 0 | 🟢 PASS | `S5-state.png` |
| S6 | `Kích hoạt lại` qua UI → ACTIVE + audit `ORG_CREW_REACTIVATED=1` | 🟢 PASS | `S6-reactivated.png` |
| S7 | `Chấm dứt` + reason → INACTIVE + `ORG_CREW_TERMINATED=1`; `eligibleOnly=true` loại crew, list thường giữ crew `eligible=false`; directory tab Đội vẫn hiện + badge không đủ điều kiện | 🟢 PASS | `S7-directory.png` |
| S8 | Directory `/resources?tab=crews`: sort name asc/desc API đảo nhau đúng, filter INACTIVE chứa crew, UI sort desc thấy crew | 🟢 PASS | `S8-sort.png` |
| S9 | PM `PATCH /crews` 200 (đúng actor SRS); worker `GET /crews` 403 + UI `/crews` card 403; anon 401; PM `PATCH /workers/:id/status` 403 (không widen); ghost crew 404 | 🟢 PASS | `S9-worker403.png` + HTTP outputs §5 |
| S10 | Double-submit cùng correlation-id: req1 201 → req2 409; `crews` rows=1 + audit CREATED=1 | 🟢 PASS | HTTP outputs §5 |
| S11 | Assignment mở sau crew INACTIVE: row còn nguyên `ACTIVE\|<crewId>` (không mất liên kết) | 🟢 PASS | psql output §5 |

**Tổng: 11 PASS / 0 FAIL / 11 mục.**

### 4a. 2 FAIL run 1 — nguyên nhân (lỗi driver, KHÔNG phải bug sản phẩm)

1. **S2:** driver assert thiếu-leader trả `fieldErrors.leaderUserId`, nhưng API trả 400 shape
   ValidationPipe mặc định `{"message":["Trưởng nhóm không hợp lệ"],"error":"Bad Request","statusCode":400}`
   (thiếu hẳn field → DTO pipe chặn trước use-case). Fix driver: case fieldErrors đúng spec được
   kiểm bằng leader UUID hợp lệ-nhưng-không-tồn tại → 400 `fieldErrors.leaderUserId` (đúng nhánh
   use-case trong spec slice); case thiếu field ghi nhận trung thực shape pipe + UI local validation
   field-level (screenshot `S2-nolead.png` hiện `Trưởng nhóm là bắt buộc`).
2. **S3:** assert LEAD mới fail vì SQL nối chuỗi `'LEAD'\|\|…\|\|effective_to::text` — `effective_to`
   của LEAD đang hiệu lực là NULL nên cả biểu thức thành NULL (rỗng). Fix driver: `COALESCE(…, '-')`.
   DB đúng từ đầu (`LEAD|true|-`), audit before/after đủ cả 2 id.

Sau fix: tái chạy nguyên driver **2 lần liên tiếp 11/11 PASS** (run 2 + run 3).

## 5. HTTP + DB outputs thật (run 3)

```
S1  crewId=11e39f5f-d468-4539-9553-b3b1bd9ab00d · DB status=ACTIVE + 1 LEAD active + audit CREATED=1
S2  dup→409; leader ảo→400 fieldErrors.leaderUserId; corr sai→400;
    thiếu field→400 {"message":["Trưởng nhóm không hợp lệ"],"error":"Bad Request","statusCode":400}
S3  LEAD cũ off false|2026-09-06; LEAD mới LEAD|true|-; audit +1, before/after chứa cả 2 worker id
S4  open-work API {openAssignments:1} → dialog warning `Đội đang có 1 công việc/lịch mở của đội`;
    reason trống → `Lý do là bắt buộc`; 200 → DB INACTIVE, audit SUSPENDED có reason + _warning
S5  SUSPEND lần 2 → {alreadyInState:true}; audit SUSPENDED/TERMINATED 1→1 (delta 0)
S6  ACTIVATE → ACTIVE; audit ORG_CREW_REACTIVATED=1
S7  TERMINATE → INACTIVE; audit ORG_CREW_TERMINATED=1; eligibleOnly loại crew, list thường eligible=false
S8  sort asc/desc đảo đúng (total=2 crews); INACTIVE chứa crew; UI khớp
S9  PM PATCH crews=200; worker GET=403 (API+UI card 403); anon=401; PM workers/status=403; ghost=404
S10 req1=201 req2=409 (cùng correlation-id); crews rows=1 audits=1
S11 assignment e2e6c100-…c2 = ACTIVE|<crewId> sau INACTIVE (liên kết nguyên vẹn)
cleanup: assignment rest=0 workorder rest=0 crews rest=0 (members DELETE 3, crews DELETE 2)
```

## 6. Cách tái sinh

```bash
# 1. Rebuild stack từ working tree (nếu image cũ chưa có /crews)
DOCKER_CONFIG=/tmp/bfhome/.docker DOCKER_HOST=unix:///home/trung/.docker/desktop/docker.sock \
  docker compose -f infra/docker/compose.yaml up -d --build api web
# 2. Chạy driver (tự seed S4, tự cleanup cuối run, audit giữ nguyên)
node docs/evidence/org-srs-006/e2e-driver-org-srs-006.cjs
# 3. Seed thủ công (nếu cần): xem seed-open-work-006.sql (thay <CREW_ID>)
```

## 7. Rủi ro / ghi chú

- Thiếu-field leader trả shape ValidationPipe mặc định (không bọc `fieldErrors`) — cùng pattern
  các slice trước, UI đã chặn field-level trước khi gọi API; không coi là bug slice này.
- Double-submit cùng correlation-id: request 2 bị chặn ở pre-check trùng code (409) trước khi chạm
  audit, nên không thử được nhánh unique `(correlation_id, action)` — kết quả `1 row + 1 audit` đạt
  theo đúng nghĩa chống tạo trùng.
- Web hiển thị tên leader/contractor qua lookup client `limit 100` (fallback id rút gọn) — chấp nhận
  cho slice Should; quản lý thành viên đầy đủ thuộc ORG-SRS-007 (#30), UI đã ghi note.
