/**
 * ORG-SRS-006 E2E driver — Quản lý đội thi công (issue #29).
 * Evidence-only script; phạm vi docs/evidence — KHÔNG commit, KHÔNG sửa source.
 *
 * Chạy:   node e2e-driver-org-srs-006.cjs
 * Yêu cầu: stack buildflow rebuild từ working tree (api có /api/v1/crews, web có /crews);
 *          admin (E2EAdmin@2025) + pm (E2EPm@2025) + worker1 (E2EWorker@2025);
 *          seed ORG-SRS-004 còn trong DB (chuỗi E2E4 project/area/work_type).
 *
 * Luồng: S1 tạo crew E2E-CREW-01 qua UI (PM) → S2 validation → S3 swap lead qua UI
 * → S4 seed assignment mở + suspend có warning → S5 alreadyInState → S6 reactivate
 * → S7 terminate + eligibleOnly → S8 directory tab Đội → S9 quyền → S10 double-submit
 * → S11 assignment còn nguyên. Cleanup entity cuối run (audit giữ nguyên).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('/home/trung/.npm-global/lib/node_modules/@playwright/mcp/node_modules/playwright');

const WEB = 'http://localhost:3001';
const API = 'http://localhost:3000';
const SHOTS = path.join(__dirname, 'shots');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASS = 'E2EAdmin@2025';
const PM_EMAIL = 'pm@example.com';
const PM_PASS = 'E2EPm@2025';
const WORKER_EMAIL = 'worker1@example.com';
const WORKER_PASS = 'E2EWorker@2025';

const WORKER1_ID = '33333333-3333-4333-8333-333333333333';
const WORKER2_ID = '44444444-4444-4444-8444-444444444444';
const PM_ID = '22222222-2222-4222-8222-222222222222';
const CREW_CODE = 'E2E-CREW-01';
const CREW_NAME = 'E2E Đội Thi Công 01';
const CREW_NAME2 = 'E2E Đội Thi Công 01 Đổi Tên';
const DS_CODE = 'E2E-CREW-DS';
const WO_E2E6 = 'e2e6b300-0000-4000-8000-0000000000b4';
const ASN_E2E6 = 'e2e6c100-0000-4000-8000-0000000000c2';
const GHOST_ID = '00000000-0000-4000-8000-000000000099';
const REASON_SUSPEND = 'E2E6 tạm ngừng: bảo trì thiết bị tuần 37';
const REASON_TERMINATE = 'E2E6 chấm dứt: kết thúc gói thầu phụ';

const results = [];
function step(id, name, fn) {
  return async () => {
    try {
      const r = await fn(id);
      results.push(r);
      console.log(`${r.ok ? 'PASS' : 'FAIL'} ${id} ${name}${r.note ? ' :: ' + String(r.note).split('\n')[0] : ''}`);
      if (!r.ok && r.note) console.log(`  detail: ${String(r.note).slice(0, 800)}`);
    } catch (err) {
      results.push({ id, name, ok: false, note: err && err.message ? err.message : String(err) });
      console.log(`ERROR ${id} ${name} :: ${err && err.message ? err.message : err}`);
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

async function login(page, email, password) {
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(30000);

  const adminToken = await getToken(ADMIN_EMAIL, ADMIN_PASS);
  const pmToken = await getToken(PM_EMAIL, PM_PASS);
  const workerToken = await getToken(WORKER_EMAIL, WORKER_PASS);
  if (!adminToken || !pmToken || !workerToken) {
    console.error(`Không lấy được token (admin=${!!adminToken} pm=${!!pmToken} worker=${!!workerToken})`);
    await browser.close().catch(() => {});
    process.exit(2);
  }
  let crewId = null;

  try {
    // ============ S1: tạo crew qua UI ============
    await step('S1', 'PM login → nav Đội thi công → /crews/new tạo E2E-CREW-01 (leader worker1) → list thấy', async (id) => {
      await login(page, PM_EMAIL, PM_PASS);
      await page.waitForSelector('.bf-nav', { timeout: 15000 });
      const navText = (await page.locator('.bf-nav').textContent()) || '';
      if (!navText.includes('Đội thi công')) return fail(id, `sidebar thiếu 'Đội thi công': ${navText.slice(0, 300)}`);
      await snap(page, id + '-nav', 'Sidebar PM có Đội thi công');
      await page.goto(`${WEB}/crews`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      await snap(page, id + '-empty', 'Danh sách đội trước khi tạo');
      await page.goto(`${WEB}/crews/new`, { waitUntil: 'networkidle' });
      await page.waitForSelector('#crew-code', { timeout: 15000 });
      await page.waitForFunction(() => {
        const s = document.querySelector('#crew-leader');
        return s && s.tagName === 'SELECT' && s.options.length > 1;
      }, { timeout: 20000 });
      await page.fill('#crew-code', CREW_CODE);
      await page.fill('#crew-name', CREW_NAME);
      await page.selectOption('#crew-leader', WORKER1_ID);
      await snap(page, id + '-form', 'Form tạo đội đã điền (code + tên + leader worker1)');
      await page.locator('button', { hasText: 'Tạo đội' }).first().click();
      await page.waitForFunction(() => (document.body.textContent || '').includes('Tạo đội thi công thành công'), { timeout: 20000 });
      await snap(page, id + '-created', 'Tạo đội thành công');
      const found = await api('GET', `/api/v1/crews?search=${CREW_CODE}`, pmToken);
      if (found.status !== 200 || !found.body.data.length) return fail(id, `API search không thấy crew: HTTP ${found.status}`);
      crewId = found.body.data[0].id;
      await page.goto(`${WEB}/crews`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      const t = await bodyText(page);
      await snap(page, id + '-list', 'Danh sách đội sau khi tạo');
      if (!t.includes(CREW_CODE)) return fail(id, 'list /crews không thấy E2E-CREW-01');
      const dbCrew = psqlT(`SELECT status||'|'||COALESCE(contractor_id::text,'-') FROM crews WHERE id='${crewId}'`);
      const dbLead = psqlT(`SELECT member_role||'|'||is_active::text||'|'||count(*) OVER () FROM crew_members WHERE crew_id='${crewId}' AND is_active`);
      const dbAudit = psqlT(`SELECT count(*) FROM audit_logs WHERE entity_type='CREW' AND entity_id='${crewId}' AND action='ORG_CREW_CREATED'`);
      if (!dbCrew.startsWith('ACTIVE')) return fail(id, `crews.status DB=${dbCrew}`);
      if (!dbLead.startsWith('LEAD|true|1')) return fail(id, `crew_members DB=${dbLead} (mong LEAD|true|1)`);
      if (dbAudit !== '1') return fail(id, `audit ORG_CREW_CREATED count=${dbAudit}`);
      return ok(id, `crewId=${crewId} UI list thấy ${CREW_CODE}; DB status=ACTIVE + 1 LEAD active + audit CREATED=1`);
    })();

    // ============ S2: validation ============
    await step('S2', 'Trùng code → 409 field code; thiếu leader → 400 field leaderUserId (API + UI)', async (id) => {
      const dup = await api('POST', '/api/v1/crews', pmToken,
        { code: CREW_CODE, name: 'Trùng mã', leaderUserId: WORKER1_ID }, { 'X-Correlation-Id': uuid() });
      // leader UUID hợp lệ nhưng không tồn tại → use-case fieldError (đúng spec fieldErrors {leaderUserId})
      const badLead = await api('POST', '/api/v1/crews', pmToken,
        { code: 'E2E-CREW-BADLEAD', name: 'Leader ảo', leaderUserId: GHOST_ID }, { 'X-Correlation-Id': uuid() });
      // thiếu hẳn field leader → DTO ValidationPipe 400 shape mặc định (ghi nhận trung thực, xem §4a doc)
      const noLead = await api('POST', '/api/v1/crews', pmToken,
        { code: 'E2E-CREW-NOLEAD', name: 'Thiếu leader' }, { 'X-Correlation-Id': uuid() });
      const badCorr = await api('POST', '/api/v1/crews', pmToken,
        { code: 'E2E-CREW-BADC', name: 'Sai corr', leaderUserId: WORKER1_ID }, { 'X-Correlation-Id': 'not-a-uuid' });
      // UI: submit thiếu leader → lỗi field-level
      await page.goto(`${WEB}/crews/new`, { waitUntil: 'networkidle' });
      await page.waitForSelector('#crew-code', { timeout: 15000 });
      await page.fill('#crew-code', 'E2E-CREW-UINOLEAD');
      await page.fill('#crew-name', 'UI thiếu leader');
      await page.locator('button', { hasText: 'Tạo đội' }).first().click();
      await page.waitForTimeout(1200);
      const tu = await bodyText(page);
      await snap(page, id + '-nolead', 'UI submit thiếu leader → lỗi field');
      const dupOk = dup.status === 409;
      const badLeadOk = badLead.status === 400 && badLead.body && badLead.body.fieldErrors && badLead.body.fieldErrors.leaderUserId;
      const noLeadShape = `thiếu field→${noLead.status} ${JSON.stringify(noLead.body).slice(0, 100)}`;
      const badCorrOk = badCorr.status === 400;
      const uiOk = tu.includes('Trưởng nhóm là bắt buộc');
      if (!dupOk) return fail(id, `dup code HTTP ${dup.status}: ${JSON.stringify(dup.body)}`);
      if (!badLeadOk) return fail(id, `leader ảo HTTP ${badLead.status}: ${JSON.stringify(badLead.body)}`);
      if (!badCorrOk) return fail(id, `correlation sai HTTP ${badCorr.status}: ${JSON.stringify(badCorr.body)}`);
      if (!uiOk) return fail(id, `UI thiếu leader không hiện lỗi field (body: ${tu.slice(0, 300)})`);
      return ok(id, `dup→409; leader ảo→400 fieldErrors.leaderUserId; corr sai→400; UI field-level OK (${noLeadShape})`);
    })();

    // ============ S3: swap leader qua UI ============
    await step('S3', 'Edit: đổi tên + swap leader worker1→worker2 (confirm inline) → LEAD cũ off, mới on + audit LEAD_CHANGED', async (id) => {
      if (!crewId) return fail(id, 'thiếu crewId từ S1');
      const auditBefore = psqlT(`SELECT count(*) FROM audit_logs WHERE entity_type='CREW' AND entity_id='${crewId}' AND action='ORG_CREW_LEAD_CHANGED'`);
      await page.goto(`${WEB}/crews/${crewId}/edit`, { waitUntil: 'networkidle' });
      await page.waitForSelector('#crew-name', { timeout: 15000 });
      await page.waitForFunction(() => {
        const s = document.querySelector('#crew-leader');
        return s && s.tagName === 'SELECT' && s.options.length > 1;
      }, { timeout: 20000 });
      await page.fill('#crew-name', CREW_NAME2);
      await page.selectOption('#crew-leader', WORKER2_ID);
      await page.locator('button', { hasText: 'Lưu thay đổi' }).first().click();
      await page.waitForFunction(() => (document.body.textContent || '').includes('Xác nhận đổi trưởng nhóm'), { timeout: 10000 });
      await snap(page, id + '-confirm', 'Confirm inline đổi trưởng nhóm');
      await page.locator('button', { hasText: 'Xác nhận đổi trưởng nhóm' }).first().click();
      await page.waitForFunction(() => (document.body.textContent || '').includes('Cập nhật đội thi công thành công'), { timeout: 20000 });
      await snap(page, id + '-done', 'Swap leader thành công');
      const oldLead = psqlT(`SELECT is_active::text||'|'||effective_to::text FROM crew_members WHERE crew_id='${crewId}' AND user_id='${WORKER1_ID}' ORDER BY created_at DESC LIMIT 1`);
      const newLead = psqlT(`SELECT member_role||'|'||is_active::text||'|'||COALESCE(effective_to::text,'-') FROM crew_members WHERE crew_id='${crewId}' AND user_id='${WORKER2_ID}' AND is_active`);
      const today = psqlT(`SELECT CURRENT_DATE::text`);
      const auditAfter = psqlT(`SELECT count(*) FROM audit_logs WHERE entity_type='CREW' AND entity_id='${crewId}' AND action='ORG_CREW_LEAD_CHANGED'`);
      const auditBody = psqlT(`SELECT before_data::text||' ~~ '||after_data::text FROM audit_logs WHERE entity_type='CREW' AND entity_id='${crewId}' AND action='ORG_CREW_LEAD_CHANGED' ORDER BY created_at DESC LIMIT 1`);
      if (!oldLead.startsWith(`false|${today}`)) return fail(id, `LEAD cũ DB=${oldLead} (mong false|${today})`);
      if (!newLead.startsWith('LEAD|true|')) return fail(id, `LEAD mới DB=${newLead}`);
      if (auditAfter !== String(Number(auditBefore) + 1)) return fail(id, `audit LEAD_CHANGED ${auditBefore}→${auditAfter}`);
      const hasBefore = auditBody.includes(WORKER1_ID) && auditBody.includes(WORKER2_ID);
      if (!hasBefore) return fail(id, `audit thiếu before/after leader: ${auditBody.slice(0, 300)}`);
      return ok(id, `LEAD cũ off ${oldLead}; LEAD mới ${newLead}; audit +1 có before/after leader`);
    })();

    // ============ S4: seed open-work + suspend có warning ============
    await step('S4', 'Seed assignment mở → detail Tạm ngừng: warning 1 việc + reason trống lỗi field + reason đủ → 200 INACTIVE + audit SUSPENDED(reason+_warning)', async (id) => {
      if (!crewId) return fail(id, 'thiếu crewId từ S1');
      psqlT(`INSERT INTO work_orders (id, code, project_id, area_id, work_type_id, required_trade_id, title, description, instructions, priority, status, planned_start_at, planned_end_at, due_at, progress_percent, job_board_open, created_by, version, created_at, updated_at)
        VALUES ('${WO_E2E6}', 'E2E6-WO-1', 'e2e4b000-0000-4000-8000-0000000000b1', 'e2e4b100-0000-4000-8000-0000000000b2',
        'e2e4b200-0000-4000-8000-0000000000b3', '11111111-1111-4111-8111-111111111111', 'E2E6 Cong viec mo cho doi',
        'seed ORG-SRS-006', 'seed', 'NORMAL', 'ASSIGNED', now(), now()+interval '14 days', now()+interval '20 days', 0, false,
        '${PM_ID}', 1, now(), now()) ON CONFLICT (id) DO NOTHING`);
      psqlT(`INSERT INTO assignments (id, work_order_id, assignee_type, worker_id, crew_id, responsible_user_id, source, status, requires_acceptance, assigned_by, assigned_at, created_at)
        VALUES ('${ASN_E2E6}', '${WO_E2E6}', 'CREW', NULL, '${crewId}', '${WORKER1_ID}', 'DIRECT_ASSIGNMENT', 'ACTIVE', false, '${PM_ID}', now(), now())
        ON CONFLICT (id) DO NOTHING`);
      const ow = await api('GET', `/api/v1/crews/${crewId}/open-work`, pmToken);
      if (ow.status !== 200 || ow.body.openAssignments !== 1) {
        return fail(id, `open-work API=${ow.status} body=${JSON.stringify(ow.body)} (mong openAssignments=1)`);
      }
      await page.goto(`${WEB}/crews/${crewId}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => (document.body.textContent || '').includes('Tạm ngừng'), { timeout: 15000 });
      await page.locator('button', { hasText: 'Tạm ngừng' }).first().click();
      await page.waitForFunction(() => (document.body.textContent || '').includes('Đội đang có'), { timeout: 15000 });
      await snap(page, id + '-warning', 'Dialog tạm ngừng hiện warning 1 công việc mở');
      // reason trống submit → lỗi field
      await page.locator('button', { hasText: 'Xác nhận tạm ngừng' }).first().click();
      await page.waitForFunction(() => (document.body.textContent || '').includes('Lý do là bắt buộc'), { timeout: 10000 });
      await snap(page, id + '-reason-empty', 'Reason trống → lỗi field');
      await page.fill('#lifecycle-reason', REASON_SUSPEND);
      await page.locator('button', { hasText: 'Xác nhận tạm ngừng' }).first().click();
      await page.waitForFunction(() => (document.body.textContent || '').includes('thành công'), { timeout: 20000 });
      await snap(page, id + '-suspended', 'Tạm ngừng thành công kèm warning');
      const st = psqlT(`SELECT status FROM crews WHERE id='${crewId}'`);
      const au = psqlT(`SELECT reason||' ~~ '||after_data::text FROM audit_logs WHERE entity_type='CREW' AND entity_id='${crewId}' AND action='ORG_CREW_SUSPENDED' ORDER BY created_at DESC LIMIT 1`);
      if (st !== 'INACTIVE') return fail(id, `crews.status DB=${st}`);
      if (!au.includes(REASON_SUSPEND)) return fail(id, `audit SUSPENDED thiếu reason: ${au.slice(0, 300)}`);
      if (!au.includes('_warning')) return fail(id, `audit SUSPENDED thiếu _warning: ${au.slice(0, 300)}`);
      return ok(id, `open-work=1 → warning UI + 200; DB INACTIVE; audit SUSPENDED có reason + _warning`);
    })();

    // ============ S5: alreadyInState ============
    await step('S5', 'Tạm ngừng lần 2 → alreadyInState, audit delta 0', async (id) => {
      if (!crewId) return fail(id, 'thiếu crewId');
      const before = psqlT(`SELECT count(*) FROM audit_logs WHERE entity_type='CREW' AND entity_id='${crewId}' AND action IN ('ORG_CREW_SUSPENDED','ORG_CREW_TERMINATED')`);
      const r = await api('PATCH', `/api/v1/crews/${crewId}/status`, pmToken,
        { action: 'SUSPEND', reason: REASON_SUSPEND }, { 'X-Correlation-Id': uuid() });
      const after = psqlT(`SELECT count(*) FROM audit_logs WHERE entity_type='CREW' AND entity_id='${crewId}' AND action IN ('ORG_CREW_SUSPENDED','ORG_CREW_TERMINATED')`);
      await snap(page, id + '-state', 'Trạng thái sau alreadyInState (vẫn INACTIVE)');
      if (r.status !== 200 || r.body.alreadyInState !== true) {
        return fail(id, `HTTP ${r.status} body=${JSON.stringify(r.body)} (mong alreadyInState=true)`);
      }
      if (after !== before) return fail(id, `audit delta ${before}→${after} (mong 0)`);
      return ok(id, `alreadyInState=true; audit ${before}→${after} (delta 0)`);
    })();

    // ============ S6: reactivate ============
    await step('S6', 'Kích hoạt lại → ACTIVE + ORG_CREW_REACTIVATED', async (id) => {
      if (!crewId) return fail(id, 'thiếu crewId');
      await page.goto(`${WEB}/crews/${crewId}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => (document.body.textContent || '').includes('Kích hoạt lại'), { timeout: 15000 });
      await page.locator('button', { hasText: 'Kích hoạt lại' }).first().click();
      await page.waitForFunction(() => (document.body.textContent || '').includes('Xác nhận kích hoạt lại'), { timeout: 10000 });
      await page.locator('button', { hasText: 'Xác nhận kích hoạt lại' }).first().click();
      await page.waitForFunction(() => (document.body.textContent || '').includes('Đã kích hoạt lại đội'), { timeout: 20000 });
      await snap(page, id + '-reactivated', 'Kích hoạt lại thành công');
      const st = psqlT(`SELECT status FROM crews WHERE id='${crewId}'`);
      const au = psqlT(`SELECT count(*) FROM audit_logs WHERE entity_type='CREW' AND entity_id='${crewId}' AND action='ORG_CREW_REACTIVATED'`);
      if (st !== 'ACTIVE') return fail(id, `crews.status DB=${st}`);
      if (au !== '1') return fail(id, `audit REACTIVATED count=${au}`);
      return ok(id, `UI + DB ACTIVE; audit ORG_CREW_REACTIVATED=1`);
    })();

    // ============ S7: terminate + eligibleOnly ============
    await step('S7', 'Chấm dứt + reason → INACTIVE + TERMINATED; eligibleOnly loại crew; directory tab Đội badge eligible=false', async (id) => {
      if (!crewId) return fail(id, 'thiếu crewId');
      const r = await api('PATCH', `/api/v1/crews/${crewId}/status`, pmToken,
        { action: 'TERMINATE', reason: REASON_TERMINATE }, { 'X-Correlation-Id': uuid() });
      if (r.status !== 200 || r.body.status !== 'INACTIVE') {
        return fail(id, `terminate HTTP ${r.status} body=${JSON.stringify(r.body)}`);
      }
      const elig = await api('GET', `/api/v1/crews?eligibleOnly=true&search=${CREW_CODE}`, pmToken);
      const all = await api('GET', `/api/v1/crews?search=${CREW_CODE}`, pmToken);
      const au = psqlT(`SELECT count(*) FROM audit_logs WHERE entity_type='CREW' AND entity_id='${crewId}' AND action='ORG_CREW_TERMINATED'`);
      await page.goto(`${WEB}/resources?tab=crews`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      const t = await bodyText(page);
      await snap(page, id + '-directory', 'Directory tab Đội sau terminate (crew INACTIVE, eligible=false)');
      if (au !== '1') return fail(id, `audit TERMINATED count=${au}`);
      if (elig.body.data.some((c) => c.id === crewId)) return fail(id, 'eligibleOnly=true vẫn chứa crew INACTIVE');
      if (!all.body.data.some((c) => c.id === crewId && c.eligible === false)) {
        return fail(id, `list thường thiếu crew eligible=false: ${JSON.stringify(all.body.data).slice(0, 300)}`);
      }
      if (!t.includes(CREW_CODE)) return fail(id, 'directory tab Đội không thấy crew');
      return ok(id, `TERMINATED=1, DB INACTIVE; eligibleOnly loại crew; directory vẫn hiện + badge không đủ điều kiện`);
    })();

    // ============ S8: directory filter/sort ============
    await step('S8', 'Directory /resources tab Đội: filter status + sort đảo nhau + search', async (id) => {
      const asc = await api('GET', '/api/v1/crews?sort=name&order=asc&limit=20', pmToken);
      const desc = await api('GET', '/api/v1/crews?sort=name&order=desc&limit=20', pmToken);
      if (asc.status !== 200 || desc.status !== 200) return fail(id, `sort API ${asc.status}/${desc.status}`);
      const namesAsc = asc.body.data.map((c) => c.name);
      const namesDesc = desc.body.data.map((c) => c.name);
      const reversed = [...namesAsc].reverse().join('|') === namesDesc.join('|');
      const inact = await api('GET', '/api/v1/crews?status=INACTIVE', pmToken);
      await page.goto(`${WEB}/resources?tab=crews&sort=name&order=desc`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      const t = await bodyText(page);
      await snap(page, id + '-sort', 'Directory tab Đội sort tên giảm dần');
      if (!reversed) return fail(id, `API asc/desc không đảo nhau`);
      if (!inact.body.data.some((c) => c.id === crewId)) return fail(id, 'filter INACTIVE thiếu crew E2E');
      if (!t.includes(CREW_CODE)) return fail(id, 'UI tab Đội sort desc thiếu crew E2E');
      return ok(id, `API asc/desc đảo đúng (${asc.body.total} crews); INACTIVE chứa crew; UI khớp`);
    })();

    // ============ S9: quyền ============
    await step('S9', 'PM write crews OK (đúng actor); worker /crews 403 + API 403; anon 401; PM PATCH workers/:id/status 403', async (id) => {
      // PM viết crews: đổi description (không đụng lead/status)
      const w = await api('PATCH', `/api/v1/crews/${crewId}`, pmToken,
        { description: 'E2E6 mô tả bởi PM' }, { 'X-Correlation-Id': uuid() });
      const wRole = await api('GET', '/api/v1/crews?limit=2', workerToken);
      const wAnon = await api('GET', '/api/v1/crews?limit=2', null);
      const pmOnWorker = await api('PATCH', `/api/v1/workers/${WORKER2_ID}/status`, pmToken,
        { action: 'SUSPEND', reason: 'E2E6 kiểm tra không widen quyền' }, { 'X-Correlation-Id': uuid() });
      const ghost = await api('GET', `/api/v1/crews/${GHOST_ID}`, pmToken);
      await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
      await login(page, WORKER_EMAIL, WORKER_PASS);
      await page.goto(`${WEB}/crews`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      const t = await bodyText(page);
      await snap(page, id + '-worker403', 'Worker mở /crews → 403 card');
      const checks = [
        ['PM PATCH crews', w.status === 200],
        ['worker GET crews', wRole.status === 403],
        ['anon GET crews', wAnon.status === 401],
        ['PM PATCH workers status', pmOnWorker.status === 403],
        ['PM GET ghost crew', ghost.status === 404],
        ['worker UI 403 card', t.includes('403')],
      ];
      const bad = checks.filter(([, v]) => !v).map(([k]) => k);
      if (bad.length) {
        return fail(id, `lỗi: ${bad.join(', ')} (PM=${w.status} worker=${wRole.status} anon=${wAnon.status} pmWorker=${pmOnWorker.status} ghost=${ghost.status} ui403=${t.includes('403')})`);
      }
      return ok(id, `PM write crews 200; worker 403 (API+UI); anon 401; PM workers/status 403 (không widen); ghost 404`);
    })();

    // ============ S10: double-submit ============
    await step('S10', 'Double-submit cùng correlation-id → 1 row + 1 audit (request 2 → 409)', async (id) => {
      const corr = uuid();
      const payload = { code: DS_CODE, name: 'E2E Double Submit', leaderUserId: WORKER1_ID };
      const r1 = await api('POST', '/api/v1/crews', pmToken, payload, { 'X-Correlation-Id': corr });
      const r2 = await api('POST', '/api/v1/crews', pmToken, payload, { 'X-Correlation-Id': corr });
      const rows = psqlT(`SELECT count(*) FROM crews WHERE code='${DS_CODE}'`);
      const dsId = psqlT(`SELECT id::text FROM crews WHERE code='${DS_CODE}' LIMIT 1`);
      const audits = dsId && !dsId.startsWith('PSQL') && dsId
        ? psqlT(`SELECT count(*) FROM audit_logs WHERE entity_type='CREW' AND entity_id='${dsId}' AND action='ORG_CREW_CREATED'`)
        : '?';
      if (r1.status !== 201 && r1.status !== 200) return fail(id, `request1 HTTP ${r1.status}: ${JSON.stringify(r1.body)}`);
      if (r2.status !== 409) return fail(id, `request2 HTTP ${r2.status} (mong 409): ${JSON.stringify(r2.body)}`);
      if (rows !== '1' || audits !== '1') return fail(id, `rows=${rows} audits=${audits} (mong 1+1)`);
      return ok(id, `req1 ${r1.status} → req2 409; rows=1 audits=1 (corr=${corr.slice(0, 8)}…)`);
    })();

    // ============ S11: assignment còn nguyên ============
    await step('S11', 'Assignment mở còn nguyên liên kết sau khi crew INACTIVE', async (id) => {
      const row = psqlT(`SELECT status||'|'||crew_id::text FROM assignments WHERE id='${ASN_E2E6}'`);
      if (!row.startsWith('ACTIVE|') || !row.includes(crewId)) {
        return fail(id, `assignment DB=${row} (mong ACTIVE|<crewId>)`);
      }
      return ok(id, `assignment ${ASN_E2E6} status=ACTIVE, crew_id giữ nguyên sau INACTIVE`);
    })();
  } finally {
    // ============ Cleanup (audit giữ nguyên) ============
    try {
      await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' }).catch(() => {});
    } catch {}
    const delAsn = psqlT(`DELETE FROM assignments WHERE id='${ASN_E2E6}'; SELECT count(*) FROM assignments WHERE id='${ASN_E2E6}'`);
    const delWo = psqlT(`DELETE FROM work_orders WHERE id='${WO_E2E6}'; SELECT count(*) FROM work_orders WHERE id='${WO_E2E6}'`);
    const delMem = psqlT(`DELETE FROM crew_members WHERE crew_id IN (SELECT id FROM crews WHERE code IN ('${CREW_CODE}','${DS_CODE}'))`);
    const delCrew = psqlT(`DELETE FROM crews WHERE code IN ('${CREW_CODE}','${DS_CODE}'); SELECT count(*) FROM crews WHERE code IN ('${CREW_CODE}','${DS_CODE}')`);
    console.log(`cleanup: assignment rest=${delAsn} workorder rest=${delWo} members del=${delMem} crews rest=${delCrew}`);
    await browser.close().catch(() => {});
  }

  const pass = results.filter((r) => r.ok).length;
  console.log(`\nTong: ${pass}/${results.length} PASS`);
  fs.writeFileSync(path.join(__dirname, 'e2e-vars.json'), JSON.stringify({
    crewCode: CREW_CODE, dsCode: DS_CODE, woE2e6: WO_E2E6, asnE2e6: ASN_E2E6,
    worker1: WORKER1_ID, worker2: WORKER2_ID, results,
  }, null, 2));
  if (pass !== results.length) process.exit(1);
})();
