# Mobile Architecture — React Native

> **Status:** thin Expo client đã triển khai tại `src/mobile` (shell + IAM
> sign-in/session/profile/password + eligibility self-check ORG-SRS-008, issue #31);
> tài liệu này giữ vai trò owner cho routing, screen, storage và platform capability.
> **Owner:** mobile client, native lifecycle, screen routing và platform capability.

## 1. Khuyến nghị

Vì mobile không phải surface được dùng nhiều, lựa chọn baseline là **React Native + TypeScript + Expo framework**. Tài liệu React Native hiện khuyến nghị dùng một framework cho app mới để không phải tự ghép navigation, native API và dependency setup. Expo giữ phần native plumbing nhỏ hơn; chỉ chuyển sang bare/native workflow khi có ràng buộc mà framework không đáp ứng.

Đề xuất route là Expo Router để có filesystem routing gần với Next.js. Đây là quyết định của workspace, không phải yêu cầu API; nếu nhu cầu mobile chỉ là một vài screen, giữ route tree nhỏ và không xây design system mobile lớn.

Tham khảo [React Native Getting Started](https://reactnative.dev/docs/getting-started) và [Using TypeScript](https://reactnative.dev/docs/typescript). React Native và web có thể chia sẻ TypeScript model/generated API contract, nhưng không chia sẻ DOM/Ark UI component.

## 2. Cây thư mục target

```text
src/mobile/
├── app/                                  # Expo Router route files
│   ├── _layout.tsx
│   ├── (auth)/
│   │   ├── sign-in.tsx
│   │   ├── forgot-password.tsx
│   │   └── reset-password.tsx
│   ├── (app)/
│   │   ├── _layout.tsx
│   │   └── index.tsx
│   └── modal.tsx
├── src/
│   ├── features/
│   │   └── <feature>/
│   │       ├── screens/
│   │       ├── components/
│   │       ├── hooks/
│   │       ├── api/
│   │       ├── types/
│   │       └── index.ts
│   ├── components/
│   │   └── ui/                           # native primitives, not Ark UI
│   ├── api/
│   │   ├── client.ts
│   │   └── generated/                    # generated from API contract
│   ├── storage/                          # secure/local storage adapter
│   ├── providers/
│   ├── config/
│   └── utils/
├── assets/
├── app.json / app.config.*
├── eas.json                              # only when EAS is adopted
└── package.json
```

`app/` là routing adapter; screen composition và business behavior thuộc feature. Không đặt domain logic vào file route. Nếu sau này không dùng Expo Router, chỉ thay `app/` bằng một navigation adapter trong workspace; feature interface vẫn giữ nguyên.

Màn hình đổi/đặt lại mật khẩu (IAM-SRS-007): `forgot-password`/`reset-password` thuộc nhóm `(auth)`, form đổi mật khẩu nằm trong profile flow. Các screen chỉ gọi ba endpoint password trong [`API.md`](API.md); đổi/đặt lại thành công cắt session cũ nên app phải reset session state và quay về sign-in.

Màn hình điều kiện nhận việc (ORG-SRS-008, issue #31): route `app/eligibility.tsx` (token gate qua session đã lưu; chưa đăng nhập → gợi ý đăng nhập) render feature `src/features/eligibility/EligibilityScreen.tsx`. Screen gọi typed client `fetchMyEligibility` → `GET /api/v1/eligibility/me`, hiển thị verdict banner (`Đủ điều kiện` / `Chưa đủ điều kiện`) + `checkedAt` + mã đối chiếu (`correlationId`), danh sách condition (`ĐẠT` / `KHÔNG ĐẠT` / `KHÔNG ĐÁNH GIÁ ĐƯỢC` cho `passed` true/false/null) và tư cách thành viên `crews[]` (mã đội · tên · vai trò · hiệu lực). Trạng thái: loading (`ActivityIndicator`), error + `Thử lại`, 404 `RESOURCE_NOT_FOUND` → empty `Tài khoản không có hồ sơ worker`, 401 → gợi ý đăng nhập lại; nút `Kiểm tra lại` re-fetch (stale → force refresh, không blind submit). Entry point: nút `Xem điều kiện nhận việc` trên `ProfileScreen` → `router.push('/eligibility')`. Mobile không suy luận eligibility cục bộ — mọi đánh giá do API trả về.

Màn hình bảng việc (JOB-SRS-005, issue #45): route `app/job-board/index.tsx` (token gate qua session đã lưu, mirror `app/projects/index.tsx`) render feature `src/features/job-board/JobBoardScreen.tsx`; chi tiết `app/job-board/[id].tsx` render `WorkOrderPreviewScreen` mỏng. Screen gọi typed client `fetchJobBoard` → `GET /api/v1/job-board?limit&offset` (contract: [`ENDPOINTS.md §20`](ENDPOINTS.md); envelope `{ data, total, limit, offset }`, `cache: 'no-store'`), card hiển thị code/title/projectName/workTypeName/areaName/requiredTradeName/priority/planned times/window + state badge + CTA `Xem chi tiết` → `/job-board/[id]`; **card không render chữ `Nhận việc`** (CTA "Nhận việc" chỉ ở detail khi AVAILABLE — #47, claim command thật là #48). Preview gọi `fetchWorkOrderPreview` → `GET /api/v1/work-orders/:id` (WORKER được đọc), `state ≠ 'AVAILABLE'` → banner trạng thái, không action. Trạng thái: loading, empty (`Chưa có việc nào đang nhận — kéo xuống để làm mới`), error + `Thử lại`, 401 → đăng nhập lại, 403 defensive-reachable khi filter `projectId` ngoài scope (server trả 403-generic — BD12, JOB-SRS-006 `#46`); FlatList + `RefreshControl` pull-to-refresh (reset offset 0) + `onEndReached`/`Tải thêm` pagination (dừng khi loaded === total). Entry point: nút `Bảng việc` trên `ProfileScreen` → `router.push('/job-board')`. Filter theo ngày/dự án/khu vực/loại/kỹ năng thuộc #46 (JOB-SRS-006 — backend contract tại [`ENDPOINTS.md §20.1`](ENDPOINTS.md); BD9 DISCHARGED by #46; FilterSheet/chips multi-select + generation dedupe thuộc mobile lane).
> **Chi tiết việc (JOB-SRS-007, issue #47 — backend contract + mobile lane DONE):** backend công bố `GET /api/v1/job-board/:id` (contract đầy đủ: route + shape + authz + state semantics + CTA matrix tại [`ENDPOINTS.md §20.2`](ENDPOINTS.md)). Màn hình `WorkOrderPreviewScreen` gọi typed client `fetchJobBoardDetail` → endpoint mới (shape `JobBoardDetail` đủ sections §3.1: thời gian + cửa sổ nhận việc, địa điểm, project/loại + requiredFields, trade, mô tả/hướng dẫn, customFields, checklists grouping purpose + badge required/blocking/photo; OMIT `createdBy` — không PII), re-fetch lúc mount + focus (`useFocusEffect` + busy-guard chống double-fire R6) + pull-refresh (lỗi tạm 0/5xx → giữ data cũ + banner inline; re-fetch nhận 404/409 → xóa detail về gone/config screen, F001), 403 trên mọi fetch → xóa detail render forbidden (AC-7), 409 `JOB_BOARD_CONFIG_INVALID` → banner config-issue (AC-6), state đổi giữa chừng → banner "Trạng thái công việc đã thay đổi" + "Tải lại". CTA matrix: AVAILABLE → nút "Nhận việc" (onPress = re-fetch re-check; vẫn AVAILABLE → hint #48 — claim command thật thuộc #48, không network command mới); SCHEDULED/EXPIRED/ASSIGNED/CLOSED → ẩn CTA + banner lý do. Evidence: [`../evidence/job-srs-007/JOB-SRS-007-E2E.md`](../evidence/job-srs-007/JOB-SRS-007-E2E.md).

## 3. Dependency rules

- Mobile chỉ gọi API qua typed client/adapter; không truy cập database hoặc NestJS source.
- Mỗi feature sở hữu screen state, loading/empty/error state và API orchestration của nó.
- Native capability (camera, notification, secure storage, deep link) đi qua adapter nhỏ trong `src/`, không rải SDK call vào screen.
- `src/components/ui` chứa native presentation primitives; không import `@ark-ui/react`, DOM type hoặc CSS Modules của web.
- API model được generate/consume từ contract; không copy domain entity của server rồi giả vờ đó là mobile domain.
- Session token (accessToken) lưu qua `expo-secure-store` (Keychain/Keystore) trên native qua adapter `src/storage/session.ts`; trên web, Expo SDK 51 chưa hỗ trợ SecureStore nên fallback về AsyncStorage — rủi ro plaintext trên web được chấp nhận vì web chỉ là dev/preview target. Session plaintext cũ trong AsyncStorage (kiến trúc trước đây) được legacy-migrate sang SecureStore ở lần đọc đầu rồi xoá, và `clearSession` luôn dọn cả hai nơi; credential nhạy cảm khác vẫn không lưu trong plain async storage.
- Shared logic chỉ được tạo khi có ít nhất hai consumer và interface đủ sâu; duplication nhỏ trên web/mobile tốt hơn coupling sai seam.

## 4. Runtime và state

```text
App bootstrap
  → config / providers
  → session restore
  → Expo Router navigation
  → feature screen
  → typed API adapter
  → loading / success / error / retry state
```

Mobile cần xử lý các trạng thái mà web có thể ít gặp hơn:

- mất mạng và request timeout;
- app bị background/foreground;
- token hết hạn;
- retry idempotent và tránh submit trùng;
- deep link mở khi session chưa restore;
- permission bị từ chối hoặc thu hồi.

Chỉ thêm offline cache, background sync, push notification hoặc native module khi có use case thực tế; không biến baseline mỏng thành một platform framework.

## 5. UI và accessibility

- Dùng native `View`, `Text`, `Pressable`, `TextInput`, `FlatList` và primitive tương ứng; chọn navigation/UI library bổ sung chỉ khi screen count chứng minh nhu cầu.
- Mỗi interactive control có label/accessibility role/state; focus/touch target và contrast phải được kiểm tra trên iOS/Android.
- Visual token có thể tương đồng với web ở mức màu/spacing semantic, nhưng implementation và platform behavior độc lập.
- Không dùng web responsive CSS hoặc `window` assumption trong shared API/model code.

## 6. Test và proof

| Phạm vi | Mục tiêu |
| --- | --- |
| Pure feature logic | state transition, mapper, validation, retry policy |
| Component/screen | interaction, loading/error/empty state, accessibility label |
| API adapter | serialization, auth header, error mapping |
| Device/simulator smoke | navigation, permission, deep link, keyboard, platform-specific behavior |
| Release build | package/config/environment đúng target |

Với mobile ít dùng, proof ưu tiên typecheck/lint và một critical-path device smoke test; chưa cần test mọi platform-specific permutation khi chưa có native feature.

> **Native smoke đã thực hiện (ORG-SRS-008, issue #31, 2026-09-06):** flow eligibility (login → profile → `/eligibility`)
> chạy PASS trên Android emulator (android-34, KVM accel, Expo Go 2.31.2 = SDK 51, Metro + API/PostgreSQL thật),
> proof đầy đủ tại `docs/evidence/org-srs-008/ORG-SRS-008-E2E.md` §8 (screenshots `native-shots/`).
> Smoke này phát hiện 1 bug product thật (native dep tree: `react-native-screens@4.27.0` thay vì `3.31.1` + thiếu
> `gesture-handler`/`reanimated` — xem `src/mobile/package.json`) mà web export không lộ.

## 7. Lộ trình đề xuất

1. **Chưa triển khai native:** chốt API contract và web vertical slice trước.
2. **Thin shell:** tạo Expo app, app layout, environment/config và API client.
3. **Read-first flow:** thêm một screen authenticated hoặc read-only với loading/error/offline state.
4. **Native capability có lý do:** chỉ thêm permission, notification, camera hoặc offline sync khi product requirement ghi rõ.
5. **Bare workflow chỉ khi cần:** nếu Expo không đáp ứng constraint, ghi ADR và thay adapter, không kéo domain logic xuống native layer.

## 8. Checklist thêm screen

> **Đã tick cho Job Board (JOB-SRS-005, issue #45):** route `app/job-board/index.tsx` +
> `app/job-board/[id].tsx` (deep link `/job-board`, `/job-board/:id`; `Stack.Screen`
> title `Bảng việc`/`Chi tiết việc`); feature public interface tách khỏi route
> (`JobBoardScreen`/`JobBoardCard`/`WorkOrderPreviewScreen` nhận `token` qua props);
> đủ states loading/empty/error/retry/401 + 403 defensive-unreachable (#46-forward-compat) + pull-to-refresh + pagination;
> API model/client theo contract hiện hành ([`ENDPOINTS.md §20`](ENDPOINTS.md));
> không native dependency mới (chỉ RN primitives); a11y label mọi control;
> proof route qua [`../../WORK-ROUTING.md`](../../WORK-ROUTING.md) (mobile consumer,
> contract producer là API — cùng change).

- [x] Route thuộc group nào và deep link là gì?
- [x] Feature public interface đã tách khỏi route chưa? (JOB-SRS-006 `#46`: `JobBoardScreen`/`JobBoardFilterSheet`/`job-board-filter-state` nhận `token`/props, không domain logic trong `app/`.)
- [x] Loading, empty, error, retry, offline và session-expired state đã có chưa? (`#46`: loading/empty/**empty-filtered** (copy riêng + gợi ý xóa filter)/success/validation per-field/error/401/**403 reachable** (BD12)/retry/filter-loading busy-guard; refresh giữ filter, đổi filter reset offset 0. `#47`: loading/success/error + `Thử lại`/401/**403 xóa-detail**/404/**409 config**/null-state/refresh-giữ-data + inline banner/state-changed + `Tải lại`.)
- [x] API model/client là generated/current contract chưa? (`#46`: `FetchJobBoardParams` +6 filter — `areaId`/`workTypeId` lặp, `''`=absent — + `fetchJobBoardFilterOptions` → [`ENDPOINTS.md §20.1`](ENDPOINTS.md). `#47`: `JobBoardDetail` + `fetchJobBoardDetail` → [`ENDPOINTS.md §20.2`](ENDPOINTS.md).)
- [x] Native dependency có thật sự cần không? (`#46`: không dependency mới — FilterSheet bottom-sheet bằng RN primitives `Modal`/`Pressable`, không Ark UI.)
- [ ] Accessibility label/role/state đã được kiểm tra trên iOS và Android chưa?
- [x] Proof đã route qua [`../../WORK-ROUTING.md`](../../WORK-ROUTING.md) chưa? (mobile consumer, contract producer là API — cùng change; evidence [`../evidence/job-srs-006/JOB-SRS-006-E2E.md`](../evidence/job-srs-006/JOB-SRS-006-E2E.md), [`../evidence/job-srs-007/JOB-SRS-007-E2E.md`](../evidence/job-srs-007/JOB-SRS-007-E2E.md).)

> **Filter Job Board (JOB-SRS-006, issue #46):** `JobBoardFilterSheet` (project
> single-select + area/workType multi-chips + toggle `skill=mine` + date range ISO kèm
> offset + reset/apply + client validation mirror server) trên nguồn
> `GET /api/v1/job-board/filter-options` (response `{ now, projects, areas,
> workTypes, trades }` — UI chỉ dùng 4 mảng picker, `now` top-level là clock
> server giữ trong type để khớp contract); active-filter chips (xóa từng chip + xóa tất
> cả) + count `total` trên `JobBoardScreen`; filter state ở module-level store
> `job-board-filter-state.ts` (giữ khi back từ detail — Expo Router remount screen;
> scope phiên app, mất khi restart — KHÔNG AsyncStorage); generation dedupe mọi trigger
> (discharge follow-up dedupe `:540` — BD16 mobile phần) + busy-guard chống request chồng.
> Không chữ `Nhận việc` ở mọi state (claim là #47).

## References

- [React Native Getting Started](https://reactnative.dev/docs/getting-started)
- [React Native Using TypeScript](https://reactnative.dev/docs/typescript)
- [Expo Router introduction](https://docs.expo.dev/router/introduction/)
- [Expo create a project](https://docs.expo.dev/get-started/create-a-project/)
- [React Native Environment Setup](https://reactnative.dev/docs/environment-setup)
- [System architecture and routing](../../ARCHITECTURE.md)
