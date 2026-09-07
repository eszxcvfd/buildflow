# ORG-SRS-003 — E2E Evidence: Trades API + Web slice (#26)

> **Loại bằng chứng:** Browser E2E thật (UI → API → PostgreSQL → UI), HTTP-level checks bằng token thật, screenshot lưu trong repo.
> **Ngày chạy:** 2026-09-07 (giờ UTC, theo `created_at` trong DB; run cuối UNIQ=R5S2B7; 16/16 PASS)
> **Trạng thái tổng:** 16/16 bước PASS — 0 FAIL
> **Phạm vi:** chỉ sửa file dưới `docs/evidence/org-srs-003/` — **không commit**, không sửa source (chỉ docs/evidence).
>
> **Chuẩn hóa dữ liệu realistic 2026-09-07** (theo [`docs/demo-data.md`](../demo-data.md)):
> trade/worker runtime dùng mã NK/XT/TXW + tên Việt + email `@vinacons.vn`;
> các dòng audit lịch sử vẫn giữ identifier cũ (`E2E-T*`, `e2e.t.*@example.com`, …) là **có chủ ý**
> (bảng `audit_logs` append-only).

---

## 1. Môi trường

| Hạng mục | Giá trị |
| --- | --- |
| Repo | `/home/trung/Documents/2026/project/buildflow` |
| Commit HEAD | `cb1fa86` (main) — code slice #26 và fix #25/B5 đã ở trong tree |
| API base | `http://localhost:3000` (container `buildflow-api-1`, healthy) |
| Web base | `http://localhost:3001` (container `buildflow-web-1`, healthy) |
| PostgreSQL | `localhost:5432` — `docker exec buildflow-postgres-1 psql -U buildflow -d buildflow` |
| Browser | Google Chrome (headless) qua Playwright (`/usr/bin/google-chrome`) |
| DB migrations | 0001 → 0004 (schema gồm `trades`, `resource_trades`, `audit_logs` append-only) |

> ⚠️ **Stack đã rebuild từ working tree cho E2E này.** Trước khi rebuild, image đang chạy KHÔNG có endpoints trades (probe `GET /api/v1/trades` → 404). Đã rebuild:
> ```
> cd infra/docker
> DOCKER_HOST=unix:///home/trung/.docker/desktop/docker.sock DOCKER_CONFIG=/tmp/bfhome/.docker \
>   POSTGRES_USER=buildflow POSTGRES_PASSWORD=buildflow POSTGRES_DB=buildflow POSTGRES_PORT=5432 \
>   DATABASE_URL='postgres://buildflow:buildflow@postgres:5432/buildflow' REDIS_URL='redis://redis:6379' \
>   JWT_SECRET='BZpNdJ0U46zcLucV24bSIFzvtXzV0ZkpoUsWNeog3lSZ' \
>   docker compose up -d --build api web
> ```
> Sau rebuild: `buildflow-api-1`/`buildflow-web-1` healthy, `GET /api/v1/trades` → 200.

Trạng thái stack (lúc test):

```
buildflow-web-1       127.0.0.1:3001->3001/tcp   Up (healthy)
buildflow-api-1       127.0.0.1:3000->3000/tcp   Up (healthy)
buildflow-postgres-1  127.0.0.1:5432->5432/tcp   Up (healthy)
buildflow-redis-1     127.0.0.1:6379->6379/tcp   Up (healthy)
```

## 2. Tài khoản sử dụng

| Email | Vai trò | Ghi chú |
| --- | --- | --- |
| `hoang.anh@vinacons.vn` | ADMIN + STAFF | password `E2EAdmin@2025` (email realistic từ 2026-09-07, password giữ nguyên) |
| `quoc.tran@vinacons.vn` | PROJECT_MANAGER | **password đã reset**: `E2EPm@2025` (xem §2a) |

### 2a. Reset password pm (đã thực hiện — để tái sinh)

`quoc.tran@vinacons.vn` trước đó không có bcrypt hash khả dụng. Reset cùng cách đã dùng cho admin:

```bash
cd src/api
node -e "console.log(require('bcryptjs').hashSync('E2EPm@2025', require('bcryptjs').genSaltSync(10)))"
# → $2b$10$FXLsnlEpmqxtc5FPLI1hte.KMGCnl4nATKkj/fJBigSfNgz.m7nV.
docker exec buildflow-postgres-1 psql -U buildflow -d buildflow -c \
  "UPDATE users SET password_hash='\$2b\$10\$FXLsnlEpmqxtc5FPLI1hte.KMGCnl4nATKkj/fJBigSfNgz.m7nV.', updated_at=now()
   WHERE email='quoc.tran@vinacons.vn' RETURNING email, status;"
```

## 3. Dữ liệu seed liên quan

