# Workspace Protocol — buildflow

<!-- PASEO_WORKSPACE_PROTOCOL_VERSION: 3 -->

- identity: owner `Human`; version `1`; last_reviewed `2026-09-03`; applies_to `/home/trung/Documents/2026/project/buildflow`
- project risk/protected areas: risk class `unclassified`; chưa ghi nhận protected area riêng; Lead phải đọc current repository instructions và current bytes trước mutation.
- default topology: Lead-direct cho exact tiny task; chỉ thêm smallest useful Peer/Supervisor khi uncertainty, risk hoặc independent judgment thật sự cần.
- ownership/hotspots: mỗi moving/coupled scope có một write Owner; assignment phải nêu shared hoặc coupled surfaces trước delegation.
- routing defaults: discover rồi pin provider/model/effort trong bounded assignment; không silent fallback; route phải có reason, scope và expiry.
- issue tracker: Beads Central là durable issue/work graph bắt buộc cho Lead, Peer và Supervisor. Mỗi role gọi `beads_status` khi bắt đầu assignment, dùng đúng project do Paseo bind, đọc issue liên quan trước action và ghi authoritative readback ở material handoff; Central unavailable thì mutation `BLOCKED` và issue state giữ `UNKNOWN`, việc inspect không mutation vẫn tiếp tục, không fallback native `bd`/tracker khác. Lead create/update và chỉ close sau verdict; mutating Peer claim/update exact granted issue và dùng `discoveredFrom`; read-only Peer không cần issue grant để inspect; Supervisor read-only.
- existing harness: chưa khảo sát. Ghi ra những gì đã cai trị repository này (`AGENTS.md`, `CONTRIBUTING`, CI gates, review conventions) và protocol này nhường cái nào; chỉ ghi `none` sau khi đã thực sự nhìn.
- project policy: `none`; chỉ activate exact package + version + scope + authority + conflict rule bằng Human decision hoặc protocol revision mới.
- review/evidence: focused checks và current diff là mặc định; independent review theo material risk; Lead/Human giữ acceptance authority.
- escalation/Human decisions: dùng `REOPEN`, `DEPENDENCY` hoặc `BLOCKED` với evidence và exact decision cần Human chốt.
- repository exceptions/anti-patterns: chưa ghi nhận exception riêng; không dựng control plane thứ hai, self-approve hoặc mở rộng lease từ tool/runtime capability.
