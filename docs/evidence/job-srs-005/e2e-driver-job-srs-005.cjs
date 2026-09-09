/**
 * JOB-SRS-005 E2E driver — Xem Job Board (issue #45).
 * Evidence-only script; phạm vi docs/evidence/job-srs-005 — KHÔNG sửa source, KHÔNG commit.
 *
 * Pattern theo docs/evidence/job-srs-004 (playwright-core absolute path,
 * Chrome headless, creds @vinacons.vn, dữ liệu realistic —
 * không E2E%/test%/digits trong dữ liệu hiển thị; uniqueness bằng WO code
 * hệ thống tự sinh + id; cleanup theo id, audit giữ nguyên append-only).
 *
 * Chạy:   node e2e-driver-job-srs-005.cjs [label]
 *           (label optional: `A`/`B`… → vars ghi `e2e-vars-<label>.json`;
 *           stdout nên tee ra `run-<label>.stdout.log` làm artifact riêng từng run)
 * Prereqs:  - stack rebuild từ working tree, `docker compose -f infra/docker/compose.yaml ps`
 *            (api :3000, mobile :19006 healthy)
 *          - playwright-core resolvable: `PLAYWRIGHT_CORE_PATH=<path>/playwright-core`
 *            (thí dụ global `@playwright/mcp`: `<global>/node_modules/@playwright/mcp/node_modules/playwright-core`)
 *          - Chrome: `/usr/bin/google-chrome` hoặc `CHROME_PATH=<path>`
 *          - PM quoc.tran (MANAGER PRA+PRB), WORKER ba.nguyen (WORKER, QC member PRA).
 *            Không dùng outsider login (không rõ password demo của tuan.pham/
 *            hau.le, thang.nguyen LOCKED, không reset password canonical): out-of-scope chứng minh bằng WO demo PRB mà worker
 *            PRA không thấy (real-DB scope isolation).
 *            Creds qua env `E2E_PM_PASS` / `E2E_WORKER_PASS` / `E2E_OUTSIDER_PASS`
 *            (default demo-only trong file).
 *
 * Luồng: S0 login thật (PM + worker, 2 login) + baseline audit/notification →
 * S1 PM tạo 5 WO demo qua API thật + mở board (1 available, 1 gán assignment sau,
 *   1 window tương lai, 1 hết hạn, 1 PRB ngoài scope worker) → S2 worker list đúng tập available + shape →
 * S3 permission/validation matrix → S4 read-path delta (3 GET, audit/notification +0) →
 * S5 claim mô phỏng bằng psql INSERT (claim write là #47) → refresh → item biến →
 * S6 Expo UI login → profile → job board screenshots → cleanup id-based.
 *
 * TRUNG THỰC: (1) in-memory specs (`src/api/test/job-board-list.e2e.spec.ts`) KHÔNG
 * phải real-DB proof — proof thật là driver này; (2) claim được MÔ PHỎNG ở DB vì
 * claim write thuộc #47 — driver chỉ chứng minh refresh semantics.
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
const LABEL = String(process.argv[2] || '').trim();
const VARS_PATH = path.join(__dirname, LABEL ? `e2e-vars-${LABEL}.json` : 'e2e-vars.json');

const PM = { email: 'quoc.tran@vinacons.vn', pass: process.env.E2E_PM_PASS ?? 'E2EPm@2025' };
const WORKER = { email: 'ba.nguyen@vinacons.vn', pass: process.env.E2E_WORKER_PASS ?? 'E2E5W3@2025' };

/** Tiêu đề realistic riêng từng kind — không digits, phân biệt bằng nội dung. */
const TITLE_BY_KIND = {
  AVAIL: 'Trát tường khu thương mại tầng 2',
  ASSIGN: 'Cán nền sảnh chính tầng 1',
  FUTURE: 'Sơn lót tường khu thương mại tầng 2',
  EXPIRED: 'Xây tường ngăn khu thương mại tầng 2',
  OUTSCOPE: 'Trát tường căn hộ mẫu block A tầng 3',
};
const PRA = '10000000-0000-4000-8000-000000000001';
const PRB = '10000000-0000-4000-8000-000000000002';
const AREA_KQ01 = '589c0681-eec2-4a25-ac39-f91f866d507e';
const AREA_GAA03 = '07fe0492-3551-4ff4-96ac-38dbab7f0f93';
const WT_BTCT = 'e2e4b200-0000-4000-8000-0000000000b3';
const TRADE_THOCAT = '11111111-1111-4111-8111-111111111111';
const SEED_WORKER_ID = 'e2e4a000-0000-4000-8000-0000000000a1';

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

