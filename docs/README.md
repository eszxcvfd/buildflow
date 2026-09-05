# Documentation

> Đây là canonical index cho quyền sở hữu và định tuyến tài liệu. Mỗi chủ đề chỉ có một owner; tài liệu khác phải link tới owner thay vì chép lại rule.

## Ownership and routing

| Area | Canonical owner |
| --- | --- |
| System orientation and cross-workspace architecture | [`../ARCHITECTURE.md`](../ARCHITECTURE.md) |
| Workspace change routing | [`../WORK-ROUTING.md`](../WORK-ROUTING.md) |
| Lane selection, proof and closeout | [`process/DEVELOPMENT.md`](process/DEVELOPMENT.md) |
| Current work queue | [`issues/ROADMAP.md`](issues/ROADMAP.md) |
| Non-trivial plans and durable coordination | [`../PLANS.md`](../PLANS.md) |
| API modular/clean architecture | [`architecture/API.md`](architecture/API.md) |
| HTTP endpoint contract (ORG slices) | [`architecture/ENDPOINTS.md`](architecture/ENDPOINTS.md) |
| Web routes, features and Ark UI | [`architecture/WEB.md`](architecture/WEB.md) |
| Mobile React Native/Expo proposal | [`architecture/MOBILE.md`](architecture/MOBILE.md) |
| Runtime lifecycle and environment boundaries | [`architecture/RUNTIME.md`](architecture/RUNTIME.md) |
| Data layer: Docker, PostgreSQL and Redis | [`architecture/DATA.md`](architecture/DATA.md) |
| HTTP/JSON/OpenAPI and compatibility admission | [`architecture/NETCODE.md`](architecture/NETCODE.md) |
| Server resources and cook/package boundaries | [`architecture/CONTENT.md`](architecture/CONTENT.md) |
| Framework/template source notes | [`architecture/STACK-REFERENCES.md`](architecture/STACK-REFERENCES.md) |
| Durable architectural decisions | [`adr/`](adr/) |

## Reading rule

Open the smallest current document set needed:

- mọi thay đổi: `ARCHITECTURE.md` và `WORK-ROUTING.md`;
- API/domain: `architecture/API.md`;
- web: `architecture/WEB.md`;
- mobile: `architecture/MOBILE.md`;
- contract: `architecture/NETCODE.md`;
- lifecycle/deploy: `architecture/RUNTIME.md`;
- data layer: `architecture/DATA.md`;
- design decision khó đảo ngược: `adr/` và [`../PLANS.md`](../PLANS.md) nếu thuộc điều kiện plan.

Khi tài liệu owner im lặng hoặc stale, cập nhật owner trước khi dựa vào rule mới. Không tạo routing note cạnh tranh trong workspace, issue hoặc skill.

## Document status

Tài liệu architecture hiện mô tả target design cho scaffold rỗng. Claim runtime/test/build chỉ được đánh dấu verified sau khi có source/toolchain và bằng chứng tương ứng.
