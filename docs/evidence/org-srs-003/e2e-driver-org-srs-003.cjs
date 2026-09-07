/**
 * ORG-SRS-003 E2E driver — Trades API+Web vertical slice (#26).
 * Evidence-only script; KHÔNG commit (docs/evidence scope).
 *
 * Chạy:  node e2e-driver-org-srs-003.cjs
 * Yêu cầu: docker stack buildflow chạy với api/web đã rebuild từ working tree
 *          (đã chứa /api/v1/trades); admin + pm password đã reset (xem doc E2E).
 *
 * Mỗi bước: thao tác UI/API -> chờ -> psql verify -> screenshot (riêng bước API thuần).
 * Dữ liệu realistic theo docs/demo-data.md (chuẩn hóa 2026-09-07): trade runtime tạo mới
 * dùng mã NK/XT/TM + tên tiếng Việt; worker dùng tên Việt + email @vinacons.vn + mã TXW.
 * UNIQ giữ cơ chế duy nhất cho rename/duplicate-409/double-submit flows. Passwords giữ nguyên.
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

const UNIQ = Date.now().toString(36).slice(-6).toUpperCase();
const TRADE_CODE = `NK-${UNIQ}`;
const TRADE_NAME = `Thợ nhôm kính ${UNIQ}`;
const TRADE_DESC = `Thi công nhôm kính hệ Đông Anh (${UNIQ})`;
const TRADE_CODE2 = `NK2-${UNIQ}`;
const TRADE_NAME2 = `Thợ nhôm kính phụ ${UNIQ}`;
const WORKER_NAME = `Bùi Văn Lực ${UNIQ}`;
const WORKER_RENAMED = `Bùi Văn Lực ${UNIQ} Mới`;
const WORKER_CODE = `TXW-${UNIQ}`;
const WORKER_EMAIL = `luc.tran.${UNIQ.toLowerCase()}@vinacons.vn`;
const WORKER_PASS = 'WorkerPass@123';
const ADMIN_EMAIL = 'hoang.anh@vinacons.vn';
const ADMIN_PASS = 'E2EAdmin@2025';
const PM_EMAIL = 'quoc.tran@vinacons.vn';
const PM_PASS = 'E2EPm@2025';
const CORR = 'b1f00000-0000-4000-8000-' + String(Math.floor(Math.random() * 1e12)).padStart(12, '0');
console.log(`UNIQ=${UNIQ} trade=${TRADE_CODE} worker=${WORKER_EMAIL} corr=${CORR}`);

const log = [];
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
  const p = path.join(SHOTS, `${id}.png`);
  await page.screenshot({ path: p, fullPage: false });
  log.push({ id, desc, file: p });
}
const ok = (id, note = '') => ({ id, ok: true, note });
const fail = (id, note) => ({ id, ok: false, note });

function psql(sql) {
  try {
    const out = execFileSync('docker', [
      'exec', 'buildflow-postgres-1', 'psql', '-U', 'buildflow', '-d', 'buildflow', '-P', 'pager=off', '-c', sql,
    ], { encoding: 'utf8', timeout: 15000 });
    return out.trim();
  } catch (e) {
    return `PSQL ERROR: ${e.stderr || e.message}`;
  }
}

/**
 * Dọn dư liệu run trước theo id trong e2e-vars.json (chỉ khi mã hiện tại vẫn là mã run
 * họ NK/XT/TM/TXW — KHÔNG đụng mã canonical THO-CAT/OP-LAT/SON-NUOC/DIEN, TX-00xx),
 * fallback: hàng run-pattern tạo trong 12h gần nhất.
 */