const vars = {
  _note: 'Throwaway E2E-only demo credentials (seed/reset per evidence docs). Never production.',
  runLabel: LABEL || null,
  titles: { ...TITLE_BY_KIND },
  workOrderIds: {},
  workOrderCodes: {},
};

async function main() {
  let pmTok, workerTok;
  let auditBefore = '0', notifBefore = '0';

  // ── S0: login thật + baseline ──────────────────────────────────────────
  await runStep('S0', 'login PM/worker qua API thật + baseline audit/notification', async () => {
    const pm = await api('POST', '/api/v1/auth/login', null, { email: PM.email, password: PM.pass }, true);
    const wo = await api('POST', '/api/v1/auth/login', null, { email: WORKER.email, password: WORKER.pass }, true);
    if (pm.status !== 201 && pm.status !== 200) return fail('S0', `PM login ${pm.status}: ${pm.text}`);
    if (wo.status !== 201 && wo.status !== 200) return fail('S0', `worker login ${wo.status}: ${wo.text}`);
    pmTok = pm.json.accessToken; workerTok = wo.json.accessToken;
    if (!pmTok || !workerTok) return fail('S0', 'thiếu accessToken');
    auditBefore = psqlT('SELECT count(*) FROM audit_logs;');
    notifBefore = psqlT('SELECT count(*) FROM notifications;');
    vars.auditBefore = auditBefore.trim(); vars.notifBefore = notifBefore.trim();
    return ok('S0', `PM+worker login OK, audit=${auditBefore.trim()} notif=${notifBefore.trim()}`);
  });

  // ── S1: PM tạo 5 WO demo + mở board ────────────────────────────────────
  await runStep('S1', 'PM tạo 5 WO demo + mở board (API thật)', async () => {
    const specs = [
      { kind: 'AVAIL', projectId: PRA, areaId: AREA_KQ01 },
      { kind: 'ASSIGN', projectId: PRA, areaId: AREA_KQ01 },
      { kind: 'FUTURE', projectId: PRA, areaId: AREA_KQ01 },
      { kind: 'EXPIRED', projectId: PRA, areaId: AREA_KQ01 },
      { kind: 'OUTSCOPE', projectId: PRB, areaId: AREA_GAA03 },
    ];
    for (const { kind, projectId, areaId } of specs) {
      const title = TITLE_BY_KIND[kind];
      const create = await api('POST', '/api/v1/work-orders', pmTok, {
        projectId, workTypeId: WT_BTCT, title, areaId,
        requiredTradeId: TRADE_THOCAT, plannedStartAt: '2026-10-06T01:00:00.000Z',
        plannedEndAt: '2026-10-10T10:00:00.000Z', plannedHeadcount: 5, requestKey: uuid(),
      });
      if (create.status !== 201 && create.status !== 200) return fail('S1', `create ${kind} ${create.status}: ${create.text}`);
      const id = create.json.id;
      vars.workOrderIds[kind] = id; vars.workOrderCodes[kind] = create.json.code;
      const check = await api('GET', `/api/v1/work-orders/${id}/publish-check`, pmTok, undefined, true);
      if (!check.json || check.json.ready !== true) return fail('S1', `${kind} publish-check not ready: ${check.text}`);
      const open = await api('POST', `/api/v1/work-orders/${id}/job-board/open`, pmTok, { expectedVersion: 1 });
      if (open.status !== 200 && open.status !== 201) return fail('S1', `open ${kind} ${open.status}: ${open.text}`);
    }
    // Window FUTURE/EXPIRED chỉnh bằng psql (deterministic, tránh phụ thuộc validation window của #44):
    const now = Date.now();
    const fut = new Date(now + 2 * 3600e3).toISOString();
    const pastFrom = new Date(now - 2 * 3600e3).toISOString();
    const pastUntil = new Date(now - 3600e3).toISOString();
    psqlT(`UPDATE work_orders SET job_board_open_from='${fut}' WHERE id='${vars.workOrderIds.FUTURE}';`);
    psqlT(`UPDATE work_orders SET job_board_open_from='${pastFrom}', job_board_open_until='${pastUntil}' WHERE id='${vars.workOrderIds.EXPIRED}';`);
    // Seed assignment cho ASSIGN (mô phỏng claim — claim write là #47):
    // CHECK 0001:287-317: assignee_type='USER' + worker_id NOT NULL + source='SELF_ACCEPT' + status PENDING_ACCEPTANCE.
    const seed = psqlT(`INSERT INTO assignments(work_order_id, assignee_type, worker_id, responsible_user_id, source, status) VALUES('${vars.workOrderIds.ASSIGN}','USER','${SEED_WORKER_ID}','${SEED_WORKER_ID}','SELF_ACCEPT','PENDING_ACCEPTANCE') RETURNING id;`);
    if (/PSQL ERROR/i.test(seed)) return fail('S1', `seed assignment: ${seed}`);
    const st = psqlT(`SELECT status, job_board_open, job_board_open_from IS NOT NULL, job_board_open_until IS NOT NULL FROM work_orders WHERE id IN ('${vars.workOrderIds.AVAIL}','${vars.workOrderIds.ASSIGN}','${vars.workOrderIds.FUTURE}','${vars.workOrderIds.EXPIRED}') ORDER BY id;`);
    return ok('S1', `5 WO mở board; excerpt:\n${st}`);
  });

  // ── S2: worker list đúng tập available ─────────────────────────────────
  await runStep('S2', 'worker thấy đúng WO AVAIL, 4 WO kia vắng mặt + shape BD6', async () => {
    const list = await api('GET', '/api/v1/job-board?limit=20&offset=0', workerTok, undefined, true);
    if (list.status !== 200) return fail('S2', `list ${list.status}: ${list.text}`);
    const codes = new Set((list.json.data || []).map((d) => d.code));
    const want = vars.workOrderCodes.AVAIL;
    const ban = [vars.workOrderCodes.ASSIGN, vars.workOrderCodes.FUTURE, vars.workOrderCodes.EXPIRED, vars.workOrderCodes.OUTSCOPE];
    if (!codes.has(want)) return fail('S2', `thiếu AVAIL ${want} trong [${[...codes].join(',')}]`);
    const leaked = ban.filter((c) => codes.has(c));
    if (leaked.length) return fail('S2', `lọt row loại trừ: ${leaked.join(',')}`);
    const item = list.json.data.find((d) => d.code === want);
    if ('createdBy' in item) return fail('S2', 'item chứa createdBy (PII thừa)');
    if (item.jobBoard?.state !== 'AVAILABLE') return fail('S2', `state=${item.jobBoard?.state}`);
    if (!item.projectName || !item.workTypeName || !item.areaName || !item.requiredTradeName) {
      return fail('S2', `thiếu refs: ${JSON.stringify({ p: item.projectName, w: item.workTypeName, a: item.areaName, t: item.requiredTradeName })}`);
    }
    const db = psqlT(`SELECT code, status, job_board_open FROM work_orders WHERE id IN ('${vars.workOrderIds.AVAIL}','${vars.workOrderIds.ASSIGN}','${vars.workOrderIds.FUTURE}','${vars.workOrderIds.EXPIRED}') ORDER BY code;`);
    const asg = psqlT(`SELECT work_order_id, status FROM assignments WHERE work_order_id='${vars.workOrderIds.ASSIGN}';`);
    // Pagination: limit=1 → 2 pages gộp đủ total.
    const p1 = await api('GET', '/api/v1/job-board?limit=1&offset=0', workerTok, undefined, true);
    const p2 = await api('GET', '/api/v1/job-board?limit=1&offset=1', workerTok, undefined, true);
    if (p1.status !== 200 || p2.status !== 200) return fail('S2', `pagination ${p1.status}/${p2.status}`);
    if (p1.json.total !== list.json.total) return fail('S2', `total lệch page: ${p1.json.total} vs ${list.json.total}`);
    return ok('S2', `AVAIL hiện, 4 loại trừ vắng; total=${list.json.total}; DB:\n${db}\nassign:\n${asg}`);
  });

  // ── S3: permission + validation matrix ─────────────────────────────────
  await runStep('S3', 'anon 401 / PM thấy OUTSCOPE (scope isolation) / 400 limit / unknown key ignore', async () => {
    const anon = await api('GET', '/api/v1/job-board', null, undefined, true);
    if (anon.status !== 401) return fail('S3', `anon=${anon.status}, mong 401`);
    // Scope isolation: PM (member PRB) thấy WO OUTSCOPE, worker PRA không thấy (đã assert ở S2).
    const pmList = await api('GET', '/api/v1/job-board?limit=50&offset=0', pmTok, undefined, true);
    if (pmList.status !== 200) return fail('S3', `pm list=${pmList.status}`);
    const pmCodes = new Set((pmList.json.data || []).map((d) => d.code));
    if (!pmCodes.has(vars.workOrderCodes.OUTSCOPE)) return fail('S3', 'PM không thấy WO PRB của mình');
    const bad = await api('GET', '/api/v1/job-board?limit=0', workerTok, undefined, true);
    if (bad.status !== 400 || !bad.json?.fieldErrors) return fail('S3', `limit=0 → ${bad.status} ${bad.text}`);
    const unk = await api('GET', '/api/v1/job-board?projectId=00000000-0000-4000-8000-000000000000', workerTok, undefined, true);
    if (unk.status !== 200) return fail('S3', `unknown key → ${unk.status}, mong 200 ignore`);
    return ok('S3', `401/scope-isolation/400-fieldErrors/200-ignore đúng; pm total=${pmList.json.total}`);
  });

  // ── S4: read-path không ghi ────────────────────────────────────────────
  await runStep('S4', '3 GET liên tiếp: audit/notification delta = 0 (AC7)', async () => {
    const a0 = psqlT('SELECT count(*) FROM audit_logs;').trim();
    const n0 = psqlT('SELECT count(*) FROM notifications;').trim();
    for (let i = 0; i < 3; i++) {
      const r = await api('GET', '/api/v1/job-board?limit=20&offset=0', workerTok, undefined, true);
      if (r.status !== 200) return fail('S4', `GET ${i}=${r.status}`);
    }
    const a1 = psqlT('SELECT count(*) FROM audit_logs;').trim();
    const n1 = psqlT('SELECT count(*) FROM notifications;').trim();
    if (a1 !== a0 || n1 !== n0) return fail('S4', `delta audit ${a0}→${a1}, notif ${n0}→${n1}`);
    vars.auditAfterReads = a1; vars.notifAfterReads = n1;
    return ok('S4', `delta audit=0 notif=0 (${a0}→${a1}, ${n0}→${n1})`);
  });

  // ── S5: AC3 claim mô phỏng → refresh item biến ─────────────────────────
  await runStep('S5', 'seed assignment cho AVAIL → worker refresh → item biến, total giảm', async () => {
    const before = await api('GET', '/api/v1/job-board?limit=50&offset=0', workerTok, undefined, true);
    const t0 = before.json.total;
    const ins = psqlT(`INSERT INTO assignments(work_order_id, assignee_type, worker_id, responsible_user_id, source, status) VALUES('${vars.workOrderIds.AVAIL}','USER','${SEED_WORKER_ID}','${SEED_WORKER_ID}','SELF_ACCEPT','PENDING_ACCEPTANCE') RETURNING id;`);
    if (/PSQL ERROR/i.test(ins)) return fail('S5', `insert: ${ins}`);
    const after = await api('GET', '/api/v1/job-board?limit=50&offset=0', workerTok, undefined, true);
    const codes = new Set((after.json.data || []).map((d) => d.code));
    if (codes.has(vars.workOrderCodes.AVAIL)) return fail('S5', 'AVAIL vẫn còn sau claim mô phỏng');
    if (after.json.total !== t0 - 1) return fail('S5', `total ${t0}→${after.json.total}, mong -1`);
    return ok('S5', `AVAIL biến khỏi list, total ${t0}→${after.json.total} (claim mô phỏng ở DB — claim write là #47)`);
  });

  // ── S6: Expo UI + screenshots ──────────────────────────────────────────
  await runStep('S6', 'Expo UI login → profile → job board (screenshots)', async () => {
    const browser = await chromium.launch({ executablePath: CHROME_PATH, args: ['--no-sandbox'] });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const shot = async (id, desc) => {
        await page.screenshot({ path: path.join(SHOTS, `${id}${LABEL ? `-${LABEL}` : ''}.png`) });
        console.log(`  shot ${id}${LABEL ? `-${LABEL}` : ''}.png — ${desc}`);
      };
      await page.goto(MOBILE, { waitUntil: 'networkidle', timeout: 60000 });
      await page.getByLabel('email input').fill(WORKER.email);
      await page.getByLabel('password input').fill(WORKER.pass);
      await shot('S6-login', 'màn hình đăng nhập Expo');
      await page.getByLabel('login submit').click();
      await page.getByLabel('view profile').waitFor({ timeout: 30000 });
      await shot('S6-logged-in', 'sau đăng nhập (có nút hồ sơ)');
      await page.getByLabel('view profile').click();
      await page.getByLabel('view job board').waitFor({ timeout: 30000 });
      await shot('S6-profile', 'hồ sơ có nút Bảng việc');
      await page.getByLabel('view job board').click();
      await page.waitForTimeout(4000);
      await shot('S6-job-board', 'Job Board trên Expo (sau claim mô phỏng S5)');
      const bodyText = await page.content();
      if (/Nhận việc/.test(bodyText)) return fail('S6', 'UI chứa chữ "Nhận việc"');
      return ok('S6', 'Expo UI login→profile→job board OK, không chữ "Nhận việc"');
    } finally {
      await browser.close();
    }
  });

  // ── Cleanup id-based (audit append-only giữ nguyên) ────────────────────
  await runStep('S7', 'cleanup demo theo id + verify rest=0', async () => {
    const idList = Object.values(vars.workOrderIds).filter((id) => typeof id === 'string' && id);
    if (idList.length === 0) return fail('S7', 'không có WO demo để cleanup (S1 fail)');
    const ids = idList.map((id) => `'${id}'`).join(',');
    psqlT(`DELETE FROM assignments WHERE work_order_id IN (${ids});`);
    psqlT(`DELETE FROM work_order_state_history WHERE work_order_id IN (${ids});`);
    psqlT(`DELETE FROM work_orders WHERE id IN (${ids});`);
    const rest = psqlT(`SELECT count(*) FROM work_orders WHERE id IN (${ids});`).trim();
    const auditFinal = psqlT('SELECT count(*) FROM audit_logs;').trim();
    vars.auditFinal = auditFinal; vars.rest = rest;
    if (rest !== '0') return fail('S7', `rest=${rest}`);
    return ok('S7', `WO rest=0, audit rows=${auditFinal}`);
  });

  fs.writeFileSync(VARS_PATH, JSON.stringify({ ...vars, results }, null, 2));
  const passed = results.filter((r) => r.ok).length;
  console.log(`\nTỔNG: ${passed}/${results.length} PASS (label=${LABEL || '-'}, cleanup WO rest=${vars.rest || '?'}, audit rows=${vars.auditFinal || '?'})`);
  if (passed !== results.length) process.exitCode = 1;
}

main().catch((e) => { console.error('DRIVER FATAL', e); process.exitCode = 1; });
