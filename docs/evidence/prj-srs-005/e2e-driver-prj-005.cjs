/**
 * PRJ-SRS-005 E2E driver — Quản lý thành viên dự án (issue #36).
 * Evidence-only script; phạm vi docs/evidence — KHÔNG sửa source.
 *
 * Chạy:   node e2e-driver-prj-005.cjs
 * Yêu cầu: stack rebuild từ working tree (api có GET|POST /members + DELETE
 *          /members/:memberId, web có ProjectMembers + StatusTimeline labels);
 *          admin (E2EAdmin@2025) + pm (E2EPm@2025) + worker1 (E2EWorker@2025) +
 *          worker2@example.com (E2EWorker2@2025, reset SQL cho E2E) +
 *          e2e5.worker3@example.com (E2E5W3@2025, tạo qua POST /workers).
 *
 * Quy ước: mã E2E5-% (cleanup đầu/cuối run, audit giữ nguyên — append-only).
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
const ADMIN_PASS = 'E2EAdmin@2025';
const PM_EMAIL = 'pm@example.com';
const PM_PASS = 'E2EPm@2025';
const W1_EMAIL = 'worker1@example.com';
const W1_PASS = 'E2EWorker@2025';
const W2_EMAIL = 'worker2@example.com';
const W2_PASS = 'E2EWorker2@2025';
const W3_EMAIL = 'e2e5.worker3@example.com';
const W3_PASS = 'E2E5W3@2025';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const W1_ID = '33333333-3333-4333-8333-333333333333';
const W2_ID = '44444444-4444-4444-8444-444444444444';
const W3_ID = '98230b1d-f254-4e99-9515-f9e2b1fd63a4';

const C = { A: 'E2E5-A', B: 'E2E5-B', Cc: 'E2E5-C', D: 'E2E5-D' };
const START = '2026-10-01';
const END = '2027-03-31';

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
    const sql = fs.readFileSync(path.join(__dirname, 'seed-005.sql'), 'utf8');
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
    () => (document.body.textContent || '').includes('Thành viên dự án'),
    { timeout: 25000 });
  // Đợi options user load xong (worker2 xuất hiện trong select).
  // Lưu ý: <option> luôn 'hidden' với Playwright → đợi state attached.
  await page.waitForSelector(`#member-add-user option[value="${W2_ID}"]`, { state: 'attached', timeout: 25000 });
}
/** Chọn user+role trong form thêm rồi submit, đợi text mong đợi. */
async function uiAddMember(page, userId, role) {
  await page.selectOption('#member-add-user', userId);
  await page.selectOption('#member-add-role', role);
  await page.getByRole('button', { name: 'Thêm vào dự án', exact: true }).click();
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
  const w1Token = await getToken(W1_EMAIL, W1_PASS);
  const w2Token = await getToken(W2_EMAIL, W2_PASS);
  const w3Token = await getToken(W3_EMAIL, W3_PASS);
  if (!adminToken || !w1Token || !w2Token || !w3Token) {
    console.error(`Không lấy được token (admin=${!!adminToken} w1=${!!w1Token} w2=${!!w2Token} w3=${!!w3Token})`);
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

  let idA = null, idB = null, idC = null, idD = null;
  let memberIdA = null; // membership worker2 trong A
  let w2GetBefore = null;

  try {
    // ============ S1: ADMIN thêm worker2 (ĐIỀU PHỐI) qua UI ============
    await step('S1', 'ADMIN thêm worker2 ĐIỀU PHỐI qua UI → list + psql + audit ADDED', async (id) => {
      const ca = await createProject(adminToken, C.A);
      if (ca.status !== 201) return fail(id, `tạo E2E5-A status=${ca.status} ${JSON.stringify(ca.body).slice(0, 200)}`);
      idA = ca.body.id;
      await loginWeb(adminPage, ADMIN_EMAIL, ADMIN_PASS);
      await gotoDetail(adminPage, idA);
      await uiAddMember(adminPage, W2_ID, 'COORDINATOR');
      await adminPage.waitForFunction(
        () => (document.body.textContent || '').includes('Đã thêm'),
        { timeout: 25000 });
      await adminPage.waitForFunction(
        () => (document.body.textContent || '').includes('ĐIỀU PHỐI'),
        { timeout: 25000 });
      await snap(adminPage, `${id}-added`, 'E2E5-A sau khi thêm worker2 ĐIỀU PHỐI');
      const t = await bodyText(adminPage);
      if (!t.includes('Lê Văn Thợ')) return fail(id, 'list UI thiếu tên Lê Văn Thợ');
      const lr = await api('GET', `/api/v1/projects/${idA}/members`, adminToken);
      const hit = (lr.body && Array.isArray(lr.body.data) ? lr.body.data : []).find((m) => m.userId === W2_ID);
      if (!hit || hit.projectRole !== 'COORDINATOR' || hit.isActive !== true) {
        return fail(id, `GET members thiếu worker2 COORDINATOR: ${JSON.stringify(lr.body).slice(0, 300)}`);
      }
      memberIdA = hit.id;
      const db = psqlT(`SELECT project_role||'|'||is_active::text||'|'||added_by FROM project_members WHERE project_id='${idA}' AND user_id='${W2_ID}' AND is_active`);
      if (db !== `COORDINATOR|true|${ADMIN_ID}`) return fail(id, `psql row sai: ${db}`);
      const au = psqlT(`SELECT actor_user_id||'|'||action FROM audit_logs WHERE entity_id='${idA}' AND action='PRJ_PROJECT_MEMBER_ADDED'`);
      if (!au.split('\n').some((r) => r.startsWith(`${ADMIN_ID}|PRJ_PROJECT_MEMBER_ADDED`))) {
        return fail(id, `thiếu audit ADDED actor admin: ${au.slice(0, 200)}`);
      }
      const w2get = await api('GET', `/api/v1/projects/${idA}`, w2Token);
      w2GetBefore = w2get.status;
      if (w2get.status !== 200) return fail(id, `worker2 GET detail trước remove=${w2get.status} (mong 200)`);
      return ok(id, `UI list Lê Văn Thợ ĐIỀU PHỐI; psql ${db}; audit ADDED admin; worker2 GET=200`);
    })();

    // ============ S2: thêm trùng → 409 ============
    await step('S2', 'Thêm trùng worker2 → 409 field error, không dòng thứ hai', async (id) => {
      await gotoDetail(adminPage, idA);
      await uiAddMember(adminPage, W2_ID, 'QC');
      await adminPage.waitForSelector('#member-add-user-error', { timeout: 25000 });
      await snap(adminPage, `${id}-duplicate`, 'Lỗi trùng thành viên (field userId)');
      const t = await bodyText(adminPage);
      if (!t.includes('Thành viên đã trong dự án')) return fail(id, 'thiếu field error Thành viên đã trong dự án');
      const dup = await api('POST', `/api/v1/projects/${idA}/members`, adminToken, { userId: W2_ID, projectRole: 'QC' });
      if (dup.status !== 409 || dup.body.code !== 'MEMBER_DUPLICATE') {
        return fail(id, `API dup status=${dup.status} ${JSON.stringify(dup.body).slice(0, 200)}`);
      }
      const n = psqlT(`SELECT count(*) FROM project_members WHERE project_id='${idA}' AND user_id='${W2_ID}' AND is_active`);
      if (n !== '1') return fail(id, `active rows=${n} (mong 1)`);
      return ok(id, `UI field error + API 409 MEMBER_DUPLICATE; active rows=1`);
    })();

    // ============ S3: badges QC + WORKER ============
    await step('S3', 'Thêm QC (B) + WORKER (C) → badge đúng', async (id) => {
      const cb = await createProject(adminToken, C.B);
      if (cb.status !== 201) return fail(id, `tạo E2E5-B status=${cb.status}`);
      idB = cb.body.id;
      const cc = await createProject(adminToken, C.Cc);
      if (cc.status !== 201) return fail(id, `tạo E2E5-C status=${cc.status}`);
      idC = cc.body.id;
      const q = await api('POST', `/api/v1/projects/${idB}/members`, adminToken, { userId: W2_ID, projectRole: 'QC' });
      if (q.status !== 201) return fail(id, `add QC status=${q.status}`);
      const w = await api('POST', `/api/v1/projects/${idC}/members`, adminToken, { userId: W2_ID, projectRole: 'WORKER' });
      if (w.status !== 201) return fail(id, `add WORKER status=${w.status}`);
      await gotoDetail(adminPage, idB);
      await adminPage.waitForFunction(() => (document.body.textContent || '').includes('Lê Văn Thợ'), { timeout: 25000 });
      await snap(adminPage, `${id}-badges`, 'E2E5-B badge QC của worker2');
      const tb = await bodyText(adminPage);
      if (!/\bQC\b/.test(tb)) return fail(id, 'detail B thiếu badge QC');
      await gotoDetail(adminPage, idC);
      await adminPage.waitForFunction(() => (document.body.textContent || '').includes('Lê Văn Thợ'), { timeout: 25000 });
      const tc = await bodyText(adminPage);
      if (!tc.includes('THÀNH VIÊN')) return fail(id, 'detail C thiếu badge THÀNH VIÊN');
      const db = psqlT(`SELECT project_role FROM project_members WHERE user_id='${W2_ID}' AND is_active AND project_id IN ('${idB}','${idC}') ORDER BY project_role`);
      return ok(id, `B badge QC + C badge THÀNH VIÊN; psql [${db.replace(/\n/g, ',')}]`);
    })();

    // ============ S4: xóa worker2 kèm reason → lịch sử ============
    await step('S4', 'Xóa worker2 (reason) qua UI → history Đã rời + psql + audit REMOVED', async (id) => {
      const addedBefore = psqlT(`SELECT count(*) FROM audit_logs WHERE entity_id='${idA}' AND action='PRJ_PROJECT_MEMBER_REMOVED'`);
      await gotoDetail(adminPage, idA);
      const btnCount = await adminPage.getByRole('button', { name: 'Xóa khỏi dự án', exact: true }).count();
      if (btnCount !== 1) return fail(id, `nút Xóa=${btnCount} (mong 1 — chỉ worker2, manager ẩn)`);
      await adminPage.getByRole('button', { name: 'Xóa khỏi dự án', exact: true }).click();
      await adminPage.waitForSelector('#member-remove-reason', { timeout: 15000 });
      const counter = await bodyText(adminPage);
      if (!counter.includes('/500')) return fail(id, 'thiếu counter /500 ký tự');
      await adminPage.fill('#member-remove-reason', 'Kết thúc giai đoạn 1 E2E5');
      await adminPage.getByRole('button', { name: 'Xác nhận xóa', exact: true }).click();
      await adminPage.waitForFunction(
        () => (document.body.textContent || '').includes('Đã xóa'),
        { timeout: 25000 });
      await snap(adminPage, `${id}-removed`, 'E2E5-A sau khi xóa worker2');
      // Lịch sử: bật checkbox → badge Đã rời + giai đoạn joined→left.
      await adminPage.getByLabel('Xem lịch sử (kể cả thành viên đã rời)').check();
      await adminPage.waitForFunction(
        () => (document.body.textContent || '').includes('Đã rời'),
        { timeout: 25000 });
      await snap(adminPage, `${id}-history`, 'Lịch sử: worker2 Đã rời + giai đoạn');
      const th = await bodyText(adminPage);
      if (!th.includes('Giai đoạn:')) return fail(id, 'history thiếu Giai đoạn joined→left');
      const db = psqlT(`SELECT is_active::text||'|'||(CASE WHEN left_at IS NULL THEN 'null' ELSE 'set' END) FROM project_members WHERE id='${memberIdA}'`);
      if (db !== 'false|set') return fail(id, `psql row=${db} (mong false|set)`);
      const au = psqlT(`SELECT reason FROM audit_logs WHERE entity_id='${idA}' AND action='PRJ_PROJECT_MEMBER_REMOVED' ORDER BY created_at DESC LIMIT 1`);
      if (!au.includes('Kết thúc giai đoạn 1 E2E5')) return fail(id, `audit reason thiếu: ${au.slice(0, 200)}`);
      const addedAfter = psqlT(`SELECT count(*) FROM audit_logs WHERE entity_id='${idA}' AND action='PRJ_PROJECT_MEMBER_REMOVED'`);
      if (String(Number(addedAfter) - Number(addedBefore)) !== '1') {
        return fail(id, `audit REMOVED tăng ${addedBefore}→${addedAfter} (mong +1)`);
      }
      return ok(id, `UI Đã xóa + history Đã rời/Giai đoạn; psql ${db}; audit reason đủ; REMOVED +1`);
    })();

    // ============ S5: worker2 mất quyền đọc A ============
    await step('S5', 'worker2 sau remove: GET detail A 403 (trước 200); audit quá khứ vẫn query được', async (id) => {
      const w2get = await api('GET', `/api/v1/projects/${idA}`, w2Token);
      if (w2get.status !== 403) return fail(id, `worker2 GET sau remove=${w2get.status} (mong 403)`);
      const adm = await api('GET', `/api/v1/audit-logs?entityType=PROJECT&entityId=${idA}&result=SUCCESS&limit=100`, adminToken);
      const rows = adm.body && Array.isArray(adm.body.data) ? adm.body.data : [];
      const acts = rows.map((a) => a.action);
      if (!acts.includes('PRJ_PROJECT_MEMBER_ADDED') || !acts.includes('PRJ_PROJECT_MEMBER_REMOVED')) {
        return fail(id, `audit admin thiếu ADDED/REMOVED: ${JSON.stringify(acts).slice(0, 200)}`);
      }
      const w2audit = await api('GET', `/api/v1/audit-logs?entityType=PROJECT&entityId=${idA}&result=SUCCESS&limit=100`, w2Token);
      return ok(id, `GET ${w2GetBefore}→${w2get.status} (per-project scope); admin audit ${rows.length} rows đủ ADDED+REMOVED; worker2 audit query=${w2audit.status}`);
    })();

    // ============ S6: double remove idempotent ============
    await step('S6', 'Xóa 2 lần: alreadyRemoved, không audit mới (API + UI race)', async (id) => {
      const before = psqlT(`SELECT count(*) FROM audit_logs WHERE entity_id='${idA}' AND action='PRJ_PROJECT_MEMBER_REMOVED'`);
      const r2 = await api('DELETE', `/api/v1/projects/${idA}/members/${memberIdA}`, adminToken, {});
      if (r2.status !== 200 || r2.body.alreadyRemoved !== true) {
        return fail(id, `lần 2 status=${r2.status} ${JSON.stringify(r2.body).slice(0, 200)}`);
      }
      const after = psqlT(`SELECT count(*) FROM audit_logs WHERE entity_id='${idA}' AND action='PRJ_PROJECT_MEMBER_REMOVED'`);
      if (before !== after) return fail(id, `audit tăng sau idempotent (${before}→${after})`);
      // UI race trên B: mở confirm, API xóa trước, UI xác nhận → notice alreadyRemoved.
      const lb = await api('GET', `/api/v1/projects/${idB}/members`, adminToken);
      const w2b = (lb.body.data || []).find((m) => m.userId === W2_ID);
      if (!w2b) return fail(id, 'B thiếu worker2 để race UI');
      await gotoDetail(adminPage, idB);
      await adminPage.getByRole('button', { name: 'Xóa khỏi dự án', exact: true }).click();
      await adminPage.waitForSelector('#member-remove-reason', { timeout: 15000 });
      const del = await api('DELETE', `/api/v1/projects/${idB}/members/${w2b.id}`, adminToken, { reason: 'race E2E5' });
      if (del.status !== 200 || del.body.alreadyRemoved !== false) return fail(id, `race API del=${del.status}`);
      await adminPage.getByRole('button', { name: 'Xác nhận xóa', exact: true }).click();
      await adminPage.waitForFunction(
        () => (document.body.textContent || '').includes('đã rời dự án trước đó'),
        { timeout: 25000 });
      await snap(adminPage, `${id}-already-removed`, 'UI notice alreadyRemoved (race)');
      return ok(id, `API alreadyRemoved=true audit ${before}→${after}; UI notice đã rời trước đó`);
    })();

    // ============ S7: guard manager ============
    await step('S7', 'Xóa membership manager → 409 MANAGER_MEMBER; UI ẩn nút', async (id) => {
      const lm = await api('GET', `/api/v1/projects/${idA}/members`, adminToken);
      const mgr = (lm.body.data || []).find((m) => m.userId === W1_ID && m.isActive);
      if (!mgr) return fail(id, 'A thiếu manager membership active');
      const del = await api('DELETE', `/api/v1/projects/${idA}/members/${mgr.id}`, adminToken, {});
      if (del.status !== 409 || del.body.code !== 'MANAGER_MEMBER') {
        return fail(id, `mong 409 MANAGER_MEMBER, được ${del.status} ${JSON.stringify(del.body).slice(0, 200)}`);
      }
      await gotoDetail(adminPage, idA);
      await snap(adminPage, `${id}-manager-guard`, 'Row manager: QUẢN LÝ + ẩn nút xóa');
      const t = await bodyText(adminPage);
      if (!t.includes('Đổi quản lý qua Sửa hồ sơ')) return fail(id, 'thiếu hint Đổi quản lý qua Sửa hồ sơ');
      const btns = await adminPage.getByRole('button', { name: 'Xóa khỏi dự án', exact: true }).count();
      if (btns !== 0) return fail(id, `manager row vẫn có nút xóa (${btns})`);
      return ok(id, `API 409 MANAGER_MEMBER; UI hint + 0 nút xóa`);
    })();

    // ============ S8: MANAGER qua POST → 400 ============
    await step('S8', 'POST projectRole=MANAGER → 400 fieldErrors; UI select chỉ 4 roles', async (id) => {
      const r = await api('POST', `/api/v1/projects/${idA}/members`, adminToken, { userId: W3_ID, projectRole: 'MANAGER' });
      if (r.status !== 400 || !(r.body.fieldErrors && r.body.fieldErrors.projectRole)) {
        return fail(id, `mong 400 fieldErrors.projectRole, được ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
      }
      await gotoDetail(adminPage, idA);
      const opts = await adminPage.locator('#member-add-role option').allTextContents();
      const vals = await adminPage.locator('#member-add-role option').evaluateAll((els) => els.map((e) => e.value));
      const real = vals.filter((v) => v !== '');
      const want = ['COORDINATOR', 'QC', 'WORKER', 'VIEWER'];
      if (real.length !== 4 || !want.every((v) => real.includes(v)) || real.includes('MANAGER')) {
        return fail(id, `role select sai: [${real}] (mong 4, không MANAGER)`);
      }
      await snap(adminPage, `${id}-roles`, 'Select vai trò: 4 giá trị, không Quản lý');
      return ok(id, `API 400 projectRole→PATCH; UI roles [${opts.map((s) => s.trim()).filter(Boolean).join('/')}]`);
    })();

    // ============ S9: P11 — PATCH manager → worker3 ============
    await step('S9', 'PATCH managerId→worker3 (edit form) → MANAGER membership auto', async (id) => {
      const mgrBefore = psqlT(`SELECT user_id||'|'||project_role||'|'||is_active::text FROM project_members WHERE project_id='${idC}' AND is_active ORDER BY joined_at`);
      await adminPage.goto(`${WEB}/projects/${idC}/edit`, { waitUntil: 'networkidle' });
      await adminPage.waitForSelector(`#project-manager option[value="${W3_ID}"]`, { state: 'attached', timeout: 25000 });
      await adminPage.selectOption('#project-manager', W3_ID);
      await adminPage.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
      await adminPage.waitForFunction(
        () => (document.body.textContent || '').includes('Cập nhật dự án thành công'),
        { timeout: 25000 });
      await snap(adminPage, `${id}-new-manager`, 'Edit form: đổi quản lý → worker3');
      const db = psqlT(`SELECT user_id||'|'||project_role||'|'||is_active::text||'|'||added_by FROM project_members WHERE project_id='${idC}' AND user_id='${W3_ID}' AND is_active`);
      if (db !== `${W3_ID}|MANAGER|true|${ADMIN_ID}`) return fail(id, `worker3 membership sai: ${db}`);
      const old = psqlT(`SELECT user_id||'|'||project_role||'|'||is_active::text FROM project_members WHERE project_id='${idC}' AND user_id='${W1_ID}'`);
      if (!old.includes(`${W1_ID}|MANAGER|true`)) return fail(id, `manager cũ bị đụng: ${old} (trước: ${mgrBefore.replace(/\n/g, ',')})`);
      const w3get = await api('GET', `/api/v1/projects/${idC}`, w3Token);
      if (w3get.status !== 200) return fail(id, `worker3 GET detail=${w3get.status} (mong 200)`);
      if (w3get.body.managerId !== W3_ID) return fail(id, `managerId=${w3get.body.managerId} (mong worker3)`);
      return ok(id, `worker3 MANAGER auto (added_by admin); cũ untouched; worker3 GET=200`);
    })();

    // ============ S10: worker1 403 ============
    await step('S10', 'Worker1 không add/remove được (403 UI + API)', async (id) => {
      const add = await api('POST', `/api/v1/projects/${idA}/members`, w1Token, { userId: W3_ID, projectRole: 'QC' });
      if (add.status !== 403) return fail(id, `worker1 add=${add.status} (mong 403)`);
      const lm = await api('GET', `/api/v1/projects/${idA}/members`, adminToken);
      const mgr = (lm.body.data || []).find((m) => m.userId === W1_ID && m.isActive);
      const del = await api('DELETE', `/api/v1/projects/${idA}/members/${mgr.id}`, w1Token, {});
      if (del.status !== 403 && del.status !== 409) {
        return fail(id, `worker1 del=${del.status} (mong 403 role-guard, chấp nhận 409 nếu qua guard)`);
      }
      await loginWeb(workerPage, W1_EMAIL, W1_PASS);
      await workerPage.goto(`${WEB}/projects/${idA}`, { waitUntil: 'networkidle' });
      await workerPage.waitForFunction(
        () => (document.body.textContent || '').includes('Không có quyền'),
        { timeout: 25000 });
      await snap(workerPage, `${id}-worker403`, 'Worker1: 403 members (API enforce)');
      return ok(id, `API add=403 del=${del.status}; UI 403 card`);
    })();

    // ============ S11: double-submit một dòng ============
    await step('S11', 'Double-submit add → một dòng (unique index + UI disable)', async (id) => {
      const cd = await createProject(adminToken, C.D);
      if (cd.status !== 201) return fail(id, `tạo E2E5-D status=${cd.status}`);
      idD = cd.body.id;
      const [r1, r2] = await Promise.all([
        api('POST', `/api/v1/projects/${idD}/members`, adminToken, { userId: W2_ID, projectRole: 'COORDINATOR' }),
        api('POST', `/api/v1/projects/${idD}/members`, adminToken, { userId: W2_ID, projectRole: 'COORDINATOR' }),
      ]);
      const codes = [r1.status, r2.status].sort().join(',');
      if (codes !== '201,409') return fail(id, `race statuses=${r1.status},${r2.status} (mong 201+409)`);
      const n = psqlT(`SELECT count(*) FROM project_members WHERE project_id='${idD}' AND user_id='${W2_ID}' AND is_active`);
      if (n !== '1') return fail(id, `active rows=${n} (mong 1)`);
      await gotoDetail(adminPage, idD);
      const disabledEmpty = await adminPage.getByRole('button', { name: 'Thêm vào dự án', exact: true }).isDisabled();
      if (!disabledEmpty) return fail(id, 'nút Thêm không disabled khi thiếu field');
      await snap(adminPage, `${id}-form`, 'Form thêm: submit disabled khi thiếu field');
      return ok(id, `race 201+409, rows=1; UI submit disabled khi thiếu field`);
    })();
  } finally {
    runCleanup();
    const rest = psqlT(`SELECT count(*) FROM projects WHERE code LIKE 'E2E5-%'`);
    const auditFinal = psqlT('SELECT count(*) FROM audit_logs');
    console.log(`cleanup: E2E5-% rest=${rest}, audit ${auditBaseline}→${auditFinal} (tăng do ADDED/REMOVED/UPDATED hợp lệ; audit giữ nguyên)`);
    fs.writeFileSync(path.join(__dirname, 'e2e-vars.json'), JSON.stringify({
      _note: 'Throwaway E2E-only demo credentials (seed/reset per evidence docs). Never production.',
      admin: ADMIN_EMAIL, pm: PM_EMAIL, worker1: W1_EMAIL, worker2: W2_EMAIL, worker3: W3_EMAIL,
      codes: C,
      projectIds: { A: idA, B: idB, C: idC, D: idD },
      memberIdA, w2GetBefore,
      auditBaseline, auditFinal, rest, results,
    }, null, 2));
    const passed = results.filter((r) => r.ok).length;
    console.log(`\nTỔNG: ${passed}/${results.length} PASS`);
    await browser.close().catch(() => {});
    process.exit(passed === results.length ? 0 : 1);
  }
})();
