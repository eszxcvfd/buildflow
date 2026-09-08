/**
 * PRJ-SRS-006 E2E driver — Kiểm soát truy cập dự án (issue #37).
 * Evidence-only script; phạm vi docs/evidence — KHÔNG commit, KHÔNG sửa source.
 *
 * Chạy:   node e2e-driver-prj-srs-006.cjs
 * Yêu cầu: stack từ working tree (api có ProjectScopeService #37, web có
 *          ProjectDetail/Members 403-graceful, mobile có ProjectList/Detail screens);
 *          admin (hoang.anh@vinacons.vn / E2EAdmin@2025) +
 *          pm (quoc.tran@vinacons.vn / E2EPm@2025, manager của A và B) +
 *          worker thang.nguyen (E2EWorker@2025, ∈ A ∉ B) +
 *          worker hau.le (E2EWorker2@2025, ∈ B ∉ A).
 *
 * Seed (seed-prj-srs-006.sql, fixed UUID, ON CONFLICT DO NOTHING):
 *   A DA-AN-PHU 'Khu dân cư An Phú' (manager quoc.tran; thang WORKER, dong.trinh COORDINATOR)
 *   B DA-SONG-HONG 'Chung cư Sông Hồng' (manager quoc.tran; hau.le WORKER, ba.nguyen VIEWER)
 *
 * Luồng: seed → T1 tampering (API + Web deep-link) → T2 list scope (API + Web) →
 * T3 admin bypass + audit → T4 members-read (member 200 / non-member 403 + audit) →
 * T5 revoke mid-flight (DELETE bởi MANAGER → 403, không partial write) →
 * T6 mobile (list scope + detail 403-safe) → T7 area regression → cleanup id-based.
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

const ADMIN_EMAIL = 'hoang.anh@vinacons.vn';
const ADMIN_PASS = 'E2EAdmin@2025';
const PM_EMAIL = 'quoc.tran@vinacons.vn';
const PM_PASS = 'E2EPm@2025';
const WORKER_A_EMAIL = 'thang.nguyen@vinacons.vn';
const WORKER_A_PASS = 'E2EWorker@2025';
const WORKER_B_EMAIL = 'hau.le@vinacons.vn';
const WORKER_B_PASS = 'E2EWorker2@2025';

const PROJ_A = 'b60000a1-0001-4000-8000-000000000001';
const PROJ_B = 'b60000b2-0002-4000-8000-000000000002';
const CODE_A = 'DA-AN-PHU';
const CODE_B = 'DA-SONG-HONG';
const NAME_A = 'Khu dân cư An Phú';
const NAME_B = 'Chung cư Sông Hồng';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/** Cleanup id-based: areas → memberships → projects của A/B (audit giữ nguyên). */
function cleanupRun() {
  psqlT(`DELETE FROM project_areas WHERE project_id IN ('${PROJ_A}','${PROJ_B}')`);
  psqlT(`DELETE FROM project_members WHERE project_id IN ('${PROJ_A}','${PROJ_B}')`);
  psqlT(`DELETE FROM projects WHERE id IN ('${PROJ_A}','${PROJ_B}')`);
}
function restCount() {
  return psqlT(`SELECT count(*) FROM projects WHERE id IN ('${PROJ_A}','${PROJ_B}')`);
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
  const workerAToken = await getToken(WORKER_A_EMAIL, WORKER_A_PASS);
  const workerBToken = await getToken(WORKER_B_EMAIL, WORKER_B_PASS);
  if (!adminToken || !pmToken || !workerAToken || !workerBToken) {
    console.error(`Không lấy được token (admin=${!!adminToken} pm=${!!pmToken} wA=${!!workerAToken} wB=${!!workerBToken})`);
    await browser.close().catch(() => {});
    process.exit(2);
  }

  // ---- Setup: pre-cleanup + seed + verify ----
  cleanupRun();
  const seedSql = fs.readFileSync(path.join(__dirname, 'seed-prj-srs-006.sql'), 'utf8');
  const seedRun = spawnSync('docker', ['exec', '-i', 'buildflow-postgres-1', 'psql', '-U', 'buildflow', '-d', 'buildflow', '-v', 'ON_ERROR_STOP=1'],
    { input: seedSql, encoding: 'utf8', timeout: 20000 });
  if (seedRun.status !== 0) {
    console.error(`SEED FAIL ${(seedRun.stderr || '').slice(0, 500)}`);
    await browser.close().catch(() => {});
    process.exit(2);
  }
  const seedCheck = psqlT(`SELECT string_agg(code, ',' ORDER BY code) FROM projects WHERE id IN ('${PROJ_A}','${PROJ_B}')`);
  const memCheck = psqlT(`SELECT count(*) FROM project_members WHERE project_id IN ('${PROJ_A}','${PROJ_B}') AND is_active`);
  console.log(`setup: seed projects=${seedCheck} active_memberships=${memCheck}`);
  if (seedCheck !== `${CODE_A},${CODE_B}` || memCheck !== '6') {
    console.error('SEED VERIFY FAIL');
    await browser.close().catch(() => {});
    process.exit(2);
  }
  const auditBaseline = psqlT('SELECT count(*) FROM audit_logs');

  const workerACtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const workerAPage = await workerACtx.newPage();
  const adminPage = await adminCtx.newPage();
  for (const p of [workerAPage, adminPage]) p.setDefaultTimeout(30000);
  await loginWeb(workerAPage, WORKER_A_EMAIL, WORKER_A_PASS);
  await loginWeb(adminPage, ADMIN_EMAIL, ADMIN_PASS);

  // ============ T1: tampering — WORKER A chạm B → 403, không leak ============
  await runStep('T1', 'Tampering: member A GET/PATCH B → 403 không leak + UI deep-link graceful', async (id) => {
    const g = await api('GET', `/api/v1/projects/${PROJ_B}`, workerAToken);
    if (g.status !== 403) return fail(id, `GET B status=${g.status} (mong 403) body=${JSON.stringify(g.body).slice(0, 300)}`);
    const gb = JSON.stringify(g.body || {});
    if (gb.includes(NAME_B) || gb.includes(CODE_B)) return fail(id, `GET B 403 nhưng body leak tên/mã B: ${gb.slice(0, 300)}`);
    const p = await api('PATCH', `/api/v1/projects/${PROJ_B}`, workerAToken,
      { name: 'Tên giả mạo' }, { 'X-Correlation-Id': uuid() });
    if (p.status !== 403) return fail(id, `PATCH B status=${p.status} (mong 403)`);
    const pb = JSON.stringify(p.body || {});
    if (pb.includes(NAME_B) || pb.includes(CODE_B)) return fail(id, `PATCH B 403 nhưng body leak: ${pb.slice(0, 300)}`);
    const stillB = psqlT(`SELECT name FROM projects WHERE id='${PROJ_B}'`);
    if (stillB !== NAME_B) return fail(id, `PATCH 403 nhưng data B đã đổi: ${stillB}`);

    await workerAPage.goto(`${WEB}/projects/${PROJ_B}`, { waitUntil: 'networkidle' });
    const t = await bodyText(workerAPage);
    if (!t.includes('Bạn không phải thành viên dự án này')) return fail(id, `UI deep-link B không hiện out-of-scope graceful: ${t.slice(0, 300)}`);
    if (!t.includes('Về danh sách dự án')) return fail(id, 'UI deep-link B thiếu link Về danh sách dự án');
    if (t.includes(NAME_B)) return fail(id, 'UI deep-link B leak tên dự án B');
    if (await workerAPage.getByRole('alert').count() > 0) {
      const at = (await workerAPage.getByRole('alert').first().textContent()) || '';
      if (/thất bại|lỗi|error/i.test(at)) return fail(id, `UI deep-link B hiện alert đỏ: ${at.slice(0, 200)}`);
    }
    await snap(workerAPage, `${id}-deeplink403`, 'Worker A deep-link B → out-of-scope graceful');
    return ok(id, `GET/PATCH B → 403 không leak, data B nguyên vẹn; UI graceful + back-link, không alert đỏ`);
  });

  // ============ T2: list scope — member A chỉ thấy A ============
  await runStep('T2', 'List scope: member A thấy A, không thấy B (API + Web)', async (id) => {
    const l = await api('GET', '/api/v1/projects?limit=100', workerAToken);
    if (!Array.isArray(l.body)) return fail(id, `GET /projects không trả array: ${JSON.stringify(l.body).slice(0, 200)}`);
    const ids = l.body.map((x) => x.id);
    if (!ids.includes(PROJ_A)) return fail(id, `list thiếu A. ids=${ids.join(',')}`);
    if (ids.includes(PROJ_B)) return fail(id, `list leak B (server scope vỡ). ids=${ids.join(',')}`);

    await workerAPage.goto(`${WEB}/projects`, { waitUntil: 'networkidle' });
    const t = await bodyText(workerAPage);
    if (!t.includes(NAME_A) && !t.includes(CODE_A)) return fail(id, `UI /projects không hiện A: ${t.slice(0, 300)}`);
    if (t.includes(NAME_B) || t.includes(CODE_B)) return fail(id, 'UI /projects leak B');
    await snap(workerAPage, `${id}-listscope`, 'Worker A /projects chỉ thấy A');
    return ok(id, `API list có A không B (n=${l.body.length}); UI khớp`);
  });

  // ============ T3: admin bypass + audit ============
  await runStep('T3', 'Admin bypass: vào B (không member) → 200 + audit PROJECT_SCOPE_ADMIN_BYPASS', async (id) => {
    const g = await api('GET', `/api/v1/projects/${PROJ_B}`, adminToken);
    if (g.status !== 200) return fail(id, `admin GET B status=${g.status}`);
    if (!JSON.stringify(g.body || {}).includes(CODE_B)) return fail(id, 'admin GET B 200 nhưng thiếu data B');
    const a = await api('GET', `/api/v1/audit-logs?action=PROJECT_SCOPE_ADMIN_BYPASS&limit=5`, adminToken);
    const rows = (a.body && a.body.data) || [];
    const hit = rows.find((r) => r.entityId === PROJ_B && String(r.actorUserId).toLowerCase().includes('1111'));
    if (!hit) return fail(id, `không thấy audit BYPASS cho B: ${JSON.stringify(a.body).slice(0, 400)}`);
    await adminPage.goto(`${WEB}/projects/${PROJ_B}`, { waitUntil: 'networkidle' });
    const t = await bodyText(adminPage);
    if (!t.includes(NAME_B)) return fail(id, `admin UI detail B không hiện tên: ${t.slice(0, 300)}`);
    await snap(adminPage, `${id}-adminbypass`, 'Admin xem B (không member) → 200');
    return ok(id, `admin GET B 200; audit BYPASS id=${hit.id}; UI detail hiện tên B`);
  });

  // ============ T4: members-read — member 200, non-member 403 + audit ============
  await runStep('T4', 'Members read: member A 200 thấy đồng đội; non-member 403 + audit DENIED', async (id) => {
    const m = await api('GET', `/api/v1/projects/${PROJ_A}/members`, workerAToken);
    if (m.status !== 200) return fail(id, `member A đọc members status=${m.status}`);
    const names = (m.body.data || []).map((x) => x.userName).join('|');
    if (!names.includes('Trịnh Văn Đông')) return fail(id, `member A không thấy đồng đội COORDINATOR: ${names.slice(0, 200)}`);
    const nm = await api('GET', `/api/v1/projects/${PROJ_A}/members`, workerBToken);
    if (nm.status !== 403) return fail(id, `non-member đọc members A status=${nm.status} (mong 403)`);
    const a = await api('GET', `/api/v1/audit-logs?action=PROJECT_SCOPE_DENIED&limit=5`, adminToken);
    const rows = (a.body && a.body.data) || [];
    const hit = rows.find((r) => r.entityId === PROJ_A && r.afterData && r.afterData.scope === 'READ');
    if (!hit) return fail(id, `không thấy audit DENIED READ cho A: ${JSON.stringify(a.body).slice(0, 400)}`);
    return ok(id, `member A 200 thấy [${names.slice(0, 80)}]; non-member 403 + audit DENIED id=${hit.id}`);
  });

  // ============ T5: revoke mid-flight → 403, không partial write ============
  await runStep('T5', 'Revoke: MANAGER xóa thang khỏi A → request kế tiếp 403, data A nguyên vẹn', async (id) => {
    const before = await api('GET', `/api/v1/projects/${PROJ_A}/members`, adminToken);
    const row = (before.body.data || []).find((x) => x.userId === '33333333-3333-4333-8333-333333333333' && x.isActive);
    if (!row) return fail(id, 'không tìm membership active của thang trong A');
    const del = await api('DELETE', `/api/v1/projects/${PROJ_A}/members/${row.id}`, pmToken,
      { reason: 'Điều chuyển sang công trình khác (đợt T9/2026)' }, { 'X-Correlation-Id': uuid() });
    if (del.status !== 200) return fail(id, `MANAGER revoke status=${del.status} body=${JSON.stringify(del.body).slice(0, 300)}`);
    const g = await api('GET', `/api/v1/projects/${PROJ_A}`, workerAToken);
    if (g.status !== 403) return fail(id, `sau revoke GET A status=${g.status} (mong 403)`);
    const p = await api('PATCH', `/api/v1/projects/${PROJ_A}`, workerAToken,
      { name: 'Tên giả mạo sau revoke' }, { 'X-Correlation-Id': uuid() });
    if (p.status !== 403) return fail(id, `sau revoke PATCH A status=${p.status} (mong 403)`);
    const nameDb = psqlT(`SELECT name FROM projects WHERE id='${PROJ_A}'`);
    if (nameDb !== NAME_A) return fail(id, `PARTIAL WRITE: tên A đã đổi thành ${nameDb}`);
    const l = await api('GET', '/api/v1/projects?limit=100', workerAToken);
    if (Array.isArray(l.body) && l.body.map((x) => x.id).includes(PROJ_A)) {
      return fail(id, 'sau revoke list vẫn chứa A');
    }
    return ok(id, `revoke bởi MANAGER 200; GET/PATCH kế tiếp 403; tên A giữ '${nameDb}'; list loại A`);
  });

  // ============ T6: mobile — list scope + detail 403-safe ============
  await runStep('T6', 'Mobile: worker B list đúng scope + detail A 403-safe', async (id) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    try {
      await page.goto(`${MOB}/`, { waitUntil: 'domcontentloaded' });
      await page.getByLabel('email input').waitFor({ timeout: 120000 });
      await page.getByLabel('email input').fill(WORKER_B_EMAIL);
      await page.getByLabel('password input').fill(WORKER_B_PASS);
      await page.getByLabel('login submit').click();
      await page.waitForFunction(() => (document.body.textContent || '').includes('Xin chào,'), { timeout: 60000 });
      await page.getByLabel('view profile').click();
      await page.waitForFunction(() => (document.body.textContent || '').includes('Hồ sơ cá nhân'), { timeout: 60000 });
      await page.getByLabel('view projects').click();
      await page.waitForFunction(
        (args) => ((document.body.textContent || '').includes(args.codeB)
          || (document.body.textContent || '').includes('thành viên dự án')),
        { codeB: CODE_B },
        { timeout: 60000 },
      );
      let t = await bodyText(page);
      if (!t.includes(CODE_B) && !t.includes(NAME_B)) return fail(id, `mobile list không hiện B: ${t.slice(0, 300)}`);
      if (t.includes(CODE_A) || t.includes(NAME_A)) return fail(id, 'mobile list leak A cho worker B');
      await snap(page, `${id}-mobilelist`, 'Mobile worker B list chỉ thấy B');
      await page.getByLabel(`project ${CODE_B}`).click();
      // Tap đổi URL ngay (assert navigation), nhưng render SPA sau tap không ổn
      // định trên Metro dev — reload để cold-boot cùng session (flow người dùng
      // thật: mở lại app / quay lại route), rồi assert nội dung từ API thật.
      await page.waitForURL(`**/projects/${PROJ_B}`, { timeout: 60000 });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction((args) => (document.body.textContent || '').includes(args.nameB), { nameB: NAME_B }, { timeout: 60000 });
      t = await bodyText(page);
      if (!t.includes('Thành viên')) return fail(id, `mobile detail B thiếu section Thành viên: ${t.slice(0, 300)}`);
      await snap(page, `${id}-mobiledetail`, 'Mobile worker B detail B + members');
      await page.goto(`${MOB}/projects/${PROJ_A}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(
        () => (document.body.textContent || '').includes('không phải thành viên') || (document.body.textContent || '').includes('Đăng nhập'),
        null,
        { timeout: 60000 },
      );
      t = await bodyText(page);
      if (!t.includes('Bạn không phải thành viên dự án này (403)')) {
        return fail(id, `mobile detail A không 403-safe: ${t.slice(0, 300)}`);
      }
      if (t.includes(NAME_A)) return fail(id, 'mobile detail A 403 nhưng leak tên A');
      await snap(page, `${id}-mobile403`, 'Mobile detail A 403-safe');
      return ok(id, 'mobile list scope đúng (B, không A); detail B + members; deep-link A 403-safe không leak');
    } finally {
      await ctx.close().catch(() => {});
    }
  });

  // ============ T7: area scope regression ============
  await runStep('T7', 'Area scope: MANAGER tạo area A 200; revoked-worker tạo area B 403', async (id) => {
    const c = await api('POST', `/api/v1/projects/${PROJ_A}/areas`, pmToken,
      { code: 'KHU-THAP-A', name: 'Khu tháp A – Tầng trệt' }, { 'X-Correlation-Id': uuid() });
    if (c.status !== 201 && c.status !== 200) {
      return fail(id, `MANAGER tạo area A status=${c.status} body=${JSON.stringify(c.body).slice(0, 300)}`);
    }
    const denied = await api('POST', `/api/v1/projects/${PROJ_B}/areas`, workerAToken,
      { code: 'KHU-GIA-MAO', name: 'Khu giả mạo' }, { 'X-Correlation-Id': uuid() });
    if (denied.status !== 403) return fail(id, `non-member tạo area B status=${denied.status} (mong 403)`);
    const cntA = psqlT(`SELECT count(*) FROM project_areas WHERE project_id='${PROJ_A}' AND code='KHU-THAP-A'`);
    const cntB = psqlT(`SELECT count(*) FROM project_areas WHERE project_id='${PROJ_B}' AND code='KHU-GIA-MAO'`);
    if (cntA !== '1') return fail(id, `area A không persist (count=${cntA})`);
    if (cntB !== '0') return fail(id, `area giả mạo đã lọt vào B (count=${cntB})`);
    return ok(id, 'MANAGER tạo area A 201 persist; non-member tạo area B 403, không bản ghi lạ');
  });

  // ============ Cleanup + vars ============
  cleanupRun();
  const rest = restCount();
  const auditFinal = psqlT('SELECT count(*) FROM audit_logs');
  const allOk = results.every((r) => r.ok);
  const vars = {
    _note: 'Throwaway E2E-only demo credentials (seed/reset per evidence docs). Never production.',
    admin: ADMIN_EMAIL,
    pm: PM_EMAIL,
    workerA: WORKER_A_EMAIL,
    workerB: WORKER_B_EMAIL,
    projectA: PROJ_A,
    projectB: PROJ_B,
    codeA: CODE_A,
    codeB: CODE_B,
    auditBaseline,
    auditFinal,
    rest,
    results: results.map((r) => ({ id: r.id, ok: r.ok, note: r.note })),
  };
  fs.writeFileSync(path.join(__dirname, 'e2e-vars.json'), `${JSON.stringify(vars, null, 2)}\n`);
  console.log(`cleanup: projects rest=${rest}, audit ${auditBaseline}→${auditFinal}`);
  console.log(`TỔNG: ${results.filter((r) => r.ok).length}/${results.length} PASS`);
  await browser.close().catch(() => {});
  process.exit(allOk && rest === '0' ? 0 : 1);
})().catch((e) => { console.error('DRIVER FATAL', e); process.exit(2); });
