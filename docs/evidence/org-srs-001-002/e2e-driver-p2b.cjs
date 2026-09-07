const fs = require('fs'); const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('/home/trung/.npm-global/lib/node_modules/@playwright/mcp/node_modules/playwright');
const BASE='http://localhost:3001';
const SHOTS = path.join('/home/trung/Documents/2026/project/buildflow/docs/evidence/org-srs-001-002/shots');
const ADMIN_EMAIL = 'hoang.anh@vinacons.vn';
const ADMIN_PASS = 'E2EAdmin@2025';
function psql(sql) {
  try {
    return execFileSync('docker', [
      'exec', 'buildflow-postgres-1', 'psql', '-U', 'buildflow', '-d', 'buildflow', '-P', 'pager=off', '-c', sql,
    ], { encoding: 'utf8', timeout: 15000 }).trim();
  } catch (e) { return `PSQL ERROR: ${e.stderr || e.message}`; }
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);
  async function snap(id) { await page.screenshot({ path: path.join(SHOTS, `${id}.png`) }); }
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('#email', ADMIN_EMAIL); await page.fill('#password', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    const vars = JSON.parse(fs.readFileSync('/home/trung/Documents/2026/project/buildflow/docs/evidence/org-srs-001-002/e2e-vars.json'));
    const digits = vars.digits || vars.uniq;
    const code = `XD3-${digits}`;
    const name = `Công ty TNHH Hoàn thiện Sao Mai ${String(digits).slice(-4)}`;
    await page.goto(`${BASE}/contractors/new`, { waitUntil: 'networkidle' });
    await page.fill('#code', code);
    await page.fill('#name', name);
    await page.fill('#contactName', 'Vũ Văn Hải');
    await page.fill('#phone','0918987654');
    await page.fill('#email',`lienhe.saomai.${String(digits).toLowerCase()}@vinacons.vn`);
    await page.fill('#scope', 'Thi công hoàn thiện và sơn nước');
    await snap('B2p2-form');
    await page.click('button[type="submit"]');
    await page.waitForSelector(`text=${code}`, { timeout: 15000 });
    await snap('B2p2-list');
    const href = await page.locator(`tr:has-text("${code}") a:has-text("Xem chi tiết")`).getAttribute('href');
    const id = href.split('/').pop();
    await page.goto(`${BASE}/contractors/${id}/edit`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#contactName');
    await page.fill('#contactName', 'Vũ Văn Hải Mới');
    await page.fill('#scope', 'Thi công hoàn thiện, sơn nước và ốp lát');
    await snap('B2p2-edit-form');
    await page.click('button[type="submit"]');
    await page.waitForURL(`**/contractors/${id}`, { timeout: 15000 });
    await page.waitForSelector(`text=${code}`, { timeout: 15000 });
    await page.waitForTimeout(1500);
    await snap('B2p2-edit-detail');
    vars.contractorCode3 = code; vars.contractorId3 = id;
    fs.writeFileSync('/home/trung/Documents/2026/project/buildflow/docs/evidence/org-srs-001-002/e2e-vars.json', JSON.stringify(vars, null, 2));
    console.log('DONE id=' + id + ' code=' + code);
  } catch (e) { console.log('FATAL', e.message); try { await snap('B2p2-FATAL'); } catch {} }
  await browser.close();
})();
