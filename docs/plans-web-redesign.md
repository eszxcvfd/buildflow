# orchestrate run r-mtuxi0ev-kxtez7

- mode: fanout | agent: session-53388f77-905b-46ab-9594-7d3017dea139 | provider: spawn
- concurrency: 6 | durationMs: 1713284 | aborted: false
- startedAt: 2026-09-10T02:49:10.807Z | finishedAt: 2026-09-10T03:17:44.091Z

## Plan redesign projects UI [via planner] [completed] {xkiro/z-ai/glm-5.3-flash}

Cả hai reviewer đều chấm **NEEDS-REVISION** với các finding quan trọng đã xác minh bằng code thật:

- **Plan 1:** sai khi thay metric "Tổng giải ngân"/"Cảnh báo trễ" bằng counter khác (vi phạm luật placeholder của owner); "before" screenshots bị xếp sau khi shell đã đổi.
- **Plan 2:** cơ chế `:has()` viết thiếu (`.bf-main` có `margin-left` riêng, xung đột specificity với `data-collapsed`, mobile padding leak); bỏ sót E2E driver `e2e-driver-prj-001.cjs` phụ thuộc cứng vào `projects-status` combobox + `#projects-search`; state list cần hoist lên ProjectsView.

Tổng hợp **STAGE 3** — kế hoạch cuối:

---

# KẾ HOẠCH TRIỂN KHAI — REDESIGN GIAO DIỆN WEB "DANH MỤC DỰ ÁN" (BuildFlow)

> Repo: `/home/trung/Documents/2026/project/buildflow`, branch `main @ 8ca03f5`. UI-only, **không đổi schema/API**, không commit (Lead quyết). Plan dành cho 1 implementer, không dùng stash/reflog.

## 1. Goal & Acceptance Criteria

**Goal:** `/projects` render đúng silhouette "Data-Dense Operational Workspace" của mẫu (metric strip 4 ô → bảng dày → Right Inspector 320px), shell chung (sidebar/topbar) restyle theo mock zinc/224px/48px — **0 dữ liệu fabricated** (mọi ô truy vết được về field API thật hoặc placeholder `'—'`), **0 vỡ trang khác**.

