/**
 * PRJ-SRS-007 E2E driver — Vòng đời dữ liệu nền (areas, issue #38).
 * Evidence-only script; phạm vi docs/evidence — KHÔNG commit, KHÔNG sửa source.
 *
 * Chạy:   node e2e-driver-prj-srs-007.cjs
 * Yêu cầu: stack từ working tree (api có areas lifecycle #38: usage/warning,
 *          PRJ_AREA_STATUS_CHANGED, picker /areas/active; web có ProjectAreas
 *          confirm-retire + reason + warning notice);
 *          admin (hoang.anh@vinacons.vn / E2EAdmin@2025) +
 *          pm (quoc.tran@vinacons.vn / E2EPm@2025, MANAGER của P).
 *
 * Seed (seed-prj-srs-007.sql, fixed UUID, ON CONFLICT DO NOTHING):
 *   P DA-PHUOC-LONG 'Khu dân cư Phước Long' (manager quoc.tran; thang WORKER)
 * Areas/work-types/trades/crews/work_orders do driver tạo runtime (API + SQL).
 *
 * Luồng: seed → tạo 3 areas → L1 retire A1 qua UI confirm (badge + audit +
 * reason) → L2 picker /areas/active loại A1 → L3 no-hard-delete (DELETE 404/405
 * + area retired vẫn đọc được) → L4 seed WO OPEN gắn A3 → retire A3 qua UI →
 * usage>0 + warning UI + _warning audit → cleanup WO1 → L5 regression (trades
 * deactivate warning + work-types status/active + crews/workers open-work +
 * audits) → L6 rename A2 (WO cũ giữ FK, kết quả đã lưu không đổi) → cleanup.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { chromium } = require('/home/trung/.npm-global/lib/node_modules/@playwright/mcp/node_modules/playwright-core');

const WEB = 'http://localhost:3001';
const API = 'http://localhost:3000';
const SHOTS = path.join(__dirname, 'shots');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const ADMIN_EMAIL = 'hoang.anh@vinacons.vn';
const ADMIN_PASS = 'E2EAdmin@2025';
const PM_EMAIL = 'quoc.tran@vinacons.vn';
const PM_PASS = 'E2EPm@2025';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const PM_ID = '22222222-2222-4222-8222-222222222222';
const THANH_ID = '33333333-3333-4333-8333-333333333333'; // WORKER canonical (crew leader + open-work)
const PROJ_P = 'b7000001-0001-4000-8000-000000000001';
const CODE_P = 'DA-PHUOC-LONG';
const NAME_P = 'Khu dân cư Phước Long';

const AREA_A1 = { code: 'KHU-THAP-A', name: 'Khu tháp A' };
const AREA_A2 = { code: 'KHU-THAP-B', name: 'Khu tháp B' };
const AREA_A3 = { code: 'KHU-TM-DV', name: 'Khu thương mại – dịch vụ' };
const REASON_L1 = 'Gộp khu tháp A vào khu tháp B (đợt T9/2026)';
const REASON_L4 = 'Tạm ngừng khai thác khu thương mại (đợt T9/2026)';
const RENAME_A2 = 'Khu tháp B – mở rộng (đợt T9/2026)';

const results = [];
function ok(id, note = '') { return { id, ok: true, note }; }
function fail(id, note) { return { id, ok: false, note }; }
async function runStep(id, name, fn) {
  try {
    const r = await fn(id);
    results.push({ ...r, name });
    console.log(`${r.ok ? 'PASS' : 'FAIL'} ${id} ${name}${r.note ? ' :: ' + String(r.note).split('\n')[0] : ''}`);
    if (!r.ok && r.note) console.log(`  detail: ${String(r.note).slice(0, 2000)}`);
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
    ], { encoding: 'utf8', timeout: 15000 }).trim();
  } catch (e) {
    return `PSQL ERROR: ${e.stderr || e.message}`;
  }
}

async function api(method, urlPath, token, body, extraHeaders) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (extraHeaders) Object.assign(headers, extraHeaders);
  const res = await fetch(`${API}${urlPath}`, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, body: json };
}
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16));
}
function rand6() { return Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'); }
async function getToken(email, password) {
  const r = await api('POST', '/api/v1/auth/login', null, { email, password });
  return r.body && r.body.accessToken ? r.body.accessToken : null;
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
function asArray(body) {
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.data)) return body.data;
  return null;
}
function unwrap(body) {
  if (body && typeof body === 'object' && body.data && typeof body.data === 'object' && !Array.isArray(body.data)) {
    return { ...body.data, __raw: body };
  }
  return body || {};
}

/** Cleanup id-based: WO → areas → work_types → resource_trades → trades →
 *  crew_members → crews → members → project P (audit giữ nguyên). */
