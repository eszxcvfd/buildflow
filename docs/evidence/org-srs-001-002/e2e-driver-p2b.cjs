const fs = require('fs'); const path = require('path');
const { chromium } = require('/home/trung/.npm-global/lib/node_modules/@playwright/mcp/node_modules/playwright');
const BASE='http://localhost:3001';
const SHOTS = path.join('/home/trung/Documents/2026/project/buildflow/docs/evidence/org-srs-001-002/shots');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);
  async function snap(id) { await page.screenshot({ path: path.join(SHOTS, `${id}.png`) }); }
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('#email','admin@example.com'); await page.fill('#password','E2EAdmin@2025');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    const uniq = JSON.parse(fs.readFileSync('/home/trung/Documents/2026/project/buildflow/docs/evidence/org-srs-001-002/e2e-vars.json')).uniq;
    const code = `E2EC3${uniq.toUpperCase()}`;
    const name = `E2E P2 Active Contractor ${uniq}`;
    await page.goto(`${BASE}/contractors/new`, { waitUntil: 'networkidle' });
    await page.fill('#code', code);
    await page.fill('#name', name);
    await page.fill('#contactName', 'Active Người A');
    await page.fill('#phone','0918987654');
    await page.fill('#email',`active.${uniq}@example.com`);
    await page.fill('#scope', 'E2E active: thi công hoàn thiện');
    await snap('B2p2-form');
    await page.click('button[type="submit"]');
    await page.waitForSelector(`text=${code}`, { timeout: 15000 });
    await snap('B2p2-list');
    const href = await page.locator(`tr:has-text("${code}") a:has-text("Xem chi tiết")`).getAttribute('href');
    const id = href.split('/').pop();
    await page.goto(`${BASE}/contractors/${id}/edit`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#contactName');
    await page.fill('#contactName', 'Active Người A Mới');
    await page.fill('#scope', 'E2E active: hoàn thiện + sơn');
    await snap('B2p2-edit-form');
    await page.click('button[type="submit"]');
    await page.waitForURL(`**/contractors/${id}`, { timeout: 15000 });
    await page.waitForSelector(`text=${code}`, { timeout: 15000 });
    await page.waitForTimeout(1500);
    await snap('B2p2-edit-detail');
    console.log('DONE id=' + id + ' code=' + code);
  } catch (e) { console.log('FATAL', e.message); try { await snap('B2p2-FATAL'); } catch {} }
  await browser.close();
})();
