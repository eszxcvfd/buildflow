/**
 * ORG-SRS-007 E2E driver — Quản lý thành viên đội (issue #30).
 * Evidence-only script; phạm vi docs/evidence — KHÔNG commit, KHÔNG sửa source.
 *
 * Chạy:   node e2e-driver-org-srs-007.cjs
 * Yêu cầu: stack rebuild từ working tree (api có /api/v1/crews/:id/members, web có panel Thành viên);
 *          admin (hoang.anh@vinacons.vn / E2EAdmin@2025) + pm (quoc.tran@vinacons.vn / E2EPm@2025)
 *          + worker1 (thang.nguyen@vinacons.vn / E2EWorker@2025).
 *
 * Dữ liệu realistic theo docs/demo-data.md (chuẩn hóa 2026-09-07):
 * crews DTA-xxx/DTB-xxx + tên 'Đội thi công…' (DIGITS duy nhất mỗi run);
 * seed worker3/worker4 = Trần Minh Đức / Lê Văn Sơn (@vinacons.vn);
 * member chính hau.le = 'Lê Văn Hậu'; reasons tiếng Việt không tag E2E.
 * Passwords giữ nguyên.
 *
 * Luồng: seed worker3/worker4 (SQL) + tạo 2 crews (API) → S1 UI add → S2 dup 409
 * → S3 overlap warning → S4 UI remove → S5 alreadyRemoved → S6 at point-in-time
 * → S7 suspend + CREW_INACTIVE → S8 worker 403 → S9 ?crew= filter → S10 double-submit
 * → S11 PM add/remove. Cleanup entity cuối run (audit giữ nguyên).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { chromium } = require('/home/trung/.npm-global/lib/node_modules/@playwright/mcp/node_modules/playwright');

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
const WORKER1_ID = '33333333-3333-4333-8333-333333333333';
const WORKER2_ID = '44444444-4444-4444-8444-444444444444';
const WORKER3_ID = '55555555-5555-4555-8555-555555555555'; // Trần Minh Đức (seed)
const WORKER4_ID = '66666666-6666-4666-8666-666666666666'; // Lê Văn Sơn (seed)
const WORKER3_NAME = 'Trần Minh Đức';
const WORKER4_NAME = 'Lê Văn Sơn';
// Crews realistic duy nhất mỗi run (canonical DD-CD không khớp pattern DTA-/DTB-).
const DIGITS = Date.now().toString(36).toUpperCase().slice(-6);
const CREW_A = `DTA-${DIGITS}`;
const CREW_B = `DTB-${DIGITS}`;
const CREW_NAME_A = `Đội thi công A ${DIGITS}`;
const CREW_NAME_B = `Đội thi công B ${DIGITS}`;
const REASON_REMOVE = 'Điều chuyển sang đội khác (đợt T9/2026)';
const REASON_SUSPEND = 'Tạm ngừng: bảo trì thiết bị tuần 37 (đợt T9/2026)';
const TODAY = new Date().toISOString().slice(0, 10);

const results = [];
function step(id, name, fn) {
  return async () => {
    try {
      const r = await fn(id);
      results.push(r);
      console.log(`${r.ok ? 'PASS' : 'FAIL'} ${id} ${name}${r.note ? ' :: ' + String(r.note).split('\n')[0] : ''}`);
      if (!r.ok && r.note) console.log(`  detail: ${String(r.note).slice(0, 1000)}`);
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

/**
 * Xóa entity run 007: id-based trước (crew ids + seed user ids trong vars),
 * fallback mã run-pattern DTA-/DTB- trong cửa sổ 12h (canonical DD-CD và
 * DCD-/DCT- của run 006 không khớp nên an toàn). Audit giữ nguyên.
 */