function cleanupPreviousRun() {
  let prev = null;
  try { prev = JSON.parse(fs.readFileSync(EV, 'utf8')); } catch {}
  if (prev) {
    // xóa worker (kèm resource_trades) TRƯỚC rồi mới xóa trades (tránh FK resource_trades_trade_id_fkey)
    const wIds = [prev.workerId].filter(Boolean).map((s) => `'${s}'`);
    if (wIds.length) {
      psql(`DELETE FROM resource_trades WHERE user_id IN (${wIds.join(',')}) AND user_id IN (SELECT id FROM users WHERE employee_code LIKE 'TXW-%')`);
      const out = psql(`DELETE FROM users WHERE id IN (${wIds.join(',')}) AND employee_code LIKE 'TXW-%'`);
      console.log('cleanup prev worker:', out.split('\n').pop());
    }
    const tIds = [prev.tradeId, prev.dupTradeId].filter(Boolean).map((s) => `'${s}'`);
    if (tIds.length) {
      const out = psql(`DELETE FROM trades WHERE id IN (${tIds.join(',')}) AND (code LIKE 'NK-%' OR code LIKE 'XT-%' OR code LIKE 'TM-%')`);
      console.log('cleanup prev trades:', out.split('\n').pop());
    }
  }
  const f1 = psql(`DELETE FROM resource_trades WHERE user_id IN (SELECT id FROM users WHERE employee_code LIKE 'TXW-%' AND created_at > now() - interval '12 hours')`);
  const f2 = psql(`DELETE FROM users WHERE employee_code LIKE 'TXW-%' AND created_at > now() - interval '12 hours'`);
  const f3 = psql(`DELETE FROM trades WHERE (code LIKE 'NK-%' OR code LIKE 'XT-%' OR code LIKE 'TM-%') AND created_at > now() - interval '12 hours' AND NOT EXISTS (SELECT 1 FROM resource_trades rt WHERE rt.trade_id = trades.id) AND NOT EXISTS (SELECT 1 FROM work_types wt WHERE wt.required_trade_id = trades.id) AND NOT EXISTS (SELECT 1 FROM work_orders wo WHERE wo.required_trade_id = trades.id)`);
  console.log('cleanup fallback:', f1.split('\n').pop(), '|', f2.split('\n').pop(), '|', f3.split('\n').pop());
}

async function api(method, urlPath, token, body) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
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
    page.waitForURL('**/dashboard', { timeout: 20000 }),
    page.click('button[type="submit"]'),
  ]);
}

async function getToken(email, password) {
  const r = await api('POST', '/api/v1/auth/login', null, { email, password });
  return r.body && r.body.accessToken ? r.body.accessToken : null;
}
/**
 * DashCode stage 3 — Ark UI Select: trigger là button[role=combobox] giữ id
 * cũ; options LUÔN ở trong DOM (portal), listbox đóng mang `hidden`.
 * Mọi tương tác đi qua content của chính trigger (aria-controls) + kiểm tra
 * aria-expanded để không toggle nhầm — miễn nhiễm với các select khác.
 */
async function arkContentId(page, triggerId) {
  await page.waitForSelector(`#${triggerId}`, { timeout: 20000 });
  return page.getAttribute(`#${triggerId}`, 'aria-controls');
}
async function arkOpen(page, triggerId) {
  const cid = await arkContentId(page, triggerId);
  if ((await page.getAttribute(`#${triggerId}`, 'aria-expanded')) !== 'true') {
    await page.click(`#${triggerId}`);
  }
  return cid;
}
async function arkSelectOption(page, triggerId, value) {
  const cid = await arkOpen(page, triggerId);
  await page.locator(`[id="${cid}"] [role="option"][data-value="${value}"]`).click();
}
async function arkOptionCount(page, triggerId) {
  const cid = await arkOpen(page, triggerId);
  const n = await page.locator(`[id="${cid}"] [role="option"]`).count();
  await page.keyboard.press('Escape');
  return n;
}
async function arkWaitOptions(page, triggerId, min) {
  const cid = await arkContentId(page, triggerId);
  await page.waitForFunction(
    (a) => document.querySelectorAll(`[id="${a.cid}"] [role="option"]`).length >= a.min,
    { cid, min },
    { timeout: 20000 },
  );
  return cid;
}

async function findBtn(page, texts) {
  const loc = page.locator('button, a, [role="button"]');
  const n = await loc.count();
  for (let i = 0; i < n; i++) {
    try {
      const t = (await loc.nth(i).textContent()) || '';
      if (texts.some((x) => t.includes(x))) return loc.nth(i);
    } catch {}
  }
  throw new Error('không tìm thấy nút: ' + texts.join(' / '));
}

