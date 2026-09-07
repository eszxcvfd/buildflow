/**
 * ORG-SRS-005 follow-up pagination E2E (issue #28) — dataset >20.
 * Evidence-only script; phạm vi docs/evidence — KHÔNG commit, KHÔNG sửa source.
 * KHÔNG mutate dữ liệu: chỉ đọc (UI + API GET + SQL COUNT). Seed/cleanup làm ngoài bằng SQL.
 *
 * Chạy: node e2e-driver-pagination.cjs
 * Yêu cầu: docker stack buildflow (api :3000, web :3001); pm quoc.tran@vinacons.vn / E2EPm@2025;
 *          đã seed 20 users realistic (§10.1 doc — ACTIVE, mã TX-8xxx) → 26 workers (25 ACTIVE).
 * Dữ liệu realistic theo docs/demo-data.md (chuẩn hóa 2026-09-07).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('/home/trung/.npm-global/lib/node_modules/@playwright/mcp/node_modules/playwright');

const WEB = 'http://localhost:3001';
const API = 'http://localhost:3000';
const SHOTS = path.join(__dirname, 'shots');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const PM_EMAIL = 'quoc.tran@vinacons.vn';
const PM_PASS = 'E2EPm@2025';

const results = [];
function rec(id, name, okk, note) {
  results.push({ id, name, ok: okk, note });
  console.log(`${okk ? 'PASS' : 'FAIL'} ${id} ${name}${note ? ' :: ' + String(note).split('\n')[0] : ''}`);
  if (!okk && note) console.log(`  detail: ${String(note).slice(0, 800)}`);
}
async function snap(page, id, desc) {
  await page.screenshot({ path: path.join(SHOTS, `${id}.png`), fullPage: false });
  console.log(`  shot ${id}.png — ${desc}`);
}
function psqlT(sql) {
  try {
    return execFileSync('docker', ['exec', 'buildflow-postgres-1', 'psql', '-U', 'buildflow', '-d', 'buildflow', '-t', '-A', '-c', sql],
      { encoding: 'utf8', timeout: 15000 }).trim();
  } catch (e) { return `PSQL ERROR: ${e.stderr || e.message}`; }
}
async function api(method, urlPath, token) {
  const res = await fetch(`${API}${urlPath}`, { method, headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, body: json };
}
async function login(page) {
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', PM_EMAIL);
  await page.fill('#password', PM_PASS);
  await Promise.all([page.waitForURL('**/dashboard', { timeout: 25000 }), page.click('button[type="submit"]')]);
}
async function bodyText(page) { return (await page.locator('body').textContent()) || ''; }
async function waitLoaded(page) {
  await page.waitForFunction(
    () => (document.body.textContent || '').includes('Tổng:') && !(document.body.textContent || '').includes('Đang tải danh sách'),
    { timeout: 20000 });
  await page.waitForTimeout(1200);
}
function uiTotal(t) { const m = t.match(/Tổng:\s*(\d+)/); return m ? m[1] : null; }
function uiPage(t) { const m = t.match(/Trang\s*(\d+)\s*\/\s*(\d+)/); return m ? { page: m[1], pages: m[2] } : null; }
async function workerRows(page) {
  return page.evaluate(() => {
    const links = [...document.querySelectorAll('a[href^="/workers/"]')];
    const seen = new Map();
    for (const a of links) { const h = a.getAttribute('href'); if (!seen.has(h)) seen.set(h, (a.textContent || '').trim()); }
    return [...seen.entries()].map(([href, name]) => ({ href, name }));
  });
}
async function contractorRows(page) {
  return page.evaluate(() => {
    const links = [...document.querySelectorAll('a[href^="/contractors/"]')];
    const seen = new Map();
    for (const a of links) { const h = a.getAttribute('href'); if (!seen.has(h)) seen.set(h, (a.textContent || '').trim()); }
    return [...seen.entries()].map(([href, name]) => ({ href, name }));
  });
}
async function navState(page) {
  const nav = page.locator('nav[aria-label="Phân trang"]');
  if (await nav.count() === 0) return { visible: false };
  const prev = nav.locator('button', { hasText: 'Trang trước' });
  const next = nav.locator('button', { hasText: 'Trang sau' });
  return { visible: true, prevDisabled: await prev.isDisabled(), nextDisabled: await next.isDisabled(), label: ((await nav.textContent()) || '').trim() };
}

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  } catch (e) { console.error('LAUNCH FAIL', e.message); process.exit(2); }
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(30000);

  const loginRes = await fetch(`${API}/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: PM_EMAIL, password: PM_PASS }) });
  const loginJson = await loginRes.json().catch(() => ({}));
  const pmToken = loginJson.accessToken;
  if (!pmToken) { console.error('Không lấy được token PM'); await browser.close().catch(() => {}); process.exit(2); }

  try {
    await login(page);

    // ---- P1: total ≥25 khớp SQL; 20 rows/trang; nav Trang 1/2 ----
    try {
      const sqlAll = psqlT(`SELECT count(*) FROM users WHERE user_type='WORKER'`);
      const sqlActive = psqlT(`SELECT count(*) FROM users WHERE user_type='WORKER' AND status='ACTIVE'`);
      const apiAll = await api('GET', '/api/v1/workers?limit=1', pmToken);
      await page.goto(`${WEB}/resources?tab=workers`, { waitUntil: 'networkidle' });
      await waitLoaded(page);
      const t = await bodyText(page);
      const ut = uiTotal(t); const up = uiPage(t);
      const rows = await workerRows(page);
      const nav = await navState(page);
      await snap(page, 'P1-page1', `Workers trang 1: Tổng=${ut} rows=${rows.length} nav=${nav.label}`);
      const note = `SQL all=${sqlAll} active=${sqlActive}; API total=${apiAll.body.total}; UI Tổng=${ut} rows=${rows.length} caption Trang ${up && up.page}/${up && up.pages}; nav=${JSON.stringify(nav)}`;
      console.log('  ' + note);
      if (Number(ut) < 25) rec('P1', 'total ≥25 khớp SQL + 20 rows + nav Trang 1/2', false, note);
      else if (String(ut) !== String(sqlAll) || String(apiAll.body.total) !== String(sqlAll)) rec('P1', 'total ≥25 khớp SQL + 20 rows + nav Trang 1/2', false, note + ' (UI/API/SQL lệch)');
      else if (rows.length !== 20) rec('P1', 'total ≥25 khớp SQL + 20 rows + nav Trang 1/2', false, note);
      else if (!nav.visible || up.page !== '1' || up.pages !== '2' || nav.prevDisabled !== true || nav.nextDisabled !== false) rec('P1', 'total ≥25 khớp SQL + 20 rows + nav Trang 1/2', false, note);
      else rec('P1', 'total ≥25 khớp SQL + 20 rows + nav Trang 1/2', true, note);
    } catch (e) { rec('P1', 'total ≥25 khớp SQL + 20 rows + nav Trang 1/2', false, e.message); }

    // ---- P2: bấm Trang sau → ?page=2, rows khác, khớp API OFFSET 20 ----
    let page1Names = [];
    try {
      page1Names = (await workerRows(page)).map((r) => r.name);
      const apiP1 = await api('GET', '/api/v1/workers?limit=20&offset=0&sort=createdAt&order=desc', pmToken);
      const apiP2 = await api('GET', '/api/v1/workers?limit=20&offset=20&sort=createdAt&order=desc', pmToken);
      await page.locator('nav[aria-label="Phân trang"] button', { hasText: 'Trang sau' }).click();
      await page.waitForFunction(() => window.location.search.includes('page=2'), { timeout: 15000 });
      await waitLoaded(page);
      const t = await bodyText(page);
      const ut = uiTotal(t); const up = uiPage(t);
      const rows2 = await workerRows(page);
      const names2 = rows2.map((r) => r.name);
      const apiNames2 = apiP2.body.data.map((w) => w.fullName);
      const overlap = names2.filter((n) => page1Names.includes(n));
      const nav = await navState(page);
      await snap(page, 'P2-page2', `Workers trang 2: URL page=2 rows=${rows2.length}`);
      const note = `URL=${page.url()}; UI Tổng=${ut} Trang ${up && up.page}/${up && up.pages} rows=${rows2.length}; ` +
        `API p1=[${apiP1.body.data.map((w) => w.fullName).slice(0, 3).join('|')}…] p2=[${apiNames2.join('|')}]; ` +
        `UI p2=[${names2.join('|')}]; overlap p1∩p2=${overlap.length}; nav=${JSON.stringify(nav)}`;
      console.log('  ' + note);
      const namesMatch = names2.length === apiNames2.length && names2.every((n) => apiNames2.includes(n));
      if (!page.url().includes('page=2')) rec('P2', 'Trang sau → ?page=2, rows khác + khớp OFFSET 20', false, note);
      else if (rows2.length !== 6) rec('P2', 'Trang sau → ?page=2, rows khác + khớp OFFSET 20', false, note + ' (mong đợi 6 rows: 26-20)');
      else if (overlap.length !== 0) rec('P2', 'Trang sau → ?page=2, rows khác + khớp OFFSET 20', false, note + ' (trùng tên trang 1)');
      else if (!namesMatch) rec('P2', 'Trang sau → ?page=2, rows khác + khớp OFFSET 20', false, note + ' (UI khác API offset 20)');
      else if (String(ut) !== '26') rec('P2', 'Trang sau → ?page=2, rows khác + khớp OFFSET 20', false, note);
      else rec('P2', 'Trang sau → ?page=2, rows khác + khớp OFFSET 20', true, note);
    } catch (e) { rec('P2', 'Trang sau → ?page=2, rows khác + khớp OFFSET 20', false, e.message); }

    // ---- P3: sort=name asc → pagination đúng theo sort mới ----
    try {
      await page.goto(`${WEB}/resources?tab=workers&sort=name&order=asc`, { waitUntil: 'networkidle' });
      await waitLoaded(page);
      let t = await bodyText(page);
      const rowsA1 = await workerRows(page);
      const namesA1 = rowsA1.map((r) => r.name);
      const apiA1 = await api('GET', '/api/v1/workers?limit=20&offset=0&sort=name&order=asc', pmToken);
      const apiA2 = await api('GET', '/api/v1/workers?limit=20&offset=20&sort=name&order=asc', pmToken);
      const apiNamesA1 = apiA1.body.data.map((w) => w.fullName);
      const match1 = namesA1.length === apiNamesA1.length && namesA1.every((n) => apiNamesA1.includes(n)) && namesA1[0] === apiNamesA1[0] && namesA1[namesA1.length - 1] === apiNamesA1[apiNamesA1.length - 1];
      await page.locator('nav[aria-label="Phân trang"] button', { hasText: 'Trang sau' }).click();
      await page.waitForFunction(() => window.location.search.includes('page=2'), { timeout: 15000 });
      await waitLoaded(page);
      t = await bodyText(page);
      const rowsA2 = await workerRows(page);
      const namesA2 = rowsA2.map((r) => r.name);
      const apiNamesA2 = apiA2.body.data.map((w) => w.fullName);
      const match2 = namesA2.length === apiNamesA2.length && namesA2.every((n) => apiNamesA2.includes(n));
      const overlap = namesA2.filter((n) => namesA1.includes(n));
      await snap(page, 'P3-sort-page2', `sort=name asc trang 2: rows=${rowsA2.length}`);
      const note = `sort=name asc: UI p1[0]=${namesA1[0]} p1[19]=${namesA1[namesA1.length - 1]} (API p1[0]=${apiNamesA1[0]} p1[19]=${apiNamesA1[apiNamesA1.length - 1]}); ` +
        `UI p2=[${namesA2.join('|')}] API p2=[${apiNamesA2.join('|')}]; overlap=${overlap.length}; URL=${page.url()}`;
      console.log('  ' + note);
      if (!match1) rec('P3', 'sort=name asc → pagination đúng offset sort mới', false, note + ' (trang 1 lệch API)');
      else if (!match2) rec('P3', 'sort=name asc → pagination đúng offset sort mới', false, note + ' (trang 2 lệch API offset 20)');
      else if (overlap.length !== 0) rec('P3', 'sort=name asc → pagination đúng offset sort mới', false, note + ' (trùng trang 1)');
      else rec('P3', 'sort=name asc → pagination đúng offset sort mới', true, note);
    } catch (e) { rec('P3', 'sort=name asc → pagination đúng offset sort mới', false, e.message); }

    // ---- P4: filter status → total giảm, reset về trang 1 ----
    try {
      // đang ở ?page=2 (sort name asc) → chọn INACTIVE: phải reset page=1
      await page.selectOption('#directory-status', 'INACTIVE');
      await page.waitForFunction(() => !window.location.search.includes('page=2'), { timeout: 15000 });
      await waitLoaded(page);
      let t = await bodyText(page);
      const utI = uiTotal(t); const upI = uiPage(t);
      const sqlI = psqlT(`SELECT count(*) FROM users WHERE user_type='WORKER' AND status='INACTIVE'`);
      const navI = await navState(page);
      // combo ACTIVE → total 25, nav hiện lại Trang 1/2
      await page.selectOption('#directory-status', 'ACTIVE');
      await waitLoaded(page);
      t = await bodyText(page);
      const utA = uiTotal(t); const upA = uiPage(t);
      const rowsA = await workerRows(page);
      const sqlA = psqlT(`SELECT count(*) FROM users WHERE user_type='WORKER' AND status='ACTIVE'`);
      const navA = await navState(page);
      await snap(page, 'P4-filter', `filter ACTIVE: Tổng=${utA} rows=${rowsA.length}`);
      const note = `INACTIVE: UI Tổng=${utI}(SQL=${sqlI}) Trang ${upI && upI.page}/${upI && upI.pages} navVisible=${navI.visible} URL=${page.url()}; ` +
        `ACTIVE: UI Tổng=${utA}(SQL=${sqlA}) rows=${rowsA.length} Trang ${upA && upA.page}/${upA && upA.pages} nav=${JSON.stringify(navA)}`;
      console.log('  ' + note);
      if (String(utI) !== String(sqlI) || upI.page !== '1' || navI.visible !== false) rec('P4', 'filter status → total giảm + reset trang 1', false, note);
      else if (String(utA) !== String(sqlA) || upA.page !== '1' || rowsA.length !== 20 || !navA.visible) rec('P4', 'filter status → total giảm + reset trang 1', false, note + ' (ACTIVE combo hỏng)');
      else rec('P4', 'filter status → total giảm + reset trang 1', true, note);
    } catch (e) { rec('P4', 'filter status → total giảm + reset trang 1', false, e.message); }

    // ---- P5: giữ filter + quay lại từ detail → page giữ nguyên ----
    try {
      await page.goto(`${WEB}/resources?tab=workers&status=ACTIVE&sort=createdAt&order=desc&page=2`, { waitUntil: 'networkidle' });
      await waitLoaded(page);
      let t = await bodyText(page);
      const before = { total: uiTotal(t), pg: uiPage(t) };
      const firstHref = await page.evaluate(() => { const a = document.querySelector('a[href^="/workers/"]'); return a ? a.getAttribute('href') : null; });
      if (!firstHref) throw new Error('không tìm thấy link detail worker');
      await page.locator(`a[href="${firstHref}"]`).first().click();
      await page.waitForURL(`**${firstHref}`, { timeout: 15000 });
      await page.waitForTimeout(1500);
      const detailTitle = (await bodyText(page)).slice(0, 120).replace(/\s+/g, ' ');
      await page.goBack({ waitUntil: 'networkidle' });
      await waitLoaded(page);
      t = await bodyText(page);
      const after = { total: uiTotal(t), pg: uiPage(t) };
      await snap(page, 'P5-back', `back từ detail: URL giữ page=2 Tổng=${after.total}`);
      const note = `trước: Tổng=${before.total} Trang ${before.pg && before.pg.page}/${before.pg && before.pg.pages}; ` +
        `detail=${firstHref} (${detailTitle.slice(0, 80)}…); sau back URL=${page.url()} Tổng=${after.total} Trang ${after.pg && after.pg.page}/${after.pg && after.pg.pages}`;
      console.log('  ' + note);
      if (!page.url().includes('page=2') || !page.url().includes('status=ACTIVE')) rec('P5', 'filter + detail → back giữ page', false, note);
      else if (String(after.total) !== String(before.total) || after.pg.page !== '2') rec('P5', 'filter + detail → back giữ page', false, note);
      else rec('P5', 'filter + detail → back giữ page', true, note);
    } catch (e) { rec('P5', 'filter + detail → back giữ page', false, e.message); }

    // ---- P6: Contractors total ≤ limit → không có pagination ----
    try {
      await page.goto(`${WEB}/resources?tab=contractors`, { waitUntil: 'networkidle' });
      await waitLoaded(page);
      const t = await bodyText(page);
      const ut = uiTotal(t);
      const apiC = await api('GET', '/api/v1/contractors?limit=20', pmToken);
      const rows = await contractorRows(page);
      const nav = await navState(page);
      await snap(page, 'P6-contractors', `Contractors Tổng=${ut} rows=${rows.length} navVisible=${nav.visible}`);
      const note = `UI Tổng=${ut} API total=${apiC.body.total} rows=${rows.length} names=[${rows.map((r) => r.name).join('|')}] navVisible=${nav.visible}`;
      console.log('  ' + note);
      if (String(ut) !== String(apiC.body.total)) rec('P6', 'Contractors ≤20 → không hiện pagination', false, note);
      else if (Number(ut) > 20) rec('P6', 'Contractors ≤20 → không hiện pagination', false, note + ' (total >20 ngoài kỳ vọng)');
      else if (rows.length !== Number(ut)) rec('P6', 'Contractors ≤20 → không hiện pagination', false, note);
      else if (nav.visible) rec('P6', 'Contractors ≤20 → không hiện pagination', false, note + ' (nav vẫn hiện)');
      else rec('P6', 'Contractors ≤20 → không hiện pagination', true, note);
    } catch (e) { rec('P6', 'Contractors ≤20 → không hiện pagination', false, e.message); }

    // ---- P7: Next/Prev disable đúng ở biên ----
    try {
      await page.goto(`${WEB}/resources?tab=workers`, { waitUntil: 'networkidle' });
      await waitLoaded(page);
      const nav1 = await navState(page);
      await snap(page, 'P7-edge', `biên trang 1: prevDisabled=${nav1.prevDisabled} nextDisabled=${nav1.nextDisabled}`);
      await page.goto(`${WEB}/resources?tab=workers&page=2`, { waitUntil: 'networkidle' });
      await waitLoaded(page);
      const nav2 = await navState(page);
      const note = `trang 1: ${JSON.stringify(nav1)}; trang cuối (2/2): ${JSON.stringify(nav2)}`;
      console.log('  ' + note);
      if (nav1.prevDisabled !== true || nav1.nextDisabled !== false) rec('P7', 'Next/Prev disable đúng ở biên', false, note);
      else if (nav2.prevDisabled !== false || nav2.nextDisabled !== true) rec('P7', 'Next/Prev disable đúng ở biên', false, note);
      else rec('P7', 'Next/Prev disable đúng ở biên', true, note);
    } catch (e) { rec('P7', 'Next/Prev disable đúng ở biên', false, e.message); }

    const NP = results.filter((r) => r.ok).length, NF = results.filter((r) => !r.ok).length;
    console.log(`\n===== TỔNG PAGINATION: ${NP} PASS / ${NF} FAIL / ${results.length} bước =====`);
    // Ghi ids seed TX-8% (id-based cleanup, xem §10.3 doc) + kết quả machine-readable.
    try {
      const seedIds = psqlT(`SELECT string_agg(id::text, ',') FROM users WHERE employee_code LIKE 'TX-8%'`);
      fs.writeFileSync(path.join(__dirname, 'e2e-vars-pagination.json'),
        JSON.stringify({ seedCodePattern: 'TX-8%', seedIds: seedIds ? seedIds.split(',') : [], results }, null, 2));
      console.log(`  vars e2e-vars-pagination.json — seed ids: ${seedIds ? seedIds.split(',').length : 0}`);
    } catch (e) { console.log('  vars write FAIL: ' + (e.message || e)); }
    if (NF) process.exitCode = 1;
  } catch (err) {
    console.error('DRIVER ERROR', err && err.message ? err.message : err);
    process.exitCode = 1;
  } finally {
    await browser.close().catch(() => {});
  }
})();