function cleanupRun(extra) {
  psqlT(`DELETE FROM work_orders WHERE project_id='${PROJ_P}'`);
  psqlT(`DELETE FROM project_areas WHERE project_id='${PROJ_P}'`);
  if (extra && extra.workTypeIds.length) {
    psqlT(`DELETE FROM work_types WHERE id IN (${extra.workTypeIds.map((x) => `'${x}'`).join(',')})`);
  }
  psqlT(`DELETE FROM resource_trades WHERE trade_id IN (SELECT id FROM trades WHERE code LIKE 'NGHE-E2E7-%')`);
  psqlT(`DELETE FROM trades WHERE code LIKE 'NGHE-E2E7-%'`);
  if (extra && extra.crewIds.length) {
    psqlT(`DELETE FROM crew_members WHERE crew_id IN (${extra.crewIds.map((x) => `'${x}'`).join(',')})`);
    psqlT(`DELETE FROM crews WHERE id IN (${extra.crewIds.map((x) => `'${x}'`).join(',')})`);
  }
  psqlT(`DELETE FROM project_members WHERE project_id='${PROJ_P}'`);
  psqlT(`DELETE FROM projects WHERE id='${PROJ_P}'`);
}
function restCount() {
  return psqlT(`SELECT count(*) FROM projects WHERE id='${PROJ_P}'`);
}

/** Retire 1 area qua UI confirm dialog (shared cho L1/L4). */
async function retireViaUI(page, areaName, reason, shotId, shotDesc) {
  const item = page.locator('li', { hasText: areaName });
  await item.getByRole('button', { name: 'Ngừng sử dụng' }).click();
  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor({ timeout: 15000 });
  const dt = (await dialog.textContent()) || '';
  if (!dt.includes(`Ngừng sử dụng khu vực “${areaName}”?`)) {
    return { error: `dialog không hiện confirm đúng area: ${dt.slice(0, 200)}` };
  }
  await page.fill('#area-deactivate-reason', reason);
  await snap(page, `${shotId}-confirm`, `${shotDesc} — dialog + reason`);
  await dialog.getByRole('button', { name: 'Xác nhận ngừng sử dụng' }).click();
  await page.waitForFunction(
    (n) => (document.body.textContent || '').includes(`Đã ngừng sử dụng khu vực “${n}”`),
    areaName,
    { timeout: 25000 },
  );
  const notice = await bodyText(page);
  return { notice };
}

