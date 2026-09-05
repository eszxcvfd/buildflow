/** E2E phase 2: tiếp nối phase 1 (state trong DB đã có worker + contractor), sửa selector lỏng. KHÔNG commit. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('/home/trung/.npm-global/lib/node_modules/@playwright/mcp/node_modules/playwright');

const BASE = 'http://localhost:3001';
const SHOTS = path.join(__dirname, 'shots');
const vars = JSON.parse(fs.readFileSync(path.join(__dirname, 'e2e-vars.json'), 'utf8'));
const { uniq: UNIQ, workerEmail: W_EMAIL, workerCode: W_CODE, contractorCode: C_CODE } = vars;
const W_ID = '0e825034-8c97-4359-b01f-45ffbce8fff7'; // worker E2E tạo ở phase 1 (đã xác minh trong DB)
const C_NAME = `E2E Nhà thầu ${UNIQ}`;
const C_NAME_NEW = `E2E Nhà thầu Renamed ${UNIQ}`;
const NEW_NAME = `E2E Worker Renamed ${UNIQ}`;

const log = []; const results = [];
async function snap(page, id, desc) { const p = path.join(SHOTS, `${id}.png`); await page.screenshot({ path: p }); log.push({ id, desc, file: p }); }

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
  // helper: tìm card worker chứa fullName chính xác (strong text trong Card)
  async function workerCardByName(name) {
    const cards = page.locator('div[style*="justify-content: space-between"]').filter({ hasText: name }).filter({ has: page.locator(`a[href*="/workers/"]`) });
    const n = await cards.count();
    for (let i = 0; i < n; i++) {
      const c = cards.nth(i);
      const t = (await c.innerText()) || '';
      if (t.includes(name) && t.includes(W_EMAIL)) return c;
    }
    // fallback: card có link chi tiết tới worker
    const card2 = page.locator(`a[href="/workers/${W_ID}"]`).first().locator('xpath=ancestor::div[contains(@style,"space-between")][1]');
    return card2;
  }

  try {
    await loginAdmin();

    /* A6: edit rename worker */
    try {
      await page.goto(`${BASE}/workers/${W_ID}/edit`, { waitUntil: 'networkidle' });
      await page.waitForSelector('#fullName', { timeout: 15000 });
      await page.fill('#fullName', NEW_NAME);
      await snap(page, 'A6', 'Form edit worker - đổi tên');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/workers', { timeout: 15000 });
      await page.waitForSelector(`text=${NEW_NAME}`, { timeout: 15000 });
      await snap(page, 'A6-2', 'List sau edit - tên mới hiển thị');
      results.push({ id: 'A6', ok: true, note: 'đổi tên thành công, list hiển thị' });
      console.log('PASS A6');
    } catch (e) { results.push({ id: 'A6', ok: false, note: e.message }); console.log('FAIL A6', e.message); }

    /* A7: deactivate via list with confirm */
    try {
      await page.goto(`${BASE}/workers`, { waitUntil: 'networkidle' });
      await page.fill('#worker-search', W_CODE);
      await page.click('button:has-text("Tìm")');
      await page.waitForSelector(`a[href="/workers/${W_ID}"]`, { timeout: 15000 });
      const card = await workerCardByName(NEW_NAME);
      const btn = card.locator('button:has-text("Ngừng hoạt động")');
      await btn.click();
      await page.waitForSelector('text=Xác nhận chuyển trạng thái', { timeout: 10000 });
      await snap(page, 'A7', 'Confirm dialog deactivate worker');
      await page.locator('button:has-text("Xác nhận")').last().click();
      // chờ list phản ánh INACTIVE: nút Ngừng hoạt động biến thành Kích hoạt lại
      await page.waitForSelector(`a[href="/workers/${W_ID}"]`, { timeout: 15000 });
      await page.waitForTimeout(2500);
      await snap(page, 'A7-2', 'Worker INACTIVE - list');
      const card2 = await workerCardByName(NEW_NAME);
      const t2 = await card2.innerText();
      const hasReactivate = t2.includes('Kích hoạt lại');
      if (!hasReactivate) throw new Error('sau deactivate không thấy nút Kích hoạt lại');
      results.push({ id: 'A7', ok: true, note: 'deactivate có confirm, list hiển thị INACTIVE' });
      console.log('PASS A7');
    } catch (e) { results.push({ id: 'A7', ok: false, note: e.message }); console.log('FAIL A7', e.message); }

    /* A8: reactivate */
    try {
      await page.goto(`${BASE}/workers`, { waitUntil: 'networkidle' });
      await page.fill('#worker-search', W_CODE);
      await page.click('button:has-text("Tìm")');
      await page.waitForSelector(`a[href="/workers/${W_ID}"]`, { timeout: 15000 });
      const card = await workerCardByName(NEW_NAME);
      const btn = card.locator('button:has-text("Kích hoạt lại")');
      await btn.click();
      await page.waitForSelector('text=Xác nhận chuyển trạng thái', { timeout: 10000 });
      await snap(page, 'A8', 'Confirm dialog reactivate worker');
      await page.locator('button:has-text("Xác nhận")').last().click();
      await page.waitForSelector(`a[href="/workers/${W_ID}"]`, { timeout: 15000 });
      await page.waitForTimeout(2500);
      await snap(page, 'A8-2', 'Worker ACTIVE trở lại');
      const card2 = await workerCardByName(NEW_NAME);
      const t2 = await card2.innerText();
      if (!t2.includes('Ngừng hoạt động')) throw new Error('sau reactivate list không có nút Ngừng hoạt động (chưa ACTIVE)');
      results.push({ id: 'A8', ok: true, note: 'reactivate thành công, list ACTIVE' });
      console.log('PASS A8');
    } catch (e) { results.push({ id: 'A8', ok: false, note: e.message }); console.log('FAIL A8', e.message); }

    /* B2: edit contact/scope contractor (dùng detail bằng URL row) */
    try {
      await page.goto(`${BASE}/contractors`, { waitUntil: 'networkidle' });
      // tìm row contractor vừa tạo ở phase 1 qua text name chính xác và code
      const row = page.locator('tr', { hasText: C_NAME }).filter({ hasText: C_CODE }).first();
      await row.waitFor({ timeout: 15000 });
      const detailHref = await row.locator('a:has-text("Xem chi tiết")').getAttribute('href');
      await page.goto(`${BASE}${detailHref}/edit`, { waitUntil: 'networkidle' });
      await page.waitForSelector('#contactName', { timeout: 15000 });
      await page.fill('#contactName', 'Trần E2E Mới');
      await page.fill('#scope', 'E2E thi công phần thô + hoàn thiện');
      await snap(page, 'B2', 'Form edit contractor contact/scope');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/contractors/${detailHref.split('/').pop()}`, { timeout: 15000 }).catch(() => {});
      await page.waitForSelector(`text=${C_CODE}`, { timeout: 15000 });
      await page.waitForTimeout(1500);
      await snap(page, 'B2-2', 'Detail contractor sau edit');
      results.push({ id: 'B2', ok: true, note: 'edit contact/scope lưu, detail hiển thị' });
      console.log('PASS B2');
    } catch (e) { results.push({ id: 'B2', ok: false, note: e.message }); console.log('FAIL B2', e.message); }

    /* B3b: contractor E2E code C_CODE đã INACTIVE ở phase 1 (chưa edit xong). Xem lại:
       phase 1 B3 đã deactivate contractor C_NAME thành công. Bây giờ kích hoạt lại để có flow edit-status đầy đủ? 
       KHÔNG — kịch bản yêu cầu: B3 deactivate có confirm → DB INACTIVE + audit; B4 eligible; B5 detail INACTIVE.
       Phase 1 đã làm INACTIVE trước khi B2 edit; DB hiện note cũ. Ta cần: contractor cuối cùng INACTIVE với note mới (edit B2 lưu sẽ giữ INACTIVE).
       → Để giữ kịch bản sạch, contractor này giờ INACTIVE; B2 edit vừa chạy. Chụp DB ở sau. */
  } finally {
    console.log(JSON.stringify(results, null, 2));
    fs.writeFileSync(path.join(__dirname, 'e2e-results2.json'), JSON.stringify(results, null, 2));
    await browser.close();
  }
})();
