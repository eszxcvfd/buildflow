/**
 * JOB-SRS-002 E2E driver — Kiểm tra điều kiện công bố Work Order (issue #42).
 * Evidence-only script; phạm vi docs/evidence/job-srs-002 — KHÔNG sửa source, KHÔNG commit.
 *
 * Pattern theo docs/evidence/prj-srs-006 + job-srs-001 (playwright-core absolute
 * path, Chrome headless, creds @vinacons.vn, dữ liệu realistic ADR-0003 —
 * không E2E%/test% trong dữ liệu hiển thị; uniqueness bằng suffix digits;
 * cleanup theo id, audit giữ nguyên append-only).
 *
 * Chạy:   node e2e-driver-job-srs-002.cjs
 * Yêu cầu: stack từ working tree (api có GET /api/v1/work-orders/:id/publish-check
 *          #42; web có route /work-orders/[id] + WorkOrderReadinessPanel);
 *          admin hoang.anh (bypass), thang.nguyen (∉ PRA → 403),
 *          hau.le (WORKER ∈ PRA → đọc được); fixtures PRA / KQ-01 / BT-CT
 *          (required_trade THO-CAT) / PRD area B1-01.
 *
 * KHÔNG có PATCH /work-orders (chỉ POST create + GET :id) nên mọi thay đổi WO
 * giữa scenario dùng SQL UPDATE trực tiếp work_orders — ghi rõ trong E2E.md
 * (deviation D1). Không migration mới, không đụng data job-srs-001.
 *
 * Luồng: setup → K1 tạo WO thiếu schedule+trade → check unmet cụ thể →
 * K2 UI panel unmet + Publish disabled → K3 bổ sung schedule (SQL) → unmet
 * giảm 3→1 → K4 PAUSE/ACTIVE project → K5 WT inactive + area khác project →
 * K6 đủ điều kiện → ready=true + UI badge xanh → K7 403/401/400 + WORKER đọc
 * được → K8 idempotent + không side-effect → cleanup id-based.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('/home/trung/.npm-global/lib/node_modules/@playwright/mcp/node_modules/playwright-core');

const WEB = 'http://localhost:3001';
const API = 'http://localhost:3000';
const SHOTS = path.join(__dirname, 'shots');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
const VARS_PATH = path.join(__dirname, 'e2e-vars.json');

const ADMIN = { email: 'hoang.anh@vinacons.vn', pass: 'E2EAdmin@2025' };
const NONMEMBER = { email: 'thang.nguyen@vinacons.vn', pass: 'E2EWorker@2025' }; // ∉ PRA
const WORKER = { email: 'hau.le@vinacons.vn', pass: 'E2EWorker2@2025' }; // WORKER ∈ PRA

const DIG = String(Date.now()).slice(-6);
const TITLE = `Thi công ván khuôn cột C2 tầng trệt ${DIG}`;

const results = [];
const ok = (id, note = '') => ({ id, ok: true, note });
const fail = (id, note) => ({ id, ok: false, note });
async function runStep(id, name, fn) {
  try {
    const r = await fn(id);
    results.push({ id, name, ...r });
    console.log(`${r.ok ? 'PASS' : 'FAIL'} ${id} ${name}${r.note ? ' :: ' + String(r.note).split('\n')[0] : ''}`);
    if (!r.ok && r.note) console.log(`  detail: ${String(r.note).slice(0, 2500)}`);
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
    ], { encoding: 'utf8', timeout: 20000 }).trim();
  } catch (e) {
    return `PSQL ERROR: ${e.stderr || e.message}`;
  }
}
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16));
}
async function api(method, urlPath, token, body, noCorr) {
  const headers = { Accept: 'application/json' };
  if (!noCorr) headers['X-Correlation-Id'] = uuid();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${urlPath}`, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, body: json, headers: res.headers };
}
async function getToken(email, password) {
  const r = await api('POST', '/api/v1/auth/login', null, { email, password });
  if (!r.body || !r.body.accessToken) throw new Error(`login failed ${email}: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.accessToken;
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
const codesOf = (check) => (check.unmet || []).map((u) => u.code);

async function main() {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);

  const adminTok = await getToken(ADMIN.email, ADMIN.pass);
  const outsiderTok = await getToken(NONMEMBER.email, NONMEMBER.pass);
  const workerTok = await getToken(WORKER.email, WORKER.pass);

  // Resolve fixtures PRA / KQ-01 / BT-CT / THO-CAT / B1-01 (PRD) qua API thật.
  const projects = await api('GET', '/api/v1/projects', adminTok, undefined, true);
  const list = Array.isArray(projects.body) ? projects.body : (projects.body.data || []);
  const pra = list.find((p) => p.code === 'PRA');
  const prd = list.find((p) => p.code === 'PRD');
  if (!pra || !prd) throw new Error(`missing PRA/PRD: ${JSON.stringify(list.map((p) => p.code))}`);
  const areas = await api('GET', `/api/v1/projects/${pra.id}/areas?activeOnly=true`, adminTok, undefined, true);
  const kq01 = (areas.body.data || []).find((a) => a.code === 'KQ-01');
  const wtypes = await api('GET', '/api/v1/work-types/active', adminTok, undefined, true);
  const btct = (wtypes.body.data || []).find((w) => w.code === 'BT-CT');
  const trades = await api('GET', '/api/v1/trades?limit=100', adminTok, undefined, true);
  const thocat = ((trades.body.data || trades.body) || []).find((t) => t.code === 'THO-CAT');
  const prdAreaId = psqlT(`SELECT id FROM project_areas WHERE project_id='${prd.id}' AND is_active LIMIT 1;`);
  if (!kq01 || !btct || !thocat || !prdAreaId || /ERROR/.test(prdAreaId)) {
    throw new Error(`missing fixtures KQ-01/BT-CT/THO-CAT/PRD-area (prdArea=${prdAreaId})`);
  }
  console.log(`fixtures PRA=${pra.id} KQ-01=${kq01.id} BT-CT=${btct.id} THO-CAT=${thocat.id} PRD-area=${prdAreaId}`);
  const auditBaseline = psqlT('SELECT count(*) FROM audit_logs');

  let woId = null;
  let tempWtId = null;

  const checkOf = async (tok) => api('GET', `/api/v1/work-orders/${woId}/publish-check`, tok, undefined, true);
  const assignCount = () => psqlT(`SELECT count(*) FROM assignments WHERE work_order_id='${woId}';`);

  // K1 — WO DRAFT thiếu schedule + trade → unmet cụ thể.
  await runStep('K1', 'WO DRAFT thiếu schedule/trade → ready=false + unmet cụ thể', async (id) => {
    const c = await api('POST', '/api/v1/work-orders', adminTok, {
      projectId: pra.id, workTypeId: btct.id, areaId: kq01.id, title: TITLE, priority: 'HIGH',
    });
    if (c.status !== 201) return fail(id, `POST create status=${c.status}: ${JSON.stringify(c.body)}`);
    woId = c.body.id;
    const r = await checkOf(adminTok);
    if (r.status !== 200) return fail(id, `publish-check status=${r.status}: ${JSON.stringify(r.body)}`);
    const codes = codesOf(r.body);
    const ms = codes.filter((x) => x === 'MISSING_SCHEDULE').length;
    if (r.body.ready !== false) return fail(id, `ready kỳ vọng false: ${JSON.stringify(r.body).slice(0, 300)}`);
    if (ms !== 2) return fail(id, `MISSING_SCHEDULE kỳ vọng ×2, được ×${ms}: ${codes.join(',')}`);
    if (!codes.includes('MISSING_REQUIRED_SKILL')) return fail(id, `thiếu MISSING_REQUIRED_SKILL: ${codes.join(',')}`);
    if (r.body.workOrderId !== woId) return fail(id, 'workOrderId không khớp');
    if (!r.body.checkedAt) return fail(id, 'thiếu checkedAt');
    if (!String(r.headers.get('cache-control') || '').includes('no-store')) {
      return fail(id, `thiếu Cache-Control no-store: ${r.headers.get('cache-control')}`);
    }
    if (assignCount() !== '0') return fail(id, 'check đã tạo assignment (side-effect)');
    return ok(id, `ready=false codes=[${codes.join(',')}]; no-store; assignments=0`);
  });

  // K2 — UI panel hiện unmet + Publish disabled.
  await runStep('K2', 'UI /work-orders/[id] hiện unmet + Công bố disabled', async (id) => {
    await loginWeb(page, ADMIN.email, ADMIN.pass);
    await page.goto(`${WEB}/work-orders/${woId}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.body.textContent.includes('Điều kiện công bố'), { timeout: 25000 });
    const t = await bodyText(page);
    if (!t.includes('Chưa đủ điều kiện')) return fail(id, `thiếu badge Chưa đủ điều kiện: ${t.slice(0, 400)}`);
    if (!t.includes('MISSING_SCHEDULE')) return fail(id, `panel không liệt kê MISSING_SCHEDULE: ${t.slice(0, 500)}`);
    const pub = page.getByRole('button', { name: 'Công bố', exact: true });
    if ((await pub.count()) === 0) return fail(id, 'không thấy nút Công bố');
    if (await pub.isEnabled()) return fail(id, 'nút Công bố đang ENABLE khi chưa đủ điều kiện');
    const assign = page.getByRole('button', { name: 'Phân công', exact: true });
    if ((await assign.count()) > 0 && await assign.isEnabled()) return fail(id, 'nút Phân công đang ENABLE');
    await snap(page, 'K2-panel-unmet', 'panel unmet + Công bố disabled');
    return ok(id, 'panel liệt kê unmet, Công bố/Phân công disabled');
  });

  // K3 — bổ sung schedule qua SQL UPDATE (không có PATCH) → unmet giảm 3→1.
  await runStep('K3', 'bổ sung schedule (SQL) → unmet giảm đúng còn skill', async (id) => {
    psqlT(`UPDATE work_orders SET planned_start_at='2026-10-06T08:00:00+07', planned_end_at='2026-10-10T17:00:00+07' WHERE id='${woId}';`);
    const r = await checkOf(adminTok);
    if (r.status !== 200) return fail(id, `re-check status=${r.status}`);
    const codes = codesOf(r.body);
    if (codes.length !== 1 || codes[0] !== 'MISSING_REQUIRED_SKILL') {
      return fail(id, `kỳ vọng [MISSING_REQUIRED_SKILL], được [${codes.join(',')}]`);
    }
    if (r.body.ready !== false) return fail(id, 'ready phải còn false khi thiếu skill');
    return ok(id, `unmet 3→1: [${codes.join(',')}] (SQL UPDATE vì không có PATCH — deviation D1)`);
  });

  // K4 — project PAUSED → PROJECT_NOT_ACTIVE; ACTIVE lại → biến mất.
  await runStep('K4', 'PAUSE project → PROJECT_NOT_ACTIVE; ACTIVE lại → biến mất', async (id) => {
    psqlT(`UPDATE projects SET status='PAUSED' WHERE id='${pra.id}';`);
    const r1 = await checkOf(adminTok);
    const c1 = codesOf(r1.body);
    if (!c1.includes('PROJECT_NOT_ACTIVE')) return fail(id, `PAUSED nhưng thiếu PROJECT_NOT_ACTIVE: [${c1.join(',')}]`);
    if (c1[0] !== 'PROJECT_NOT_ACTIVE') return fail(id, `thứ tự catalog vỡ (đầu=${c1[0]}): [${c1.join(',')}]`);
    psqlT(`UPDATE projects SET status='ACTIVE' WHERE id='${pra.id}';`);
    const r2 = await checkOf(adminTok);
    const c2 = codesOf(r2.body);
    if (c2.includes('PROJECT_NOT_ACTIVE')) return fail(id, `ACTIVE lại nhưng PROJECT_NOT_ACTIVE còn: [${c2.join(',')}]`);
    const statusDb = psqlT(`SELECT status FROM projects WHERE id='${pra.id}';`);
    if (statusDb !== 'ACTIVE') return fail(id, `project PRA status=${statusDb} (chưa restore)`);
    return ok(id, `PAUSED→[${c1.join(',')}]; ACTIVE→[${c2.join(',')}]`);
  });

  // K5 — work type inactive + area khác project.
  await runStep('K5', 'WT inactive → WORK_TYPE_INACTIVE; area PRD → AREA_INVALID', async (id) => {
    const wtCode = `WT-TAM-KS-${DIG}`;
    const c = await api('POST', '/api/v1/work-types', adminTok, { code: wtCode, name: `Loại tạm kiểm thử ${DIG}`, group: 'Hoàn thiện' });
    if (c.status !== 201) return fail(id, `tạo temp WT ${c.status}: ${JSON.stringify(c.body)}`);
    tempWtId = c.body.id;
    const d = await api('POST', `/api/v1/work-types/${tempWtId}/status`, adminTok, {
      action: 'DEACTIVATE', reason: `Tạm dừng phục vụ kiểm thử công bố (đợt T9/2026) ${DIG}`,
    });
    if (d.status !== 200) return fail(id, `deactivate temp WT ${d.status}: ${JSON.stringify(d.body)}`);
    psqlT(`UPDATE work_orders SET work_type_id='${tempWtId}' WHERE id='${woId}';`);
    const r1 = await checkOf(adminTok);
    const c1 = codesOf(r1.body);
    psqlT(`UPDATE work_orders SET work_type_id='${btct.id}' WHERE id='${woId}';`);
    if (!c1.includes('WORK_TYPE_INACTIVE')) return fail(id, `thiếu WORK_TYPE_INACTIVE: [${c1.join(',')}]`);
    psqlT(`UPDATE work_orders SET area_id='${prdAreaId}' WHERE id='${woId}';`);
    const r2 = await checkOf(adminTok);
    const c2 = codesOf(r2.body);
    psqlT(`UPDATE work_orders SET area_id='${kq01.id}' WHERE id='${woId}';`);
    if (!c2.includes('AREA_INVALID')) return fail(id, `thiếu AREA_INVALID: [${c2.join(',')}]`);
    const back = await checkOf(adminTok);
    if (codesOf(back.body).some((x) => x === 'WORK_TYPE_INACTIVE' || x === 'AREA_INVALID')) {
      return fail(id, `restore chưa sạch: [${codesOf(back.body).join(',')}]`);
    }
    return ok(id, `WT-inactive→[${c1.join(',')}]; area-PRD→[${c2.join(',')}]; restore sạch`);
  });

  // K6 — gắn trade THO-CAT → ready=true + UI badge xanh.
  await runStep('K6', 'đủ điều kiện → ready=true + UI badge xanh', async (id) => {
    psqlT(`UPDATE work_orders SET required_trade_id='${thocat.id}' WHERE id='${woId}';`);
    const r = await checkOf(adminTok);
    if (r.body.ready !== true) return fail(id, `ready kỳ vọng true: ${JSON.stringify(r.body).slice(0, 400)}`);
    if ((r.body.unmet || []).length !== 0) return fail(id, `unmet kỳ vọng rỗng: ${JSON.stringify(r.body.unmet)}`);
    await page.goto(`${WEB}/work-orders/${woId}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.body.textContent.includes('Đủ điều kiện công bố'), { timeout: 25000 });
    const t = await bodyText(page);
    if (!t.includes('đã đủ điều kiện công bố')) return fail(id, 'thiếu note đủ điều kiện');
    const pub = page.getByRole('button', { name: 'Công bố', exact: true });
    if ((await pub.count()) > 0 && await pub.isEnabled()) return fail(id, 'Công bố ENABLE ở slice này (lệnh #44 chưa mở)');
    await snap(page, 'K6-panel-ready', 'badge xanh đủ điều kiện');
    return ok(id, 'ready=true unmet=[]; UI badge xanh, Công bố vẫn disabled (chờ #44)');
  });

  // K7 — phân quyền đọc check.
  await runStep('K7', 'non-member 403 + WORKER member đọc được; 401/400', async (id) => {
    const g1 = await checkOf(outsiderTok);
    if (g1.status !== 403) return fail(id, `non-member PRA kỳ vọng 403, được ${g1.status}`);
    const g2 = await api('GET', `/api/v1/work-orders/${woId}`, outsiderTok, undefined, true);
    if (g2.status !== 403) return fail(id, `non-member GET WO kỳ vọng 403, được ${g2.status}`);
    const g3 = await checkOf(workerTok);
    if (g3.status !== 200 || g3.body.ready !== true) {
      return fail(id, `WORKER member kỳ vọng 200+ready, được ${g3.status}: ${JSON.stringify(g3.body).slice(0, 200)}`);
    }
    const g4 = await api('GET', `/api/v1/work-orders/${woId}/publish-check`, null, undefined, true);
    if (g4.status !== 401) return fail(id, `anon kỳ vọng 401, được ${g4.status}`);
    const g5 = await api('GET', '/api/v1/work-orders/not-a-uuid/publish-check', adminTok, undefined, true);
    if (g5.status !== 400) return fail(id, `id sai kỳ vọng 400, được ${g5.status}`);
    return ok(id, 'non-member 403 (check + GET); WORKER 200; anon 401; id sai 400');
  });

  // K8 — idempotent: 2 lần cùng kết quả, không assignment/audit nghiệp vụ mới.
  // Note: scope service vẫn audit PROJECT_SCOPE_ADMIN_BYPASS cho mỗi GET của
  // admin (đúng J6 — như GET :id), nên chỉ assert audit nghiệp vụ WO (JOB_* /
  // entity WORK_ORDER) + assignments không đổi, không assert tổng audit.
  await runStep('K8', 'gọi 2 lần → cùng kết quả, không assignment/audit mới', async (id) => {
    const a0 = assignCount();
    const biz = `SELECT count(*) FROM audit_logs WHERE action LIKE 'JOB_%' OR entity_type='WORK_ORDER'`;
    const u0 = psqlT(biz);
    const r1 = await checkOf(adminTok);
    const r2 = await checkOf(adminTok);
    const a1 = assignCount();
    const u1 = psqlT(biz);
    const b1 = JSON.stringify(r1.body);
    const b2 = JSON.stringify(r2.body);
    const j1 = JSON.parse(b1);
    const j2 = JSON.parse(b2);
    delete j1.checkedAt;
    delete j2.checkedAt;
    if (JSON.stringify(j1) !== JSON.stringify(j2)) return fail(id, '2 lần trả kết quả khác nhau (trừ checkedAt)');
    if (a0 !== a1) return fail(id, `assignments đổi ${a0}→${a1} (partial side-effect)`);
    if (u0 !== u1) return fail(id, `audit nghiệp vụ WO đổi ${u0}→${u1} (GET phải no-audit)`);
    return ok(id, `kết quả đồng nhất; assignments ${a0}→${a1}; audit WO ${u0}→${u1} (chỉ +PROJECT_SCOPE_* scope rows theo J6)`);
  });

  await browser.close();

  // Cleanup id-based (audit giữ nguyên).
  if (woId) psqlT(`DELETE FROM work_orders WHERE id='${woId}';`);
  if (tempWtId) psqlT(`DELETE FROM work_types WHERE id='${tempWtId}';`);
  const rest = psqlT(`SELECT count(*) FROM work_orders WHERE title LIKE '%${DIG}%';`);
  const wtRest = psqlT(`SELECT count(*) FROM work_types WHERE code='WT-TAM-KS-${DIG}';`);
  const auditFinal = psqlT('SELECT count(*) FROM audit_logs');
  const vars = {
    _note: 'Throwaway E2E-only demo credentials (seed/reset per evidence docs). Never production.',
    digits: DIG,
    title: TITLE,
    workOrderId: woId,
    praId: pra ? pra.id : null,
    auditBaseline,
    auditFinal,
    rest: rest.trim(),
    tempWtRest: wtRest.trim(),
    results: results.map((r) => ({ id: r.id, ok: r.ok, note: r.note })),
  };
  fs.writeFileSync(VARS_PATH, `${JSON.stringify(vars, null, 2)}\n`);

  const passed = results.filter((r) => r.ok).length;
  console.log(`\nTỔNG: ${passed}/${results.length} PASS (digits=${DIG}, cleanup WO rest=${rest.trim()}, tempWT rest=${wtRest.trim()}, audit ${auditBaseline}→${auditFinal})`);
  if (passed !== results.length || rest.trim() !== '0') process.exitCode = 1;
}

main().catch((e) => { console.error('DRIVER FATAL:', e); process.exit(2); });
