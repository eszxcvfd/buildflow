/**
 * PRJ-SRS-001 E2E driver — Tạo và cập nhật dự án (issue #32).
 * Evidence-only script; phạm vi docs/evidence — KHÔNG sửa source.
 *
 * Chuẩn hóa realistic 2026-09-08 (docs/demo-data.md): creds @vinacons.vn,
 * mã run VDA1-* (prefix Vinacons Dự Án 1), tên/địa chỉ tiếng Việt thực tế,
 * manager UUIDs giữ nguyên (111…=hoang.anh, 333…=thang.nguyen/Nguyễn Văn Thắng,
 * 444…=hau.le). Cleanup id-based (ids e2e-vars.json) + prefix + cửa sổ 12h.
 *
 * Chạy:   node e2e-driver-prj-001.cjs
 * Yêu cầu: stack rebuild từ working tree (api có prj POST/PATCH,
 *          web có /projects/new + /projects/[id]/edit);
 *          admin (E2EAdmin@2025) + pm (E2EPm@2025) + worker1 (E2EWorker@2025).
 *
 * Run-1 findings (đã mã hóa vào driver, không phải bug #32 — xem E2E §4a):
 *  - F1: sau POST redirect /projects, rows load async → phải đợi CODE text.
 *  - F2: worker bị 403 ở GET /workers (directory ADMIN+PM) → select manager
 *         chỉ còn placeholder → submit bị client chặn 'Quản lý...không được để trống',
 *         không request nào ra server. Đây là 403-UI thực tế của worker.
 *  - F3: POST thiếu property → Nest ValidationPipe trả 400 array-shape
 *         (không phải {fieldErrors}); client classify về field. Driver chấp nhận cả 2.
 *  - F4: PM tạo xong KHÔNG đọc được chính dự án đó (iam scope: list [] + detail 403)
 *         → S5 dùng PM PATCH qua API (write role-only, đúng scope #32) + UI edit 403
 *         được ghi nhận; detail verify qua ADMIN.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('/home/trung/.npm-global/lib/node_modules/@playwright/mcp/node_modules/playwright-core');

const WEB = 'http://localhost:3001';
const API = 'http://localhost:3000';
const SHOTS = path.join(__dirname, 'shots');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const ADMIN_EMAIL = 'hoang.anh@vinacons.vn';
const ADMIN_PASS = 'E2EAdmin@2025';
const PM_EMAIL = 'quoc.tran@vinacons.vn';
const PM_PASS = 'E2EPm@2025';
const WORKER_EMAIL = 'thang.nguyen@vinacons.vn';
const WORKER_PASS = 'E2EWorker@2025';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const PM_ID = '22222222-2222-4222-8222-222222222222';
const W1_ID = '33333333-3333-4333-8333-333333333333';
const W2_ID = '44444444-4444-4444-8444-444444444444';

const CODE_A = 'VDA1-A';
const CODE_PM = 'VDA1-PM';
const CODE_D = 'VDA1-D';
const CODE_D2 = 'VDA1-D2';
const CODE_C = 'VDA1-C';
const START = '2026-10-01';
const END = '2027-03-31';
// Pool tên realistic cho series phân trang S10 (giữ EXACT 21 items; filter theo prefix mã VDA1-PG).
const PG_NAMES = [
  'Khu dân cư An Bình - Giai đoạn 1', 'Khu dân cư An Bình - Giai đoạn 2',
  'Chung cư Phúc Đạt - Block B', 'Chung cư Phúc Đạt - Block C',
  'Nhà xưởng Tân Đông - Phân xưởng 1', 'Nhà xưởng Tân Đông - Phân xưởng 2',
  'Trường mầm non Họa Mi - Cơ sở 2', 'Trạm y tế phường Linh Xuân',
  'Chợ đầu mối Thủ Đức - Nhà lồng B', 'Bến xe Miền Đông mới - Giai đoạn 2',
  'Cầu vượt An Sương - Nhánh N2', 'Đường vành đai 3 - Đoạn Tân Vạn',
  'Kênh Tham Lương - Gói thầu 4', 'Hồ điều tiết Gò Dưa',
  'Nhà văn hóa quận 12', 'Sân vận động mini Hiệp Thành',
  'Trung tâm thương mại Gò Vấp', 'Siêu thị Co.op Bình Tân',
  'Khách sạn Hương Sen - Khối phụ', 'Resort nghỉ dưỡng Hồ Tràm - Villa 3',
  'Cao ốc văn phòng Thiên Sơn',
];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const results = [];
function step(id, name, fn) {
  return async () => {
    try {
      const r = await fn(id);
      results.push(r);
      console.log(`${r.ok ? 'PASS' : 'FAIL'} ${id} ${name}${r.note ? ' :: ' + String(r.note).split('\n')[0] : ''}`);
      if (!r.ok && r.note) console.log(`  detail: ${String(r.note).slice(0, 1500)}`);
      return r;
    } catch (err) {
      results.push({ id, name, ok: false, note: err && err.message ? err.message : String(err) });
      console.log(`ERROR ${id} ${name} :: ${err && err.message ? err.message : err}`);
      return results[results.length - 1];
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

async function loginWeb(page, email, password) {
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
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16));
}
async function projectIdByCode(adminToken, code) {
  const r = await api('GET', '/api/v1/projects?limit=100&offset=0', adminToken);
  const hit = (Array.isArray(r.body) ? r.body : []).find((p) => p.code === code);
  return hit ? hit.id : null;
}
function cleanupSQL() {
  return fs.readFileSync(path.join(__dirname, 'seed-001.sql'), 'utf8');
}
function runCleanup() {
  try {
    // Id-based: xóa sót lại của run trước theo ids đã ghi trong e2e-vars.json.
    try {
      const prev = JSON.parse(fs.readFileSync(path.join(__dirname, 'e2e-vars.json'), 'utf8'));
      const ids = prev && prev.projectIds ? Object.values(prev.projectIds).filter(Boolean) : [];
      for (const pid of ids) {
        execFileSync('docker', ['exec', 'buildflow-postgres-1', 'psql', '-U', 'buildflow', '-d', 'buildflow', '-c',
          `DELETE FROM project_members WHERE project_id='${pid}';` +
          `DELETE FROM attachments WHERE project_id='${pid}';` +
          `DELETE FROM project_areas WHERE project_id='${pid}';` +
          `DELETE FROM work_orders WHERE project_id='${pid}';` +
          `DELETE FROM projects WHERE id='${pid}';`],
        { encoding: 'utf8', timeout: 20000 });
      }
    } catch {}
    execFileSync('docker', ['exec', '-i', 'buildflow-postgres-1', 'psql', '-U', 'buildflow', '-d', 'buildflow', '-v', 'ON_ERROR_STOP=1'],
      { input: cleanupSQL(), encoding: 'utf8', timeout: 20000 });
  } catch (e) {
    console.log(`cleanup WARN ${(e.stderr || e.message || '').slice(0, 200)}`);
  }
}

/**
 * Điền form tạo dự án. Đợi trigger manager render (worker bị 403 pool →
 * không có option nào — trả về optionCount để caller phân nhánh).
 * Ark UI: đếm options trong content của chính trigger (aria-controls).
 */