- 1 trade seed: `11111111-1111-4111-8111-111111111111` (`THO-CAT` — Tho cat gach), ACTIVE — danh mục hạt giống; các danh mục realistic `OP-LAT`/`SON-NUOC`/`DIEN` (chuẩn hóa 2026-09-07) cũng ACTIVE và hiện trong select.

## 4. Kịch bản & kết quả từng bước

**Ký hiệu:** 🟢 PASS · 🔴 FAIL (bug thật) · 📸 ảnh trong `docs/evidence/org-srs-003/shots/`

UNIQ run cuối: `R5S2B7` — trade `NK-R5S2B7` id `cb225985-78ca-471b-8c1c-e2eb97e41231`; worker `luc.tran.r5s2b7@vinacons.vn` id `957d95b1-f74c-4724-ab4d-536e93128ff9` (mã `TXW-R5S2B7`); dup trade `XT-R5S2B7` id `a609b4fc-7405-44ff-afd4-8af616f65f00`.

| # | Bước | Kết quả | Bằng chứng UI | Bằng chứng HTTP/DB |
| --- | --- | --- | --- | --- |
| B1 | Login admin → redirect `/dashboard` | 🟢 PASS | `B1.png` | login 200 |
| B2 | Mở `/trades` → danh sách hiện tại (THO-CAT + OP-LAT/SON-NUOC/DIEN + trade run) | 🟢 PASS | `B2.png` | GET /api/v1/trades 200, bảng render |
| B3 | Tạo trade mới `NK-R5S2B7` (code+name+description) → list thấy | 🟢 PASS | `B3-form.png`, `B3-list.png` | row `is_active=t` (xem §5); audit `ORG_TRADE_CREATED` |
| B4 | Tạo trùng code → 409 hiển thị **theo field code** | 🟢 PASS | `B4.png` | DB count vẫn = 1 (không thêm row) |
| B5 | Tạo thiếu name → validation **field-level** (không tạo row) | 🟢 PASS | `B5.png` | DB count 0 |
| B6 | Edit trade (đổi tên `… cao cấp`) → 200, list/detail cập nhật | 🟢 PASS | `B6-form.png`, `B6-detail.png` | DB name đổi; audit `ORG_TRADE_UPDATED` có before/after |
| B7 | Tạo worker mới gán trade qua **select ACTIVE** → list thấy | 🟢 PASS | `B7-form.png`, `B7-list.png` | `resource_trades` is_active=t skill=3 (xem §5) |
| B8 | Deactivate trade **đang được worker dùng** (qua detail + confirm) → được phép + **warning 'đang được tham chiếu'** | 🟢 PASS | `B8-confirm.png`, `B8-done.png` | DB `is_active=f`; audit `ORG_TRADE_STATUS_CHANGED` có `_warning` trong afterData |
| B9 | Sau deactivate: select WorkerForm edit chỉ giữ trade đó ở option **(hiện tại)** + banner giải thích | 🟢 PASS | `B9.png` | option (hiện tại) + các trade ACTIVE khác; banner 'ngừng hoạt động' |
| B10 | API PATCH worker gán trade INACTIVE → **400** lý do rõ ràng | 🟢 PASS | — | `400 "Trade không tồn tại hoặc đã ngừng hoạt động: cb22…"` |
| B11 | Worker edit giữ nguyên trade inactive (form omit) → 200, assignment giữ nguyên | 🟢 PASS | — | PATCH 200; resource_trades vẫn active |
| B12 | Reactivate trade qua UI → 200, DB is_active=true | 🟢 PASS | `B12-done.png` | audit `ORG_TRADE_STATUS_CHANGED` INACTIVE→ACTIVE |
| B13 | `/audit-logs` lọc thấy ORG_TRADE_CREATED/STATUS_CHANGED entries | 🟢 PASS | `B13-created.png`, `B13-status.png` | DB audit 3 action types cho entity |
| B14 | Quyền: pm đọc 200 + ghi 403, không token → 401; UI pm ẩn nav + list đọc | 🟢 PASS | `B14-ui.png` | pm GET=200 (đọc) POST=403 (ghi); anon = 401 |
| B15 | Double-submit POST cùng correlation-id → **1 row + 1 audit** | 🟢 PASS | — | HTTP r1=201, r2=409; DB rows=1; audit rows=1 (xem §5) |
| B16 | GET `/trades/:id` không tồn tại → 404 | 🟢 PASS | — | `404 "Không tìm thấy ngành nghề"` |

**Tổng: 16 PASS / 16 bước — 0 FAIL.**

## 5. DB verification (output thật từ psql)

> **Snapshot lịch sử:** các output psql dưới đây chụp live tại thời điểm run
> (UNIQ `R5S2B7`); PASS assert đã đánh giá live lúc chạy. Các row run
> `NK-R5S2B7`/`XT-R5S2B7` + worker run là artifact throwaway, đã xóa
> 2026-09-08 ở final sweep (xem `docs/evidence/demo-data/rename-realistic.sql` §11).

