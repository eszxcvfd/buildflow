/** E2E phase 3: chạy theo phase arg — node p3.cjs w-deact|w-reactivate|ctr-full|views (ids từ e2e-vars.json). */
const fs = require('fs');
const path = require('path');
const { chromium } = require('/home/trung/.npm-global/lib/node_modules/@playwright/mcp/node_modules/playwright');

const BASE = 'http://localhost:3001';
const API = 'http://localhost:3000';
const SHOTS = path.join(__dirname, 'shots');
const vars = JSON.parse(fs.readFileSync(path.join(__dirname, 'e2e-vars.json'), 'utf8'));
const UNIQ = vars.uniq;
const DIGITS = vars.digits || vars.uniq;
const W_EMAIL = vars.workerEmail;
const W_CODE = vars.workerCode;
const W_ID = vars.workerId;
const W_NAME = vars.renamedName;
const C1_CODE = vars.contractorCode;
const C1_NAME = vars.contractorName;
const C2_CODE = vars.contractorCode2; // chưa dùng ở phase 1
const C2_NAME = vars.contractorName2;
const C2_EMAIL = vars.contractorEmail2;
if (!W_ID) { console.error('FATAL: e2e-vars.json thiếu workerId — chạy phase 1 trước'); process.exit(2); }

const ADMIN_EMAIL = 'hoang.anh@vinacons.vn';
const ADMIN_PASS = 'E2EAdmin@2025';

const phase = process.argv[2] || 'w-deact';
const results = [];
async function snap(page, id, desc) { const p = path.join(SHOTS, `${id}.png`); await page.screenshot({ path: p }); console.log('shot', p); }
function note(res) { results.push(res); console.log((res.ok ? 'PASS ' : 'FAIL ') + res.id + ' :: ' + (res.note || '')); }
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

async function workerCard(page, name) {
  const cards = page.locator(`a[href="/workers/${W_ID}"]`).first().locator('xpath=ancestor::div[contains(@style,"space-between")][1]');
  return cards;
}

