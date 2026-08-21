# Development Process

> Đây là canonical owner cho lane selection, proof, test discipline, hard-cut và closeout.

## 1. Lane selection

Chọn lane theo producer/owner của thay đổi, không theo người thực hiện:

| Lane | Phạm vi | Owner/proof |
| --- | --- | --- |
| `documentation` | architecture, routing, references, ADR | link/tree consistency; source citations; không claim runtime proof |
| `api` | Nest module, domain, application, adapter | domain/application tests; integration khi có I/O; typecheck/lint |
| `contract` | HTTP DTO, OpenAPI, version/error/auth contract | API contract test + audit generated artifacts và mọi consumer |
| `web` | Next route, feature, Server/Client composition, Ark wrapper | typecheck/lint/build; route/component/accessibility proof |
| `mobile` | React Native screen, Expo route, native capability | typecheck/lint; device/simulator smoke khi có platform behavior |
| `runtime` | bootstrap, env, health, deploy boundary | startup/readiness/build/graceful-shutdown proof |

Cross-workspace change dùng `contract` hoặc `runtime` làm coordinating lane và vẫn phải chạy proof của từng consumer bị ảnh hưởng. Chi tiết định tuyến nằm ở [`../../WORK-ROUTING.md`](../../WORK-ROUTING.md).

## 2. Proof discipline

- Xác định contract và owner trước khi viết test; test không được chọn kiến trúc.
- Với deterministic behavior đã chốt, dùng RED/GREEN nếu phù hợp.
- Ưu tiên outcome-level test tại interface của deep module; không test private implementation/call order trừ khi đó là public contract.
- Production API/state/lifecycle branch/dependency chỉ tồn tại để phục vụ test là dấu hiệu sai seam; xóa hoặc thiết kế lại.
- Khi repo chưa có toolchain, proof của documentation chỉ gồm file/link/source consistency; không ghi `npm test`, `build` hay runtime pass.

## 3. Contract hard-cut

Repo hiện là scaffold chưa public theo bounded inference từ việc chưa có source/package/release artifact. Khi áp dụng rule này:

- giữ đúng một schema, protocol, architecture, package identity và compatibility-admission contract hiện tại;
- giữ protocol/schema version `1` cho đến public shipment đầu tiên;
- validate current contract trước khi mutate và reject mismatch;
- không thêm legacy/current branch, dual read/write, compatibility facade, migration warning hoặc fallback diễn giải dữ liệu cũ;
- cập nhật mọi producer, consumer, generated artifact, test, fixture, validator, snapshot và report liên quan trong cùng contract change;
- negative test phải bảo vệ invariant hiện tại, không lưu blacklist/tên/literal của contract đã xóa.

Nếu product phase thay đổi hoặc public compatibility policy được chốt, ghi ADR trước khi nới rule.

## 4. Change loop

1. Đọc owner docs nhỏ nhất theo [`WORK-ROUTING.md`](../../WORK-ROUTING.md).
2. Viết hoặc cập nhật contract/decision trước nếu thay đổi cross-boundary.
3. Chọn lane và liệt kê proof bắt buộc.
4. Thực hiện thay đổi tối thiểu, giữ dependency direction.
5. Chạy proof có thể chạy; ghi rõ proof chưa thể chạy do thiếu toolchain.
6. Review diff và link/source; doc-only không cần closeout nếu không có plan yêu cầu.

## 5. Closeout

Không trigger closeout cho doc-only edit, small owner-neutral fix hoặc partial progress trừ khi plan hiện hữu yêu cầu. Khi một plan có yêu cầu closeout, completion evidence phải chỉ rõ file, producer, consumer, generated artifact, test/fixture và validator đã đồng bộ.
