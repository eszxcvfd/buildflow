/**
 * E2E B2 fix re-run (#25): edit contractor contact/scope với status KHÔNG đổi.
 * - Phase 1: contractor ACTIVE — edit contact/scope (status giữ nguyên) → kỳ vọng PATCH 200 + DB + audit
 * - Phase 2: contractor INACTIVE — edit contact/scope (status giữ nguyên INACTIVE) → kỳ vọng PATCH 200 + DB + audit
 * Ghi lại HTTP status thật của mọi PATCH /api/v1/contractors/:id qua page.on('response').
 * KHÔNG commit (docs/evidence). Chạy: node e2e-driver-b2-fix.cjs
 * Dữ liệu realistic theo docs/demo-data.md (mã SCC-*, tên công ty Việt, email @vinacons.vn).
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('/home/trung/.npm-global/lib/node_modules/@playwright/mcp/node_modules/playwright');

const BASE = 'http://localhost:3001';
const SHOTS = path.join(__dirname, 'shots');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const ADMIN_EMAIL = 'hoang.anh@vinacons.vn';
const ADMIN_PASS = 'E2EAdmin@2025';

const UNIQ = String(Date.now()).slice(-6);
const D4 = UNIQ.slice(-4);
const CODE_A = `SCC-${UNIQ}`; // contractor ACTIVE
const NAME_A = `Công ty TNHH Sửa chữa Cửu Long ${D4}`;
const CODE_I = `SCC2-${UNIQ}`; // contractor sẽ bị deactivate → INACTIVE
const NAME_I = `Công ty TNHH Cải tạo Cửu Long ${D4}`;

const patchResponses = [];

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);

  // capture HTTP status của mọi PATCH contractor từ UI
  page.on('response', async (res) => {
    try {
      const url = res.url();
      const req = res.request();
      if (/\/api\/v1\/contractors\/[0-9a-f-]+$/.test(url) && req.method() === 'PATCH') {
        const body = await res.text().catch(() => '');
        patchResponses.push({ status: res.status(), url, body: body.slice(0, 300) });
      }
    } catch {}
  });

  async function snap(id) { await page.screenshot({ path: path.join(SHOTS, `${id}.png`) }); console.log('shot', `${id}.png`); }

  async function createContractor(code, name) {
    await page.goto(`${BASE}/contractors/new`, { waitUntil: 'networkidle' });
    await page.fill('#code', code);
    await page.fill('#name', name);
    await page.fill('#contactName', 'Phạm Văn Sửa');
    await page.fill('#phone', '0912345678');
    await page.fill('#email', `lienhe.cuulong.${UNIQ}@vinacons.vn`);
    await page.fill('#scope', 'Sửa chữa phần thô nhà xưởng');
    await page.click('button[type="submit"]');
    await page.waitForSelector(`text=${code}`, { timeout: 15000 });
  }

  async function editContractorPage(href, contactNew, scopeNew, shotForm, shotDetail) {
    await page.goto(`${BASE}${href}/edit`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#contactName', { timeout: 15000 });
    await page.fill('#contactName', contactNew);
    await page.fill('#scope', scopeNew);
    await snap(shotForm);
    await page.click('button[type="submit"]');
    // thành công → form router.push về detail; thất bại → ở lại /edit với alert lỗi
    await page.waitForURL(`**/contractors/${href.split('/').pop()}`, { timeout: 15000 });
    await page.waitForTimeout(1500);
    await snap(shotDetail);
  }

  async function deactivateContractor(href) {
    await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('button:has-text("Tạm ngừng")', { timeout: 15000 });
    await page.click('button:has-text("Tạm ngừng")');
    await page.waitForSelector('#lifecycle-reason', { timeout: 15000 });
    await page.fill('#lifecycle-reason', 'Tạm ngừng do chậm tiến độ tập kết vật tư');
    await page.locator('button:has-text("Xác nhận tạm ngừng")').click();
    await page.waitForTimeout(2500);
  }

  try {
    // login admin
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('#email', ADMIN_EMAIL);
    await page.fill('#password', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    // ---- Phase 1: contractor ACTIVE, edit contact/scope, status KHÔNG đổi ----
    await createContractor(CODE_A, NAME_A);
    const listHrefA = await page.locator(`tr:has-text("${CODE_A}") a:has-text("Xem chi tiết")`).getAttribute('href');
    const idA = listHrefA.split('/').pop();
    await editContractorPage(listHrefA, 'Phạm Văn Sửa Mới', 'Sửa chữa phần thô và hoàn thiện nhà xưởng', 'B2-fix-active-edit-form', 'B2-fix-active-detail');
    console.log(`PHASE1 OK id=${idA} code=${CODE_A}`);

    // ---- Phase 2: contractor INACTIVE (deactivate trước), edit contact/scope, status giữ INACTIVE ----
    await createContractor(CODE_I, NAME_I);
    await page.goto(`${BASE}/contractors`, { waitUntil: 'networkidle' });
    const listHrefI = await page.locator(`tr:has-text("${CODE_I}") a:has-text("Xem chi tiết")`).getAttribute('href');
    const idI = listHrefI.split('/').pop();
    await deactivateContractor(listHrefI);
    await editContractorPage(listHrefI, 'Phạm Văn Cải Tạo Mới', 'Cải tạo cốp pha và cốt thép', 'B2-fix-inactive-edit-form', 'B2-fix-inactive-detail');
    console.log(`PHASE2 OK id=${idI} code=${CODE_I}`);

    fs.writeFileSync(path.join(__dirname, 'e2e-b2fix-ids.json'), JSON.stringify({ uniq: UNIQ, codeA: CODE_A, idA, nameA: NAME_A, codeI: CODE_I, idI, nameI: NAME_I }, null, 2));
    console.log('PATCH responses:', JSON.stringify(patchResponses, null, 2));
    const all2xx = patchResponses.every((r) => r.status >= 200 && r.status < 300);
    if (!all2xx) throw new Error('Có PATCH không trả 2xx — xem patchResponses');
    console.log('B2 FIX PASS — tất cả PATCH edit (status không đổi) trả 2xx');
  } catch (e) {
    console.log('FATAL', e.message);
    try { await snap('B2-fix-FATAL'); } catch {}
    process.exitCode = 1;
  } finally {
    fs.writeFileSync(path.join(__dirname, 'e2e-b2fix-patch-responses.json'), JSON.stringify(patchResponses, null, 2));
    await browser.close();
  }
})();
