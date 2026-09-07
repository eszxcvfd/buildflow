/**
 * PRJ-SRS-003 E2E driver — Khu vực/hạng mục dự án (issue #34).
 * Evidence-only script; phạm vi docs/evidence — KHÔNG sửa source.
 *
 * Chạy:   node e2e-driver-prj-003.cjs
 * Yêu cầu: stack rebuild từ working tree (api có POST|GET /projects/:id/areas +
 *          PATCH /projects/:id/areas/:areaId, đã apply migration 0005;
 *          web có ProjectAreas trong ProjectDetail);
 *          admin (E2EAdmin@2025) + pm (E2EPm@2025) + worker1 (E2EWorker@2025).
 *
 * Quy ước: mã E2E3-% (cleanup đầu/cuối run, audit giữ nguyên — append-only).
 * Lưu ý DB: audit_logs có guard cấm DELETE/UPDATE + unique từng phần
 * (correlation_id, action) → mỗi request kèm correlation dùng UUID mới.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('/home/trung/.npm-global/lib/node_modules/@playwright/mcp/node_modules/playwright-core');

const WEB = 'http://localhost:3001';
const API = 'http://localhost:3000';
const SHOTS = path.join(__dirname, 'shots');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASS = process.env.E2E_ADMIN_PASS ?? 'E2EAdmin@2025';
const PM_EMAIL = 'pm@example.com';
const PM_PASS = process.env.E2E_PM_PASS ?? 'E2EPm@2025';
const W1_EMAIL = 'worker1@example.com';
const W1_PASS = process.env.E2E_WORKER_PASS ?? 'E2EWorker@2025';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const PM_ID = '22222222-2222-4222-8222-222222222222';
const W1_ID = '33333333-3333-4333-8333-333333333333';

const CODE_A = 'E2E3-A';
const CODE_B = 'E2E3-B';
const START = '2026-10-01';
const END = '2027-03-31';
const NAME_ALPHA = 'Khu E2E3 Alpha';
const NAME_ALPHA2 = 'Khu E2E3 Alpha Đổi Tên';
const NAME_BETA = 'Khu E2E3 Beta';

const results = [];
function step(id, name, fn) {
  return async () => {
    try {
      const r = await fn(id);
      results.push(r);
      console.log(`${r.ok ? 'PASS' : 'FAIL'} ${id} ${name}${r.note ? ' :: ' + String(r.note).split('\n')[0] : ''}`);
      if (!r.ok && r.note) console.log(`  detail: ${String(r.note).slice(0, 2000)}`);
      return r;
    } catch (err) {
      results.push({ id, name, ok: false, note: err && err.message ? err.message : String(err) });
      console.log(`ERROR ${id} ${name} :: ${err && err.message ? err.message : err}`);
      return results[results.length - 1];
    }
  };
}
async function snap(page, id, desc) {
  await page.screenshot({ path: path.join(SHOTS, `${id}.png`), fullPage: false });
  console.log(`  shot ${id}.png — ${desc}`);
}
const ok = (id, note = '') => ({ id, ok: true, note });
const fail = (id, note) => ({ id, ok: false, note });

function psqlT(sql) {
  try {
    return execFileSync('docker', [
      'exec', 'buildflow-postgres-1', 'psql', '-U', 'buildflow', '-d', 'buildflow', '-t', '-A', '-c', sql,
    ], { encoding: 'utf8', timeout: 15000 }).trim();
  } catch (e) {
    return `PSQL ERROR: ${e.stderr || e.message}`;
  }
}

async function api(method, urlPath, token, body) {
  const headers = { Accept: 'application/json', 'X-Correlation-Id': uuid() };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${urlPath}`, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, body: json };
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
async function getToken(email, password) {
  const r = await api('POST', '/api/v1/auth/login', null, { email, password });
  return r.body && r.body.accessToken ? r.body.accessToken : null;
}
async function bodyText(page) {
  return (await page.locator('body').textContent()) || '';
}
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16));
}
function runCleanup() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'seed-003.sql'), 'utf8');
    execFileSync('docker', ['exec', '-i', 'buildflow-postgres-1', 'psql', '-U', 'buildflow', '-d', 'buildflow', '-v', 'ON_ERROR_STOP=1'],
      { input: sql, encoding: 'utf8', timeout: 20000 });
  } catch (e) {
    console.log(`cleanup WARN ${(e.stderr || e.message || '').slice(0, 200)}`);
  }
}
async function createProject(token, code) {
  const r = await api('POST', '/api/v1/projects', token, {
    code, name: `Công trình ${code}`, address: `Số 1, đường ${code}`,
    plannedStartDate: START, plannedEndDate: END, managerId: W1_ID,
  });
  return r;
}
async function gotoDetail(page, id) {
  await page.goto(`${WEB}/projects/${id}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    () => (document.body.textContent || '').includes('Khu vực / Hạng mục'),
    { timeout: 25000 });
  // Đợi list areas load xong (hết skeleton loading).
  await page.waitForFunction(
    () => !(document.body.textContent || '').includes('Đang tải danh sách khu vực…'),
    { timeout: 25000 });
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
  const w1Token = await getToken(W1_EMAIL, W1_PASS);
  if (!adminToken || !pmToken || !w1Token) {
    console.error(`Không lấy được token (admin=${!!adminToken} pm=${!!pmToken} w1=${!!w1Token})`);
    await browser.close().catch(() => {});
    process.exit(2);
  }

  runCleanup();
  const auditBaseline = psqlT('SELECT count(*) FROM audit_logs');
  console.log(`baseline: audit=${auditBaseline}`);

  const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const workerCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const adminPage = await adminCtx.newPage();
  const workerPage = await workerCtx.newPage();
  for (const p of [adminPage, workerPage]) p.setDefaultTimeout(30000);

  let idA = null, idB = null, areaId = null;
  let auditUpdatedAfterS4 = null;

  try {
    // ============ S1: tạo project + tạo area qua UI ============
    await step('S1', 'Tạo project E2E3-A + tạo area qua UI → list active', async (id) => {
      const ca = await createProject(adminToken, CODE_A);
      if (ca.status !== 201) return fail(id, `tạo E2E3-A status=${ca.status} ${JSON.stringify(ca.body).slice(0, 200)}`);
      idA = ca.body.id;
      await loginWeb(adminPage, ADMIN_EMAIL, ADMIN_PASS);
      await gotoDetail(adminPage, idA);
      await adminPage.fill('#area-add-name', NAME_ALPHA);
      await adminPage.getByRole('button', { name: 'Thêm khu vực', exact: true }).click();
      await adminPage.waitForFunction(
        () => (document.body.textContent || '').includes('Đã thêm khu vực'),
        { timeout: 25000 });
      await adminPage.waitForFunction(
        (n) => (document.body.textContent || '').includes(n),
        NAME_ALPHA, { timeout: 25000 });
      await snap(adminPage, `${id}-created`, 'E2E3-A sau khi thêm Khu Alpha (active)');
      const lr = await api('GET', `/api/v1/projects/${idA}/areas`, adminToken);
      const hit = (lr.body && Array.isArray(lr.body.data) ? lr.body.data : []).find((a) => a.name === NAME_ALPHA);
      if (!hit || hit.isActive !== true) {
        return fail(id, `GET areas thiếu Alpha active: ${JSON.stringify(lr.body).slice(0, 300)}`);
      }
      areaId = hit.id;
      const db = psqlT(`SELECT name||'|'||is_active::text FROM project_areas WHERE id='${areaId}'`);
      if (db !== `${NAME_ALPHA}|true`) return fail(id, `psql row sai: ${db}`);
      const au = psqlT(`SELECT actor_user_id||'|'||action FROM audit_logs WHERE entity_id='${idA}' AND action='PRJ_PROJECT_AREA_ADDED' AND after_data->>'name'='${NAME_ALPHA}'`);
      if (!au.split('\n').some((r) => r.startsWith(`${ADMIN_ID}|PRJ_PROJECT_AREA_ADDED`))) {
        return fail(id, `thiếu audit ADDED actor admin: ${au.slice(0, 200)}`);
      }
      return ok(id, `UI notice Đã thêm + list ${NAME_ALPHA}; psql ${db}; audit ADDED admin`);
    })();

    // ============ S2: trùng tên → 409 per-field ============
    await step('S2', 'Tạo trùng tên → UI field error + API 409 AREA_DUPLICATE', async (id) => {
      await gotoDetail(adminPage, idA);
      await adminPage.fill('#area-add-name', NAME_ALPHA);
      await adminPage.getByRole('button', { name: 'Thêm khu vực', exact: true }).click();
      await adminPage.waitForSelector('#area-add-name-error', { timeout: 25000 });
      await snap(adminPage, `${id}-duplicate`, 'Lỗi trùng tên khu vực (field name)');
      const t = await bodyText(adminPage);
      if (!t.includes('đã tồn tại trong dự án')) return fail(id, 'thiếu field error tên đã tồn tại');
      const dup = await api('POST', `/api/v1/projects/${idA}/areas`, adminToken, { name: NAME_ALPHA });
      if (dup.status !== 409 || dup.body.code !== 'AREA_DUPLICATE') {
        return fail(id, `API dup status=${dup.status} ${JSON.stringify(dup.body).slice(0, 200)}`);
      }
      const n = psqlT(`SELECT count(*) FROM project_areas WHERE project_id='${idA}' AND name='${NAME_ALPHA}' AND is_active`);
      if (n !== '1') return fail(id, `active rows=${n} (mong 1)`);
      return ok(id, `UI field error per-field + API 409 AREA_DUPLICATE; active rows=1`);
    })();

    // ============ S3: đổi tên → audit before/after ============
    await step('S3', 'Đổi tên area qua UI → list mới + audit UPDATED before/after', async (id) => {
      const updBefore = psqlT(`SELECT count(*) FROM audit_logs WHERE entity_id='${idA}' AND action='PRJ_PROJECT_AREA_UPDATED'`);
      await gotoDetail(adminPage, idA);
      await adminPage.getByRole('button', { name: 'Đổi tên', exact: true }).click();
      await adminPage.waitForSelector(`#area-edit-name-${areaId}`, { timeout: 15000 });
      await adminPage.fill(`#area-edit-name-${areaId}`, NAME_ALPHA2);
      await adminPage.getByRole('button', { name: 'Lưu', exact: true }).click();
      await adminPage.waitForFunction(
        () => (document.body.textContent || '').includes('Đã đổi tên khu vực'),
        { timeout: 25000 });
      await snap(adminPage, `${id}-renamed`, 'E2E3-A sau khi đổi tên Alpha');
      const t = await bodyText(adminPage);
      if (!t.includes(NAME_ALPHA2)) return fail(id, 'list UI thiếu tên mới');
      const db = psqlT(`SELECT name FROM project_areas WHERE id='${areaId}'`);
      if (db !== NAME_ALPHA2) return fail(id, `psql name=${db} (mong ${NAME_ALPHA2})`);
      const au = psqlT(`SELECT (before_data->>'name')||'| '||(after_data->>'name') FROM audit_logs WHERE entity_id='${idA}' AND action='PRJ_PROJECT_AREA_UPDATED' AND (after_data->>'name')='${NAME_ALPHA2}' ORDER BY created_at DESC LIMIT 1`);
      if (au !== `${NAME_ALPHA}| ${NAME_ALPHA2}`) {
        return fail(id, `audit before/after sai: ${au.slice(0, 200)}`);
      }
      const updAfter = psqlT(`SELECT count(*) FROM audit_logs WHERE entity_id='${idA}' AND action='PRJ_PROJECT_AREA_UPDATED'`);
      if (String(Number(updAfter) - Number(updBefore)) !== '1') {
        return fail(id, `audit UPDATED tăng ${updBefore}→${updAfter} (mong +1)`);
      }
      return ok(id, `UI Đã đổi tên + list mới; psql name đúng; audit before/after đủ; UPDATED +1`);
    })();

    // ============ S4: ngừng sử dụng → badge + row tồn tại ============
    await step('S4', 'Ngừng sử dụng qua UI → badge + DB is_active=false (no hard delete)', async (id) => {
      await gotoDetail(adminPage, idA);
      await adminPage.getByRole('button', { name: 'Ngừng sử dụng', exact: true }).click();
      await adminPage.waitForSelector('#area-deactivate-reason', { timeout: 15000 });
      const counter = await bodyText(adminPage);
      if (!counter.includes('/500')) return fail(id, 'thiếu counter /500 ký tự');
      await adminPage.fill('#area-deactivate-reason', 'Gộp khu E2E3 để kiểm thử');
      await adminPage.getByRole('button', { name: 'Xác nhận ngừng sử dụng', exact: true }).click();
      await adminPage.waitForFunction(
        () => (document.body.textContent || '').includes('Đã ngừng sử dụng khu vực'),
        { timeout: 25000 });
      await snap(adminPage, `${id}-deactivated`, 'E2E3-A: Alpha badge Ngừng sử dụng');
      const t = await bodyText(adminPage);
      if (!t.includes('Ngừng sử dụng')) return fail(id, 'thiếu badge Ngừng sử dụng');
      const db = psqlT(`SELECT is_active::text FROM project_areas WHERE id='${areaId}'`);
      if (db !== 'false') return fail(id, `psql is_active=${db} (mong false) — row phải còn (no hard delete)`);
      const au = psqlT(`SELECT reason FROM audit_logs WHERE entity_id='${idA}' AND action='PRJ_PROJECT_AREA_UPDATED' ORDER BY created_at DESC LIMIT 1`);
      if (!au.includes('Gộp khu E2E3')) return fail(id, `audit reason thiếu: ${au.slice(0, 200)}`);
      auditUpdatedAfterS4 = psqlT(`SELECT count(*) FROM audit_logs WHERE entity_id='${idA}' AND action='PRJ_PROJECT_AREA_UPDATED'`);
      return ok(id, `UI badge Ngừng sử dụng; psql is_active=false row còn; audit reason đủ`);
    })();

    // ============ S5: double-deactivate idempotent ============
    await step('S5', 'Deactivate lần 2 → alreadyInactive, không audit mới', async (id) => {
      const r2 = await api('PATCH', `/api/v1/projects/${idA}/areas/${areaId}`, adminToken, { isActive: false });
      if (r2.status !== 200 || r2.body.alreadyInactive !== true) {
        return fail(id, `lần 2 status=${r2.status} ${JSON.stringify(r2.body).slice(0, 200)}`);
      }
      const after = psqlT(`SELECT count(*) FROM audit_logs WHERE entity_id='${idA}' AND action='PRJ_PROJECT_AREA_UPDATED'`);
      if (auditUpdatedAfterS4 !== after) return fail(id, `audit tăng sau idempotent (${auditUpdatedAfterS4}→${after})`);
      return ok(id, `API alreadyInactive=true; audit UPDATED ${auditUpdatedAfterS4}→${after} (không tăng)`);
    })();

    // ============ S6: phân quyền ============
    await step('S6', 'Worker1: ẩn write controls + API 403; PM khác project: API 403', async (id) => {
      // Worker1 (manager của A nhưng role WORKER): UI read-only + API write 403.
      await loginWeb(workerPage, W1_EMAIL, W1_PASS);
      await gotoDetail(workerPage, idA);
      const tw = await bodyText(workerPage);
      if (!tw.includes('Chỉ ADMIN và PROJECT_MANAGER')) return fail(id, 'thiếu ghi chú read-only cho worker');
      for (const n of ['Thêm khu vực', 'Đổi tên', 'Ngừng sử dụng']) {
        const c = await workerPage.getByRole('button', { name: n, exact: true }).count();
        if (c !== 0) return fail(id, `worker vẫn thấy nút "${n}" (${c})`);
      }
      await snap(workerPage, `${id}-worker-readonly`, 'Worker1: read-only, không write controls');
      const wadd = await api('POST', `/api/v1/projects/${idA}/areas`, w1Token, { name: 'Khu Worker Chui' });
      if (wadd.status !== 403) return fail(id, `worker1 add=${wadd.status} (mong 403)`);
      const wupd = await api('PATCH', `/api/v1/projects/${idA}/areas/${areaId}`, w1Token, { name: 'Khu Worker Sửa' });
      if (wupd.status !== 403) return fail(id, `worker1 patch=${wupd.status} (mong 403)`);
      // PM chỉ là member của B → write vào A phải 403 (ID tampering).
      const cb = await createProject(adminToken, CODE_B);
      if (cb.status !== 201) return fail(id, `tạo E2E3-B status=${cb.status}`);
      idB = cb.body.id;
      const madd = await api('POST', `/api/v1/projects/${idB}/members`, adminToken, { userId: PM_ID, projectRole: 'COORDINATOR' });
      if (madd.status !== 201) return fail(id, `add pm vào B status=${madd.status} ${JSON.stringify(madd.body).slice(0, 200)}`);
      const padd = await api('POST', `/api/v1/projects/${idA}/areas`, pmToken, { name: 'Khu PM Lạ' });
      if (padd.status !== 403) return fail(id, `pm-ngoài-A add=${padd.status} (mong 403)`);
      const pupd = await api('PATCH', `/api/v1/projects/${idA}/areas/${areaId}`, pmToken, { name: 'Khu PM Sửa' });
      if (pupd.status !== 403) return fail(id, `pm-ngoài-A patch=${pupd.status} (mong 403)`);
      return ok(id, `worker UI 0 nút + API POST/PATCH 403; pm-ngoài-A POST/PATCH 403`);
    })();

    // ============ S7: areaId lạ → 404 ============
    await step('S7', 'PATCH areaId không tồn tại → 404 actionable', async (id) => {
      const fake = uuid();
      const r = await api('PATCH', `/api/v1/projects/${idA}/areas/${fake}`, adminToken, { name: 'Khu Ma' });
      if (r.status !== 404) return fail(id, `status=${r.status} (mong 404) ${JSON.stringify(r.body).slice(0, 200)}`);
      const msg = (r.body && r.body.message) || '';
      if (!msg) return fail(id, '404 thiếu message actionable');
      return ok(id, `404 message="${msg.slice(0, 80)}"`);
    })();

    // ============ S8: activeOnly=true chỉ trả active ============
    await step('S8', 'activeOnly=true chỉ trả active (Beta), default trả cả 2', async (id) => {
      const cb = await api('POST', `/api/v1/projects/${idA}/areas`, adminToken, { name: NAME_BETA });
      if (cb.status !== 201) return fail(id, `tạo Beta status=${cb.status} ${JSON.stringify(cb.body).slice(0, 200)}`);
      const all = await api('GET', `/api/v1/projects/${idA}/areas`, adminToken);
      const names = (all.body.data || []).map((a) => a.name);
      if (all.body.total !== 2 || !names.includes(NAME_ALPHA2) || !names.includes(NAME_BETA)) {
        return fail(id, `GET default sai: total=${all.body.total} names=[${names}]`);
      }
      const act = await api('GET', `/api/v1/projects/${idA}/areas?activeOnly=true`, adminToken);
      const anames = (act.body.data || []).map((a) => a.name);
      if (act.body.total !== 1 || anames[0] !== NAME_BETA) {
        return fail(id, `activeOnly sai: total=${act.body.total} names=[${anames}]`);
      }
      if ((act.body.data || []).some((a) => a.isActive !== true)) return fail(id, 'activeOnly trả row inactive');
      // UI toggle: bật checkbox → chỉ còn Beta.
      await gotoDetail(adminPage, idA);
      await adminPage.getByLabel('Chỉ hiện khu vực đang sử dụng').check();
      await adminPage.waitForFunction(
        (n) => (document.body.textContent || '').includes(n),
        NAME_BETA, { timeout: 25000 });
      await snap(adminPage, `${id}-activeonly`, 'Toggle activeOnly: chỉ Beta');
      return ok(id, `default total=2 [Alpha2,Beta]; activeOnly total=1 [Beta]; UI toggle đúng`);
    })();
  } finally {
    runCleanup();
    const rest = psqlT(`SELECT count(*) FROM projects WHERE code LIKE 'E2E3-%'`);
    const auditFinal = psqlT('SELECT count(*) FROM audit_logs');
    console.log(`cleanup: E2E3-% rest=${rest}, audit ${auditBaseline}→${auditFinal} (tăng do ADDED/UPDATED hợp lệ; audit giữ nguyên)`);
    fs.writeFileSync(path.join(__dirname, 'e2e-vars.json'), JSON.stringify({
      _note: 'Throwaway E2E-only demo credentials (seed/reset per evidence docs). Never production.',
      admin: ADMIN_EMAIL, pm: PM_EMAIL, worker1: W1_EMAIL,
      codes: { A: CODE_A, B: CODE_B },
      projectIds: { A: idA, B: idB },
      areaId, auditBaseline, auditFinal, rest, results,
    }, null, 2));
    const passed = results.filter((r) => r.ok).length;
    console.log(`\nTỔNG: ${passed}/${results.length} PASS`);
    await browser.close().catch(() => {});
    process.exit(passed === results.length ? 0 : 1);
  }
})();
