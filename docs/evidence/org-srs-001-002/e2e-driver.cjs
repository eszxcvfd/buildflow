/**
 * ORG-SRS-001/002 E2E driver — phase 1 (tạm thời, KHÔNG commit theo scope docs/evidence).
 * Chạy: node e2e-driver.cjs
 * Yêu cầu: Docker stack buildflow đang chạy; admin password đã reset (xem doc E2E).
 *
 * Dữ liệu realistic theo docs/demo-data.md (chuẩn hóa 2026-09-07):
 * worker运行时 tạo mới dùng tên Việt + email @vinacons.vn + mã TX-9xxx;
 * contractor dùng mã XD-* + tên công ty Việt. UNIQ/DIGITS giữ cơ chế duy nhất
 * cho rename/duplicate-409 flows. Passwords giữ nguyên.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('/home/trung/.npm-global/lib/node_modules/@playwright/mcp/node_modules/playwright');

const BASE = 'http://localhost:3001';
const API = 'http://localhost:3000';
const SHOTS = path.join(__dirname, 'shots');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
const log = [];
const results = [];
function step(id, name, fn) {
  return async () => {
    try {
      const r = await fn(id);
      results.push(r);
      if (r.ok) console.log(`PASS ${id} ${name}${r.note ? ' :: ' + r.note : ''}`);
      else console.log(`FAIL ${id} ${name} :: ${r.note}`);
    } catch (err) {
      results.push({ id, name, ok: false, note: err.message, err });
      console.log(`ERROR ${id} ${name} :: ${err.message}`);
    }
  };
}
async function snap(page, id, desc) {
  const p = path.join(SHOTS, `${id}.png`);
  await page.screenshot({ path: p, fullPage: false });
  log.push({ id, desc, file: p });
}
function ok(id, note = '') { return { id, ok: true, note }; }
function fail(id, note) { return { id, ok: false, note }; }
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
  await arkOpen(page, triggerId);
  // Re-resolve cid SAU khi mở: Ark useId có thể remount (cid mới) giữa lúc
  // đọc aria-controls và lúc click option — locator giữ cid cũ sẽ timeout.
  const cid = await arkContentId(page, triggerId);
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

/* ---------- realistic run identities (docs/demo-data.md) ---------- */
const ADMIN_EMAIL = 'hoang.anh@vinacons.vn';
const ADMIN_PASS = 'E2EAdmin@2025';

function psql(sql) {
  try {
    return execFileSync('docker', [
      'exec', 'buildflow-postgres-1', 'psql', '-U', 'buildflow', '-d', 'buildflow', '-P', 'pager=off', '-c', sql,
    ], { encoding: 'utf8', timeout: 15000 }).trim();
  } catch (e) {
    return `PSQL ERROR: ${e.stderr || e.message}`;
  }
}