### B3: trade vừa tạo (run cuối)

```
SELECT id, code, name, is_active FROM trades
WHERE code='NK-R5S2B7';

                  id                  |   code    |             name             | is_active
--------------------------------------+-----------+------------------------------+-----------
 cb225985-78ca-471b-8c1c-e2eb97e41231 | NK-R5S2B7 | Thợ nhôm kính R5S2B7 cao cấp | t
```

### B6: rename — before/after trong audit `ORG_TRADE_UPDATED`

```
SELECT action, before_data->>'name' AS b_name, after_data->>'name' AS a_name
FROM audit_logs WHERE action='ORG_TRADE_UPDATED' AND entity_id='cb225985-...' ORDER BY created_at DESC LIMIT 1;

       action       |       b_name        |            a_name
-------------------+---------------------+------------------------------
 ORG_TRADE_UPDATED | Thợ nhôm kính R5S2B7 | Thợ nhôm kính R5S2B7 cao cấp
```

### B7: resource_trades gán worker (is_active=true, skill=3)

```
SELECT t.code, u.email, u.full_name, rt.skill_level, rt.is_active, rt.effective_from
FROM resource_trades rt JOIN users u ON u.id=rt.user_id JOIN trades t ON t.id=rt.trade_id
WHERE rt.trade_id='cb225985-...' AND rt.is_active=true;

   code    |            email            |       full_name        | skill_level | is_active
-----------+-----------------------------+------------------------+-------------+-----------
 NK-R5S2B7 | luc.tran.r5s2b7@vinacons.vn | Bùi Văn Lực R5S2B7 Mới |           3 | t
```

### B8: deactivate khi đang được tham chiếu — audit có `_warning` trong afterData

```
SELECT code, is_active FROM trades WHERE id='cb225985-...';   -- is_active = f (lúc B8; ACTIVE trở lại sau B12)

SELECT action, after_data->>'_warning' AS warning FROM audit_logs
WHERE action='ORG_TRADE_STATUS_CHANGED' AND entity_id='cb225985-...' ORDER BY created_at DESC LIMIT 1;

          action          |                                      warning
--------------------------+------------------------------------------------------------------------------------
 ORG_TRADE_STATUS_CHANGED | Danh mục đang được tham chiếu bởi resource/loại công việc/work order đang hiệu lực
```

### B12: reactivate

```
SELECT code, is_active FROM trades WHERE id='cb225985-...';   -- is_active = t

          action          | before | after
--------------------------+--------+-------
 ORG_TRADE_STATUS_CHANGED | INACTIVE | ACTIVE
```

### Audit trail đầy đủ cho entity (B3→B6→B8→B12), + dup (B15) có correlation_id

```
SELECT action, entity_id, before_data->>'status' AS b_status, after_data->>'status' AS a_status,
       after_data->>'name' AS a_name, after_data->>'_warning' AS warning,
       correlation_id IS NOT NULL AS has_corr
FROM audit_logs
WHERE entity_type='TRADE' AND entity_id IN ('cb225985-...','a609b4fc-...')
ORDER BY created_at ASC;

          action          |             entity_id             | b_status | a_status |            a_name             |                     warning                     | has_corr
--------------------------+-----------------------------------+----------+----------+-------------------------------+-------------------------------------------------+----------
 ORG_TRADE_CREATED        | cb225985-78ca-471b-8c1c-e2eb97e41231 |          | ACTIVE   | Thợ nhôm kính R5S2B7          |                                                 | f
 ORG_TRADE_UPDATED        | cb225985-78ca-471b-8c1c-e2eb97e41231 | ACTIVE   | ACTIVE   | Thợ nhôm kính R5S2B7 cao cấp  |                                                 | f
 ORG_TRADE_STATUS_CHANGED | cb225985-78ca-471b-8c1c-e2eb97e41231 | ACTIVE   | INACTIVE | Thợ nhôm kính R5S2B7 cao cấp  | Danh mục đang được tham chiếu bởi resource/loại công việc/work order đang hiệu lực | f
 ORG_TRADE_STATUS_CHANGED | cb225985-78ca-471b-8c1c-e2eb97e41231 | INACTIVE | ACTIVE   | Thợ nhôm kính R5S2B7 cao cấp  |                                                 | f
 ORG_TRADE_CREATED        | a609b4fc-7405-44ff-afd4-8af616f65f00 |          | ACTIVE   | Thợ xây tô R5S2B7             |                                                 | t
```

### B13: audit theo action (toàn bộ ORG_TRADE* trong DB sau run)

