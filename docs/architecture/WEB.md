# Web Architecture — React + Next.js + Ark UI

> **Status:** target design cho `src/web`; hiện chưa có source code hoặc package manifest.
> **Owner:** web workspace, route tree, web UI và browser-side behavior.

## 1. Mục tiêu

Web dùng React + Next.js App Router + TypeScript. Cấu trúc feature-based giữ business capability cùng nhau; `app/` chỉ làm route composition. Ark UI cung cấp headless, accessible primitives; repo sở hữu wrapper, design tokens và presentation.

Tham khảo cấu trúc feature-based từ [rufatalv/next-feature-based](https://github.com/rufatalv/next-feature-based), nhưng thay lớp UI/Tailwind của template bằng Ark UI và quy tắc server/client của [Next.js documentation](https://nextjs.org/docs).

## 2. Cây thư mục target

```text
src/web/
├── public/                               # static assets, giữ ngoài src/app
├── src/
│   ├── app/                              # Next App Router: route composition
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── (public)/                     # URL không gồm "public"
│   │   ├── (auth)/                       # auth layouts/routes
│   │   ├── (app)/                        # authenticated app routes
│   │   ├── (admin)/                      # admin routes nếu có
│   │   └── api/                          # chỉ BFF/webhook thật sự
│   ├── components/
│   │   ├── ui/                           # Ark UI wrappers + tokens
│   │   │   └── <primitive>/
│   │   └── layout/                       # header, shell, navigation
│   ├── features/
│   │   └── <feature>/
│   │       ├── components/
│   │       ├── hooks/                    # client hooks only
│   │       ├── server/                   # server-only loaders/actions
│   │       ├── services/                 # feature-facing orchestration
│   │       ├── schemas/                  # input validation
│   │       ├── types/
│   │       ├── index.ts                  # public feature interface
│   │       └── __tests__/
│   ├── lib/
│   │   ├── api/                          # server/browser HTTP adapters
│   │   ├── auth/                         # auth client/server seam
│   │   ├── env/                          # typed environment access
│   │   └── utils/
│   ├── providers/                        # client providers, kept deep
│   └── styles/                           # tokens, themes, global recipes
└── tests/
    ├── components/
    ├── features/
    └── e2e/
```

`src/web/src` là application source của workspace; nó không phải `src/` chung của repo. Config (`package.json`, `next.config.*`, `tsconfig.json`, env) ở root `src/web`, còn `public/` vẫn ở root workspace.

## 3. Routing rules

1. Mỗi URL public phải có `page.tsx`, `route.ts`, hoặc file convention hợp lệ; folder chỉ để tổ chức chưa phải route.
2. Route group `(group)` giúp tổ chức/layout mà không thêm segment vào URL.
3. Private folder `_folder` là nơi an toàn cho implementation colocated không được Next router xem là route.
4. `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx` chỉ điều phối lifecycle/rendering của route; business policy ở feature.
5. `page.tsx` nhận params/search params, gọi loader của feature và composition UI; không gọi database/SDK ngoài trực tiếp.
6. `src/app/api` không được lặp lại NestJS. Chỉ thêm route khi có lý do BFF, webhook, cookie/session bridge hoặc browser-only integration và ghi owner trong ADR.
7. Không tạo hai route khác nhau cho cùng một intent chỉ vì khác team; route map cần được cập nhật trong PR.

Ví dụ route target:

```text
src/app/
├── (public)/page.tsx                 → /
├── (auth)/sign-in/page.tsx           → /sign-in
├── (auth)/forgot-password/page.tsx   → /forgot-password
├── (auth)/reset-password/page.tsx    → /reset-password?token=...
├── (app)/dashboard/page.tsx          → /dashboard
├── (app)/admin/users/page.tsx        → /admin/users (quản trị tài khoản)
├── (app)/admin/audit-logs/page.tsx   → /admin/audit-logs (IAM-SRS-008: nhật ký thao tác, admin-only)
├── (app)/profile/page.tsx            → /profile (gồm form đổi mật khẩu)
├── (app)/contractors/page.tsx        → /contractors (ORG-SRS-002: danh sách nhà thầu)
├── (app)/contractors/[id]/page.tsx   → /contractors/:id (chi tiết + trạng thái)
├── (app)/workers/page.tsx            → /workers (ORG-SRS-001: danh sách công nhân)
├── (app)/crews/page.tsx              → /crews (ORG-SRS-006, issue #29: danh sách đội thi công cho ADMIN + PROJECT_MANAGER)
├── (app)/crews/new/page.tsx          → /crews/new (tạo đội thi công)
├── (app)/crews/[id]/page.tsx         → /crews/:id (chi tiết + trạng thái + thành viên summary)
├── (app)/crews/[id]/edit/page.tsx    → /crews/:id/edit (sửa tên/mô tả/nhà thầu/trưởng nhóm)
├── (app)/resources/page.tsx          → /resources (ORG-SRS-005, issue #28: tra cứu nguồn lực read-only cho ADMIN + PROJECT_MANAGER)
├── (app)/trades/page.tsx             → /trades (ORG-SRS-003: danh sách ngành nghề, admin-only)
├── (app)/trades/new/page.tsx         → /trades/new (tạo ngành nghề)
├── (app)/trades/[id]/page.tsx        → /trades/:id (chi tiết + deactivate/activate + warning)
├── (app)/trades/[id]/edit/page.tsx   → /trades/:id/edit (sửa mã/tên/mô tả)
├── (app)/work-types/page.tsx         → /work-types (PRJ-SRS-004, issue #35: danh sách loại công việc cho ADMIN + PROJECT_MANAGER)
├── (app)/work-types/[id]/page.tsx    → /work-types/:id (chi tiết loại công việc)
└── (app)/items/[itemId]/page.tsx     → /items/:itemId
```

Màn hình đổi/đặt lại mật khẩu (IAM-SRS-007): form đổi mật khẩu nằm trong `(app)/profile`; quên mật khẩu và đặt lại bằng token là hai route `(auth)` ở trên. Các màn hình này chỉ gọi ba endpoint password trong [`API.md`](API.md); vì session cũ bị cắt sau khi đổi/đặt lại thành công, luồng phải đưa người dùng về `/sign-in` để đăng nhập lại.

Route `/trades/*` (ORG-SRS-003): danh mục ngành nghề/kỹ năng, admin-only, nav nhóm "Nguồn lực". Client gọi contract trong [`ENDPOINTS.md`](ENDPOINTS.md) §4 qua `lib/api/trades.ts`. Trạng thái (deactivate/activate) KHÔNG nằm trong form sửa — là action riêng `PATCH /trades/:id/status` có confirm dialog; khi deactivate danh mục đang được tham chiếu, API vẫn cho phép và trả `warning` (`'Danh mục đang được tham chiếu bởi resource/loại công việc/work order đang hiệu lực'`) — UI hiển thị cảnh báo rõ. `WorkerForm` chọn ngành nghề từ select tải `listTrades({status:'ACTIVE'})` (label `code — name`); không chọn được trade INACTIVE cho assignment mới, nếu worker đang giữ trade INACTIVE thì giữ nguyên và chỉ gửi thay đổi khi admin thật sự sửa; `WorkerList`/`WorkerDetail` hiển thị tên trade thay UUID thô qua map id → `code — name`.

Route `/workers/*` và `/contractors/*` (ORG-SRS-001/002): danh sách + chi tiết + form tạo/sửa. **Lifecycle status (ORG-SRS-004, issue #27)**: trạng thái hoạt động chỉ đổi qua `PATCH /api/v1/workers|contractors/:id/status` với body `{ action: 'ACTIVATE'|'SUSPEND'|'TERMINATE', reason? }` (contract chi tiết trong [`ENDPOINTS.md`](ENDPOINTS.md) §5) — UI không tự suy diễn trạng thái khi API từ chối. `WorkerList`/`WorkerDetail`/`ContractorDetail` dùng chung dialog confirm `features/resources/ResourceStatusDialog`: (a) khi rời khỏi ACTIVE gọi trước `GET .../open-work`, nếu `openAssignments > 0` hiển thị cảnh báo ảnh hưởng ('đang có N công việc/lịch mở — lịch sử giữ nguyên'); (b) textarea Reason bắt buộc (1–500, validate theo field trước submit, message 400 từ API map về field `reason`); (c) submit → refresh list/detail ngay; `alreadyInState: true` (request lặp) → thông tin 'đã ở trạng thái này', không báo lỗi; response `warning` khi rời ACTIVE → success note kèm số việc mở. Worker `LOCKED` (bị khóa bảo mật) không có action lifecycle ở màn này — xử lý ở quản trị tài khoản (`/admin/users`, `PATCH /admin/users/:id/status`). Nút dòng: ACTIVE → 'Tạm ngừng'/'Chấm dứt'; INACTIVE → 'Kích hoạt lại'. `WorkerDetail`/`ContractorDetail` thêm section **'Lịch sử trạng thái'** (`features/resources/StatusTimeline`): gọi `GET /api/v1/audit-logs?entityType=WORKER|CONTRACTOR&entityId=:id&result=SUCCESS&limit=10` (admin-only, API lọc theo entityId; DESC), render thời điểm/action/lý do/actor, tối đa 10 dòng + link 'Xem tất cả' sang `/admin/audit-logs` (deep-link entityType/entityId/result=SUCCESS đã được AuditLogList đọc qua `useSearchParams`; KHÔNG kèm param action vì API audit lọc exact-match). `ContractorForm` (edit) **KHÔNG còn đổi status inline** (bỏ luồng xung đột cũ): select status chỉ hiển thị ngữ cảnh, đổi giá trị chỉ báo ghi chú hướng dẫn dùng màn chi tiết; PATCH hồ sơ không bao giờ mang `status` (create vẫn gửi status mặc định ACTIVE).

Route `/crews/*` (ORG-SRS-006, issue #29): quản lý đội thi công cho ADMIN + PROJECT_MANAGER (read + write — khác write admin-only của workers/contractors/trades, theo bounded decision ENDPOINTS §7). Nav nhóm "Nguồn lực" thêm mục 'Đội thi công' (`/crews`) với flag `resourceViewer` trong `AppShell` (cùng nguồn role duy nhất `lib/auth/roles.ts`); WORKER-role không thấy. Client gọi contract ENDPOINTS §8 qua `lib/api/crews.ts` (fieldErrors passthrough + classify 409 dup-code→`code` / lead-race→`leaderUserId` / 400→field tương ứng). `CrewList` (search + status + eligibleOnly + sort `name|createdAt` + order + pagination 20, reads `no-store`): rows tên + mã + `StatusBadge` + eligible ('Đủ điều kiện phân công' / 'Không nhận việc mới') + link chi tiết; loading/empty/401/403/retry. `CrewForm` create/edit — code chỉ nhập khi tạo (edit không đổi code, PATCH không mang `code`); **leader selector** tải `listWorkers({status:'ACTIVE', limit:100})` + lọc text client (tên/mã NV/email, label 'tên · mã NV'), validate bắt buộc theo field; edit giữ leader hiện tại làm default (leader đã INACTIVE → cảnh báo giữ nguyên, đổi mới cần xác nhận inline — lead swap ghi audit riêng `ORG_CREW_LEAD_CHANGED`); contractor select optional từ `listContractors({status:'ACTIVE'})` (label `code — name`); 409 trùng code hiển thị lỗi theo field. `CrewDetail` — profile + `StatusBadge` + eligible + section **'Thành viên'** chỉ tóm tắt LEAD hiện tại (tra tên qua workers ACTIVE, fallback id rút gọn) + note 'Quản lý thành viên đầy đủ — ORG-SRS-007 (issue #30)' + status action qua `ResourceStatusDialog` (`entityType: 'CREW'` — text 'công việc/lịch mở của đội', pre-check `GET .../open-work`, reason bắt buộc, `alreadyInState` → thông tin, `warning` → success kèm số việc mở) + `StatusTimeline` (`entityType: 'CREW'`, labels `ORG_CREW_CREATED/UPDATED/LEAD_CHANGED/SUSPENDED/TERMINATED/REACTIVATED`; audit-logs API giữ admin-only nên PM thấy ghi chú quyền). `ResourceStatusDialog` thêm prop optional `entityType?: 'WORKER'|'CONTRACTOR'|'CREW'` (mặc định giữ text cũ — caller workers/contractors không đổi behavior). KHÔNG thêm crew filter cho tab workers (defer #30).

Route `/resources` (ORG-SRS-005, issue #28): trang tra cứu nguồn lực read-only cho ADMIN + PROJECT_MANAGER (điều phối viên/quản lý chọn worker/contractor phục vụ phân công). Nav nhóm "Nguồn lực" thêm mục 'Tra cứu nguồn lực' với flag `resourceViewer` trong `AppShell` (hiện khi role là `ADMIN` hoặc `PROJECT_MANAGER` — đúng `roles.code` trong DB, không alias `project_role` — nguồn role duy nhất là `getAuth().roles[].code` từ session localStorage, helpers + hooks `useIsAdmin`/`useCanViewResourceDirectory` ở `lib/auth/roles.ts`, `AppShell` import lại helpers này làm nguồn duy nhất); các mục `/workers`, `/trades`, `/admin/*` giữ `adminOnly`. Component `features/resource-directory/ResourceDirectory` (client): tabs Workers | Contractors | Đội (ORG-SRS-006, issue #29: tab Đội đã bật — `listCrews` cùng pattern filter/sort/pagination, `?tab=crews` đồng bộ URL; KHÔNG thêm crew filter cho tab workers — defer #30); filter đồng bộ URL query (`?tab=&status=&trade=&skill=&q=&sort=&order=&page=`) nên giữ nguyên khi quay lại — status select (workers: ACTIVE/INACTIVE/LOCKED; contractors: ACTIVE/INACTIVE), trade select từ `listTrades({status:'ACTIVE'})` (tab Workers), skill 1–5 (tab Workers), search text, sort select (Tên → `name`, Mới nhất → `createdAt`) + order (asc/desc), limit 20/page + pagination theo `total` API; đổi tab/filter reset về trang 1. Rows read-only: workers — tên + mã NV + `StatusBadge` + eligible badge + trades (`code — name` qua map từ `listTrades({status:'ALL'})`, fallback UUID rút gọn) + link `/workers/:id`; contractors — tên + code + liên hệ/SĐT + status + eligible + scope rút gọn (120 ký tự) + link `/contractors/:id`; crews — tên + code + `StatusBadge` + eligible + trưởng nhóm (id rút gọn) + link `/crews/:id`; không action buttons. API 400 shape mới `{message, fieldErrors}` được `parseError` trong `lib/api/workers.ts`/`contractors.ts` giữ nguyên `fieldErrors` (helper `toFieldErrors`, tương thích message-only cũ) và directory map key server (`status`/`tradeId`/`skillLevel`/`sort`/`order`) về control tương ứng hiển thị dưới field (`role="alert"`), giữ giá trị filter; 401 → link đăng nhập; 403 → permission card (ADMIN hoặc PROJECT_MANAGER) + retry; 409 → info + tải lại (reads `cache: 'no-store'` nên dữ liệu luôn hiện hành — caption 'Dữ liệu hiện hành (không cache)'); empty state kèm gợi ý đổi filter + nút 'Xóa bộ lọc'. `WorkerDetail`/`ContractorDetail` giờ PM đọc được: lifecycle buttons + link 'Sửa hồ sơ' + section 'Lịch sử trạng thái' (audit-logs admin-only) chỉ render khi `useIsAdmin()`, non-admin thấy ghi chú 'cần quyền ADMIN — chỉ xem'.

## 4. Server/Client boundary

- Mặc định `layout.tsx` và `page.tsx` là Server Components.
- Dùng Client Component khi cần state/event handler, lifecycle effect, browser API hoặc custom hook.
- Directive `"use client"` nên đặt ở leaf interactive component, không đặt ở toàn bộ route hoặc layout nếu không cần.
- Ark UI interactive primitives thường nằm sau Client Component wrapper; wrapper này là seam để cấu hình styling, event contract và accessibility của repo.
- Props từ Server Component sang Client Component phải serializable; không đưa secret, server-only module hoặc database object xuống client.
- Providers của client được đặt sâu nhất có thể trong cây để giữ phần tĩnh của layout ở server.
- API server adapter dùng secret/private env; browser adapter chỉ dùng public-safe config.

Luồng ưu tiên:

```text
Server page/layout
  → feature server loader
  → API HTTP adapter
  → serializable view model
  → Ark UI wrapper / Client Component cho interaction
```

## 5. Feature interface

Mỗi feature là một deep module có public entry point:

```text
features/<feature>/index.ts
  ├── export các view/model/use case mà route được phép dùng
  └── không export implementation detail của feature khác
```

- Component feature được đặt gần behavior/data của feature, không đẩy mọi thứ vào `components/`.
- `components/ui` chỉ là primitive/design system; không chứa business rule của feature.
- `services/` bọc API client hoặc orchestration của feature; không được trở thành một lớp pass-through vô nghĩa.
- `schemas/` xác thực input ở UI boundary; server vẫn là nơi quyết định invariant và authorization.

### 5.1 Lifecycle UI conventions cho catalog/dữ liệu nền (PRJ-SRS-007)

- Mọi catalog có lifecycle (trades, work-types, project areas…) hiển thị trạng thái bằng `.bf-badge-*` + confirm dialog khi deactivate với **usage warning** từ API (`warning` + `usage.workOrders`) — mirror `WorkTypeStatusDialog`; notice chỉ hiển thị sau PATCH thành công (API quyết định warning, UI không tự đoán).
- Giao dịch mới dùng picker active-only (`/work-types/active`, `GET /projects/:projectId/areas/active`) — UI không tự lọc phía client cho nghiệp vụ chọn lựa.
- Feature A không import `features/B/components/internal-file`; nếu cần collaboration, expose một interface nhỏ ở `B/index.ts` hoặc route qua API.
- `lib/` chỉ chứa technical adapter/framework utility dùng bởi nhiều feature; code chỉ có một consumer phải ở feature đó.

## 6. Ark UI và design system

Ark UI chịu trách nhiệm behavior/state machine và accessibility primitives; styling là trách nhiệm của repo.

- Bọc Ark UI tại `src/components/ui/<primitive>/` để ổn định interface cho feature.
- Chuẩn hóa focus ring, keyboard behavior, disabled/loading/error state và ARIA labels trong wrapper.
- Dùng design tokens (CSS custom properties hoặc styling system được chốt khi scaffold) thay vì hard-code màu/spacing ở feature.
- Không copy nguyên một component Ark UI vào mỗi feature.
- Không coi primitive headless là sản phẩm hoàn chỉnh: mỗi component phải có visual states, responsive behavior, reduced-motion behavior và test keyboard/focus.
- Khi dùng component của Ark UI trong Server Component, đặt nó sau client wrapper cần thiết và kiểm tra boundary của package.

### 6.1 Design tokens "Blueprint & Site" (đã chốt)

- Tokens nằm ở `src/styles/tokens.css` (CSS custom properties `--bf-*`), recipes dùng chung ở `src/app/globals.css` với prefix `.bf-*`. Feature KHÔNG hard-code màu/spacing — phải dùng token hoặc class `.bf-*`.
- Hướng thị giác: navy bản vẽ `--bf-ink` cho sidebar/tiêu đề; cam an toàn `--bf-accent` chỉ dùng cho hành động và điểm nhấn dữ liệu; màu trạng thái chỉ trong badge (`.bf-badge-*`).
- Font: Be Vietnam Pro qua `next/font/google` (subset `vietnamese`), 400/500/600/700; số liệu dùng `font-feature-settings: 'tnum'`.
- Shell: `components/layout/AppShell.tsx` (client) sở hữu guard phiên + sidebar + topbar; route `(app)/*` tự động bọc trong shell qua `(app)/layout.tsx`; route `(auth)/*` dùng khung `.bf-auth`.
- Motion: đúng một orchestrated moment khi load (ví dụ progress bar KPI); mọi transition khác ≤ 120ms; `prefers-reduced-motion` được tôn trọng ở global.

## 7. Data, auth và lỗi

- API NestJS là source of truth; web dùng HTTP/OpenAPI contract, không dùng DB trực tiếp.
- Server loader ưu tiên fetch gần nguồn dữ liệu và giữ token/secret ở server.
- Client interaction chỉ gửi command cần thiết qua API; không optimistic-update nếu chưa có rollback/error contract.
- Error từ API phải được map về view state rõ ràng: validation, unauthorized, forbidden, not-found, conflict, unavailable.
- Auth/session implementation chưa được chốt; khi chọn provider phải cập nhật `NETCODE.md`, `RUNTIME.md` và ADR tương ứng.
- Cache/revalidation là quyết định theo feature; không mặc định cache dữ liệu cá nhân hoặc mutation response.

## 8. Test và proof

| Phạm vi | Mục tiêu |
| --- | --- |
| UI primitive | keyboard, focus, ARIA/state, visual state quan trọng |
| Feature | user outcome, loading/error/empty state, feature public interface |
| Route | params, layout, metadata, redirect/access behavior |
| Web integration | API adapter mapping và server/client boundary |
| E2E | critical journeys trên browser thật |

Bằng chứng tối thiểu cho web change là typecheck/lint/build tương ứng; thay đổi route cần route smoke test; thay đổi Ark UI cần accessibility/keyboard check. Chưa ghi nhận lệnh nào pass trước khi workspace được scaffold.

## 9. Checklist thêm route/feature

- [ ] URL và route group đã được xác định; không tạo route phụ ngoài ý muốn.
- [ ] `page/layout` chỉ composition; behavior nằm ở feature.
- [ ] Server/Client boundary và secret flow đã rõ.
- [ ] Feature có public interface; không deep-import feature khác.
- [ ] Ark UI wrapper có focus/keyboard/error/loading states.
- [ ] API contract và generated client đã được route nếu có thay đổi.
- [ ] Proof đúng lane trong [`../../WORK-ROUTING.md`](../../WORK-ROUTING.md).

## References

- [Next.js documentation](https://nextjs.org/docs)
- [Next.js project structure](https://nextjs.org/docs/app/getting-started/project-structure)
- [Next.js server and client components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Next.js `src` folder convention](https://nextjs.org/docs/app/api-reference/file-conventions/src-folder)
- [Ark UI](https://ark-ui.com/)
- [Next feature-based template](https://github.com/rufatalv/next-feature-based)
- [System architecture and routing](../../ARCHITECTURE.md)
