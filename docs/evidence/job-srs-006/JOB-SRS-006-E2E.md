# JOB-SRS-006 E2E — Tìm kiếm và lọc Job Board (issue #46)

> **Phạm vi:** mobile lane + evidence + docker của plan `docs/plans-job-srs-006.md`
> (backend lane T1–T6 đã xong ở stage trước, xem báo cáo stage impl-46-backend).
> Driver: `e2e-driver-job-srs-006.cjs` (fork driver-005). Ba run ALL-PASS:
> `run-S6R1.stdout.log` + `e2e-vars-S6R1.json`, `run-S6R2.stdout.log` + `e2e-vars-S6R2.json`,
> `run-S6R3.stdout.log` + `e2e-vars-S6R3.json` (rerun sau ruling reviewer HOLD — image rebuild từ working tree, audit rows=4176).
> Shots: `shots/S6-*-S6R1.png`, `shots/S6-*-S6R2.png`, `shots/S6-*-S6R3.png` (label mới, không đè history 005).

## 1. Trung thực (đọc trước)

1. **In-memory specs KHÔNG phải real-DB proof.** `src/api/test/job-board-filters.e2e.spec.ts`
   (và `job-board-list.e2e.spec.ts`) chạy trên repository in-memory — proof real-DB
   duy nhất là driver này (API thật → PostgreSQL thật → Expo UI thật).
2. **Claim là mô phỏng.** Claim write thuộc #47 — driver seed `assignments` bằng psql
   (`SELF_ACCEPT`/`PENDING_ACCEPTANCE`, đúng CHECK 0001) rồi chứng minh refresh semantics
   (item biến khỏi response, total giảm). Mọi log/note ghi rõ "claim mô phỏng".
3. **Seed assignment qua psql; provision dữ liệu mô phỏng:**
   - `resource_trades` cho `ba.nguyen` (THO-CAT, `USER`, active): demo DB không có row
     (đã verify count=0) — INSERT by-id + cleanup by-id, không đụng row seeded.
   - WO-F `required_trade_id=NULL` bằng psql sau khi tạo qua API (API từ chối null vì
     mọi work-type ACTIVE đều yêu cầu trade — đã verify `required_trade_id NOT NULL`
     trên 4/4 loại) — để chứng minh `skill=mine` loại WO NULL-trade.
4. **Không có tài khoản ADMIN trong demo DB** (đã verify: `users` không có
   `ADMIN`/`MANAGER`) ⇒ case ADMIN+`skill=mine`→empty KHÔNG chạy được ở driver;
   phủ bởi unit use-case backend. Ghi nhận unknown trung thực, không fake.
5. **Mobile FilterSheet test bằng Expo web** (`http://localhost:19006`, Chrome headless) —
   cùng build image với native (Dockerfile một image), interaction qua accessibilityLabel
   thật. Native device smoke (emulator) chưa chạy — ghi nhận residual.

## 2. Seed matrix (§5, planned dates tính theo run-time now)

| WO | Project | Area | WorkType | Trade | Planned | Vai trò |
|---|---|---|---|---|---|---|
| A | PRA | KQ01 | BT-CT | THO-CAT | now+1d→+2d | khớp mọi filter early |
| B | PRA | KQ02 | SON-NUOC | SON-NUOC | now+1d→+2d | khác area/type/trade |
| C | PRA | KQ01 | DIEN | DIEN | now+10d→+12d | late window |
| D | PRA | KQ01 | BT-CT | THO-CAT | now+10d→+12d | late + skill-match |
| E | PRB | GAA03 | BT-CT | THO-CAT | now+1d→+2d | ngoài scope worker |
| F | PRA | KQ02 | OP-LAT | NULL (psql) | now+1d→+2d | skill=mine loại |

`customFields` bắt buộc theo `required_fields` của work-type được gửi lúc tạo
(SON: `dien_tich`/`so_tang`; DIEN: `so_diem_dien`/`anh_ban_ve`; OP-LAT:
`dien_tich`/`anh_nghiem_thu`; BT-CT: `{}`).

## 3. Kết quả step (khớp cả 2 run S6R1/S6R2)

