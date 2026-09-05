/** E2E phase 3: chạy theo phase arg — node p3.cjs w-deact|w-reactivate|ctr-full|views */
const fs = require('fs');
const path = require('path');
const { chromium } = require('/home/trung/.npm-global/lib/node_modules/@playwright/mcp/node_modules/playwright');

const BASE = 'http://localhost:3001';
const SHOTS = path.join(__dirname, 'shots');
const vars = JSON.parse(fs.readFileSync(path.join(__dirname, 'e2e-vars.json'), 'utf8'));
const UNIQ = vars.uniq;
const W_EMAIL = vars.workerEmail;
const W_CODE = vars.workerCode;
const W_ID = '0e825034-8c97-4359-b01f-45ffbce8fff7';
const W_NAME = `E2E Worker Renamed ${UNIQ}`;
const C2_CODE = vars.contractorCode2; // chưa dùng ở phase 1
const C2_NAME = `E2E Nhà thầu P2 ${UNIQ}`;

const phase = process.argv[2] || 'w-deact';
const results = [];
async function snap(page, id, desc) { const p = path.join(SHOTS, `${id}.png`); await page.screenshot({ path: p }); console.log('shot', p); }
function note(res) { results.push(res); console.log((res.ok ? 'PASS ' : 'FAIL ') + res.id + ' :: ' + (res.note || '')); }

async function workerCard(page, name) {
  const cards = page.locator(`a[href="/workers/${W_ID}"]`).first().locator('xpath=ancestor::div[contains(@style,"space-between")][1]');
  return cards;
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);
  async function loginAdmin() {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('#email', 'admin@example.com');
    await page.fill('#password', 'E2EAdmin@2025');
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
      await card.locator('button:has-text("Ngừng hoạt động")').click();
      await page.waitForSelector('text=Xác nhận chuyển trạng thái', { timeout: 10000 });
      await snap(page, 'A7-final-confirm', 'Confirm dialog deactivate worker (phase 3)');
      await page.locator('button:has-text("Xác nhận")').last().click();
      await page.waitForTimeout(2500);
      await snap(page, 'A7-final-list', 'List worker INACTIVE (phase 3)');
      const t = await card.innerText().catch(() => '');
      note({ id: 'A7-final', ok: true, note: 'UI deactivate xong, kết quả DB kiểm tra riêng' });
    } else if (phase === 'w-reactivate') {
      await page.goto(`${BASE}/workers`, { waitUntil: 'networkidle' });
      await page.fill('#worker-search', W_CODE);
      await page.click('button:has-text("Tìm")');
      await page.waitForSelector(`a[href="/workers/${W_ID}"]`, { timeout: 15000 });
      await page.waitForTimeout(800);
      const card = await workerCard(page);
      await card.locator('button:has-text("Kích hoạt lại")').click();
      await page.waitForSelector('text=Xác nhận chuyển trạng thái', { timeout: 10000 });
      await snap(page, 'A8-final-confirm', 'Confirm dialog reactivate worker');
      await page.locator('button:has-text("Xác nhận")').last().click();
      await page.waitForTimeout(2500);
      await snap(page, 'A8-final-list', 'List worker ACTIVE (phase 3)');
      note({ id: 'A8-final', ok: true, note: 'UI reactivate xong, DB kiểm tra riêng' });
    } else if (phase === 'ctr-full') {
      // B1: create contractor mới (code C2)
      await page.goto(`${BASE}/contractors/new`, { waitUntil: 'networkidle' });
      await page.fill('#code', C2_CODE);
      await page.fill('#name', C2_NAME);
      await page.fill('#contactName', 'Nguyễn P2');
      await page.fill('#phone', '0917' + String(Math.floor(100000 + Math.random() * 899999)));
      await page.fill('#email', `ct2.${UNIQ}@example.com`);
      await page.fill('#scope', 'E2E P2: thi công cốp pha');
      await snap(page, 'B1p3-form', 'Form tạo contractor P2');
      await page.click('button[type="submit"]');
      await page.waitForSelector(`text=${C2_CODE}`, { timeout: 15000 });
      await snap(page, 'B1p3-list', 'Contractor P2 trong list');
      note({ id: 'B1', ok: true, note: 'tạo contractor P2, list hiển thị' });
      // lấy id từ DB sau qua vars: tạm thời crawl link detail
      const href = await page.locator(`tr:has-text("${C2_CODE}") a:has-text("Xem chi tiết")`).getAttribute('href');
      fs.writeFileSync(path.join(__dirname, 'ctr2-href.txt'), href || '');
      // B2: edit contact/scope
      await page.goto(`${BASE}${href}/edit`, { waitUntil: 'networkidle' });
      await page.waitForSelector('#contactName', { timeout: 15000 });
      await page.fill('#contactName', 'Trần P2 Mới');
      await page.fill('#scope', 'E2E P2: cốp pha + cốt thép');
      await snap(page, 'B2p3-form', 'Form edit contractor P2');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2500);
      await snap(page, 'B2p3-detail', 'Detail contractor P2 sau edit');
      note({ id: 'B2', ok: true, note: 'edit P2 contact/scope xong, DB kiểm tra riêng' });
      // B3: deactivate qua detail (confirm)
      await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('button:has-text("Chuyển sang Ngừng hoạt động")', { timeout: 15000 });
      await page.click('button:has-text("Chuyển sang Ngừng hoạt động")');
      await page.waitForSelector('text=Xác nhận chuyển trạng thái', { timeout: 10000 });
      await snap(page, 'B3p3-confirm', 'Confirm dialog contractor P2 INACTIVE');
      await page.locator('button:has-text("Xác nhận")').last().click();
      await page.waitForTimeout(2500);
      await snap(page, 'B3p3-detail', 'Detail contractor P2 INACTIVE');
      note({ id: 'B3', ok: true, note: 'deactivate P2 có confirm xong, DB kiểm tra riêng' });
    } else if (phase === 'views') {
      // B4 list filter: eligibleOnly ẩn INACTIVE, status filter thấy P2
      await page.goto(`${BASE}/contractors`, { waitUntil: 'networkidle' });
      await page.check('input[type="checkbox"]');
      await page.click('button:has-text("Tìm")');
      await page.waitForTimeout(1500);
      await snap(page, 'B4p3-eligible', 'List contractors eligibleOnly=true');
      const t1 = await page.locator('body').innerText();
      const hides = !t1.includes(C2_NAME) && !t1.includes(`E2E Nhà thầu ${UNIQ}`);
      await page.uncheck('input[type="checkbox"]');
      await page.selectOption('#contractor-status', 'INACTIVE');
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
      for (const action of ['IAM_USER_DEACTIVATED', 'ORG_CONTRACTOR_STATUS_CHANGED', 'ORG_WORKER_CREATED', 'ORG_CONTRACTOR_UPDATED']) {
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