(async () => {
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: '/usr/bin/google-chrome',
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
  } catch (e) {
    console.error('LAUNCH FAIL', e.message);
    process.exit(2);
  }

  const adminToken = await getToken(ADMIN_EMAIL, ADMIN_PASS);
  const pmToken = await getToken(PM_EMAIL, PM_PASS);
  if (!adminToken || !pmToken) {
    console.error(`Không lấy được token (admin=${!!adminToken} pm=${!!pmToken})`);
    await browser.close().catch(() => {});
    process.exit(2);
  }

  // ---- Setup: pre-cleanup + seed + verify ----
  cleanupRun({ workTypeIds: [], crewIds: [] });
  const seedSql = fs.readFileSync(path.join(__dirname, 'seed-prj-srs-007.sql'), 'utf8');
  const seedRun = spawnSync('docker', ['exec', '-i', 'buildflow-postgres-1', 'psql', '-U', 'buildflow', '-d', 'buildflow', '-v', 'ON_ERROR_STOP=1'],
    { input: seedSql, encoding: 'utf8', timeout: 20000 });
  if (seedRun.status !== 0) {
    console.error(`SEED FAIL ${(seedRun.stderr || '').slice(0, 500)}`);
    await browser.close().catch(() => {});
    process.exit(2);
  }
  const seedCheck = psqlT(`SELECT name FROM projects WHERE id='${PROJ_P}'`);
  const memCheck = psqlT(`SELECT count(*) FROM project_members WHERE project_id='${PROJ_P}' AND is_active`);
  console.log(`setup: seed project='${seedCheck}' active_memberships=${memCheck}`);
  if (seedCheck !== NAME_P || memCheck !== '2') {
    console.error('SEED VERIFY FAIL');
    await browser.close().catch(() => {});
    process.exit(2);
  }
  const auditBaseline = psqlT('SELECT count(*) FROM audit_logs');

  // ---- Tạo 3 areas qua API (có PRJ_PROJECT_AREA_ADDED audit) ----
  const areaIds = {};
  for (const a of [AREA_A1, AREA_A2, AREA_A3]) {
    const c = await api('POST', `/api/v1/projects/${PROJ_P}/areas`, pmToken,
      { code: a.code, name: a.name }, { 'X-Correlation-Id': uuid() });
    if (c.status !== 201 && c.status !== 200) {
      console.error(`CREATE AREA FAIL ${a.code} status=${c.status} body=${JSON.stringify(c.body).slice(0, 300)}`);
      await browser.close().catch(() => {});
      process.exit(2);
    }
    areaIds[a.code] = unwrap(c.body).id;
  }
  console.log(`setup: areas A1=${areaIds[AREA_A1.code]} A2=${areaIds[AREA_A2.code]} A3=${areaIds[AREA_A3.code]}`);

  const pmCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pmPage = await pmCtx.newPage();
  pmPage.setDefaultTimeout(30000);
  await loginWeb(pmPage, PM_EMAIL, PM_PASS);
  await pmPage.goto(`${WEB}/projects/${PROJ_P}`, { waitUntil: 'networkidle' });
  const detail0 = await bodyText(pmPage);
  if (!detail0.includes(NAME_P)) {
    console.error(`DETAIL PAGE thiếu tên dự án: ${detail0.slice(0, 300)}`);
    await browser.close().catch(() => {});
    process.exit(2);
  }

  const rt = { workTypeIds: [], crewIds: [] }; // runtime ids cho cleanup

  // ============ L1: retire A1 qua UI confirm ============
  await runStep('L1', 'Retire area qua UI confirm (badge + audit PRJ_AREA_STATUS_CHANGED + reason)', async (id) => {
    const r = await retireViaUI(pmPage, AREA_A1.name, REASON_L1, id, 'L1 retire A1');
    if (r.error) return fail(id, r.error);
    if (!r.notice.includes('lịch sử vẫn được giữ')) {
      return fail(id, `notice sau retire A1 thiếu câu giữ lịch sử: ${r.notice.slice(0, 300)}`);
    }
    const itemText = (await pmPage.locator('li', { hasText: AREA_A1.name }).first().textContent()) || '';
    if (!itemText.includes('Ngừng sử dụng')) return fail(id, `thiếu badge Ngừng sử dụng ở A1: ${itemText.slice(0, 200)}`);
    await snap(pmPage, `${id}-retired`, 'L1 A1 đã retire — badge Ngừng sử dụng');
    const a = await api('GET', `/api/v1/audit-logs?action=PRJ_AREA_STATUS_CHANGED&entityId=${PROJ_P}&limit=20`, adminToken);
    const rows = (a.body && a.body.data) || [];
    const hit = rows.find((x) => JSON.stringify(x.afterData || {}).includes(areaIds[AREA_A1.code]));
    if (!hit) return fail(id, `không thấy audit PRJ_AREA_STATUS_CHANGED cho A1: ${JSON.stringify(a.body).slice(0, 400)}`);
    if (hit.reason !== REASON_L1) return fail(id, `audit reason sai: '${hit.reason}' (mong '${REASON_L1}')`);
    return ok(id, `UI notice + badge Ngừng sử dụng; audit STATUS_CHANGED id=${hit.id} reason đúng`);
  });

  // ============ L2: picker /areas/active loại A1 ============
  await runStep('L2', 'Picker /areas/active chỉ bản ghi còn hoạt động', async (id) => {
    const p = await api('GET', `/api/v1/projects/${PROJ_P}/areas/active`, pmToken);
    if (p.status !== 200) return fail(id, `GET /areas/active status=${p.status}`);
    const arr = asArray(p.body);
    if (!arr) return fail(id, `picker không trả array: ${JSON.stringify(p.body).slice(0, 200)}`);
    const ids = arr.map((x) => x.id);
    if (ids.includes(areaIds[AREA_A1.code])) return fail(id, 'picker vẫn chứa A1 đã retire');
    if (!ids.includes(areaIds[AREA_A2.code]) || !ids.includes(areaIds[AREA_A3.code])) {
      return fail(id, `picker thiếu A2/A3: ${ids.join(',')}`);
    }
    if (arr.some((x) => x.isActive === false)) return fail(id, 'picker chứa row isActive=false');
    return ok(id, `picker n=${arr.length} [A2,A3], loại A1 retired`);
  });

  // ============ L3: no-hard-delete ============
  await runStep('L3', 'Không DELETE endpoint + area retired vẫn resolve ở detail', async (id) => {
    const d = await api('DELETE', `/api/v1/projects/${PROJ_P}/areas/${areaIds[AREA_A1.code]}`, pmToken);
    if (d.status !== 404 && d.status !== 405) {
      return fail(id, `DELETE area status=${d.status} (mong 404/405 — không endpoint xóa)`);
    }
    const l = await api('GET', `/api/v1/projects/${PROJ_P}/areas`, pmToken);
    const arr = asArray(l.body);
    if (!arr) return fail(id, `GET list areas không trả array: ${JSON.stringify(l.body).slice(0, 200)}`);
    const a1 = arr.find((x) => x.id === areaIds[AREA_A1.code]);
    if (!a1) return fail(id, 'A1 retired biến mất khỏi list (mất dữ liệu cũ)');
    if (a1.isActive !== false) return fail(id, 'A1 trong list không còn isActive=false');
    if (a1.name !== AREA_A1.name) return fail(id, `tên A1 đã đổi: ${a1.name}`);
    return ok(id, `DELETE → ${d.status}; A1 retired vẫn đọc đủ (isActive=false, tên nguyên)`);
  });

  // ---- Chuẩn bị L4/L6: work-type qua API + 2 WO qua SQL ----
  const wtCode = `LOAI-E2E7-${rand6()}`;
  const wtc = await api('POST', '/api/v1/work-types', pmToken,
    { code: wtCode, name: 'Loại công việc E2E7 (xây-tô)' }, { 'X-Correlation-Id': uuid() });
  if (wtc.status !== 201 && wtc.status !== 200) {
    console.error(`CREATE WORK-TYPE FAIL status=${wtc.status}`);
    await browser.close().catch(() => {});
    process.exit(2);
  }
  const wtId = unwrap(wtc.body).id;
  rt.workTypeIds.push(wtId);
  const WO1 = 'b7000001-00a1-4000-8000-000000000001';
  const WO2 = 'b7000001-00a2-4000-8000-000000000002';
  const woSql = `INSERT INTO work_orders (id, code, project_id, area_id, work_type_id, title, status, created_by) VALUES
    ('${WO1}', 'WO-007-001', '${PROJ_P}', '${areaIds[AREA_A3.code]}', '${wtId}', 'Xây tường tầng trệt (đợt T9/2026)', 'OPEN', '${ADMIN_ID}'),
    ('${WO2}', 'WO-007-002', '${PROJ_P}', '${areaIds[AREA_A2.code]}', '${wtId}', 'Tô trát mặt ngoài (đợt T9/2026)', 'READY', '${ADMIN_ID}')
    ON CONFLICT DO NOTHING;`;
  const woRun = spawnSync('docker', ['exec', '-i', 'buildflow-postgres-1', 'psql', '-U', 'buildflow', '-d', 'buildflow', '-v', 'ON_ERROR_STOP=1'],
    { input: woSql, encoding: 'utf8', timeout: 20000 });
  if (woRun.status !== 0) {
    console.error(`WO SEED FAIL ${(woRun.stderr || '').slice(0, 300)}`);
    await browser.close().catch(() => {});
    process.exit(2);
  }
  const woCheck = psqlT(`SELECT count(*) FROM work_orders WHERE project_id='${PROJ_P}'`);
  console.log(`setup: work_orders=${woCheck} (WO1 OPEN→A3 cho L4, WO2 READY→A2 cho L6)`);

  // ============ L4: usage warning khi retire area có WO ============
  await runStep('L4', 'Retire area có WO mở → API usage>0 + warning UI + _warning audit', async (id) => {
    await pmPage.goto(`${WEB}/projects/${PROJ_P}`, { waitUntil: 'networkidle' });
    const r = await retireViaUI(pmPage, AREA_A3.name, REASON_L4, id, 'L4 retire A3 có WO');
    if (r.error) return fail(id, r.error);
    if (!r.notice.includes('đang có 1 work order đang hiệu lực')) {
      return fail(id, `notice thiếu warning usage: ${r.notice.slice(0, 300)}`);
    }
    const a = await api('GET', `/api/v1/audit-logs?action=PRJ_AREA_STATUS_CHANGED&entityId=${PROJ_P}&limit=20`, adminToken);
    const rows = (a.body && a.body.data) || [];
    const hit = rows.find((x) => JSON.stringify(x.afterData || {}).includes(areaIds[AREA_A3.code]));
    if (!hit) return fail(id, 'không thấy audit STATUS_CHANGED cho A3');
    if (!JSON.stringify(hit.afterData || {}).includes('_warning')) {
      return fail(id, `audit A3 thiếu _warning: ${JSON.stringify(hit.afterData).slice(0, 300)}`);
    }
    await snap(pmPage, `${id}-warning`, 'L4 notice warning usage>0');
    const del = psqlT(`DELETE FROM work_orders WHERE id='${WO1}'`);
    if (del === 'PSQL ERROR: in') return fail(id, 'cleanup WO1 thất bại');
    return ok(id, `notice 'đang có 1 work order đang hiệu lực'; audit _warning có; WO1 cleanup`);
  });

  // ============ L5: lifecycle regression ============
  await runStep('L5', 'Regression: trades warning + work-types status/active + crews/workers open-work + audits', async (id) => {
    // -- trades: tạo catalog + gắn resource đang hiệu lực → deactivate có warning --
    const tradeCode = `NGHE-E2E7-${rand6()}`;
    const tc = await api('POST', '/api/v1/trades', adminToken,
      { code: tradeCode, name: 'Thợ E2E7', description: 'Ngành nghề seed cho PRJ-SRS-007 L5' },
      { 'X-Correlation-Id': uuid() });
    if (tc.status !== 201 && tc.status !== 200) {
      return fail(id, `tạo trade status=${tc.status} body=${JSON.stringify(tc.body).slice(0, 200)}`);
    }
    const tradeId = unwrap(tc.body).id;
    psqlT(`INSERT INTO resource_trades (resource_type, user_id, trade_id, skill_level, is_active)
           VALUES ('USER', '${PM_ID}', '${tradeId}', 3, true) ON CONFLICT DO NOTHING`);
    const ts = await api('PATCH', `/api/v1/trades/${tradeId}/status`, adminToken,
      { status: 'INACTIVE' }, { 'X-Correlation-Id': uuid() });
    if (ts.status !== 200) return fail(id, `deactivate trade status=${ts.status}`);
    const tb = unwrap(ts.body);
    if (!tb.warning || !String(tb.warning).includes('đang được tham chiếu')) {
      return fail(id, `trade deactivate thiếu warning in-use: ${JSON.stringify(ts.body).slice(0, 300)}`);
    }
    const ta = await api('GET', `/api/v1/audit-logs?action=ORG_TRADE_STATUS_CHANGED&limit=10`, adminToken);
    const trows = (ta.body && ta.body.data) || [];
    const thit = trows.find((x) => x.entityId === tradeId);
    if (!thit) return fail(id, 'không thấy audit ORG_TRADE_STATUS_CHANGED cho trade seed');

    // -- work-types: status + /active --
    const wtCode2 = `LOAI-E2E7-${rand6()}`;
    const wc = await api('POST', '/api/v1/work-types', pmToken,
      { code: wtCode2, name: 'Loại công việc E2E7 (regression)' }, { 'X-Correlation-Id': uuid() });
    if (wc.status !== 201 && wc.status !== 200) {
      return fail(id, `tạo work-type status=${wc.status}`);
    }
    const wtId2 = unwrap(wc.body).id;
    rt.workTypeIds.push(wtId2);
    const ws = await api('POST', `/api/v1/work-types/${wtId2}/status`, pmToken,
      { action: 'DEACTIVATE', reason: 'Tạm ngừng loại công việc (đợt T9/2026)' }, { 'X-Correlation-Id': uuid() });
    if (ws.status !== 200) return fail(id, `work-type DEACTIVATE status=${ws.status}`);
    if (unwrap(ws.body).alreadyInState) return fail(id, 'work-type DEACTIVATE báo alreadyInState sai');
    const wa = await api('GET', '/api/v1/work-types/active', pmToken);
    const warr = asArray(wa.body);
    if (!warr) return fail(id, 'GET /work-types/active không trả array');
    if (warr.some((x) => x.id === wtId2)) return fail(id, '/work-types/active vẫn chứa work-type đã deactivate');
    const wau = await api('GET', `/api/v1/audit-logs?action=PRJ_WORK_TYPE_STATUS_CHANGED&entityId=${wtId2}&limit=5`, adminToken);
    if (!((wau.body && wau.body.data) || []).length) return fail(id, 'không thấy audit PRJ_WORK_TYPE_STATUS_CHANGED');
    // reactivate để cleanup sạch (catalog không rác INACTIVE)
    await api('POST', `/api/v1/work-types/${wtId2}/status`, pmToken,
      { action: 'ACTIVATE' }, { 'X-Correlation-Id': uuid() });

    // -- crews + workers open-work --
    const crewCode = `DOI-E2E7-${rand6()}`;
    const cc = await api('POST', '/api/v1/crews', pmToken,
      { code: crewCode, name: 'Đội E2E7', leaderUserId: THANH_ID }, { 'X-Correlation-Id': uuid() });
    if (cc.status !== 201 && cc.status !== 200) {
      return fail(id, `tạo crew status=${cc.status} body=${JSON.stringify(cc.body).slice(0, 200)}`);
    }
    const crewId = unwrap(cc.body).id;
    rt.crewIds.push(crewId);
    const co = await api('GET', `/api/v1/crews/${crewId}/open-work`, pmToken);
    if (co.status !== 200 || typeof (co.body || {}).openAssignments !== 'number') {
      return fail(id, `crew open-work sai: status=${co.status} body=${JSON.stringify(co.body).slice(0, 200)}`);
    }
    const wo = await api('GET', `/api/v1/workers/${THANH_ID}/open-work`, adminToken);
    if (wo.status !== 200 || typeof (wo.body || {}).openAssignments !== 'number') {
      return fail(id, `worker open-work sai: status=${wo.status} body=${JSON.stringify(wo.body).slice(0, 200)}`);
    }
    const cs = await api('PATCH', `/api/v1/crews/${crewId}/status`, pmToken,
      { action: 'SUSPEND', reason: 'Tạm ngưng đội (đợt T9/2026)' }, { 'X-Correlation-Id': uuid() });
    if (cs.status !== 200) return fail(id, `crew SUSPEND status=${cs.status}`);
    const ca = await api('GET', `/api/v1/audit-logs?action=ORG_CREW_SUSPENDED&limit=10`, adminToken);
    const crows = (ca.body && ca.body.data) || [];
    if (!crows.find((x) => x.entityId === crewId)) return fail(id, 'không thấy audit ORG_CREW_SUSPENDED cho crew seed');
    return ok(id, `trade warning in-use + audit; work-type DEACTIVATE + /active loại + audit; crew openWork=${co.body.openAssignments}, worker openWork=${wo.body.openAssignments}; crew SUSPEND + audit`);
  });

  // ============ L6: rename lan tỏa, kết quả đã lưu không đổi ============
  await runStep('L6', 'Rename area: WO cũ giữ FK, kết quả đã lưu không đổi', async (id) => {
    const before = psqlT(`SELECT area_id::text || '|' || code || '|' || title FROM work_orders WHERE id='${WO2}'`);
    const rp = await api('PATCH', `/api/v1/projects/${PROJ_P}/areas/${areaIds[AREA_A2.code]}`, pmToken,
      { name: RENAME_A2 }, { 'X-Correlation-Id': uuid() });
    if (rp.status !== 200) return fail(id, `rename A2 status=${rp.status} body=${JSON.stringify(rp.body).slice(0, 200)}`);
    if (unwrap(rp.body).name !== RENAME_A2) return fail(id, 'rename không persist tên mới');
    const after = psqlT(`SELECT area_id::text || '|' || code || '|' || title FROM work_orders WHERE id='${WO2}'`);
    if (after !== before) return fail(id, `WO cũ đã đổi sau rename: '${before}' → '${after}'`);
    const [woArea] = after.split('|');
    if (woArea !== areaIds[AREA_A2.code]) return fail(id, `WO area_id lệch: ${woArea}`);
    return ok(id, `A2 → '${RENAME_A2}'; WO-007-002 giữ area_id + code/title ('${after.slice(0, 60)}…')`);
  });

  // ============ Cleanup + vars ============
  cleanupRun(rt);
  const rest = restCount();
  const woRest = psqlT(`SELECT count(*) FROM work_orders WHERE project_id='${PROJ_P}'`);
  const auditFinal = psqlT('SELECT count(*) FROM audit_logs');
  const allOk = results.every((r) => r.ok);
  const vars = {
    _note: 'Throwaway E2E-only demo credentials (seed/reset per evidence docs). Never production.',
    admin: ADMIN_EMAIL,
    pm: PM_EMAIL,
    projectP: PROJ_P,
    codeP: CODE_P,
    areas: { A1: areaIds[AREA_A1.code], A2: areaIds[AREA_A2.code], A3: areaIds[AREA_A3.code] },
    runtime: rt,
    auditBaseline,
    auditFinal,
    rest,
    workOrdersRest: woRest,
    results: results.map((r) => ({ id: r.id, ok: r.ok, note: r.note })),
  };
  fs.writeFileSync(path.join(__dirname, 'e2e-vars.json'), `${JSON.stringify(vars, null, 2)}\n`);
  console.log(`cleanup: projects rest=${rest}, work_orders rest=${woRest}, audit ${auditBaseline}→${auditFinal}`);
  console.log(`TỔNG: ${results.filter((r) => r.ok).length}/${results.length} PASS`);
  await browser.close().catch(() => {});
  process.exit(allOk && rest === '0' && woRest === '0' ? 0 : 1);
})().catch((e) => { console.error('DRIVER FATAL', e); process.exit(2); });
