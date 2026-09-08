/**
 * PRJ-SRS-008 (#39) E2E driver — Mẫu công việc (work order templates).
 * Evidence-only script; phạm vi docs/evidence — KHÔNG commit, KHÔNG sửa source.
 *
 * Chạy:   node e2e-driver-prj-srs-008.cjs
 * Yêu cầu: stack từ working tree (api có work-order-templates #39, web có
 *          work-order-templates slice); PM quoc.tran@vinacons.vn / E2EPm@2025
 *          (UI + writes) + ADMIN hoang.anh@vinacons.vn / E2EAdmin@2025 (audit read).
 *
 * Seed (seed-prj-srs-008.sql, fixed UUID, ON CONFLICT DO NOTHING):
 *   trade INACTIVE THO-NGUNG-KS (M7) + template ACTIVE WOT-BE-TONG-COT
 *   + template DRAFT WOT-SON-TUONG (dùng work type BT-CT + trades thật).
 *
 * Luồng: seed → M1 tạo mẫu qua dialog (DRAFT v1) → M2 kích hoạt ACTIVE (audit) →
 * M3 picker /active chứa mẫu → M6a chụp snapshot (giả định WO copy) →
 * M4 sửa UI (version bump + persists) + 409 stale expectedVersion →
 * M6b snapshot copy bất biến → M5 INACTIVE → khỏi picker →
 * M7 validation (trade inactive / checklist thiếu title) → cleanup id-based.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { chromium } = require('/home/trung/.npm-global/lib/node_modules/@playwright/mcp/node_modules/playwright-core');

const WEB = 'http://localhost:3001';
const API = 'http://localhost:3000';
const SHOTS = path.join(__dirname, 'shots');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const PM_EMAIL = 'quoc.tran@vinacons.vn';
const PM_PASS = 'E2EPm@2025';
const ADMIN_EMAIL = 'hoang.anh@vinacons.vn';
const ADMIN_PASS = 'E2EAdmin@2025';

const WT_BTCT_ID = 'e2e4b200-0000-4000-8000-0000000000b3'; // BT-CT thật, ACTIVE
const TRADE_OPLAT_ID = 'b017178a-daf2-4614-ac34-a05e1d1a6fb7'; // OP-LAT thật, ACTIVE
const TRADE_INACTIVE_ID = 'c8000001-0001-4000-8000-000000000001'; // THO-NGUNG-KS seed
const SEED_ACTIVE_ID = 'c80000a1-0001-4000-8000-000000000001'; // WOT-BE-TONG-COT
const SEED_DRAFT_ID = 'c80000a1-0002-4000-8000-000000000002'; // WOT-SON-TUONG

const DRIVER_CODE = 'WOT-E2E-BE-TONG';
const DRIVER_NAME = 'Đổ bê tông dầm sàn chuẩn';
const DRIVER_NAME_V2 = 'Đổ bê tông dầm sàn chuẩn (bản cập nhật T9)';
const CHECK_OLD_TITLE = 'Kiểm tra cốp pha dầm sàn';
const CHECK_NEW_TITLE = 'Kiểm tra cốp pha, cốt thép dầm sàn (sửa T9)';

const results = [];
function ok(id, note = '') { return { id, ok: true, note }; }
function fail(id, note) { return { id, ok: false, note }; }
async function runStep(id, name, fn) {
  try {
    const r = await fn(id);
    results.push({ ...r, name });
    console.log(`${r.ok ? 'PASS' : 'FAIL'} ${id} ${name}${r.note ? ' :: ' + String(r.note).split('\n')[0] : ''}`);
    if (!r.ok && r.note) console.log(`  detail: ${String(r.note).slice(0, 2000)}`);
    return r;
  } catch (err) {
    results.push({ id, name, ok: false, note: err && err.message ? err.message : String(err) });
    console.log(`ERROR ${id} ${name} :: ${err && err.message ? err.message : err}`);
    return results[results.length - 1];
  }
}
async function snap(page, id, desc) {
  await page.screenshot({ path: path.join(SHOTS, `${id}.png`), fullPage: false });
  console.log(`  shot ${id}.png — ${desc}`);
}

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
  return { status: res.status, body: json };
}
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16));
}
async function getToken(email, password) {
  const r = await api('POST', '/api/v1/auth/login', null, { email, password });
  return r.body && r.body.accessToken ? r.body.accessToken : null;
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
async function bodyText(page) {
  return (await page.locator('body').textContent()) || '';
}
async function findTemplateIdByCode(token, code) {
  const r = await api('GET', `/api/v1/work-order-templates?status=ALL&search=${encodeURIComponent(code)}&limit=20`, token);
  const rows = (r.body && r.body.data) || [];
  const hit = rows.find((x) => x.code === code);
  return hit ? hit.id : null;
}

/** Cleanup id-based: driver template (theo code) + seed templates + seed trade. Audit giữ nguyên. */
function cleanupRun() {
  psqlT(`DELETE FROM work_order_templates WHERE code='${DRIVER_CODE}' OR code='WOT-E2E-RONG' OR id IN ('${SEED_ACTIVE_ID}','${SEED_DRAFT_ID}')`);
  psqlT(`DELETE FROM trades WHERE id='${TRADE_INACTIVE_ID}'`);
}
function restCount() {
  return psqlT(`SELECT count(*) FROM work_order_templates WHERE code='${DRIVER_CODE}' OR code='WOT-E2E-RONG' OR id IN ('${SEED_ACTIVE_ID}','${SEED_DRAFT_ID}')`)
    + '/' + psqlT(`SELECT count(*) FROM trades WHERE id='${TRADE_INACTIVE_ID}'`);
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

  const pmToken = await getToken(PM_EMAIL, PM_PASS);
  const adminToken = await getToken(ADMIN_EMAIL, ADMIN_PASS);
  if (!pmToken || !adminToken) {
    console.error(`Không lấy được token (pm=${!!pmToken} admin=${!!adminToken})`);
    await browser.close().catch(() => {});
    process.exit(2);
  }

  // ---- Setup: pre-cleanup + seed + verify ----
  cleanupRun();
  const seedSql = fs.readFileSync(path.join(__dirname, 'seed-prj-srs-008.sql'), 'utf8');
  const seedRun = spawnSync('docker', ['exec', '-i', 'buildflow-postgres-1', 'psql', '-U', 'buildflow', '-d', 'buildflow', '-v', 'ON_ERROR_STOP=1'],
    { input: seedSql, encoding: 'utf8', timeout: 20000 });
  if (seedRun.status !== 0) {
    console.error(`SEED FAIL ${(seedRun.stderr || '').slice(0, 500)}`);
    await browser.close().catch(() => {});
    process.exit(2);
  }
  const seedCheck = psqlT(`SELECT string_agg(code, ',' ORDER BY code) FROM work_order_templates WHERE id IN ('${SEED_ACTIVE_ID}','${SEED_DRAFT_ID}')`);
  const tradeCheck = psqlT(`SELECT is_active FROM trades WHERE id='${TRADE_INACTIVE_ID}'`);
  console.log(`setup: seed templates=${seedCheck} inactive_trade=${tradeCheck}`);
  if (seedCheck !== 'WOT-BE-TONG-COT,WOT-SON-TUONG' || tradeCheck !== 'f') {
    console.error('SEED VERIFY FAIL');
    await browser.close().catch(() => {});
    process.exit(2);
  }
  const auditBaseline = psqlT('SELECT count(*) FROM audit_logs');

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  await loginWeb(page, PM_EMAIL, PM_PASS);

  let driverId = null;
  let woSnapshotCopy = null; // bản copy "giả định WO" (M6): checklist_snapshot tại thời điểm áp dụng
  let woSnapshotSource = null;

  // ============ M1: tạo mẫu qua dialog → DRAFT v1 ============
  await runStep('M1', 'Tạo mẫu qua dialog (full fields + checklist 3 mục) → DRAFT version 1', async (id) => {
    await page.goto(`${WEB}/work-order-templates`, { waitUntil: 'networkidle' });
    let t = await bodyText(page);
    if (!t.includes('Mẫu công việc')) return fail(id, `trang list không hiện 'Mẫu công việc': ${t.slice(0, 300)}`);
    await page.getByRole('button', { name: 'Thêm mới' }).click();
    await page.getByLabel('Mã mẫu công việc *').fill(DRIVER_CODE);
    await page.getByLabel('Tên mẫu công việc *').fill(DRIVER_NAME);
    await page.locator('#wot-description').fill('Mẫu đổ bê tông dầm sàn: kiểm tra cốp pha, đổ đúng mác, bảo dưỡng (E2E #39).');
    await page.waitForSelector(`#wot-worktype option[value="${WT_BTCT_ID}"]`, { state: 'attached', timeout: 20000 });
    await page.locator('#wot-worktype').selectOption(WT_BTCT_ID);
    await page.waitForSelector(`#wot-trade option[value="${TRADE_OPLAT_ID}"]`, { state: 'attached', timeout: 20000 });
    await page.locator('#wot-trade').selectOption(TRADE_OPLAT_ID);
    await page.locator('#wot-duration').fill('150');
    await page.locator('#wot-priority').selectOption('HIGH');
    await page.getByRole('button', { name: 'Thêm kỹ năng' }).click();
    await page.getByLabel('Kỹ năng 1: code').fill('DIEN');
    await page.getByLabel('Kỹ năng 1: nhãn hiển thị').fill('Thợ điện công trình');
    const titles = [CHECK_OLD_TITLE, 'Đổ bê tông đúng mác thiết kế', 'Bảo dưỡng sau đổ 7 ngày'];
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: 'Thêm mục checklist' }).click();
      await page.getByLabel(`Checklist mục ${i + 1}: tiêu đề`).fill(titles[i]);
    }
    await page.getByLabel('Checklist mục 2: kiểu trả lời').selectOption('TEXT');
    await page.getByRole('button', { name: 'Tạo mẫu công việc' }).click();
    await page.waitForFunction(
      (txt) => (document.body.textContent || '').includes(txt),
      'Tạo mẫu công việc thành công',
      { timeout: 20000 },
    );
    await page.waitForFunction(
      () => !(document.body.textContent || '').includes('Thêm mẫu công việc'),
      null,
      { timeout: 20000 },
    );
    await page.waitForFunction(
      (code) => (document.body.textContent || '').includes(code),
      DRIVER_CODE,
      { timeout: 20000 },
    );
    await snap(page, `${id}-created`, 'Tạo mẫu qua dialog → list hiện mã mới');

    driverId = await findTemplateIdByCode(pmToken, DRIVER_CODE);
    if (!driverId) return fail(id, 'tạo UI xong nhưng API search không thấy mã mới');
    const g = await api('GET', `/api/v1/work-order-templates/${driverId}`, pmToken);
    if (g.status !== 200) return fail(id, `GET /:id status=${g.status}`);
    if (g.body.status !== 'DRAFT' || g.body.version !== 1) {
      return fail(id, `mong DRAFT v1, nhận status=${g.body.status} version=${g.body.version}`);
    }
    if ((g.body.checklistSnapshot || []).length !== 3) {
      return fail(id, `mong 3 checklist, nhận ${(g.body.checklistSnapshot || []).length}`);
    }
    return ok(id, `UI tạo OK; API DRAFT v1, checklist=3, id=${driverId.slice(0, 8)}…`);
  });

  // ============ M2: kích hoạt ACTIVE (audit) ============
  await runStep('M2', 'Kích hoạt ACTIVE qua dialog + audit PRJ_WO_TEMPLATE_STATUS_CHANGED', async (id) => {
    if (!driverId) return fail(id, 'thiếu driverId (M1 fail)');
    await page.goto(`${WEB}/work-order-templates/${driverId}`, { waitUntil: 'networkidle' });
    let t = await bodyText(page);
    if (!t.includes(DRIVER_NAME)) return fail(id, `detail không hiện tên mẫu: ${t.slice(0, 300)}`);
    await page.getByRole('button', { name: 'Kích hoạt', exact: true }).click();
    await page.locator('#wot-status-reason').fill('Đã rà soát định mức, đưa vào dùng đợt T9/2026');
    await page.getByRole('button', { name: 'Xác nhận' }).click();
    await page.waitForFunction(
      (txt) => (document.body.textContent || '').includes(txt),
      'Hoạt động',
      { timeout: 20000 },
    );
    await snap(page, `${id}-active`, 'Kích hoạt qua dialog → badge Hoạt động');

    const g = await api('GET', `/api/v1/work-order-templates/${driverId}`, pmToken);
    if (g.body.status !== 'ACTIVE') return fail(id, `API status=${g.body.status} (mong ACTIVE)`);
    const a = await api('GET', '/api/v1/audit-logs?action=PRJ_WO_TEMPLATE_STATUS_CHANGED&limit=10', adminToken);
    const rows = (a.body && a.body.data) || [];
    const hit = rows.find((r) => r.entityId === driverId);
    if (!hit) return fail(id, `không thấy audit STATUS_CHANGED cho mẫu: ${JSON.stringify(a.body).slice(0, 300)}`);
    return ok(id, `ACTIVE + audit id=${hit.id}; UI badge Hoạt động`);
  });

  // ============ M3: picker /active ============
  await runStep('M3', 'Mẫu ACTIVE xuất hiện trong picker GET /active (điểm tiêu thụ JOB-SRS-001)', async (id) => {
    if (!driverId) return fail(id, 'thiếu driverId (M1 fail)');
    const r = await api('GET', '/api/v1/work-order-templates/active', pmToken);
    if (r.status !== 200) return fail(id, `GET /active status=${r.status}`);
    const ids = (r.body.data || []).map((x) => x.id);
    if (!ids.includes(driverId)) return fail(id, `/active thiếu mẫu driver (n=${ids.length})`);
    if (!ids.includes(SEED_ACTIVE_ID)) return fail(id, '/active thiếu template seed WOT-BE-TONG-COT');
    if (ids.includes(SEED_DRAFT_ID)) return fail(id, '/active lọt template DRAFT seed');
    return ok(id, `/active n=${ids.length}: có driver + seed ACTIVE, không DRAFT`);
  });

  // ============ M6a: chụp snapshot (giả định WO copy tại thời điểm áp dụng) ============
  await runStep('M6a', 'Chụp checklist_snapshot làm bản copy giả định WO (forward-ref JOB)', async (id) => {
    if (!driverId) return fail(id, 'thiếu driverId (M1 fail)');
    const g = await api('GET', `/api/v1/work-order-templates/${driverId}`, pmToken);
    if (g.status !== 200) return fail(id, `GET /:id status=${g.status}`);
    woSnapshotSource = JSON.stringify(g.body.checklistSnapshot);
    // Giả định WO: copy snapshot tại thời điểm áp dụng (chưa có JOB endpoint —
    // copy thực hiện ở đây đúng semantics snapshot-copy T4: pass-by-value).
    woSnapshotCopy = JSON.parse(woSnapshotSource);
    const dbBytes = psqlT(`SELECT checklist_snapshot::text FROM work_order_templates WHERE id='${driverId}'`);
    if (dbBytes.startsWith('PSQL ERROR')) return fail(id, dbBytes);
    return ok(id, `WO copy giữ ${woSnapshotCopy.length} mục; DB snapshot bytes=${dbBytes.length}`);
  });

  // ============ M4: sửa UI → version bump + persists; 409 stale ============
  await runStep('M4', 'Sửa qua dialog → version bump + persists; expectedVersion stale → 409 + notice', async (id) => {
    if (!driverId) return fail(id, 'thiếu driverId (M1 fail)');
    await page.goto(`${WEB}/work-order-templates/${driverId}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Sửa' }).click();
    await page.waitForFunction(
      () => (document.body.textContent || '').includes('Sửa mẫu công việc'),
      null,
      { timeout: 20000 },
    );
    const codeVal = await page.getByLabel('Mã mẫu công việc *').inputValue();
    if (codeVal !== DRIVER_CODE) return fail(id, `prefill sai: code=${codeVal}`);
    await page.getByLabel('Tên mẫu công việc *').fill(DRIVER_NAME_V2);
    await page.getByLabel('Checklist mục 1: tiêu đề').fill(CHECK_NEW_TITLE);
    await snap(page, `${id}-editdialog`, 'Dialog sửa prefill + đổi tên/checklist');
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await page.waitForFunction(
      (txt) => (document.body.textContent || '').includes(txt),
      'Cập nhật mẫu công việc thành công',
      { timeout: 20000 },
    );
    await page.waitForFunction(
      (txt) => (document.body.textContent || '').includes(txt),
      DRIVER_NAME_V2,
      { timeout: 20000 },
    );

    const g = await api('GET', `/api/v1/work-order-templates/${driverId}`, pmToken);
    if (g.body.version !== 2) return fail(id, `mong version=2 sau sửa, nhận ${g.body.version}`);
    if (g.body.name !== DRIVER_NAME_V2) return fail(id, `tên không persists: ${g.body.name}`);
    if ((g.body.checklistSnapshot || [])[0].title !== CHECK_NEW_TITLE) {
      return fail(id, 'checklist item 1 không persists');
    }
    const stale = await api('PATCH', `/api/v1/work-order-templates/${driverId}`, pmToken,
      { name: 'Ghi đè stale', expectedVersion: 1 }, { 'X-Correlation-Id': uuid() });
    if (stale.status !== 409) return fail(id, `stale PATCH status=${stale.status} (mong 409)`);
    const sb = JSON.stringify(stale.body || {});
    if (!sb.includes('WORK_ORDER_TEMPLATE_CONFIG_CONFLICT')) {
      return fail(id, `409 thiếu code CONFLICT: ${sb.slice(0, 300)}`);
    }
    const g2 = await api('GET', `/api/v1/work-order-templates/${driverId}`, pmToken);
    if (g2.body.name !== DRIVER_NAME_V2) return fail(id, 'stale PATCH đã ghi đè dữ liệu (mất bảo vệ lạc quan)');
    return ok(id, 'UI sửa OK v1→v2 persists; stale expectedVersion=1 → 409 CONFLICT, dữ liệu nguyên vẹn');
  });

  // ============ M6b: snapshot copy bất biến sau khi sửa template ============
  await runStep('M6b', 'WO copy bất biến sau khi template sửa (version+1)', async (id) => {
    if (!driverId || !woSnapshotCopy) return fail(id, 'thiếu driverId/WO copy (M1/M6a fail)');
    const g = await api('GET', `/api/v1/work-order-templates/${driverId}`, pmToken);
    const live = JSON.stringify(g.body.checklistSnapshot);
    const copyBytes = JSON.stringify(woSnapshotCopy);
    if (copyBytes !== woSnapshotSource) return fail(id, 'bản WO copy đã bị đổi (mong byte-equal trước/sau)');
    if (live === copyBytes) return fail(id, 'template sau sửa giống hệt copy (sửa M4 không có hiệu lực?)');
    if (woSnapshotCopy[0].title !== CHECK_OLD_TITLE) {
      return fail(id, `WO copy item1 đã đổi: ${woSnapshotCopy[0].title}`);
    }
    if (g.body.version !== 2) return fail(id, `template version=${g.body.version} (mong 2)`);
    return ok(id, `WO copy byte-equal trước/sau (item1='${CHECK_OLD_TITLE}'); template v2 item1='${CHECK_NEW_TITLE}'`);
  });

  // ============ M5: INACTIVE → khỏi picker ============
  await runStep('M5', 'Ngừng hoạt động → không còn trong picker /active', async (id) => {
    if (!driverId) return fail(id, 'thiếu driverId (M1 fail)');
    await page.goto(`${WEB}/work-order-templates/${driverId}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Ngừng hoạt động', exact: true }).click();
    await page.locator('#wot-status-reason').fill('Tạm ngừng để rà soát lại định mức (E2E #39)');
    await page.getByRole('button', { name: 'Xác nhận' }).click();
    await page.waitForFunction(
      (txt) => (document.body.textContent || '').includes(txt),
      'Ngừng hoạt động',
      { timeout: 20000 },
    );
    await snap(page, `${id}-inactive`, 'Ngừng hoạt động qua dialog → badge Ngừng hoạt động');

    const g = await api('GET', `/api/v1/work-order-templates/${driverId}`, pmToken);
    if (g.body.status !== 'INACTIVE') return fail(id, `API status=${g.body.status} (mong INACTIVE)`);
    const r = await api('GET', '/api/v1/work-order-templates/active', pmToken);
    const ids = (r.body.data || []).map((x) => x.id);
    if (ids.includes(driverId)) return fail(id, '/active vẫn chứa mẫu đã INACTIVE');
    return ok(id, `INACTIVE (detail đọc được lịch sử); /active n=${ids.length} không chứa mẫu`);
  });

  // ============ M7: validation ============
  await runStep('M7', 'Validation: trade INACTIVE → 400; checklist thiếu title → 400', async (id) => {
    const badTrade = await api('PATCH', `/api/v1/work-order-templates/${SEED_DRAFT_ID}`, pmToken,
      { requiredTradeId: TRADE_INACTIVE_ID }, { 'X-Correlation-Id': uuid() });
    if (badTrade.status !== 400) {
      return fail(id, `trade inactive PATCH status=${badTrade.status} (mong 400) body=${JSON.stringify(badTrade.body).slice(0, 300)}`);
    }
    const badCheck = await api('POST', '/api/v1/work-order-templates', pmToken,
      {
        code: 'WOT-E2E-RONG', name: 'Mẫu lỗi thiếu title',
        requiredSkills: [{ code: 'DIEN', label: 'Thợ điện công trình' }],
        checklistSnapshot: [{ answerType: 'YES_NO', isRequired: true, isBlocking: false, sequenceNo: 1 }],
      }, { 'X-Correlation-Id': uuid() });
    if (badCheck.status !== 400) {
      return fail(id, `checklist thiếu title POST status=${badCheck.status} (mong 400) body=${JSON.stringify(badCheck.body).slice(0, 300)}`);
    }
    const cb = JSON.stringify(badCheck.body || {});
    if (!/title/i.test(cb)) return fail(id, `400 checklist không nêu title: ${cb.slice(0, 300)}`);
    const cnt = psqlT(`SELECT count(*) FROM work_order_templates WHERE code='WOT-E2E-RONG'`);
    if (cnt !== '0') return fail(id, 'bản ghi lỗi đã lọt vào DB');
    return ok(id, 'trade INACTIVE → 400 fieldErrors; checklist thiếu title → 400; không bản ghi lạ');
  });

  // ============ Cleanup + vars ============
  cleanupRun();
  const rest = restCount();
  const auditFinal = psqlT('SELECT count(*) FROM audit_logs');
  const allOk = results.every((r) => r.ok);
  const vars = {
    _note: 'Throwaway E2E-only demo credentials (seed/reset per evidence docs). Never production.',
    pm: PM_EMAIL,
    admin: ADMIN_EMAIL,
    driverCode: DRIVER_CODE,
    driverId,
    driverNameV2: DRIVER_NAME_V2,
    seedActive: SEED_ACTIVE_ID,
    seedDraft: SEED_DRAFT_ID,
    inactiveTrade: TRADE_INACTIVE_ID,
    woSnapshotCopy,
    auditBaseline,
    auditFinal,
    rest,
    results: results.map((r) => ({ id: r.id, ok: r.ok, note: r.note })),
  };
  fs.writeFileSync(path.join(__dirname, 'e2e-vars.json'), `${JSON.stringify(vars, null, 2)}\n`);
  console.log(`cleanup: rest(templates/trades)=${rest}, audit ${auditBaseline}→${auditFinal}`);
  console.log(`TỔNG: ${results.filter((r) => r.ok).length}/${results.length} PASS`);
  await browser.close().catch(() => {});
  process.exit(allOk && rest === '0/0' ? 0 : 1);
})().catch((e) => { console.error('DRIVER FATAL', e); process.exit(2); });