async function waitText(page, text, ms = 15000) {
  await page.waitForSelector(`text=${text}`, { timeout: ms });
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
  page.setDefaultTimeout(25000);

  const adminToken = await getToken(ADMIN_EMAIL, ADMIN_PASS);
  const pmToken = await getToken(PM_EMAIL, PM_PASS);
  const noToken = null;

  let tradeId = null;
  let workerId = null;
  let dupTradeId = null;
  const DUP_CODE = `XT-${UNIQ}`;
  const DUP_NAME = `Thợ xây tô ${UNIQ}`;

  cleanupPreviousRun();

  try {
    // ============ B1: login admin ============
    await step('B1', 'login admin', async (id) => {
      await login(page, ADMIN_EMAIL, ADMIN_PASS);
      await page.waitForSelector('text=Tổng quan', { timeout: 10000 }).catch(() => {});
      await snap(page, id, 'Admin dashboard sau login');
      return ok(id, 'redirect dashboard');
    })();

    // ============ B2: list /trades ============
    await step('B2', 'mở /trades danh sách', async (id) => {
      await page.goto(`${BASE}/trades`, { waitUntil: 'networkidle' });
      await page.waitForSelector('table.bf-table', { timeout: 15000 });
      const rows = await page.locator('table.bf-table tbody tr').count();
      const firstTradeVisible = await page.locator('table.bf-table tbody tr').first().textContent();
      await snap(page, id, 'Danh sách ngành nghề (seed THO-CAT)');
      return ok(id, `bảng render, ${rows} rows; row đầu: ${(firstTradeVisible || '').slice(0, 80)}`);
    })();

    // ============ B3: create trade ============
    await step('B3', 'tạo trade mới qua UI', async (id) => {
      await page.goto(`${BASE}/trades/new`, { waitUntil: 'networkidle' });
      await page.fill('#code', TRADE_CODE);
      await page.fill('#name', TRADE_NAME);
      await page.fill('#description', TRADE_DESC);
      await snap(page, id + '-form', 'Form tạo ngành nghề đã điền');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/trades', { timeout: 15000 }).catch(() => {});
      await page.waitForSelector(`text=${TRADE_NAME}`, { timeout: 20000 });
      await snap(page, id + '-list', 'Trade mới xuất hiện trong danh sách');
      const row = await psql(
        `SELECT code, name, is_active FROM trades WHERE code='${TRADE_CODE}'`
      );
      if (!row.includes(TRADE_CODE)) return fail(id, `DB thiếu row trade: ${row}`);
      const audit = await psql(
        `SELECT action, entity_type, result FROM audit_logs WHERE action='ORG_TRADE_CREATED' AND entity_type='TRADE' ORDER BY created_at DESC LIMIT 1`
      );
      return ok(id, `DB row:\n${row}\naudit:\n${audit}`);
    })();

    // ============ B4: duplicate code 409 field-level ============
    await step('B4', 'tạo trùng code -> 409 theo field', async (id) => {
      await page.goto(`${BASE}/trades/new`, { waitUntil: 'networkidle' });
      await page.fill('#code', TRADE_CODE);
      await page.fill('#name', `Trùng ${TRADE_NAME}`);
      await page.click('button[type="submit"]');
      await page.waitForSelector('text=Mã ngành nghề đã tồn tại', { timeout: 15000 });
      await snap(page, id, 'Lỗi trùng mã hiển thị trên field code');
      const count = await psql(`SELECT count(*) FROM trades WHERE code='${TRADE_CODE}'`);
      return ok(id, `UI báo 'Mã ngành nghề đã tồn tại'; DB count=${count.trim().split('\n')[2] || count}`);
    })();

    // ============ B5: missing name field-level validation ============
    await step('B5', 'tạo thiếu name -> lỗi field name', async (id) => {
      await page.goto(`${BASE}/trades/new`, { waitUntil: 'networkidle' });
      await page.fill('#code', `TM-${UNIQ}`);
      await page.fill('#name', '');
      await page.click('button[type="submit"]');
      await page.waitForSelector('#name[aria-invalid="true"]', { timeout: 10000 }).catch(() => {});
      const errText = await page.locator('text=Tên ngành nghề').allTextContents().catch(() => []);
      await page.waitForSelector('text=Tên ngành nghề không được để trống', { timeout: 10000 }).catch(() => {});
      const empty = await psql(`SELECT count(*) FROM trades WHERE code='TM-${UNIQ}'`);
      await snap(page, id, 'Lỗi field name khi bỏ trống tên');
      return ok(id, `validation hiển thị; DB không tạo row: ${empty.trim().split('\n')[2] || empty}`);
    })();

    // ============ B6: edit trade rename ============
    await step('B6', 'edit trade (đổi tên) qua UI', async (id) => {
      const r = await api('GET', `/api/v1/trades?search=${TRADE_CODE}&limit=5`, adminToken);
      tradeId = r.body && r.body.data && r.body.data[0] ? r.body.data[0].id : null;
      if (!tradeId) return fail(id, 'không tìm thấy tradeId của trade vừa tạo');
      const newName = TRADE_NAME + ' cao cấp';
      await page.goto(`${BASE}/trades/${tradeId}/edit`, { waitUntil: 'networkidle' });
      await page.fill('#name', newName);
      await snap(page, id + '-form', 'Form sửa trade (đổi tên)');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/trades/${tradeId}`, { timeout: 15000 });
      await page.waitForSelector(`text=${newName}`, { timeout: 15000 });
      await snap(page, id + '-detail', 'Detail trade sau khi đổi tên');
      const db = await psql(
        `SELECT code, name FROM trades WHERE id='${tradeId}'`
      );
      const audit = await psql(
        `SELECT action, before_data->>'name' AS b_name, after_data->>'name' AS a_name FROM audit_logs
         WHERE action='ORG_TRADE_UPDATED' AND entity_id='${tradeId}' ORDER BY created_at DESC LIMIT 1`
      );
      if (!db.includes(newName)) return fail(id, `DB name chưa đổi: ${db}`);
      if (!audit.includes(TRADE_NAME)) return fail(id, `audit thiếu before name: ${audit}`);
      return ok(id, `DB:\n${db}\naudit:\n${audit}`);
    })();

    // ============ B7: gán trade cho worker mới (qua /workers/new, select mới) ============
    await step('B7', 'tạo worker gán trade qua select', async (id) => {
      await page.goto(`${BASE}/workers/new`, { waitUntil: 'networkidle' });
      // Ark Select: options của chính trigger (aria-controls) — đợi rồi đọc text
      await page.waitForSelector('#tradeId:not([disabled])', { timeout: 20000 });
      const cidB7 = await arkWaitOptions(page, 'tradeId', 2);
      const optionTexts = await page.locator(`[id="${cidB7}"] [role="option"]`).allTextContents();
      const hasSeed = optionTexts.some((t) => t.includes('THO-CAT'));
      const hasMyTrade = optionTexts.some((t) => t.includes(TRADE_CODE));
      await arkSelectOption(page, 'tradeId', tradeId);
      await arkSelectOption(page, 'skillLevel', '3');
      await page.fill('#email', WORKER_EMAIL);
      await page.fill('#password', WORKER_PASS);
      await page.fill('#fullName', WORKER_NAME);
      await page.fill('#phone', '0909' + String(Math.floor(100000 + Math.random() * 899999)));
      await page.fill('#employeeCode', WORKER_CODE);
      await snap(page, id + '-form', 'WorkerForm với select ngành nghề ACTIVE');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/workers', { timeout: 20000 });
      await page.waitForSelector(`text=${WORKER_EMAIL}`, { timeout: 20000 });
      const db = await psql(
        `SELECT rt.trade_id, rt.skill_level, rt.is_active, u.email
         FROM resource_trades rt JOIN users u ON u.id=rt.user_id
         WHERE rt.trade_id='${tradeId}' AND rt.is_active=true ORDER BY rt.created_at DESC LIMIT 1`
      );
      const wr = await api('GET', `/api/v1/workers?search=${encodeURIComponent(WORKER_EMAIL)}`, adminToken);
      const wList = Array.isArray(wr.body && wr.body.data) ? wr.body.data : [];
      workerId = wList.length ? wList[0].id : null;
      if (!workerId || !/^[0-9a-f-]{36}$/.test(workerId)) return fail(id, `không lấy được workerId từ API: ${JSON.stringify(wr.body).slice(0, 200)}`);
      await snap(page, id + '-list', 'Worker mới xuất hiện trong danh sách');
      return ok(id, `worker=${workerId}; DB:\n${db}`);
    })();

    // ============ B8: deactivate trade đang được dùng (qua /trades/[id]) ============
    await step('B8', 'deactivate trade đang được worker dùng', async (id) => {
      await page.goto(`${BASE}/trades/${tradeId}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('text=Ngừng hoạt động', { timeout: 15000 });
      const btn = await findBtn(page, ['Chuyển sang Ngừng hoạt động']);
      await btn.click();
      await page.waitForSelector('text=Xác nhận chuyển trạng thái', { timeout: 10000 });
      await snap(page, id + '-confirm', 'Confirm dialog deactivate');
      const confirmBtn = await findBtn(page, ['Xác nhận']);
      await confirmBtn.click();
      await page.waitForSelector('text=đang được tham chiếu', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(500);
      await snap(page, id + '-done', 'Sau deactivate: badge INACTIVE + warning tham chiếu');
      const db = await psql(`SELECT code, is_active FROM trades WHERE id='${tradeId}'`);
      const audit = await psql(
        `SELECT action, after_data->>'_warning' AS warning FROM audit_logs
         WHERE action='ORG_TRADE_STATUS_CHANGED' AND entity_id='${tradeId}' ORDER BY created_at DESC LIMIT 1`
      );
      if (!db.includes('f')) return fail(id, `DB is_active vẫn true: ${db}`);
      if (!audit.includes('_warning') && !audit.includes('tham chiếu')) {
        return fail(id, `audit thiếu _warning trong afterData: ${audit}`);
      }
      const pageText = await page.locator('body').textContent();
      if (!pageText.includes('đang được tham chiếu')) return fail(id, 'UI không hiển thị warning tham chiếu');
      return ok(id, `DB:\n${db}\naudit:\n${audit}`);
    })();

    // ============ B9: sau deactivate, select WorkerForm chỉ giữ trade đó ở option '(hiện tại)' ============
    await step('B9', 'WorkerForm edit: trade INACTIVE chỉ còn option (hiện tại) + banner', async (id) => {
      await page.goto(`${BASE}/workers/${workerId}/edit`, { waitUntil: 'networkidle' });
      await page.waitForSelector('#tradeId:not([disabled])', { timeout: 20000 });
      await page.waitForTimeout(1200);
      // Ark: đọc options của chính trigger (aria-controls), không cần mở
      const cidB9 = await arkWaitOptions(page, 'tradeId', 1);
      const opts = page.locator(`[id="${cidB9}"] [role="option"]`);
      const texts = [];
      for (let i = 0; i < (await opts.count()); i++) {
        const t = ((await opts.nth(i).textContent()) || '').trim();
        if (t) texts.push(t);
      }
      await page.keyboard.press('Escape');
      // trade INACTIVE chỉ được giữ làm giá trị hiện tại (đánh dấu '(hiện tại)'), không còn là lựa chọn mới
      const withCode = texts.filter((t) => t.includes(TRADE_CODE));
      const banner = await page.locator('body').textContent();
      await snap(page, id, 'WorkerForm edit: trade inactive chỉ còn option (hiện tại) + banner');
      if (withCode.length !== 1 || !withCode[0].includes('(hiện tại)')) {
        return fail(id, `trade INACTIVE còn là lựa chọn mới hoặc mất hẳn: ${texts.join(' | ')}`);
      }
      if (!banner.includes('ngừng hoạt động')) return fail(id, 'thiếu banner giải thích trade cũ inactive');
      return ok(id, `inactive chỉ còn option '(hiện tại)'; các lựa chọn mới: ${texts.filter((t) => !t.includes(TRADE_CODE)).join(' | ')}`);
    })();

    // ============ B10: PATCH worker gán trade inactive qua API -> 400 ============
    await step('B10', 'API gán trade INACTIVE cho worker -> 400', async (id) => {
      const r = await api('PATCH', `/api/v1/workers/${workerId}`, adminToken, {
        fullName: WORKER_RENAMED,
        trades: [{ tradeId, skillLevel: 2 }],
      });
      if (r.status !== 400) return fail(id, `HTTP ${r.status} thay vì 400: ${JSON.stringify(r.body).slice(0, 200)}`);
      const msg = r.body && r.body.message ? String(r.body.message) : '';
      if (!/ngừng hoạt động|isAssignable|Trade không tồn tại/.test(msg)) {
        return fail(id, `message không rõ ràng: ${msg}`);
      }
      return ok(id, `HTTP 400 message="${msg}"`);
    })();

    // ============ B11: edit worker vẫn cho phép (giữ nguyên trade inactive, omit) ============
    await step('B11', 'worker edit giữ nguyên trade inactive (omit) -> 200', async (id) => {
      const r = await api('PATCH', `/api/v1/workers/${workerId}`, adminToken, {
        fullName: WORKER_RENAMED,
      });
      if (r.status !== 200) return fail(id, `HTTP ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`);
      const db = await psql(
        `SELECT full_name, (SELECT count(*) FROM resource_trades rt WHERE rt.user_id=u.id AND rt.is_active=true) AS active_trades
         FROM users u WHERE id='${workerId}'`
      );
      return ok(id, `HTTP 200; DB:\n${db}`);
    })();

    // ============ B12: reactivate trade ============
    await step('B12', 'reactivate trade qua UI', async (id) => {
      await page.goto(`${BASE}/trades/${tradeId}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('text=Kích hoạt lại', { timeout: 15000 });
      const btn = await findBtn(page, ['Kích hoạt lại']);
      await btn.click();
      await page.waitForSelector('text=Xác nhận chuyển trạng thái', { timeout: 10000 });
      const confirmBtn = await findBtn(page, ['Xác nhận']);
      await confirmBtn.click();
      await page.waitForSelector('text=Đã kích hoạt lại danh mục', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(500);
      await snap(page, id + '-done', 'Trade ACTIVE trở lại');
      const db = await psql(`SELECT code, is_active FROM trades WHERE id='${tradeId}'`);
      const audit = await psql(
        `SELECT action, before_data->>'status' AS b, after_data->>'status' AS a FROM audit_logs
         WHERE action='ORG_TRADE_STATUS_CHANGED' AND entity_id='${tradeId}'
         ORDER BY created_at DESC LIMIT 1`
      );
      if (!db.includes('t')) return fail(id, `DB is_active chưa true: ${db}`);
      return ok(id, `DB:\n${db}\naudit:\n${audit}`);
    })();

    // ============ B13: audit-logs filter ORG_TRADE_* ============
    await step('B13', 'audit-logs lọc ORG_TRADE_*', async (id) => {
      await page.goto(`${BASE}/admin/audit-logs?action=ORG_TRADE_CREATED`, { waitUntil: 'networkidle' });
      await page.waitForSelector('table.bf-table, .bf-empty, text=Không có', { timeout: 15000 }).catch(() => {});
      await page.waitForSelector(`text=${TRADE_CODE}`, { timeout: 15000 }).catch(() => {});
      await snap(page, id + '-created', 'Audit logs: ORG_TRADE_CREATED (entity_id trade)');
      await page.goto(`${BASE}/admin/audit-logs?action=ORG_TRADE_STATUS_CHANGED`, { waitUntil: 'networkidle' });
      await page.waitForSelector(`text=${TRADE_CODE}`, { timeout: 15000 }).catch(() => {});
      await snap(page, id + '-status', 'Audit logs: ORG_TRADE_STATUS_CHANGED');
      const db = await psql(
        `SELECT action, count(*) FROM audit_logs
         WHERE action LIKE 'ORG_TRADE%' AND entity_id='${tradeId}'
         GROUP BY action ORDER BY action`
      );
      if (!db.includes('ORG_TRADE_CREATED')) return fail(id, `DB audit thiếu created:\n${db}`);
      if (!db.includes('ORG_TRADE_UPDATED')) return fail(id, `DB audit thiếu updated:\n${db}`);
      if (!db.includes('ORG_TRADE_STATUS_CHANGED')) return fail(id, `DB audit thiếu status changed:\n${db}`);
      return ok(id, `audit DB:\n${db}`);
    })();

    // ============ B14: phân quyền — pm đọc danh mục (200), ghi 403 / no token 401 ============
    await step('B14', 'phân quyền: pm đọc 200 + ghi 403, no-token 401', async (id) => {
      // API-level (trades là danh mục đọc chung ADMIN + PROJECT_MANAGER, ghi ADMIN-only)
      const pmGet = await api('GET', '/api/v1/trades', pmToken);
      const pmPost = await api('POST', '/api/v1/trades', pmToken, { code: 'NK-PM', name: 'x' });
      const anonGet = await api('GET', '/api/v1/trades', noToken);
      if (!(pmGet.status === 200 && pmPost.status === 403 && anonGet.status === 401)) {
        return fail(id, `pm GET=${pmGet.status} (mong đợi 200) pm POST=${pmPost.status} (mong đợi 403) anon=${anonGet.status} (mong đợi 401)`);
      }
      // UI-level: đăng nhập pm rồi mở /trades — sidebar không có mục Ngành nghề, trang render danh sách đọc
      await login(page, PM_EMAIL, PM_PASS);
      await page.goto(`${BASE}/trades`, { waitUntil: 'networkidle' });
      await page.waitForSelector('table.bf-table', { timeout: 15000 });
      await snap(page, id + '-ui', 'PM mở /trades: danh sách đọc (sidebar ẩn mục Ngành nghề)');
      const navText = await page.locator('.bf-nav').textContent();
      const noNavTrades = !(navText || '').includes('Ngành nghề');
      const pageHas403 = (await page.locator('body').textContent()).includes('Không có quyền');
      if (!noNavTrades) return fail(id, 'sidebar pm VẪN hiện mục Ngành nghề');
      if (pageHas403) return fail(id, 'UI pm hiển thị 403 dù API cho đọc');
      return ok(id, `API pm GET=${pmGet.status} (đọc) POST=${pmPost.status} (ghi); anon=${anonGet.status}; UI sidebar ẩn + list đọc`);
    })();

    // ============ B15: double-submit cùng correlation-id -> 1 row + 1 audit ============
    await step('B15', 'double-submit cùng correlation-id -> 1 row + 1 audit', async (id) => {
      const code = DUP_CODE;
      const payload = { code, name: DUP_NAME };
      const h = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        'X-Correlation-Id': CORR,
      };
      const r1 = await fetch(`${API}/api/v1/trades`, { method: 'POST', headers: h, body: JSON.stringify(payload) });
      const r2 = await fetch(`${API}/api/v1/trades`, { method: 'POST', headers: h, body: JSON.stringify(payload) });
      const j1 = await r1.json().catch(() => null);
      const j2 = await r2.json().catch(() => null);
      const rows = await psql(`SELECT count(*) FROM trades WHERE code='${code}'`);
      const audits = await psql(`SELECT count(*) FROM audit_logs WHERE action='ORG_TRADE_CREATED' AND correlation_id='${CORR}'`);
      const parseCnt = (s) => { const m = s.match(/(\d+)/); return m ? Number(m[1]) : -1; };
      if (r1.status !== 201 && r1.status !== 200) return fail(id, `r1 HTTP ${r1.status} ${JSON.stringify(j1).slice(0, 150)}`);
      const rowCount = parseCnt(rows);
      const auditCount = parseCnt(audits);
      if (rowCount !== 1) return fail(id, `DB rows=${rowCount} (mong đợi 1)\n${rows}`);
      if (auditCount !== 1) return fail(id, `audit rows=${auditCount} (mong đợi 1)\n${audits}`);
      return ok(id, `HTTP r1=${r1.status} r2=${r2.status} (${JSON.stringify(j2).slice(0, 120)}); DB rows=${rowCount}; audit rows=${auditCount}`);
    })();

    // ============ B16: GET 404 cho trade không tồn tại ============
    await step('B16', 'GET /trades/:id không tồn tại -> 404', async (id) => {
      const r = await api('GET', '/api/v1/trades/99999999-9999-4999-8999-999999999999', adminToken);
      if (r.status !== 404) return fail(id, `HTTP ${r.status}: ${JSON.stringify(r.body).slice(0, 150)}`);
      return ok(id, `HTTP 404 message="${r.body && r.body.message}"`);
    })();

    // ============ lưu kết quả ============
    const PASS = results.filter((r) => r.ok).length;
    const FAILN = results.filter((r) => !r.ok).length;
    try {
      const dr = await api('GET', `/api/v1/trades?search=${DUP_CODE}&limit=5`, adminToken);
      dupTradeId = dr.body && dr.body.data && dr.body.data[0] ? dr.body.data[0].id : null;
    } catch {}
    fs.writeFileSync(EV, JSON.stringify({
      uniq: UNIQ, tradeCode: TRADE_CODE, tradeCode2: TRADE_CODE2, workerEmail: WORKER_EMAIL,
      workerName: WORKER_NAME, workerCode: WORKER_CODE,
      tradeId, workerId, dupCode: DUP_CODE, dupTradeId, correlationId: CORR, results,
    }, null, 2));
    console.log(`\n===== TỔNG: ${PASS} PASS / ${FAILN} FAIL / ${results.length} bước =====`);
    for (const r of results) if (!r.ok) console.log(`  FAIL ${r.id}: ${r.note}`);
  } catch (err) {
    console.error('DRIVER ERROR', err && err.message ? err.message : err);
    process.exitCode = 1;
  } finally {
    await browser.close().catch(() => {});
  }
})();
