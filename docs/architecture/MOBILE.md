# Mobile Architecture — React Native

> **Status:** đề xuất target design cho `src/mobile`; hiện chưa có source code hoặc package manifest.
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

## 3. Dependency rules

- Mobile chỉ gọi API qua typed client/adapter; không truy cập database hoặc NestJS source.
- Mỗi feature sở hữu screen state, loading/empty/error state và API orchestration của nó.
- Native capability (camera, notification, secure storage, deep link) đi qua adapter nhỏ trong `src/`, không rải SDK call vào screen.
- `src/components/ui` chứa native presentation primitives; không import `@ark-ui/react`, DOM type hoặc CSS Modules của web.
- API model được generate/consume từ contract; không copy domain entity của server rồi giả vờ đó là mobile domain.
- Auth token, secret và secure storage policy chưa được chốt; không lưu credential nhạy cảm trong plain async storage.
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

## 7. Lộ trình đề xuất

1. **Chưa triển khai native:** chốt API contract và web vertical slice trước.
2. **Thin shell:** tạo Expo app, app layout, environment/config và API client.
3. **Read-first flow:** thêm một screen authenticated hoặc read-only với loading/error/offline state.
4. **Native capability có lý do:** chỉ thêm permission, notification, camera hoặc offline sync khi product requirement ghi rõ.
5. **Bare workflow chỉ khi cần:** nếu Expo không đáp ứng constraint, ghi ADR và thay adapter, không kéo domain logic xuống native layer.

## 8. Checklist thêm screen

- [ ] Route thuộc group nào và deep link là gì?
- [ ] Feature public interface đã tách khỏi route chưa?
- [ ] Loading, empty, error, retry, offline và session-expired state đã có chưa?
- [ ] API model/client là generated/current contract chưa?
- [ ] Native dependency có thật sự cần không?
- [ ] Accessibility label/role/state đã được kiểm tra trên iOS và Android chưa?
- [ ] Proof đã route qua [`../../WORK-ROUTING.md`](../../WORK-ROUTING.md) chưa?

## References

- [React Native Getting Started](https://reactnative.dev/docs/getting-started)
- [React Native Using TypeScript](https://reactnative.dev/docs/typescript)
- [Expo Router introduction](https://docs.expo.dev/router/introduction/)
- [Expo create a project](https://docs.expo.dev/get-started/create-a-project/)
- [React Native Environment Setup](https://reactnative.dev/docs/environment-setup)
- [System architecture and routing](../../ARCHITECTURE.md)