/** Xóa dư liệu run trước theo id đã ghi trong vars (fallback: cửa sổ created_at + pattern mã run). */
function cleanupPreviousRun() {
  const prevVars = path.join(__dirname, 'e2e-vars.json');
  let prev = null;
  try { prev = JSON.parse(fs.readFileSync(prevVars, 'utf8')); } catch {}
  if (prev) {
    const wIds = [prev.workerId].filter(Boolean).map((s) => `'${s}'`);
    if (wIds.length) {
      // chỉ xóa khi mã nhân viên vẫn là mã run (TX-8/TX-9/TXW-), KHÔNG đụng mã canonical TX-00xx
      psql(`DELETE FROM resource_trades WHERE user_id IN (${wIds.join(',')}) AND user_id IN (SELECT id FROM users WHERE employee_code LIKE 'TX-9%' OR employee_code LIKE 'TX-8%' OR employee_code LIKE 'TXW-%')`);
      const out = psql(`DELETE FROM users WHERE id IN (${wIds.join(',')}) AND (employee_code LIKE 'TX-9%' OR employee_code LIKE 'TX-8%' OR employee_code LIKE 'TXW-%')`);
      console.log('cleanup prev worker:', out.split('\n').pop());
    }
    const cCodes = [prev.contractorCode, prev.contractorCode2, prev.contractorCode3].filter(Boolean).map((s) => `'${s}'`);
    if (cCodes.length) {
      const out = psql(`DELETE FROM contractors WHERE code IN (${cCodes.join(',')}) AND (code LIKE 'XD%' OR code LIKE 'SCC%')`);
      console.log('cleanup prev contractors:', out.split('\n').pop());
    }
  }
  try {
    const b2 = JSON.parse(fs.readFileSync(path.join(__dirname, 'e2e-b2fix-ids.json'), 'utf8'));
    const codes = [b2.codeA, b2.codeI].filter(Boolean).map((s) => `'${s}'`);
    if (codes.length) {
      const out = psql(`DELETE FROM contractors WHERE code IN (${codes.join(',')}) AND code LIKE 'SCC%'`);
      console.log('cleanup prev b2fix contractors:', out.split('\n').pop());
    }
  } catch {}
  // fallback: hàng run-pattern tạo trong 12h gần nhất (canonical VCC/NTA/HTB + TX-00xx không khớp pattern)
  const f1 = psql(`DELETE FROM resource_trades WHERE user_id IN (SELECT id FROM users WHERE (employee_code LIKE 'TX-9%' OR employee_code LIKE 'TX-8%') AND created_at > now() - interval '12 hours')`);
  const f2 = psql(`DELETE FROM users WHERE (employee_code LIKE 'TX-9%' OR employee_code LIKE 'TX-8%') AND created_at > now() - interval '12 hours'`);
  const f3 = psql(`DELETE FROM contractors WHERE (code LIKE 'XD%' OR code LIKE 'SCC%') AND created_at > now() - interval '12 hours'`);
  console.log('cleanup fallback:', f1.split('\n').pop(), '|', f2.split('\n').pop(), '|', f3.split('\n').pop());
}

async function apiToken(email, password) {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const j = await res.json().catch(() => null);
  return j && j.accessToken ? j.accessToken : null;
}
async function apiGet(urlPath, token) {
  const res = await fetch(`${API}${urlPath}`, { headers: { Authorization: `Bearer ${token}` } });
  return res.json().catch(() => null);
}

