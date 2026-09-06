/**
 * ORG-SRS-008 E2E driver — Điều kiện nhận việc / eligibility (issue #31).
 * Evidence-only script; phạm vi docs/evidence — KHÔNG commit, KHÔNG sửa source.
 *
 * Chạy:   node e2e-driver-org-srs-008.cjs
 * Yêu cầu: stack rebuild từ working tree (api có /api/v1/eligibility/*,
 *          web có checklist + /my-eligibility, mobile có /eligibility);
 *          admin (E2EAdmin@2025) + pm (E2EPm@2025) + worker1 (E2EWorker@2025).
 *
 * Luồng: seed 2 workers E2E8 (zero-trade + skill-3) + crew E2E8-CREW (leader
 * worker2, member worker1, trade THO-CAT) → S1 ADMIN checklist + shape →
 * S2 fail-closed → S3 skill match/low → S4 suspend/reactivate worker →
 * S5 PM ok + worker 403 → S6 /my-eligibility worker + admin 404 →
 * S7 crew eligibility + suspend/reactivate → S8/S9/S10 mobile →
 * S11 correlation + audit. Cleanup entity cuối run (audit giữ nguyên).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { chromium } = require('/home/trung/.npm-global/lib/node_modules/@playwright/mcp/node_modules/playwright-core');

const WEB = 'http://localhost:3001';
const MOB = 'http://localhost:19006';
const API = 'http://localhost:3000';
const SHOTS = path.join(__dirname, 'shots');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASS = 'E2EAdmin@2025';
const PM_EMAIL = 'pm@example.com';
const PM_PASS = 'E2EPm@2025';
const WORKER_EMAIL = 'worker1@example.com';
const WORKER_PASS = 'E2EWorker@2025';

const WORKER1_ID = '33333333-3333-4333-8333-333333333333';
const WORKER2_ID = '44444444-4444-4444-8444-444444444444';
const THO_CAT = '11111111-1111-4111-8111-111111111111';
const CREW_CODE = 'E2E8-CREW';
const ZERO_EMAIL = 'e2e8-zero@example.com';
const SKILL3_EMAIL = 'e2e8-skill3@example.com';
const E2E_PASS = 'E2EWorker@2025';
const REASON_SUSPEND = 'E2E8 tam ngung: kiem dinh eligibility';
const TODAY = new Date().toISOString().slice(0, 10);
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
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16));
}
function cond(list, code) {
  return (list || []).find((c) => c.code === code) || null;
}

async function cleanupE2E8() {
  const crewId = psqlT(`SELECT id FROM crews WHERE code='${CREW_CODE}'`);
  if (crewId && UUID_RE.test(crewId)) {
    psqlT(`DELETE FROM crew_members WHERE crew_id='${crewId}'`);
    psqlT(`DELETE FROM resource_trades WHERE crew_id='${crewId}'`);
    psqlT(`DELETE FROM crews WHERE id='${crewId}'`);
  }
  for (const em of [ZERO_EMAIL, SKILL3_EMAIL]) {
    const uid = psqlT(`SELECT id FROM users WHERE lower(email)=lower('${em}')`);
    if (uid && UUID_RE.test(uid)) {
      psqlT(`DELETE FROM crew_members WHERE user_id='${uid}'`);
      psqlT(`DELETE FROM resource_trades WHERE user_id='${uid}'`);
      psqlT(`DELETE FROM user_roles WHERE user_id='${uid}'`);
      psqlT(`DELETE FROM users WHERE id='${uid}'`);
    }
  }
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

  // ---- Setup: pre-cleanup + tạo 2 workers + 1 crew + member + crew trade ----
  await cleanupE2E8();
  let zeroId = null;
  let skill3Id = null;
  let crewId = null;
  {
    const z = await api('POST', '/api/v1/workers', adminToken,
      { email: ZERO_EMAIL, password: E2E_PASS, fullName: 'E2E8 Zero Trade' },
      { 'X-Correlation-Id': uuid() });
    const s = await api('POST', '/api/v1/workers', adminToken,
      { email: SKILL3_EMAIL, password: E2E_PASS, fullName: 'E2E8 Skill Three', trades: [{ tradeId: THO_CAT, skillLevel: 3 }] },
      { 'X-Correlation-Id': uuid() });
    if (z.status !== 201 || s.status !== 201) {
      console.error(`Tạo workers thất bại zero=${z.status} ${JSON.stringify(z.body)} skill3=${s.status} ${JSON.stringify(s.body)}`);
      await browser.close().catch(() => {});
      process.exit(2);
    }
    zeroId = z.body.id;
    skill3Id = s.body.id;
    const c = await api('POST', '/api/v1/crews', adminToken,
      { code: CREW_CODE, name: 'E2E8 Doi Kiem Dinh', leaderUserId: WORKER2_ID },
      { 'X-Correlation-Id': uuid() });
    if (c.status !== 201 && c.status !== 200) {
      console.error(`Tạo crew thất bại ${c.status} ${JSON.stringify(c.body)}`);
      await browser.close().catch(() => {});
      process.exit(2);
    }
    crewId = c.body.id;
    const m = await api('POST', `/api/v1/crews/${crewId}/members`, adminToken,
      { userId: WORKER1_ID, effectiveFrom: TODAY }, { 'X-Correlation-Id': uuid() });
    if (m.status !== 201 && m.status !== 200) {
      console.error(`Thêm worker1 vào crew thất bại ${m.status} ${JSON.stringify(m.body)}`);
      await browser.close().catch(() => {});
      process.exit(2);
    }
    const seedSql = fs.readFileSync(path.join(__dirname, 'seed-008.sql'), 'utf8');
    const seedRun = spawnSync('docker', ['exec', '-i', 'buildflow-postgres-1', 'psql', '-U', 'buildflow', '-d', 'buildflow', '-v', 'ON_ERROR_STOP=1'],
      { input: seedSql, encoding: 'utf8', timeout: 20000 });
    console.log(`seed crew-trade: ${seedRun.status === 0 ? 'ok' : 'FAIL ' + (seedRun.stderr || '').slice(0, 300)}`);
    console.log(`setup: zero=${zeroId} skill3=${skill3Id} crew=${crewId} today=${TODAY}`);
  }
  const auditBaseline = psqlT('SELECT count(*) FROM audit_logs');

  const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pmCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const workerCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const adminPage = await adminCtx.newPage();
  const pmPage = await pmCtx.newPage();
  const workerPage = await workerCtx.newPage();
  for (const p of [adminPage, pmPage, workerPage]) p.setDefaultTimeout(30000);

  // Khớp tương quan UI ↔ API ở S1: chặn response eligibility để lấy correlationId thật.
  let s1Captured = null;
  await adminPage.route('**/api/v1/eligibility/workers/**', async (route) => {
    const res = await route.fetch();
    try { s1Captured = await res.json(); } catch {}
    await route.fulfill({ response: res });
  });

  try {
    // ============ S1: ADMIN checklist + shape ============
    await step('S1', 'ADMIN /workers/:id checklist đủ condition + verdict + correlationId; API shape', async (id) => {
      await loginWeb(adminPage, ADMIN_EMAIL, ADMIN_PASS);
      await adminPage.goto(`${WEB}/workers/${WORKER1_ID}`, { waitUntil: 'networkidle' });
      await adminPage.waitForFunction(() => (document.body.textContent || '').includes('Điều kiện nhận việc'), { timeout: 20000 });
      await adminPage.waitForFunction(() => (document.body.textContent || '').includes('Mã đối chiếu:'), { timeout: 20000 });
      await snap(adminPage, `${id}-checklist`, 'Checklist worker1 (fail-closed, 5 conditions)');
      const t = await bodyText(adminPage);
      const need = ['Hồ sơ hiệu lực', 'Ngành nghề / kỹ năng', 'Dữ liệu năng lực', 'Khối lượng công việc', 'Trùng lịch',
        'KHÔNG ĐÁNH GIÁ ĐƯỢC', 'Không đủ điều kiện nhận việc', 'Mã đối chiếu:', 'Kiểm tra lại'];
      const miss = need.filter((x) => !t.includes(x));
      if (miss.length) return fail(id, `UI thiếu: ${miss.join(' | ')}`);
      if (!s1Captured || s1Captured.resourceType !== 'WORKER' || s1Captured.resourceId !== WORKER1_ID
        || typeof s1Captured.eligible !== 'boolean' || !s1Captured.checkedAt || !s1Captured.correlationId
        || !Array.isArray(s1Captured.conditions) || !Array.isArray(s1Captured.crews)) {
        return fail(id, `API shape sai: ${JSON.stringify(s1Captured).slice(0, 400)}`);
      }
      if (!UUID_RE.test(s1Captured.correlationId)) return fail(id, `correlationId không phải UUID: ${s1Captured.correlationId}`);
      if (!t.includes(s1Captured.correlationId)) return fail(id, 'UI không hiện đúng correlationId của response');
      const codes = s1Captured.conditions.map((c) => c.code).join(',');
      if (codes !== 'RESOURCE_ACTIVE,TRADE_SKILL_MATCH,TRADE_CAPABILITY_DATA,WORKLOAD,SCHEDULE_CONFLICT') {
        return fail(id, `thứ tự condition sai: ${codes}`);
      }
      const sched = cond(s1Captured.conditions, 'SCHEDULE_CONFLICT');
      if (!(sched && sched.passed === null && sched.reasonCode === 'NOT_EVALUABLE')) return fail(id, 'SCHEDULE_CONFLICT không phải null/NOT_EVALUABLE');
      return ok(id, `UI đủ 5 conditions + verdict + Mã đối chiếu ${s1Captured.correlationId}; API shape chuẩn, eligible=${s1Captured.eligible}`);
    })();

    // ============ S2: fail-closed ============
    await step('S2', 'Worker zero-trade → CAPABILITY_DATA_MISSING, eligible=false, verdict lỗi', async (id) => {
      const r = await api('GET', `/api/v1/eligibility/workers/${zeroId}`, adminToken);
      if (r.status !== 200) return fail(id, `API status=${r.status} ${JSON.stringify(r.body)}`);
      const cap = cond(r.body.conditions, 'TRADE_CAPABILITY_DATA');
      if (r.body.eligible !== false) return fail(id, `eligible=${r.body.eligible} (mong false)`);
      if (!(cap && cap.passed === false && cap.reasonCode === 'CAPABILITY_DATA_MISSING')) {
        return fail(id, `capability=${JSON.stringify(cap)}`);
      }
      await adminPage.goto(`${WEB}/workers/${zeroId}`, { waitUntil: 'networkidle' });
      await adminPage.waitForFunction(() => (document.body.textContent || '').includes('Mã đối chiếu:'), { timeout: 20000 });
      await snap(adminPage, `${id}-failclosed`, 'Checklist zero-trade (verdict lỗi)');
      const t = await bodyText(adminPage);
      if (!t.includes('Không đủ điều kiện nhận việc')) return fail(id, 'UI thiếu verdict lỗi');
      if (!t.includes('KHÔNG ĐẠT')) return fail(id, 'UI thiếu badge KHÔNG ĐẠT');
      return ok(id, `API eligible=false + CAPABILITY_DATA_MISSING; UI verdict lỗi + badge KHÔNG ĐẠT`);
    })();

    // ============ S3: skill match ============
    await step('S3', 'Skill-3 worker: match ĐẠT; skillLevel=5 → SKILL_LEVEL_TOO_LOW + eligible=false', async (id) => {
      const m = await api('GET', `/api/v1/eligibility/workers/${skill3Id}?tradeId=${THO_CAT}&skillLevel=3`, adminToken);
      if (m.status !== 200) return fail(id, `match status=${m.status} ${JSON.stringify(m.body)}`);
      const tm = cond(m.body.conditions, 'TRADE_SKILL_MATCH');
      if (!(tm && tm.passed === true)) return fail(id, `match TRADE_SKILL_MATCH=${JSON.stringify(tm)}`);
      if (m.body.eligible !== true) return fail(id, `match eligible=${m.body.eligible} (mong true)`);
      const h = await api('GET', `/api/v1/eligibility/workers/${skill3Id}?tradeId=${THO_CAT}&skillLevel=5`, adminToken);
      if (h.status !== 200) return fail(id, `high status=${h.status}`);
      const th = cond(h.body.conditions, 'TRADE_SKILL_MATCH');
      if (!(th && th.passed === false && th.reasonCode === 'SKILL_LEVEL_TOO_LOW')) {
        return fail(id, `high TRADE_SKILL_MATCH=${JSON.stringify(th)}`);
      }
      if (h.body.eligible !== false) return fail(id, `high eligible=${h.body.eligible} (mong false)`);
      const bad = await api('GET', `/api/v1/eligibility/workers/${skill3Id}?tradeId=not-a-uuid`, adminToken);
      if (bad.status !== 400) return fail(id, `tradeId xấu status=${bad.status} (mong 400)`);
      return ok(id, `match ĐẠT eligible=true; skill5 SKILL_LEVEL_TOO_LOW eligible=false; tradeId xấu 400`);
    })();

    // ============ S4: suspend / re-activate worker ============
    await step('S4', 'Tạm ngừng worker (UI dialog + reason) → RESOURCE_INACTIVE; kích hoạt lại → passes', async (id) => {
      await adminPage.goto(`${WEB}/workers/${skill3Id}`, { waitUntil: 'networkidle' });
      await adminPage.waitForFunction(() => (document.body.textContent || '').includes('Điều kiện nhận việc'), { timeout: 20000 });
      await adminPage.locator('button', { hasText: 'Tạm ngừng' }).first().click();
      await adminPage.fill('#lifecycle-reason', REASON_SUSPEND);
      await adminPage.locator('button', { hasText: 'Xác nhận' }).first().click();
      await adminPage.waitForFunction(() => (document.body.textContent || '').includes('thành công'), { timeout: 20000 });
      await snap(adminPage, `${id}-suspended`, 'Worker SUSPEND thành công (UI)');
      const chk = await api('GET', `/api/v1/eligibility/workers/${skill3Id}`, adminToken);
      const ra = cond(chk.body.conditions, 'RESOURCE_ACTIVE');
      if (!(ra && ra.passed === false && ra.reasonCode === 'RESOURCE_INACTIVE')) {
        return fail(id, `sau suspend RESOURCE_ACTIVE=${JSON.stringify(ra)}`);
      }
      if (chk.body.eligible !== false) return fail(id, 'sau suspend eligible vẫn true');
      await adminPage.locator('button', { hasText: 'Kiểm tra lại' }).first().click();
      await adminPage.waitForFunction(() => (document.body.textContent || '').includes('không ở trạng thái hiệu lực'), { timeout: 20000 });
      await adminPage.locator('button', { hasText: 'Kích hoạt lại' }).first().click();
      await adminPage.locator('button', { hasText: 'Xác nhận' }).first().click();
      await adminPage.waitForFunction(() => (document.body.textContent || '').includes('Đã kích hoạt lại worker'), { timeout: 20000 });
      await snap(adminPage, `${id}-reactivated`, 'Worker ACTIVATE (current-data rule)');
      const back = await api('GET', `/api/v1/eligibility/workers/${skill3Id}`, adminToken);
      const rb = cond(back.body.conditions, 'RESOURCE_ACTIVE');
      if (!(rb && rb.passed === true)) return fail(id, `sau activate RESOURCE_ACTIVE=${JSON.stringify(rb)}`);
      return ok(id, `suspend → RESOURCE_INACTIVE eligible=false (UI refresh thấy); activate → RESOURCE_ACTIVE OK`);
    })();

    // ============ S5: PM đọc được, WORKER 403 ============
    await step('S5', 'PM xem được eligibility; worker1 mở /workers/:id → 403', async (id) => {
      await loginWeb(pmPage, PM_EMAIL, PM_PASS);
      await pmPage.goto(`${WEB}/workers/${skill3Id}`, { waitUntil: 'networkidle' });
      await pmPage.waitForFunction(() => (document.body.textContent || '').includes('Điều kiện nhận việc'), { timeout: 20000 });
      await snap(pmPage, `${id}-pm`, 'PM xem checklist worker');
      const tp = await bodyText(pmPage);
      if (!tp.includes('Mã đối chiếu:')) return fail(id, 'PM không thấy checklist');
      const wapi = await api('GET', `/api/v1/eligibility/workers/${skill3Id}`, workerToken);
      if (wapi.status !== 403) return fail(id, `worker API eligibility status=${wapi.status} (mong 403)`);
      await loginWeb(workerPage, WORKER_EMAIL, WORKER_PASS);
      await workerPage.goto(`${WEB}/workers/${skill3Id}`, { waitUntil: 'networkidle' });
      await workerPage.waitForFunction(() => (document.body.textContent || '').includes('Không có quyền truy cập'), { timeout: 20000 });
      await snap(workerPage, `${id}-worker403`, 'Worker 403 trên /workers/:id');
      return ok(id, `PM thấy checklist + Mã đối chiếu; worker API 403 + UI 403 'Không có quyền truy cập'`);
    })();

    // ============ S6: /my-eligibility ============
    await step('S6', '/my-eligibility worker1: checklist + crews; admin: 404 empty state', async (id) => {
      await workerPage.goto(`${WEB}/my-eligibility`, { waitUntil: 'networkidle' });
      await workerPage.waitForFunction(
        () => (document.body.textContent || '').includes('Mã đối chiếu:') || (document.body.textContent || '').includes('Tài khoản không có hồ sơ worker'),
        { timeout: 20000 });
      await snap(workerPage, `${id}-myeligibility`, 'worker1 tự kiểm tra (+ crews E2E8-CREW)');
      const t = await bodyText(workerPage);
      if (!t.includes('Mã đối chiếu:')) return fail(id, 'worker1 /my-eligibility không hiện checklist');
      if (!t.includes(CREW_CODE)) return fail(id, `thiếu crews membership ${CREW_CODE}`);
      const me = await api('GET', '/api/v1/eligibility/me', workerToken);
      if (me.status !== 200 || !Array.isArray(me.body.crews) || !me.body.crews.some((c) => c.crewCode === CREW_CODE)) {
        return fail(id, `/me crews thiếu ${CREW_CODE}: ${JSON.stringify(me.body).slice(0, 300)}`);
      }
      await adminPage.goto(`${WEB}/my-eligibility`, { waitUntil: 'networkidle' });
      await adminPage.waitForFunction(() => (document.body.textContent || '').includes('Tài khoản không có hồ sơ worker'), { timeout: 20000 });
      await snap(adminPage, `${id}-admin404`, 'admin 404 empty state (STAFF, không hồ sơ worker)');
      return ok(id, `worker1 checklist + crews ${CREW_CODE}; admin empty 'Tài khoản không có hồ sơ worker'`);
    })();

    // ============ S7: crew eligibility + suspend ============
    await step('S7', 'Crew checklist MEMBER_COVERAGE + workload; suspend → RESOURCE_INACTIVE; activate lại', async (id) => {
      const c0 = await api('GET', `/api/v1/eligibility/crews/${crewId}`, adminToken);
      if (c0.status !== 200) return fail(id, `crew API status=${c0.status} ${JSON.stringify(c0.body)}`);
      if (c0.body.resourceType !== 'CREW' || !Array.isArray(c0.body.members)) return fail(id, 'crew shape thiếu members[]');
      const mc0 = cond(c0.body.conditions, 'MEMBER_COVERAGE');
      const wl0 = cond(c0.body.conditions, 'WORKLOAD');
      if (!(mc0 && mc0.passed === true)) return fail(id, `MEMBER_COVERAGE=${JSON.stringify(mc0)}`);
      if (!(wl0 && wl0.passed === true)) return fail(id, `WORKLOAD=${JSON.stringify(wl0)}`);
      if (c0.body.eligible !== true) return fail(id, `crew eligible=${c0.body.eligible} (mong true: ACTIVE+trade+2 members)`);
      await adminPage.goto(`${WEB}/crews/${crewId}`, { waitUntil: 'networkidle' });
      await adminPage.waitForFunction(() => (document.body.textContent || '').includes('Điều kiện nhận việc'), { timeout: 20000 });
      await adminPage.waitForFunction(() => (document.body.textContent || '').includes('Phủ thành viên'), { timeout: 20000 });
      await snap(adminPage, `${id}-crew`, 'Checklist crew (MEMBER_COVERAGE + workload)');
      const tc = await bodyText(adminPage);
      if (!tc.includes('Khối lượng công việc')) return fail(id, 'UI crew thiếu Khối lượng công việc');
      await adminPage.locator('button', { hasText: 'Tạm ngừng' }).first().click();
      await adminPage.fill('#lifecycle-reason', REASON_SUSPEND);
      await adminPage.locator('button', { hasText: 'Xác nhận' }).first().click();
      await adminPage.waitForFunction(() => (document.body.textContent || '').includes('thành công'), { timeout: 20000 });
      const c1 = await api('GET', `/api/v1/eligibility/crews/${crewId}`, adminToken);
      const ra1 = cond(c1.body.conditions, 'RESOURCE_ACTIVE');
      if (!(ra1 && ra1.passed === false && ra1.reasonCode === 'RESOURCE_INACTIVE')) {
        return fail(id, `sau suspend crew RESOURCE_ACTIVE=${JSON.stringify(ra1)}`);
      }
      if (c1.body.eligible !== false) return fail(id, 'sau suspend crew eligible vẫn true');
      await snap(adminPage, `${id}-crew-suspended`, 'Crew SUSPEND thành công (UI)');
      await adminPage.locator('button', { hasText: 'Kích hoạt lại' }).first().click();
      await adminPage.locator('button', { hasText: 'Xác nhận' }).first().click();
      await adminPage.waitForFunction(() => (document.body.textContent || '').includes('thành công') || (document.body.textContent || '').includes('Đã kích hoạt lại'), { timeout: 20000 });
      const c2 = await api('GET', `/api/v1/eligibility/crews/${crewId}`, adminToken);
      if (c2.body.eligible !== true) return fail(id, `sau activate crew eligible=${c2.body.eligible} (mong true)`);
      return ok(id, `crew eligible=true (MEMBER_COVERAGE OK); suspend → RESOURCE_INACTIVE false; activate → true lại`);
    })();

    // ============ S8/S9/S10: mobile ============
    async function mobileLogin(email, password) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await ctx.newPage();
      page.setDefaultTimeout(60000);
      await page.goto(`${MOB}/`, { waitUntil: 'domcontentloaded' });
      await page.getByLabel('email input').waitFor({ timeout: 120000 });
      await page.getByLabel('email input').fill(email);
      await page.getByLabel('password input').fill(password);
      await page.getByLabel('login submit').click();
      await page.waitForFunction(() => (document.body.textContent || '').includes('Xin chào,'), { timeout: 60000 });
      await page.getByLabel('view profile').click();
      await page.waitForFunction(() => (document.body.textContent || '').includes('Hồ sơ cá nhân'), { timeout: 60000 });
      return { ctx, page };
    }

    await step('S8', 'Mobile worker1 → eligibility: verdict + conditions từ API thật', async (id) => {
      const { ctx, page } = await mobileLogin(WORKER_EMAIL, WORKER_PASS);
      try {
        await page.getByLabel('view eligibility').click();
        await page.waitForFunction(() => (document.body.textContent || '').includes('Điều kiện nhận việc'), { timeout: 60000 });
        await page.waitForFunction(() => (document.body.textContent || '').includes('Mã đối chiếu:'), { timeout: 60000 });
        await snap(page, `${id}-mobile`, 'Mobile eligibility worker1 (fail-closed, crews)');
        const t = await bodyText(page);
        const need = ['Chưa đủ điều kiện nhận việc', 'TRADE_CAPABILITY_DATA', 'Mã đối chiếu:', CREW_CODE, 'Kiểm tra lại'];
        const miss = need.filter((x) => !t.includes(x));
        if (miss.length) return fail(id, `mobile thiếu: ${miss.join(' | ')}`);
        return ok(id, `mobile verdict fail-closed + conditions + crews ${CREW_CODE} từ API thật`);
      } finally {
        await ctx.close().catch(() => {});
      }
    })();

    await step('S9', 'Mobile admin → 404 empty Tài khoản không có hồ sơ worker', async (id) => {
      const { ctx, page } = await mobileLogin(ADMIN_EMAIL, ADMIN_PASS);
      try {
        await page.getByLabel('view eligibility').click();
        await page.waitForFunction(() => (document.body.textContent || '').includes('Tài khoản không có hồ sơ worker'), { timeout: 60000 });
        await snap(page, `${id}-mobile404`, 'Mobile 404 empty state (admin)');
        return ok(id, `mobile admin empty state đúng, không báo lỗi`);
      } finally {
        await ctx.close().catch(() => {});
      }
    })();

    await step('S10', 'Mobile retry: request đầu 500 → lỗi + Thử lại → retry thành công', async (id) => {
      const { ctx, page } = await mobileLogin(WORKER_EMAIL, WORKER_PASS);
      try {
        let n = 0;
        await page.route('**/api/v1/eligibility/me', async (route) => {
          n += 1;
          if (n === 1) {
            await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'E2E8 loi gia lap' }) });
          } else {
            await route.continue();
          }
        });
        await page.getByLabel('view eligibility').click();
        await page.waitForFunction(() => (document.body.textContent || '').includes('E2E8 loi gia lap'), { timeout: 60000 });
        await snap(page, `${id}-retry-error`, 'Mobile lỗi + nút Thử lại');
        const t0 = await bodyText(page);
        if (!t0.includes('Thử lại')) return fail(id, 'mobile lỗi thiếu nút Thử lại');
        await page.getByLabel('retry eligibility').click();
        await page.waitForFunction(() => (document.body.textContent || '').includes('Mã đối chiếu:'), { timeout: 60000 });
        await snap(page, `${id}-retried`, 'Mobile retry thành công');
        if (n < 2) return fail(id, `chỉ ${n} request (mong ≥2: fail + retry)`);
        return ok(id, `request1 500 → lỗi + Thử lại; retry → verdict + Mã đối chiếu (tổng ${n} requests)`);
      } finally {
        await ctx.close().catch(() => {});
      }
    })();

    // ============ S11: correlation + audit ============
    await step('S11', 'Correlation reuse/generate + UI Mã đối chiếu; audit_logs không tăng', async (id) => {
      const fixed = uuid();
      const r1 = await api('GET', `/api/v1/eligibility/workers/${WORKER1_ID}`, adminToken, undefined, { 'X-Correlation-Id': fixed });
      if (r1.body.correlationId !== fixed) return fail(id, `không reuse corr: ${r1.body.correlationId} ≠ ${fixed}`);
      const r2 = await api('GET', `/api/v1/eligibility/workers/${WORKER1_ID}`, adminToken, undefined, { 'X-Correlation-Id': 'not-a-uuid' });
      if (!UUID_RE.test(r2.body.correlationId || '')) return fail(id, `corr xấu không generate UUID: ${r2.body.correlationId}`);
      if (r2.body.correlationId === 'not-a-uuid') return fail(id, 'corr xấu bị echo lại');
      const noStore = r2.headers.get('cache-control') || '';
      if (!/no-store/i.test(noStore)) return fail(id, `thiếu Cache-Control: no-store (${noStore})`);
      const a0 = psqlT('SELECT count(*) FROM audit_logs');
      await api('GET', `/api/v1/eligibility/workers/${WORKER1_ID}`, adminToken);
      await api('GET', `/api/v1/eligibility/crews/${crewId}`, adminToken);
      await api('GET', '/api/v1/eligibility/me', workerToken);
      const a1 = psqlT('SELECT count(*) FROM audit_logs');
      if (a0 !== a1) return fail(id, `audit_logs ${a0} → ${a1} (eligibility GET ghi audit!)`);
      return ok(id, `reuse ${fixed}; xấu → generate; no-store; audit ${a0}→${a1} (delta 0)`);
    })();
  } finally {
    await cleanupE2E8();
    const crewsRest = psqlT(`SELECT count(*) FROM crews WHERE code='${CREW_CODE}'`);
    const usersRest = psqlT(`SELECT count(*) FROM users WHERE lower(email) IN (lower('${ZERO_EMAIL}'), lower('${SKILL3_EMAIL}'))`);
    const auditFinal = psqlT('SELECT count(*) FROM audit_logs');
    console.log(`cleanup: crews rest=${crewsRest}, seedusers rest=${usersRest}, audit ${auditBaseline}→${auditFinal} (tăng do suspend/activate + tạo/xóa entity là hợp lệ; eligibility GET delta 0 ở S11)`);
    fs.writeFileSync(path.join(__dirname, 'e2e-vars.json'), JSON.stringify({
      zeroId, skill3Id, crewId, today: TODAY,
      worker1: WORKER1_ID, worker2: WORKER2_ID, tradeThoCat: THO_CAT,
      auditBaseline, auditFinal, crewsRest, usersRest, results,
    }, null, 2));
    const passed = results.filter((r) => r.ok).length;
    console.log(`\nTỔNG: ${passed}/${results.length} PASS`);
    await browser.close().catch(() => {});
    process.exit(passed === results.length ? 0 : 1);
  }
})();
