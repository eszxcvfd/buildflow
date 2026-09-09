/**
 * JOB-SRS-004 E2E driver — Mở và đóng Job Board (issue #44).
 * Evidence-only script; phạm vi docs/evidence/job-srs-004 — KHÔNG sửa source, KHÔNG commit.
 *
 * Pattern theo docs/evidence/job-srs-003 (playwright-core absolute path,
 * Chrome headless, creds @vinacons.vn, dữ liệu realistic ADR-0003 —
 * không E2E%/test% trong dữ liệu hiển thị; uniqueness bằng suffix digits;
 * cleanup theo id, audit giữ nguyên append-only).
 *
 * Chạy:   node e2e-driver-job-srs-004.cjs [label]
 *           (label optional: `A`/`B`… → vars ghi `e2e-vars-<label>.json`;
 *           stdout nên tee ra `run-<label>.stdout.log` làm artifact riêng từng run)
 * Prereqs:  - stack rebuild từ working tree, `docker compose -f infra/docker/compose.yaml ps`
 *            (api :3000, web :3001 healthy)
 *          - playwright-core resolvable: `npm i playwright-core` trong repo (cwd),
 *            hoặc `PLAYWRIGHT_CORE_PATH=<path>/playwright-core`
 *            (thí dụ global `@playwright/mcp`: `<global>/node_modules/@playwright/mcp/node_modules/playwright-core`)
 *          - Chrome: `/usr/bin/google-chrome` hoặc `CHROME_PATH=<path>`
 *          - admin hoang.anh (bypass), PM quoc.tran (MANAGER PRA),
 *            QC ba.nguyen (member PRA, không write-role → 403),
 *            fixtures PRA / KQ-01 / BT-CT / THO-CAT.
 *            Creds qua env `E2E_ADMIN_PASS` / `E2E_PM_PASS` / `E2E_OUTSIDER_PASS`
 *            (default demo-only trong file).
 *
 * Luồng: setup WO DRAFT đủ readiness → S1 PM mở qua UI dialog → DB + badge
 * AVAILABLE + audit/history → S2 double-submit API alreadyOpen (1 audit) →
 * S3 đóng qua UI → badge CLOSED + audit → S4 double-close alreadyClosed →
 * S5 WORKER non-member 403 (UI + API, không nút) → S6 409 conflict UI + Tải lại →
 * S7 validation client (until<=from) → S8 AC3 real-DB (seed assignment ACTIVE
 * → close giữ nguyên row) → S9 AC4 real-DB (2 POST open song song → 1 winner)
 * → cleanup id-based.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function loadPlaywrightCore() {
  const candidates = [
    ...(process.env.PLAYWRIGHT_CORE_PATH ? [process.env.PLAYWRIGHT_CORE_PATH] : []),
    'playwright-core',
    path.join(process.cwd(), 'node_modules', 'playwright-core'),
    path.join(process.cwd(), 'src', 'web', 'node_modules', 'playwright-core'),
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
      `Prereqs: npm i playwright-core trong repo, hoặc PLAYWRIGHT_CORE_PATH=<path>/playwright-core. Gốc: ${lastErr && lastErr.message}`,
  );
}
const { chromium } = loadPlaywrightCore();
const CHROME_PATH = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';

const WEB = 'http://localhost:3001';
const API = 'http://localhost:3000';
const SHOTS = path.join(__dirname, 'shots');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
/** Label run (`A`/`B`…) → artifact vars riêng từng run (F012). */
const LABEL = String(process.argv[2] || '').trim();
const VARS_PATH = path.join(__dirname, LABEL ? `e2e-vars-${LABEL}.json` : 'e2e-vars.json');

