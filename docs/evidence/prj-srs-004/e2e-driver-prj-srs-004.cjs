/**
 * PRJ-SRS-004 E2E driver — Loại công việc /work-types (issue #35).
 * Evidence-only script; phạm vi docs/evidence — KHÔNG sửa source.
 *
 * Pattern theo prj-srs-003 (playwright-core absolute path, Chrome headless),
 * creds @vinacons.vn, dữ liệu realistic (ADR-0003 — không E2E%/test% trong
 * dữ liệu hiển thị; uniqueness bằng mã suffix tự nhiên).
 *
 * Chạy:   node e2e-driver-prj-srs-004.cjs
 * Yêu cầu: stack từ working tree (api có /api/v1/work-types + migration 0007;
 *          web có /work-types + /work-types/:id); admin hoang.anh@vinacons.vn.
 *
 * Seed (seed-prj-srs-004.sql, fixed UUID, KHÔNG xóa): WT-SON-NUOC, WT-DIEN,
 * WT-OP-LAT (ACTIVE) + WT-BE-TONG-TC (setup DEACTIVATE qua API để có audit
 * lịch sử thật). Driver tạo WT-OP-LAT-TUONG + trade tạm THO-DA, cleanup cuối
 * run theo id + fallback created_at (không xóa seed). Audit giữ nguyên.
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
const ADMIN_PASS = process.env.E2E_ADMIN_PASS ?? 'E2EAdmin@2025';
const ADMIN_ID = '11111111-1111-4111-8111-111111111111';

const SEED = {
  SON: { id: 'a1b2c3d4-0001-4000-8000-000000000001', code: 'WT-SON-NUOC', name: 'Thi công sơn nước' },
  DIEN: { id: 'a1b2c3d4-0002-4000-8000-000000000002', code: 'WT-DIEN', name: 'Lắp đặt điện' },
  OPLAT: { id: 'a1b2c3d4-0003-4000-8000-000000000003', code: 'WT-OP-LAT', name: 'Thi công ốp lát' },
  BETONG: { id: 'a1b2c3d4-0004-4000-8000-000000000004', code: 'WT-BE-TONG-TC', name: 'Đổ bê tông thủ công' },
};
const SEED_IDS = Object.values(SEED).map((s) => s.id);

const NEW_CODE = 'WT-OP-LAT-TUONG';
const NEW_NAME = 'Thi công ốp lát tường';
const NEW_GROUP = 'Hoàn thiện';

const TEMP_TRADE_CODE = 'THO-DA';
const TEMP_TRADE_NAME = 'Thợ đá hoa cương';

const results = [];
function step(id, name, fn) {
  return async () => {
    try {
      const r = await fn(id);
      results.push(r);
      console.log(`${r.ok ? 'PASS' : 'FAIL'} ${id} ${name}${r.note ? ' :: ' + String(r.note).split('\n')[0] : ''}`);
      if (!r.ok && r.note) console.log(`  detail: ${String(r.note).slice(0, 2000)}`);
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

async function api(method, urlPath, token, body) {
  const headers = { Accept: 'application/json', 'X-Correlation-Id': uuid() };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${urlPath}`, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, body: json };
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
 * Scope mọi tương tác form vào `.bf-dialog`: id="worktype-group" tồn tại 2 lần
 * trong DOM khi dialog mở (WorkTypesList filter #worktype-group + WorkTypeForm
 * #worktype-group) — selector document-wide sẽ strict-violation hoặc chạm nhầm
 * filter sau lưng. Nút "Thêm trường dữ liệu" click force (bypass stability
 * check — form re-render khi trades load xong).
 */