function cleanup007(crewIds) {
  const idList = (crewIds || []).filter(Boolean).map((s) => `'${s}'`);
  if (idList.length) {
    psqlT(`DELETE FROM crew_members WHERE crew_id IN (${idList.join(',')})`);
    psqlT(`DELETE FROM crews WHERE id IN (${idList.join(',')})`);
  }
  const fbMem = psqlT(`DELETE FROM crew_members WHERE crew_id IN (SELECT id FROM crews WHERE (code LIKE 'DTA-%' OR code LIKE 'DTB-%') AND created_at > now() - interval '12 hours')`);
  const fbCrew = psqlT(`DELETE FROM crews WHERE (code LIKE 'DTA-%' OR code LIKE 'DTB-%') AND created_at > now() - interval '12 hours'; SELECT count(*) FROM crews WHERE code LIKE 'DTA-%' OR code LIKE 'DTB-%'`);
  // seed users worker3/4 (id-based; chỉ xóa khi đúng email seed để không bao giờ đụng canonical)
  const seedIds = [`'${WORKER3_ID}'`, `'${WORKER4_ID}'`];
  psqlT(`DELETE FROM crew_members WHERE user_id IN (${seedIds.join(',')})`);
  psqlT(`DELETE FROM resource_trades WHERE user_id IN (${seedIds.join(',')})`);
  const delRoles = psqlT(`DELETE FROM user_roles WHERE user_id IN (${seedIds.join(',')})`);
  const delUsers = psqlT(`DELETE FROM users WHERE id IN (${seedIds.join(',')}) AND email IN ('duc.tran@vinacons.vn','son.le@vinacons.vn'); SELECT count(*) FROM users WHERE id IN (${seedIds.join(',')})`);
  console.log(`cleanup: fbMembers=${fbMem.split('\n').pop()} fbCrews rest=${fbCrew.split('\n').pop()} roles del=${delRoles.split('\n').pop()} seedusers rest=${delUsers.split('\n').pop()}`);
}

