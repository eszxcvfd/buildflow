/**
 * JOB-SRS-001 E2E driver — Tạo Work Order nháp (issue #41).
 * Evidence-only script; phạm vi docs/evidence — KHÔNG sửa source.
 *
 * Pattern theo prj-srs-004 (playwright-core absolute path, Chrome headless),
 * creds @vinacons.vn, dữ liệu realistic (ADR-0003 — không E2E%/test% trong
 * dữ liệu hiển thị; uniqueness bằng suffix digits).
 *
 * Chạy:   node e2e-driver-job-srs-001.cjs
 * (đặt tên nhất quán prj-srs-006/009, job-srs-002; file cũ
 *  e2e-driver-job-001.cjs / e2e-vars-job-001.json đã xóa, không còn refs).
 * Verify report fixes: D1 — selector nút Đóng ambiguous (header ×
 * aria-label Đóng + footer Button text Đóng đều match getByRole 'Đóng'
 * khi summary hiện) → footerCloseBtn (.bf-dialog__body) + closeDialogQuiet
 * dọn dialog tồn đọng (chống cascade); D2 — SQL audit dùng cột đúng
 * `actor_user_id` (không có `actor_id`).
 * Yêu cầu: stack rebuild từ working tree hiện tại (đã gồm API-fixes G1/G2/G3:
 *          G1 rehydrate full status enum, G2 race-replay request_key,
 *          G3 gate project ACTIVE; api có POST/GET /api/v1/work-orders +
 *          migration 0009 request_key; web có nút
 *          'Tạo Work Order' ở /projects/[id] + WorkOrderCreateDialog);
 *          demo logins (admin hoang.anh / PM quoc.tran / worker thang.nguyen
 *          / outsider ba.nguyen); seed PRA (KQ-01/TM-02), PRD (B1-01),
 *          WO PRD-B1-001 ASSIGNED, work type BT-CT, trade THO-CAT.
 *
 * Driver tạo các WO với title suffix digits (cleanup cuối run theo id,
 * audit giữ nguyên append-only).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('/home/trung/.npm-global/lib/node_modules/@playwright/mcp/node_modules/playwright-core');

const WEB = 'http://localhost:3001';
const API = 'http://localhost:3000';
const SHOTS = path.join(__dirname, 'shots');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
const VARS_PATH = path.join(__dirname, 'e2e-vars.json');

const ADMIN = { email: 'hoang.anh@vinacons.vn', pass: process.env.E2E_ADMIN_PASS ?? 'E2EAdmin@2025' };
const PM = { email: 'quoc.tran@vinacons.vn', pass: process.env.E2E_PM_PASS ?? 'E2EPm@2025' };
const WORKER = { email: 'thang.nguyen@vinacons.vn', pass: process.env.E2E_WORKER_PASS ?? 'E2EWorker@2025' };
const OUTSIDER = { email: 'ba.nguyen@vinacons.vn', pass: process.env.E2E_OUTSIDER_PASS ?? 'E2E5W3@2025' };

const DIG = String(Date.now()).slice(-6);
const T_W2 = `Thi công sàn B1 khu KQ-01 ${DIG}`;
const T_W3 = `Thi công dầm khu TM-02 ${DIG}`;
const T_W7 = `Thi công lan can sảnh chính ${DIG}`;
const TEMP_WT_CODE = `WT-GACH-OP-${DIG}`;
const TEMP_WT_NAME = `Thi công ốp gạch sảnh ${DIG}`;

const vars = {
  digits: DIG,
  titleW2: T_W2,
  titleW3: T_W3,
  titleW7: T_W7,
  tempWorkTypeCode: TEMP_WT_CODE,
  workOrderIds: [],
  tempWorkTypeId: null,
  requestKeyW3: null,
  woW2: null,
  woW7: null,
};
try {
  const prev = JSON.parse(fs.readFileSync(VARS_PATH, 'utf8'));
  vars.prevWorkOrderIds = prev.workOrderIds || [];
  vars.prevTempWorkTypeId = prev.tempWorkTypeId || null;
} catch { vars.prevWorkOrderIds = []; vars.prevTempWorkTypeId = null; }

const results = [];
async function runStep(id, name, fn) {
  try {
    const r = await fn(id);
    results.push(r);
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
const ok = (id, note = '') => ({ id, ok: true, note });
const fail = (id, note) => ({ id, ok: false, note });

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
function dlg(page) { return page.locator('.bf-dialog'); }
// D1 fix — dialog success-summary có 2 nút 'Đóng': header × (aria-label)
// + footer Button (text) → getByRole name 'Đóng' strict-mode violation.
// Footer close nằm trong .bf-dialog__body → selector cụ thể.
function footerCloseBtn(page) { return dlg(page).locator('.bf-dialog__body button:has-text("Đóng")'); }
// Dọn dialog tồn đọng sau step FAIL (chống cascade sang step sau); gọi ở
// đầu mỗi UI-step mở dialog + thay mọi block closeBtns cũ. Không dialog → noop.
async function closeDialogQuiet(page) {
  let opened = false;
  try { opened = (await dlg(page).count()) > 0; } catch { return; }
  if (!opened) return;
  try {
    const btn = footerCloseBtn(page);
    if ((await btn.count()) > 0) await btn.first().click({ timeout: 8000 });
    else await page.keyboard.press('Escape');
  } catch {}
  try { await dlg(page).waitFor({ state: 'hidden', timeout: 8000 }); } catch {}
}
async function dlgOptionValues(page, selectId) {
  return dlg(page).locator(`${selectId} option`).evaluateAll((els) =>
    els.map((e) => ({ value: e.value, text: (e.textContent || '').trim() })));
}
function saveVars() {
  fs.writeFileSync(VARS_PATH, JSON.stringify(vars, null, 2));
}
function cleanupPrev() {
  for (const id of (vars.prevWorkOrderIds || []).filter(Boolean)) {
    try {
      execFileSync('docker', ['exec', 'buildflow-postgres-1', 'psql', '-U', 'buildflow', '-d', 'buildflow', '-c',
        `DELETE FROM work_orders WHERE id='${id}';`], { encoding: 'utf8', timeout: 20000 });
    } catch {}
  }
  if (vars.prevTempWorkTypeId) {
    try {
      execFileSync('docker', ['exec', 'buildflow-postgres-1', 'psql', '-U', 'buildflow', '-d', 'buildflow', '-c',
        `DELETE FROM work_types WHERE id='${vars.prevTempWorkTypeId}';`], { encoding: 'utf8', timeout: 20000 });
    } catch {}
  }
}

async function main() {
  cleanupPrev();
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);

  const adminTok = await getToken(ADMIN.email, ADMIN.pass);

  // Resolve PRA / PRD / BT-CT / KQ-01 / THO-CAT / PRD-B1-001 qua API thật.
  const projects = await api('GET', '/api/v1/projects', adminTok);
  const list = Array.isArray(projects.body) ? projects.body : (projects.body.data || []);
  const pra = list.find((p) => p.code === 'PRA');
  const prd = list.find((p) => p.code === 'PRD');
  if (!pra || !prd) throw new Error(`missing PRA/PRD: ${JSON.stringify(list.map((p) => p.code))}`);
  const areas = await api('GET', `/api/v1/projects/${pra.id}/areas?activeOnly=true`, adminTok);
  const kq01 = (areas.body.data || []).find((a) => a.code === 'KQ-01');
  const tm02 = (areas.body.data || []).find((a) => a.code === 'TM-02');
  const wtypes = await api('GET', '/api/v1/work-types/active', adminTok);
  const btct = (wtypes.body.data || []).find((w) => w.code === 'BT-CT');
  const trades = await api('GET', '/api/v1/trades?status=ACTIVE&limit=100', adminTok);
  const thocat = (trades.body.data || []).find((t) => t.code === 'THO-CAT');
  if (!kq01 || !tm02 || !btct || !thocat) throw new Error('missing picker fixtures (KQ-01/TM-02/BT-CT/THO-CAT)');
  const seedWoId = psqlT("SELECT id FROM work_orders WHERE code='PRD-B1-001';");
  console.log(`fixtures PRA=${pra.id} KQ-01=${kq01.id} BT-CT=${btct.id} THO-CAT=${thocat.id} PRD-B1-001=${seedWoId}`);

  // W1 — admin mở PRA detail, nút + dialog + 3 picker.
  await runStep('W1', 'admin PRA detail: nút + dialog + 3 picker', async (id) => {
    await loginWeb(page, ADMIN.email, ADMIN.pass);
    await page.goto(`${WEB}/projects/${pra.id}`, { waitUntil: 'networkidle' });
    const btn = page.getByRole('button', { name: 'Tạo Work Order', exact: true });
    await btn.waitFor({ timeout: 20000 });
    const visible = await btn.isVisible();
    if (!visible) return fail(id, 'nút Tạo Work Order không visible');
    await btn.click();
    await dlg(page).waitFor({ timeout: 15000 });
    // Đợi 3 picker load (option thứ 2 xuất hiện ở mỗi select).
    await page.waitForFunction(() =>
      document.querySelectorAll('.bf-dialog #wo-worktype option').length > 1 &&
      document.querySelectorAll('.bf-dialog #wo-area option').length > 1 &&
      document.querySelectorAll('.bf-dialog #wo-trade option').length > 1, { timeout: 25000 });
    const wt = await dlgOptionValues(page, '#wo-worktype');
    const ar = await dlgOptionValues(page, '#wo-area');
    const tr = await dlgOptionValues(page, '#wo-trade');
    const hasBT = wt.some((o) => /BT-CT|bê tông cốt thép/i.test(o.text));
    const hasKQ = ar.some((o) => /KQ-01/.test(o.text));
    const hasTM = ar.some((o) => /TM-02/.test(o.text));
    const hasTHO = tr.some((o) => /THO-CAT|cat gach/i.test(o.text));
    await snap(page, 'W1-dialog-pickers', 'dialog tạo WO với 3 picker đã load');
    if (!hasBT || !hasKQ || !hasTM || !hasTHO) {
      return fail(id, `picker thiếu: BT-CT=${hasBT} KQ-01=${hasKQ} TM-02=${hasTM} THO-CAT=${hasTHO}`);
    }
    return ok(id, `dialog mở, 3 picker đủ (worktypes=${wt.length} areas=${ar.length} trades=${tr.length})`);
  });

  // W2 — happy create qua UI.
  await runStep('W2', 'happy create UI → summary WO-… + DB DRAFT + request_key', async (id) => {
    await dlg(page).locator('#wo-title').fill(T_W2);
    await dlg(page).locator('#wo-worktype').selectOption(btct.id);
    await dlg(page).locator('#wo-area').selectOption(kq01.id);
    await dlg(page).locator('#wo-priority').selectOption('HIGH');
    await snap(page, 'W2-form-filled', 'form đã điền trước submit');
    await dlg(page).getByRole('button', { name: 'Tạo Work Order', exact: true }).click();
    await page.waitForFunction(() => document.body.textContent.includes('Đã tạo Work Order'),
      { timeout: 25000 });
    const body = await page.locator('body').textContent();
    const m = body.match(/Đã tạo Work Order\s+(\S+)\s+\(id\s+([0-9a-f-]{36})\)/);
    await snap(page, 'W2-created', 'summary sau tạo');
    if (!m) return fail(id, `không parse được summary từ body: ${(body || '').slice(0, 500)}`);
    const [, code, woId] = m;
    if (!/^WO-/.test(code)) return fail(id, `code không theo pattern WO-…: ${code}`);
    vars.woW2 = { id: woId, code };
    vars.workOrderIds.push(woId);
    saveVars();
    const db = psqlT(`SELECT code,title,status,request_key IS NOT NULL AS has_rk FROM work_orders WHERE id='${woId}';`);
    if (!/\|DRAFT\|t/.test(db.replace(/ /g, ''))) return fail(id, `DB không DRAFT/has_rk: ${db}`);
    // Đóng dialog để chuẩn bị W4 (D1: footer selector cụ thể).
    await footerCloseBtn(page).first().click();
    return ok(id, `code=${code} id=${woId}; db: ${db}`);
  });

  // W3 — replay idempotent hoàn toàn qua curl.
  await runStep('W3', 'replay cùng requestKey: 201 → 200 idempotentReplay, DB/audit không đổi', async (id) => {
    const rk = uuid();
    vars.requestKeyW3 = rk;
    const payload = {
      projectId: pra.id, workTypeId: btct.id, areaId: kq01.id, title: T_W3,
      priority: 'NORMAL', requestKey: rk,
    };
    const auditBefore = psqlT("SELECT count(*) FROM audit_logs WHERE action='JOB_WORK_ORDER_CREATED';");
    const woBefore = psqlT('SELECT count(*) FROM work_orders;');
    const r1 = await api('POST', '/api/v1/work-orders', adminTok, payload);
    if (r1.status !== 201) return fail(id, `lần 1 kỳ vọng 201, được ${r1.status}: ${JSON.stringify(r1.body)}`);
    const woBefore2 = psqlT('SELECT count(*) FROM work_orders;');
    const auditMid = psqlT("SELECT count(*) FROM audit_logs WHERE action='JOB_WORK_ORDER_CREATED';");
    const r2 = await api('POST', '/api/v1/work-orders', adminTok, payload);
    const woAfter = psqlT('SELECT count(*) FROM work_orders;');
    const auditAfter = psqlT("SELECT count(*) FROM audit_logs WHERE action='JOB_WORK_ORDER_CREATED';");
    if (r2.status !== 200 || r2.body.idempotentReplay !== true) {
      return fail(id, `lần 2 kỳ vọng 200+replay, được ${r2.status}: ${JSON.stringify(r2.body)}`);
    }
    if (r2.body.id !== r1.body.id) return fail(id, `replay id khác: ${r1.body.id} vs ${r2.body.id}`);
    vars.workOrderIds.push(r1.body.id);
    saveVars();
    const note = `1st=201 2nd=200 replay id=${r1.body.id}; wo ${woBefore}→${woBefore2}→${woAfter}; audit ${auditBefore}→${auditMid}→${auditAfter}`;
    if (woBefore2 !== woAfter || auditMid !== auditAfter) return fail(id, `replay vẫn ghi mới — ${note}`);
    return ok(id, note);
  });

  // W4 — dup code qua UI.
  await runStep('W4', 'dup code PRD-B1-001 → 409 field error, dialog ở lại', async (id) => {
    await closeDialogQuiet(page); // dọn tồn đọng từ step trước (chống cascade)
    const btn = page.getByRole('button', { name: 'Tạo Work Order', exact: true });
    await btn.click();
    await dlg(page).waitFor({ timeout: 15000 });
    await page.waitForFunction(() =>
      document.querySelectorAll('.bf-dialog #wo-worktype option').length > 1, { timeout: 25000 });
    await dlg(page).locator('#wo-title').fill(`Thi công dầm tầng 2 ${DIG}`);
    await dlg(page).locator('#wo-worktype').selectOption(btct.id);
    await dlg(page).locator('#wo-code').fill('PRD-B1-001');
    await dlg(page).getByRole('button', { name: 'Tạo Work Order', exact: true }).click();
    await page.waitForFunction(() => {
      const d = document.querySelector('.bf-dialog');
      return d && /đã tồn tại/i.test(d.textContent || '');
    }, { timeout: 25000 });
    const dtext = await dlg(page).textContent();
    const stillOpen = (await dlg(page).count()) > 0;
    await snap(page, 'W4-dup-code', 'lỗi trùng mã trên dialog');
    // Đóng dialog để chuẩn bị W5.
    await closeDialogQuiet(page);
    if (!stillOpen) return fail(id, 'dialog đã đóng sau 409 (kỳ vọng ở lại)');
    if (!/Mã|mã/i.test(dtext || '')) return fail(id, `không thấy lỗi ở trường Mã: ${(dtext || '').slice(0, 400)}`);
    return ok(id, '409 field error Mã công việc đã tồn tại, dialog ở lại');
  });

  // W5 — validation client.
  await runStep('W5', 'validation: rỗng + planned range ngược', async (id) => {
    await closeDialogQuiet(page); // dọn tồn đọng từ step trước (chống cascade)
    const btn = page.getByRole('button', { name: 'Tạo Work Order', exact: true });
    await btn.click();
    await dlg(page).waitFor({ timeout: 15000 });
    await page.waitForFunction(() =>
      document.querySelectorAll('.bf-dialog #wo-worktype option').length > 1, { timeout: 25000 });
    // Case A: title rỗng + không chọn work type → submit → 2 field errors.
    await dlg(page).getByRole('button', { name: 'Tạo Work Order', exact: true }).click();
    await page.waitForFunction(() => {
      const d = document.querySelector('.bf-dialog');
      return d && /Tiêu đề công việc không được để trống/.test(d.textContent || '') &&
        /Loại công việc không được để trống/.test(d.textContent || '');
    }, { timeout: 15000 });
    await snap(page, 'W5-empty-errors', 'lỗi title + worktype rỗng');
    // Case B: planned range ngược.
    await dlg(page).locator('#wo-title').fill(`Thi công cột C1 tầng 2 ${DIG}`);
    await dlg(page).locator('#wo-worktype').selectOption(btct.id);
    await dlg(page).locator('#wo-start').fill('2026-10-10T08:00');
    await dlg(page).locator('#wo-end').fill('2026-10-05T17:00');
    await dlg(page).getByRole('button', { name: 'Tạo Work Order', exact: true }).click();
    await page.waitForFunction(() => {
      const d = document.querySelector('.bf-dialog');
      return d && /phải sau thời điểm bắt đầu/.test(d.textContent || '');
    }, { timeout: 15000 });
    await snap(page, 'W5-range-error', 'lỗi plannedEnd < plannedStart');
    const countAfter = psqlT(`SELECT count(*) FROM work_orders WHERE title LIKE '%${DIG}%';`);
    await closeDialogQuiet(page);
    return ok(id, `field errors đủ (title/workType/plannedEndAt); WO theo digits=${countAfter.trim()} (không tăng bởi W5)`);
  });

  // W6 — inactive work type vắng mặt khỏi picker.
  await runStep('W6', 'work type deactivate → ABSENT khỏi picker', async (id) => {
    await closeDialogQuiet(page); // dọn tồn đọng từ step trước (chống cascade)
    const c = await api('POST', '/api/v1/work-types', adminTok, {
      code: TEMP_WT_CODE, name: TEMP_WT_NAME, group: 'Hoàn thiện',
    });
    if (c.status !== 201) return fail(id, `tạo temp type ${c.status}: ${JSON.stringify(c.body)}`);
    const tmpId = c.body.id;
    vars.tempWorkTypeId = tmpId;
    saveVars();
    const d = await api('POST', `/api/v1/work-types/${tmpId}/status`, adminTok, {
      action: 'DEACTIVATE', reason: `Tạm dừng loại tạm phục vụ E2E (đợt T9/2026) ${DIG}`,
    });
    if (d.status !== 200) return fail(id, `deactivate ${d.status}: ${JSON.stringify(d.body)}`);
    const btn = page.getByRole('button', { name: 'Tạo Work Order', exact: true });
    await btn.click();
    await dlg(page).waitFor({ timeout: 15000 });
    await page.waitForFunction(() =>
      document.querySelectorAll('.bf-dialog #wo-worktype option').length > 1, { timeout: 25000 });
    const wt = await dlgOptionValues(page, '#wo-worktype');
    const present = wt.some((o) => o.value === tmpId || o.text.includes(TEMP_WT_CODE));
    await snap(page, 'W6-picker-absent', 'picker không chứa type inactive');
    await closeDialogQuiet(page);
    if (present) return fail(id, `temp type ${TEMP_WT_CODE} vẫn hiện trong picker`);
    return ok(id, `temp ${TEMP_WT_CODE} ABSENT khỏi ${wt.length} options`);
  });

  // W7 — PM tạo OK; worker bị ẩn nút + 403 PRA; worker đọc PRD OK; outsider 403.
  await runStep('W7', 'PM create 201; worker ẩn nút + 403 PRA, đọc PRD 200; outsider 403', async (id) => {
    await closeDialogQuiet(page); // dọn tồn đọng từ step trước (chống cascade)
    const pmTok = await getToken(PM.email, PM.pass);
    const workerTok = await getToken(WORKER.email, WORKER.pass);
    const outsiderTok = await getToken(OUTSIDER.email, OUTSIDER.pass);
    // 7a: PM qua UI.
    await loginWeb(page, PM.email, PM.pass);
    await page.goto(`${WEB}/projects/${pra.id}`, { waitUntil: 'networkidle' });
    const pmBtn = page.getByRole('button', { name: 'Tạo Work Order', exact: true });
    await pmBtn.waitFor({ timeout: 20000 });
    await pmBtn.click();
    await dlg(page).waitFor({ timeout: 15000 });
    await page.waitForFunction(() =>
      document.querySelectorAll('.bf-dialog #wo-worktype option').length > 1, { timeout: 25000 });
    await dlg(page).locator('#wo-title').fill(T_W7);
    await dlg(page).locator('#wo-worktype').selectOption(btct.id);
    await dlg(page).locator('#wo-area').selectOption(tm02.id);
    await dlg(page).getByRole('button', { name: 'Tạo Work Order', exact: true }).click();
    await page.waitForFunction(() => document.body.textContent.includes('Đã tạo Work Order'),
      { timeout: 25000 });
    const body = await page.locator('body').textContent();
    const m = body.match(/Đã tạo Work Order\s+(\S+)\s+\(id\s+([0-9a-f-]{36})\)/);
    await snap(page, 'W7-pm-created', 'PM tạo WO thành công');
    if (!m) return fail(id, 'PM không tạo được WO qua UI');
    const pmWoId = m[2];
    vars.woW7 = { id: pmWoId, code: m[1] };
    vars.workOrderIds.push(pmWoId);
    saveVars();
    // 7b: worker — nút HIDDEN ở PRA.
    await loginWeb(page, WORKER.email, WORKER.pass);
    await page.goto(`${WEB}/projects/${pra.id}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    const wBtnCount = await page.getByRole('button', { name: 'Tạo Work Order', exact: true }).count();
    await snap(page, 'W7-worker-hidden', 'worker không thấy nút ở PRA');
    if (wBtnCount !== 0) return fail(id, `worker vẫn thấy nút Tạo Work Order ở PRA (count=${wBtnCount})`);
    // 7c: worker GET WO của PM ở PRA → 403.
    const g1 = await api('GET', `/api/v1/work-orders/${pmWoId}`, workerTok);
    if (g1.status !== 403) return fail(id, `worker GET WO PRA kỳ vọng 403, được ${g1.status}`);
    // 7d: worker GET PRD-B1-001 (member PRD) → 200.
    const g2 = await api('GET', `/api/v1/work-orders/${seedWoId}`, workerTok);
    if (g2.status !== 200) return fail(id, `worker GET PRD WO kỳ vọng 200, được ${g2.status}: ${JSON.stringify(g2.body)}`);
    // 7e: outsider GET PRD-B1-001 → 403.
    const g3 = await api('GET', `/api/v1/work-orders/${seedWoId}`, outsiderTok);
    if (g3.status !== 403) return fail(id, `outsider GET PRD WO kỳ vọng 403, được ${g3.status}`);
    await closeDialogQuiet(page); // dọn success-dialog của PM (W8 goto cũng unmount)
    return ok(id, `PM ${m[1]}; worker PRA hidden+403; worker PRD 200; outsider 403`);
  });

  // W8 — audit-logs UI + DB.
  await runStep('W8', 'audit-logs UI entityType=WORK_ORDER + DB JOB_%', async (id) => {
    await loginWeb(page, ADMIN.email, ADMIN.pass);
    await page.goto(`${WEB}/admin/audit-logs?entityType=WORK_ORDER`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(4000);
    const body = await page.locator('body').textContent();
    const hasRows = /JOB_WORK_ORDER_CREATED/.test(body || '');
    const hasActor = /hoang\.anh@vinacons\.vn|quoc\.tran@vinacons\.vn/.test(body || '');
    await snap(page, 'W8-audit-logs', 'nhật ký audit WORK_ORDER');
    const db = execFileSync('docker', ['exec', 'buildflow-postgres-1', 'psql', '-U', 'buildflow', '-d',
      'buildflow', '-c',
      "SELECT action, entity_type, actor_user_id FROM audit_logs WHERE action LIKE 'JOB_%' ORDER BY created_at DESC LIMIT 6;"],
      { encoding: 'utf8', timeout: 20000 });
    if (!hasRows) return fail(id, `UI không hiện JOB_WORK_ORDER_CREATED. DB:\n${db}`);
    return ok(id, `UI rows JOB_WORK_ORDER_CREATED (actor=${hasActor}); DB:\n${db.trim().split('\n').slice(0, 10).join('\n')}`);
  });

  // W9 — G3 gate (API fixes slice): tạo WO trên project PRC (DRAFT) → 400
  // WORK_ORDER_PROJECT_NOT_ACTIVE + fieldErrors.projectId, không WO/audit mới.
  // PRC DRAFT sẵn có, không đổi status fixture; temp area dọn bằng SQL trong
  // finally (areas không có endpoint DELETE).
  await runStep('W9', 'G3 gate: WO trên project PRC DRAFT → 400 + fieldErrors', async (id) => {
    const prcId = '10000000-0000-4000-8000-000000000003';
    let tmpAreaId = null;
    try {
      const ca = await api('POST', `/api/v1/projects/${prcId}/areas`, adminTok, {
        code: `E2E-G3-${DIG}`, name: `Khu vực kiểm tra gate G3 ${DIG}`,
      });
      if (ca.status !== 201 || !ca.body.id) return fail(id, `tạo temp area ${ca.status}: ${JSON.stringify(ca.body)}`);
      tmpAreaId = ca.body.id;
      const woBefore = psqlT('SELECT count(*) FROM work_orders;');
      const r = await api('POST', '/api/v1/work-orders', adminTok, {
        projectId: prcId, workTypeId: btct.id, areaId: tmpAreaId,
        title: `Thi công kiểm tra gate G3 ${DIG}`,
      });
      const woAfter = psqlT('SELECT count(*) FROM work_orders;');
      if (r.status !== 400 || r.body.code !== 'WORK_ORDER_PROJECT_NOT_ACTIVE') {
        return fail(id, `kỳ vọng 400+WORK_ORDER_PROJECT_NOT_ACTIVE, được ${r.status}: ${JSON.stringify(r.body)}`);
      }
      if (!r.body.fieldErrors || !r.body.fieldErrors.projectId) {
        return fail(id, `thiếu fieldErrors.projectId: ${JSON.stringify(r.body)}`);
      }
      if (woBefore !== woAfter) return fail(id, `gate 400 nhưng vẫn ghi WO mới (${woBefore}→${woAfter})`);
      return ok(id, `400 WORK_ORDER_PROJECT_NOT_ACTIVE + fieldErrors.projectId; WO ${woBefore}→${woAfter} (không mới)`);
    } finally {
      if (tmpAreaId) psqlT(`DELETE FROM project_areas WHERE id='${tmpAreaId}';`);
    }
  });

  await browser.close();

  // Cleanup WO + temp type theo id (audit giữ nguyên).
  for (const wid of vars.workOrderIds.filter(Boolean)) {
    psqlT(`DELETE FROM work_orders WHERE id='${wid}';`);
  }
  if (vars.tempWorkTypeId) psqlT(`DELETE FROM work_types WHERE id='${vars.tempWorkTypeId}';`);
  const rest = psqlT(`SELECT count(*) FROM work_orders WHERE title LIKE '%${DIG}%';`);
  const wtRest = psqlT(`SELECT count(*) FROM work_types WHERE code='${TEMP_WT_CODE}';`);
  const areaRest = psqlT(`SELECT count(*) FROM project_areas WHERE code='E2E-G3-${DIG}';`);
  saveVars();

  const passed = results.filter((r) => r.ok).length;
  console.log(`\nTỔNG: ${passed}/${results.length} PASS (digits=${DIG}, cleanup WO rest=${rest.trim()}, tempWT rest=${wtRest.trim()}, tempArea rest=${areaRest.trim()})`);
  if (passed !== results.length) process.exitCode = 1;
}

main().catch((e) => { console.error('DRIVER FATAL:', e); process.exit(2); });