const ADMIN = { email: 'hoang.anh@vinacons.vn', pass: process.env.E2E_ADMIN_PASS ?? 'E2EAdmin@2025' };
const PM = { email: 'quoc.tran@vinacons.vn', pass: process.env.E2E_PM_PASS ?? 'E2EPm@2025' };
const WORKER = { email: 'thang.nguyen@vinacons.vn', pass: process.env.E2E_WORKER_PASS ?? 'E2EWorker@2025' };
/** OUTSIDER non-member mọi project → 403 (thang.nguyen canonical bị LOCKED nên không login được). */
const OUTSIDER = { email: 'ba.nguyen@vinacons.vn', pass: process.env.E2E_OUTSIDER_PASS ?? 'E2E5W3@2025' };

const DIG = String(Date.now()).slice(-6);
const TITLE = `Thi công dầm sàn tầng 3 khu KQ-01 ${DIG}`;

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
async function snap(page, id, desc) {
  await page.screenshot({ path: path.join(SHOTS, `${id}.png`), fullPage: false });
  console.log(`  shot ${id}.png — ${desc}`);
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
/** Dòng đầu stdout psql (INSERT…RETURNING in cả tag `INSERT 0 1` ở dòng sau). */
function psqlFirstLine(sql) {
  return String(psqlT(sql)).split('\n')[0].trim();
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
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, body: json };
}
async function getToken(email, password) {
  const r = await api('POST', '/api/v1/auth/login', null, { email, password });
  if (!r.body || !r.body.accessToken) throw new Error(`login failed ${email}: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.accessToken;
}
async function loginWeb(page, email, password) {
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await Promise.all([
    page.waitForURL('**/dashboard', { timeout: 25000 }),
    page.click('button[type="submit"]'),
  ]);
}
async function bodyText(page) {
  return (await page.locator('body').textContent()) || '';
}
const unwrap = (b) => (b && b.data !== undefined && b.id === undefined ? b.data : b);
/** datetime-local "YYYY-MM-DDTHH:MM" từ Date (giờ local của container test). */
function dtLocal(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function main() {
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);

  const adminTok = await getToken(ADMIN.email, ADMIN.pass);
  const pmTok = await getToken(PM.email, PM.pass);
  const workerTok = await getToken(OUTSIDER.email, OUTSIDER.pass);

  // Resolve fixtures PRA / KQ-01 / BT-CT / THO-CAT qua API thật.
  const projects = await api('GET', '/api/v1/projects', adminTok, undefined, true);
  const list = Array.isArray(projects.body) ? projects.body : (projects.body.data || []);
  const pra = list.find((p) => p.code === 'PRA');
  if (!pra) throw new Error(`missing PRA: ${JSON.stringify(list.map((p) => p.code))}`);
  const areas = await api('GET', `/api/v1/projects/${pra.id}/areas?activeOnly=true`, adminTok, undefined, true);
  const kq01 = (areas.body.data || []).find((a) => a.code === 'KQ-01');
  const wtypes = await api('GET', '/api/v1/work-types/active', adminTok, undefined, true);
  const btct = (wtypes.body.data || []).find((w) => w.code === 'BT-CT');
  const trades = await api('GET', '/api/v1/trades?limit=100', adminTok, undefined, true);
  const thocat = ((trades.body.data || trades.body) || []).find((t) => t.code === 'THO-CAT');
  if (!kq01 || !btct || !thocat) throw new Error('missing fixtures KQ-01/BT-CT/THO-CAT');
  console.log(`fixtures PRA=${pra.id} KQ-01=${kq01.id} BT-CT=${btct.id} THO-CAT=${thocat.id}`);

  const now = new Date();
  // Cửa sổ đã mở (from quá khứ 1h, until +30d) → badge AVAILABLE sau khi mở.
  // datetime-local chỉ chính xác đến phút → zero giây/ms để replay khớp instant.
  const fromD = new Date(now.getTime() - 3600 * 1000);
  fromD.setSeconds(0, 0);
  const untilD = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
  untilD.setSeconds(0, 0);
  const pad2 = (n) => String(n).padStart(2, '0');
  const dtWall = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const FROM_ISO = new Date(dtWall(fromD)).toISOString();
  const UNTIL_ISO = new Date(dtWall(untilD)).toISOString();

  let woId = null;
  let woCode = null;
  let ver = null;
  const getWO = async (tok) => unwrap((await api('GET', `/api/v1/work-orders/${woId}`, tok, undefined, true)).body);
  const openAPI = (tok, payload) => api('POST', `/api/v1/work-orders/${woId}/job-board/open`, tok, payload);
  const closeAPI = (tok, payload) => api('POST', `/api/v1/work-orders/${woId}/job-board/close`, tok, payload);
  const dbRow = () => psqlT(
    `SELECT job_board_open||'|'||status||'|'||version FROM work_orders WHERE id='${woId}';`);
  const auditCount = (action) => psqlT(
    `SELECT count(*) FROM audit_logs WHERE entity_id='${woId}' AND action='${action}';`);
  const historyCount = () => psqlT(
    `SELECT count(*) FROM work_order_state_history WHERE work_order_id='${woId}';`);

  // S0 — tạo WO DRAFT đủ readiness (schedule + trade THO-CAT khớp BT-CT).
  await runStep('S0', 'setup WO DRAFT đủ readiness (API admin)', async (id) => {
    const c = await api('POST', '/api/v1/work-orders', adminTok, {
      projectId: pra.id, workTypeId: btct.id, areaId: kq01.id,
      requiredTradeId: thocat.id,
      title: TITLE, description: `Mô tả dầm sàn tầng 3 ${DIG}`,
      plannedStartAt: '2026-10-06T01:00:00.000Z', plannedEndAt: '2026-10-10T10:00:00.000Z',
    });
    if (c.status !== 201) return fail(id, `POST create status=${c.status}: ${JSON.stringify(c.body)}`);
    woId = c.body.id; woCode = c.body.code; ver = c.body.version ?? 1;
    const chk = await api('GET', `/api/v1/work-orders/${woId}/publish-check`, adminTok, undefined, true);
    if (!chk.body.ready) return fail(id, `publish-check chưa ready: ${JSON.stringify(chk.body.unmet)}`);
    return ok(id, `WO ${woCode} DRAFT version ${ver}, publish-check ready`);
  });

  // S1 — PM mở Job Board qua UI dialog → badge AVAILABLE + DB + audit + history.
  await runStep('S1', 'PM mở Job Board qua UI dialog → badge AVAILABLE', async (id) => {
    await loginWeb(page, PM.email, PM.pass);
    // Shot loading: goto commit rồi chụp ngay (bắt trạng thái "Đang tải" nếu kịp).
    await page.goto(`${WEB}/work-orders/${woId}`, { waitUntil: 'commit' });
    await page.screenshot({ path: path.join(SHOTS, 'S1-loading.png'), fullPage: false });
    console.log('  shot S1-loading.png — trang detail ngay sau commit (loading nếu kịp)');
    await page.waitForFunction((t) => document.body.textContent.includes(t), TITLE, { timeout: 25000 });
    let t = await bodyText(page);
    if (!t.includes('Đã đóng')) return fail(id, 'badge ban đầu kỳ vọng "Đã đóng"');
    const openBtn = page.getByRole('button', { name: 'Mở Job Board', exact: true });
    if ((await openBtn.count()) === 0) return fail(id, 'không thấy nút Mở Job Board (PM, DRAFT)');
    await openBtn.click();
    await page.waitForFunction(() => document.body.textContent.includes('Xác nhận mở'), { timeout: 15000 });
    await page.fill('#wojb-from', dtLocal(fromD));
    await page.fill('#wojb-until', dtLocal(untilD));
    await snap(page, 'S1-dialog-filled', 'dialog Mở đã điền cửa sổ');
    await page.getByRole('button', { name: 'Xác nhận mở', exact: true }).click();
    await page.waitForFunction(() => document.body.textContent.includes('Đang nhận việc'), { timeout: 25000 });
    await snap(page, 'S1-opened', 'detail sau khi mở: badge Đang nhận việc');
    const g = await getWO(pmTok);
    ver = g.version;
    if (g.status !== 'OPEN') return fail(id, `status kỳ vọng OPEN: ${g.status}`);
    if (!g.jobBoard || g.jobBoard.state !== 'AVAILABLE') {
      return fail(id, `jobBoard.state kỳ vọng AVAILABLE: ${JSON.stringify(g.jobBoard)}`);
    }
    const row = dbRow();
    if (row !== `true|OPEN|${ver}`) return fail(id, `DB row kỳ vọng true|OPEN|${ver}: ${row}`);
    if (ver !== 2) return fail(id, `version kỳ vọng 2, được ${ver}`);
    if (auditCount('JOB_BOARD_OPENED') !== '1') return fail(id, `audit OPENED kỳ vọng 1`);
    if (historyCount() !== '1') return fail(id, `state_history kỳ vọng 1 row DRAFT→OPEN`);
    // F012 — excerpt DB values (copy vào E2E.md).
    console.log(`  db audit: ${psqlT(`SELECT actor_user_id||'|'||action||'|'||created_at FROM audit_logs WHERE entity_id='${woId}' AND action='JOB_BOARD_OPENED';`)}`);
    console.log(`  db audit before→after: ${psqlT(`SELECT before_data::text||' >>> '||after_data::text FROM audit_logs WHERE entity_id='${woId}' AND action='JOB_BOARD_OPENED';`)}`);
    console.log(`  db history: ${psqlT(`SELECT from_status||'→'||to_status||'|'||changed_by FROM work_order_state_history WHERE work_order_id='${woId}';`)}`);
    return ok(id, `200 OPEN+AVAILABLE, version 1→2, audit OPENED=1, history=1`);
  });

  // S2 — double-submit cùng window qua API → alreadyOpen, version + audit giữ nguyên.
  await runStep('S2', 'double-submit cùng window → alreadyOpen, 1 audit', async (id) => {
    const v0 = (await getWO(pmTok)).version;
    const r = await openAPI(pmTok, { jobBoardOpenFrom: FROM_ISO, jobBoardOpenUntil: UNTIL_ISO });
    if (r.status !== 200) return fail(id, `replay status=${r.status}: ${JSON.stringify(r.body)}`);
    if (!unwrap(r.body).alreadyOpen && r.body.alreadyOpen !== true) {
      const b = unwrap(r.body);
      if (b.alreadyOpen !== true) return fail(id, `thiếu alreadyOpen: ${JSON.stringify(r.body).slice(0, 300)}`);
    }
    const v1 = (await getWO(pmTok)).version;
    if (v1 !== v0) return fail(id, `version đổi sau replay (${v0}→${v1}) — phải giữ nguyên`);
    if (auditCount('JOB_BOARD_OPENED') !== '1') return fail(id, 'audit OPENED tăng sau replay — phải giữ 1');
    return ok(id, `200 alreadyOpen, version giữ ${v0}, audit OPENED=1`);
  });

  // S3 — đóng qua UI → badge CLOSED + DB + audit (assignment không đụng — không có).
  await runStep('S3', 'đóng Job Board qua UI → badge Đã đóng', async (id) => {
    await page.goto(`${WEB}/work-orders/${woId}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.body.textContent.includes('Đang nhận việc'), { timeout: 25000 });
    await page.getByRole('button', { name: 'Đóng Job Board', exact: true }).click();
    await page.waitForFunction(() => document.body.textContent.includes('Xác nhận đóng'), { timeout: 15000 });
    await snap(page, 'S3-close-confirm', 'confirm đóng + note không hủy phân công');
    await page.getByRole('button', { name: 'Xác nhận đóng', exact: true }).click();
    await page.waitForFunction(() => document.body.textContent.includes('Đã đóng'), { timeout: 25000 });
    await snap(page, 'S3-closed', 'detail sau khi đóng: badge Đã đóng');
    const g = await getWO(pmTok);
    ver = g.version;
    if (g.status !== 'READY') return fail(id, `close OPEN→READY kỳ vọng, được ${g.status}`);
    if (!g.jobBoard || g.jobBoard.state !== 'CLOSED' || g.jobBoard.open !== false) {
      return fail(id, `jobBoard kỳ vọng closed: ${JSON.stringify(g.jobBoard)}`);
    }
    const row = dbRow();
    if (row !== `false|READY|${ver}`) return fail(id, `DB row kỳ vọng false|READY|${ver}: ${row}`);
    if (auditCount('JOB_BOARD_CLOSED') !== '1') return fail(id, 'audit CLOSED kỳ vọng 1');
    console.log(`  db audit: ${psqlT(`SELECT actor_user_id||'|'||action||'|'||created_at FROM audit_logs WHERE entity_id='${woId}' AND action='JOB_BOARD_CLOSED';`)}`);
    console.log(`  db audit before→after: ${psqlT(`SELECT before_data::text||' >>> '||after_data::text FROM audit_logs WHERE entity_id='${woId}' AND action='JOB_BOARD_CLOSED';`)}`);
    return ok(id, `200 READY+CLOSED, version→${ver}, audit CLOSED=1`);
  });

  // S4 — double-close qua API → alreadyClosed.
  await runStep('S4', 'double-close → alreadyClosed, không audit mới', async (id) => {
    const r = await closeAPI(pmTok, {});
    if (r.status !== 200) return fail(id, `status=${r.status}: ${JSON.stringify(r.body)}`);
    if (unwrap(r.body).alreadyClosed !== true) return fail(id, `thiếu alreadyClosed: ${JSON.stringify(r.body).slice(0, 300)}`);
    if (auditCount('JOB_BOARD_CLOSED') !== '1') return fail(id, 'audit CLOSED tăng sau replay — phải giữ 1');
    return ok(id, '200 alreadyClosed, audit CLOSED=1');
  });

  // S5 — QC member (không write-role): UI thấy badge nhưng KHÔNG nút +
  // API open/close 403 (server mới là lớp bảo mật thật).
  // (Gate WORKER/VIEWER-member ẩn nút cũng phủ bởi web unit spec
  // WorkOrderJobBoardCard canManage=false; WORKER canonical bị LOCKED.)
  await runStep('S5', 'QC member: UI không nút + API open/close 403', async (id) => {
    const wCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const wPage = await wCtx.newPage();
    wPage.setDefaultTimeout(30000);
    await loginWeb(wPage, OUTSIDER.email, OUTSIDER.pass);
    await wPage.goto(`${WEB}/work-orders/${woId}`, { waitUntil: 'networkidle' });
    await wPage.waitForFunction((t) => document.body.textContent.includes(t), TITLE, { timeout: 25000 });
    await snap(wPage, 'S5-no-buttons', 'QC member: thấy badge, không nút board');
    const t = await bodyText(wPage);
    await wCtx.close();
    if (!t.includes('Job Board')) {
      return fail(id, 'QC member không thấy card Job Board');
    }
    if (t.includes('Mở Job Board') || t.includes('Đóng Job Board')) {
      return fail(id, 'QC member vẫn thấy nút board (canManage gate vỡ)');
    }
    const r = await openAPI(workerTok, { jobBoardOpenFrom: FROM_ISO });
    if (r.status !== 403) return fail(id, `API open kỳ vọng 403, được ${r.status}: ${JSON.stringify(r.body)}`);
    const r2 = await closeAPI(workerTok, {});
    if (r2.status !== 403) return fail(id, `API close kỳ vọng 403, được ${r2.status}: ${JSON.stringify(r2.body)}`);
    return ok(id, 'UI badge không nút; API open+close 403');
  });

  // S6 — 409 conflict qua UI: tab cũ submit sau khi version bump → Alert + Tải lại.
  await runStep('S6', '409 conflict UI: dialog cũ → notice + Tải lại', async (id) => {
    // Mở lại board qua API để có badge AVAILABLE (version N).
    const ro = await openAPI(pmTok, { jobBoardOpenFrom: FROM_ISO, jobBoardOpenUntil: UNTIL_ISO });
    if (ro.status !== 200) return fail(id, `re-open status=${ro.status}: ${JSON.stringify(ro.body)}`);
    ver = unwrap(ro.body).version;
    await page.goto(`${WEB}/work-orders/${woId}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.body.textContent.includes('Đang nhận việc'), { timeout: 25000 });
    // Bump version qua API (PATCH description) → UI đang giữ version cũ.
    const bump = await api('PATCH', `/api/v1/work-orders/${woId}`, pmTok, {
      description: `Bump làm cũ UI ${DIG}`,
    });
    if (bump.status !== 200) return fail(id, `bump status=${bump.status}: ${JSON.stringify(bump.body)}`);
    ver = unwrap(bump.body).version;
    await page.getByRole('button', { name: 'Đóng Job Board', exact: true }).click();
    await page.waitForFunction(() => document.body.textContent.includes('Xác nhận đóng'), { timeout: 15000 });
    await page.getByRole('button', { name: 'Xác nhận đóng', exact: true }).click();
    await page.waitForFunction(() => document.body.textContent.includes('Tải lại'), { timeout: 15000 });
    await snap(page, 'S6-conflict', 'notice 409 + nút Tải lại');
    await page.getByRole('button', { name: 'Tải lại', exact: true }).click();
    await page.waitForFunction(() => document.body.textContent.includes('Đang nhận việc'), { timeout: 25000 });
    return ok(id, `UI hiện notice 409 + Tải lại (version hiện tại ${ver})`);
  });

  // S7 — validation client: until <= from → lỗi đúng input, không gọi API.
  await runStep('S7', 'validation: until <= from → lỗi đúng input', async (id) => {
    // Đóng board trước để dialog mở hiện lại (dùng version mới nhất).
    const g0 = await getWO(pmTok);
    const rc = await closeAPI(pmTok, { expectedVersion: g0.version });
    if (rc.status !== 200) return fail(id, `close setup status=${rc.status}`);
    await page.goto(`${WEB}/work-orders/${woId}`, { waitUntil: 'networkidle' });
    await page.waitForFunction((t) => document.body.textContent.includes(t), TITLE, { timeout: 25000 });
    await page.getByRole('button', { name: 'Mở Job Board', exact: true }).click();
    await page.waitForFunction(() => document.body.textContent.includes('Xác nhận mở'), { timeout: 15000 });
    await page.fill('#wojb-from', dtLocal(untilD));
    await page.fill('#wojb-until', dtLocal(fromD));
    await page.getByRole('button', { name: 'Xác nhận mở', exact: true }).click();
    await page.waitForFunction(
      () => document.body.textContent.includes('Thời điểm kết thúc phải sau thời điểm bắt đầu'),
      { timeout: 15000 },
    );
    await snap(page, 'S7-validation', 'lỗi validation đúng input Đến');
    await page.getByRole('button', { name: 'Hủy', exact: true }).click();
    return ok(id, 'client-validate until>from, lỗi đúng input, không gọi API');
  });

  // S8 — AC3 real-DB: seed assignment ACTIVE → close → assignments row nguyên trạng.
  await runStep('S8', 'AC3 real-DB: close không hủy assignment (row nguyên trạng)', async (id) => {
    const c = await api('POST', '/api/v1/work-orders', pmTok, {
      projectId: pra.id, workTypeId: btct.id, areaId: kq01.id,
      requiredTradeId: thocat.id,
      title: `${TITLE} S8`, description: `AC3 real-DB ${DIG}`,
      plannedStartAt: '2026-10-06T01:00:00.000Z', plannedEndAt: '2026-10-10T10:00:00.000Z',
    });
    if (c.status !== 201) return fail(id, `POST create status=${c.status}: ${JSON.stringify(c.body)}`);
    const w2 = c.body.id;
    const cleanupW2 = () => {
      psqlT(`DELETE FROM assignments WHERE work_order_id='${w2}';`);
      psqlT(`DELETE FROM work_order_state_history WHERE work_order_id='${w2}';`);
      psqlT(`DELETE FROM work_orders WHERE id='${w2}';`);
    };
    const o = await api('POST', `/api/v1/work-orders/${w2}/job-board/open`, pmTok, {
      jobBoardOpenFrom: FROM_ISO, jobBoardOpenUntil: UNTIL_ISO,
    });
    if (o.status !== 200) { cleanupW2(); return fail(id, `open setup status=${o.status}: ${JSON.stringify(o.body)}`); }
    const qcId = psqlFirstLine(`SELECT id FROM users WHERE email='${OUTSIDER.email}';`);
    if (!/^[0-9a-f-]{36}$/i.test(qcId)) { cleanupW2(); return fail(id, `không resolve được user id cho seed: ${qcId}`); }
    const seedRow = psqlFirstLine(
      `INSERT INTO assignments (work_order_id, assignee_type, worker_id, responsible_user_id, source, status) ` +
      `VALUES ('${w2}','USER','${qcId}','${qcId}','DIRECT_ASSIGNMENT','ACTIVE') RETURNING id;`);
    if (!/^[0-9a-f-]{36}$/i.test(seedRow)) { cleanupW2(); return fail(id, `seed assignment thất bại: ${seedRow}`); }
    const before = psqlT(
      `SELECT status||'|'||assigned_at||'|'||coalesce(ended_at::text,'null')||'|'||coalesce(responded_at::text,'null') ` +
      `FROM assignments WHERE work_order_id='${w2}';`);
    const cl = await api('POST', `/api/v1/work-orders/${w2}/job-board/close`, pmTok, {});
    if (cl.status !== 200) { cleanupW2(); return fail(id, `close status=${cl.status}: ${JSON.stringify(cl.body)}`); }
    const g = unwrap((await api('GET', `/api/v1/work-orders/${w2}`, pmTok, undefined, true)).body);
    const after = psqlT(
      `SELECT status||'|'||assigned_at||'|'||coalesce(ended_at::text,'null')||'|'||coalesce(responded_at::text,'null') ` +
      `FROM assignments WHERE work_order_id='${w2}';`);
    console.log(`  assignment before: ${before}`);
    console.log(`  assignment after:  ${after}`);
    cleanupW2();
    if (before !== after) return fail(id, 'assignments row ĐỔI sau close — phải nguyên trạng');
    if (g.status !== 'READY') return fail(id, `close OPEN→READY kỳ vọng, được ${g.status}`);
    if (!g.jobBoard || g.jobBoard.state !== 'ASSIGNED' || g.jobBoard.hasActiveAssignment !== true) {
      return fail(id, `badge kỳ vọng ASSIGNED: ${JSON.stringify(g.jobBoard)}`);
    }
    return ok(id, `close giữ assignment ACTIVE nguyên trạng (status/assigned_at/ended_at/responded_at)`);
  });

  // S9 — AC4 real-DB: 2 POST open song song → đúng 1 mutate + audit==1 + version+1 một lần.
  await runStep('S9', 'AC4 real-DB: concurrent open → 1 winner', async (id) => {
    const c = await api('POST', '/api/v1/work-orders', pmTok, {
      projectId: pra.id, workTypeId: btct.id, areaId: kq01.id,
      requiredTradeId: thocat.id,
      title: `${TITLE} S9`, description: `AC4 real-DB ${DIG}`,
      plannedStartAt: '2026-10-06T01:00:00.000Z', plannedEndAt: '2026-10-10T10:00:00.000Z',
    });
    if (c.status !== 201) return fail(id, `POST create status=${c.status}: ${JSON.stringify(c.body)}`);
    const w3 = c.body.id;
    const cleanupW3 = () => {
      psqlT(`DELETE FROM work_order_state_history WHERE work_order_id='${w3}';`);
      psqlT(`DELETE FROM work_orders WHERE id='${w3}';`);
    };
    const body = { jobBoardOpenFrom: FROM_ISO, jobBoardOpenUntil: UNTIL_ISO };
    const [a, b] = await Promise.all([
      api('POST', `/api/v1/work-orders/${w3}/job-board/open`, pmTok, body),
      api('POST', `/api/v1/work-orders/${w3}/job-board/open`, pmTok, body),
    ]);
    console.log(`  statuses: ${a.status},${b.status} alreadyOpen: ${unwrap(a.body).alreadyOpen},${unwrap(b.body).alreadyOpen}`);
    const row = psqlT(`SELECT status||'|'||job_board_open||'|'||version FROM work_orders WHERE id='${w3}';`);
    const ac = psqlT(`SELECT count(*) FROM audit_logs WHERE entity_id='${w3}' AND action='JOB_BOARD_OPENED';`);
    console.log(`  db row: ${row} auditOPENED: ${ac}`);
    cleanupW3();
    if (a.status !== 200 || b.status !== 200) {
      return fail(id, `kỳ vọng 200+200, được ${a.status}+${b.status}: ${JSON.stringify([a.body, b.body]).slice(0, 400)}`);
    }
    const replays = [a.body, b.body].filter((x) => unwrap(x).alreadyOpen === true).length;
    if (replays !== 1) return fail(id, `kỳ vọng đúng 1 alreadyOpen (1 winner + 1 replay), được ${replays}`);
    if (row !== 'OPEN|true|2') return fail(id, `DB row kỳ vọng OPEN|true|2: ${row}`);
    if (ac !== '1') return fail(id, `audit OPENED kỳ vọng 1: ${ac}`);
    return ok(id, `200+200, 1 winner + 1 alreadyOpen, version 1→2 một lần, audit=1`);
  });

  await browser.close();

  // Cleanup id-based (audit giữ nguyên append-only; history FK trước WO).
  if (woId) {
    psqlT(`DELETE FROM work_order_state_history WHERE work_order_id='${woId}';`);
    psqlT(`DELETE FROM work_orders WHERE id='${woId}';`);
  }
  const rest = psqlT(`SELECT count(*) FROM work_orders WHERE title LIKE '%${DIG}%';`);
  const auditFinal = psqlT(`SELECT count(*) FROM audit_logs WHERE entity_id='${woId}';`);
  const vars = {
    _note: 'Throwaway E2E-only demo credentials (seed/reset per evidence docs). Never production.',
    digits: DIG,
    title: TITLE,
    workOrderId: woId,
    workOrderCode: woCode,
    praId: pra ? pra.id : null,
    auditRows: (auditFinal || '').trim(),
    rest: rest.trim(),
    results: results.map((r) => ({ id: r.id, ok: r.ok, note: r.note })),
  };
  fs.writeFileSync(VARS_PATH, `${JSON.stringify(vars, null, 2)}\n`);

  const passed = results.filter((r) => r.ok).length;
  console.log(`\nTỔNG: ${passed}/${results.length} PASS (digits=${DIG}, code=${woCode}, cleanup WO rest=${rest.trim()}, audit rows=${(auditFinal || '').trim()})`);
  if (passed !== results.length || rest.trim() !== '0') process.exitCode = 1;
}

main().catch((e) => { console.error('DRIVER FATAL:', e); process.exit(2); });
