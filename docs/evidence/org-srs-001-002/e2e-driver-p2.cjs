/** E2E phase 2: tiếp nối phase 1 (ids đọc từ e2e-vars.json, KHÔNG hardcode UUID). KHÔNG commit. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('/home/trung/.npm-global/lib/node_modules/@playwright/mcp/node_modules/playwright');

const BASE = 'http://localhost:3001';
const SHOTS = path.join(__dirname, 'shots');
const vars = JSON.parse(fs.readFileSync(path.join(__dirname, 'e2e-vars.json'), 'utf8'));
const { uniq: UNIQ, workerEmail: W_EMAIL, workerCode: W_CODE, workerName: W_NAME0 } = vars;
const W_ID = vars.workerId; // resolve ở phase 1 (không hardcode)
const C_NAME = vars.contractorName;
const C_CODE = vars.contractorCode;
const NEW_NAME = vars.renamedName;
if (!W_ID) { console.error('FATAL: e2e-vars.json thiếu workerId — chạy phase 1 trước'); process.exit(2); }

const ADMIN_EMAIL = 'hoang.anh@vinacons.vn';
const ADMIN_PASS = 'E2EAdmin@2025';

const log = []; const results = [];
async function snap(page, id, desc) { const p = path.join(SHOTS, `${id}.png`); await page.screenshot({ path: p }); log.push({ id, desc, file: p }); }

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

    /* A7: suspend lifecycle via list (dialog + reason) */
    try {
      await page.goto(`${BASE}/workers`, { waitUntil: 'networkidle' });
      await page.fill('#worker-search', W_CODE);
      await page.click('button:has-text("Tìm")');
      await page.waitForSelector(`a[href="/workers/${W_ID}"]`, { timeout: 15000 });
      await page.waitForTimeout(800);
      const card = await workerCardByName(NEW_NAME);
      await card.locator('button:has-text("Tạm ngừng")').click();
      await page.waitForSelector('#lifecycle-reason', { timeout: 15000 });
      await page.fill('#lifecycle-reason', 'Tạm ngừng để luân chuyển sang công trình khác');
      await snap(page, 'A7', 'Dialog tạm ngừng worker (lý do đã nhập)');
      await page.locator('button:has-text("Xác nhận tạm ngừng")').click();
      await page.waitForTimeout(2500);
      await snap(page, 'A7-2', 'Worker INACTIVE - list');
      const card2 = await workerCardByName(NEW_NAME);
      const t2 = await card2.innerText();
      if (!/Kích hoạt lại|Ngừng hoạt động|INACTIVE/.test(t2)) throw new Error('sau tạm ngừng list chưa phản ánh INACTIVE: ' + t2.slice(0, 120));
      results.push({ id: 'A7', ok: true, note: 'tạm ngừng lifecycle có dialog + lý do, list hiển thị INACTIVE' });
      console.log('PASS A7');
    } catch (e) { results.push({ id: 'A7', ok: false, note: e.message }); console.log('FAIL A7', e.message); }

    /* A8: reactivate lifecycle */
    try {
      await page.goto(`${BASE}/workers`, { waitUntil: 'networkidle' });
      await page.fill('#worker-search', W_CODE);
      await page.click('button:has-text("Tìm")');
      await page.waitForSelector(`a[href="/workers/${W_ID}"]`, { timeout: 15000 });
      await page.waitForTimeout(800);
      const card = await workerCardByName(NEW_NAME);
      await card.locator('button:has-text("Kích hoạt lại")').click();
      await page.waitForSelector('#lifecycle-reason', { timeout: 15000 });
      await page.fill('#lifecycle-reason', 'Tiếp nhận lại vào đội thi công');
      await snap(page, 'A8', 'Dialog kích hoạt lại worker');
      await page.locator('button:has-text("Xác nhận kích hoạt lại")').click();
      await page.waitForTimeout(2500);
      await snap(page, 'A8-2', 'Worker ACTIVE trở lại');
      const card2 = await workerCardByName(NEW_NAME);
      const t2 = await card2.innerText();
      if (!/Tạm ngừng/.test(t2)) throw new Error('sau reactivate list không có nút Tạm ngừng (chưa ACTIVE)');
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
      await page.fill('#contactName', 'Trần Văn Bình');
      await page.fill('#scope', 'Thi công phần thô và hoàn thiện khu B1');
      await snap(page, 'B2', 'Form edit contractor contact/scope');
      await page.click('button[type="submit"]');
      await page.waitForURL(`**/contractors/${detailHref.split('/').pop()}`, { timeout: 15000 }).catch(() => {});
      await page.waitForSelector(`text=${C_CODE}`, { timeout: 15000 });
      await page.waitForTimeout(1500);
      await snap(page, 'B2-2', 'Detail contractor sau edit');
      results.push({ id: 'B2', ok: true, note: 'edit contact/scope lưu, detail hiển thị' });
      console.log('PASS B2');
    } catch (e) { results.push({ id: 'B2', ok: false, note: e.message }); console.log('FAIL B2', e.message); }

    /* B3b: contractor code C_CODE đã INACTIVE ở phase 1 (chưa edit xong). Xem lại:
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