```
SELECT action, count(*) AS n FROM audit_logs WHERE action LIKE 'ORG_TRADE%' GROUP BY action ORDER BY action;

          action          | n
--------------------------+----
 ORG_TRADE_CREATED        | 10
 ORG_TRADE_STATUS_CHANGED | 11
 ORG_TRADE_UPDATED        | 5
```

### B15: double-submit cùng correlation-id → 1 row + 1 audit

```
SELECT count(*) FROM trades WHERE code='XT-R5S2B7';           -- 1
SELECT count(*) FROM audit_logs
WHERE correlation_id='b1f00000-0000-4000-8000-654533374477';      -- 1 row ORG_TRADE_CREATED
```

HTTP thật: `r1=201` tạo row; `r2=409 {"message":"Mã ngành nghề đã tồn tại"}` — **không tạo thêm row, không thêm audit**: request 2 bị reject ngay ở dup-code pre-check (`findByCode` trong create-trade use case — xảy ra trước transaction nên audit không được gọi). Ngoài ra audit write có dedup phòng retry: khi event mang correlation_id, INSERT dùng `ON CONFLICT (correlation_id, action) WHERE correlation_id IS NOT NULL DO NOTHING` (pg-audit.repository.ts, IAM-SRS-008) — retry cùng `X-Correlation-Id` sau khi đã ghi audit không tạo audit trùng.

### B14: phân quyền

```
pm GET  /api/v1/trades → 200 (danh mục đọc chung ADMIN + PROJECT_MANAGER — xem `DIRECTORY_READ_ROLES` trong `trades.controller.ts`)
pm POST /api/v1/trades → 403 {"message":"Không có quyền truy cập",...}
anon GET /api/v1/trades → 401
UI: sidebar pm không có mục "Ngành nghề" (nav `adminOnly`); mở /trades render bảng danh sách đọc, không card 403 (B14-ui.png)
```

## 6. Files trong evidence này

```
docs/evidence/org-srs-003/
├── ORG-SRS-003-E2E.md              ← file này
├── e2e-driver-org-srs-003.cjs      (driver tái sinh; chạy: node e2e-driver-org-srs-003.cjs)
├── e2e-vars.json                   (uniq + tradeId/workerId/dupTradeId/dupCode + results)
└── shots/                          (17 ảnh: B1, B2, B3-form/list, B4, B5, B6-form/detail,
                                     B7-form/list, B8-confirm/done, B9, B12-done,
                                     B13-created/status, B14-ui)
```

## 7. Cách tái sinh

```bash
# 1. Stack đã rebuild từ working tree (xem §1) — nếu chưa, chạy lại lệnh rebuild
# 2. Đảm bảo admin + pm password (xem §2)
cd docs/evidence/org-srs-003
node e2e-driver-org-srs-003.cjs    # 16 bước PASS, ghi e2e-vars.json + shots/
```

Yêu cầu runtime: Node ≥ 18, Chrome tại `/usr/bin/google-chrome`, playwright-core tại
`/home/trung/.npm-global/lib/node_modules/@playwright/mcp/node_modules/playwright` (đổi require nếu khác máy).

## 8. Ghi chú / làm sạch

- **Không có FAIL** nào trong run cuối (16/16). 2 FAIL giữa chừng của run realistic đầu (R5IBHN) đều là
  kỳ vọng driver cũ, không phải bug sản phẩm — đã sửa driver cho đúng hành vi hiện tại:
  B9 (select giữ trade INACTIVE ở option `(hiện tại)` + banner, thay vì biến mất hẳn),
  B14 (pm được đọc danh mục trades `200`, ghi vẫn `403` — xem `DIRECTORY_READ_ROLES`).
- **Dọn dẹp id-based**: driver tự xóa dư liệu run trước (theo `tradeId`/`dupTradeId`/`workerId` trong
  `e2e-vars.json`, chỉ khi mã hiện tại vẫn thuộc họ run NK/XT/TM/TXW — không đụng mã canonical),
  fallback xóa hàng run-pattern trong 12h; xóa worker trước rồi mới xóa trades (tránh FK
  `resource_trades_trade_id_fkey`). Re-run đã kiểm chứng sạch (run R5IBHN được dọn hết trước run R5S2B7).
- **Dữ liệu run cuối còn lại trong DB** (làm bằng chứng §5; run sau sẽ dọn): trades `NK-R5S2B7`,
  `XT-R5S2B7` (cả 2 ACTIVE) + worker `luc.tran.r5s2b7@vinacons.vn`. Audit append-only giữ trace mọi run.
- **Ghi chú 2026-09-08:** các row run trên là artifact throwaway — đã xóa hết trong
  final sweep 2026-09-08 (`docs/evidence/demo-data/rename-realistic.sql` §11;
  worker run đã do driver dọn trước đó). §5 là snapshot lịch sử, PASS đã assert live lúc chạy.
- Chỉ có `docs/evidence/org-srs-003/` được sửa; **không commit, không staged**.
