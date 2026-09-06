/**
 * ORG-SRS-005 E2E driver — Resource directory read-only (issue #28).
 * Evidence-only script; phạm vi docs/evidence — KHÔNG commit, KHÔNG sửa source.
 *
 * Chạy:   node e2e-driver-org-srs-005.cjs
 * Yêu cầu: docker stack buildflow với api/web rebuild từ working tree
 *          (GET /workers|contractors|trades cho PROJECT_MANAGER + sort/order +
 *          fieldErrors + Cache-Control: no-store; web có route /resources);
 *          admin (E2EAdmin@2025) + pm (E2EPm@2025) + worker1 (E2EWorker@2025).
 *
 * Lưu ý: audit_logs append-only → khẳng định audit (nếu có) dùng DELTA.
 * S10/S12 đổi trạng thái/scope rồi HOÀN NGUYÊN ngay trong step.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('/home/trung/.npm-global/lib/node_modules/@playwright/mcp/node_modules/playwright');

const WEB = 'http://localhost:3001';
const API = 'http://localhost:3000';
const SHOTS = path.join(__dirname, 'shots');
const EV = path.join(__dirname, 'e2e-vars.json');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASS = 'E2EAdmin@2025';
const PM_EMAIL = 'pm@example.com';
const PM_PASS = 'E2EPm@2025';
const WORKER_EMAIL = 'worker1@example.com';
const WORKER_PASS = 'E2EWorker@2025';

const TRADE_TONZFUF = 'e8f974e9-3d12-4f25-97cb-32bd81b843fd'; // E2E-TONZFUF
const WORKER2_EMAIL = 'worker2@example.com'; // Lê Văn Thợ — dùng cho S10 (suspend rồi restore)
const CONTRACTOR_E2E4 = 'e2e4c000-0000-4000-8000-0000000000c1'; // E2E4-CON — dùng cho S12 (scope rồi revert)
const GHOST_ID = '00000000-0000-4000-8000-000000000099';

const results = [];
function step(id, name, fn) {
  return async () => {
    try {
      const r = await fn(id);
      results.push(r);
      console.log(`${r.ok ? 'PASS' : 'FAIL'} ${id} ${name}${r.note ? ' :: ' + String(r.note).split('\n')[0] : ''}`);
      if (!r.ok && r.note) console.log(`  detail: ${String(r.note).slice(0, 600)}`);
    } catch (err) {
      results.push({ id, name, ok: false, note: err && err.message ? err.message : String(err) });
      console.log(`ERROR ${id} ${name} :: ${err && err.message ? err.message : err}`);
    }
  };
}
async function snap(page, id, desc) {
  await page.screenshot({ path: path.join(SHOTS, `${id}.png`), fullPage: false });
  console.log(`  shot ${id}.png — ${desc}`);
}
const ok = (id, note = '') => ({ id, ok: true, note });
const fail = (id, note) => ({ id, ok: false, note });

function psqlT(sql) {
  try {
    return execFileSync('docker', [
      'exec', 'buildflow-postgres-1', 'psql', '-U', 'buildflow', '-d', 'buildflow', '-t', '-A', '-c', sql,
    ], { encoding: 'utf8', timeout: 15000 }).trim();
  } catch (e) {
    return `PSQL ERROR: ${e.stderr || e.message}`;
  }
}

async function api(method, urlPath, token, body, extraHeaders) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (extraHeaders) Object.assign(headers, extraHeaders);
  const res = await fetch(`${API}${urlPath}`, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, headers: res.headers, body: json };
}
async function apiRaw(method, urlPath, token, body) {
  // trả raw text (dùng cho header trace)
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${urlPath}`, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, cacheControl: res.headers.get('cache-control'), text };
}

async function login(page, email, password) {
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await Promise.all([
    page.waitForURL('**/dashboard', { timeout: 25000 }),
    page.click('button[type="submit"]'),
  ]);
}
async function getToken(email, password) {
  const r = await api('POST', '/api/v1/auth/login', null, { email, password });
  return r.body && r.body.accessToken ? r.body.accessToken : null;
}
async function bodyText(page) {
  return (await page.locator('body').textContent()) || '';
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
  page.setDefaultTimeout(30000);

  const adminToken = await getToken(ADMIN_EMAIL, ADMIN_PASS);
  const pmToken = await getToken(PM_EMAIL, PM_PASS);
  const workerToken = await getToken(WORKER_EMAIL, WORKER_PASS);
  if (!adminToken || !pmToken || !workerToken) {
    console.error(`Không lấy được token (admin=${!!adminToken} pm=${!!pmToken} worker=${!!workerToken}) — xem §2 doc.`);
    await browser.close().catch(() => {});
    process.exit(2);
  }

  try {
    // ============ S1 ============
    await step('S1', 'PM login → nav thấy Tra cứu nguồn lực, KHÔNG thấy admin items → mở /resources', async (id) => {
      await login(page, PM_EMAIL, PM_PASS);
      await page.waitForSelector('.bf-nav', { timeout: 15000 });
      const navText = (await page.locator('.bf-nav').textContent()) || '';
      const seesResources = navText.includes('Tra cứu nguồn lực');
      const seesWorkers = navText.includes('Công nhân');
      const seesTrades = navText.includes('Ngành nghề');
      const seesAdmin = navText.includes('Tài khoản') || navText.includes('Nhật ký thao tác');
      await snap(page, id + '-nav', 'Sidebar PM sau login');
      if (!seesResources) return fail(id, `sidebar thiếu 'Tra cứu nguồn lực': ${navText.slice(0, 300)}`);
      if (seesWorkers || seesTrades || seesAdmin) {
        return fail(id, `sidebar PM lộ admin items (workers=${seesWorkers} trades=${seesTrades} admin=${seesAdmin})`);
      }
      await page.goto(`${WEB}/resources`, { waitUntil: 'networkidle' });
      await page.waitForSelector('[role="tablist"]', { timeout: 15000 });
      const t = await bodyText(page);
      if (!t.includes('Tìm kiếm') || !t.includes('Công nhân')) return fail(id, 'trang /resources không render directory');
      await snap(page, id + '-directory', 'PM mở /resources — tab workers mặc định');
      return ok(id, `nav PM: có 'Tra cứu nguồn lực', không có Công nhân/Ngành nghề/Tài khoản/Nhật ký; /resources 200 render tablist`);
    })();

    // ============ S2 ============
    await step('S2', 'Workers: filter kết hợp status=ACTIVE+trade+skill → đúng 1; đối chiếu SQL COUNT; search text cập nhật', async (id) => {
      await page.goto(`${WEB}/resources?tab=workers`, { waitUntil: 'networkidle' });
      await page.waitForSelector('#directory-trade', { timeout: 15000 });
      await page.selectOption('#directory-status', 'ACTIVE');
      await page.selectOption('#directory-trade', TRADE_TONZFUF);
      await page.selectOption('#directory-skill', '3');
      await page.waitForFunction(() => (document.body.textContent || '').includes('Tổng:'), { timeout: 15000 });
      await page.waitForTimeout(2000);
      let t = await bodyText(page);
      const apiRes = await api('GET', `/api/v1/workers?status=ACTIVE&tradeId=${TRADE_TONZFUF}&skillLevel=3`, pmToken);
      const sqlCount = psqlT(
        `SELECT count(*) FROM users u WHERE u.user_type='WORKER' AND u.status='ACTIVE' ` +
        `AND EXISTS (SELECT 1 FROM resource_trades rt WHERE rt.resource_type='USER' AND rt.user_id=u.id ` +
        `AND rt.is_active AND rt.trade_id='${TRADE_TONZFUF}' AND rt.skill_level=3)`
      );
      await snap(page, id + '-combined', 'Filter kết hợp ACTIVE + trade E2E-TONZFUF + skill 3');
      const uiHasWorker = t.includes('E2E Worker ONZFUF');
      const m = t.match(/Tổng:\s*(\d+)/);
      const uiTotal = m ? m[1] : '?';
      if (apiRes.status !== 200) return fail(id, `API combined HTTP ${apiRes.status}: ${JSON.stringify(apiRes.body)}`);
      if (String(apiRes.body.total) !== String(sqlCount)) {
        return fail(id, `API total=${apiRes.body.total} khác SQL count=${sqlCount}`);
      }
      if (String(uiTotal) !== String(sqlCount)) return fail(id, `UI Tổng=${uiTotal} khác SQL count=${sqlCount} (body: ${t.slice(0, 300)})`);
      if (!uiHasWorker) return fail(id, `UI thiếu worker mong đợi 'E2E Worker ONZFUF' (Tổng=${uiTotal})`);
      // đổi search text → kết quả cập nhật
      await page.fill('#directory-q', 'Nguyễn Văn Thợ');
      await page.locator('button', { hasText: 'Tìm' }).first().click();
      await page.waitForTimeout(2000);
      t = await bodyText(page);
      await snap(page, id + '-search', 'Search "Nguyễn Văn Thợ" (trade filter vẫn giữ → 0, chứng minh search có tác dụng)');
      const m2 = t.match(/Tổng:\s*(\d+)/);
      if (!m2 || m2[1] === uiTotal) return fail(id, `search không làm đổi kết quả (Tổng trước=${uiTotal} sau=${m2 && m2[1]})`);
      return ok(id, `combined: API total=${apiRes.body.total} = SQL count=${sqlCount} = UI Tổng=${uiTotal} (E2E Worker ONZFUF); search đổi Tổng → ${m2[1]}`);
    })();

    // ============ S3 ============
    await step('S3', 'Sort Tên/Mới nhất × asc/desc → thứ tự đổi đúng', async (id) => {
      const asc = await api('GET', '/api/v1/workers?sort=name&order=asc&limit=20', pmToken);
      const desc = await api('GET', '/api/v1/workers?sort=name&order=desc&limit=20', pmToken);
      if (asc.status !== 200 || desc.status !== 200) return fail(id, `sort API HTTP asc=${asc.status} desc=${desc.status}`);
      const namesAsc = asc.body.data.map((w) => w.fullName);
      const namesDesc = desc.body.data.map((w) => w.fullName);
      const reversed = [...namesAsc].reverse().join('|') === namesDesc.join('|');
      // UI: chọn sort Tên + Tăng dần, đọc 2 card đầu
      await page.goto(`${WEB}/resources?tab=workers&sort=name&order=asc`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      const tAsc = await bodyText(page);
      await page.goto(`${WEB}/resources?tab=workers&sort=name&order=desc`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      const tDesc = await bodyText(page);
      await snap(page, id + '-desc', 'Sort Tên Giảm dần');
      const uiFirstAsc = namesAsc.slice(0, 2).every((n) => tAsc.includes(n));
      const uiFirstDesc = namesDesc.slice(0, 2).every((n) => tDesc.includes(n));
      const orderFlipped = tAsc.indexOf(namesAsc[0]) < tAsc.indexOf(namesAsc[namesAsc.length - 1]);
      if (!reversed) return fail(id, `API asc/desc không đảo nhau: ${namesAsc.slice(0, 3)} vs ${namesDesc.slice(0, 3)}`);
      if (!uiFirstAsc || !uiFirstDesc) return fail(id, `UI không khớp API (asc2=${namesAsc.slice(0, 2)} desc2=${namesDesc.slice(0, 2)})`);
      if (!orderFlipped) return fail(id, 'UI asc không tăng dần');
      return ok(id, `API asc[0..2]=${namesAsc.slice(0, 3).join(' / ')}; desc đảo đúng; UI khớp cả 2 chiều`);
    })();

    // ============ S4 ============
    await step('S4', 'Pagination: API limit/offset đúng trang; UI ?page=2 giữ total', async (id) => {
      const p1 = await api('GET', '/api/v1/workers?limit=2&offset=0&sort=name&order=asc', pmToken);
      const p2 = await api('GET', '/api/v1/workers?limit=2&offset=2&sort=name&order=asc', pmToken);
      if (p1.status !== 200 || p2.status !== 200) return fail(id, `pagination API HTTP ${p1.status}/${p2.status}`);
      const overlap = p1.body.data.some((w) => p2.body.data.map((x) => x.id).includes(w.id));
      await page.goto(`${WEB}/resources?tab=workers&page=2`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      const t = await bodyText(page);
      const m = t.match(/Tổng:\s*(\d+)/);
      await snap(page, id + '-page2', 'UI ?page=2 (PAGE_SIZE=20 > dataset → empty + caption Trang 2)');
      if (overlap) return fail(id, 'page1/page2 API trùng id');
      if (String(p1.body.total) !== String(p2.body.total)) return fail(id, `total lệch trang (${p1.body.total} vs ${p2.body.total})`);
      if (!m || String(m[1]) !== String(p1.body.total)) return fail(id, `UI Tổng=${m && m[1]} khác API total=${p1.body.total}`);
      return ok(id, `API limit=2: trang1=[${p1.body.data.map((w) => w.fullName).join(', ')}] trang2=[${p2.body.data.map((w) => w.fullName).join(', ')}] total=${p1.body.total} khớp; UI page=2 Tổng=${m[1]} (empty vì PAGE_SIZE=20 > dataset — đúng thiết kế)`);
    })();

    // ============ S5 ============
    await step('S5', 'Empty state + Xóa bộ lọc + URL persist sau back/refresh', async (id) => {
      const strange = 'zzz-khong-ton-tai-qqq';
      await page.goto(`${WEB}/resources?tab=workers&q=${strange}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      let t = await bodyText(page);
      const hasEmpty = t.includes('Chưa có công nhân nào phù hợp bộ lọc');
      await snap(page, id + '-empty', 'Empty state search ký tự lạ');
      if (!hasEmpty) return fail(id, `thiếu empty state (body: ${t.slice(0, 300)})`);
      // Xóa bộ lọc → trở lại đầy đủ
      await page.locator('button', { hasText: 'Xóa bộ lọc' }).first().click();
      await page.waitForTimeout(2000);
      t = await bodyText(page);
      const m = t.match(/Tổng:\s*(\d+)/);
      const fullTotal = psqlT(`SELECT count(*) FROM users WHERE user_type='WORKER'`);
      if (!m || String(m[1]) !== String(fullTotal)) return fail(id, `clear filters Tổng=${m && m[1]} khác DB=${fullTotal}`);
      // persist: set filter, refresh, back
      await page.goto(`${WEB}/resources?tab=workers&status=ACTIVE&sort=name&order=asc`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      const urlAfterReload = page.url();
      const persistReload = urlAfterReload.includes('status=ACTIVE') && urlAfterReload.includes('sort=name');
      await page.goto(`${WEB}/dashboard`, { waitUntil: 'networkidle' });
      await page.goBack({ waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      const urlAfterBack = page.url();
      const persistBack = urlAfterBack.includes('status=ACTIVE');
      await snap(page, id + '-persist', 'URL sau back vẫn giữ filter');
      if (!persistReload || !persistBack) return fail(id, `persist hỏng (reload=${urlAfterReload} back=${urlAfterBack})`);
      return ok(id, `empty state đúng + clear → Tổng=${m[1]} = DB ${fullTotal}; URL giữ filter sau refresh (${persistReload}) và back (${persistBack})`);
    })();

    // ============ S6 ============
    await step('S6', 'Tab Contractors: filter status+search, sort, empty', async (id) => {
      await page.goto(`${WEB}/resources?tab=contractors`, { waitUntil: 'networkidle' });
      await page.waitForSelector('#directory-status', { timeout: 15000 });
      await page.waitForTimeout(2000);
      let t = await bodyText(page);
      const apiAll = await api('GET', '/api/v1/contractors?limit=20', pmToken);
      const m = t.match(/Tổng:\s*(\d+)/);
      if (apiAll.status !== 200) return fail(id, `contractors API HTTP ${apiAll.status}`);
      if (!m || String(m[1]) !== String(apiAll.body.total)) return fail(id, `UI Tổng=${m && m[1]} khác API=${apiAll.body.total}`);
      // filter status INACTIVE → 0 (DB hiện không có INACTIVE) + search
      await page.selectOption('#directory-status', 'INACTIVE');
      await page.waitForTimeout(2000);
      t = await bodyText(page);
      const emptyInactive = t.includes('Chưa có nhà thầu nào phù hợp bộ lọc');
      const sqlInactive = psqlT(`SELECT count(*) FROM contractors WHERE status='INACTIVE'`);
      // sort tên asc
      const sAsc = await api('GET', '/api/v1/contractors?sort=name&order=asc&limit=20', pmToken);
      const sDesc = await api('GET', '/api/v1/contractors?sort=name&order=desc&limit=20', pmToken);
      const namesAsc = sAsc.body.data.map((c) => c.name);
      const namesDesc = sDesc.body.data.map((c) => c.name);
      await snap(page, id + '-inactive', 'Contractors filter INACTIVE → empty');
      if (sqlInactive !== '0' || !emptyInactive) return fail(id, `INACTIVE sql=${sqlInactive} emptyUI=${emptyInactive}`);
      if ([...namesAsc].reverse().join('|') !== namesDesc.join('|')) return fail(id, 'contractor sort asc/desc không đảo nhau');
      // search khớp 1
      await page.goto(`${WEB}/resources?tab=contractors&q=Nam%20Ti%E1%BA%BFn`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      t = await bodyText(page);
      const foundNTA = t.includes('Nam Tiến');
      await snap(page, id + '-search', 'Contractors search "Nam Tiến"');
      if (!foundNTA) return fail(id, 'search Nam Tiến không ra kết quả');
      return ok(id, `Tổng=${m[1]} khớp API; INACTIVE sql=0 + empty UI; sort asc=[${namesAsc.join(' / ')}] đảo đúng; search 'Nam Tiến' khớp`);
    })();

    // ============ S7 ============
    await step('S7', 'Tab Đội disabled + note ORG-SRS-006', async (id) => {
      await page.goto(`${WEB}/resources?tab=workers`, { waitUntil: 'networkidle' });
      await page.waitForSelector('[role="tablist"]', { timeout: 15000 });
      const teamTab = page.locator('button[role="tab"]', { hasText: 'Đội' });
      const disabled = await teamTab.isDisabled();
      const t = await bodyText(page);
      const hasNote = t.includes('ORG-SRS-006');
      await snap(page, id, 'Tab Đội disabled + note Sắp có ORG-SRS-006');
      if (!disabled) return fail(id, 'tab Đội KHÔNG disabled');
      if (!hasNote) return fail(id, 'thiếu note ORG-SRS-006');
      return ok(id, 'tab Đội disabled + note "Sắp có — ORG-SRS-006" hiển thị');
    })();

    // ============ S8 ============
    await step('S8', 'PM mở /workers/[id] từ directory: profile+timeline note, KHÔNG nút lifecycle; open-work 403', async (id) => {
      const list = await api('GET', '/api/v1/workers?limit=1&sort=name&order=asc', pmToken);
      const wid = list.body.data[0].id;
      const detail = await api('GET', `/api/v1/workers/${wid}`, pmToken);
      if (detail.status !== 200) return fail(id, `PM GET detail HTTP ${detail.status}`);
      await page.goto(`${WEB}/resources?tab=workers`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      const link = page.locator(`a[href="/workers/${wid}"]`).first();
      await link.click();
      await page.waitForURL(`**/workers/${wid}`, { timeout: 15000 });
      await page.waitForTimeout(2000);
      const t = await bodyText(page);
      const hasProfile = t.includes(detail.body.fullName) || t.includes(detail.body.email);
      const noLifecycle = !(/Tạm ngừng|Kích hoạt lại|Chấm dứt/.test(t) && /Xác nhận/.test(t));
      const readOnlyNote = t.includes('chỉ xem');
      const historyNote = t.includes('Lịch sử trạng thái chỉ dành cho ADMIN');
      await snap(page, id + '-detail', 'PM xem WorkerDetail read-only');
      const ow = await api('GET', `/api/v1/workers/${wid}/open-work`, pmToken);
      if (!hasProfile) return fail(id, 'detail không hiện profile');
      if (!readOnlyNote) return fail(id, `thiếu ghi chú chỉ-xem (body: ${t.slice(0, 400)})`);
      if (!historyNote) return fail(id, 'thiếu note Lịch sử trạng thái admin-only');
      if (!noLifecycle) return fail(id, 'PM vẫn thấy nút lifecycle');
      if (ow.status !== 403) return fail(id, `PM open-work HTTP ${ow.status} (mong đợi 403)`);
      return ok(id, `profile '${detail.body.fullName}' hiện; ghi chú chỉ-xem + history admin-only; không nút lifecycle; PM open-work=403`);
    })();

    // ============ S9 ============
    await step('S9', 'Tampering: PM PATCH 403 ×2, WORKER GET 403, anon 401, PM detail ghost 404', async (id) => {
      const list = await api('GET', '/api/v1/workers?limit=1', pmToken);
      const wid = list.body.data[0].id;
      const pmW = await api('PATCH', `/api/v1/workers/${wid}/status`, pmToken, { action: 'SUSPEND', reason: 'tamper E2E28' });
      const pmC = await api('PATCH', `/api/v1/contractors/${CONTRACTOR_E2E4}`, pmToken, { scope: 'tamper E2E28' });
      const wGet = await api('GET', '/api/v1/workers?limit=5', workerToken);
      const wGetC = await api('GET', '/api/v1/contractors?limit=5', workerToken);
      const anonW = await api('GET', '/api/v1/workers?limit=5', null);
      const anonC = await api('GET', `/api/v1/contractors/${CONTRACTOR_E2E4}`, null);
      const pmGhost = await api('GET', `/api/v1/workers/${GHOST_ID}`, pmToken);
      const pmGhostC = await api('GET', `/api/v1/contractors/${GHOST_ID}`, pmToken);
      const dbCheck = psqlT(`SELECT status FROM users WHERE id='${wid}'`);
      const notes = `PM PATCH worker=${pmW.status} contractor-inline=${pmC.status}; WORKER GET workers=${wGet.status} contractors=${wGetC.status}; anon workers=${anonW.status} contractor-detail=${anonC.status}; PM ghost worker=${pmGhost.status} contractor=${pmGhostC.status}; status sau tamper=${dbCheck.trim()}`;
      if (pmW.status !== 403 || pmC.status !== 403) return fail(id, notes);
      if (wGet.status !== 403 || wGetC.status !== 403) return fail(id, notes);
      if (anonW.status !== 401 || anonC.status !== 401) return fail(id, notes);
      if (pmGhost.status !== 404 || pmGhostC.status !== 404) return fail(id, notes);
      return ok(id, notes);
    })();

    // ============ S10 ============
    await step('S10', 'no-store header + admin SUSPEND → PM thấy INACTIVE ngay (không stale), rồi restore', async (id) => {
      const raw = await apiRaw('GET', '/api/v1/workers?status=ACTIVE&limit=5', pmToken);
      const ccSearch = raw.cacheControl;
      const rawDetail = await apiRaw('GET', '/api/v1/contractors?limit=5', pmToken);
      // worker2 đang ACTIVE → admin SUSPEND
      const w2id = psqlT(`SELECT id FROM users WHERE email='${WORKER2_EMAIL}'`);
      const susp = await api('PATCH', `/api/v1/workers/${w2id}/status`, adminToken, { action: 'SUSPEND', reason: 'E2E28 no-store check' });
      if (susp.status !== 200) return fail(id, `admin SUSPEND worker2 HTTP ${susp.status}: ${JSON.stringify(susp.body)}`);
      const pmAfter = await api('GET', `/api/v1/workers?search=${encodeURIComponent(WORKER2_EMAIL)}`, pmToken);
      const seen = pmAfter.body.data.length ? pmAfter.body.data[0].status : 'MISSING';
      await page.goto(`${WEB}/resources?tab=workers&q=${encodeURIComponent(WORKER2_EMAIL)}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      const t = await bodyText(page);
      await snap(page, id + '-fresh', 'PM search ngay sau SUSPEND — thấy INACTIVE (không stale)');
      // restore ACTIVE
      const react = await api('PATCH', `/api/v1/workers/${w2id}/status`, adminToken, { action: 'ACTIVATE', reason: 'E2E28 restore' });
      const finalStatus = psqlT(`SELECT status FROM users WHERE email='${WORKER2_EMAIL}'`);
      const uiShowsInactive = /Ngừng hoạt động|INACTIVE/.test(t);
      const notes = `CC search='${ccSearch}' detail='${rawDetail.cacheControl}'; PM API sau SUSPEND=${seen}; UI thấy INACTIVE=${uiShowsInactive}; restore HTTP=${react.status} final=${finalStatus.trim()}`;
      if (ccSearch !== 'no-store') return fail(id, notes);
      if (seen !== 'INACTIVE') return fail(id, notes);
      if (!uiShowsInactive) return fail(id, notes);
      if (react.status !== 200 || finalStatus.trim() !== 'ACTIVE') return fail(id, notes + ' (RESTORE HỎNG)');
      return ok(id, notes);
    })();

    // ============ S11 ============
    await step('S11', 'Field-level error: sort sai + skillLevel=9 → 400 fieldErrors đúng key', async (id) => {
      const badSort = await api('GET', '/api/v1/workers?sort=sai&order=asc', pmToken);
      const badSkill = await api('GET', '/api/v1/workers?skillLevel=9', pmToken);
      const badOrder = await api('GET', '/api/v1/contractors?sort=name&order=sideways', pmToken);
      const ks = badSort.body && badSort.body.fieldErrors ? Object.keys(badSort.body.fieldErrors) : [];
      const kk = badSkill.body && badSkill.body.fieldErrors ? Object.keys(badSkill.body.fieldErrors) : [];
      const ko = badOrder.body && badOrder.body.fieldErrors ? Object.keys(badOrder.body.fieldErrors) : [];
      const notes = `sort=sai → ${badSort.status} keys=[${ks}] msg='${badSort.body && badSort.body.message}'; ` +
        `skillLevel=9 → ${badSkill.status} keys=[${kk}] msg='${badSkill.body && badSkill.body.message}'; ` +
        `contractors order=sai → ${badOrder.status} keys=[${ko}]`;
      if (badSort.status !== 400 || !ks.includes('sort')) return fail(id, notes);
      if (badSkill.status !== 400 || !kk.some((k) => /skill/i.test(k))) return fail(id, notes);
      if (badOrder.status !== 400 || !ko.includes('order')) return fail(id, notes);
      return ok(id, notes);
    })();

    // ============ S12 ============
    await step('S12', 'Admin regression smoke: list/search/detail/write', async (id) => {
      const l = await api('GET', '/api/v1/workers?limit=5', adminToken);
      const s = await api('GET', '/api/v1/workers?search=Th%E1%BB%A3', adminToken);
      const d = await api('GET', `/api/v1/workers/${l.body.data[0].id}`, adminToken);
      const lc = await api('GET', '/api/v1/contractors?limit=5', adminToken);
      const dc = await api('GET', `/api/v1/contractors/${CONTRACTOR_E2E4}`, adminToken);
      const tr = await api('GET', '/api/v1/trades?limit=5', adminToken);
      // write: PATCH scope E2E4-CON rồi revert
      const origScope = dc.body.scope;
      const w1 = await api('PATCH', `/api/v1/contractors/${CONTRACTOR_E2E4}`, adminToken, { scope: `${origScope} (E2E28)` });
      const verify = await api('GET', `/api/v1/contractors/${CONTRACTOR_E2E4}`, adminToken);
      const w2 = await api('PATCH', `/api/v1/contractors/${CONTRACTOR_E2E4}`, adminToken, { scope: origScope });
      const final = await api('GET', `/api/v1/contractors/${CONTRACTOR_E2E4}`, adminToken);
      const notes = `list=${l.status} search=${s.status}(total=${s.body.total}) detail=${d.status} contractors=${lc.status}/${dc.status} trades=${tr.status}; ` +
        `PATCH scope ${w1.status}→verify='${verify.body.scope}' revert ${w2.status}→final='${final.body.scope}'`;
      const allOk = [l, s, d, lc, dc, tr].every((r) => r.status === 200);
      if (!allOk) return fail(id, notes);
      if (w1.status !== 200 || w2.status !== 200) return fail(id, notes);
      if (verify.body.scope !== `${origScope} (E2E28)` || final.body.scope !== origScope) return fail(id, notes + ' (SCOPE REVERT HỎNG)');
      // UI admin vẫn vào được /resources
      await login(page, ADMIN_EMAIL, ADMIN_PASS);
      await page.goto(`${WEB}/resources`, { waitUntil: 'networkidle' });
      await page.waitForSelector('[role="tablist"]', { timeout: 15000 });
      await snap(page, id + '-admin', 'Admin mở /resources (regression)');
      return ok(id, notes + '; admin UI /resources OK');
    })();

    // ============ tổng hợp ============
    const PASS = results.filter((r) => r.ok).length;
    const FAILN = results.filter((r) => !r.ok).length;
    fs.writeFileSync(EV, JSON.stringify({ results }, null, 2));
    console.log(`\n===== TỔNG: ${PASS} PASS / ${FAILN} FAIL / ${results.length} bước =====`);
    for (const r of results) if (!r.ok) console.log(`  FAIL ${r.id}: ${r.note}`);
    if (FAILN) process.exitCode = 1;
  } catch (err) {
    console.error('DRIVER ERROR', err && err.message ? err.message : err);
    process.exitCode = 1;
  } finally {
    await browser.close().catch(() => {});
  }
})();
