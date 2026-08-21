# Content and Package Architecture

> **Status:** target boundary cho resource/package của ba workspace; chưa có asset, package hoặc release artifact thực tế.
> **Owner:** static assets, generated artifacts, package identity và input/output của build.

## 1. Ownership

| Nội dung | Owner | Quy tắc |
| --- | --- | --- |
| API schema/OpenAPI/generated client input | `src/api` | API producer tạo; web/mobile consume artifact đã generate |
| Web public assets | `src/web/public` | Next/static delivery; không import từ mobile |
| Web styles/tokens | `src/web/src/styles` và UI wrapper | Ark UI behavior, repo presentation |
| Mobile images/fonts/native assets | `src/mobile/assets` | bundle theo platform; không giả định DOM/static URL |
| Runtime secret/config | workspace runtime owner | không commit, không đưa secret vào client bundle |

Không tạo global asset folder chỉ để tiện. Artifact phải có một producer, một canonical path và một consumer contract.

## 2. Package boundaries

Mỗi workspace là package/build boundary độc lập:

```text
src/api/     → server package/deploy artifact
src/web/     → Next package/deploy artifact
src/mobile/  → native app bundle
```

Root `src/` chỉ là topology; không chứa source dùng chung. Nếu sau này có generated contract package, nó phải được ghi vào `NETCODE.md` và `WORK-ROUTING.md`, có version/current contract rõ ràng. Không đưa domain model, ORM entity hay Ark UI component vào package chia sẻ.

## 3. Build inputs và outputs target

- API build gồm TypeScript server source, config schema và migration/resource input được chọn; output không được chứa secret.
- Web build gồm Next app source, `public/`, styles/tokens và public-safe environment; `public/` nằm ở workspace root theo convention Next.
- Mobile build gồm TypeScript/React Native source, `app/` routes, assets và platform config; native credentials nằm ngoài repository/secret store.
- OpenAPI/generated clients là generated artifacts: không sửa tay, phải regenerate và audit web/mobile consumer trong cùng contract change.

## 4. Asset rules

- Đặt asset gần owner; không copy cùng một file giữa workspace nếu có thể tham chiếu một source build rõ ràng.
- Web asset cần alt/semantic behavior; mobile asset cần density/platform variant khi native build yêu cầu.
- Asset identity, cache policy và public/private status phải được ghi khi có feature thật.
- Generated reports, snapshots và fixtures là proof artifacts; chúng không tự động là producer/consumer của runtime contract.

## 5. Change proof

Khi resource/package identity thay đổi:

1. xác định producer, consumer, generated artifact và deploy output;
2. validate current contract trước khi build/package;
3. audit test, fixture, snapshot, manifest và report độc lập;
4. chạy proof của workspace bị ảnh hưởng và ghi artifact path/hash nếu cần;
5. không thêm legacy/current package path hoặc compatibility fallback nếu chưa có ADR.

Hiện repo mới có directory scaffold nên chưa có cook/package/build proof. Lane thuộc [`../process/DEVELOPMENT.md`](../process/DEVELOPMENT.md), runtime thuộc [`RUNTIME.md`](RUNTIME.md), protocol thuộc [`NETCODE.md`](NETCODE.md).
