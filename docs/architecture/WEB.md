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
├── (app)/trades/page.tsx             → /trades (ORG-SRS-003: danh sách ngành nghề, admin-only)
├── (app)/trades/new/page.tsx         → /trades/new (tạo ngành nghề)
├── (app)/trades/[id]/page.tsx        → /trades/:id (chi tiết + deactivate/activate + warning)
├── (app)/trades/[id]/edit/page.tsx   → /trades/:id/edit (sửa mã/tên/mô tả)
└── (app)/items/[itemId]/page.tsx     → /items/:itemId
```

Màn hình đổi/đặt lại mật khẩu (IAM-SRS-007): form đổi mật khẩu nằm trong `(app)/profile`; quên mật khẩu và đặt lại bằng token là hai route `(auth)` ở trên. Các màn hình này chỉ gọi ba endpoint password trong [`API.md`](API.md); vì session cũ bị cắt sau khi đổi/đặt lại thành công, luồng phải đưa người dùng về `/sign-in` để đăng nhập lại.

Route `/trades/*` (ORG-SRS-003): danh mục ngành nghề/kỹ năng, admin-only, nav nhóm "Nguồn lực". Client gọi contract trong [`ENDPOINTS.md`](ENDPOINTS.md) §4 qua `lib/api/trades.ts`. Trạng thái (deactivate/activate) KHÔNG nằm trong form sửa — là action riêng `PATCH /trades/:id/status` có confirm dialog; khi deactivate danh mục đang được tham chiếu, API vẫn cho phép và trả `warning` (`'Danh mục đang được tham chiếu bởi resource/loại công việc/work order đang hiệu lực'`) — UI hiển thị cảnh báo rõ. `WorkerForm` chọn ngành nghề từ select tải `listTrades({status:'ACTIVE'})` (label `code — name`); không chọn được trade INACTIVE cho assignment mới, nếu worker đang giữ trade INACTIVE thì giữ nguyên và chỉ gửi thay đổi khi admin thật sự sửa; `WorkerList`/`WorkerDetail` hiển thị tên trade thay UUID thô qua map id → `code — name`.

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