function dlg(page) {
  return page.locator('.bf-dialog');
}
async function dlgFill(page, selector, value) {
  await dlg(page).locator(selector).fill(value);
}
async function dlgSelect(page, selector, value) {
  await dlg(page).locator(selector).selectOption(value);
}
async function dlgAddFieldRow(page, n) {
  await dlg(page).getByRole('button', { name: 'Thêm trường dữ liệu', exact: true }).click({ force: true });
  await dlg(page).locator(`#worktype-field-key-${n}`).waitFor({ timeout: 15000 });
}
async function waitTradeOptions(page) {
  // Đợi select ngành nghề load xong (tránh rerender setTrades giữa chừng).
  await page.waitForFunction(
    () => document.querySelectorAll('#worktype-trade option').length > 1,
    { timeout: 20000 });
}
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16));
}
function runCleanup(prevIds) {
  try {
    // Id-based: xóa bản ghi driver tạo ở run trước (không xóa seed).
    for (const pid of (prevIds || []).filter(Boolean)) {
      execFileSync('docker', ['exec', 'buildflow-postgres-1', 'psql', '-U', 'buildflow', '-d', 'buildflow', '-c',
        `DELETE FROM work_types WHERE id='${pid}';`],
      { encoding: 'utf8', timeout: 20000 });
    }
    // Fallback cửa sổ 12h: chỉ các row KHÔNG thuộc seed (tránh sót khi vars mất).
    execFileSync('docker', ['exec', 'buildflow-postgres-1', 'psql', '-U', 'buildflow', '-d', 'buildflow', '-c',
      `DELETE FROM work_types WHERE created_at > now() - interval '12 hours' AND id NOT IN (${SEED_IDS.map((s) => `'${s}'`).join(',')}) AND code IN ('${NEW_CODE}');` +
      `DELETE FROM trades WHERE created_at > now() - interval '12 hours' AND code IN ('${TEMP_TRADE_CODE}');`],
    { encoding: 'utf8', timeout: 20000 });
    // Seed re-runnable (ON CONFLICT DO NOTHING — giữ trạng thái hiện có).
    const sql = fs.readFileSync(path.join(__dirname, 'seed-prj-srs-004.sql'), 'utf8');
    execFileSync('docker', ['exec', '-i', 'buildflow-postgres-1', 'psql', '-U', 'buildflow', '-d', 'buildflow', '-v', 'ON_ERROR_STOP=1'],
      { input: sql, encoding: 'utf8', timeout: 20000 });
  } catch (e) {
    console.log(`cleanup WARN ${(e.stderr || e.message || '').slice(0, 200)}`);
  }
}
async function gotoList(page) {
  await page.goto(`${WEB}/work-types`, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    () => !(document.body.textContent || '').includes('Đang tải danh sách loại công việc…'),
    { timeout: 25000 });
}
async function gotoDetail(page, id) {
  await page.goto(`${WEB}/work-types/${id}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    () => !(document.body.textContent || '').includes('Đang tải chi tiết loại công việc…'),
    { timeout: 25000 });
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
  if (!adminToken) {
    console.error('Không lấy được admin token');
    await browser.close().catch(() => {});
    process.exit(2);
  }

  let prevIds = [];
  try {
    const prev = JSON.parse(fs.readFileSync(path.join(__dirname, 'e2e-vars.json'), 'utf8'));
    if (prev && Array.isArray(prev.createdIds)) prevIds = prev.createdIds;
    if (prev && prev.tempTradeId) prevIds.push(prev.tempTradeId);
  } catch {}
  runCleanup(prevIds);
  const auditBaseline = psqlT('SELECT count(*) FROM audit_logs');
  console.log(`baseline: audit=${auditBaseline}`);

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);

  let newId = null;
  let tempTradeId = null;
  let oplatsTradeId = null;

  try {
    // ============ Setup: trade OP-LAT id + seed BETONG inactive có lịch sử ============
    const tr = await api('GET', '/api/v1/trades?status=ACTIVE&limit=100', adminToken);
    const opl = (tr.body && tr.body.data ? tr.body.data : []).find((t) => t.code === 'OP-LAT');
    if (!opl) throw new Error('thiếu trade OP-LAT ACTIVE cho S1');
    oplatsTradeId = opl.id;

    const s4 = await api('GET', `/api/v1/work-types/${SEED.BETONG.id}`, adminToken);
    if (s4.status !== 200) throw new Error(`seed BETONG GET status=${s4.status}`);
    if (s4.body.status === 'ACTIVE') {
      const d = await api('POST', `/api/v1/work-types/${SEED.BETONG.id}/status`, adminToken,
        { action: 'DEACTIVATE', reason: 'Kết thúc biện pháp thi công thủ công, chuyển sang bê tông thương phẩm (đợt T9/2026)' });
      if (d.status !== 200) throw new Error(`seed BETONG deactivate status=${d.status}`);
      console.log('setup: BETONG ACTIVE→INACTIVE qua API (tạo audit lịch sử thật)');
    } else {
      console.log('setup: BETONG đã INACTIVE từ run trước (giữ nguyên)');
    }
    const auSeed = psqlT(`SELECT count(*) FROM audit_logs WHERE entity_id='${SEED.BETONG.id}' AND action='PRJ_WORK_TYPE_STATUS_CHANGED'`);
    console.log(`setup: BETONG audit STATUS_CHANGED rows=${auSeed}`);

    // ============ S1: mở /work-types thấy seed + tạo mới qua Dialog ============
    await step('S1', 'Mở /work-types thấy seed + tạo loại mới qua Dialog → list + toast', async (id) => {
      await loginWeb(page, ADMIN_EMAIL, ADMIN_PASS);
      await gotoList(page);
      let t = await bodyText(page);
      if (!t.includes(SEED.SON.name)) return fail(id, 'list thiếu seed Thi công sơn nước');
      await page.getByRole('button', { name: 'Thêm mới', exact: true }).click();
      await page.waitForFunction(
        () => (document.body.textContent || '').includes('Thêm loại công việc'),
        { timeout: 15000 });
      await dlgFill(page, '#worktype-code', NEW_CODE);
      await dlgFill(page, '#worktype-name', NEW_NAME);
      await waitTradeOptions(page);
      await dlgFill(page, '#worktype-group', NEW_GROUP);
      await dlgSelect(page, '#worktype-trade', oplatsTradeId);
      await dlgFill(page, '#worktype-description', 'Ốp lát gạch men tường khu vệ sinh theo bản vẽ KT-VS');
      await dlgAddFieldRow(page, 0);
      await dlgFill(page, '#worktype-field-key-0', 'dien_tich');
      await dlgFill(page, '#worktype-field-label-0', 'Diện tích (m²)');
      await dlgSelect(page, '#worktype-field-type-0', 'NUMBER');
      await dlgAddFieldRow(page, 1);
      await dlgFill(page, '#worktype-field-key-1', 'anh_nghiem_thu');
      await dlgFill(page, '#worktype-field-label-1', 'Ảnh nghiệm thu');
      await dlgSelect(page, '#worktype-field-type-1', 'PHOTO');
      await dlg(page).getByRole('button', { name: 'Tạo loại công việc', exact: true }).click();
      await page.waitForFunction(
        () => (document.body.textContent || '').includes('Tạo loại công việc thành công'),
        { timeout: 25000 });
      // Dialog đóng + list remount: đợi tên mới hiện.
      await page.waitForFunction(
        (n) => (document.body.textContent || '').includes(n),
        NEW_NAME, { timeout: 25000 });
      await snap(page, `${id}-created`, 'List sau khi tạo Thi công ốp lát tường');
      const lr = await api('GET', `/api/v1/work-types?search=${encodeURIComponent('ốp lát tường')}`, adminToken);
      const hit = (lr.body && lr.body.data ? lr.body.data : []).find((w) => w.code === NEW_CODE);
      if (!hit) return fail(id, `GET search thiếu ${NEW_CODE}: ${JSON.stringify(lr.body).slice(0, 300)}`);
      newId = hit.id;
      if (hit.group !== NEW_GROUP) return fail(id, `group=${hit.group} (mong ${NEW_GROUP})`);
      if (hit.configVersion !== 1) return fail(id, `configVersion=${hit.configVersion} (mong 1)`);
      if (!Array.isArray(hit.requiredFields) || hit.requiredFields.length !== 2) {
        return fail(id, `requiredFields=${JSON.stringify(hit.requiredFields).slice(0, 200)}`);
      }
      const db = psqlT(`SELECT code||'|'||config_version::text FROM work_types WHERE id='${newId}'`);
      if (db !== `${NEW_CODE}|1`) return fail(id, `psql row sai: ${db}`);
      const au = psqlT(`SELECT actor_user_id||'|'||action FROM audit_logs WHERE entity_id='${newId}' AND action='PRJ_WORK_TYPE_CREATED'`);
      if (!au.split('\n').some((r) => r.startsWith(`${ADMIN_ID}|PRJ_WORK_TYPE_CREATED`))) {
        return fail(id, `thiếu audit CREATED actor admin: ${au.slice(0, 200)}`);
      }
      return ok(id, `UI toast Tạo thành công + list ${NEW_NAME}; psql ${db}; audit CREATED admin; configVersion=1`);
    })();

    // ============ S2: chi tiết đủ profile + def-grid + bảng fields ============
    await step('S2', 'Detail: profile-card + def-grid + bảng required fields + v1', async (id) => {
      if (!newId) return fail(id, 'S1 chưa tạo newId (cascade)');
      await gotoDetail(page, newId);
      const t = await bodyText(page);
      for (const need of [NEW_NAME, NEW_CODE, 'Hoạt động', 'Nhóm công việc', NEW_GROUP,
        'Ngành nghề yêu cầu', 'OP-LAT', 'Phiên bản cấu hình', 'v1',
        'Dùng cho work order mới', 'Được phép', 'Diện tích (m²)', 'Ảnh nghiệm thu']) {
        if (!t.includes(need)) return fail(id, `detail thiếu "${need}"`);
      }
      await snap(page, `${id}-detail`, 'Detail loại mới: profile + fields + v1');
      const g = await api('GET', `/api/v1/work-types/${newId}`, adminToken);
      if (g.status !== 200) return fail(id, `GET detail status=${g.status}`);
      if (g.body.configVersion !== 1 || !g.body.usage || typeof g.body.usage.workOrders !== 'number') {
        return fail(id, `GET thiếu configVersion/usage: ${JSON.stringify(g.body).slice(0, 300)}`);
      }
      return ok(id, 'UI đủ h1+chip+badge+def-grid+bảng fields+v1; API usage:{workOrders} đủ');
    })();

    // ============ S3: sửa qua dialog → configVersion tăng ============
    await step('S3', 'Sửa requiredFields qua dialog → configVersion 1→2', async (id) => {
      if (!newId) return fail(id, 'S1 chưa tạo newId (cascade)');
      await gotoDetail(page, newId);
      await page.getByRole('button', { name: 'Sửa', exact: true }).click();
      await page.waitForFunction(
        () => (document.body.textContent || '').includes('Sửa loại công việc'),
        { timeout: 15000 });
      await page.waitForFunction(
        () => !(document.body.textContent || '').includes('Đang tải…'),
        { timeout: 15000 });
      const codeVal = await dlg(page).locator('#worktype-code').inputValue();
      if (codeVal !== NEW_CODE) return fail(id, `prefill code=${codeVal} (mong ${NEW_CODE})`);
      await dlgAddFieldRow(page, 2);
      await dlgFill(page, '#worktype-field-key-2', 'ngay_thi_cong');
      await dlgFill(page, '#worktype-field-label-2', 'Ngày thi công');
      await dlgSelect(page, '#worktype-field-type-2', 'DATE');
      await dlg(page).getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
      await page.waitForFunction(
        () => (document.body.textContent || '').includes('Cập nhật loại công việc thành công'),
        { timeout: 25000 });
      await page.waitForFunction(
        () => (document.body.textContent || '').includes('v2'),
        { timeout: 25000 });
      await snap(page, `${id}-updated`, 'Detail sau sửa: v2 + 3 fields');
      const t = await bodyText(page);
      if (!t.includes('Ngày thi công')) return fail(id, 'detail thiếu field mới Ngày thi công');
      const g = await api('GET', `/api/v1/work-types/${newId}`, adminToken);
      if (g.body.configVersion !== 2) return fail(id, `configVersion=${g.body.configVersion} (mong 2)`);
      if ((g.body.requiredFields || []).length !== 3) {
        return fail(id, `fields=${(g.body.requiredFields || []).length} (mong 3)`);
      }
      return ok(id, 'UI toast Cập nhật + v2 + field Ngày thi công; API configVersion=2, 3 fields');
    })();

    // ============ S4: conflict optimistic locking ============
    await step('S4', 'PATCH stale expectedConfigVersion → 409 + UI notice + nút tải lại', async (id) => {
      if (!newId) return fail(id, 'S1 chưa tạo newId (cascade)');
      const cur = await api('GET', `/api/v1/work-types/${newId}`, adminToken);
      const v0 = cur.body.configVersion; // mong 2
      await gotoDetail(page, newId);
      await page.getByRole('button', { name: 'Sửa', exact: true }).click();
      await page.waitForFunction(
        () => !(document.body.textContent || '').includes('Đang tải…'),
        { timeout: 15000 });
      // Admin khác bump version qua API trong lúc dialog đang mở (stale form).
      const bump = await api('PATCH', `/api/v1/work-types/${newId}`, adminToken,
        { group: 'Hoàn thiện — cập nhật', expectedConfigVersion: v0, reason: 'Chuẩn hóa tên nhóm (đợt T9/2026)' });
      if (bump.status !== 200 || bump.body.versionChanged !== true) {
        return fail(id, `API bump status=${bump.status} ${JSON.stringify(bump.body).slice(0, 200)}`);
      }
      await dlgFill(page, '#worktype-description', 'Mô tả sửa khi form đã stale');
      await dlg(page).getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
      // Notice hiển thị đúng field-error từ API ("Version cấu hình đã thay đổi…");
      // chuỗi "Cấu hình đã được người khác cập nhật" chỉ là fallback khi rỗng.
      await page.waitForFunction(
        () => (document.body.textContent || '').includes('Version cấu hình đã thay đổi'),
        { timeout: 25000 });
      const t = await bodyText(page);
      const reloadCount = await page.getByRole('button', { name: 'Tải lại', exact: true }).count();
      if (reloadCount === 0) return fail(id, 'thiếu nút Tải lại trong notice conflict');
      await snap(page, `${id}-conflict`, 'Notice conflict + nút Tải lại');
      const stale = await api('PATCH', `/api/v1/work-types/${newId}`, adminToken,
        { name: 'Ghi đè stale', expectedConfigVersion: v0 });
      if (stale.status !== 409 || stale.body.code !== 'WORK_TYPE_CONFIG_CONFLICT') {
        return fail(id, `API stale status=${stale.status} ${JSON.stringify(stale.body).slice(0, 200)}`);
      }
      if (!stale.body.fieldErrors || !stale.body.fieldErrors.expectedConfigVersion) {
        return fail(id, 'API 409 thiếu fieldErrors.expectedConfigVersion');
      }
      const g = await api('GET', `/api/v1/work-types/${newId}`, adminToken);
      if (g.body.configVersion !== v0 + 1) return fail(id, `version sau conflict=${g.body.configVersion} (mong ${v0 + 1})`);
      await dlg(page).getByRole('button', { name: 'Hủy', exact: true }).click().catch(() => {});
      return ok(id, `UI notice "Version cấu hình đã thay đổi" + nút Tải lại; API 409 WORK_TYPE_CONFIG_CONFLICT + fieldErrors; version giữ ${v0 + 1} (không mất thay đổi)`);
    })();

    // ============ S5: deactivate qua StatusDialog ============
    await step('S5', 'Ngừng hoạt động qua StatusDialog + reason → badge', async (id) => {
      if (!newId) return fail(id, 'S1 chưa tạo newId (cascade)');
      await gotoDetail(page, newId);
      await page.getByRole('button', { name: 'Ngừng hoạt động', exact: true }).click();
      await page.waitForFunction(
        () => (document.body.textContent || '').includes('Ngừng hoạt động loại công việc'),
        { timeout: 15000 });
      await dlgFill(page, '#worktype-status-reason', 'Tạm dừng để rà soát định mức nghiệm thu ốp lát (đợt T9/2026)');
      await dlg(page).getByRole('button', { name: 'Xác nhận', exact: true }).click();
      await page.waitForFunction(
        () => (document.body.textContent || '').includes('Đã chuyển sang Ngừng hoạt động'),
        { timeout: 25000 });
      await snap(page, `${id}-deactivated`, 'Detail sau deactivate: badge Ngừng hoạt động');
      const t = await bodyText(page);
      if (!t.includes('Ngừng hoạt động')) return fail(id, 'thiếu badge Ngừng hoạt động');
      const db = psqlT(`SELECT is_active::text FROM work_types WHERE id='${newId}'`);
      if (db !== 'false') return fail(id, `psql is_active=${db} (mong false) — row phải còn`);
      const au = psqlT(`SELECT reason FROM audit_logs WHERE entity_id='${newId}' AND action='PRJ_WORK_TYPE_STATUS_CHANGED' ORDER BY created_at DESC LIMIT 1`);
      if (!au.includes('rà soát định mức')) return fail(id, `audit reason thiếu: ${au.slice(0, 200)}`);
      return ok(id, 'UI badge Ngừng hoạt động + success; psql is_active=false row còn; audit reason đủ');
    })();

    // ============ S6: picker /active loại trừ inactive ============
    await step('S6', 'GET /active không chứa loại inactive (contract picker cho WO mới)', async (id) => {
      const r = await api('GET', '/api/v1/work-types/active', adminToken);
      if (r.status !== 200 || !Array.isArray(r.body.data)) {
        return fail(id, `GET /active status=${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
      }
      const ids = r.body.data.map((w) => w.id);
      if (newId && ids.includes(newId)) return fail(id, 'picker /active vẫn chứa loại vừa deactivate');
      if (ids.includes(SEED.BETONG.id)) return fail(id, 'picker /active vẫn chứa seed BETONG inactive');
      if (!ids.includes(SEED.SON.id)) return fail(id, 'picker /active thiếu seed SON active');
      if (r.body.data.some((w) => w.status !== 'ACTIVE')) return fail(id, '/active trả row INACTIVE');
      return ok(id, `/active total=${r.body.total}: loại trừ 2 inactive, giữ seed active (JOB đọc picker này khi tạo WO mới)`);
    })();

    // ============ S7: dữ liệu cũ (inactive) vẫn đọc đủ ============
    await step('S7', 'Detail inactive vẫn load đủ config/version (không 404)', async (id) => {
      if (!newId) return fail(id, 'S1 chưa tạo newId (cascade)');
      await gotoDetail(page, newId);
      const t = await bodyText(page);
      for (const need of [NEW_NAME, 'Ngừng hoạt động', 'Phiên bản cấu hình', 'Bị chặn', 'Ngày thi công']) {
        if (!t.includes(need)) return fail(id, `detail inactive thiếu "${need}"`);
      }
      await snap(page, `${id}-inactive-detail`, 'Detail inactive: đủ config + cảnh báo');
      const g = await api('GET', `/api/v1/work-types/${newId}`, adminToken);
      if (g.status !== 200) return fail(id, `GET inactive status=${g.status} (mong 200, không 404)`);
      if (g.body.status !== 'INACTIVE' || typeof g.body.configVersion !== 'number') {
        return fail(id, `GET thiếu status/configVersion: ${JSON.stringify(g.body).slice(0, 200)}`);
      }
      return ok(id, 'UI đủ badge + Bị chặn + fields; API 200 status INACTIVE + configVersion đủ');
    })();

    // ============ S8: trade inactive → 400 đúng field ============
    await step('S8', 'Tạo với trade inactive → 400 fieldErrors.requiredTradeId', async (id) => {
      const ct = await api('POST', '/api/v1/trades', adminToken, { code: TEMP_TRADE_CODE, name: TEMP_TRADE_NAME });
      if (ct.status !== 201) return fail(id, `tạo trade tạm status=${ct.status} ${JSON.stringify(ct.body).slice(0, 200)}`);
      tempTradeId = ct.body.id;
      const dt = await api('PATCH', `/api/v1/trades/${tempTradeId}/status`, adminToken, { status: 'INACTIVE' });
      if (dt.status !== 200) return fail(id, `deactivate trade tạm status=${dt.status}`);
      const bad = await api('POST', '/api/v1/work-types', adminToken,
        { code: 'WT-DA-HOA-CUONG', name: 'Thi công đá hoa cương', requiredTradeId: tempTradeId });
      if (bad.status !== 400) return fail(id, `tạo với trade inactive status=${bad.status} (mong 400) ${JSON.stringify(bad.body).slice(0, 300)}`);
      const fe = bad.body.fieldErrors && bad.body.fieldErrors.requiredTradeId
        ? bad.body.fieldErrors.requiredTradeId.join(' ') : '';
      if (!fe.includes('Ngành nghề')) return fail(id, `400 thiếu fieldErrors.requiredTradeId: ${JSON.stringify(bad.body).slice(0, 300)}`);
      const gone = psqlT(`SELECT count(*) FROM work_types WHERE code='WT-DA-HOA-CUONG'`);
      if (gone !== '0') return fail(id, 'bản ghi invalid vẫn lọt DB');
      await snap(page, `${id}-validation`, 'S8 API-only: shot giữ nguyên trang detail S7, bằng chứng chính là response 400');
      return ok(id, `400 fieldErrors.requiredTradeId="${fe.slice(0, 60)}"; không tạo bản ghi`);
    })();

    // ============ S9: đổi duration/priority qua dialog → preview đúng + KHÔNG bump version ============
    await step('S9', 'Edit dialog đổi duration/priority → preview đúng + config_version không tăng', async (id) => {
      if (!newId) return fail(id, 'S1 chưa tạo newId (cascade)');
      const before = await api('GET', `/api/v1/work-types/${newId}`, adminToken);
      if (before.status !== 200) return fail(id, `GET before status=${before.status}`);
      const vBefore = before.body.configVersion;
      await gotoDetail(page, newId);
      await page.getByRole('button', { name: 'Sửa', exact: true }).click();
      await page.waitForFunction(
        () => !(document.body.textContent || '').includes('Đang tải…'),
        { timeout: 15000 });
      await dlgFill(page, '#worktype-duration', '180');
      await dlgSelect(page, '#worktype-priority', 'HIGH');
      // Panel 'Xem trước cấu hình' trong dialog phản ánh trực tiếp nội dung đang nhập.
      const previewText = await dlg(page).locator('dl.bf-def-grid').textContent();
      if (!previewText || !previewText.includes('180 phút')) {
        return fail(id, `preview thiếu "180 phút": ${(previewText || '').slice(0, 200)}`);
      }
      if (!previewText.includes('Cao')) {
        return fail(id, `preview thiếu "Cao" (HIGH): ${(previewText || '').slice(0, 200)}`);
      }
      await dlg(page).getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
      await page.waitForFunction(
        () => (document.body.textContent || '').includes('Cập nhật loại công việc thành công'),
        { timeout: 25000 });
      await snap(page, `${id}-duration-priority`, 'S9: đổi duration/priority — version không tăng');
      const g = await api('GET', `/api/v1/work-types/${newId}`, adminToken);
      if (g.body.configVersion !== vBefore) {
        return fail(id, `configVersion ${vBefore}→${g.body.configVersion} (mong giữ nguyên khi chỉ đổi duration/priority)`);
      }
      if (g.body.defaultDurationMinutes !== 180) {
        return fail(id, `defaultDurationMinutes=${g.body.defaultDurationMinutes} (mong 180)`);
      }
      if (g.body.defaultPriority !== 'HIGH') {
        return fail(id, `defaultPriority=${g.body.defaultPriority} (mong HIGH)`);
      }
      return ok(id, `preview "180 phút"+"Cao" đúng; API configVersion giữ ${vBefore} (không bump), duration=180, priority=HIGH`);
    })();
  } finally {
    runCleanup(newId ? [newId] : []);
    if (tempTradeId) {
      try {
        execFileSync('docker', ['exec', 'buildflow-postgres-1', 'psql', '-U', 'buildflow', '-d', 'buildflow', '-c',
          `DELETE FROM trades WHERE id='${tempTradeId}';`],
        { encoding: 'utf8', timeout: 20000 });
      } catch (e) {
        console.log(`cleanup trade WARN ${(e.stderr || e.message || '').slice(0, 200)}`);
      }
    }
    const rest = psqlT(`SELECT count(*) FROM work_types WHERE code='${NEW_CODE}'`);
    const tradeRest = psqlT(`SELECT count(*) FROM trades WHERE code='${TEMP_TRADE_CODE}'`);
    const seedRest = psqlT(`SELECT count(*) FROM work_types WHERE id IN (${SEED_IDS.map((s) => `'${s}'`).join(',')})`);
    const auditFinal = psqlT('SELECT count(*) FROM audit_logs');
    console.log(`cleanup: ${NEW_CODE} rest=${rest}, trade tạm rest=${tradeRest}, seed=${seedRest}/4, audit ${auditBaseline}→${auditFinal}`);
    fs.writeFileSync(path.join(__dirname, 'e2e-vars.json'), JSON.stringify({
      _note: 'Throwaway E2E-only demo credentials (seed/reset per evidence docs). Never production.',
      admin: ADMIN_EMAIL,
      seedIds: SEED_IDS,
      createdIds: newId ? [newId] : [],
      createdCode: NEW_CODE,
      tempTradeId,
      auditBaseline, auditFinal, rest, tradeRest, results,
    }, null, 2));
    const passed = results.filter((r) => r.ok).length;
    console.log(`\nTỔNG: ${passed}/${results.length} PASS`);
    await browser.close().catch(() => {});
    process.exit(passed === results.length ? 0 : 1);
  }
})();