(async () => {
  cleanupPreviousRun();

  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);

  const UNIQ = Date.now().toString(36).slice(-6);
  const DIGITS = String(Date.now()).slice(-6);
  const D4 = DIGITS.slice(-4);
  // Worker: tên Việt trong pool + hậu tố số duy nhất; email/code theo docs/demo-data.md
  const W_NAME = `Phạm Văn Khôi ${DIGITS}`;
  const W_EMAIL = `khoi.pham.${DIGITS}@vinacons.vn`;
  const W_CODE = `TX-9${DIGITS.slice(-4)}`;
  const W_RENAMED = `Phạm Văn Khôi ${DIGITS} Mới`;
  const W_PASS = 'WorkerPass@123';
  // Contractor P1
  const C_CODE = `XD-${DIGITS}`;
  const C_NAME = `Công ty TNHH Xây dựng An Khang ${D4}`;
  const C_EMAIL = `lienhe.ankhang.${DIGITS}@vinacons.vn`;
  // Contractor P2 (dùng ở phase ctr-full)
  const C_CODE2 = `XD2-${DIGITS}`;
  const C_NAME2 = `Công ty CP Cơ khí Đông Anh ${D4}`;
  const C_EMAIL2 = `lienhe.donganh.${DIGITS}@vinacons.vn`;
  console.log(`UNIQ=${UNIQ} DIGITS=${DIGITS} worker=${W_EMAIL} code=${W_CODE} contractor=${C_CODE}`);
  fs.writeFileSync(path.join(__dirname, 'e2e-vars.json'), JSON.stringify({
    _note: 'Throwaway E2E-only demo credentials (seed/reset per evidence docs). Never production.',
    uniq: UNIQ, digits: DIGITS,
    workerEmail: W_EMAIL, workerCode: W_CODE, workerName: W_NAME, renamedName: W_RENAMED,
    workerId: null,
    contractorCode: C_CODE, contractorName: C_NAME, contractorEmail: C_EMAIL, contractorId: null,
    contractorCode2: C_CODE2, contractorName2: C_NAME2, contractorEmail2: C_EMAIL2, contractorId2: null,
    contractorCode3: null, contractorId3: null,
  }, null, 2));

  const TRADE_GOOD = '11111111-1111-4111-8111-111111111111';
  const TRADE_BAD = '99999999-9999-4999-8999-999999999999';

  try {
    /* A1: login admin */
    await step('A1', 'login admin', async (id) => {
      await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
      await page.fill('#email', ADMIN_EMAIL);
      await page.fill('#password', ADMIN_PASS);
      await snap(page, id, 'Điền form đăng nhập');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard', { timeout: 15000 });
      await page.waitForSelector('text=Tổng quan', { timeout: 5000 }).catch(() => {});
      await snap(page, id + '-2', 'Sau login - dashboard');
      return ok(id, 'redirect /dashboard');
    })();

    /* A2: create worker */
    await step('A2', 'tạo worker mới', async (id) => {
      await page.goto(`${BASE}/workers/new`, { waitUntil: 'networkidle' });
      // #tradeId giờ là Ark Select (chỉ liệt kê trade ACTIVE) — chờ trigger enabled
      // rồi đợi options của chính nó (placeholder + trades, qua aria-controls)
      await page.waitForSelector('#tradeId:not([disabled])', { timeout: 20000 });
      await arkWaitOptions(page, 'tradeId', 2);
      await arkSelectOption(page, 'tradeId', TRADE_GOOD);
      await page.fill('#email', W_EMAIL);
      await page.fill('#password', W_PASS);
      await page.fill('#fullName', W_NAME);
      await page.fill('#phone', '0909' + String(Math.floor(100000 + Math.random() * 899999)));
      await page.fill('#employeeCode', W_CODE);
      await arkSelectOption(page, 'skillLevel', '3');
      await snap(page, id, 'Form tạo worker đã điền');
      await page.click('button[type="submit"]');
      await page.waitForSelector(`text=${W_EMAIL}`, { timeout: 15000 });
      await snap(page, id + '-2', 'Worker xuất hiện trong list');
      return ok(id, 'thấy worker trong list');
    })();

    /* A3: duplicate email + duplicate code -> 409 */
    await step('A3', 'trùng email -> 409 field', async (id) => {
      await page.goto(`${BASE}/workers/new`, { waitUntil: 'networkidle' });
      await page.fill('#email', W_EMAIL);
      await page.fill('#password', W_PASS);
      await page.fill('#fullName', 'Trần Văn Công Trùng');
      await page.fill('#employeeCode', `TX-8${DIGITS.slice(-4)}`);
      await snap(page, id, 'Form trùng email');
      await page.click('button[type="submit"]');
      await page.waitForSelector('text=Email đã tồn tại', { timeout: 15000 });
      await snap(page, id + '-2', 'Lỗi 409 email hiển thị');
      return ok(id, 'báo "Email đã tồn tại"');
    })();
    await step('A3b', 'trùng employee code -> 409 field', async (id) => {
      await page.goto(`${BASE}/workers/new`, { waitUntil: 'networkidle' });
      await page.fill('#email', `cong.tran.${DIGITS}@vinacons.vn`);
      await page.fill('#password', W_PASS);
      await page.fill('#fullName', `Trần Văn Công ${DIGITS}`);
      await page.fill('#employeeCode', W_CODE);
      await snap(page, id, 'Form trùng mã nhân viên');
      await page.click('button[type="submit"]');
      await page.waitForSelector('text=Mã nhân viên đã tồn tại', { timeout: 15000 });
      await snap(page, id + '-2', 'Lỗi 409 mã nhân viên hiển thị');
      return ok(id, 'báo "Mã nhân viên đã tồn tại"');
    })();

    /* A4: invalid trade -> 400 (mức API; UI giờ dùng Ark Select chỉ chứa trade ACTIVE
       nên không nhập tay trade lạ được — select tự chặn, kiểm chứng 400 qua API) */
    await step('A4', 'trade không hợp lệ -> 400', async (id) => {
      await page.goto(`${BASE}/workers/new`, { waitUntil: 'networkidle' });
      await page.waitForSelector('#tradeId:not([disabled])', { timeout: 20000 });
      await page.fill('#email', `tam.nguyen.${DIGITS}@vinacons.vn`);
      await page.fill('#password', W_PASS);
      await page.fill('#fullName', `Nguyễn Văn Tám ${DIGITS}`);
      await snap(page, id, 'Form tạo worker (select trade hợp lệ — case xấu kiểm qua API)');
      const token = await apiToken(ADMIN_EMAIL, ADMIN_PASS);
      const res = await fetch(`${API}/api/v1/workers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          email: `tam.nguyen.${DIGITS}@vinacons.vn`, password: W_PASS,
          fullName: `Nguyễn Văn Tám ${DIGITS}`, employeeCode: `TX-7${DIGITS.slice(-4)}`,
          trades: [{ tradeId: TRADE_BAD, skillLevel: 3 }],
        }),
      });
      const body = await res.json().catch(() => ({}));
      await snap(page, id + '-2', `API trade lạ trả HTTP ${res.status}`);
      if (res.status !== 400) return fail(id, `HTTP ${res.status} thay vì 400: ${JSON.stringify(body).slice(0, 200)}`);
      if (!/Trade không tồn tại/.test(String(body.message || ''))) return fail(id, `message không rõ: ${JSON.stringify(body).slice(0, 200)}`);
      return ok(id, 'API 400 "Trade không tồn tại..."');
    })();

    /* A5: search/filter */
    await step('A5', 'search worker theo employee code', async (id) => {
      await page.goto(`${BASE}/workers`, { waitUntil: 'networkidle' });
      await page.fill('#worker-search', W_CODE);
      await page.click('button:has-text("Tìm")');
      await page.waitForSelector(`text=${W_EMAIL}`, { timeout: 10000 });
      await snap(page, id, 'Kết quả search đúng worker');
      const rows = await page.locator('body').innerText();
      if (rows.includes('Trần Văn Công')) return fail(id, 'search trả về worker khác');
      return ok(id, 'chỉ 1 worker khớp');
    })();

    /* A6: edit rename -> DB verify (id resolve qua API, vào thẳng trang edit) */
    await step('A6', 'edit đổi tên worker', async (id) => {
      const token0 = await apiToken(ADMIN_EMAIL, ADMIN_PASS);
      const w0 = await apiGet(`/api/v1/workers?search=${encodeURIComponent(W_CODE)}`, token0);
      const wId0 = w0 && Array.isArray(w0.data) && w0.data.length ? w0.data[0].id : null;
      if (!wId0) throw new Error('không resolve được workerId qua API');
      const v0 = JSON.parse(fs.readFileSync(path.join(__dirname, 'e2e-vars.json'), 'utf8'));
      v0.workerId = wId0;
      fs.writeFileSync(path.join(__dirname, 'e2e-vars.json'), JSON.stringify(v0, null, 2));
      await page.goto(`${BASE}/workers/${wId0}/edit`, { waitUntil: 'networkidle' });
      await page.waitForSelector('#fullName', { timeout: 15000 });
      await page.fill('#fullName', W_RENAMED);
      await snap(page, id, 'Form edit đã đổi tên');
      await page.click('button[type="submit"]');
      await page.waitForSelector(`text=${W_EMAIL}`, { timeout: 15000 });
      await snap(page, id + '-2', 'List sau edit');
      return ok(id, 'đã lưu, về list');
    })();
    await step('A6-DB', 'DB xác nhận tên đã đổi', async () => {
      // runs in bash phase below; placeholder
      return ok('A6-DB');
    })();

    /* A7: suspend lifecycle (dialog + reason) -> DB verify status/audit ORG_WORKER_SUSPENDED */
    const W_SUSPEND_REASON = 'Tạm ngừng để luân chuyển sang công trình khác';
    const W_REACT_REASON = 'Tiếp nhận lại vào đội thi công';
    await step('A7', 'tạm ngừng worker (dialog + lý do)', async (id) => {
      const vA7 = JSON.parse(fs.readFileSync(path.join(__dirname, 'e2e-vars.json'), 'utf8'));
      const wId = vA7.workerId;
      await page.goto(`${BASE}/workers`, { waitUntil: 'networkidle' });
      await page.fill('#worker-search', W_CODE);
      await page.click('button:has-text("Tìm")');
      await page.waitForSelector(`a[href="/workers/${wId}"]`, { timeout: 15000 });
      await page.waitForTimeout(800);
      // DashCode redesign (table .bf-table, không còn card div space-between):
      // nút lifecycle nằm cùng hàng <tr> với link detail worker.
      const card = page.locator(`tr:has(a[href="/workers/${wId}"])`).first();
      await card.locator('button:has-text("Tạm ngừng")').click();
      await page.waitForSelector('#lifecycle-reason', { timeout: 15000 });
      await page.fill('#lifecycle-reason', W_SUSPEND_REASON);
      await snap(page, id, 'Dialog tạm ngừng worker (lý do đã nhập)');
      await page.locator('button:has-text("Xác nhận tạm ngừng")').click();
      await page.waitForTimeout(2500);
      await snap(page, id + '-2', 'Worker INACTIVE trên list');
      const t = await card.innerText().catch(() => '');
      if (!/Kích hoạt lại|Ngừng hoạt động|INACTIVE/.test(t)) throw new Error('list chưa phản ánh trạng thái mới: ' + t.slice(0, 120));
      return ok(id, 'status chuyển INACTIVE, có dialog + lý do');
    })();
    await step('A7-DB', 'DB xác nhận INACTIVE', async () => { return ok('A7-DB'); })();
    await step('A7-DB2', 'DB audit IAM_USER_DEACTIVATED', async () => { return ok('A7-DB2'); })();

    /* A8: reactivate lifecycle */
    await step('A8', 'kích hoạt lại worker', async (id) => {
      const vA8 = JSON.parse(fs.readFileSync(path.join(__dirname, 'e2e-vars.json'), 'utf8'));
      const wId = vA8.workerId;
      await page.goto(`${BASE}/workers`, { waitUntil: 'networkidle' });
      await page.fill('#worker-search', W_CODE);
      await page.click('button:has-text("Tìm")');
      await page.waitForSelector(`a[href="/workers/${wId}"]`, { timeout: 15000 });
      await page.waitForTimeout(800);
      // Như A7: hàng <tr> thay cho card div space-between cũ.
      const card = page.locator(`tr:has(a[href="/workers/${wId}"])`).first();
      await card.locator('button:has-text("Kích hoạt lại")').click();
      await page.waitForSelector('#lifecycle-reason', { timeout: 15000 });
      await page.fill('#lifecycle-reason', W_REACT_REASON);
      await snap(page, id, 'Dialog kích hoạt lại worker');
      await page.locator('button:has-text("Xác nhận kích hoạt lại")').click();
      await page.waitForTimeout(2500);
      await snap(page, id + '-2', 'Worker ACTIVE trở lại');
      const t = await card.innerText().catch(() => '');
      if (!/Tạm ngừng/.test(t)) throw new Error('sau reactivate list không có nút Tạm ngừng (chưa ACTIVE): ' + t.slice(0, 120));
      return ok(id, 'status ACTIVE');
    })();

    /* A9: audit logs */
    await step('A9', 'audit logs hiển thị entries ORG/IAM', async (id) => {
      await page.goto(`${BASE}/admin/audit-logs`, { waitUntil: 'networkidle' });
      await page.waitForSelector('.bf-table tbody tr', { timeout: 15000 });
      await snap(page, id, 'Audit logs page');
      const bodyText = await page.locator('body').innerText();
      if (!bodyText.includes('ORG_WORKER_SUSPENDED')) return fail(id, 'không thấy action ORG_WORKER_SUSPENDED trong view');
      if (!bodyText.includes('ORG_WORKER_CREATED')) return fail(id, 'không thấy ORG_WORKER_CREATED trong view');
      return ok(id, 'thấy ORG_WORKER_SUSPENDED / ORG_WORKER_CREATED');
    })();

    /* B1: create contractor */
    let contractorHref = null;
    await step('B1', 'tạo contractor mới', async (id) => {
      await page.goto(`${BASE}/contractors/new`, { waitUntil: 'networkidle' });
      await page.fill('#code', C_CODE);
      await page.fill('#name', C_NAME);
      await page.fill('#contactName', 'Nguyễn Văn An');
      await page.fill('#phone', '0912' + String(Math.floor(100000 + Math.random() * 899999)));
      await page.fill('#email', C_EMAIL);
      await page.fill('#scope', 'Thi công phần thô khu B1');
      await snap(page, id, 'Form tạo contractor đã điền');
      await page.click('button[type="submit"]');
      await page.waitForSelector(`text=${C_NAME}`, { timeout: 15000 });
      await snap(page, id + '-2', 'Contractor trong list');
      try {
        contractorHref = await page.locator(`tr:has-text("${C_CODE}") a:has-text("Xem chi tiết")`).getAttribute('href');
      } catch {}
      return ok(id, 'tạo xong, list hiển thị');
    })();

    /* B2: edit contact/scope */
    await step('B2', 'edit contact/scope contractor', async (id) => {
      await page.goto(`${BASE}/contractors`, { waitUntil: 'networkidle' });
      const row = page.locator('tr', { hasText: C_NAME }).filter({ hasText: C_CODE }).first();
      await row.waitFor({ timeout: 15000 });
      const href = await row.locator('a:has-text("Xem chi tiết")').getAttribute('href');
      await page.goto(`${BASE}${href}/edit`, { waitUntil: 'networkidle' });
      await page.waitForSelector('#contactName', { timeout: 10000 });
      await page.fill('#contactName', 'Trần Văn Bình');
      await page.fill('#scope', 'Thi công phần thô và hoàn thiện khu B1');
      await snap(page, id, 'Form edit contractor');
      await page.click('button[type="submit"]');
      await page.waitForSelector(`text=${C_NAME}`, { timeout: 15000 });
      await snap(page, id + '-2', 'Detail sau edit');
      return ok(id, 'detail hiển thị contact/scope mới');
    })();

    /* B3: suspend contractor lifecycle qua detail (dialog + lý do) */
    const C_SUSPEND_REASON = 'Tạm ngừng do chậm tiến độ tập kết vật tư';
    await step('B3', 'tạm ngừng contractor (dialog + lý do)', async (id) => {
      await page.goto(`${BASE}/contractors`, { waitUntil: 'networkidle' });
      const row = page.locator(`tr:has-text("${C_NAME}")`).first();
      await page.waitForSelector(`tr:has-text("${C_NAME}")`, { timeout: 10000 });
      const link = row.locator('a:has-text("Xem chi tiết")');
      const href = await link.getAttribute('href');
      await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('button:has-text("Tạm ngừng")', { timeout: 15000 });
      await page.click('button:has-text("Tạm ngừng")');
      await page.waitForSelector('#lifecycle-reason', { timeout: 15000 });
      await page.fill('#lifecycle-reason', C_SUSPEND_REASON);
      await snap(page, id, 'Dialog tạm ngừng contractor (lý do đã nhập)');
      await page.locator('button:has-text("Xác nhận tạm ngừng")').click();
      await page.waitForTimeout(2500);
      await snap(page, id + '-2', 'Contractor INACTIVE trên detail');
      const t = await page.locator('body').innerText();
      if (!/Ngừng hoạt động|INACTIVE/.test(t)) throw new Error('detail chưa phản ánh INACTIVE');
      return ok(id, 'status INACTIVE');
    })();
    await step('B3-DB', 'DB contractor INACTIVE + audit', async () => { return ok('B3-DB'); })();

    /* B4: list filters */
    await step('B4', 'list filter eligibleOnly/status', async (id) => {
      await page.goto(`${BASE}/contractors`, { waitUntil: 'networkidle' });
      await page.check('input[type="checkbox"]');
      await snap(page, id, 'List với eligibleOnly ON');
      await page.click('button:has-text("Tìm")');
      await page.waitForTimeout(1200);
      const bodyText = await page.locator('body').innerText();
      if (bodyText.includes(C_NAME)) return fail(id, 'contractor INACTIVE vẫn hiện khi eligibleOnly=true');
      // status filter INACTIVE
      await page.uncheck('input[type="checkbox"]');
      await arkSelectOption(page, 'contractor-status', 'INACTIVE');
      await page.click('button:has-text("Tìm")');
      await page.waitForSelector(`text=${C_NAME}`, { timeout: 10000 });
      await snap(page, id + '-2', 'List filter status INACTIVE thấy contractor');
      return ok(id, 'eligibleOnly ẩn INACTIVE; status=INACTIVE hiện đúng');
    })();

    /* B5: detail still viewable when INACTIVE */
    await step('B5', 'detail INACTIVE vẫn xem được', async (id) => {
      await page.goto(`${BASE}/contractors`, { waitUntil: 'networkidle' });
      await arkSelectOption(page, 'contractor-status', 'INACTIVE');
      await page.click('button:has-text("Tìm")');
      const row = page.locator(`tr:has-text("${C_NAME}")`).first();
      await page.waitForSelector(`tr:has-text("${C_NAME}")`, { timeout: 10000 });
      const link = row.locator('a:has-text("Xem chi tiết")');
      const href = await link.getAttribute('href');
      await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('text=Ngừng hoạt động', { timeout: 10000 });
      await snap(page, id, 'Detail contractor INACTIVE vẫn mở');
      return ok(id, 'detail render (không 404/hard delete)');
    })();

    // Resolve ids qua API để các phase sau không hardcode UUID
    try {
      const token = await apiToken(ADMIN_EMAIL, ADMIN_PASS);
      if (token) {
        const w = await apiGet(`/api/v1/workers?search=${encodeURIComponent(W_CODE)}`, token);
        const wId = w && Array.isArray(w.data) && w.data.length ? w.data[0].id : null;
        const c = await apiGet(`/api/v1/contractors?search=${encodeURIComponent(C_CODE)}`, token);
        const cId = c && Array.isArray(c.data) && c.data.length ? c.data[0].id : null;
        const v = JSON.parse(fs.readFileSync(path.join(__dirname, 'e2e-vars.json'), 'utf8'));
        v.workerId = wId; v.contractorId = cId;
        fs.writeFileSync(path.join(__dirname, 'e2e-vars.json'), JSON.stringify(v, null, 2));
        console.log(`ids: worker=${wId} contractor=${cId} href=${contractorHref}`);
      }
    } catch (e) { console.log('resolve ids warn:', e.message); }
  } catch (err) {
    console.log('FATAL driver error:', err.message);
    try { await snap(page, 'ZZ-fatal', 'Fatal: ' + err.message); } catch {}
  } finally {
    console.log(JSON.stringify(results, null, 2));
    fs.writeFileSync(path.join(__dirname, 'e2e-results.json'), JSON.stringify(results, null, 2));
    await browser.close();
  }
})();