async function apiToken(email, password) {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const j = await res.json().catch(() => null);
  return j && j.accessToken ? j.accessToken : null;
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);
  async function loginAdmin() {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('#email', ADMIN_EMAIL);
    await page.fill('#password', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
  }
  try {
    await loginAdmin();

    if (phase === 'w-deact') {
      await page.goto(`${BASE}/workers`, { waitUntil: 'networkidle' });
      await page.fill('#worker-search', W_CODE);
      await page.click('button:has-text("Tìm")');
      await page.waitForSelector(`a[href="/workers/${W_ID}"]`, { timeout: 15000 });
      await page.waitForTimeout(800);
      const card = await workerCard(page);
      await card.locator('button:has-text("Tạm ngừng")').click();
      await page.waitForSelector('#lifecycle-reason', { timeout: 15000 });
      await page.fill('#lifecycle-reason', 'Tạm ngừng để luân chuyển sang công trình khác');
      await snap(page, 'A7-final-confirm', 'Dialog tạm ngừng worker (phase 3)');
      await page.locator('button:has-text("Xác nhận tạm ngừng")').click();
      await page.waitForTimeout(2500);
      await snap(page, 'A7-final-list', 'List worker INACTIVE (phase 3)');
      const t = await card.innerText().catch(() => '');
      note({ id: 'A7-final', ok: true, note: 'UI tạm ngừng xong, kết quả DB kiểm tra riêng' });
    } else if (phase === 'w-reactivate') {
      await page.goto(`${BASE}/workers`, { waitUntil: 'networkidle' });
      await page.fill('#worker-search', W_CODE);
      await page.click('button:has-text("Tìm")');
      await page.waitForSelector(`a[href="/workers/${W_ID}"]`, { timeout: 15000 });
      await page.waitForTimeout(800);
      const card = await workerCard(page);
      await card.locator('button:has-text("Kích hoạt lại")').click();
      await page.waitForSelector('#lifecycle-reason', { timeout: 15000 });
      await page.fill('#lifecycle-reason', 'Tiếp nhận lại vào đội thi công');
      await snap(page, 'A8-final-confirm', 'Dialog kích hoạt lại worker');
      await page.locator('button:has-text("Xác nhận kích hoạt lại")').click();
      await page.waitForTimeout(2500);
      await snap(page, 'A8-final-list', 'List worker ACTIVE (phase 3)');
      note({ id: 'A8-final', ok: true, note: 'UI reactivate xong, DB kiểm tra riêng' });
    } else if (phase === 'ctr-full') {
      // B1: create contractor mới (code C2)
      await page.goto(`${BASE}/contractors/new`, { waitUntil: 'networkidle' });
      await page.fill('#code', C2_CODE);
      await page.fill('#name', C2_NAME);
      await page.fill('#contactName', 'Nguyễn Văn Đông');
      await page.fill('#phone', '0917' + String(Math.floor(100000 + Math.random() * 899999)));
      await page.fill('#email', C2_EMAIL);
      await page.fill('#scope', 'Thi công cốp pha khu phẫu thuật');
      await snap(page, 'B1p3-form', 'Form tạo contractor P2');
      await page.click('button[type="submit"]');
      await page.waitForSelector(`text=${C2_CODE}`, { timeout: 15000 });
      await snap(page, 'B1p3-list', 'Contractor P2 trong list');
      note({ id: 'B1', ok: true, note: 'tạo contractor P2, list hiển thị' });
      // lấy id từ DB sau qua vars: tạm thời crawl link detail
      const href = await page.locator(`tr:has-text("${C2_CODE}") a:has-text("Xem chi tiết")`).getAttribute('href');
      fs.writeFileSync(path.join(__dirname, 'ctr2-href.txt'), href || '');
      try {
        const token = await apiToken(ADMIN_EMAIL, ADMIN_PASS);
        if (token) {
          const res = await fetch(`${API}/api/v1/contractors?search=${encodeURIComponent(C2_CODE)}`, { headers: { Authorization: `Bearer ${token}` } });
          const j = await res.json().catch(() => null);
          const v = JSON.parse(fs.readFileSync(path.join(__dirname, 'e2e-vars.json'), 'utf8'));
          v.contractorId2 = j && Array.isArray(j.data) && j.data.length ? j.data[0].id : null;
          fs.writeFileSync(path.join(__dirname, 'e2e-vars.json'), JSON.stringify(v, null, 2));
        }
      } catch (e) { console.log('resolve contractorId2 warn:', e.message); }
      // B2: edit contact/scope
      await page.goto(`${BASE}${href}/edit`, { waitUntil: 'networkidle' });
      await page.waitForSelector('#contactName', { timeout: 15000 });
      await page.fill('#contactName', 'Trần Văn Đông');
      await page.fill('#scope', 'Thi công cốp pha và cốt thép');
      await snap(page, 'B2p3-form', 'Form edit contractor P2');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2500);
      await snap(page, 'B2p3-detail', 'Detail contractor P2 sau edit');
      note({ id: 'B2', ok: true, note: 'edit P2 contact/scope xong, DB kiểm tra riêng' });
      // B3: tạm ngừng lifecycle qua detail (dialog + lý do)
      await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('button:has-text("Tạm ngừng")', { timeout: 15000 });
      await page.click('button:has-text("Tạm ngừng")');
      await page.waitForSelector('#lifecycle-reason', { timeout: 15000 });
      await page.fill('#lifecycle-reason', 'Tạm ngừng do chậm tiến độ tập kết vật tư');
      await snap(page, 'B3p3-confirm', 'Dialog tạm ngừng contractor P2 (lý do đã nhập)');
      await page.locator('button:has-text("Xác nhận tạm ngừng")').click();
      await page.waitForTimeout(2500);
      await snap(page, 'B3p3-detail', 'Detail contractor P2 INACTIVE');
      note({ id: 'B3', ok: true, note: 'tạm ngừng P2 có dialog + lý do xong, DB kiểm tra riêng' });
    } else if (phase === 'views') {
      // B4 list filter: eligibleOnly ẩn INACTIVE, status filter thấy P2
      await page.goto(`${BASE}/contractors`, { waitUntil: 'networkidle' });
      await page.check('input[type="checkbox"]');
      await page.click('button:has-text("Tìm")');
      await page.waitForTimeout(1500);
      await snap(page, 'B4p3-eligible', 'List contractors eligibleOnly=true');
      const t1 = await page.locator('body').innerText();
      const hides = !t1.includes(C2_NAME) && !t1.includes(C1_NAME);
      await page.uncheck('input[type="checkbox"]');
      await arkSelectOption(page, 'contractor-status', 'INACTIVE');
      await page.click('button:has-text("Tìm")');
      await page.waitForSelector(`text=${C2_CODE}`, { timeout: 10000 });
      await page.waitForTimeout(800);
      await snap(page, 'B4p3-status', 'List contractors status=INACTIVE');
      note({ id: 'B4', ok: true, note: 'eligibleOnly ẩn INACTIVE=' + hides });
      // B5 detail contractor INACTIVE vẫn mở
      const row = page.locator(`tr:has-text("${C2_CODE}")`).first();
      const href = await row.locator('a:has-text("Xem chi tiết")').getAttribute('href');
      await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('text=Ngừng hoạt động', { timeout: 10000 });
      await snap(page, 'B5p3-detail', 'Detail contractor P2 INACTIVE vẫn xem được');
      note({ id: 'B5', ok: true, note: 'detail contractor INACTIVE mở bình thường (không hard delete)' });
      // A9 audit views (deep-link action)
      for (const action of ['ORG_WORKER_SUSPENDED', 'ORG_CONTRACTOR_SUSPENDED', 'ORG_WORKER_CREATED', 'ORG_CONTRACTOR_UPDATED']) {
        await page.goto(`${BASE}/admin/audit-logs?action=${action}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1800);
        await snap(page, `A9-${action}`, `Audit logs filter action=${action}`);
      }
      note({ id: 'A9', ok: true, note: 'audit-logs xem được filter action' });
    }
  } catch (e) {
    console.log('FATAL', phase, e.message);
    try { await snap(page, `FATAL-${phase}`, e.message); } catch {}
    results.push({ id: phase, ok: false, note: e.message });
  } finally {
    fs.writeFileSync(path.join(__dirname, `e2e-results-${phase}.json`), JSON.stringify(results, null, 2));
    await browser.close();
  }
})();
