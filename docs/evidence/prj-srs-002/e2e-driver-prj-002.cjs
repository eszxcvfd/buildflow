/**
 * PRJ-SRS-002 E2E driver — Vòng đời trạng thái dự án (issue #33).
 * Evidence-only script; phạm vi docs/evidence — KHÔNG sửa source.
 *
 * Chuẩn hóa realistic 2026-09-08 (docs/demo-data.md): creds @vinacons.vn,
 * mã run VDA2-* (Vinacons Dự Án 2), tên/lý do tiếng Việt thực tế, manager UUIDs
 * giữ nguyên (111…=hoang.anh, 333…=thang.nguyen, 444…=hau.le). Cleanup id-based
 * (ids e2e-vars.json) + prefix + cửa sổ 12h. Count semantics giữ nguyên
 * (S3: đúng 6 STATUS_CHANGED).
 *
 * Chạy:   node e2e-driver-prj-002.cjs
 * Yêu cầu: stack rebuild từ working tree (api có PATCH /projects/:id/status,
 *          web có ProjectStatusDialog + StatusTimeline entityType PROJECT);
 *          admin (E2EAdmin@2025) + pm (E2EPm@2025) + worker1 (E2EWorker@2025).
 *
 * Quy ước: mã VDA2-% (cleanup đầu/cuối run, audit giữ nguyên — append-only).
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

const ADMIN_EMAIL = 'hoang.anh@vinacons.vn';
const ADMIN_PASS = 'E2EAdmin@2025';
const PM_EMAIL = 'quoc.tran@vinacons.vn';
const PM_PASS = 'E2EPm@2025';
const WORKER_EMAIL = 'thang.nguyen@vinacons.vn';
const WORKER_PASS = 'E2EWorker@2025';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const PM_ID = '22222222-2222-4222-8222-222222222222';
const W1_ID = '33333333-3333-4333-8333-333333333333';
const W2_ID = '44444444-4444-4444-8444-444444444444';

const C = {
  A: 'VDA2-A', B: 'VDA2-B', Cc: 'VDA2-C', D: 'VDA2-D',
  W: 'VDA2-W', PM: 'VDA2-PM', R: 'VDA2-R',
};
const START = '2026-10-01';
const END = '2027-03-31';
// Tên/địa chỉ realistic cho project run (docs/demo-data.md); key theo mã VDA2-*.
const PROJ = {
  'VDA2-A': { name: 'Bến cảng logistics Cái Mép', address: 'Số 1, đường Cái Mép, Bà Rịa' },
  'VDA2-B': { name: 'Cầu vượt An Sương', address: 'Số 2, đường An Sương, Quận 12' },
  'VDA2-C': { name: 'Kho lạnh Tân Cảng', address: 'Số 3, đường Tân Cảng, Bình Thạnh' },
  'VDA2-D': { name: 'Trạm biến áp Long Thành', address: 'Số 4, đường Long Thành, Đồng Nai' },
  'VDA2-W': { name: 'Xưởng cơ khí Đông Anh', address: 'Số 5, đường Đông Anh, Hà Nội' },
  'VDA2-PM': { name: 'Khu nghỉ dưỡng Suối Mơ', address: 'Số 6, đường Suối Mơ, Đồng Nai' },
  'VDA2-R': { name: 'Đập thủy lợi Đa Nhim', address: 'Số 7, đường Đa Nhim, Lâm Đồng' },
};
const LABEL = { ACTIVATE: 'Kích hoạt', PAUSE: 'Tạm dừng', RESUME: 'Tiếp tục hoạt động', COMPLETE: 'Hoàn thành', CLOSE: 'Đóng', REOPEN: 'Mở lại' };
const STATUS_VN = { DRAFT: 'Nháp', ACTIVE: 'Đang hoạt động', PAUSED: 'Tạm dừng', COMPLETED: 'Hoàn thành', CLOSED: 'Đóng' };

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
  return { status: res.status, headers: res.headers, body: json };
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
    // Id-based: xóa sót lại của run trước theo ids đã ghi trong e2e-vars.json.
    try {
      const prev = JSON.parse(fs.readFileSync(path.join(__dirname, 'e2e-vars.json'), 'utf8'));
      const ids = prev && prev.projectIds ? Object.values(prev.projectIds).filter(Boolean) : [];
      for (const pid of ids) {
        execFileSync('docker', ['exec', 'buildflow-postgres-1', 'psql', '-U', 'buildflow', '-d', 'buildflow', '-c',
          `DELETE FROM project_members WHERE project_id='${pid}';` +
          `DELETE FROM attachments WHERE project_id='${pid}';` +
          `DELETE FROM project_areas WHERE project_id='${pid}';` +
          `DELETE FROM work_orders WHERE project_id='${pid}';` +
          `DELETE FROM projects WHERE id='${pid}';`],
        { encoding: 'utf8', timeout: 20000 });
      }
    } catch {}
    const sql = fs.readFileSync(path.join(__dirname, 'seed-002.sql'), 'utf8');
    execFileSync('docker', ['exec', '-i', 'buildflow-postgres-1', 'psql', '-U', 'buildflow', '-d', 'buildflow', '-v', 'ON_ERROR_STOP=1'],
      { input: sql, encoding: 'utf8', timeout: 20000 });
  } catch (e) {
    console.log(`cleanup WARN ${(e.stderr || e.message || '').slice(0, 200)}`);
  }
}
async function createProject(token, code, managerId) {
  const meta = PROJ[code] || { name: `Dự án Vinacons ${code}`, address: `Số 1, đường ${code}` };
  const r = await api('POST', '/api/v1/projects', token, {
    code, name: meta.name, address: meta.address,
    plannedStartDate: START, plannedEndDate: END, managerId: managerId || W1_ID,
  });
  return r;
}
function auditCount(entityId, action) {
  return psqlT(`SELECT count(*) FROM audit_logs WHERE entity_id='${entityId}'${action ? ` AND action='${action}'` : ''}`);
}
/** Mở detail + đợi badge trạng thái tiếng Việt. */
async function gotoDetail(page, id, statusVn) {
  await page.goto(`${WEB}/projects/${id}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    (vn) => (document.body.textContent || '').includes(vn),
    statusVn, { timeout: 25000 });
}
/** Click nút action → điền reason (nếu cho) → xác nhận → đợi notice. */
async function uiTransition(page, action, reason) {
  await page.getByRole('button', { name: LABEL[action], exact: true }).click();
  await page.waitForSelector('#project-status-reason', { timeout: 15000 });
  if (reason !== undefined) await page.fill('#project-status-reason', reason);
  await page.getByRole('button', { name: `Xác nhận ${LABEL[action].toLowerCase()}`, exact: true }).click();
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
  const workerToken = await getToken(WORKER_EMAIL, WORKER_PASS);
  if (!adminToken || !pmToken || !workerToken) {
    console.error(`Không lấy được token (admin=${!!adminToken} pm=${!!pmToken} worker=${!!workerToken})`);
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

  let idA = null, idB = null, idC = null, idD = null, idW = null, idPM = null, idR = null;

  try {
    // ============ S1: ADMIN tạo (UI) + ACTIVATE (UI dialog) ============
    await step('S1', 'ADMIN tạo VDA2-A qua UI → ACTIVATE qua dialog → Đang hoạt động + audit', async (id) => {
      await loginWeb(adminPage, ADMIN_EMAIL, ADMIN_PASS);
      await adminPage.goto(`${WEB}/projects/new`, { waitUntil: 'networkidle' });
      await adminPage.waitForSelector('#project-manager', { timeout: 20000 });
      await adminPage.fill('#project-code', C.A);
      await adminPage.fill('#project-name', PROJ[C.A].name);
      await adminPage.fill('#project-address', PROJ[C.A].address);
      await adminPage.fill('#project-start', START);
      await adminPage.fill('#project-end', END);
      await adminPage.selectOption('#project-manager', W1_ID);
      await adminPage.click('button[type="submit"]');
      await adminPage.waitForFunction(() => (document.body.textContent || '').includes('Tạo dự án thành công'), { timeout: 25000 });
      const lr = await api('GET', '/api/v1/projects?limit=100&offset=0', adminToken);
      const hit = (Array.isArray(lr.body) ? lr.body : []).find((p) => p.code === C.A);
      if (!hit) return fail(id, 'tạo UI xong nhưng list không thấy VDA2-A');
      idA = hit.id;
      await gotoDetail(adminPage, idA, 'Nháp');
      // ACTIVATE không cần reason — dialog confirm trực tiếp.
      await uiTransition(adminPage, 'ACTIVATE');
      await adminPage.waitForFunction(() => (document.body.textContent || '').includes('Kích hoạt dự án thành công'), { timeout: 25000 });
      await gotoDetail(adminPage, idA, 'Đang hoạt động');
      await snap(adminPage, `${id}-active`, 'VDA2-A sau ACTIVATE (Đang hoạt động)');
      const db = psqlT(`SELECT status FROM projects WHERE id='${idA}'`);
      const au = psqlT(`SELECT actor_user_id||'|'||action||'|'||entity_type||'|'||coalesce(before_data->>'status','?')||'->'||coalesce(after_data->>'status','?') FROM audit_logs WHERE entity_id='${idA}' AND action='PRJ_PROJECT_STATUS_CHANGED' ORDER BY created_at`);
      if (db !== 'ACTIVE') return fail(id, `psql status=${db} (mong ACTIVE)`);
      if (!au.startsWith(`${ADMIN_ID}|PRJ_PROJECT_STATUS_CHANGED|PROJECT|DRAFT->ACTIVE`)) {
        return fail(id, `audit sai: ${au}`);
      }
      return ok(id, `detail Đang hoạt động; psql ACTIVE; audit ${au}`);
    })();

    // ============ S2: PAUSE → RESUME → COMPLETE → CLOSE ============
    await step('S2', 'Chuỗi PAUSE/RESUME/COMPLETE/CLOSE (API) + detail từng trạng thái', async (id) => {
      const chain = [
        { action: 'PAUSE', reason: 'Tạm dừng: chờ vật tư về công trường (đợt T9/2026)', want: 'PAUSED', vn: 'Tạm dừng' },
        { action: 'RESUME', reason: null, want: 'ACTIVE', vn: 'Đang hoạt động' },
        { action: 'COMPLETE', reason: null, want: 'COMPLETED', vn: 'Hoàn thành' },
        { action: 'CLOSE', reason: 'Đóng: đã nghiệm thu và bàn giao (đợt T9/2026)', want: 'CLOSED', vn: 'Đóng' },
      ];
      const notes = [];
      for (const s of chain) {
        const r = await api('PATCH', `/api/v1/projects/${idA}/status`, adminToken,
          { action: s.action, ...(s.reason ? { reason: s.reason } : {}) });
        if (r.status !== 200 || r.body.status !== s.want || r.body.alreadyInState !== false) {
          return fail(id, `${s.action}: status=${r.status} body=${JSON.stringify(r.body).slice(0, 300)}`);
        }
        const db = psqlT(`SELECT status FROM projects WHERE id='${idA}'`);
        if (db !== s.want) return fail(id, `${s.action}: psql=${db} (mong ${s.want})`);
        await gotoDetail(adminPage, idA, s.vn);
        notes.push(`${s.action}→${s.want}`);
      }
      await snap(adminPage, `${id}-closed`, 'VDA2-A sau CLOSE (Đóng + banner WO-guard)');
      const t = await bodyText(adminPage);
      if (!t.includes('không nhận Work Order mới')) return fail(id, 'thiếu banner WO-guard khi CLOSED');
      const reasons = psqlT(`SELECT reason FROM audit_logs WHERE entity_id='${idA}' AND action='PRJ_PROJECT_STATUS_CHANGED' AND reason IS NOT NULL ORDER BY created_at`);
      if (!reasons.includes('Tạm dừng: chờ vật tư') || !reasons.includes('Đóng: đã nghiệm thu')) {
        return fail(id, `reason audit thiếu: ${reasons.slice(0, 200)}`);
      }
      return ok(id, `${notes.join(', ')}; banner WO-guard có; reasons lưu audit`);
    })();

    // ============ S3: REOPEN ============
    await step('S3', 'REOPEN từ CLOSED (reason) → Đang hoạt động', async (id) => {
      const r = await api('PATCH', `/api/v1/projects/${idA}/status`, adminToken,
        { action: 'REOPEN', reason: 'Mở lại: phát sinh hạng mục bổ sung (đợt T9/2026)' });
      if (r.status !== 200 || r.body.status !== 'ACTIVE') {
        return fail(id, `REOPEN status=${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
      }
      await gotoDetail(adminPage, idA, 'Đang hoạt động');
      await snap(adminPage, `${id}-reopened`, 'VDA2-A sau REOPEN (Đang hoạt động)');
      const db = psqlT(`SELECT status FROM projects WHERE id='${idA}'`);
      const au = psqlT(`SELECT count(*) FROM audit_logs WHERE entity_id='${idA}' AND action='PRJ_PROJECT_STATUS_CHANGED'`);
      if (db !== 'ACTIVE' || au !== '6') return fail(id, `psql=${db} audits=${au} (mong ACTIVE/6)`);
      return ok(id, `REOPEN→ACTIVE; psql ACTIVE; 6 audit STATUS_CHANGED`);
    })();

    // ============ S4: invalid jump DRAFT→COMPLETE ============
    await step('S4', 'Nhảy cóc DRAFT→COMPLETE → 409 INVALID_TRANSITION + allowed list (API + UI)', async (id) => {
      const cb = await createProject(adminToken, C.B);
      if (cb.status !== 201) return fail(id, `tạo VDA2-B status=${cb.status}`);
      idB = cb.body.id;
      const bad = await api('PATCH', `/api/v1/projects/${idB}/status`, adminToken, { action: 'COMPLETE' });
      if (bad.status !== 409 || bad.body.code !== 'INVALID_TRANSITION' || !Array.isArray(bad.body.allowedTransitions)) {
        return fail(id, `mong 409 INVALID_TRANSITION, được ${bad.status} ${JSON.stringify(bad.body).slice(0, 300)}`);
      }
      const allowed = bad.body.allowedTransitions;
      if (!allowed.includes('ACTIVATE') || !allowed.includes('CLOSE')) {
        return fail(id, `allowedTransitions thiếu ACTIVATE/CLOSE: ${JSON.stringify(allowed)}`);
      }
      const db = psqlT(`SELECT status FROM projects WHERE id='${idB}'`);
      if (db !== 'DRAFT') return fail(id, `status đổi sau 409! psql=${db}`);
      // UI: detail DRAFT chỉ hiện Kích hoạt/Đóng (không có Hoàn thành).
      await gotoDetail(adminPage, idB, 'Nháp');
      const bt = await bodyText(adminPage);
      const hasActivate = await adminPage.getByRole('button', { name: 'Kích hoạt', exact: true }).count();
      const hasClose = await adminPage.getByRole('button', { name: 'Đóng', exact: true }).count();
      const hasComplete = await adminPage.getByRole('button', { name: 'Hoàn thành', exact: true }).count();
      if (hasActivate !== 1 || hasClose !== 1 || hasComplete !== 0) {
        return fail(id, `nút UI sai: Kích hoạt=${hasActivate} Đóng=${hasClose} Hoàn thành=${hasComplete}`);
      }
      // UI 409 thật qua race: mở dialog Kích hoạt, API CLOSE trước, rồi xác nhận.
      const cc = await createProject(adminToken, C.Cc);
      idC = cc.body.id;
      await gotoDetail(adminPage, idC, 'Nháp');
      await adminPage.getByRole('button', { name: 'Kích hoạt', exact: true }).click();
      await adminPage.waitForSelector('#project-status-reason', { timeout: 15000 });
      const race = await api('PATCH', `/api/v1/projects/${idC}/status`, adminToken, { action: 'CLOSE', reason: 'Đóng trước để kiểm thử song song (đợt T9/2026)' });
      if (race.status !== 200) return fail(id, `race CLOSE status=${race.status}`);
      await adminPage.getByRole('button', { name: 'Xác nhận kích hoạt', exact: true }).click();
      await adminPage.waitForFunction(
        () => (document.body.textContent || '').includes('Không thể chuyển trạng thái'),
        { timeout: 25000 });
      await snap(adminPage, `${id}-invalid-ui`, 'UI 409: allowed list (Mở lại)');
      const ut = await bodyText(adminPage);
      if (!ut.includes('Mở lại')) return fail(id, `UI 409 thiếu allowed list tiếng Việt: ${ut.slice(-300)}`);
      const dbC = psqlT(`SELECT status FROM projects WHERE id='${idC}'`);
      if (dbC !== 'CLOSED') return fail(id, `VDA2-C psql=${dbC} (mong CLOSED)`);
      return ok(id, `API 409 allowed=[${allowed}]; UI DRAFT 2 nút đúng; UI race 409 hiện 'Mở lại'`);
    })();

    // ============ S5: missing reason ============
    await step('S5', 'PAUSE thiếu reason → API 400 fieldErrors + UI chặn client, status giữ nguyên', async (id) => {
      const r = await api('PATCH', `/api/v1/projects/${idB}/status`, adminToken, { action: 'PAUSE' });
      if (r.status !== 400 || !(r.body.fieldErrors && r.body.fieldErrors.reason)) {
        return fail(id, `mong 400 fieldErrors.reason, được ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
      }
      const dbB = psqlT(`SELECT status FROM projects WHERE id='${idB}'`);
      if (dbB !== 'DRAFT') return fail(id, `VDA2-B đổi sau 400! psql=${dbB}`);
      // UI: VDA2-A đang ACTIVE → mở dialog Tạm dừng, xác nhận rỗng → lỗi client, 0 request.
      await gotoDetail(adminPage, idA, 'Đang hoạt động');
      await adminPage.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
      await adminPage.waitForSelector('#project-status-reason', { timeout: 15000 });
      let postCount = 0;
      const listener = (req) => {
        if (req.url().includes(`/projects/${idA}/status`)) postCount += 1;
      };
      adminPage.on('request', listener);
      await adminPage.getByRole('button', { name: 'Xác nhận tạm dừng', exact: true }).click();
      await adminPage.waitForSelector('#project-status-reason-error', { timeout: 15000 });
      await new Promise((res) => setTimeout(res, 800));
      adminPage.off('request', listener);
      await snap(adminPage, `${id}-reason-required`, 'Dialog PAUSE thiếu reason (lỗi client)');
      const dt = await bodyText(adminPage);
      if (!dt.includes('Lý do là bắt buộc')) return fail(id, 'thiếu lỗi client Lý do là bắt buộc');
      if (postCount !== 0) return fail(id, `client vẫn gửi ${postCount} request khi thiếu reason`);
      await adminPage.getByRole('button', { name: 'Hủy', exact: true }).click();
      const dbA = psqlT(`SELECT status FROM projects WHERE id='${idA}'`);
      if (dbA !== 'ACTIVE') return fail(id, `VDA2-A đổi sau UI chặn! psql=${dbA}`);
      return ok(id, `API 400 reason; UI chặn 0 request + lỗi client; psql DRAFT/ACTIVE nguyên`);
    })();

    // ============ S6: idempotent ============
    await step('S6', 'ACTIVATE 2 lần → alreadyInState, không audit mới (API + UI race)', async (id) => {
      const first = await api('PATCH', `/api/v1/projects/${idB}/status`, adminToken, { action: 'ACTIVATE' });
      if (first.status !== 200 || first.body.alreadyInState !== false) {
        return fail(id, `ACTIVATE lần 1: ${first.status} ${JSON.stringify(first.body).slice(0, 200)}`);
      }
      const before = auditCount(idB, 'PRJ_PROJECT_STATUS_CHANGED');
      const second = await api('PATCH', `/api/v1/projects/${idB}/status`, adminToken, { action: 'ACTIVATE' });
      const after = auditCount(idB, 'PRJ_PROJECT_STATUS_CHANGED');
      if (second.status !== 200 || second.body.alreadyInState !== true) {
        return fail(id, `lần 2 mong alreadyInState:true, được ${second.status} ${JSON.stringify(second.body).slice(0, 200)}`);
      }
      if (before !== after) return fail(id, `audit tăng sau idempotent (${before}→${after})`);
      // UI race: VDA2-D DRAFT → mở dialog Kích hoạt, API ACTIVATE trước, xác nhận → notice.
      const cd = await createProject(adminToken, C.D);
      idD = cd.body.id;
      await gotoDetail(adminPage, idD, 'Nháp');
      await adminPage.getByRole('button', { name: 'Kích hoạt', exact: true }).click();
      await adminPage.waitForSelector('#project-status-reason', { timeout: 15000 });
      const race = await api('PATCH', `/api/v1/projects/${idD}/status`, adminToken, { action: 'ACTIVATE' });
      if (race.status !== 200) return fail(id, `race ACTIVATE status=${race.status}`);
      const audBefore = auditCount(idD, 'PRJ_PROJECT_STATUS_CHANGED');
      await adminPage.getByRole('button', { name: 'Xác nhận kích hoạt', exact: true }).click();
      await adminPage.waitForFunction(
        () => (document.body.textContent || '').includes('Dự án đã ở trạng thái này'),
        { timeout: 25000 });
      await snap(adminPage, `${id}-already-in-state`, 'UI alreadyInState notice');
      const audAfter = auditCount(idD, 'PRJ_PROJECT_STATUS_CHANGED');
      if (audBefore !== audAfter) return fail(id, `UI idempotent ghi thêm audit (${audBefore}→${audAfter})`);
      return ok(id, `API alreadyInState audit ${before}→${after}; UI notice + audit ${audBefore}→${audAfter}`);
    })();

    // ============ S7: worker 403 ============
    await step('S7', 'Worker1: UI không nút chuyển + API PATCH 403', async (id) => {
      const cw = await createProject(adminToken, C.W, W1_ID);
      if (cw.status !== 201) return fail(id, `tạo VDA2-W status=${cw.status}`);
      idW = cw.body.id;
      const wPatch = await api('PATCH', `/api/v1/projects/${idW}/status`, workerToken, { action: 'ACTIVATE' });
      if (wPatch.status !== 403) return fail(id, `worker PATCH status=${wPatch.status} (mong 403)`);
      const db = psqlT(`SELECT status FROM projects WHERE id='${idW}'`);
      if (db !== 'DRAFT') return fail(id, `worker đổi được status! psql=${db}`);
      // Worker là manager-member nên đọc được detail (200) nhưng không có nút chuyển.
      const wGet = await api('GET', `/api/v1/projects/${idW}`, workerToken);
      await loginWeb(workerPage, WORKER_EMAIL, WORKER_PASS);
      await workerPage.goto(`${WEB}/projects/${idW}`, { waitUntil: 'networkidle' });
      await workerPage.waitForFunction((code) => (document.body.textContent || '').includes(code), C.W, { timeout: 25000 });
      await snap(workerPage, `${id}-worker-detail`, 'Worker xem detail (không nút chuyển)');
      const wt = await bodyText(workerPage);
      const wBtns = await workerPage.getByRole('button', { name: /Kích hoạt|Tạm dừng|Hoàn thành|Đóng|Mở lại|Tiếp tục hoạt động/ }).count();
      if (wBtns !== 0) return fail(id, `worker thấy ${wBtns} nút chuyển trạng thái`);
      if (wt.includes('Chuyển trạng thái:')) return fail(id, 'worker thấy hàng Chuyển trạng thái');
      return ok(id, `API 403; GET detail=${wGet.status}; UI 0 nút chuyển (psql DRAFT nguyên)`);
    })();

    // ============ S8: history ============
    await step('S8', 'Timeline VDA2-A đủ 6 transitions đúng thứ tự + psql dump', async (id) => {
      await gotoDetail(adminPage, idA, 'Đang hoạt động');
      await adminPage.waitForFunction(
        () => (document.body.textContent || '').includes('Lịch sử trạng thái'),
        { timeout: 25000 });
      await new Promise((res) => setTimeout(res, 1500));
      await snap(adminPage, `${id}-timeline`, 'Lịch sử trạng thái VDA2-A');
      const t = await bodyText(adminPage);
      // Ghi nhận F1 (§4a): timeline là cửa sổ 10 bản ghi mới nhất — mỗi lần admin
      // đọc detail, iam reads ghi thêm audit PROJECT_SCOPE_ADMIN_BYPASS cùng
      // entity_id, nên 6 transitions bị đẩy bớt khỏi cửa sổ. History đầy đủ nằm ở
      // DB append-only + deep-link 'Xem tất cả' (entityType+entityId+result).
      const changeCount = (t.match(/Đổi trạng thái dự án/g) || []).length;
      if (changeCount < 1) return fail(id, `timeline không hiện 'Đổi trạng thái dự án' nào`);
      const deepLink = await adminPage.locator(`a[href^="/admin/audit-logs?entityType=PROJECT&entityId=${idA}"]`).count();
      if (deepLink < 1) return fail(id, 'thiếu deep-link Xem tất cả (entityType=PROJECT&entityId&result=SUCCESS)');
      const bypass = psqlT(`SELECT count(*) FROM audit_logs WHERE entity_id='${idA}' AND action='PROJECT_SCOPE_ADMIN_BYPASS'`);
      if (bypass === '0') return fail(id, 'mong có PROJECT_SCOPE_ADMIN_BYPASS (giải thích cửa sổ 10)');
      const dump = psqlT(`SELECT action||'|'||coalesce(before_data->>'status','-')||'->'||coalesce(after_data->>'status','-')||'|'||left(coalesce(reason,''),28) FROM audit_logs WHERE entity_id='${idA}' ORDER BY created_at`);
      const rows = dump.split('\n').filter(Boolean);
      const seq = rows.filter((r) => r.startsWith('PRJ_PROJECT_STATUS_CHANGED'));
      const wantSeq = [
        'PRJ_PROJECT_STATUS_CHANGED|DRAFT->ACTIVE|',
        'PRJ_PROJECT_STATUS_CHANGED|ACTIVE->PAUSED|Tạm dừng: chờ vật tư',
        'PRJ_PROJECT_STATUS_CHANGED|PAUSED->ACTIVE|',
        'PRJ_PROJECT_STATUS_CHANGED|ACTIVE->COMPLETED|',
        'PRJ_PROJECT_STATUS_CHANGED|COMPLETED->CLOSED|Đóng: đã nghiệm thu',
        'PRJ_PROJECT_STATUS_CHANGED|CLOSED->ACTIVE|Mở lại: phát sinh',
      ];
      if (seq.length !== 6) return fail(id, `psql transitions=${seq.length} (mong 6): ${dump.slice(0, 400)}`);
      for (let i = 0; i < 6; i += 1) {
        if (!seq[i].startsWith(wantSeq[i])) return fail(id, `thứ tự sai dòng ${i}: ${seq[i]} (mong ^${wantSeq[i]})`);
      }
      if (!rows[0].startsWith('PRJ_PROJECT_CREATED')) return fail(id, `dòng đầu không phải CREATED: ${rows[0]}`);
      return ok(id, `timeline cửa sổ 10 (thấy ${changeCount} transitions + deep-link); bypass rows=${bypass}; psql 7+ rows đúng thứ tự, history append-only`);
    })();

    // ============ S9: PM transition ============
    await step('S9', 'PM ACTIVATE VDA2-PM qua API (audit actor pm)', async (id) => {
      const cp = await createProject(adminToken, C.PM, W2_ID);
      if (cp.status !== 201) return fail(id, `tạo VDA2-PM status=${cp.status}`);
      idPM = cp.body.id;
      const r = await api('PATCH', `/api/v1/projects/${idPM}/status`, pmToken, { action: 'ACTIVATE' });
      if (r.status !== 200 || r.body.status !== 'ACTIVE') {
        return fail(id, `PM ACTIVATE status=${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
      }
      const au = psqlT(`SELECT actor_user_id||'|'||coalesce(before_data->>'status','?')||'->'||coalesce(after_data->>'status','?') FROM audit_logs WHERE entity_id='${idPM}' AND action='PRJ_PROJECT_STATUS_CHANGED'`);
      if (au !== `${PM_ID}|DRAFT->ACTIVE`) return fail(id, `audit actor sai: ${au}`);
      return ok(id, `PM ACTIVATE 200 ACTIVE; audit actor pm DRAFT->ACTIVE`);
    })();

    // ============ S10: correlation ============
    await step('S10', 'X-Correlation-Id strict trên PATCH status + audit carry', async (id) => {
      const cr = await createProject(adminToken, C.R);
      if (cr.status !== 201) return fail(id, `tạo VDA2-R status=${cr.status}`);
      idR = cr.body.id;
      const corr = uuid();
      const r = await api('PATCH', `/api/v1/projects/${idR}/status`, adminToken,
        { action: 'ACTIVATE' }, { 'X-Correlation-Id': corr });
      if (r.status !== 200) return fail(id, `PATCH corr status=${r.status}`);
      const au = psqlT(`SELECT correlation_id FROM audit_logs WHERE entity_id='${idR}' AND action='PRJ_PROJECT_STATUS_CHANGED'`);
      if (au !== corr) return fail(id, `audit corr=${au} (mong ${corr})`);
      const bad = await api('PATCH', `/api/v1/projects/${idR}/status`, adminToken,
        { action: 'PAUSE', reason: 'x' }, { 'X-Correlation-Id': 'not-a-uuid' });
      if (bad.status !== 400) return fail(id, `corr xấu status=${bad.status} (mong 400 strict)`);
      const db = psqlT(`SELECT status FROM projects WHERE id='${idR}'`);
      if (db !== 'ACTIVE') return fail(id, `status đổi sau corr xấu! psql=${db}`);
      return ok(id, `audit corr=${corr}; corr xấu 400, psql ACTIVE nguyên`);
    })();

    // ============ S11: timeline filter ============
    await step('S11', 'Audit filter entityType=PROJECT chỉ trả events dự án (API + UI)', async (id) => {
      const r = await api('GET', `/api/v1/audit-logs?entityType=PROJECT&entityId=${idA}&result=SUCCESS`, adminToken);
      const rows = r.body && Array.isArray(r.body.data) ? r.body.data : null;
      if (!rows || rows.length < 7) return fail(id, `audit-logs trả ${rows ? rows.length : '?'} rows (mong ≥7)`);
      if (!rows.every((a) => a.entityType === 'PROJECT' && a.entityId === idA)) {
        return fail(id, 'filter lọt entity khác');
      }
      const actions = rows.map((a) => a.action);
      if (!actions.includes('PRJ_PROJECT_CREATED') || !actions.includes('PRJ_PROJECT_STATUS_CHANGED')) {
        return fail(id, `thiếu actions: ${JSON.stringify(actions).slice(0, 200)}`);
      }
      if (rows.some((a) => /WORKER|CREW|CONTRACTOR/.test(a.action))) {
        return fail(id, 'timeline dự án lẫn events worker/crew');
      }
      return ok(id, `${rows.length} rows toàn PROJECT của VDA2-A, không lẫn worker/crew`);
    })();
  } finally {
    runCleanup();
    const rest = psqlT(`SELECT count(*) FROM projects WHERE code LIKE 'VDA2-%'`);
    const auditFinal = psqlT('SELECT count(*) FROM audit_logs');
    console.log(`cleanup: VDA2-% rest=${rest}, audit ${auditBaseline}→${auditFinal} (tăng do transitions hợp lệ; audit giữ nguyên)`);
    fs.writeFileSync(path.join(__dirname, 'e2e-vars.json'), JSON.stringify({
      _note: 'Throwaway E2E-only demo credentials (seed/reset per evidence docs). Never production.',
      admin: ADMIN_EMAIL, pm: PM_EMAIL, worker: WORKER_EMAIL,
      codes: C,
      projectIds: { A: idA, B: idB, C: idC, D: idD, W: idW, PM: idPM, R: idR },
      auditBaseline, auditFinal, rest, results,
    }, null, 2));
    const passed = results.filter((r) => r.ok).length;
    console.log(`\nTỔNG: ${passed}/${results.length} PASS`);
    await browser.close().catch(() => {});
    process.exit(passed === results.length ? 0 : 1);
  }
})();