**AC (đo được):**
| # | Tiêu chí | Proof |
|---|---|---|
| AC1 | Shell: sidebar 224px, topbar 48px + breadcrumb + ⌘K mở palette; giữ role-gating, collapse, mobile drawer | screenshot + AppShell spec |
| AC2 | `/projects`: metric strip 4 ô divide-x, segmented tabs, bảng 9 cột hàng 44–48px, footer pagination | screenshot + DOM test |
| AC3 | Click row → `selectedProjectId` → Inspector render **không reload**; external-link → `/projects/:id` | component test |
| AC4 | Inspector ẩn `<1280px`; nút thu gọn → bảng bung 100%; khi ở view Kanban → selection/xóa Inspector | test |
| AC5 | ⌘K/Ctrl+K mở palette hiện có | AppShell spec |
| AC6 | Mọi field không có API → `'—'`/empty-state trung thực; **0 literal giả** ("48.2", "72%", "24.5 / 32B", "24.5 Tỷ (76%)", "80% tải", "Sunshine Plaza"…) trong `src/web/src` | grep audit + anti-fabrication test |
| AC7 | Mọi trang `(app)` khác (dashboard, work-orders, work-order-templates, workers, crews, trades, work-types, contractors, resources, my-eligibility, profile, admin/*) vẫn render + route smoke pass | smoke + before/after screenshots |
| AC8 | `typecheck`/`lint`/`test`/`build` pass trong `src/web` | lệnh §6 |
| AC9 | Behavior giữ nguyên: session guard, collapse persist (`bf.sidebar.collapsed`), drawer ≤900px, dialog tạo/sửa/trạng thái, kanban view, filter client-side | full jest suite |
| AC10 | `docs/architecture/WEB.md` §6.1 cập nhật (doc stale: vẫn ghi navy/orange/Be Vietnam Pro — WORK-ROUTING §5) | doc diff |

## 2. Current repository facts (file:line đã xác minh)

- **Web stack:** Next.js 14.2.5 + React 18.3.1 + Tailwind **v3.4.19** (`src/web/package.json`), `@ark-ui/react` 5.39.1 chỉ qua wrapper `src/web/src/components/ui/*` (alert, badge, button, card, dialog, empty-state, input, kanban, list, menu, page-header, select, tabs, toast, tooltip).
- **Fonts:** Inter **đã là font chính** qua `next/font/google` — `src/web/src/app/layout.tsx:8-13` (var `--font-inter`, subset latin+vi), Be Vietnam Pro fallback; chain `--bf-font` tại `tokens.css:99`. **Chưa có JetBrains Mono.**
- **Tokens/CSS shell:** `src/web/src/styles/tokens.css` (`--bf-*`, comment :5-6 — "*mọi --bf-* NAME được giữ nguyên, E2E drivers + tests phụ thuộc*"; `--bf-sidebar-w: 248px` :95; `--bf-paper: #eef1f9` :50) + `.bf-*` recipes trong `globals.css` (1452 dòng): `.bf-sidebar` fixed + `width: var(--bf-sidebar-w)` :81-94, **`.bf-main` có `margin-left: var(--bf-sidebar-w)` riêng** :230-236, `.bf-sidebar[data-collapsed] 72px` :204-206, `.bf-main[data-collapsed] margin-left:72px` :238-240, `.bf-topbar` **80px** :243-256, `.bf-content` max-width `--bf-shell-max` :451-456, drawer mobile ≤900px :462-528, `.bf-nav-user*` :1390-1412.
- **Shell:** `src/web/src/components/layout/AppShell.tsx` (545 dòng, client): `NAV_GROUPS` 4 nhóm role-gated :27-66 (`adminOnly`/`resourceViewer` qua `lib/auth/roles.ts`), inline stroke-SVG icons :89-227 (comment :86-88: "*không thêm dependency runtime*"), `COLLAPSED_KEY` :249, topbar + palette Dialog (chưa có ⌘K listener) :410-542, brand + `aria-label="Buildflow — về tổng quan"` :368-372, `pageTitle()` fallback `'Buildflow'` :237-240. `BrandMark.tsx` còn dùng ở `(auth)/layout.tsx` + `app/page.tsx`. Tests: `AppShell.spec.tsx`, `AppShell.crews.spec.tsx` (không assert brand text — đã kiểm chứng).
- **Projects hiện có:** `(app)/projects/page.tsx` (7 dòng, `force-dynamic`) → `ProjectsView.tsx` (54 dòng: PageHeader + ViewToggle table|kanban + `ProjectCreateDialog`, **hiện không fetch data**) → `ProjectsList.tsx` (212 dòng: load/filter/pagination :41-127, render :129-209) + `ProjectsKanban`, `ProjectDetail` (414 dòng), `ProjectCreateDialog/EditDialog/StatusDialog/Members/Areas/Attachments/WorkOrders`. **`ProjectsHeaderActions.tsx` là legacy** (chỉ còn spec tham chiếu — `ProjectsList.spec.tsx:82-85` assert link "Thêm mới" → `/projects/new`).
- **API read (ranh giới quan trọng):** `listProjects` = GET `/api/v1/projects` chỉ nhận `limit/offset` (1–100, không search/status/total) — `src/web/src/lib/api/projects.ts:25-33,54-58`; **`Project` summary = `{id, code, name, status, managerId, createdAt, updatedAt}` (7 field)**. `getProject` GET `/:id` trả **cùng 7 field** (mapper `src/api/src/modules/iam/api/rest/presentation/mapper/project.mapper.ts:4-15`) — `managerName`/`address`/`plannedStartDate/EndDate` chỉ nằm trong `ProjectProfile` của **write** responses (`projects.ts:36-52`), không lấy được read-side. Members read: `listProjectMembers(id)` (`projects.ts:430-448`), Areas read: `listProjectAreas(id)` → `{code,name,isActive}` + `total` (`projects.ts:652-670`); cả hai **ADMIN bypass không cần membership** (`project-area-scope.ts:17`, `prj/projects.controller.ts:188,336-374`).
- **Status enum thật:** `DRAFT|ACTIVE|PAUSED|COMPLETED|CLOSED` (`src/api/src/modules/iam/domain/entity/project.entity.ts:1`). `StatusBadge.toneForStatus` map ACTIVE→'busy'/cam (`StatusBadge.tsx:26-35`) — **sai ngữ cảnh emerald của mock** → cần helper local.
- **Seed demo:** `docs/demo-data.md` §2 — 5 projects PRA/PRB/PRC(DRAFT)/PRD/PRT trùng tên mock; §1 login `hoang.anh@vinacons.vn` (ADMIN). Lưu ý lệch seed: `managerId` PRA/PRB/PRD = hoang.anh nhưng **membership MANAGER** = quoc.tran (§2 vs §4).
- **E2E driver phụ thuộc cứng:** `docs/evidence/prj-srs-001/e2e-driver-prj-001.cjs:547-571` assert text `'Tổng 21 dự án'`, `'Trang 1/2'`, dùng `arkSelectOption(adminPage,'projects-status',…)`, fill `#projects-search` theo id, click `.bf-table a[href^="/projects/"]`. Không driver nào click nút "Thêm mới" của /projects.
- **Không có icon lib, không có budget/progress/log API** — khẳng định bởi grep `package.json` + `lib/api/projects.ts`.

## 3. Mapping thiết kế → code

### 3.1 Quyết định kiến trúc (đã chốt, có lý do)

| Câu hỏi mở | Quyết định |
|---|---|
| **Cơ chế full-bleed 3 vùng (chỉ /projects)** | **`data-fullbleed` do AppShell set trên `.bf-shell`** (Plan 1) — KHÔNG dùng `:has()` (Plan 2) vì reviewer B chứng minh snippet `:has()` vỡ 3 state có sẵn (margin-left coupling, specificity với `data-collapsed`, mobile padding) và không test được trong jsdom; `data-fullbleed` test được bằng jest. CSS bắt buộc (khắc phục finding CRITICAL của reviewer B): `.bf-shell[data-fullbleed='true'] .bf-sidebar:not([data-collapsed='true']) { width:224px }`, **`.bf-shell[data-fullbleed='true'] .bf-main { margin-left:224px }`** (+ `margin-left:72px` khi `[data-collapsed]`), `.bf-shell[data-fullbleed='true'] .bf-main > .bf-content { max-width:none; padding:0; height:calc(100vh-48px); overflow:hidden }` (topbar là in-flow sticky nên `calc(100vh-48px)` đúng — reviewer A xác nhận), và **re-assert padding/drawer trong block `@media (max-width:900px)`**. |
| **Metric strip — 4 ô như mock** | **Giữ nguyên 4 ô của mock** (chốt theo review A): Tổng dự án = `projects.length` (R); Đang thi công = `count(status==='ACTIVE')` emerald (R); **Tổng giải ngân = `'—'`** + sub-label "Chưa có dữ liệu ngân sách"; **Cảnh báo trễ = `'—'`** + sub-label "Chưa có dữ liệu tiến độ", giữ tint `bg-amber-50/40`. Phương án thay metric khác của Plan 1 bị loại vì vi phạm ràng buộc placeholder của owner. |
| **Icon** | Không thêm `lucide-react` (2 plan + review đồng ý). Tạo **một** module `src/web/src/components/ui/icons/Icons.tsx` (~12 glyph stroke-SVG port từ path lucide trong mock), dùng chung shell + projects. |
| **Màu** | Dùng thẳng default Tailwind `zinc/emerald/amber` (config chỉ override `gray` — `tailwind.config.ts:92-103`, reviewer B xác nhận); "blue" của mock → palette `primary` có sẵn (#4669FA). Không đổi config màu; `shadow-2xs` (mock) → `shadow-sm`/`var(--bf-shadow-card)` (Tailwind 3). |
| **Fonts** | Inter giữ nguyên; **thêm `JetBrains_Mono`** qua `next/font/google` (weights 400/500/700 — mock dùng `font-mono font-bold`, subset latin+vietnamese, var `--font-jetbrains-mono`) vào `layout.tsx`; token mới `--bf-font-mono` + recipe `.bf-mono { font-family; font-variant-numeric: tabular-nums }` + `fontFamily.mono` trong `tailwind.config.ts`. Không CDN. |
| **Trạng thái** | Helper feature-local `statusVisual()`: ACTIVE→emerald "Đang chạy", DRAFT→zinc "Bản nháp", PAUSED→amber "Tạm dừng", COMPLETED→blue "Hoàn thành", CLOSED→zinc "Đóng". **Không sửa `StatusBadge`** (consumer khác không bị ảnh hưởng). |
| **NAV_GROUPS** | Giữ nguyên 4 nhóm thật + role-gating (mock có item không tồn tại: "Vật tư & Thiết bị", "Nhà thầu phụ", "Kiểm soát an toàn" — không tạo dead link). Badge đếm "5" bên sidebar: **bỏ** (shell phải fetch projects mỗi route). Brand sidebar → "B / VINACONS ERP / v2.4" chỉ trong AppShell; **không đụng BrandMark.tsx**; đổi luôn `aria-label` :368 + fallback `pageTitle` :239. |
| **⌘K** | Thêm keydown ⌘K/Ctrl+K → `openPalette()`; pill giữ vai trò navigator (đổi placeholder thành "Tìm tên, mã, trang (⌘K)…" — deviation có ghi, review A #4). Search dự án client-side ở FilterBar của trang. |
| **Kanban + CSV** | Giữ ViewToggle (compact) trong filter strip; `ProjectsKanban` vẫn hoạt động (quyết định check scroll trong fixed-height workspace — review B #9). "Xuất CSV": export client-side các row đã lọc (mock :115 có nút này — không phải scope creep). |
| **Tạo dự án CTA** | Button "Thêm dự án" (mock) mở `ProjectCreateDialog` hiện có, gated `useCanManageProjects`; route `/projects/new` giữ nguyên (driver goto). **Xóa `ProjectsHeaderActions.tsx`** (dead code) + cập nhật assert `'Thêm mới'` tại `ProjectsList.spec.tsx:82-85` trong cùng task (review B #3). |
| **State topology** | **Hoist fetch `listProjects` + search/status state lên `ProjectsView`** (hoặc hook `useProjectsWorkspace`) — ProjectsView hiện không fetch gì; ProjectsList chỉ nhận props + giữ pagination local (review B #4). |

### 3.2 Vùng → file

| Vùng mock | Hành động | File |
|---|---|---|
| Sidebar 224px | Modify | `AppShell.tsx` (brand block, nav recipes class không đổi tên), `globals.css` (:81-94, :119-179, :1390-1412), `tokens.css` (`--bf-sidebar-w`→224px) |
| Topbar 48px + breadcrumb + ⌘K | Modify | `AppShell.tsx` (:410-486, thêm keydown), `globals.css` (:243-256, :260-276) |
| Metric strip | **Create** | `features/projects/components/ProjectsMetrics.tsx` (pure, props = counts) |
| Filter strip | **Create** | `features/projects/components/ProjectsFilterBar.tsx` (segmented tabs + Select wrapper giữ testid `projects-status` cho PAUSED/COMPLETED/CLOSED + `SearchField` giữ `id="projects-search"`) |
| Bảng dày 9 cột | Rewrite render layer | `features/projects/components/ProjectsList.tsx` (giữ nguyên logic :41-127; render :129-209 thay mới; **giữ class `.bf-table`, link `a[href^="/projects/"]`, format footer "Tổng {n} dự án"** để driver ít vỡ nhất) |
| Inspector 320px | **Create** | `features/projects/components/ProjectInspector.tsx` + host `ProjectsView.tsx` (`selectedProjectId` + `inspectorOpen`) |
| Icons | **Create** | `components/ui/icons/Icons.tsx` |
| CSV | **Create** | `features/projects/lib/exportCsv.ts` (pure, tested) |
| Full-bleed CSS + density | Modify | `globals.css` — MỘT block comment "Projects workspace (opt-in via data-fullbleed)" |
| Fonts/tokens | Modify | `app/layout.tsx`, `styles/tokens.css`, `tailwind.config.ts` |
| Doc | Modify | `docs/architecture/WEB.md` §6.1 |

## 4. Bảng mapping data (mỗi ô → nguồn thật hoặc placeholder)

Ký hiệu: **R** = field API thật, **P** = placeholder `'—'`, **E** = empty-state trung thực, **C** = derive client-side từ data đã fetch.

| Ô | Nguồn / quyết định |
|---|---|
| Metric "Tổng dự án" | **R/C** — `projects.length` từ `listProjects({limit:100})` (caveat: cap 100 — ghi vào deviations) |
| Metric "Đang thi công" | **R/C** — `count(status==='ACTIVE')`; bỏ suffix "80% tải" (giả) |
| Metric "Tổng giải ngân" | **P** — `'—'` + "Chưa có dữ liệu ngân sách" (không có budget field read-side: `projects.ts:25-52`) |
| Metric "Cảnh báo trễ" | **P** — `'—'` + "Chưa có dữ liệu tiến độ"; `plannedEndDate` không có trong list summary; tint amber giữ |
| Tabs "Tất cả/Thi công/Bản nháp (n)" | **C** — đếm trên list đã load; tab set cùng filter `status` cũ |
| Select "Gói thầu" | **Drop** — không có API; thay bằng Select trạng thái còn lại (giữ testid `projects-status`) |
| Checkbox | **C** — selection đơn (không bulk op); a11y qua checkbox per-row |
| MÃ badge | **R** — `p.code`, `.bf-mono`, blue khi selected |
| TÊN | **R** — `p.name` |
| TÊN subtitle | **R** (deviation) — `"Cập nhật {relative p.updatedAt}"` thay text category giả của mock |
| TRẠNG THÁI dot | **R** — `p.status` qua `statusVisual()` |
| TIẾN ĐỘ | **P** — track rỗng + `'—'` + "Chưa có dữ liệu tiến độ" (không render 72%/45%) |
| NGÂN SÁCH | **P** — `'—'` mono right-align |
| CHỈ HUY TRƯỞNG (bảng) | **P** — `'—'` (không N+1 trong bảng; `managerName` write-only) |
| HẠNG MỤC x/y | **R (bounded)** — fetch song song có giới hạn `listProjectAreas(id)` cho các row hiển thị (≤20, `Promise.all`, fail→`'—'`), render `{activeCount}/{total}` + `title="hạng mục đang hoạt động/tổng"`; deviation: mock nghĩa "hoàn thành/tổng" không có nguồn |
| Chevron | **C** — `<a href="/projects/{id}">`, blue khi selected |
| Footer "Tổng {n} dự án" + pagination | **C** — filtered count; format giữ tương thích driver |
| Inspector header code + external-link | **R** — `getProject(id).code`; link `/projects/:id` |
| Inspector title | **R** — `name` |
| Inspector địa chỉ | **P** — `'—'` (address chỉ có ở write profile) |
| Quick actions | **R (deviation)** — "Chi tiết dự án" → `/projects/:id`, "Công việc" → `/work-orders`; + "Sửa hồ sơ" (`ProjectEditDialog`) và "Đổi trạng thái" (`ProjectStatusDialog`) gated `useCanManageProjects`. Không render nút chết "Lịch thi công"/"Bản vẽ kỹ thuật" |
| Thông tin cốt lõi — Chỉ huy trưởng | **R (lazy)** — `listProjectMembers(id)` → MANAGER active đầu tiên (ghi nhận lệch seed hoang.anh/quoc.tran vào deviations) |
| Ngân sách / Đã thanh toán / Nhân công hôm nay | **P** — `'—'` |
| Tạo lúc / Cập nhật lúc | **R** — `createdAt`/`updatedAt` |
| Nhật ký hiện trường | **E** — section shell + `EmptyState` "Chưa có nhật ký hiện trường" (không có endpoint) |

**Luật chống fabrication (binding, AC6):** grep audit + test assert `/projects` không chứa literal mock "48.2", "24.5 / 32B", "72%", "24.5 Tỷ (76%)", "80% tải".

## 5. Task DAG (thứ tự triển khai)

Mỗi task kết thúc xanh `typecheck && lint && test` trong `src/web`.

- **T0 — Baseline visual (TRƯỚC mọi thay đổi — khắc phục review A #2):** chạy dev :3001 với API + Postgres seeded; chụp full-page screenshots "before" 1440×900 + 1280×800 cho 10 route `(app)` + `/projects` (inspector đóng); lưu `docs/evidence/ui-redesign/before/`. *AC: artifacts tồn tại, tree chưa đổi.*
- **T1 — Tokens & fonts:** `layout.tsx` (+JetBrains Mono), `tokens.css` (`--bf-font-mono`, `--bf-sidebar-w` 224px, `--bf-paper` → `#fafafa`), `tailwind.config.ts` (`fontFamily.mono`), `globals.css` (`.bf-mono`). *AC: green; không thay đổi nhìn thấy ngoài bg tint.*
- **T2 — Icons module:** `components/ui/icons/Icons.tsx` (~12 glyph). *AC: compile, `package.json` không đổi.*
- **T3 — Shell restyle (Tier-1 global, values-only):** topbar 48px + breadcrumb, search-pill 256px + ⌘K hint + keydown listener, sidebar density/active-state/brand ("VINACONS ERP" + aria-label :368 + pageTitle fallback :239), user footer role label. Giữ 100% logic: guard, gating, collapse, drawer, palette, menus. Cập nhật `AppShell.spec.tsx` (thêm test ⌘K + breadcrumb) — behavioral assertions giữ nguyên. *AC: 2 spec shell green.*
- **T4 — Full-bleed opt-in CSS:** block `data-fullbleed` trong `globals.css` theo §3.1 (bao gồm margin-left 224px, guard `:not([data-collapsed])`, re-assert ≤900px) + AppShell set attribute khi pathname `/projects*` + **unit test `data-fullbleed` present iff `/projects*`** (khắc phục review A #6/R6). *AC: trang khác không thấy CSS mới (grep selector chỉ nằm trong block); build green.*
- **T5 — Projects workspace rebuild:** hoist state lên `ProjectsView`; tạo `ProjectsMetrics.tsx`, `ProjectsFilterBar.tsx` (tabs + Select `projects-status` + search `#projects-search`), `statusVisual.ts`, `exportCsv.ts`; rewrite render `ProjectsList.tsx` (9 cột, `.bf-table`, selection callback, footer "Tổng {n} dự án", giữ loading/401/403/empty/retry); xóa `ProjectsHeaderActions.tsx`; giữ `ProjectCreateDialog` + kanban branch (**kiểm tra kanban scroll trong fixed-height**). *AC: theo §3.2/§4.*
- **T6 — Inspector:** `ProjectInspector.tsx` — fetch-on-select `getProject` + lazy song song `listProjectMembers`/`listProjectAreas` có stale-response guard; header/quick-actions/key-value/EmptyState nhật ký; ẩn `<1280px` (media query) + nút thu gọn xóa selection; **khi chuyển view Kanban → clear selection + ẩn Inspector** (khắc phục review A #7). *AC: AC3/AC4.*
- **T7 — Tests:** cập nhật `ProjectsList.spec.tsx` + `tests/features/projects/ProjectsList.test.tsx` (assert `'Thêm mới'` :82-85 → "Thêm dự án"; tabs thay combobox test; selection; placeholders; CSV) + `ProjectInspector.spec.tsx` (mới) + `ProjectsMetrics.spec.tsx` (mới) + `exportCsv.spec.ts` (mới) + AppShell ⌘K; anti-fabrication literal test; **full suite green (50+ spec khác không đụng phải pass).**
- **T8 — Doc:** `docs/architecture/WEB.md` §6.1 — Inter+JetBrains Mono, zinc/emerald/amber, 224/48px, cơ chế `data-fullbleed`, icon convention. Không phát minh rule mới.
- **T9 — Verification sweep:** typecheck/lint/test/build; route smoke 10+ route; screenshots "after" cùng viewport so "before"; checklist chấm điểm §7; fix → chạy lại proof bị ảnh hưởng. **Không đụng `docs/evidence/prj-srs-001/e2e-driver-prj-001.cjs`** (evidence lịch sử) — ghi nhận driver cần re-run/cập nhật như follow-up do Lead quyết.

Phụ thuộc: T0 → T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 (T5/T6 có thể song song sau T4 nếu 2 agent).

## 6. Phạm vi ảnh hưởng trang khác & cách tránh vỡ

| Bề mặt | Ảnh hưởng | Chắn |
|---|---|---|
| Mọi route `(app)` | Tier-1: sidebar 224px, topbar 48px, màu nav, brand text — **geometry-only, không đổi tên class/DOM/ARIA/testid/localStorage/breakpoint** | token-value change; sweep 10 route before/after (thêm `/resources`, `/contractors`, `/work-types`, `/my-eligibility`, `/profile`, `/admin/audit-logs` — review A #5) |
| Layout/scroll | **None ngoài /projects** — mọi rule mới nằm sau `[data-fullbleed='true']` chỉ set khi pathname `/projects*` | unit test attribute; guard `:not([data-collapsed])`; re-assert media ≤900px |
| `(auth)` + landing | None | `BrandMark.tsx` không đụng |
| `/dashboard` (cùng consumer `listProjects`) | None | chữ ký API client không đổi |
| `StatusBadge` consumers | None | không sửa; dùng `statusVisual()` local |
| ProjectsKanban/ProjectDetail/dialogs | Restyle context; kanban giữ qua ViewToggle; Inspector tái dùng `ProjectEditDialog`/`ProjectStatusDialog` (import nội bộ feature — hợp lệ) | kanban-scroll check T5; detail route giữ |
| E2E drivers | Ít vỡ nhất: giữ `#projects-search`, `projects-status`, `.bf-table`, `a[href^="/projects/"]`, format "Tổng {n} dự án" | copy footer/tabs là điểm phải re-run driver — follow-up, không sửa evidence trong task này |
| Tailwind theme | Additive (`fontFamily.mono`); `gray` override nguyên vẹn; zinc/emerald/amber default nguyên vẹn (verify reviewer B) | build-output assertion (grep `.text-emerald-700` trong CSS compiled) |

## 7. Test mapping & cách chấm "giống mẫu"

**Unit/component (jest + RTL):** AppShell (⌘K, breadcrumb, data-fullbleed; giữ gating/collapse/drawer) · ProjectsMetrics (counter chính xác từ fixture 5 projects PRA–PRT) · ProjectsFilterBar (tabs đổi filter + count; select status; search id giữ) · ProjectsList (rows real code/name/status/subtitle updatedAt; `'—'` 4 cột không-data; selected `aria-selected`+checkbox; areas fail→`'—'`; pagination; 401/403/empty giữ) · ProjectInspector (fetch on select, không `router.push`; MANAGER từ members; `'—'`; EmptyState nhật ký; toggle; no-fetch khi không chọn) · exportCsv (header/escaping/filtered-only) · anti-fabrication literals.

**Smoke:** build → dev :3001 (yêu cầu API + Postgres seeded chạy — review B #8): login `hoang.anh@vinacons.vn` → 10 route HTTP 200 + landmark; luồng /projects: chọn row → Inspector, tabs, ⌘K, collapse, thu gọn inspector, drawer 900px, kanban toggle.

**Chấm điểm "giống mẫu" (checklist 9 điểm, mỗi mục pass/fail):** ① sidebar 224px + user footer; ② topbar 48px + breadcrumb + ⌘K pill; ③ metric strip 4 ô divide-x; ④ segmented tabs + counts; ⑤ bảng 9 cột đúng thứ tự/độ rộng + hàng 44–48px + MÃ mono; ⑥ selected row `bg-blue-50/50` + chevron xanh; ⑦ Inspector 320px đủ 4 section; ⑧ mono + tabular-nums trên mã/số (computed style `--bf-font-mono`); ⑨ border zinc 1px + main `#fafafa`. Target ≥8/9; mỗi fail phải là deviation được ghi tên (metric '—', subtitle updatedAt, quick-actions thực, không badge đếm sidebar) hoặc sửa. So sánh trước/sau + mock mở cạnh nhau; owner duyệt cuối. Pixel-diff tùy chọn — checklist là chuẩn vì dữ liệu mock cố tình khác thật.

## 8. Rủi ro & câu hỏi chưa giải quyết

| # | Rủi ro / câu hỏi | Evidence | Xử lý trong plan |
|---|---|---|---|
| R1 | Shell geometry toàn cục vỡ trang khác | `.bf-main` margin coupling `globals.css:230-240`; `.bf-content` max-width :451-456 | Tier tách 2 mức + sweep 10 route trước/sau |
| R2 | Full-bleed CSS xung đột collapsed/mobile | reviewer B chứng minh snippet `:has()` vỡ `:204-206,:238-240,:513-515` | Dùng `data-fullbleed` + guard + re-assert; unit test |
| R3 | 6/9 cột bảng và 4/8 ô inspector là `'—'` → owner thấy "trống" | 7-field summary `projects.ts:25-33` + mapper | Bảng mapping §4 audit từng ô; deviations list trình owner duyệt trước T5 |
| R4 | E2E driver `prj-srs-001` gãy do tabs/copy | `e2e-driver-prj-001.cjs:547-571` | Giữ test hooks rẻ tiền; driver re-run là follow-up Lead quyết (evidence không sửa trong task) |
| R5 | Spec assert "Thêm mới" gãy khi đổi label | `ProjectsList.spec.tsx:82-85`, `ProjectsHeaderActions.tsx:11` | Cập nhật spec + xóa component legacy trong T5 |
| R6 | N+1 areas fetch (≤20 GET) + permission | `listProjectAreas` ADMIN bypass :188,336-374; membership cần cho non-admin | Bounded `Promise.all`, per-row try/catch → `'—'`; chấp nhận ở scale demo |
| R7 | Metric "Tổng dự án" cap 100 | `listProjects` clamp 1-100 (`projects.ts:54-58`) | Footnote trong mapping + deviations |
| R8 | Lệch seed managerId vs membership MANAGER | `docs/demo-data.md` §2 vs §4 | Inspector lấy từ members; ghi deviations |
| R9 | JetBrains Mono thiếu weight 700 (mock `font-mono font-bold`) | mock:10,23,128 | Load 400/500/700; build fail-loud |
| R10 | Spec tail `AppShell.spec.tsx`/`AppShell.crews.spec.tsx`/`ProjectsKanban.tsx` nội bộ chưa đọc hết | flagged bởi cả 2 reviewer | Bước reconcile đầu T3/T5; kanban-scroll check T5 |
| R11 | AppShell spec churn che mất regression thật | 2 spec shell tồn tại | Cập nhật trong cùng task T3, giữ nguyên behavioral assertions |
| **Q1** (chưa giải quyết — Lead quyết) | Deviation "metric Tổng giải ngân/Cảnh báo trễ = `'—'`" và "subtitle = updatedAt" có được owner chấp nhận trước T5 không? | mock:140-152 vs `projects.ts:25-33` | Trình deviations list ký trước khi rebuild bảng |
| **Q2** (chưa giải quyết — Lead quyết) | Có đồng ý re-run/cập nhật `e2e-driver-prj-001.cjs` như follow-up riêng? | R4 | Không nằm trong task này |

## 9. Verification — lệnh chính xác & kết quả mong đợi

```bash
cd /home/trung/Documents/2026/project/buildflow/src/web
npm run typecheck   # exit 0, không lỗi TS
npm run lint        # exit 0
npm run test        # exit 0 — full suite pass (kể cả 50+ spec không đụng)
npm run build       # exit 0
# route smoke (API + Postgres seeded đang chạy):
npm run dev &       # :3001; curl login → /projects, /dashboard, /work-orders, /work-orders/:id,
# /work-order-templates, /workers, /crews, /trades, /work-types, /contractors, /resources,
# /my-eligibility, /profile, /admin/users, /admin/audit-logs → tất cả HTTP 200
# Anti-fabrication audit:
grep -rn "Sunshine Plaza\|72%\|48\.2\|24\.5" src/web/src   # expect: no matches
# Compiled CSS assertion:
grep -o "text-emerald-700" .next/static/css/*.css | head -1  # expect: ≥1 match
```

Screenshots: `docs/evidence/ui-redesign/before/` (T0) vs `after/` (T9), 1440×900 + 1280×800 + 1279px (inspector ẩn) + 900px (drawer), so checklist §7.

---

**Tóm tắt tổng hợp:** kế hoạch lấy khung Plan 1 (tier-1/tier-2 blast radius, DAG 7 bước) + các sửa của review A (metric giữ silhouette mock với `'—'`, T0 baseline trước, sweep route mở rộng) + khung thực thi Plan 2 (state hoisting, areas/members fetch thật cho hạng mục + chỉ huy trưởng trong Inspector) + các vá CRITICAL/MAJOR của review B (CSS `data-fullbleed` đầy đủ margin/collapsed/mobile, E2E driver hooks, CTA label + spec, kanban×inspector). Hai câu hỏi Q1/Q2 cần Lead xác nhận với owner trước khi implement T5.