| Step | Nội dung | Kết quả |
|---|---|---|
| S0 | Login PM quoc.tran + worker ba.nguyen, baseline audit/notif | PASS |
| S1 | Tạo 6 WO qua API + publish-check + open board + F null-trade + provision trade | PASS |
| S2 | F1a date early `{A,B,F}` / late `{C,D}`; F1b project `{A,B,C,D,F}`; F1c area đơn `{A,C,D}` / lặp `{A,B,C,D,F}`; F1d type đơn `{A,D}` / lặp `{A,B,D}`; F1e skill `{A,D}`; baseline total=5 (E vắng) | PASS |
| S3 | F2 combine = `{A}`; F3 clear = baseline; F4 naive/`from>to`/skill lạ/projectId sai → 4×400 keyed; F5 `projectId=PRB` → 403 + anon 401 + PM thấy E; F6 options (PRA có/PRB vắng, KQ01+KQ02, THO-CAT, đủ name) | PASS |
| S4 | F7 claim-sim A → combo filter total 1→0, A biến | PASS |
| S5 | F8 pagination `projectId=PRA` total=4 ổn định 2 pages, gộp đủ 4, unknown-key ignore | PASS |
| S6 | AC7: 4 GET có filter → audit delta=0, notif delta=0 | PASS |
| S7 | Expo UI: sheet mở → skill apply → chip → detail D → back giữ filter → date 2031 → empty-filtered → clear all → baseline; không chữ "Nhận việc" mọi shot | PASS (7 shots/run) |
| S8 | Cleanup by-id: WO rest=0, trade rest=0, assignments rest=0, seeded 3/3 nguyên vẹn | PASS |

**TỔNG: 9/9 PASS × 3 run (S6R1 audit 4146, S6R2 audit 4161, S6R3 audit 4176).**

## 4. AC map (bằng chứng)

- AC1: S2 (từng filter) + S3-F2 (kết hợp) + S3-F3/S7-clear (clear) + S7 chips UI.
- AC2: S3-F4 (400s) + F5-403 + S2-F1e (skill không-trade: F vắng; worker đã provision vẫn đúng tập).
- AC3: S4 (refresh giữ filter, claimed biến) + S7-back (giữ filter khi back) + unit mobile `stale-response-ignored`.
- AC4: S5 (pagination/total/envelope) + F6 options cùng scope.
- AC5: S3-F5 (401/403/scope isolation) + S2-E vắng.
  - **Unit-only (F024a):** case membership rỗng → `200 empty` (list lẫn
    filter-options) KHÔNG chạy ở driver này — demo DB không có user
    không-membership có password khả dụng; phủ bởi in-memory
    `src/api/test/job-board-filters.e2e.spec.ts` F5
    (`outsider → 200 empty (list + filter-options)`), không fake ở driver.
- AC6: S3-F4 (400 keyed + message TV) + S7 sheet validation + unit `field-error-render`.
- AC7: S6 (delta 0) + unit `no-overlapping-requests` + busy-guard trong sheet.
- AC8: driver này (API+DB+UI thật) + shots.

## 5. Residual / chưa phủ

- ADMIN+`skill=mine`→empty: không ADMIN creds (mục 1.4) — phủ bởi unit backend.
  **Gap acknowledged (F024c):** driver không chứng minh được nhánh này end-to-end;
  không suy luận "đã đúng" ngoài phạm vi unit.
- Native emulator smoke: chưa chạy (web-Expo interaction đã PASS).
- Full-text search: từ chối có biên (BD17) — out of scope.
- **Date predicate (F025):** `searchJobBoard` dùng overlap instant
  (`planned_start_at <= to AND COALESCE(planned_end_at, planned_start_at) >= from`,
  so instant UTC) — KHÔNG có `::date` cast trong working tree (đã verify bằng
  grep); ghi chú `::date` ở review cũ là stale (thuộc commit đã merge trước đó,
  không áp dụng cho slice này).
- **Run logs (F024d):** `run-*.stdout.log` bị `.gitignore` (`*.log`) — ngoại lệ
  có chủ đích: log là evidence của slice này, force-add (`git add -f`) để đính
  kèm; registry plan ở `PLANS.md` mục Current plans (entry `#46`).