/** Pre-cleanup: ids trong vars run trước + pattern fallback. */
function preCleanup007() {
  let prev = null;
  try { prev = JSON.parse(fs.readFileSync(path.join(__dirname, 'e2e-vars.json'), 'utf8')); } catch {}
  cleanup007(prev ? [prev.crewA, prev.crewB].filter(Boolean) : []);
}
// Đợi select thêm-thành-viên load xong options worker rồi chọn (Ark: đợi
// options của chính trigger qua aria-controls, không cần mở).
async function selectWorkerToAdd(page, userId) {
  await page.waitForSelector('#member-add-user:not([disabled])', { timeout: 20000 });
  await arkWaitOptions(page, 'member-add-user', 2);
  await arkSelectOption(page, 'member-add-user', userId);
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
    console.error(`Không lấy được token (admin=${!!adminToken} pm=${!!pmToken} worker=${!!workerToken})`);
    await browser.close().catch(() => {});
    process.exit(2);
  }

  // ---- Pre-cleanup run trước (id-based + pattern fallback), rồi seed worker3/worker4 (SQL, idempotent) ----
  preCleanup007();
  const seedSql = fs.readFileSync(path.join(__dirname, 'seed-007.sql'), 'utf8');
  const seedRun = spawnSync('docker', ['exec', '-i', 'buildflow-postgres-1', 'psql', '-U', 'buildflow', '-d', 'buildflow', '-v', 'ON_ERROR_STOP=1'],
    { input: seedSql, encoding: 'utf8', timeout: 20000 });
  console.log(`seed worker3/4: ${seedRun.status === 0 ? 'ok' : 'FAIL ' + (seedRun.stderr || '').slice(0, 300)}`);
  let crewA = null;
  let crewB = null;
  {
    const a = await api('POST', '/api/v1/crews', adminToken,
      { code: CREW_A, name: CREW_NAME_A, leaderUserId: WORKER1_ID }, { 'X-Correlation-Id': uuid() });
    const b = await api('POST', '/api/v1/crews', adminToken,
      { code: CREW_B, name: CREW_NAME_B, leaderUserId: WORKER1_ID }, { 'X-Correlation-Id': uuid() });
    if ((a.status !== 201 && a.status !== 200) || (b.status !== 201 && b.status !== 200)) {
      console.error(`Tạo crews thất bại A=${a.status} ${JSON.stringify(a.body)} B=${b.status} ${JSON.stringify(b.body)}`);
      await browser.close().catch(() => {});
      process.exit(2);
    }
    crewA = a.body.id;
    crewB = b.body.id;
    console.log(`setup: crewA=${crewA} crewB=${crewB} today=${TODAY}`);
  }
  let memberB = null; // member row id của worker2 trong crewB (lấy sau S3)

  try {
    // ============ S1: ADMIN thêm thành viên qua UI ============
    await step('S1', 'ADMIN /crews → mở crew A → thêm worker2 (effectiveFrom today) → hiện list + DB + audit ADDED', async (id) => {
      await login(page, ADMIN_EMAIL, ADMIN_PASS);
      await page.goto(`${WEB}/crews`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      const lt = await bodyText(page);
      if (!lt.includes(CREW_A)) return fail(id, `/crews không thấy ${CREW_A}`);
      await snap(page, id + '-list', 'Danh sách đội (thấy 2 crews DT thực tế)');
      // /crews là table: link mở chi tiết nằm trong row chứa mã đội (text link là "Chi tiết").
      await page.locator('tr', { hasText: CREW_A }).locator('a').first().click();
      await page.waitForFunction(() => (document.body.textContent || '').includes('Thành viên'), { timeout: 20000 });
      await snap(page, id + '-detail', 'Chi tiết crew A trước khi thêm (panel Thành viên)');
      // Form thêm nằm trong Ark Dialog — mở từ nút 'Thêm thành viên' ở card hiện tại.
      await page.locator('button', { hasText: 'Thêm thành viên' }).first().click();
      await selectWorkerToAdd(page, WORKER2_ID);
      await page.fill('#member-add-effective-from', TODAY);
      await snap(page, id + '-form', 'Form thêm đã điền worker2 + effectiveFrom today');
      await page.locator('button', { hasText: 'Thêm vào đội' }).first().click();
      await page.waitForFunction(() => (document.body.textContent || '').includes('Đã thêm'), { timeout: 20000 });
      await page.waitForTimeout(1500);
      // Đóng dialog thêm (giữ intent: success đã assert) để các bước sau thao tác bảng.
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      const t = await bodyText(page);
      await snap(page, id + '-added', 'Thêm worker2 thành công (list hiện THÀNH VIÊN)');
      if (!t.includes('Lê Văn Hậu')) return fail(id, 'list không hiện Lê Văn Hậu sau khi thêm');
      const db = psqlT(`SELECT member_role||'|'||is_active::text||'|'||effective_from::text FROM crew_members WHERE crew_id='${crewA}' AND user_id='${WORKER2_ID}' AND is_active`);
      const au = psqlT(`SELECT count(*) FROM audit_logs WHERE entity_type='CREW' AND entity_id='${crewA}' AND action='ORG_CREW_MEMBER_ADDED' AND after_data::text LIKE '%${WORKER2_ID}%'`);
      if (!db.startsWith('MEMBER|true|')) return fail(id, `crew_members DB=${db}`);
      if (!db.includes(TODAY)) return fail(id, `effective_from DB=${db} (mong ${TODAY})`);
      if (au !== '1') return fail(id, `audit ADDED count=${au}`);
      return ok(id, `UI 201 + list hiện Lê Văn Hậu; DB ${db}; audit ORG_CREW_MEMBER_ADDED=1`);
    })();

    // ============ S2: trùng thành viên → 409 ============
    await step('S2', 'Thêm lại worker2 vào crew A → 409 field Thành viên đã trong đội, không thêm row', async (id) => {
      await page.locator('button', { hasText: 'Thêm thành viên' }).first().click();
      await selectWorkerToAdd(page, WORKER2_ID);
      await page.locator('button', { hasText: 'Thêm vào đội' }).first().click();
      await page.waitForFunction(() => (document.body.textContent || '').includes('Thành viên đã trong đội'), { timeout: 20000 });
      await snap(page, id + '-dup', 'Thêm trùng → lỗi field 409 MEMBER_DUPLICATE');
      const cnt = psqlT(`SELECT count(*) FROM crew_members WHERE crew_id='${crewA}' AND user_id='${WORKER2_ID}' AND is_active`);
      const au = psqlT(`SELECT count(*) FROM audit_logs WHERE entity_type='CREW' AND entity_id='${crewA}' AND action='ORG_CREW_MEMBER_ADDED' AND after_data::text LIKE '%${WORKER2_ID}%'`);
      if (cnt !== '1') return fail(id, `active rows=${cnt} (mong 1)`);
      if (au !== '1') return fail(id, `audit ADDED=${au} (mong 1, không audit cho 409)`);
      return ok(id, `UI field-error 409; active rows=1; audit vẫn 1`);
    })();

    // ============ S3: overlap warning crew B ============
    await step('S3', 'Thêm worker2 vào crew B → 201 + banner MEMBER_IN_OTHER_CREW; audit afterData có _warning', async (id) => {
      await page.goto(`${WEB}/crews/${crewB}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => (document.body.textContent || '').includes('Thành viên'), { timeout: 20000 });
      await page.locator('button', { hasText: 'Thêm thành viên' }).first().click();
      await selectWorkerToAdd(page, WORKER2_ID);
      await page.fill('#member-add-effective-from', TODAY);
      await page.locator('button', { hasText: 'Thêm vào đội' }).first().click();
      await page.waitForFunction(() => (document.body.textContent || '').includes('Đã thêm'), { timeout: 20000 });
      await page.waitForTimeout(1500);
      const t = await bodyText(page);
      await snap(page, id + '-warning', 'Thêm vào crew B: success + banner overlap đội khác');
      if (!t.includes('đang thuộc đội khác')) return fail(id, 'thiếu banner overlap MEMBER_IN_OTHER_CREW');
      // Đóng dialog sau khi đã assert banner để S4 thao tác bảng.
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      const au = psqlT(`SELECT after_data::text FROM audit_logs WHERE entity_type='CREW' AND entity_id='${crewB}' AND action='ORG_CREW_MEMBER_ADDED' AND after_data::text LIKE '%${WORKER2_ID}%' ORDER BY created_at DESC LIMIT 1`);
      if (!au.includes('_warning')) return fail(id, `audit afterData thiếu _warning: ${au.slice(0, 300)}`);
      const m = await api('GET', `/api/v1/crews/${crewB}/members?includeInactive=true`, adminToken);
      const hit = (m.body.data || []).find((x) => x.userId === WORKER2_ID && x.isActive);
      if (!hit) return fail(id, 'API members crewB thiếu worker2 active');
      memberB = hit.id;
      return ok(id, `UI success + banner overlap; audit có _warning; memberB=${String(memberB).slice(0, 8)}…`);
    })();

    // ============ S4: xóa mềm khỏi crew B ============
    await step('S4', 'Xóa worker2 khỏi crew B (effectiveTo=today + reason) → history Đã rời; DB off + audit REMOVED(reason)', async (id) => {
      const auditBefore = psqlT(`SELECT count(*) FROM audit_logs WHERE entity_type='CREW' AND entity_id='${crewB}' AND action='ORG_CREW_MEMBER_REMOVED'`);
      await page.locator('button', { hasText: 'Xóa khỏi đội' }).first().click();
      await page.waitForFunction(() => (document.body.textContent || '').includes('Xác nhận xóa'), { timeout: 10000 });
      await snap(page, id + '-confirm', 'Confirm inline xóa mềm (effectiveTo + reason)');
      await page.fill('#member-remove-effective-to', TODAY);
      await page.fill('#member-remove-reason', REASON_REMOVE);
      await page.locator('button', { hasText: 'Xác nhận xóa' }).first().click();
      await page.waitForFunction(() => (document.body.textContent || '').includes('Đã xóa'), { timeout: 20000 });
      await snap(page, id + '-removed', 'Xóa mềm thành công (giữ lịch sử)');
      // Bật lịch sử → thấy Đã rời
      await page.locator('input[type="checkbox"]').first().check();
      await page.waitForFunction(() => (document.body.textContent || '').includes('Đã rời'), { timeout: 15000 });
      await snap(page, id + '-history', 'Lịch sử crew B: worker2 badge Đã rời');
      const db = psqlT(`SELECT is_active::text||'|'||effective_to::text FROM crew_members WHERE id='${memberB}'`);
      const au = psqlT(`SELECT reason||' ~~ '||after_data::text FROM audit_logs WHERE entity_type='CREW' AND entity_id='${crewB}' AND action='ORG_CREW_MEMBER_REMOVED' ORDER BY created_at DESC LIMIT 1`);
      const auditAfter = psqlT(`SELECT count(*) FROM audit_logs WHERE entity_type='CREW' AND entity_id='${crewB}' AND action='ORG_CREW_MEMBER_REMOVED'`);
      if (!db.startsWith(`false|${TODAY}`)) return fail(id, `crew_members DB=${db} (mong false|${TODAY})`);
      if (!au.includes(REASON_REMOVE)) return fail(id, `audit thiếu reason: ${au.slice(0, 300)}`);
      if (auditAfter !== String(Number(auditBefore) + 1)) return fail(id, `audit ${auditBefore}→${auditAfter}`);
      return ok(id, `UI Đã rời; DB ${db}; audit REMOVED +1 có reason`);
    })();

    // ============ S5: xóa idempotent ============
    await step('S5', 'DELETE lại memberB → alreadyRemoved=true, audit delta 0', async (id) => {
      const before = psqlT(`SELECT count(*) FROM audit_logs WHERE entity_type='CREW' AND entity_id='${crewB}' AND action='ORG_CREW_MEMBER_REMOVED'`);
      const r = await api('DELETE', `/api/v1/crews/${crewB}/members/${memberB}`, adminToken,
        { effectiveTo: TODAY, reason: REASON_REMOVE }, { 'X-Correlation-Id': uuid() });
      const after = psqlT(`SELECT count(*) FROM audit_logs WHERE entity_type='CREW' AND entity_id='${crewB}' AND action='ORG_CREW_MEMBER_REMOVED'`);
      if (r.status !== 200 || r.body.alreadyRemoved !== true) {
        return fail(id, `HTTP ${r.status} body=${JSON.stringify(r.body)} (mong alreadyRemoved=true)`);
      }
      if (after !== before) return fail(id, `audit delta ${before}→${after} (mong 0)`);
      return ok(id, `alreadyRemoved=true; audit ${before}→${after} (delta 0)`);
    })();

    // ============ S6: history tại thời điểm ============
    await step('S6', 'at=today trên crew B → worker2 vẫn hiện (history point-in-time); row cũ nguyên vẹn', async (id) => {
      const rowBefore = psqlT(`SELECT effective_from::text||'|'||effective_to::text||'|'||is_active::text FROM crew_members WHERE id='${memberB}'`);
      await page.fill('#member-history-at', TODAY);
      await page.waitForTimeout(2000);
      const t = await bodyText(page);
      await snap(page, id + '-at', `Danh sách crew B tại ngày ${TODAY} (worker2 còn hiện)`);
      if (!t.includes('Lê Văn Hậu')) return fail(id, `at=${TODAY} không thấy Lê Văn Hậu`);
      const rowAfter = psqlT(`SELECT effective_from::text||'|'||effective_to::text||'|'||is_active::text FROM crew_members WHERE id='${memberB}'`);
      if (rowAfter !== rowBefore) return fail(id, `row đổi ${rowBefore}→${rowAfter} (mong nguyên vẹn)`);
      // Xóa mốc thời gian để trả UI về mặc định
      const clearBtn = page.locator('button', { hasText: 'Xóa mốc thời gian' });
      if (await clearBtn.count()) await clearBtn.first().click();
      return ok(id, `at=${TODAY} thấy worker2; row ${rowAfter} nguyên vẹn`);
    })();

    // ============ S7: crew INACTIVE chặn thêm ============
    await step('S7', 'Tạm ngừng crew B → form thêm disabled + API POST 409 CREW_INACTIVE', async (id) => {
      await page.goto(`${WEB}/crews/${crewB}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => (document.body.textContent || '').includes('Tạm ngừng'), { timeout: 15000 });
      await page.locator('button', { hasText: 'Tạm ngừng' }).first().click();
      await page.waitForFunction(() => (document.body.textContent || '').includes('Xác nhận tạm ngừng'), { timeout: 10000 });
      await page.fill('#lifecycle-reason', REASON_SUSPEND);
      await page.locator('button', { hasText: 'Xác nhận tạm ngừng' }).first().click();
      await page.waitForFunction(() => (document.body.textContent || '').includes('Tạm ngừng thành công'), { timeout: 20000 });
      await page.waitForTimeout(1500);
      // Form thêm nằm trong Dialog — mở dialog rồi mới kiểm tra notice + disabled.
      await page.locator('button', { hasText: 'Thêm thành viên' }).first().click();
      await page.waitForSelector('#member-add-user', { timeout: 15000 });
      const t = await bodyText(page);
      await snap(page, id + '-suspended', 'Crew B INACTIVE: form thêm báo đội không hoạt động');
      if (!t.includes('Đội đang không hoạt động')) return fail(id, 'thiếu notice đội không hoạt động ở form thêm');
      const disabled = await page.locator('#member-add-user').isDisabled();
      if (!disabled) return fail(id, 'select thêm-thành-viên không disabled khi crew INACTIVE');
      const r = await api('POST', `/api/v1/crews/${crewB}/members`, adminToken,
        { userId: WORKER3_ID, effectiveFrom: TODAY }, { 'X-Correlation-Id': uuid() });
      if (r.status !== 409 || (r.body.code !== 'CREW_INACTIVE' && JSON.stringify(r.body).indexOf('CREW_INACTIVE') < 0)) {
        return fail(id, `API POST crew INACTIVE → ${r.status} ${JSON.stringify(r.body)} (mong 409 CREW_INACTIVE)`);
      }
      const cnt = psqlT(`SELECT count(*) FROM crew_members WHERE crew_id='${crewB}' AND user_id='${WORKER3_ID}' AND is_active`);
      if (cnt !== '0') return fail(id, `lọt row worker3 crewB=${cnt}`);
      return ok(id, `UI disabled + notice; API 409 CREW_INACTIVE; không lọt row`);
    })();

    // ============ S8: worker 403 ============
    await step('S8', 'worker1: UI members 403 + API GET/POST/DELETE members 403', async (id) => {
      const g = await api('GET', `/api/v1/crews/${crewA}/members`, workerToken);
      const p = await api('POST', `/api/v1/crews/${crewA}/members`, workerToken,
        { userId: WORKER3_ID }, { 'X-Correlation-Id': uuid() });
      const mA = await api('GET', `/api/v1/crews/${crewA}/members?includeInactive=true`, adminToken);
      const target = (mA.body.data || []).find((x) => x.userId === WORKER2_ID);
      const d = await api('DELETE', `/api/v1/crews/${crewA}/members/${target ? target.id : WORKER2_ID}`, workerToken,
        { effectiveTo: TODAY }, { 'X-Correlation-Id': uuid() });
      await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
      await login(page, WORKER_EMAIL, WORKER_PASS);
      await page.goto(`${WEB}/crews/${crewA}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2500);
      const t = await bodyText(page);
      await snap(page, id + '-worker403', 'Worker mở chi tiết crew: panel members 403');
      const checks = [
        ['GET members', g.status === 403],
        ['POST members', p.status === 403],
        ['DELETE members', d.status === 403],
        ['UI 403 card', t.includes('403')],
      ];
      const bad = checks.filter(([, v]) => !v).map(([k]) => k);
      if (bad.length) return fail(id, `lỗi: ${bad.join(', ')} (GET=${g.status} POST=${p.status} DEL=${d.status} ui403=${t.includes('403')})`);
      return ok(id, `API GET/POST/DELETE đều 403; UI card 403`);
    })();

    // ============ S9: lọc theo đội ============
    await step('S9', '/resources workers ?crew=crewA → chỉ thành viên crew A; URL có ?crew=', async (id) => {
      const apiF = await api('GET', `/api/v1/workers?crewId=${crewA}`, pmToken);
      if (apiF.status !== 200) return fail(id, `API workers?crewId → ${apiF.status} ${JSON.stringify(apiF.body)}`);
      const emails = (apiF.body.data || []).map((w) => w.email || w.id);
      const badApi = await api('GET', '/api/v1/workers?crewId=not-a-uuid', pmToken);
      await login(page, ADMIN_EMAIL, ADMIN_PASS);
      await page.goto(`${WEB}/resources?tab=workers`, { waitUntil: 'networkidle' });
      await page.waitForSelector('#directory-crew', { timeout: 20000 });
      await arkSelectOption(page, 'directory-crew', crewA);
      await page.waitForFunction(() => window.location.search.includes('crew='), { timeout: 15000 });
      await page.waitForTimeout(2000);
      const t = await bodyText(page);
      await snap(page, id + '-filter', 'Directory workers lọc theo crew A (?crew=)');
      const url = page.url();
      if (!url.includes('crew=')) return fail(id, `URL thiếu ?crew=: ${url}`);
      if (!t.includes('Lê Văn Hậu')) return fail(id, 'lọc crew A thiếu Lê Văn Hậu');
      if (t.includes(WORKER4_NAME)) return fail(id, 'lọc crew A lọt worker4 (chưa là thành viên)');
      if (badApi.status !== 400) return fail(id, `crewId ảo → ${badApi.status} (mong 400)`);
      return ok(id, `URL ${url.split('?')[1]}; API total=${apiF.body.total}; UI chỉ members crew A; crewId ảo 400`);
    })();

    // ============ S10: double-submit ============
    await step('S10', 'Double-submit add worker3 → 1 row (201 + 409), UI list 1 dòng', async (id) => {
      const payload = { userId: WORKER3_ID, effectiveFrom: TODAY };
      const [r1, r2] = await Promise.all([
        api('POST', `/api/v1/crews/${crewA}/members`, adminToken, payload, { 'X-Correlation-Id': uuid() }),
        api('POST', `/api/v1/crews/${crewA}/members`, adminToken, payload, { 'X-Correlation-Id': uuid() }),
      ]);
      const codes = [r1.status, r2.status].sort().join(',');
      const cnt = psqlT(`SELECT count(*) FROM crew_members WHERE crew_id='${crewA}' AND user_id='${WORKER3_ID}' AND is_active`);
      await page.goto(`${WEB}/crews/${crewA}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2500);
      await snap(page, id + '-single', 'Crew A sau double-submit: worker3 đúng 1 dòng');
      if (codes !== '201,409') return fail(id, `HTTP ${r1.status}/${r2.status} (mong 201+409): ${JSON.stringify(r1.body)} / ${JSON.stringify(r2.body)}`);
      if (cnt !== '1') return fail(id, `active rows worker3=${cnt} (mong 1)`);
      return ok(id, `201+409; active rows=1 (unique constraint + UI disable khi pending)`);
    })();

    // ============ S11: PM add/remove ============
    await step('S11', 'PM thêm + xóa worker4 trên crew A qua UI (đúng actor D7)', async (id) => {
      await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
      await login(page, PM_EMAIL, PM_PASS);
      await page.goto(`${WEB}/crews/${crewA}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => (document.body.textContent || '').includes('Thành viên'), { timeout: 20000 });
      await page.locator('button', { hasText: 'Thêm thành viên' }).first().click();
      await selectWorkerToAdd(page, WORKER4_ID);
      await page.locator('button', { hasText: 'Thêm vào đội' }).first().click();
      await page.waitForFunction(() => (document.body.textContent || '').includes('Đã thêm'), { timeout: 20000 });
      await page.waitForTimeout(1500);
      await snap(page, id + '-pm-added', 'PM thêm worker4 thành công');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      const m = await api('GET', `/api/v1/crews/${crewA}/members`, pmToken);
      const hit = (m.body.data || []).find((x) => x.userId === WORKER4_ID && x.isActive);
      if (!hit) return fail(id, 'API members thiếu worker4 sau PM add');
      // PM xóa worker4 qua UI (bảng .bf-table — row <tr> chứa tên worker4)
      const rows = page.locator('tr', { hasText: WORKER4_NAME });
      await rows.locator('button', { hasText: 'Xóa khỏi đội' }).first().click();
      await page.waitForFunction(() => (document.body.textContent || '').includes('Xác nhận xóa'), { timeout: 10000 });
      await page.fill('#member-remove-effective-to', TODAY);
      await page.locator('button', { hasText: 'Xác nhận xóa' }).first().click();
      await page.waitForFunction(() => (document.body.textContent || '').includes('Đã xóa'), { timeout: 20000 });
      await snap(page, id + '-pm-removed', 'PM xóa worker4 thành công');
      const auAdd = psqlT(`SELECT actor_user_id::text FROM audit_logs WHERE entity_type='CREW' AND entity_id='${crewA}' AND action='ORG_CREW_MEMBER_ADDED' AND after_data::text LIKE '%${WORKER4_ID}%' ORDER BY created_at DESC LIMIT 1`);
      const auDel = psqlT(`SELECT actor_user_id::text FROM audit_logs WHERE entity_type='CREW' AND entity_id='${crewA}' AND action='ORG_CREW_MEMBER_REMOVED' AND after_data::text LIKE '%${WORKER4_ID}%' ORDER BY created_at DESC LIMIT 1`);
      if (auAdd !== PM_ID) return fail(id, `audit ADDED actor=${auAdd} (mong PM ${PM_ID})`);
      if (auDel !== PM_ID) return fail(id, `audit REMOVED actor=${auDel} (mong PM ${PM_ID})`);
      return ok(id, `PM UI add + remove OK; audit actor đúng PM`);
    })();
  } finally {
    // ============ Cleanup id-based (audit giữ nguyên) ============
    try {
      await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' }).catch(() => {});
    } catch {}
    cleanup007([crewA, crewB]);
    await browser.close().catch(() => {});
  }

  const pass = results.filter((r) => r.ok).length;
  console.log(`\nTong: ${pass}/${results.length} PASS`);
  fs.writeFileSync(path.join(__dirname, 'e2e-vars.json'), JSON.stringify({
    digits: DIGITS, crewA, crewB, crewCodeA: CREW_A, crewCodeB: CREW_B, memberB, today: TODAY,
    worker1: WORKER1_ID, worker2: WORKER2_ID, worker3: WORKER3_ID, worker4: WORKER4_ID,
    worker3Name: WORKER3_NAME, worker4Name: WORKER4_NAME,
    results,
  }, null, 2));
  if (pass !== results.length) process.exit(1);
})();