async function fillCreateForm(page, { code, name, address, start, end, managerId, description }) {
  await page.goto(`${WEB}/projects/new`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#project-manager', { timeout: 20000 });
  const optionCount = await arkOptionCount(page, 'project-manager');
  if (code !== undefined) await page.fill('#project-code', code);
  if (name !== undefined) await page.fill('#project-name', name);
  if (address !== undefined) await page.fill('#project-address', address);
  if (start !== undefined) await page.fill('#project-start', start);
  if (end !== undefined) await page.fill('#project-end', end);
  if (managerId !== undefined && optionCount > 1) await arkSelectOption(page, 'project-manager', managerId);
  if (description !== undefined) await page.fill('#project-description', description);
  return optionCount;
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

  const adminToken = await getToken(ADMIN_EMAIL, ADMIN_PASS);
  const pmToken = await getToken(PM_EMAIL, PM_PASS);
  const workerToken = await getToken(WORKER_EMAIL, WORKER_PASS);
  if (!adminToken || !pmToken || !workerToken) {
    console.error(`Không lấy được token (admin=${!!adminToken} pm=${!!pmToken} worker=${!!workerToken})`);
    await browser.close().catch(() => {});
    process.exit(2);
  }

  runCleanup();
  const auditBaseline = psqlT('SELECT count(*) FROM audit_logs');
  console.log(`baseline: audit=${auditBaseline}`);

  const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pmCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const workerCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const adminPage = await adminCtx.newPage();
  const pmPage = await pmCtx.newPage();
  const workerPage = await workerCtx.newPage();
  for (const p of [adminPage, pmPage, workerPage]) p.setDefaultTimeout(30000);

  let idA = null;
  let idPM = null;

  try {
    // ============ S1: ADMIN tạo qua UI ============
    await step('S1', 'ADMIN tạo dự án qua /projects/new → detail DRAFT + psql + audit', async (id) => {
      await loginWeb(adminPage, ADMIN_EMAIL, ADMIN_PASS);
      const opts = await fillCreateForm(adminPage, {
        code: CODE_A, name: 'Trung tâm hội nghị Sông Hồng', address: 'Số 1, đường Sông Hồng, Hà Nội',
        start: START, end: END, managerId: W1_ID, description: 'Mô tả VDA1-A',
      });
      if (opts <= 1) return fail(id, `pool manager rỗng cho ADMIN (options=${opts})`);
      await adminPage.click('button[type="submit"]');
      await adminPage.waitForFunction(() => (document.body.textContent || '').includes('Tạo dự án thành công'), { timeout: 25000 });
      await snap(adminPage, `${id}-created`, 'Tạo dự án thành công (trước redirect)');
      await adminPage.waitForURL('**/projects', { timeout: 25000 });
      await adminPage.waitForFunction((code) => (document.body.textContent || '').includes(code), CODE_A, { timeout: 20000 });
      idA = await projectIdByCode(adminToken, CODE_A);
      if (!idA || !UUID_RE.test(idA)) return fail(id, `không tìm thấy ${CODE_A} qua API list`);
      await adminPage.goto(`${WEB}/projects/${idA}`, { waitUntil: 'networkidle' });
      await adminPage.waitForFunction(() => (document.body.textContent || '').includes('Trung tâm hội nghị Sông Hồng'), { timeout: 20000 });
      await adminPage.waitForFunction(() => (document.body.textContent || '').includes('Nguyễn Văn Thắng'), { timeout: 20000 });
      await snap(adminPage, `${id}-detail`, 'Detail sau tạo (DRAFT/Nháp + manager)');
      const t = await bodyText(adminPage);
      const miss = [CODE_A, 'Nháp'].filter((x) => !t.includes(x));
      if (miss.length) return fail(id, `detail thiếu: ${miss.join(' | ')}`);
      const row = psqlT(`SELECT code||'|'||name||'|'||address||'|'||manager_id||'|'||created_by||'|'||status||'|'||planned_start_date||'|'||planned_end_date FROM projects WHERE code='${CODE_A}'`);
      const want = `${CODE_A}|Trung tâm hội nghị Sông Hồng|Số 1, đường Sông Hồng, Hà Nội|${W1_ID}|${ADMIN_ID}|DRAFT|${START}|${END}`;
      if (row !== want) return fail(id, `psql row lệch:\n got: ${row}\nwant: ${want}`);
      const au = psqlT(`SELECT actor_user_id||'|'||action||'|'||entity_type FROM audit_logs WHERE entity_id='${idA}' AND action='PRJ_PROJECT_CREATED'`);
      if (au !== `${ADMIN_ID}|PRJ_PROJECT_CREATED|PROJECT`) return fail(id, `audit CREATED lệch: ${au}`);
      return ok(id, `detail đủ code/tên/Nháp/manager; psql đúng incl manager_id/created_by; audit PRJ_PROJECT_CREATED actor admin`);
    })();

    // ============ S2: PM tạo + worker fail-closed + anon 401 ============
    await step('S2', 'PM tạo OK; worker UI fail-closed (pool 403) + API 403; anon 401', async (id) => {
      await loginWeb(pmPage, PM_EMAIL, PM_PASS);
      await fillCreateForm(pmPage, {
        code: CODE_PM, name: 'Khu căn hộ Flora Anh Đào', address: 'Số 2, đường Anh Đào, Thủ Đức',
        start: START, end: END, managerId: W2_ID, description: 'Mô tả VDA1-PM',
      });
      await pmPage.click('button[type="submit"]');
      await pmPage.waitForFunction(() => (document.body.textContent || '').includes('Tạo dự án thành công'), { timeout: 25000 });
      await pmPage.waitForURL('**/projects', { timeout: 25000 });
      idPM = await projectIdByCode(adminToken, CODE_PM);
      if (!idPM) return fail(id, `PM tạo ${CODE_PM} nhưng API list không thấy`);
      const auPM = psqlT(`SELECT actor_user_id FROM audit_logs WHERE entity_id='${idPM}' AND action='PRJ_PROJECT_CREATED'`);
      if (auPM !== PM_ID) return fail(id, `audit PM lệch actor: ${auPM}`);
      await snap(pmPage, `${id}-pm-created`, 'PM tạo dự án thành công');
      // Worker qua UI: pool manager 403 → select chỉ còn placeholder.
      await loginWeb(workerPage, WORKER_EMAIL, WORKER_PASS);
      let workersStatus = null;
      let postCount = 0;
      const onResp = (res) => {
        if (res.url().includes('/api/v1/workers') && res.request().method() === 'GET') workersStatus = res.status();
        if (res.url().includes('/api/v1/projects') && res.request().method() === 'POST') postCount += 1;
      };
      workerPage.on('response', onResp);
      const wOpts = await fillCreateForm(workerPage, {
        code: 'VDA1-WX', name: 'Khu nhà ở công nhân', address: 'Số 9, đường Công Nhân, Bình Dương',
        start: START, end: END, managerId: W1_ID,
      });
      await workerPage.click('button[type="submit"]');
      await workerPage.waitForFunction(() => (document.body.textContent || '').includes('Quản lý dự án không được để trống'), { timeout: 20000 });
      await snap(workerPage, `${id}-worker-blocked`, 'Worker fail-closed ở /projects/new (pool 403, không submit)');
      workerPage.off('response', onResp);
      const wxCount = psqlT(`SELECT count(*) FROM projects WHERE code='VDA1-WX'`);
      const wPost = await api('POST', '/api/v1/projects', workerToken,
        { code: 'VDA1-WY', name: 'X', address: 'Y', plannedStartDate: START, plannedEndDate: END, managerId: W1_ID });
      const anonPost = await api('POST', '/api/v1/projects', null,
        { code: 'VDA1-WZ', name: 'X', address: 'Y', plannedStartDate: START, plannedEndDate: END, managerId: W1_ID });
      if (wOpts !== 1) return fail(id, `worker options=${wOpts} (mong 1 placeholder — pool phải 403)`);
      if (workersStatus !== 403) return fail(id, `GET /workers worker status=${workersStatus} (mong 403)`);
      if (postCount !== 0) return fail(id, `worker UI gửi ${postCount} POST (mong 0 — client chặn)`);
      if (wxCount !== '0') return fail(id, `worker UI submit lọt row VDA1-WX (count=${wxCount})`);
      if (wPost.status !== 403) return fail(id, `worker API POST status=${wPost.status} (mong 403) ${JSON.stringify(wPost.body).slice(0, 200)}`);
      if (anonPost.status !== 401) return fail(id, `anon API POST status=${anonPost.status} (mong 401) ${JSON.stringify(anonPost.body).slice(0, 200)}`);
      return ok(id, `PM tạo ${CODE_PM} (audit actor pm); worker pool 403→1 option→client chặn, 0 POST; API worker 403, anon 401`);
    })();

    // ============ S3: trùng mã khác hoa/thường ============
    await step('S3', 'Tạo trùng mã khác case → 409 tại field code, giữ form, 1 row', async (id) => {
      await fillCreateForm(adminPage, {
        code: 'vda1-a', name: 'Tên khác', address: 'Địa chỉ khác',
        start: START, end: END, managerId: W1_ID,
      });
      await adminPage.click('button[type="submit"]');
      await adminPage.waitForFunction(() => (document.body.textContent || '').includes('đã tồn tại'), { timeout: 20000 });
      await snap(adminPage, `${id}-duplicate`, 'Trùng mã khác case → 409 field code');
      const codeVal = await adminPage.inputValue('#project-code');
      const nameVal = await adminPage.inputValue('#project-name');
      const addrVal = await adminPage.inputValue('#project-address');
      const cnt = psqlT(`SELECT count(*) FROM projects WHERE lower(code)=lower('${CODE_A}')`);
      if (codeVal !== 'vda1-a') return fail(id, `form không giữ code (got '${codeVal}')`);
      if (nameVal !== 'Tên khác') return fail(id, `form không giữ name (got '${nameVal}')`);
      if (addrVal !== 'Địa chỉ khác') return fail(id, `form không giữ address (got '${addrVal}')`);
      if (cnt !== '1') return fail(id, `số row lower(code)='vda1-a' = ${cnt} (mong 1)`);
      return ok(id, `409 'đã tồn tại' tại field code; form giữ nguyên code/name/address; count lower(code)=1`);
    })();

    // ============ S4: validation ============
    await step('S4', 'Thiếu field + end<start → field errors client+server, không row', async (id) => {
      await adminPage.goto(`${WEB}/projects/new`, { waitUntil: 'networkidle' });
      await adminPage.waitForSelector('#project-manager', { timeout: 20000 });
      await adminPage.click('button[type="submit"]');
      await adminPage.waitForFunction(
        () => document.querySelectorAll('.bf-field-error').length > 0, { timeout: 20000 });
      const t0 = await bodyText(adminPage);
      const miss0 = ['Tên dự án không được để trống', 'Địa chỉ dự án không được để trống',
        'Ngày bắt đầu kế hoạch không được để trống', 'Quản lý dự án không được để trống']
        .filter((x) => !t0.includes(x));
      if (miss0.length) return fail(id, `thiếu field errors client: ${miss0.join(' | ')}`);
      await snap(adminPage, `${id}-required`, 'Submit rỗng → field errors');
      await adminPage.fill('#project-code', 'VDA1-V');
      await adminPage.fill('#project-name', 'Công trình kiểm thử xác thực');
      await adminPage.fill('#project-address', 'Số 5, đường Kiểm Định, Hà Nội');
      await adminPage.fill('#project-start', '2027-06-01');
      await adminPage.fill('#project-end', '2026-06-01');
      await arkSelectOption(adminPage, 'project-manager', W1_ID);
      await adminPage.click('button[type="submit"]');
      await adminPage.waitForFunction(
        () => (document.body.textContent || '').includes('Ngày kết thúc kế hoạch phải từ ngày bắt đầu trở đi'),
        { timeout: 20000 });
      await snap(adminPage, `${id}-daterange`, 'end<start → lỗi plannedEndDate');
      const noName = await api('POST', '/api/v1/projects', adminToken,
        { code: 'VDA1-V', address: 'A', plannedStartDate: START, plannedEndDate: END, managerId: W1_ID });
      const badRange = await api('POST', '/api/v1/projects', adminToken,
        { code: 'VDA1-V', name: 'N', address: 'A', plannedStartDate: '2027-06-01', plannedEndDate: '2026-06-01', managerId: W1_ID });
      const cnt = psqlT(`SELECT count(*) FROM projects WHERE code='VDA1-V'`);
      const noNameOk = noName.status === 400 && (
        (noName.body.fieldErrors && noName.body.fieldErrors.name) ||
        (Array.isArray(noName.body.message) && noName.body.message.join(' ').match(/tên dự án|name/i)));
      if (!noNameOk) return fail(id, `thiếu name: status=${noName.status} ${JSON.stringify(noName.body).slice(0, 300)}`);
      if (badRange.status !== 400 || !(badRange.body.fieldErrors && badRange.body.fieldErrors.plannedEndDate)) {
        return fail(id, `end<start: status=${badRange.status} ${JSON.stringify(badRange.body).slice(0, 300)}`);
      }
      if (cnt !== '0') return fail(id, `lọt row VDA1-V (count=${cnt})`);
      const arrayShape = Array.isArray(noName.body.message);
      return ok(id, `client đủ 4 required + end<start; server 400 name (${arrayShape ? 'array-shape' : 'fieldErrors'}) + plannedEndDate; count VDA1-V=0`);
    })();

    // ============ S5: PM PATCH qua API + UI edit 403 (iam scope) ============
    await step('S5', 'PM PATCH name/address/manager → psql + audit before/after; UI edit 403 scope', async (id) => {
      const up = await api('PATCH', `/api/v1/projects/${idPM}`, pmToken,
        { name: 'Khu căn hộ Flora Anh Đào (mở rộng)', address: 'Số 2 mới, đường Anh Đào, Thủ Đức', managerId: W1_ID });
      if (up.status !== 200) return fail(id, `PM PATCH status=${up.status} ${JSON.stringify(up.body).slice(0, 300)}`);
      if (up.body.updatedBy !== PM_ID) return fail(id, `updatedBy=${up.body.updatedBy} (mong ${PM_ID})`);
      if (up.body.managerId !== W1_ID || up.body.name !== 'Khu căn hộ Flora Anh Đào (mở rộng)') {
        return fail(id, `response PATCH lệch: ${JSON.stringify(up.body).slice(0, 300)}`);
      }
      // PM mở UI edit/detail → 403 iam scope (ghi nhận, xem §4a F4).
      await pmPage.goto(`${WEB}/projects/${idPM}/edit`, { waitUntil: 'networkidle' });
      await pmPage.waitForFunction(() => (document.body.textContent || '').includes('Không có quyền'), { timeout: 20000 });
      await snap(pmPage, `${id}-pm-edit-403`, 'PM mở UI edit → 403 iam scope');
      // ADMIN detail phản ánh tên mới.
      await adminPage.goto(`${WEB}/projects/${idPM}`, { waitUntil: 'networkidle' });
      await adminPage.waitForFunction(() => (document.body.textContent || '').includes('Khu căn hộ Flora Anh Đào (mở rộng)'), { timeout: 20000 });
      await snap(adminPage, `${id}-updated`, 'ADMIN detail thấy tên mới sau PM PATCH');
      const patchCode = await api('PATCH', `/api/v1/projects/${idPM}`, pmToken, { code: 'VDA1-NEW' });
      const row = psqlT(`SELECT name||'|'||address||'|'||manager_id||'|'||status FROM projects WHERE id='${idPM}'`);
      const wantRow = `Khu căn hộ Flora Anh Đào (mở rộng)|Số 2 mới, đường Anh Đào, Thủ Đức|${W1_ID}|DRAFT`;
      const au = psqlT(`SELECT actor_user_id||'|'||action FROM audit_logs WHERE entity_id='${idPM}' AND action='PRJ_PROJECT_UPDATED'`);
      const auJson = psqlT(`SELECT (before_data IS NOT NULL AND after_data IS NOT NULL AND before_data ? 'name' AND after_data ? 'name') FROM audit_logs WHERE entity_id='${idPM}' AND action='PRJ_PROJECT_UPDATED'`);
      if (row !== wantRow) return fail(id, `psql row lệch:\n got: ${row}\nwant: ${wantRow}`);
      if (au !== `${PM_ID}|PRJ_PROJECT_UPDATED`) return fail(id, `audit UPDATED lệch: ${au}`);
      if (auJson !== 't') return fail(id, `audit before/after thiếu name (got ${auJson})`);
      if (patchCode.status !== 400 || !(patchCode.body.fieldErrors && patchCode.body.fieldErrors.code)) {
        return fail(id, `PATCH code: status=${patchCode.status} ${JSON.stringify(patchCode.body).slice(0, 300)}`);
      }
      return ok(id, `PM PATCH 200 updatedBy=pm; ADMIN detail tên mới; psql + audit UPDATED actor pm before/after name; PATCH code 400; UI edit PM 403 scope`);
    })();

    // ============ S6: PATCH status 400 ============
    await step('S6', 'PATCH status ACTIVE → 400 fieldErrors; status vẫn DRAFT', async (id) => {
      const r = await api('PATCH', `/api/v1/projects/${idA}`, adminToken, { status: 'ACTIVE' });
      const st = psqlT(`SELECT status FROM projects WHERE id='${idA}'`);
      if (r.status !== 400 || !(r.body.fieldErrors && r.body.fieldErrors.status)) {
        return fail(id, `PATCH status: status=${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
      }
      if (st !== 'DRAFT') return fail(id, `status bị đổi thành ${st}`);
      return ok(id, `400 fieldErrors.status; psql status=DRAFT`);
    })();

    // ============ S7: manager INACTIVE ============
    await step('S7', 'Manager INACTIVE → create/PATCH 400 managerId; restore ACTIVE', async (id) => {
      psqlT(`UPDATE users SET status='INACTIVE' WHERE id='${W2_ID}'`);
      const chk = psqlT(`SELECT status FROM users WHERE id='${W2_ID}'`);
      if (chk !== 'INACTIVE') return fail(id, `toggle INACTIVE thất bại (got ${chk})`);
      const c = await api('POST', '/api/v1/projects', adminToken,
        { code: 'VDA1-IN', name: 'N', address: 'A', plannedStartDate: START, plannedEndDate: END, managerId: W2_ID });
      const p = await api('PATCH', `/api/v1/projects/${idA}`, adminToken, { managerId: W2_ID });
      psqlT(`UPDATE users SET status='ACTIVE' WHERE id='${W2_ID}'`);
      const restored = psqlT(`SELECT status FROM users WHERE id='${W2_ID}'`);
      const cnt = psqlT(`SELECT count(*) FROM projects WHERE code='VDA1-IN'`);
      if (c.status !== 400 || !(c.body.fieldErrors && c.body.fieldErrors.managerId)) {
        return fail(id, `create manager INACTIVE: status=${c.status} ${JSON.stringify(c.body).slice(0, 300)}`);
      }
      if (p.status !== 400 || !(p.body.fieldErrors && p.body.fieldErrors.managerId)) {
        return fail(id, `PATCH manager INACTIVE: status=${p.status} ${JSON.stringify(p.body).slice(0, 300)}`);
      }
      if (restored !== 'ACTIVE') return fail(id, `restore ACTIVE thất bại (got ${restored})`);
      if (cnt !== '0') return fail(id, `lọt row VDA1-IN (count=${cnt})`);
      return ok(id, `create + PATCH manager INACTIVE → 400 managerId; worker2 đã restore ACTIVE; count VDA1-IN=0`);
    })();

    // ============ S8: worker PATCH 403 + GET scope ============
    await step('S8', 'Worker PATCH 403; GET list/detail theo iam scope (ghi nhận thực tế)', async (id) => {
      const wPatch = await api('PATCH', `/api/v1/projects/${idA}`, workerToken, { name: 'Hack' });
      const wList = await api('GET', '/api/v1/projects?limit=100&offset=0', workerToken);
      const wGet = await api('GET', `/api/v1/projects/${idA}`, workerToken);
      const row = psqlT(`SELECT name FROM projects WHERE id='${idA}'`);
      await workerPage.goto(`${WEB}/projects`, { waitUntil: 'networkidle' });
      await workerPage.waitForFunction(
        () => /dự án|Dự án/.test(document.body.textContent || ''),
        { timeout: 20000 });
      await snap(workerPage, `${id}-worker-list`, 'Worker xem /projects (scoped)');
      const wt = await bodyText(workerPage);
      const wRows = Array.isArray(wList.body) ? wList.body.length : -1;
      const wSeesA = Array.isArray(wList.body) && wList.body.some((p) => p.code === CODE_A);
      const note = `PATCH=${wPatch.status}; name sau PATCH='${row}'; ` +
        `GET list=${wList.status} rows=${wRows} thấy VDA1-A=${wSeesA}; ` +
        `GET detail=${wGet.status}; UI worker: ${wt.includes('Bạn chưa là thành viên dự án nào') ? 'empty-scope' : wt.includes('Không có quyền') ? '403' : 'có rows'}`;
      if (wPatch.status !== 403) return fail(id, `worker PATCH status=${wPatch.status} (mong 403); ${note}`);
      if (row !== 'Trung tâm hội nghị Sông Hồng') return fail(id, `worker PATCH đổi được name! ${note}`);
      if (![200, 403, 404].includes(wList.status) || ![200, 403, 404].includes(wGet.status)) {
        return fail(id, `GET scope status lạ; ${note}`);
      }
      return ok(id, note);
    })();

    // ============ S9: double-submit ============
    await step('S9', 'Double-submit: UI disable khi bay + concurrent POST → 1 row (409)', async (id) => {
      await adminPage.goto(`${WEB}/projects/new`, { waitUntil: 'networkidle' });
      await adminPage.waitForSelector('#project-manager', { timeout: 20000 });
      let delayedOnce = false;
      await adminPage.route('**/api/v1/projects', async (route) => {
        const req = route.request();
        if (req.method() === 'POST' && !delayedOnce) {
          delayedOnce = true;
          await new Promise((res) => setTimeout(res, 1500));
        }
        await route.continue();
      });
      await adminPage.fill('#project-code', CODE_D);
      await adminPage.fill('#project-name', 'Nhà máy dệt An Phát');
      await adminPage.fill('#project-address', 'Số 3, KCN Tân Bình, TP.HCM');
      await adminPage.fill('#project-start', START);
      await adminPage.fill('#project-end', END);
      await arkSelectOption(adminPage, 'project-manager', W1_ID);
      const clickP = adminPage.click('button[type="submit"]');
      await new Promise((res) => setTimeout(res, 700));
      const btnState = await adminPage.evaluate(() => {
        const b = document.querySelector('button[type="submit"]');
        return b ? { disabled: b.disabled, busy: b.getAttribute('aria-busy'), text: (b.textContent || '').slice(0, 60) } : null;
      });
      await clickP;
      await adminPage.waitForFunction(() => (document.body.textContent || '').includes('Tạo dự án thành công'), { timeout: 25000 });
      await adminPage.unroute('**/api/v1/projects').catch(() => {});
      await snap(adminPage, `${id}-created`, 'Tạo VDA1-D (nút disable khi bay)');
      const payload = { code: CODE_D2, name: 'Trường liên cấp Sao Mai', address: 'Số 4, đường Sao Mai, Gò Vấp', plannedStartDate: START, plannedEndDate: END, managerId: W1_ID };
      const [r1, r2] = await Promise.all([
        api('POST', '/api/v1/projects', adminToken, payload),
        api('POST', '/api/v1/projects', adminToken, payload),
      ]);
      const statuses = [r1.status, r2.status].sort().join(',');
      const cntD = psqlT(`SELECT count(*) FROM projects WHERE lower(code)=lower('${CODE_D}')`);
      const cntD2 = psqlT(`SELECT count(*) FROM projects WHERE lower(code)=lower('${CODE_D2}')`);
      const dup409 = (r1.status === 409 && r1.body.code === 'PROJECT_CODE_DUPLICATE') || (r2.status === 409 && r2.body.code === 'PROJECT_CODE_DUPLICATE');
      if (!btnState || (btnState.disabled !== true && btnState.busy !== 'true')) {
        return fail(id, `nút submit không disable khi bay: ${JSON.stringify(btnState)}`);
      }
      if (cntD !== '1') return fail(id, `VDA1-D count=${cntD} (mong 1)`);
      if (statuses !== '201,409' || !dup409) {
        return fail(id, `concurrent POST statuses=${statuses} (mong 201,409 PROJECT_CODE_DUPLICATE); count D2=${cntD2}`);
      }
      if (cntD2 !== '1') return fail(id, `VDA1-D2 count=${cntD2} (mong 1)`);
      return ok(id, `UI disable khi bay ${JSON.stringify(btnState)}; concurrent 201+409 PROJECT_CODE_DUPLICATE; counts D=1 D2=1`);
    })();

    // ============ S10: list/search/filter/pagination/row link ============
    await step('S10', 'List: search + filter status + phân trang + row link; worker scoped', async (id) => {
      for (let i = 1; i <= 21; i += 1) {
        const code = `VDA1-PG-${String(i).padStart(2, '0')}`;
        const r = await api('POST', '/api/v1/projects', adminToken,
          { code, name: PG_NAMES[i - 1], address: `Số ${i}, đường Vườn Lài, Quận 12`, plannedStartDate: START, plannedEndDate: END, managerId: W1_ID });
        if (r.status !== 201) return fail(id, `seed PG ${code} status=${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
      }
      await adminPage.goto(`${WEB}/projects`, { waitUntil: 'networkidle' });
      await adminPage.waitForFunction(() => (document.body.textContent || '').includes('Tổng'), { timeout: 20000 });
      await adminPage.fill('#projects-search', 'VDA1-PG');
      await adminPage.waitForFunction(() => (document.body.textContent || '').includes('Tổng 21 dự án'), { timeout: 20000 });
      const pg1 = await bodyText(adminPage);
      if (!pg1.includes('Trang 1/2')) return fail(id, `phân trang sai với 21 rows: ${pg1.slice(-200)}`);
      await snap(adminPage, `${id}-search-page1`, 'Search VDA1-PG trang 1/2');
      await adminPage.locator('button', { hasText: 'Sau' }).click();
      await adminPage.waitForFunction(() => (document.body.textContent || '').includes('Trang 2/2'), { timeout: 20000 });
      await adminPage.locator('button', { hasText: 'Trước' }).click();
      await adminPage.waitForFunction(() => (document.body.textContent || '').includes('Trang 1/2'), { timeout: 20000 });
      await arkSelectOption(adminPage, 'projects-status', 'ACTIVE');
      await adminPage.waitForFunction(() => (document.body.textContent || '').includes('Không có dự án nào phù hợp'), { timeout: 20000 });
      await arkSelectOption(adminPage, 'projects-status', 'DRAFT');
      await adminPage.waitForFunction(() => (document.body.textContent || '').includes('Tổng 21 dự án'), { timeout: 20000 });
      await arkSelectOption(adminPage, 'projects-status', 'ALL');
      await adminPage.fill('#projects-search', CODE_A);
      await adminPage.waitForFunction(() => (document.body.textContent || '').includes('Trung tâm hội nghị Sông Hồng'), { timeout: 20000 });
      await snap(adminPage, `${id}-filter`, 'Search VDA1-A + filter ALL');
      const rowLink = adminPage.locator('.bf-table a[href^="/projects/"]').first();
      const href = await rowLink.getAttribute('href');
      if (!href || !href.startsWith(`/projects/${idA}`)) return fail(id, `row link sai: ${href} (mong /projects/${idA})`);
      await Promise.all([
        adminPage.waitForURL(`**/projects/${idA}`, { timeout: 25000 }),
        rowLink.click(),
      ]);
      await workerPage.goto(`${WEB}/projects`, { waitUntil: 'networkidle' });
      await workerPage.waitForFunction(
        () => /dự án|Dự án/.test(document.body.textContent || ''),
        { timeout: 20000 });
      const wt = await bodyText(workerPage);
      await snap(workerPage, `${id}-worker-scoped`, 'Worker list scoped');
      const noCTA = !wt.includes('Tạo dự án');
      return ok(id, `search PG→Tổng 21 + Trang 1/2↔2/2; ACTIVE→rỗng, DRAFT→21; row link ${href}; worker scoped (empty=${wt.includes('Bạn chưa là thành viên')}, CTA tạo ẩn=${noCTA})`);
    })();

    // ============ S11: correlation ============
    await step('S11', 'X-Correlation-Id: audit carry + invalid 400 + echo thực tế', async (id) => {
      const corr1 = uuid();
      const corr2 = uuid();
      const c = await api('POST', '/api/v1/projects', adminToken,
        { code: CODE_C, name: 'Nhà hát giao hưởng Mặt Trời', address: 'Số 6, đường Mặt Trời, Quận 7', plannedStartDate: START, plannedEndDate: END, managerId: W1_ID },
        { 'X-Correlation-Id': corr1 });
      if (c.status !== 201) return fail(id, `POST corr status=${c.status} ${JSON.stringify(c.body).slice(0, 200)}`);
      const idC = c.body.id;
      const echoPost = c.headers.get('x-correlation-id');
      const auC = psqlT(`SELECT correlation_id FROM audit_logs WHERE entity_id='${idC}' AND action='PRJ_PROJECT_CREATED'`);
      const p = await api('PATCH', `/api/v1/projects/${idC}`, adminToken, { description: 'S11 patch' }, { 'X-Correlation-Id': corr2 });
      const echoPatch = p.headers.get('x-correlation-id');
      const auP = psqlT(`SELECT correlation_id FROM audit_logs WHERE entity_id='${idC}' AND action='PRJ_PROJECT_UPDATED'`);
      const bad = await api('POST', '/api/v1/projects', adminToken,
        { code: 'VDA1-CB', name: 'N', address: 'A', plannedStartDate: START, plannedEndDate: END, managerId: W1_ID },
        { 'X-Correlation-Id': 'not-a-uuid' });
      const cntBad = psqlT(`SELECT count(*) FROM projects WHERE code='VDA1-CB'`);
      if (auC !== corr1) return fail(id, `audit CREATED corr=${auC} (mong ${corr1})`);
      if (auP !== corr2) return fail(id, `audit UPDATED corr=${auP} (mong ${corr2})`);
      if (bad.status !== 400) return fail(id, `corr xấu status=${bad.status} (mong 400 strict)`);
      if (cntBad !== '0') return fail(id, `corr xấu lọt row (count=${cntBad})`);
      return ok(id, `audit CREATED corr=${corr1} UPDATED corr=${corr2}; echo header POST=${echoPost} PATCH=${echoPatch}; corr xấu 400, không row`);
    })();
  } finally {
    runCleanup();
    const rest = psqlT(`SELECT count(*) FROM projects WHERE code LIKE 'VDA1-%'`);
    const auditFinal = psqlT('SELECT count(*) FROM audit_logs');
    console.log(`cleanup: VDA1-% rest=${rest}, audit ${auditBaseline}→${auditFinal} (tăng do tạo/sửa entity là hợp lệ; audit giữ nguyên)`);
    fs.writeFileSync(path.join(__dirname, 'e2e-vars.json'), JSON.stringify({
      _note: 'Throwaway E2E-only demo credentials (seed/reset per evidence docs). Never production.',
      admin: ADMIN_EMAIL, pm: PM_EMAIL, worker: WORKER_EMAIL,
      codes: { A: CODE_A, PM: CODE_PM, D: CODE_D, D2: CODE_D2, C: CODE_C },
      projectIds: { A: idA, PM: idPM },
      auditBaseline, auditFinal, rest, results,
    }, null, 2));
    const passed = results.filter((r) => r.ok).length;
    console.log(`\nTỔNG: ${passed}/${results.length} PASS`);
    await browser.close().catch(() => {});
    process.exit(passed === results.length ? 0 : 1);
  }
})();
