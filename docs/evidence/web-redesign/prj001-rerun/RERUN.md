# PRJ-001 rerun trên stack redesign (F013/F014) — KẾT QUẢ: 8/11, FAIL có nguyên nhân API

- Driver: copy nguyên bản commit `HEAD:docs/evidence/prj-srs-001/e2e-driver-prj-001.cjs`
  (diff chỉ 3 dòng: `WEB :3001 → :3100` + tên file vars `e2e-vars-prj001-rerun.json` ×2) —
  `prj001-rerun/e2e-driver-prj-001-redesign.cjs`. Driver gốc + `prj-srs-001/` không đụng.
- Cổng: **WEB http://localhost:3100** = `next start` tạm (cwd `src/web`, `.next` BUILD_ID
  11:26 sau source 11:22 → build redesign mới nhất). Compose `:3001` (image 01:34) là build
  cũ, không dùng. API `http://localhost:3000`, postgres `buildflow-postgres-1`.
- Chạy 2 lần toàn phần (R1 `driver-run.log`, R2 `driver-run-R2.log`): **kết quả giống hệt
  8/11**. R3 instrumented ở `/tmp/r3` (không ghi evidence) để định vị điểm treo S10.

## Từng step (R1 = R2 = R3)

| Step | KQ | Ghi nhận |
|---|---|---|
| S1 ADMIN tạo UI | PASS | psql row + audit `PRJ_PROJECT_CREATED` đúng |
| S2 PM tạo + worker fail-closed + anon 401 | PASS | pool 403 → 1 option → 0 POST |
| S3 trùng mã khác case | PASS | 409 field code, giữ form, count=1 |
| S4 validation client+server | PASS | 4 required + end<start; server 400 |
| S5 PM PATCH | **FAIL** | `PATCH → 403 "Không có quyền truy cập dự án này"` (mong 200) |
| S6 PATCH status | PASS | 400 fieldErrors.status, vẫn DRAFT |
| S7 manager INACTIVE | PASS | create+PATCH 400 managerId, restore ACTIVE |
| S8 worker PATCH | **FAIL** | `PATCH → 200`, name đổi thành `'Hack'` (mong 403 + giữ tên) |
| S9 double-submit | PASS | nút disable `aria-busy`, concurrent 201+409 |
| S10 list/search/pagination | **ERROR** | treo ở wait tên `Trung tâm hội nghị Sông Hồng` sau search `VDA1-A` |
| S11 correlation | PASS | audit carry corr, corr xấu 400 |
| cleanup | rest=0 | `VDA1-%` sạch cả 3 run |

## Nguyên nhân (không phải hook UI redesign — KHÔNG sửa driver copy)

- API hiện tại (đã commit, ngoài scope redesign) áp **PRJ-SRS-006 write-scope** (issue #37):
  `src/api/src/modules/prj/application/use-case/update-project.use-case.ts:81-83,96-98` —
  ADMIN bypass hoặc ACTIVE member MANAGER/COORDINATOR, ra đời SAU driver gốc.
- S5: PM tạo `VDA1-PM` với manager=W2 nên PM không có membership → PATCH 403 là **đúng
  luật mới**; kỳ vọng 200 của driver đã stale.
- S8: worker (W1) là MANAGER của `VDA1-A` (auto-insert membership theo P11/M4 khi S1 gán
  manager) → có write-scope → PATCH 200 + rename `Hack` là **đúng luật mới**; kỳ vọng 403 stale.
- S10 là **cascade của S8**: search `VDA1-A` vẫn match theo code, nhưng tên đã bị đổi thành
  `Hack` nên wait text tên cũ treo 30s. Mọi thao tác UI của S10 (search, Trang 1/2↔2/2,
  filter ACTIVE/DRAFT/ALL, row-link `/projects/:id`, worker scoped) đều PASS khi chạy
  isolated (`/tmp/probe-s10.cjs`, `/tmp/dbg-s10.cjs` — scratch, rest=0 sau chạy).
- Ghi nhận hygiene (có sẵn trong driver gốc, không sửa): mọi
  `waitForFunction(fn, { timeout })` đều truyền options ở vị trí `arg` nên thực chạy 30s
  default thay vì 20s/25s như ý định.

## Kết luận F013/F014

- **CHƯA ALL-PASS**: 8/11; 3 điểm rớt đều do kỳ vọng driver cũ (pre-#37) vênh với behavior
  API đã commit (#36/#37), không do hook UI redesign. Re-baseline kỳ vọng S5/S8/S10 thuộc
  lane prj-srs-001 (chạm assertion bảo mật) — ngoài scope redesign, không tự ý sửa để "đậu".
- Shots R1/R2: `prj001-rerun/shots/` (10 file, thiếu `S10-filter`/`S10-worker-scoped` vì S10
  dừng giữa chừng); vars `prj001-rerun/e2e-vars-prj001-rerun.json` (ghi từ R2).

## File trong `prj001-rerun/`

`e2e-driver-prj-001-redesign.cjs` (driver copy), `seed-001.sql` (copy cho cleanup),
`driver-run.log` (R1), `driver-run-R2.log` (R2), `e2e-vars-prj001-rerun.json`, `shots/`,
`RERUN.md` (file này).
