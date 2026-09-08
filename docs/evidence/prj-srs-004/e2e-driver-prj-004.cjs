/**
 * PRJ-SRS-004 E2E driver (bổ sung) — Quản lý loại công việc /work-types (issue #35).
 * Evidence-only script; phạm vi docs/evidence — KHÔNG sửa source.
 *
 * Bổ sung cho e2e-driver-prj-srs-004.cjs (S1–S9 đã 9/9 PASS, xem
 * PRJ-SRS-004-E2E.md): các scénario A1–A5/B1–B4/C1–C3/D1 — duplicate-409 UI,
 * client-validation duration, alreadyInState, reactivate, picker exclusion,
 * PM create, worker 403 UI, anon 401, audit-logs UI filter.
 *
 * Pattern theo prj-srs-005 (playwright-core absolute path, Chrome headless,
 * login flow, api() kèm X-Correlation-Id UUID mới) + bài học F2 của driver
 * S1–S9: MỌI tương tác trong dialog phải scope vào `.bf-dialog` (id
 * `worktype-group` tồn tại 2 lần khi dialog mở: filter sau lưng + form).
 *
 * Chạy:   node e2e-driver-prj-004.cjs
 * Yêu cầu: stack từ HEAD có web slice /work-types mới (form #worktype-duration,
 *          #worktype-priority + panel 'Xem trước cấu hình'); admin/PM/worker
 *          canonical docs/demo-data.md.
 *
 * Quy ước: mã WT-E2E-<digits> (cleanup prefix đầu/cuối run, audit giữ
 *          nguyên — append-only). Tên hiển thị realistic, không chứa E2E.
 * Vars riêng e2e-vars-prj-004.json để không đè e2e-vars.json của driver S1–S9.
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

const D6 = Date.now().toString().slice(-6);
const CODE_T1 = `WT-E2E-${D6}`;
const CODE_TX = `WT-E2E-X${D6}`;
const CODE_PM = `WT-E2E-P${D6}`;
const CODE_A4 = `WT-E2E-V${D6}`;
const NAME_T1 = `Ốp lát tường vệ sinh ${D6}`;
const NAME_T1_NEW = `Ốp lát tường vệ sinh ${D6} (cập nhật)`;
const NAME_TX = `Đổ bê tông lót ${D6}`;
const NAME_PM = `Sơn nước mặt tiền ${D6}`;
const GROUP = 'Hoàn thiện';
const REASON_OFF = 'Tạm ngừng cho E2E';
const REASON_ON = 'Mở lại sau E2E';

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
/** Root scope của dialog đang mở (bài học F2: id trùng với filter sau lưng). */
function dlg(page) {
  return page.locator('.bf-dialog').last();
}
async function dlgSetValue(page, selector, value) {
  const loc = dlg(page).locator(selector);
  for (let i = 0; i < 12; i++) {
    try {
      await loc.evaluate((el, v) => {
        const tag = el.tagName;
        if (tag === 'SELECT') {
          el.value = v;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          const proto = tag === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const desc = Object.getOwnPropertyDescriptor(proto, 'value');
          if (desc && desc.set) desc.set.call(el, v);
          else el.value = v;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, value);
      await new Promise((r) => setTimeout(r, 150));
      const cur = await loc.evaluate((el) => el.value).catch(() => null);
      if (cur === value) {
        await new Promise((r) => setTimeout(r, 150));
        return;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  try {
    await loc.fill(value, { timeout: 10000 });
    const cur = await loc.evaluate((el) => el.value).catch(() => null);
    if (cur === value) return;
  } catch {}
  throw new Error(`dlgSetValue failed: ${selector}`);
}
async function dlgFill(page, selector, value) {
  await dlg(page).locator(selector).fill(value, { timeout: 15000 });
}
/** Click nút trong dialog qua DOM (bypass stability — form re-render khi
 *  trades load hay preview live có thể detach node giữa chừng). */
async function dlgClick(page, roleName) {
  const btn = dlg(page).getByRole('button', { name: roleName, exact: true });
  for (let i = 0; i < 12; i++) {
    try {
      await btn.evaluate((el) => el.click());
      return;
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`dlgClick failed: ${roleName}`);
}
async function dlgWaitTradeOptions(page) {
  await page.waitForFunction(
    () => document.querySelectorAll('.bf-dialog #worktype-trade option').length > 1,
    undefined, { timeout: 20000 });
}
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16));
}
function runCleanup() {
  try {
    execFileSync('docker', ['exec', 'buildflow-postgres-1', 'psql', '-U', 'buildflow', '-d', 'buildflow', '-c',
      `DELETE FROM work_types WHERE code LIKE 'WT-E2E-%';`],
    { encoding: 'utf8', timeout: 20000 });
  } catch (e) {
    console.log(`cleanup WARN ${(e.stderr || e.message || '').slice(0, 200)}`);
  }
}
async function gotoList(page) {
  await page.goto(`${WEB}/work-types`, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    () => !(document.body.textContent || '').includes('Đang tải danh sách loại công việc…'),
    { timeout: 25000 });
}
async function gotoDetail(page, id) {
  await page.goto(`${WEB}/work-types/${id}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    () => !(document.body.textContent || '').includes('Đang tải chi tiết loại công việc…'),
    { timeout: 25000 });
}
async function openCreate(page) {
  await page.getByRole('button', { name: 'Thêm mới', exact: true }).click();
  await page.waitForFunction(
    () => (document.body.textContent || '').includes('Thêm loại công việc'),
    { timeout: 15000 });
  await dlgWaitTradeOptions(page);
}
async function closeDialog(page) {
  await dlgClick(page, 'Hủy').catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForFunction(
    () => document.querySelectorAll('.bf-dialog').length === 0,
    undefined, { timeout: 10000 }).catch(() => {});
}
async function addFieldRow(page, n, key, label, type) {
  await dlg(page).getByRole('button', { name: 'Thêm trường dữ liệu', exact: true })
    .evaluate((el) => el.click());
  await dlg(page).locator(`#worktype-field-key-${n}`).waitFor({ timeout: 15000 });
  await dlgSetValue(page, `#worktype-field-key-${n}`, key);
  await dlgSetValue(page, `#worktype-field-label-${n}`, label);
  await dlgSetValue(page, `#worktype-field-type-${n}`, type);
}
/** Điền form tạo chuẩn. Bọc retry toàn khối: re-render có thể detach node. */
async function fillCreateForm(page, { code, name, group, trade, desc, duration, priority, fields }) {
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const n = await dlg(page).locator('#worktype-trade').count().catch(() => -1);
      if (n !== 1) throw new Error(`dialog #worktype-trade count=${n} (mong 1)`);
      await dlgFill(page, '#worktype-code', code);
      await dlgFill(page, '#worktype-name', name);
      if (group !== undefined) await dlgFill(page, '#worktype-group', group);
      await dlgSetValue(page, '#worktype-trade', trade);
      if (desc !== undefined) await dlgSetValue(page, '#worktype-description', desc);
      if (duration !== undefined) await dlgSetValue(page, '#worktype-duration', duration);
      if (priority !== undefined) await dlgSetValue(page, '#worktype-priority', priority);
      if (fields) {
        for (let i = 0; i < fields.length; i++) {
          await addFieldRow(page, i, fields[i].key, fields[i].label, fields[i].type);
        }
      }
      return;
    } catch (e) {
      lastErr = e;
      console.log(`  fillCreateForm attempt ${attempt} FAIL: ${(e.message || e).toString().slice(0, 160)}`);
      await closeDialog(page);
      await new Promise((r) => setTimeout(r, 1000));
      await openCreate(page);
    }
  }
  throw lastErr;
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
  console.log(`baseline: audit=${auditBaseline}, D6=${D6}`);

  const tr = await api('GET', '/api/v1/trades?status=ACTIVE&limit=100', adminToken);
  const trades = (tr.body && tr.body.data ? tr.body.data : []).filter((t) => t.status === 'ACTIVE');
  if (trades.length === 0) {
    console.error('Không có trade ACTIVE để gán requiredTradeId');
    await browser.close().catch(() => {});
    process.exit(2);
  }
  const tradeId = trades[0].id;
  console.log(`trade: ${trades[0].code} — ${trades[0].name}`);

  const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pmCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const workerCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const adminPage = await adminCtx.newPage();
  const pmPage = await pmCtx.newPage();
  const workerPage = await workerCtx.newPage();
  for (const p of [adminPage, pmPage, workerPage]) p.setDefaultTimeout(30000);

  let idT1 = null, idTX = null, idPM = null;
  const dbExcerpts = {};

  try {
    // ============ A1: admin login → list loads ============
    await step('A1', 'Admin login → /work-types list loads', async (id) => {
      await loginWeb(adminPage, ADMIN_EMAIL, ADMIN_PASS);
      await gotoList(adminPage);
      const t = await bodyText(adminPage);
      if (!t.includes('Tổng:') || !t.includes('loại công việc')) {
        return fail(id, `list thiếu toolbar Tổng: ${t.slice(0, 200)}`);
      }
      await snap(adminPage, `${id}-list`, 'Admin: danh sách loại công việc');
      return ok(id, 'login admin → list loads (toolbar Tổng + table)');
    })();

    // ============ A2: create + preview mới ============
    await step('A2', 'Create dialog: duration 120 + priority HIGH + preview → appears', async (id) => {
      await gotoList(adminPage);
      await openCreate(adminPage);
      await fillCreateForm(adminPage, {
        code: CODE_T1, name: NAME_T1, group: GROUP, trade: tradeId,
        desc: 'Ốp lát gạch men tường khu vệ sinh theo bản vẽ KT-VS',
        duration: '120', priority: 'HIGH',
        fields: [
          { key: 'dien_tich', label: 'Diện tích (m²)', type: 'NUMBER' },
          { key: 'anh_nghiem_thu', label: 'Ảnh nghiệm thu', type: 'PHOTO' },
        ],
      });
      const t0 = await bodyText(adminPage);
      for (const need of ['Xem trước cấu hình', '120 phút', 'Cao', 'Diện tích (m²)', 'Ảnh nghiệm thu']) {
        if (!t0.includes(need)) return fail(id, `preview thiếu "${need}"`);
      }
      await snap(adminPage, `${id}-preview`, 'Preview: 120 phút / Cao / chips fields');
      await dlgClick(adminPage, 'Tạo loại công việc');
      await adminPage.waitForFunction(
        () => (document.body.textContent || '').includes('Tạo loại công việc thành công'),
        { timeout: 25000 });
      await adminPage.waitForFunction(
        (n) => (document.body.textContent || '').includes(n),
        NAME_T1, { timeout: 25000 });
      await snap(adminPage, `${id}-created`, 'List sau khi tạo: row mới hiện');
      const g = await api('GET', `/api/v1/work-types?search=${encodeURIComponent(CODE_T1)}`, adminToken);
      const hit = (g.body && g.body.data ? g.body.data : []).find((w) => w.code === CODE_T1);
      if (!hit) return fail(id, `GET search thiếu ${CODE_T1}`);
      idT1 = hit.id;
      if (hit.defaultDurationMinutes !== 120) return fail(id, `duration=${hit.defaultDurationMinutes} (mong 120)`);
      if (hit.defaultPriority !== 'HIGH') return fail(id, `priority=${hit.defaultPriority} (mong HIGH)`);
      if (hit.configVersion !== 1) return fail(id, `configVersion=${hit.configVersion} (mong 1)`);
      if (!Array.isArray(hit.requiredFields) || hit.requiredFields.length !== 2) {
        return fail(id, `requiredFields=${JSON.stringify(hit.requiredFields).slice(0, 200)}`);
      }
      const au = psqlT(`SELECT actor_user_id||'|'||action FROM audit_logs WHERE entity_id='${idT1}' AND action='PRJ_WORK_TYPE_CREATED'`);
      if (!au.split('\n').some((r) => r.startsWith(`${ADMIN_ID}|PRJ_WORK_TYPE_CREATED`))) {
        return fail(id, `thiếu audit CREATED actor admin: ${au.slice(0, 200)}`);
      }
      return ok(id, `preview 120 phút/Cao/chips đủ; tạo ${CODE_T1} v1 duration=120 priority=HIGH; audit CREATED admin`);
    })();

    // ============ A3: duplicate code → 409 field error ============
    await step('A3', 'Trùng mã → 409 field error ở Mã, không crash', async (id) => {
      if (!idT1) return fail(id, 'A2 chưa tạo idT1 (cascade)');
      await gotoList(adminPage);
      await openCreate(adminPage);
      await fillCreateForm(adminPage, {
        code: CODE_T1, name: 'Tên khác cho mã trùng', trade: tradeId,
      });
      await dlgClick(adminPage, 'Tạo loại công việc');
      await adminPage.waitForFunction(
        () => (document.body.textContent || '').includes('Mã loại công việc đã tồn tại'),
        { timeout: 25000 });
      const codeErr = await dlg(adminPage).locator('#worktype-code').evaluate((el) => {
        const wrap = el.closest('.bf-field');
        return wrap ? wrap.textContent || '' : '';
      }).catch(() => '');
      if (!codeErr.includes('Mã loại công việc đã tồn tại')) {
        return fail(id, `lỗi không nằm ở field Mã: ${codeErr.slice(0, 200)}`);
      }
      await snap(adminPage, `${id}-duplicate`, 'Field error Mã loại công việc đã tồn tại');
      await closeDialog(adminPage);
      const dup = await api('POST', '/api/v1/work-types', adminToken,
        { code: CODE_T1, name: 'Tên khác cho mã trùng', requiredTradeId: tradeId });
      if (dup.status !== 409 || dup.body.code !== 'WORK_TYPE_CODE_DUPLICATE') {
        return fail(id, `API dup status=${dup.status} ${JSON.stringify(dup.body).slice(0, 200)}`);
      }
      const n = psqlT(`SELECT count(*) FROM work_types WHERE code='${CODE_T1}'`);
      if (n !== '1') return fail(id, `rows=${n} (mong 1)`);
      return ok(id, 'UI field error Mã + API 409 WORK_TYPE_CODE_DUPLICATE; rows=1, dialog không crash');
    })();

    // ============ A4: duration 'abc' → client validation ============
    await step('A4', "Duration 'abc' → lỗi client-side, chặn submit", async (id) => {
      await gotoList(adminPage);
      await openCreate(adminPage);
      await fillCreateForm(adminPage, {
        code: CODE_A4, name: 'Loại kiểm tra duration', trade: tradeId, duration: 'abc',
      });
      await dlgClick(adminPage, 'Tạo loại công việc');
      await adminPage.waitForFunction(
        () => (document.body.textContent || '').includes('Thời lượng mặc định phải là số nguyên dương'),
        { timeout: 25000 });
      const t = await bodyText(adminPage);
      if (!t.includes('Thêm loại công việc')) return fail(id, 'dialog đã đóng sau lỗi validation');
      if (t.includes('Tạo loại công việc thành công')) return fail(id, 'submit vẫn chạy dù duration invalid');
      await snap(adminPage, `${id}-validation`, "Lỗi client: duration 'abc'");
      await closeDialog(adminPage);
      const n = psqlT(`SELECT count(*) FROM work_types WHERE code='${CODE_A4}'`);
      if (n !== '0') return fail(id, `bản ghi invalid lọt DB (rows=${n})`);
      return ok(id, 'client error Thời lượng…số nguyên dương; dialog ở lại; không bản ghi');
    })();

    // ============ A5: detail + edit prefill + bump v2 ============
    await step('A5', 'Detail v1 + edit prefill/preview → đổi tên → v2 + audit', async (id) => {
      if (!idT1) return fail(id, 'A2 chưa tạo idT1 (cascade)');
      await gotoDetail(adminPage, idT1);
      const t = await bodyText(adminPage);
      for (const need of [NAME_T1, CODE_T1, 'Phiên bản cấu hình', 'v1']) {
        if (!t.includes(need)) return fail(id, `detail thiếu "${need}"`);
      }
      const g0 = await api('GET', `/api/v1/work-types/${idT1}`, adminToken);
      if (g0.status !== 200) return fail(id, `GET detail status=${g0.status}`);
      if (!g0.body.usage || g0.body.usage.workOrders !== 0) {
        return fail(id, `usage.workOrders=${JSON.stringify(g0.body.usage)} (mong 0)`);
      }
      await snap(adminPage, `${id}-detail`, 'Detail v1: profile + configVersion');
      await adminPage.getByRole('button', { name: 'Sửa', exact: true }).click();
      await adminPage.waitForFunction(
        () => (document.body.textContent || '').includes('Sửa loại công việc'),
        { timeout: 15000 });
      await adminPage.waitForFunction(
        () => !(document.body.textContent || '').includes('Đang tải…'),
        { timeout: 15000 });
      const codeVal = await dlg(adminPage).locator('#worktype-code').inputValue();
      if (codeVal !== CODE_T1) return fail(id, `prefill code=${codeVal} (mong ${CODE_T1})`);
      const durVal = await dlg(adminPage).locator('#worktype-duration').inputValue();
      if (durVal !== '120') return fail(id, `prefill duration=${durVal} (mong 120)`);
      const te = await bodyText(adminPage);
      if (!te.includes('Xem trước cấu hình')) return fail(id, 'edit dialog thiếu preview');
      await snap(adminPage, `${id}-edit-prefill`, 'Edit: prefill + preview');
      await dlgFill(adminPage, '#worktype-name', NAME_T1_NEW);
      await dlgClick(adminPage, 'Lưu thay đổi');
      await adminPage.waitForFunction(
        () => (document.body.textContent || '').includes('Cập nhật loại công việc thành công'),
        { timeout: 25000 });
      await adminPage.waitForFunction(
        (n) => (document.body.textContent || '').includes(n),
        NAME_T1_NEW, { timeout: 25000 });
      await snap(adminPage, `${id}-updated`, 'Detail sau sửa: tên mới + v2');
      const g = await api('GET', `/api/v1/work-types/${idT1}`, adminToken);
      if (g.body.configVersion !== 2) return fail(id, `configVersion=${g.body.configVersion} (mong 2)`);
      if (g.body.name !== NAME_T1_NEW) return fail(id, `name chưa đổi: ${g.body.name}`);
      const db = psqlT(`SELECT code||'|'||name||'|'||config_version::text||'|'||is_active::text FROM work_types WHERE id='${idT1}'`);
      if (db !== `${CODE_T1}|${NAME_T1_NEW}|2|true`) return fail(id, `psql row sai: ${db}`);
      const au = psqlT(`SELECT actor_user_id||'|'||action FROM audit_logs WHERE entity_id='${idT1}' AND action='PRJ_WORK_TYPE_UPDATED' ORDER BY created_at DESC LIMIT 1`);
      if (!au.includes(`${ADMIN_ID}|PRJ_WORK_TYPE_UPDATED`)) {
        return fail(id, `thiếu audit UPDATED actor admin: ${au.slice(0, 200)}`);
      }
      return ok(id, `detail v1 + usage.workOrders=0; prefill+preview đủ; đổi tên → v2; psql ${CODE_T1}|…|2|true`);
    })();

    // ============ B1: deactivate + reason ============
    await step('B1', 'Ngừng hoạt động (reason) → INACTIVE + audit', async (id) => {
      if (!idT1) return fail(id, 'thiếu idT1 (cascade)');
      await gotoDetail(adminPage, idT1);
      await adminPage.getByRole('button', { name: 'Ngừng hoạt động', exact: true }).click();
      await adminPage.waitForFunction(
        () => (document.body.textContent || '').includes('Ngừng hoạt động loại công việc'),
        { timeout: 15000 });
      await dlgSetValue(adminPage, '#worktype-status-reason', REASON_OFF);
      await dlgClick(adminPage, 'Xác nhận');
      await adminPage.waitForFunction(
        () => (document.body.textContent || '').includes('Đã chuyển sang Ngừng hoạt động'),
        { timeout: 25000 });
      await snap(adminPage, `${id}-deactivated`, 'Detail sau deactivate: badge Ngừng hoạt động');
      const db = psqlT(`SELECT is_active::text FROM work_types WHERE id='${idT1}'`);
      if (db !== 'false') return fail(id, `psql is_active=${db} (mong false)`);
      const au = psqlT(`SELECT reason FROM audit_logs WHERE entity_id='${idT1}' AND action='PRJ_WORK_TYPE_STATUS_CHANGED' ORDER BY created_at DESC LIMIT 1`);
      if (!au.includes(REASON_OFF)) return fail(id, `audit reason thiếu: ${au.slice(0, 200)}`);
      return ok(id, 'UI badge Ngừng hoạt động; psql is_active=false; audit reason đủ');
    })();

    // ============ B2: repeat deactivate → alreadyInState ============
    await step('B2', 'Deactivate lặp → alreadyInState, không audit mới', async (id) => {
      if (!idT1) return fail(id, 'thiếu idT1 (cascade)');
      const before = psqlT(`SELECT count(*) FROM audit_logs WHERE entity_id='${idT1}' AND action='PRJ_WORK_TYPE_STATUS_CHANGED'`);
      const r2 = await api('POST', `/api/v1/work-types/${idT1}/status`, adminToken,
        { action: 'DEACTIVATE', reason: REASON_OFF });
      if (r2.status !== 200 || r2.body.alreadyInState !== true) {
        return fail(id, `lần 2 status=${r2.status} ${JSON.stringify(r2.body).slice(0, 200)}`);
      }
      const after = psqlT(`SELECT count(*) FROM audit_logs WHERE entity_id='${idT1}' AND action='PRJ_WORK_TYPE_STATUS_CHANGED'`);
      if (before !== after) return fail(id, `audit tăng sau idempotent (${before}→${after})`);
      await gotoDetail(adminPage, idT1);
      await snap(adminPage, `${id}-already`, 'Detail vẫn INACTIVE (repeat không đổi gì)');
      return ok(id, `API alreadyInState=true; audit ${before}→${after} (không dòng mới)`);
    })();

    // ============ B3: reactivate ============
    await step('B3', 'Kích hoạt lại → ACTIVE', async (id) => {
      if (!idT1) return fail(id, 'thiếu idT1 (cascade)');
      await gotoDetail(adminPage, idT1);
      await adminPage.getByRole('button', { name: 'Kích hoạt lại', exact: true }).click();
      await adminPage.waitForFunction(
        () => (document.body.textContent || '').includes('Kích hoạt lại loại công việc'),
        { timeout: 15000 });
      await dlgSetValue(adminPage, '#worktype-status-reason', REASON_ON);
      await dlgClick(adminPage, 'Xác nhận');
      await adminPage.waitForFunction(
        () => (document.body.textContent || '').includes('Đã kích hoạt lại'),
        { timeout: 25000 });
      await snap(adminPage, `${id}-reactivated`, 'Detail sau reactivate: badge Hoạt động');
      const g = await api('GET', `/api/v1/work-types/${idT1}`, adminToken);
      if (g.body.status !== 'ACTIVE') return fail(id, `status=${g.body.status} (mong ACTIVE)`);
      return ok(id, 'UI Đã kích hoạt lại + badge Hoạt động; API status=ACTIVE');
    })();

    // ============ B4: ?status=ACTIVE loại trừ inactive ============
    await step('B4', '?status=ACTIVE loại trừ type INACTIVE (picker WO mới)', async (id) => {
      const c = await api('POST', '/api/v1/work-types', adminToken,
        { code: CODE_TX, name: NAME_TX, requiredTradeId: tradeId });
      if (c.status !== 201) return fail(id, `tạo TX status=${c.status} ${JSON.stringify(c.body).slice(0, 200)}`);
      idTX = c.body.id;
      const d = await api('POST', `/api/v1/work-types/${idTX}/status`, adminToken,
        { action: 'DEACTIVATE', reason: 'Giữ mẫu kiểm chứng picker loại trừ inactive' });
      if (d.status !== 200) return fail(id, `deactivate TX status=${d.status}`);
      const r = await api('GET', '/api/v1/work-types?status=ACTIVE&limit=100', adminToken);
      if (r.status !== 200 || !Array.isArray(r.body.data)) {
        return fail(id, `GET ?status=ACTIVE status=${r.status}`);
      }
      const codes = r.body.data.map((w) => w.code);
      if (codes.includes(CODE_TX)) return fail(id, 'picker vẫn chứa type vừa deactivate');
      if (!codes.includes(CODE_T1)) return fail(id, 'picker thiếu T1 đã reactivate');
      if (r.body.data.some((w) => w.status !== 'ACTIVE')) return fail(id, 'picker trả row INACTIVE');
      await gotoDetail(adminPage, idTX);
      await snap(adminPage, `${id}-excluded`, 'TX detail INACTIVE + Bị chặn (picker loại trừ)');
      const t = await bodyText(adminPage);
      if (!t.includes('Bị chặn')) return fail(id, 'detail TX thiếu cảnh báo Bị chặn');
      return ok(id, `?status=ACTIVE total=${r.body.total}: loại trừ ${CODE_TX}, giữ ${CODE_T1} (forward-ref JOB-SRS-001/002)`);
    })();

    // ============ C1: PM đọc + tạo ============
    await step('C1', 'PM đọc list + tạo được loại (§13 matrix)', async (id) => {
      await loginWeb(pmPage, PM_EMAIL, PM_PASS);
      await gotoList(pmPage);
      const t = await bodyText(pmPage);
      if (!t.includes('Tổng:')) return fail(id, 'PM không đọc được list');
      if (!t.includes(CODE_T1) && !t.includes(NAME_T1_NEW)) {
        return fail(id, 'list PM thiếu T1');
      }
      await snap(pmPage, `${id}-pm-list`, 'PM: list đọc được');
      await openCreate(pmPage);
      await fillCreateForm(pmPage, {
        code: CODE_PM, name: NAME_PM, group: GROUP, trade: tradeId,
      });
      await dlgClick(pmPage, 'Tạo loại công việc');
      await pmPage.waitForFunction(
        () => (document.body.textContent || '').includes('Tạo loại công việc thành công'),
        { timeout: 25000 });
      await pmPage.waitForFunction(
        (n) => (document.body.textContent || '').includes(n),
        NAME_PM, { timeout: 25000 });
      await snap(pmPage, `${id}-pm-created`, 'PM tạo loại mới thành công');
      const g = await api('GET', `/api/v1/work-types?search=${encodeURIComponent(CODE_PM)}`, pmToken);
      const hit = (g.body && g.body.data ? g.body.data : []).find((w) => w.code === CODE_PM);
      if (!hit) return fail(id, `GET search thiếu ${CODE_PM}`);
      idPM = hit.id;
      const au = psqlT(`SELECT actor_user_id||'|'||action FROM audit_logs WHERE entity_id='${idPM}' AND action='PRJ_WORK_TYPE_CREATED'`);
      if (!au.split('\n').some((r) => r.startsWith(`${PM_ID}|PRJ_WORK_TYPE_CREATED`))) {
        return fail(id, `thiếu audit CREATED actor PM: ${au.slice(0, 200)}`);
      }
      return ok(id, `PM đọc list + tạo ${CODE_PM}; audit CREATED actor PM`);
    })();

    // ============ C2: worker 403 ============
    await step('C2', 'Worker → 403 UI + API', async (id) => {
      const w = await api('GET', '/api/v1/work-types?limit=5', workerToken);
      if (w.status !== 403) return fail(id, `worker API GET=${w.status} (mong 403)`);
      await loginWeb(workerPage, WORKER_EMAIL, WORKER_PASS);
      await workerPage.goto(`${WEB}/work-types`, { waitUntil: 'networkidle' });
      await workerPage.waitForFunction(
        () => (document.body.textContent || '').includes('Không có quyền truy cập — cần ADMIN hoặc Điều phối (403)'),
        { timeout: 25000 });
      const retryCount = await workerPage.getByRole('button', { name: 'Thử lại', exact: true }).count();
      if (retryCount === 0) return fail(id, 'thiếu nút Thử lại ở card 403');
      await snap(workerPage, `${id}-worker403`, 'Worker: 403 + Thử lại');
      return ok(id, 'API 403 + UI alert 403 kèm Thử lại');
    })();

    // ============ C3: anon 401 ============
    await step('C3', 'Anonymous GET → 401', async (id) => {
      const r = await fetch(`${API}/api/v1/work-types?limit=5`, { headers: { Accept: 'application/json' } });
      if (r.status !== 401) return fail(id, `anon GET=${r.status} (mong 401)`);
      return ok(id, 'anon GET /work-types → 401 đúng contract');
    })();

    // ============ D1: audit-logs filter WORK_TYPE ============
    await step('D1', 'Audit-logs filter WORK_TYPE → rows PRJ_WORK_TYPE_* + actor', async (id) => {
      await adminPage.goto(`${WEB}/admin/audit-logs?entityType=WORK_TYPE`, { waitUntil: 'networkidle' });
      await adminPage.waitForFunction(
        () => (document.body.textContent || '').includes('PRJ_WORK_TYPE_CREATED'),
        { timeout: 25000 });
      const t = await bodyText(adminPage);
      for (const need of ['PRJ_WORK_TYPE_CREATED', 'PRJ_WORK_TYPE_STATUS_CHANGED', 'WORK_TYPE', '11111111', '22222222']) {
        if (!t.includes(need)) return fail(id, `audit UI thiếu "${need}"`);
      }
      await snap(adminPage, `${id}-audit`, 'Audit-logs: filter WORK_TYPE + actor');
      return ok(id, 'UI đủ CREATED/STATUS_CHANGED + actor admin(11111111)/PM(22222222)');
    })();

    // ============ DB excerpts cho báo cáo (trước cleanup) ============
    dbExcerpts.workTypes = psqlT(
      `SELECT code, name, config_version, is_active FROM work_types WHERE code LIKE 'WT-E2E-%' ORDER BY code;`);
    dbExcerpts.auditLogs = psqlT(
      `SELECT action, entity_type, reason FROM audit_logs WHERE entity_type='WORK_TYPE' ORDER BY created_at DESC LIMIT 10;`);
    console.log(`db work_types:\n${dbExcerpts.workTypes}`);
    console.log(`db audit_logs:\n${dbExcerpts.auditLogs}`);
  } finally {
    runCleanup();
    const rest = psqlT(`SELECT count(*) FROM work_types WHERE code LIKE 'WT-E2E-%'`);
    const auditFinal = psqlT('SELECT count(*) FROM audit_logs');
    console.log(`cleanup: WT-E2E-% rest=${rest}, audit ${auditBaseline}→${auditFinal} (tăng do CREATED/UPDATED/STATUS_CHANGED hợp lệ; audit giữ nguyên)`);
    fs.writeFileSync(path.join(__dirname, 'e2e-vars-prj-004.json'), JSON.stringify({
      _note: 'Throwaway E2E-only demo credentials (seed/reset per evidence docs). Never production.',
      admin: ADMIN_EMAIL, pm: PM_EMAIL, worker: WORKER_EMAIL,
      digits: D6, codes: { T1: CODE_T1, TX: CODE_TX, PM: CODE_PM, A4: CODE_A4 },
      ids: { T1: idT1, TX: idTX, PM: idPM },
      tradeId,
      auditBaseline, auditFinal, rest, dbExcerpts, results,
    }, null, 2));
    const passed = results.filter((r) => r.ok).length;
    console.log(`\nTỔNG: ${passed}/${results.length} PASS`);
    await browser.close().catch(() => {});
    process.exit(passed === results.length ? 0 : 1);
  }
})();
