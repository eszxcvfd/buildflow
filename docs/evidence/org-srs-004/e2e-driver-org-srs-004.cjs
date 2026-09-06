/**
 * ORG-SRS-004 E2E driver — Resource lifecycle status (workers + contractors), issue #27.
 * Evidence-only script; KHÔNG commit (docs/evidence scope — xem ORG-SRS-004-E2E.md).
 *
 * Chạy:   node e2e-driver-org-srs-004.cjs
 * Yêu cầu: docker stack buildflow chạy với api/web rebuild từ working tree
 *          (chứa PATCH /api/v1/workers|contractors/:id/status + GET .../open-work);
 *          admin+pm đã reset password; seed-lifecycle-004.sql đã chạy
 *          (worker E2E4 + contractor E2E4-CON + assignment mở PENDING_ACCEPTANCE).
 *
 * audit_logs append-only → mọi khẳng định audit dùng DELTA theo (action, entity_id).
 * Giả định state: worker/contractor bắt đầu ở ACTIVE (script chuyển về ACTIVE nếu cần).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('/home/trung/.npm-global/lib/node_modules/@playwright/mcp/node_modules/playwright');

const BASE = 'http://localhost:3001';
const API = 'http://localhost:3000';
const SHOTS = path.join(__dirname, 'shots');
const EV = path.join(__dirname, 'e2e-vars.json');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASS = 'E2EAdmin@2025';
const PM_EMAIL = 'pm@example.com';
const PM_PASS = 'E2EPm@2025';
const WORKER_ID = 'e2e4a000-0000-4000-8000-0000000000a1';
const CONTRACTOR_ID = 'e2e4c000-0000-4000-8000-0000000000c1';
const ASSIGNMENT_OPEN = 'e2e4c100-0000-4000-8000-0000000000c2';

const results = [];
function step(id, name, fn) {
  return async () => {
    try {
      const r = await fn(id);
      results.push(r);
      console.log(`${r.ok ? 'PASS' : 'FAIL'} ${id} ${name}${r.note ? ' :: ' + r.note : ''}`);
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

function psql(sql) {
  try {
    return execFileSync('docker', [
      'exec', 'buildflow-postgres-1', 'psql', '-U', 'buildflow', '-d', 'buildflow', '-P', 'pager=off', '-c', sql,
    ], { encoding: 'utf8', timeout: 15000 }).trim();
  } catch (e) {
    return `PSQL ERROR: ${e.stderr || e.message}`;
  }
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

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
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

function auditCount(action, entityId) {
  return psqlT(`SELECT count(*) FROM audit_logs WHERE action='${action}' AND entity_id='${entityId}'`);
}
function int(s) {
  const m = String(s).match(/\d+/);
  return m ? Number(m[0]) : -1;
}
function workerStatus() {
  return psql(`SELECT status, failed_login_count, locked_until FROM users WHERE id='${WORKER_ID}'`);
}
function contractorStatus() {
  return psql(`SELECT status FROM contractors WHERE id='${CONTRACTOR_ID}'`);
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
  if (!adminToken || !pmToken) {
    console.error('Không lấy được token admin/pm — kiểm tra password (§2 doc).');
    await browser.close().catch(() => {});
    process.exit(2);
  }

  // Đưa seed về ACTIVE trước bước 1 (chạy lại không làm hỏng assertions)
  psql(`UPDATE users SET status='ACTIVE', locked_until=NULL, failed_login_count=0, updated_at=now() WHERE id='${WORKER_ID}'`);
  psql(`UPDATE contractors SET status='ACTIVE', updated_at=now() WHERE id='${CONTRACTOR_ID}'`);

  try {
    // ============ B0 ============
    await step('B0', 'seed + login admin', async (id) => {
      const openSeed = await psqlT(`SELECT count(*) FROM assignments WHERE id='${ASSIGNMENT_OPEN}' AND status IN ('PENDING_ACCEPTANCE','ACTIVE')`);
      if (openSeed !== '1') return fail(id, `assignment mở seed chưa đúng (count=${openSeed}) — chạy seed-lifecycle-004.sql trước`);
      await login(page, ADMIN_EMAIL, ADMIN_PASS);
      await page.waitForSelector('text=Tổng quan', { timeout: 10000 }).catch(() => {});
      await snap(page, id, 'Admin dashboard sau login');
      return ok(id, `assignment seed=${openSeed}; worker/contractor đã về ACTIVE`);
    })();

    // ============ B1 ============
    await step('B1', 'WorkerDetail ACTIVE: Tạm ngừng — dialog warning + field error khi thiếu reason', async (id) => {
      await page.goto(`${BASE}/workers/${WORKER_ID}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('text=Trạng thái', { timeout: 15000 });
      await page.waitForSelector('button:has-text("Tạm ngừng")', { timeout: 15000 });
      await page.locator('button', { hasText: 'Tạm ngừng' }).first().click();
      await page.waitForSelector('#lifecycle-reason', { timeout: 15000 });
      await page.waitForFunction(() => /đang có 1 công việc\/lịch mở/.test(document.body.textContent || ''), { timeout: 20000 });
      await snap(page, id + '-warning', 'Dialog Tạm ngừng — pre-check 1 công việc/lịch mở');
      const susp0 = await auditCount('ORG_WORKER_SUSPENDED', WORKER_ID);
      await page.locator('button', { hasText: 'Xác nhận tạm ngừng' }).click();
      await page.waitForSelector('#lifecycle-reason-error', { timeout: 10000 });
      const errTxt = (await page.locator('#lifecycle-reason-error').textContent()) || '';
      if (!errTxt.includes('bắt buộc')) return fail(id, `field error không đúng: ${errTxt}`);
      await snap(page, id + '-fielderror', 'Field error lý do bắt buộc (không có request)');
      const susp1 = await auditCount('ORG_WORKER_SUSPENDED', WORKER_ID);
      if (susp0 !== susp1) return fail(id, `audit tăng khi chưa có reason (${susp0}→${susp1})`);
      return ok(id, `warning '1 công việc/lịch mở' + field error '${errTxt}'; audit giữ ${susp1}`);
    })();

    // ============ B2 ============
    await step('B2', 'nhập reason → submit → INACTIVE + audit ORG_WORKER_SUSPENDED (reason/before/after/warning/actor)', async (id) => {
      const susp0 = await auditCount('ORG_WORKER_SUSPENDED', WORKER_ID);
      await page.fill('#lifecycle-reason', 'Tạm ngừng do thiếu việc trong kỳ (E2E run 3)');
      await snap(page, id + '-reason', 'Dialog với reason đã nhập');
      await page.locator('button', { hasText: 'Xác nhận tạm ngừng' }).click();
      await page.waitForSelector('text=Tạm ngừng thành công', { timeout: 20000 });
      await page.waitForFunction(() => (document.body.textContent || '').includes('Worker đang có 1 công việc/lịch mở'), { timeout: 20000 });
      await snap(page, id + '-success', 'Success alert — Tạm ngừng thành công + warning 1 công việc mở');
      const db = workerStatus();
      if (!db.includes('INACTIVE')) return fail(id, `users.status chưa INACTIVE:\n${db}`);
      const susp1 = await auditCount('ORG_WORKER_SUSPENDED', WORKER_ID);
      if (int(susp1) !== int(susp0) + 1) return fail(id, `audit delta sai (${susp0}→${susp1})`);
      const audit = await psql(
        `SELECT action, result, reason, before_data->>'status' AS b, after_data->>'status' AS a,
                after_data->>'_warning' AS warning, actor_user_id, correlation_id
         FROM audit_logs WHERE action='ORG_WORKER_SUSPENDED' AND entity_id='${WORKER_ID}'
         ORDER BY created_at DESC LIMIT 1`
      );
      if (!audit.includes('Tạm ngừng do thiếu việc trong kỳ (E2E run 3)')) return fail(id, `audit reason thiếu:\n${audit}`);
      if (!audit.includes('ACTIVE') || !audit.includes('INACTIVE')) return fail(id, `audit before/after thiếu:\n${audit}`);
      if (!audit.includes('công việc')) return fail(id, `audit afterData thiếu _warning:\n${audit}`);
      return ok(id, `DB:\n${db}\naudit:\n${audit}`);
    })();

    // ============ B3 ============
    await step('B3', 'alreadyInState: race Kích hoạt lại khi đã ACTIVE → info UI, KHÔNG audit mới', async (id) => {
      await page.waitForSelector('button:has-text("Kích hoạt lại")', { timeout: 15000 });
      const react0 = await auditCount('ORG_WORKER_REACTIVATED', WORKER_ID);
      await page.locator('button', { hasText: 'Kích hoạt lại' }).first().click();
      await page.waitForSelector('#lifecycle-reason', { timeout: 15000 });
      const dialogText = await page.locator('#lifecycle-reason').locator('xpath=ancestor::div[contains(@class,"bf-card")][1]').textContent().catch(() => '');
      await snap(page, id + '-dialog', 'Dialog Kích hoạt lại mở khi worker INACTIVE');
      // mô phỏng admin khác kích hoạt đồng thời
      psql(`UPDATE users SET status='ACTIVE', locked_until=NULL, failed_login_count=0, updated_at=now() WHERE id='${WORKER_ID}'`);
      await page.locator('button', { hasText: 'Xác nhận kích hoạt lại' }).click();
      await page.waitForSelector('text=Worker đã ở trạng thái hoạt động', { timeout: 20000 });
      await snap(page, id, 'Info alreadyInState — không phải lỗi, không audit');
      const react1 = await auditCount('ORG_WORKER_REACTIVATED', WORKER_ID);
      const db = workerStatus();
      if (react0 !== react1) return fail(id, `audit REACTIVATED tăng dù alreadyInState (${react0}→${react1})`);
      if (!db.includes('ACTIVE')) return fail(id, `status lệch:\n${db}`);
      return ok(id, `UI info alreadyInState; audit giữ ${react1}; status ACTIVE (đúng thiết kế: không tạo audit trùng)`);
    })();

    // ============ B4 ============
    await step('B4', 'WorkerDetail ACTIVE: Chấm dứt + reason → INACTIVE + ORG_WORKER_TERMINATED', async (id) => {
      await page.waitForSelector('button:has-text("Chấm dứt")', { timeout: 15000 });
      const term0 = await auditCount('ORG_WORKER_TERMINATED', WORKER_ID);
      await page.locator('button', { hasText: 'Chấm dứt' }).first().click();
      await page.waitForSelector('#lifecycle-reason', { timeout: 15000 });
      await page.fill('#lifecycle-reason', 'Chấm dứt hồ sơ do nghỉ việc (E2E run 3)');
      await snap(page, id + '-reason', 'Dialog Chấm dứt — reason đã nhập');
      await page.locator('button', { hasText: 'Xác nhận chấm dứt' }).click();
      await page.waitForSelector('text=Chấm dứt thành công', { timeout: 20000 });
      await waitTextGone(page, 'button:has-text("Chấm dứt")', 15000).catch(() => {});
      await snap(page, id + '-detail', 'WorkerDetail: worker INACTIVE sau Chấm dứt (nút Kích hoạt lại)');
      const db = workerStatus();
      if (!db.includes('INACTIVE')) return fail(id, `users.status chưa INACTIVE:\n${db}`);
      const term1 = await auditCount('ORG_WORKER_TERMINATED', WORKER_ID);
      if (int(term1) !== int(term0) + 1) return fail(id, `audit delta sai (${term0}→${term1})`);
      const audit = await psql(
        `SELECT action, reason, before_data->>'status' AS b, after_data->>'status' AS a FROM audit_logs
         WHERE action='ORG_WORKER_TERMINATED' AND entity_id='${WORKER_ID}' ORDER BY created_at DESC LIMIT 1`
      );
      if (!audit.includes('Chấm dứt hồ sơ do nghỉ việc (E2E run 3)')) return fail(id, `audit reason thiếu:\n${audit}`);
      return ok(id, `DB:\n${db}\naudit:\n${audit}`);
    })();
    async function waitTextGone(page, selector, ms) {
      await page.waitForSelector(selector, { state: 'detached', timeout: ms });
    }

    // ============ B5 ============
    await step('B5', 'WorkerDetail: Lịch sử trạng thái — 3 hành động + lý do + actor; deep-link audit', async (id) => {
      await page.waitForSelector('text=Lịch sử trạng thái', { timeout: 15000 });
      await page.waitForFunction(() => {
        const t = document.body.textContent || '';
        return t.includes('Lý do: Tạm ngừng do thiếu việc trong kỳ (E2E run 3)')
          && t.includes('Lý do: Chấm dứt hồ sơ do nghỉ việc (E2E run 3)');
      }, { timeout: 20000 });
      await snap(page, id, 'WorkerDetail: timeline Tạm ngừng/Chấm dứt + lý do + actor');
      const link = page.locator('a[href*="admin/audit-logs?entityType=WORKER&entityId=' + WORKER_ID + '"]').first();
      const href = await link.getAttribute('href');
      await link.click();
      await page.waitForURL('**/admin/audit-logs**', { timeout: 15000 });
      await page.waitForTimeout(2500);
      await snap(page, id + '-audit', `Audit-logs qua deep-link '${href}'`);
      const bodyTxt = await page.locator('body').textContent();
      const seesRows = bodyTxt.includes('ORG_WORKER_SUSPENDED') || bodyTxt.includes('ORG_WORKER_TERMINATED');
      if (seesRows) return ok(id, `timeline full + deep-link '${href}' hiển thị ORG_WORKER_*`);
      return fail(id, `timeline OK nhưng deep-link '${href}' không hiển thị dòng ORG_WORKER_* (action filter prefix → 0 rows)`);
    })();

    // ============ B6 ============
    await step('B6', 'eligible: worker vắng khỏi ACTIVE (API+UI), hiện ở INACTIVE + open-work vẫn đếm', async (id) => {
      const listA = await api('GET', `/api/v1/workers?status=ACTIVE&search=${encodeURIComponent('e2e4.worker@example.com')}`, adminToken);
      const foundActive = listA.body && listA.body.data ? listA.body.data.some((x) => x.id === WORKER_ID) : false;
      if (foundActive) return fail(id, 'worker vẫn xuất hiện ở lọc ACTIVE sau TERMINATE');
      const detail = await api('GET', `/api/v1/workers/${WORKER_ID}`, adminToken);
      if ((detail.body && detail.body.eligible) !== false) return fail(id, `eligible vẫn true: ${JSON.stringify(detail.body && detail.body.eligible)}`);
      const ow = await api('GET', `/api/v1/workers/${WORKER_ID}/open-work`, adminToken);
      if (ow.body && ow.body.openAssignments !== 1) return fail(id, `openAssignments=${ow.body && ow.body.openAssignments} (mong đợi 1)`);
      await page.goto(`${BASE}/workers`, { waitUntil: 'networkidle' });
      await page.selectOption('#worker-status', 'INACTIVE');
      await page.locator('button', { hasText: 'Tìm' }).first().click();
      await page.waitForSelector(`a[href="/workers/${WORKER_ID}"]`, { timeout: 20000 });
      await snap(page, id + '-inactive', 'WorkerList filter INACTIVE: worker hiện đúng');
      await page.selectOption('#worker-status', 'ACTIVE');
      await page.locator('button', { hasText: 'Tìm' }).first().click();
      await page.waitForFunction((wid) => !Array.from(document.querySelectorAll('a')).some((x) => x.getAttribute('href') === `/workers/${wid}`), WORKER_ID, { timeout: 20000 });
      await snap(page, id + '-active', 'WorkerList filter ACTIVE: worker vắng mặt');
      return ok(id, 'API ACTIVE không chứa worker; eligible=false; open-work vẫn 1; UI filter INACTIVE có / ACTIVE không');
    })();

    // ============ B7 ============
    await step('B7', 'ContractorDetail: Tạm ngừng (open-work=0 → không warning) → ORG_CONTRACTOR_SUSPENDED', async (id) => {
      const susp0 = await auditCount('ORG_CONTRACTOR_SUSPENDED', CONTRACTOR_ID);
      await page.goto(`${BASE}/contractors/${CONTRACTOR_ID}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('text=Đang hoạt động', { timeout: 20000 });
      await page.locator('button', { hasText: 'Tạm ngừng' }).first().click();
      await page.waitForSelector('#lifecycle-reason', { timeout: 15000 });
      await page.waitForTimeout(1800);
      const bodyTxt = await page.locator('body').textContent();
      if (/công việc\/lịch mở/.test(bodyTxt)) return fail(id, 'dialog VẪN hiện warning open work dù openAssignments=0');
      await page.fill('#lifecycle-reason', 'Tạm ngừng nhà thầu do chậm tiến độ (E2E run 3)');
      await snap(page, id + '-dialog', 'Contractor dialog Tạm ngừng — không warning (open work 0)');
      await page.locator('button', { hasText: 'Xác nhận tạm ngừng' }).click();
      await page.waitForSelector('text=Tạm ngừng thành công', { timeout: 20000 });
      await page.waitForSelector('text=Ngừng hoạt động', { timeout: 15000 });
      await snap(page, id + '-detail', 'ContractorDetail: nhà thầu Ngừng hoạt động');
      const db = contractorStatus();
      if (!db.includes('INACTIVE')) return fail(id, `contractors.status chưa INACTIVE:\n${db}`);
      const susp1 = await auditCount('ORG_CONTRACTOR_SUSPENDED', CONTRACTOR_ID);
      if (int(susp1) !== int(susp0) + 1) return fail(id, `audit delta sai (${susp0}→${susp1})`);
      const audit = await psql(
        `SELECT action, reason, before_data->>'status' AS b, after_data->>'status' AS a FROM audit_logs
         WHERE action='ORG_CONTRACTOR_SUSPENDED' AND entity_id='${CONTRACTOR_ID}' ORDER BY created_at DESC LIMIT 1`
      );
      if (!audit.includes('Tạm ngừng nhà thầu do chậm tiến độ (E2E run 3)')) return fail(id, `audit reason thiếu:\n${audit}`);
      return ok(id, `DB:\n${db}\naudit:\n${audit}`);
    })();

    // ============ B8 ============
    await step('B8', 'ContractorDetail: Kích hoạt lại → ACTIVE + ORG_CONTRACTOR_REACTIVATED', async (id) => {
      const react0 = await auditCount('ORG_CONTRACTOR_REACTIVATED', CONTRACTOR_ID);
      await page.locator('button', { hasText: 'Kích hoạt lại' }).first().click();
      await page.waitForSelector('#lifecycle-reason', { timeout: 15000 });
      await page.fill('#lifecycle-reason', 'Hết lý do tạm ngừng (E2E run 3)');
      await page.locator('button', { hasText: 'Xác nhận kích hoạt lại' }).click();
      await page.waitForSelector('text=Đã kích hoạt lại nhà thầu', { timeout: 20000 });
      await page.waitForSelector('text=Đang hoạt động', { timeout: 15000 });
      await snap(page, id + '-detail', 'ContractorDetail: nhà thầu Đang hoạt động trở lại');
      const db = contractorStatus();
      if (!db.includes('ACTIVE')) return fail(id, `contractors.status chưa ACTIVE:\n${db}`);
      const react1 = await auditCount('ORG_CONTRACTOR_REACTIVATED', CONTRACTOR_ID);
      if (int(react1) !== int(react0) + 1) return fail(id, `audit delta sai (${react0}→${react1})`);
      const audit = await psql(
        `SELECT action, reason, before_data->>'status' AS b, after_data->>'status' AS a FROM audit_logs
         WHERE action='ORG_CONTRACTOR_REACTIVATED' AND entity_id='${CONTRACTOR_ID}' ORDER BY created_at DESC LIMIT 1`
      );
      return ok(id, `DB:\n${db}\naudit:\n${audit}`);
    })();

    // ============ B9 ============
    await step('B9', 'phân quyền: pm 403 (API worker+contractor+open-work), no token 401, UI pm 403', async (id) => {
      const pmAct = await api('PATCH', `/api/v1/workers/${WORKER_ID}/status`, pmToken, { action: 'ACTIVATE', reason: 'x' });
      const pmContr = await api('PATCH', `/api/v1/contractors/${CONTRACTOR_ID}/status`, pmToken, { action: 'SUSPEND', reason: 'x' });
      const pmOpen = await api('GET', `/api/v1/workers/${WORKER_ID}/open-work`, pmToken);
      const anonOpen = await api('GET', `/api/v1/workers/${WORKER_ID}/open-work`, null);
      if (pmAct.status !== 403 || pmContr.status !== 403 || pmOpen.status !== 403) {
        return fail(id, `pm worker=${pmAct.status} contractor=${pmContr.status} open=${pmOpen.status} (mong đợi 403)`);
      }
      if (anonOpen.status !== 401) return fail(id, `anon=${anonOpen.status} (mong đợi 401)`);
      await login(page, PM_EMAIL, PM_PASS);
      await page.goto(`${BASE}/workers`, { waitUntil: 'networkidle' });
      await page.waitForSelector('text=Không có quyền', { timeout: 15000 }).catch(() => {});
      const navText = await page.locator('.bf-nav').textContent().catch(() => '');
      const noNavWorkers = !(navText || '').includes('Công nhân');
      const pageHas403 = (await page.locator('body').textContent()).includes('Không có quyền');
      await snap(page, id + '-ui', 'PM mở /workers: card 403 + sidebar không có mục Công nhân');
      if (!noNavWorkers) return fail(id, 'sidebar pm vẫn hiện Công nhân');
      if (!pageHas403) return fail(id, 'UI pm không hiển thị 403');
      return ok(id, `API pm worker=${pmAct.status} contractor=${pmContr.status} open=${pmOpen.status}; anon=${anonOpen.status}; UI sidebar ẩn + card 403`);
    })();

    // ============ B10 ============
    await step('B10', 'double-submit SUSPEND song song cùng correlation-id → 1 audit, trạng thái nhất quán', async (id) => {
      const act = await api('PATCH', `/api/v1/workers/${WORKER_ID}/status`, adminToken, { action: 'ACTIVATE', reason: 'reset cho B10 (E2E run 3)' });
      if (act.status !== 200 && act.status !== 201) return fail(id, `không kích hoạt lại được (${act.status})`);
      const corr = 'e2e4d000-0000-4000-8000-' + String(Math.floor(100000000000 + Math.random() * 899999999999));
      const headers = { 'X-Correlation-Id': corr };
      const mk = () => api('PATCH', `/api/v1/workers/${WORKER_ID}/status`, adminToken, { action: 'SUSPEND', reason: 'double-submit E2E run 3' }, headers);
      const [r1, r2] = await Promise.all([mk(), mk()]);
      const auditRows = await psqlT(`SELECT count(*) FROM audit_logs WHERE action='ORG_WORKER_SUSPENDED' AND correlation_id='${corr}'`);
      const db = workerStatus();
      if (r1.status !== 200 || r2.status !== 200) return fail(id, `HTTP r1=${r1.status} r2=${r2.status}`);
      if (auditRows !== '1') return fail(id, `audit rows=${auditRows} (mong đợi 1) — corr ${corr}`);
      if (!db.includes('INACTIVE')) return fail(id, `status sau double-submit:\n${db}`);
      return ok(id, `HTTP r1=${r1.status}(alreadyInState=${r1.body && r1.body.alreadyInState}) r2=${r2.status}(alreadyInState=${r2.body && r2.body.alreadyInState}); audit rows=${auditRows}; status INACTIVE nhất quán`);
    })();

    // ============ B11 ============
    await step('B11', 'reason bắt buộc (400) + >500 ký tự (400) giữ nguyên trạng thái', async (id) => {
      const noReason = await api('PATCH', `/api/v1/workers/${WORKER_ID}/status`, adminToken, { action: 'SUSPEND' });
      if (noReason.status !== 400) return fail(id, `no-reason HTTP ${noReason.status}`);
      const msg = noReason.body && noReason.body.message ? String(noReason.body.message) : '';
      if (!msg.includes('Lý do là bắt buộc')) return fail(id, `message sai: ${msg}`);
      const longReason = await api('PATCH', `/api/v1/workers/${WORKER_ID}/status`, adminToken, { action: 'SUSPEND', reason: 'x'.repeat(501) });
      if (longReason.status !== 400) return fail(id, `>500 HTTP ${longReason.status}`);
      const db = workerStatus();
      if (!db.includes('INACTIVE')) return fail(id, `status đổi sau 400:\n${db}`);
      return ok(id, `400 "${msg}" + 400 ${JSON.stringify(longReason.body && longReason.body.message)}; status giữ nguyên:\n${db}`);
    })();

    // ============ tổng hợp ============
    const PASS = results.filter((r) => r.ok).length;
    const FAILN = results.filter((r) => !r.ok).length;
    fs.writeFileSync(EV, JSON.stringify({ workerId: WORKER_ID, contractorId: CONTRACTOR_ID, assignmentOpen: ASSIGNMENT_OPEN, results }, null, 2));
    console.log(`\n===== TỔNG: ${PASS} PASS / ${FAILN} FAIL / ${results.length} bước =====`);
    for (const r of results) if (!r.ok) console.log(`  FAIL ${r.id}: ${r.note}`);
  } catch (err) {
    console.error('DRIVER ERROR', err && err.message ? err.message : err);
    process.exitCode = 1;
  } finally {
    await browser.close().catch(() => {});
  }
})();