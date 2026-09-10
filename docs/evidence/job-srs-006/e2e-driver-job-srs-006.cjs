/**
 * JOB-SRS-006 E2E driver — Lọc Job Board (issue #46).
 * Evidence-only script; phạm vi docs/evidence/job-srs-006 — KHÔNG sửa source, KHÔNG commit.
 *
 * Fork từ driver-005 (giữ pattern: playwright-core absolute path, Chrome headless,
 * creds @vinacons.vn, uniqueness bằng WO code hệ thống + id, cleanup theo id,
 * audit append-only). Khác 005: planned dates tính theo run-time now (không hardcode
 * tuyệt đối); seed 6 WO phân bố planned date/area/type/trade/assignment để chứng minh
 * từng filter + kết hợp + clear; shots/vars/log label mới `-S6R*` (KHÔNG đè history 005).
 *
 * Chạy:   node e2e-driver-job-srs-006.cjs [label]
 *           (label: `S6R1`/`S6R2`… → vars `e2e-vars-<label>.json`, shots `*-<label>.png`;
 *           stdout nên tee ra `run-<label>.stdout.log` làm artifact riêng từng run)
 * Prereqs:  - stack rebuild từ working tree, `docker compose -f infra/docker/compose.yaml ps`
 *            (api :3000, mobile :19006 healthy)
 *          - playwright-core resolvable: `PLAYWRIGHT_CORE_PATH=<path>/playwright-core`
 *          - Chrome: `/usr/bin/google-chrome` hoặc `CHROME_PATH=<path>`
 *          - PM quoc.tran (STAFF, member PRA+PRB), WORKER ba.nguyen (WORKER member PRA).
 *            Creds qua env `E2E_PM_PASS` / `E2E_WORKER_PASS` (default demo-only trong file).
 *          - Không có tài khoản ADMIN trong demo DB (đã verify: users không có ADMIN/
 *            MANAGER) ⇒ case ADMIN+skill=mine→empty KHÔNG chạy được ở driver này —
 *            ghi rõ trong E2E.md (unknown trung thực, phủ bởi unit use-case).
 *
 * Luồng: S0 login thật + baseline → S1 seed 6 WO + provision trade ba.nguyen →
 * S2 từng filter đơn (F1a–F1e) → S3 kết hợp + clear + invalid + 403 + options →
 * S4 claim mô phỏng + refresh có filter → S5 pagination → S6 read-only delta →
 * S7 Expo UI (sheet/apply/chips/back-giữ-filter/empty-filtered/clear) → S8 cleanup.
 *
 * TRUNG THỰC: (1) in-memory specs (`src/api/test/job-board-filters.e2e.spec.ts`) KHÔNG
 * phải real-DB proof — proof thật là driver này; (2) claim được MÔ PHỎNG bằng psql
 * INSERT assignments (claim write thuộc #47); (3) `resource_trades` cho ba.nguyen là
 * dữ liệu provision mô phỏng (demo DB không có — INSERT by-id + cleanup by-id, không
 * đụng row seeded); (4) WO-NOTRADE: tạo qua API với trade hợp lệ rồi psql
 * `required_trade_id=NULL` (API từ chối null vì work-type nào cũng yêu cầu trade) —
 * ghi rõ là simulated để chứng minh skill=mine loại NULL-trade.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function loadPlaywrightCore() {
  const candidates = [
    ...(process.env.PLAYWRIGHT_CORE_PATH ? [process.env.PLAYWRIGHT_CORE_PATH] : []),
    'playwright-core',
    path.join(process.cwd(), 'node_modules', 'playwright-core'),
  ];
  let lastErr = null;
  for (const c of candidates) {
    try {
      return require(c);
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(
    `Không load được playwright-core (đã thử: ${candidates.join(', ')}). ` +
      `Prereqs: PLAYWRIGHT_CORE_PATH=<path>/playwright-core. Gốc: ${lastErr && lastErr.message}`,
  );
}
const { chromium } = loadPlaywrightCore();
const CHROME_PATH = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';

const API = 'http://localhost:3000';
const MOBILE = 'http://localhost:19006';
const SHOTS = path.join(__dirname, 'shots');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
const LABEL = String(process.argv[2] || 'S6R1').trim();
const VARS_PATH = path.join(__dirname, `e2e-vars-${LABEL}.json`);

const PM = { email: 'quoc.tran@vinacons.vn', pass: process.env.E2E_PM_PASS ?? 'E2EPm@2025' };
const WORKER = { email: 'ba.nguyen@vinacons.vn', pass: process.env.E2E_WORKER_PASS ?? 'E2E5W3@2025' };
const WORKER_ID = '98230b1d-f254-4e99-9515-f9e2b1fd63a4';

const PRA = '10000000-0000-4000-8000-000000000001';
const PRB = '10000000-0000-4000-8000-000000000002';
const AREA_KQ01 = '589c0681-eec2-4a25-ac39-f91f866d507e';
const AREA_KQ02 = '18802ba6-ddb0-4575-a739-1a3825c5714f';
const AREA_GAA03 = '07fe0492-3551-4ff4-96ac-38dbab7f0f93';
const WT_BTCT = 'e2e4b200-0000-4000-8000-0000000000b3';
const WT_SON = 'a1b2c3d4-0001-4000-8000-000000000001';
const WT_DIEN = 'a1b2c3d4-0002-4000-8000-000000000002';
const WT_OPLAT = 'a1b2c3d4-0003-4000-8000-000000000003';
const TRADE_THOCAT = '11111111-1111-4111-8111-111111111111';
const TRADE_SON = 'e8f974e9-3d12-4f25-97cb-32bd81b843fd';
const TRADE_DIEN = '85fc5da0-cb00-4650-9e3c-fae7a83ab656';
const TRADE_OPLAT = 'b017178a-daf2-4614-ac34-a05e1d1a6fb7';
const SEED_WORKER_ID = 'e2e4a000-0000-4000-8000-0000000000a1';

const CUSTOM_FIELDS_BY_WT = {
  [WT_BTCT]: {},
  [WT_SON]: { dien_tich: 120, so_tang: 2 },
  [WT_DIEN]: { so_diem_dien: 8, anh_ban_ve: 'https://example.invalid/ban-ve.png' },
  [WT_OPLAT]: { dien_tich: 60, anh_nghiem_thu: 'https://example.invalid/nghiem-thu.png' },
};
const TITLE_BY_KIND = {
  A: 'Trát tường sảnh chính tầng một',
  B: 'Sơn lót khu thương mại tầng hai',
  C: 'Lắp đặt điện sảnh chính đợt muộn',
  D: 'Trát tường sảnh chính đợt muộn',
  E: 'Trát tường căn hộ mẫu block A tầng ba',
  F: 'Ốp lát khu thương mại không yêu cầu thợ',
};

const results = [];
const ok = (id, note = '') => ({ id, ok: true, note });
const fail = (id, note) => ({ id, ok: false, note });
async function runStep(id, name, fn) {
  try {
    const r = await fn(id);
    results.push({ id, name, ...r });
    console.log(`${r.ok ? 'PASS' : 'FAIL'} ${id} ${name}${r.note ? ' :: ' + String(r.note).split('\n')[0] : ''}`);
    if (!r.ok && r.note) console.log(`  detail: ${String(r.note).slice(0, 2500)}`);
    return r;
  } catch (err) {
    results.push({ id, name, ok: false, note: err && err.message ? err.message : String(err) });
    console.log(`ERROR ${id} ${name} :: ${err && err.message ? err.message : err}`);
    return results[results.length - 1];
  }
}
function psqlT(sql) {
  try {
    return execFileSync('docker', [
      'exec', 'buildflow-postgres-1', 'psql', '-U', 'buildflow', '-d', 'buildflow', '-t', '-A', '-c', sql,
    ], { encoding: 'utf8', timeout: 20000 }).trim();
  } catch (e) {
    return `PSQL ERROR: ${e.stderr || e.message}`;
  }
}
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16));
}
async function api(method, urlPath, token, body, noCorr) {
  const headers = { Accept: 'application/json' };
  if (!noCorr) headers['X-Correlation-Id'] = uuid();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${urlPath}`, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  return { status: res.status, json, text: text.slice(0, 2000) };
}
const codesOf = (list) => new Set((list.json.data || []).map((d) => d.code));

const vars = {
  _note: 'Throwaway E2E-only demo data (seed/reset per evidence docs). Never production.',
  runLabel: LABEL,
  titles: { ...TITLE_BY_KIND },
  workOrderIds: {},
  workOrderCodes: {},
};

async function main() {
  let pmTok, workerTok;
  const now = Date.now();
  const DAY = 86400e3;
  const iso = (t) => new Date(t).toISOString();
  // Cửa sổ planned tính theo run-time now (không hardcode tuyệt đối):
  const earlyFrom = iso(now + 12 * 3600e3);
  const earlyTo = iso(now + 3 * DAY);
  const lateFrom = iso(now + 9 * DAY);
  const lateTo = iso(now + 13 * DAY);
  vars.windows = { earlyFrom, earlyTo, lateFrom, lateTo };
  const provisionTradeId = uuid();
  vars.provisionTradeId = provisionTradeId;

  await runStep('S0', 'login PM/worker qua API thật + baseline audit/notification', async () => {
    const pm = await api('POST', '/api/v1/auth/login', null, { email: PM.email, password: PM.pass }, true);
    const wo = await api('POST', '/api/v1/auth/login', null, { email: WORKER.email, password: WORKER.pass }, true);
    if (pm.status !== 201 && pm.status !== 200) return fail('S0', `PM login ${pm.status}: ${pm.text}`);
    if (wo.status !== 201 && wo.status !== 200) return fail('S0', `worker login ${wo.status}: ${wo.text}`);
    pmTok = pm.json.accessToken; workerTok = wo.json.accessToken;
    if (!pmTok || !workerTok) return fail('S0', 'thiếu accessToken');
    vars.auditBefore = psqlT('SELECT count(*) FROM audit_logs;').trim();
    vars.notifBefore = psqlT('SELECT count(*) FROM notifications;').trim();
    return ok('S0', `PM+worker login OK, audit=${vars.auditBefore} notif=${vars.notifBefore}`);
  });

  await runStep('S1', 'seed 6 WO đa dạng + mở board + provision trade (API+psql thật)', async () => {
    const specs = [
      { kind: 'A', projectId: PRA, areaId: AREA_KQ01, workTypeId: WT_BTCT, tradeId: TRADE_THOCAT, start: iso(now + DAY), end: iso(now + 2 * DAY) },
      { kind: 'B', projectId: PRA, areaId: AREA_KQ02, workTypeId: WT_SON, tradeId: TRADE_SON, start: iso(now + DAY), end: iso(now + 2 * DAY) },
      { kind: 'C', projectId: PRA, areaId: AREA_KQ01, workTypeId: WT_DIEN, tradeId: TRADE_DIEN, start: iso(now + 10 * DAY), end: iso(now + 12 * DAY) },
      { kind: 'D', projectId: PRA, areaId: AREA_KQ01, workTypeId: WT_BTCT, tradeId: TRADE_THOCAT, start: iso(now + 10 * DAY), end: iso(now + 12 * DAY) },
      { kind: 'E', projectId: PRB, areaId: AREA_GAA03, workTypeId: WT_BTCT, tradeId: TRADE_THOCAT, start: iso(now + DAY), end: iso(now + 2 * DAY) },
      { kind: 'F', projectId: PRA, areaId: AREA_KQ02, workTypeId: WT_OPLAT, tradeId: TRADE_OPLAT, start: iso(now + DAY), end: iso(now + 2 * DAY) },
    ];
    for (const s of specs) {
      const create = await api('POST', '/api/v1/work-orders', pmTok, {
        projectId: s.projectId, workTypeId: s.workTypeId, title: TITLE_BY_KIND[s.kind], areaId: s.areaId,
        requiredTradeId: s.tradeId, plannedStartAt: s.start, plannedEndAt: s.end,
        plannedHeadcount: 5, requestKey: uuid(), customFields: CUSTOM_FIELDS_BY_WT[s.workTypeId] ?? {},
      });
      if (create.status !== 201 && create.status !== 200) return fail('S1', `create ${s.kind} ${create.status}: ${create.text}`);
      const id = create.json.id;
      vars.workOrderIds[s.kind] = id; vars.workOrderCodes[s.kind] = create.json.code;
      const check = await api('GET', `/api/v1/work-orders/${id}/publish-check`, pmTok, undefined, true);
      if (!check.json || check.json.ready !== true) return fail('S1', `${s.kind} publish-check not ready: ${check.text}`);
      const open = await api('POST', `/api/v1/work-orders/${id}/job-board/open`, pmTok, { expectedVersion: 1 });
      if (open.status !== 200 && open.status !== 201) return fail('S1', `open ${s.kind} ${open.status}: ${open.text}`);
    }
    // WO-F: gỡ trade bằng psql thành NULL (mô phỏng — API từ chối null).
    psqlT(`UPDATE work_orders SET required_trade_id=NULL WHERE id='${vars.workOrderIds.F}';`);
    const fTrade = psqlT(`SELECT required_trade_id FROM work_orders WHERE id='${vars.workOrderIds.F}';`);
    if (fTrade !== '') return fail('S1', `F trade null hóa thất bại: '${fTrade}'`);
    // Provision trade THO-CAT cho ba.nguyen (mô phỏng — demo DB không có row).
    const ins = psqlT(`INSERT INTO resource_trades(id, resource_type, user_id, trade_id, skill_level) VALUES('${provisionTradeId}','USER','${WORKER_ID}','${TRADE_THOCAT}',3) RETURNING id;`);
    if (/PSQL ERROR/i.test(ins)) return fail('S1', `provision trade: ${ins}`);
    const st = psqlT(`SELECT code, status, job_board_open FROM work_orders WHERE id IN ('${Object.values(vars.workOrderIds).join("','")}') ORDER BY code;`);
    return ok('S1', `6 WO mở board + F null-trade + trade provisioned; excerpt:\n${st}`);
  });

  await runStep('S2', 'F1a–F1e: từng filter đơn đúng tập (API thật)', async () => {
    const C = vars.workOrderCodes;
    const q = (p) => api('GET', `/api/v1/job-board?${p}`, workerTok, undefined, true);
    const expectSet = async (label, params, want, ban) => {
      const r = await q(params);
      if (r.status !== 200) return fail('S2', `${label} → ${r.status}: ${r.text}`);
      const codes = codesOf(r);
      const missing = want.filter((c) => !codes.has(c));
      const leaked = ban.filter((c) => codes.has(c));
      if (missing.length || leaked.length) return fail('S2', `${label} thiếu [${missing}] lọt [${leaked}] (có [${[...codes]}])`);
      const dbTotal = r.json.total;
      if (dbTotal !== codes.size && r.json.limit >= 20 && dbTotal !== r.json.data.length && codes.size <= 20) {
        // total trên cùng WHERE — với tập nhỏ total phải bằng số item.
        if (dbTotal !== [...codes].length) return fail('S2', `${label} total=${dbTotal} ≠ items=${codes.size}`);
      }
      return null;
    };
    const all = [C.A, C.B, C.C, C.D, C.E, C.F];
    let r;
    r = await expectSet('F1a-early', `dateFrom=${encodeURIComponent(earlyFrom)}&dateTo=${encodeURIComponent(earlyTo)}`, [C.A, C.B, C.F], [C.C, C.D, C.E]);
    if (r) return r;
    r = await expectSet('F1a-late', `dateFrom=${encodeURIComponent(lateFrom)}&dateTo=${encodeURIComponent(lateTo)}`, [C.C, C.D], [C.A, C.B, C.F, C.E]);
    if (r) return r;
    r = await expectSet('F1b-project', `projectId=${PRA}`, [C.A, C.B, C.C, C.D, C.F], [C.E]);
    if (r) return r;
    r = await expectSet('F1c-area1', `areaId=${AREA_KQ01}`, [C.A, C.C, C.D], [C.B, C.F, C.E]);
    if (r) return r;
    r = await expectSet('F1c-area2', `areaId=${AREA_KQ01}&areaId=${AREA_KQ02}`, [C.A, C.B, C.C, C.D, C.F], [C.E]);
    if (r) return r;
    r = await expectSet('F1d-type1', `workTypeId=${WT_BTCT}`, [C.A, C.D], [C.B, C.C, C.F, C.E]);
    if (r) return r;
    r = await expectSet('F1d-type2', `workTypeId=${WT_BTCT}&workTypeId=${WT_SON}`, [C.A, C.B, C.D], [C.C, C.F, C.E]);
    if (r) return r;
    r = await expectSet('F1e-skill', 'skill=mine', [C.A, C.D], [C.B, C.C, C.F, C.E]);
    if (r) return r;
    const base = await q('limit=50&offset=0');
    const baseCodes = codesOf(base);
    const missingBase = [C.A, C.B, C.C, C.D, C.F].filter((c) => !baseCodes.has(c));
    if (baseCodes.has(C.E) || missingBase.length) return fail('S2', `baseline lệch: thiếu [${missingBase}] E-lọt=${baseCodes.has(C.E)}`);
    vars.baselineTotal = base.json.total;
    return ok('S2', `F1a–F1e đúng tập; baseline total=${base.json.total} (E ngoài scope vắng)`);
  });

  await runStep('S3', 'F2 kết hợp + F3 clear + F4 invalid + F5 403/401 + F6 options', async () => {
    const C = vars.workOrderCodes;
    // F2: early + KQ01 + BTCT + mine → chỉ A.
    const combo = await api('GET', `/api/v1/job-board?dateFrom=${encodeURIComponent(earlyFrom)}&dateTo=${encodeURIComponent(earlyTo)}&areaId=${AREA_KQ01}&workTypeId=${WT_BTCT}&skill=mine`, workerTok, undefined, true);
    if (combo.status !== 200) return fail('S3', `F2 combo ${combo.status}: ${combo.text}`);
    const cc = codesOf(combo);
    if (!cc.has(C.A) || cc.size !== 1) return fail('S3', `F2 combo mong {A}, có [${[...cc]}]`);
    // F3: clear (không param) = baseline S2.
    const clear = await api('GET', '/api/v1/job-board?limit=50&offset=0', workerTok, undefined, true);
    if (clear.json.total !== vars.baselineTotal) return fail('S3', `F3 clear total=${clear.json.total} ≠ baseline=${vars.baselineTotal}`);
    // F4: naive → 400 {dateFrom}; from>to → 400 2 field; skill lạ → 400; projectId sai format → 400.
    const naive = await api('GET', '/api/v1/job-board?dateFrom=2026-01-01T00:00:00', workerTok, undefined, true);
    if (naive.status !== 400 || !naive.json?.fieldErrors?.dateFrom) return fail('S3', `F4 naive → ${naive.status} ${naive.text}`);
    const swap = await api('GET', `/api/v1/job-board?dateFrom=${encodeURIComponent(lateFrom)}&dateTo=${encodeURIComponent(earlyFrom)}`, workerTok, undefined, true);
    if (swap.status !== 400 || !swap.json?.fieldErrors?.dateFrom || !swap.json?.fieldErrors?.dateTo) return fail('S3', `F4 swap → ${swap.status} ${swap.text}`);
    const badSkill = await api('GET', '/api/v1/job-board?skill=all', workerTok, undefined, true);
    if (badSkill.status !== 400 || !badSkill.json?.fieldErrors?.skill) return fail('S3', `F4 skill → ${badSkill.status} ${badSkill.text}`);
    const badPid = await api('GET', '/api/v1/job-board?projectId=not-a-uuid', workerTok, undefined, true);
    if (badPid.status !== 400 || !badPid.json?.fieldErrors?.projectId) return fail('S3', `F4 projectId → ${badPid.status} ${badPid.text}`);
    // F5: projectId PRB (ngoài scope worker) → 403 generic; anon → 401; PM thấy E.
    const oos = await api('GET', `/api/v1/job-board?projectId=${PRB}`, workerTok, undefined, true);
    if (oos.status !== 403) return fail('S3', `F5 out-of-scope → ${oos.status}, mong 403`);
    const anon = await api('GET', '/api/v1/job-board?skill=mine', null, undefined, true);
    if (anon.status !== 401) return fail('S3', `F5 anon → ${anon.status}, mong 401`);
    const pmList = await api('GET', '/api/v1/job-board?limit=50&offset=0', pmTok, undefined, true);
    if (!codesOf(pmList).has(C.E)) return fail('S3', 'F5 PM không thấy WO PRB của mình');
    // F6: filter-options scope-derived — PRA có, PRB vắng; KQ01/KQ02 có; THO-CAT có.
    const opts = await api('GET', '/api/v1/job-board/filter-options', workerTok, undefined, true);
    if (opts.status !== 200) return fail('S3', `F6 options ${opts.status}: ${opts.text}`);
    const ids = (arr) => new Set((arr || []).map((x) => x.id));
    if (!ids(opts.json.projects).has(PRA) || ids(opts.json.projects).has(PRB)) return fail('S3', `F6 projects lệch: [${[...ids(opts.json.projects)]}]`);
    if (!ids(opts.json.areas).has(AREA_KQ01) || !ids(opts.json.areas).has(AREA_KQ02)) return fail('S3', 'F6 areas thiếu KQ01/KQ02');
    if (!ids(opts.json.trades).has(TRADE_THOCAT)) return fail('S3', 'F6 trades thiếu THO-CAT');
    if (!opts.json.projects.every((p) => p.name) || !opts.json.trades.every((t) => t.name)) return fail('S3', 'F6 thiếu name enrich');
    return ok('S3', `F2={A} F3=baseline(${clear.json.total}) F4=4×400 F5=403/401/scope-ok F6=options scope-đúng`);
  });

  await runStep('S4', 'F7 claim mô phỏng: seed assignment cho A → combo filter mất A, total -1', async () => {
    const before = await api('GET', `/api/v1/job-board?dateFrom=${encodeURIComponent(earlyFrom)}&dateTo=${encodeURIComponent(earlyTo)}&areaId=${AREA_KQ01}&workTypeId=${WT_BTCT}&skill=mine`, workerTok, undefined, true);
    const t0 = before.json.total;
    const ins = psqlT(`INSERT INTO assignments(work_order_id, assignee_type, worker_id, responsible_user_id, source, status) VALUES('${vars.workOrderIds.A}','USER','${SEED_WORKER_ID}','${SEED_WORKER_ID}','SELF_ACCEPT','PENDING_ACCEPTANCE') RETURNING id;`);
    if (/PSQL ERROR/i.test(ins)) return fail('S4', `insert: ${ins}`);
    const after = await api('GET', `/api/v1/job-board?dateFrom=${encodeURIComponent(earlyFrom)}&dateTo=${encodeURIComponent(earlyTo)}&areaId=${AREA_KQ01}&workTypeId=${WT_BTCT}&skill=mine`, workerTok, undefined, true);
    if (codesOf(after).has(vars.workOrderCodes.A)) return fail('S4', 'A vẫn còn sau claim mô phỏng');
    if (after.json.total !== t0 - 1) return fail('S4', `total ${t0}→${after.json.total}, mong -1`);
    return ok('S4', `refresh giữ filter: A biến, total ${t0}→${after.json.total} (claim mô phỏng ở DB — write là #47)`);
  });

  await runStep('S5', 'F8 pagination trên filtered WHERE: page gộp đủ total, total COUNT đúng', async () => {
    const p1 = await api('GET', `/api/v1/job-board?projectId=${PRA}&limit=2&offset=0`, workerTok, undefined, true);
    const p2 = await api('GET', `/api/v1/job-board?projectId=${PRA}&limit=2&offset=2`, workerTok, undefined, true);
    if (p1.status !== 200 || p2.status !== 200) return fail('S5', `pages ${p1.status}/${p2.status}`);
    if (p1.json.total !== p2.json.total) return fail('S5', `total lệch: ${p1.json.total} vs ${p2.json.total}`);
    const union = new Set([...codesOf(p1), ...codesOf(p2)]);
    // Sau S4, A đã bị claim-sim: PRA còn B,C,D,F = 4.
    if (p1.json.total !== 4) return fail('S5', `total PRA=${p1.json.total}, mong 4 (A đã claim-sim)`);
    if (union.size !== 4) return fail('S5', `gộp 2 pages được ${union.size}, mong 4`);
    const unk = await api('GET', `/api/v1/job-board?projectId=${PRA}&foo=1&bar=2`, workerTok, undefined, true);
    if (unk.status !== 200 || unk.json.total !== 4) return fail('S5', `unknown-key → ${unk.status} total=${unk.json?.total}`);
    return ok('S5', `total=4 ổn định 2 pages, unknown-key ignore`);
  });

  await runStep('S6', 'AC7: N GET có filter → audit/notification delta = 0', async () => {
    const a0 = psqlT('SELECT count(*) FROM audit_logs;').trim();
    const n0 = psqlT('SELECT count(*) FROM notifications;').trim();
    const gets = [
      '/api/v1/job-board?limit=20&offset=0',
      `/api/v1/job-board?projectId=${PRA}&skill=mine`,
      `/api/v1/job-board?dateFrom=${encodeURIComponent(earlyFrom)}&dateTo=${encodeURIComponent(earlyTo)}`,
      '/api/v1/job-board/filter-options',
    ];
    for (const g of gets) {
      const r = await api('GET', g, workerTok, undefined, true);
      if (r.status !== 200) return fail('S6', `GET ${g} → ${r.status}`);
    }
    const a1 = psqlT('SELECT count(*) FROM audit_logs;').trim();
    const n1 = psqlT('SELECT count(*) FROM notifications;').trim();
    if (a1 !== a0 || n1 !== n0) return fail('S6', `delta audit ${a0}→${a1}, notif ${n0}→${n1}`);
    return ok('S6', `delta audit=0 notif=0 sau 4 GET có filter`);
  });

  await runStep('S7', 'Expo UI: sheet → skill apply → chips → detail→back giữ filter → empty-filtered → clear', async () => {
    const browser = await chromium.launch({ executablePath: CHROME_PATH, args: ['--no-sandbox'] });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const shot = async (id, desc) => {
        await page.screenshot({ path: path.join(SHOTS, `${id}-${LABEL}.png`) });
        console.log(`  shot ${id}-${LABEL}.png — ${desc}`);
      };
      await page.goto(MOBILE, { waitUntil: 'networkidle', timeout: 60000 });
      await page.getByLabel('email input').fill(WORKER.email);
      await page.getByLabel('password input').fill(WORKER.pass);
      await page.getByLabel('login submit').click();
      await page.getByLabel('view profile').waitFor({ timeout: 30000 });
      await page.getByLabel('view profile').click();
      await page.getByLabel('view job board').waitFor({ timeout: 30000 });
      await page.getByLabel('view job board').click();
      await page.getByLabel('open job board filter').waitFor({ timeout: 30000 });
      await shot('S6-board', 'Job Board baseline trên Expo (sau claim-sim S4: A vắng)');
      let bodyText = await page.content();
      if (/Nhận việc/.test(bodyText)) return fail('S7', 'UI chứa chữ "Nhận việc"');
      // Mở sheet → bật skill=mine → apply.
      await page.getByLabel('open job board filter').click();
      await page.getByLabel('job board filter sheet').waitFor({ timeout: 15000 });
      await shot('S6-sheet', 'FilterSheet mở (sections + toggle + date inputs)');
      await page.getByLabel('filter skill mine toggle').click();
      await page.getByLabel('apply job board filter').click();
      // Chip skill hiện; D (THO-CAT, late) còn; B/C/F vắng.
      await page.getByLabel('remove filter Phù hợp kỹ năng của tôi').waitFor({ timeout: 30000 });
      await shot('S6-filtered', 'Đã apply skill=mine qua UI (chip + list lọc)');
      bodyText = await page.content();
      if (/Nhận việc/.test(bodyText)) return fail('S7', 'UI filtered chứa chữ "Nhận việc"');
      // F9: vào detail D rồi back → filter giữ (chip còn, D còn).
      const codeD = vars.workOrderCodes.D;
      await page.getByLabel(`view detail ${codeD}`).click();
      await page.waitForTimeout(3000);
      await shot('S6-detail', 'Chi tiết WO từ list đã lọc');
      await page.goBack();
      await page.getByLabel('remove filter Phù hợp kỹ năng của tôi').waitFor({ timeout: 30000 });
      await shot('S6-back', 'Back từ detail: filter giữ (chip còn)');
      // F10: date range tương lai xa → empty-filtered (copy riêng, không phải lỗi).
      await page.getByLabel('open job board filter').click();
      await page.getByLabel('job board filter sheet').waitFor({ timeout: 15000 });
      await page.getByLabel('filter date from input').fill('2031-01-01T00:00:00+07:00');
      await page.getByLabel('filter date to input').fill('2031-02-01T00:00:00+07:00');
      await page.getByLabel('apply job board filter').click();
      await page.getByLabel('no jobs matching filter').waitFor({ timeout: 30000 });
      await shot('S6-empty-filtered', 'Empty-filtered ≠ empty-board/lỗi');
      // Clear all → baseline (B,C,D,F).
      await page.getByLabel('clear all job board filters').click();
      await page.getByLabel('open job board filter').waitFor({ timeout: 30000 });
      await shot('S6-cleared', 'Clear all: về baseline');
      return ok('S7', 'UI sheet/apply/chips/back-giữ-filter/empty-filtered/clear OK, không chữ "Nhận việc"');
    } finally {
      await browser.close();
    }
  });

  await runStep('S8', 'cleanup demo theo id + verify rest=0', async () => {
    const idList = Object.values(vars.workOrderIds).filter((id) => typeof id === 'string' && id);
    if (idList.length === 0) return fail('S8', 'không có WO demo để cleanup (S1 fail)');
    const ids = idList.map((id) => `'${id}'`).join(',');
    psqlT(`DELETE FROM assignments WHERE work_order_id IN (${ids});`);
    psqlT(`DELETE FROM work_order_state_history WHERE work_order_id IN (${ids});`);
    psqlT(`DELETE FROM work_orders WHERE id IN (${ids});`);
    psqlT(`DELETE FROM resource_trades WHERE id='${provisionTradeId}';`);
    const rest = psqlT(`SELECT count(*) FROM work_orders WHERE id IN (${ids});`).trim();
    const restTrade = psqlT(`SELECT count(*) FROM resource_trades WHERE id='${provisionTradeId}';`).trim();
    const restAsg = psqlT(`SELECT count(*) FROM assignments WHERE work_order_id IN (${ids});`).trim();
    vars.auditFinal = psqlT('SELECT count(*) FROM audit_logs;').trim();
    vars.rest = rest;
    if (rest !== '0' || restTrade !== '0' || restAsg !== '0') return fail('S8', `rest wo=${rest} trade=${restTrade} asg=${restAsg}`);
    const seeded = psqlT(`SELECT count(*) FROM work_orders WHERE code IN ('PRD-B1-001','WO-PRT-001','WO-PRT-002');`).trim();
    if (seeded !== '3') return fail('S8', `seeded rows còn ${seeded}/3`);
    return ok('S8', `WO rest=0, trade rest=0, seeded còn 3/3, audit rows=${vars.auditFinal}`);
  });

  fs.writeFileSync(VARS_PATH, JSON.stringify({ ...vars, results }, null, 2));
  const passed = results.filter((r) => r.ok).length;
  console.log(`\nTỔNG: ${passed}/${results.length} PASS (label=${LABEL}, cleanup WO rest=${vars.rest || '?'}, audit rows=${vars.auditFinal || '?'})`);
  if (passed !== results.length) process.exitCode = 1;
}

main().catch((e) => { console.error('DRIVER FATAL', e); process.exitCode = 1; });
