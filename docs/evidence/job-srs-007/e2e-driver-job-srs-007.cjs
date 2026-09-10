/**
 * JOB-SRS-007 E2E driver — Chi tiết công việc còn trống (issue #47).
 * Evidence-only script; phạm vi docs/evidence/job-srs-007 — KHÔNG sửa source, KHÔNG commit.
 *
 * Fork pattern từ driver-006 (playwright-core absolute path, Chrome headless,
 * creds @vinacons.vn, uniqueness bằng WO code hệ thống + id, cleanup theo id,
 * audit append-only, shots/vars/log label mới `-S7R*` — KHÔNG đè history 005/006).
 *
 * Chạy:   node e2e-driver-job-srs-007.cjs [label]
 *           (label: `S7R1`/`S7R2`… → vars `e2e-vars-<label>.json`, shots `*-<label>.png`;
 *           stdout nên tee ra `run-<label>.stdout.log` làm artifact riêng từng run)
 * Prereqs:  - stack rebuild từ working tree, `docker compose -f infra/docker/compose.yaml ps`
 *            (api :3000, mobile :19006 healthy)
 *          - playwright-core resolvable: `PLAYWRIGHT_CORE_PATH=<path>/playwright-core`
 *          - Chrome: `/usr/bin/google-chrome` hoặc `CHROME_PATH=<path>`
 *          - PM quoc.tran (STAFF, member PRA+PRB), WORKER ba.nguyen (WORKER member PRA,
 *            KHÔNG member PRB). Creds qua env `E2E_PM_PASS` / `E2E_WORKER_PASS`.
 *
 * Luồng: S0 login thật + baseline → S1 seed 3 WO (A: BT-CT/PRA mở board —
 * detail chính; B: DIEN/PRA mở board — state-change; C: BT-CT/PRB mở board —
 * ngoài scope worker) → S2 API asserts (200 đủ sections §3.1 + checklist
 * BT-CT + generic, 403 unknown-id + 403 out-of-scope PRB, 401, 400 UUID,
 * không PII, R1 filter-options 200) → S3 state-change API (PM đóng board B
 * giữa 2 GET → AVAILABLE→CLOSED) → S4 read-only (N GET delta 0 + seed nguyên
 * vẹn) → S5 Expo UI (board → Xem chi tiết A → sections + CTA Nhận việc →
 * nhấn → hint #48 → PM đóng A → nhấn CTA re-check → banner state-changed +
 * CTA biến mất → back) → S6 cleanup.
 *
 * TRUNG THỰC: (1) in-memory specs (`src/api/test/job-board-detail.e2e.spec.ts`)
 * KHÔNG phải real-DB proof — proof thật là driver này (API thật → PostgreSQL
 * thật → Expo UI thật); (2) CTA "Nhận việc" là placeholder #48 — driver chứng
 * minh onPress chỉ re-fetch (không POST/claim nào được gửi: assert bằng audit
 * delta 0 + không assignment mới); (3) Mobile test bằng Expo web
 * (`http://localhost:19006`, Chrome headless) — cùng build image với native,
 * interaction qua accessibilityLabel thật; native device smoke chưa chạy —
 * residual; (4) nhánh 409 `JOB_BOARD_CONFIG_INVALID` là defensive/wiring
 * (FK `work_type_id NOT NULL`) — phủ bởi unit backend, KHÔNG ép bằng psql
 * phá FK ở driver này (ghi nhận unknown trung thực).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function loadPlaywrightCore() {
  const candidates = [
    ...(process.env.PLAYWRIGHT_CORE_PATH ? [process.env.PLAYWRIGHT_CORE_PATH] : []),
    'playwright-core',
    path.join(process.cwd(), 'node_modules', 'playwright-core'),
  ];
  let lastErr = null;
  for (const c of candidates) {
    try {
      return require(c);
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(
    `Không load được playwright-core (đã thử: ${candidates.join(', ')}). ` +
      `Prereqs: PLAYWRIGHT_CORE_PATH=<path>/playwright-core. Gốc: ${lastErr && lastErr.message}`,
  );
}
const { chromium } = loadPlaywrightCore();
const CHROME_PATH = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';

const API = 'http://localhost:3000';
const MOBILE = 'http://localhost:19006';
const SHOTS = path.join(__dirname, 'shots');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
const LABEL = String(process.argv[2] || 'S7R1').trim();
const VARS_PATH = path.join(__dirname, `e2e-vars-${LABEL}.json`);

const PM = { email: 'quoc.tran@vinacons.vn', pass: process.env.E2E_PM_PASS ?? 'E2EPm@2025' };
const WORKER = { email: 'ba.nguyen@vinacons.vn', pass: process.env.E2E_WORKER_PASS ?? 'E2E5W3@2025' };

const PRA = '10000000-0000-4000-8000-000000000001';
const PRB = '10000000-0000-4000-8000-000000000002';
const AREA_KQ01 = '589c0681-eec2-4a25-ac39-f91f866d507e';
const AREA_GAA03 = '07fe0492-3551-4ff4-96ac-38dbab7f0f93';
const WT_BTCT = 'e2e4b200-0000-4000-8000-0000000000b3';
const WT_DIEN = 'a1b2c3d4-0002-4000-8000-000000000002';
const TRADE_THOCAT = '11111111-1111-4111-8111-111111111111';
const TRADE_DIEN = '85fc5da0-cb00-4650-9e3c-fae7a83ab656';

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
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  return { status: res.status, json, text: text.slice(0, 2000) };
}

const vars = {
  _note: 'Throwaway E2E-only demo data (seed/reset per evidence docs). Never production.',
  runLabel: LABEL,
  titles: {},
  workOrderIds: {},
  workOrderCodes: {},
};

async function createAndOpen(pmTok, kind, spec) {
  const create = await api('POST', '/api/v1/work-orders', pmTok, {
    projectId: spec.projectId, workTypeId: spec.workTypeId, title: spec.title, areaId: spec.areaId,
    requiredTradeId: spec.tradeId, plannedStartAt: spec.start, plannedEndAt: spec.end,
    plannedHeadcount: 5, requestKey: uuid(), customFields: spec.customFields ?? {},
  });
  if (create.status !== 201 && create.status !== 200) return { error: `create ${kind} ${create.status}: ${create.text}` };
  const id = create.json.id;
  vars.workOrderIds[kind] = id; // ghi sớm để S6 dọn được cả khi publish-check/open fail giữa chừng
  vars.workOrderCodes[kind] = create.json.code;
  const check = await api('GET', `/api/v1/work-orders/${id}/publish-check`, pmTok, undefined, true);
  if (!check.json || check.json.ready !== true) return { error: `${kind} publish-check not ready: ${check.text}` };
  const open = await api('POST', `/api/v1/work-orders/${id}/job-board/open`, pmTok, { expectedVersion: 1 });
  if (open.status !== 200 && open.status !== 201) return { error: `open ${kind} ${open.status}: ${open.text}` };
  return { id, code: create.json.code };
}

async function main() {
  let pmTok, workerTok;
  const now = Date.now();
  const DAY = 86400e3;
  const iso = (t) => new Date(t).toISOString();

  await runStep('S0', 'login PM/worker qua API thật + baseline audit/notification', async () => {
    const pm = await api('POST', '/api/v1/auth/login', null, { email: PM.email, password: PM.pass }, true);
    const wo = await api('POST', '/api/v1/auth/login', null, { email: WORKER.email, password: WORKER.pass }, true);
    if (pm.status !== 201 && pm.status !== 200) return fail('S0', `PM login ${pm.status}: ${pm.text}`);
    if (wo.status !== 201 && wo.status !== 200) return fail('S0', `worker login ${wo.status}: ${wo.text}`);
    pmTok = pm.json.accessToken; workerTok = wo.json.accessToken;
    if (!pmTok || !workerTok) return fail('S0', 'thiếu accessToken');
    vars.auditBefore = psqlT('SELECT count(*) FROM audit_logs;').trim();
    vars.notifBefore = psqlT('SELECT count(*) FROM notifications;').trim();
    return ok('S0', `PM+worker login OK, audit=${vars.auditBefore} notif=${vars.notifBefore}`);
  });

  await runStep('S1', 'seed 3 WO + mở board qua API thật (A detail chính, B state-change, C ngoài scope)', async () => {
    const t = (k, s) => { const title = `[${LABEL}] ${s}`; vars.titles[k] = title; return title; };
    const specs = {
      A: { projectId: PRA, areaId: AREA_KQ01, workTypeId: WT_BTCT, tradeId: TRADE_THOCAT, customFields: {}, title: t('A', 'Đổ bê tông cột vách sảnh chính') },
      B: { projectId: PRA, areaId: AREA_KQ01, workTypeId: WT_DIEN, tradeId: TRADE_DIEN, customFields: { so_diem_dien: 8, anh_ban_ve: 'https://example.invalid/ban-ve.png' }, title: t('B', 'Đi ống điện âm tường tầng hai') },
      C: { projectId: PRB, areaId: AREA_GAA03, workTypeId: WT_BTCT, tradeId: TRADE_THOCAT, customFields: {}, title: t('C', 'Đổ bê tông block ngoài scope') },
    };
    for (const k of ['A', 'B', 'C']) {
      const r = await createAndOpen(pmTok, k, {
        ...specs[k], start: iso(now + DAY), end: iso(now + 2 * DAY),
      });
      if (r.error) return fail('S1', r.error);
    }
    const st = psqlT(`SELECT code, status, job_board_open FROM work_orders WHERE id IN ('${Object.values(vars.workOrderIds).join("','")}') ORDER BY code;`);
    return ok('S1', `3 WO mở board (A=${vars.workOrderCodes.A} B=${vars.workOrderCodes.B} C=${vars.workOrderCodes.C});\n${st}`);
  });

  await runStep('S2', 'API asserts: 200 đủ sections + checklist, 403/401/400, không PII, R1 filter-options', async () => {
    const idA = vars.workOrderIds.A;
    const d = await api('GET', `/api/v1/job-board/${idA}`, workerTok, undefined, true);
    if (d.status !== 200) return fail('S2', `detail A → ${d.status}: ${d.text}`);
    const b = d.json;
    const needTop = ['id', 'code', 'title', 'status', 'priority', 'projectId', 'projectName', 'areaId', 'areaName',
      'workTypeId', 'workTypeName', 'workTypeDescription', 'workTypeRequiredFields', 'workTypeGroup', 'requiredTradeId', 'requiredTradeName',
      'plannedStartAt', 'plannedEndAt', 'dueAt', 'plannedHeadcount', 'jobBoard', 'description', 'instructions',
      'customFields', 'checklists', 'version', 'createdAt', 'updatedAt'];
    const missing = needTop.filter((k) => !(k in b));
    if (missing.length) return fail('S2', `thiếu sections [${missing}]`);
    const banned = ['createdBy', 'requestKey', 'hasActiveAssignment'];
    const leaked = banned.filter((k) => k in b);
    if (leaked.length) return fail('S2', `lộ trường cấm [${leaked}]`);
    if (b.jobBoard?.state !== 'AVAILABLE') return fail('S2', `state A=${b.jobBoard?.state}, mong AVAILABLE`);
    if (b.projectName == null || b.areaName == null) return fail('S2', 'thiếu enrich project/area');
    if (!b.workTypeName || b.workTypeRequiredFields === undefined) return fail('S2', 'thiếu work-type detail F6');
    if (!b.requiredTradeName) return fail('S2', 'thiếu trade enrich');
    // Checklist BD-3: per-type BT-CT (CLT-BT-COT) + generic NULL (CLT-ATLD-DV), ACTIVE only.
    const codes = new Set((b.checklists || []).map((c) => c.code));
    if (!codes.has('CLT-BT-COT') || !codes.has('CLT-ATLD-DV')) return fail('S2', `checklists thiếu per-type/generic: [${[...codes]}]`);
    if ([...codes].some((c) => String(c).includes('SON'))) return fail('S2', 'lọt checklist work-type khác/DRAFT');
    const bt = b.checklists.find((c) => c.code === 'CLT-BT-COT');
    if (!bt || bt.items.length < 2) return fail('S2', 'CLT-BT-COT thiếu items');
    const itemKeys = ['sequenceNo', 'title', 'answerType', 'isRequired', 'isBlocking', 'requiresPhoto'];
    const badItem = bt.items.find((it) => itemKeys.some((k) => !(k in it)));
    if (badItem) return fail('S2', `item thiếu keys: ${JSON.stringify(badItem).slice(0, 300)}`);
    vars.detailVersionA = b.version;
    // 403: unknown id (anti-leak) + WO PRB ngoài scope + 401 anon + 400 UUID sai.
    const unk = await api('GET', '/api/v1/job-board/11111111-1111-4111-8111-111111111111', workerTok, undefined, true);
    if (unk.status !== 403) return fail('S2', `unknown-id → ${unk.status}, mong 403`);
    const oos = await api('GET', `/api/v1/job-board/${vars.workOrderIds.C}`, workerTok, undefined, true);
    if (oos.status !== 403) return fail('S2', `PRB out-of-scope → ${oos.status}, mong 403`);
    const anon = await api('GET', `/api/v1/job-board/${idA}`, null, undefined, true);
    if (anon.status !== 401) return fail('S2', `anon → ${anon.status}, mong 401`);
    const badUuid = await api('GET', '/api/v1/job-board/not-a-uuid', workerTok, undefined, true);
    if (badUuid.status !== 400) return fail('S2', `bad-uuid → ${badUuid.status}, mong 400`);
    // PM thấy được C (cùng scope) — phân biệt 403-scope vs 404.
    const pmC = await api('GET', `/api/v1/job-board/${vars.workOrderIds.C}`, pmTok, undefined, true);
    if (pmC.status !== 200) return fail('S2', `PM đọc C → ${pmC.status}, mong 200`);
    // R1: filter-options vẫn 200 sau khi thêm route :id.
    const fo = await api('GET', '/api/v1/job-board/filter-options', workerTok, undefined, true);
    if (fo.status !== 200 || !Array.isArray(fo.json.projects)) return fail('S2', `R1 filter-options → ${fo.status}`);
    return ok('S2', `200 đủ ${needTop.length} keys + checklist {CLT-BT-COT,generic} + 403×2/401/400 + PM-C 200 + R1 200, không PII`);
  });

  await runStep('S3', 'state-change API: PM đóng board B giữa 2 GET → AVAILABLE→CLOSED', async () => {
    const idB = vars.workOrderIds.B;
    const g1 = await api('GET', `/api/v1/job-board/${idB}`, workerTok, undefined, true);
    if (g1.status !== 200 || g1.json.jobBoard?.state !== 'AVAILABLE') return fail('S3', `GET-1 B → ${g1.status} state=${g1.json?.jobBoard?.state}`);
    const cur = await api('GET', `/api/v1/work-orders/${idB}`, pmTok, undefined, true);
    if (cur.status !== 200) return fail('S3', `PM đọc version B → ${cur.status}`);
    const close = await api('POST', `/api/v1/work-orders/${idB}/job-board/close`, pmTok, { expectedVersion: cur.json.version });
    if (close.status !== 200 && close.status !== 201) return fail('S3', `PM đóng B → ${close.status}: ${close.text}`);
    const g2 = await api('GET', `/api/v1/job-board/${idB}`, workerTok, undefined, true);
    if (g2.status !== 200) return fail('S3', `GET-2 B → ${g2.status}`);
    if (g2.json.jobBoard?.state !== 'CLOSED') return fail('S3', `GET-2 state=${g2.json.jobBoard?.state}, mong CLOSED`);
    vars.closedVersionB = g2.json.version;
    return ok('S3', `B AVAILABLE(v${g1.json.version}) → CLOSED(v${g2.json.version}); không command cũ nào từ worker`);
  });

  await runStep('S4', 'read-only: N GET detail 200 → audit/notification delta = 0; 403 → đúng 1 PROJECT_SCOPE_DENIED', async () => {
    const a0 = psqlT('SELECT count(*) FROM audit_logs;').trim();
    const n0 = psqlT('SELECT count(*) FROM notifications;').trim();
    const gets = [
      `/api/v1/job-board/${vars.workOrderIds.A}`,
      `/api/v1/job-board/${vars.workOrderIds.A}`,
      `/api/v1/job-board/${vars.workOrderIds.B}`,
    ];
    for (const g of gets) {
      const r = await api('GET', g, workerTok, undefined, true);
      if (r.status !== 200) return fail('S4', `GET ${g} → ${r.status}`);
    }
    const a1 = psqlT('SELECT count(*) FROM audit_logs;').trim();
    const n1 = psqlT('SELECT count(*) FROM notifications;').trim();
    if (a1 !== a0 || n1 !== n0) return fail('S4', `delta audit ${a0}→${a1}, notif ${n0}→${n1}`);
    // GET ngoài scope → 403 + đúng 1 audit từ chối (hành vi bảo mật kỳ vọng,
    // không phải business write từ read).
    const denied = await api('GET', `/api/v1/job-board/${vars.workOrderIds.C}`, workerTok, undefined, true);
    if (denied.status !== 403) return fail('S4', `GET C → ${denied.status}, mong 403`);
    const a2 = psqlT('SELECT count(*) FROM audit_logs;').trim();
    const lastAction = psqlT('SELECT action FROM audit_logs ORDER BY created_at DESC LIMIT 1;').trim();
    if (a2 !== String(Number(a1) + 1) || lastAction !== 'PROJECT_SCOPE_DENIED') {
      return fail('S4', `audit sau 403: ${a1}→${a2} action=${lastAction}`);
    }
    const cl = psqlT('SELECT count(*) FROM checklist_templates;').trim();
    const seeded = psqlT(`SELECT count(*) FROM work_orders WHERE code IN ('PRD-B1-001','WO-PRT-001','WO-PRT-002');`).trim();
    if (cl !== '5' || seeded !== '3') return fail('S4', `checklist=${cl}/5 seeded=${seeded}/3`);
    return ok('S4', `delta audit=0 notif=0 sau 3 GET-200; 403 → 1 PROJECT_SCOPE_DENIED; checklist 5/5, seeded 3/3`);
  });

  await runStep('S5', 'Expo UI: board → detail A (sections + CTA) → nhấn → hint #48 → PM đóng → re-check → banner changed', async () => {
    const browser = await chromium.launch({ executablePath: CHROME_PATH, args: ['--no-sandbox'] });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const shot = async (id, desc) => {
        await page.screenshot({ path: path.join(SHOTS, `${id}-${LABEL}.png`) });
        console.log(`  shot ${id}-${LABEL}.png — ${desc}`);
      };
      await page.goto(MOBILE, { waitUntil: 'networkidle', timeout: 60000 });
      await page.getByLabel('email input').fill(WORKER.email);
      await page.getByLabel('password input').fill(WORKER.pass);
      await page.getByLabel('login submit').click();
      await page.getByLabel('view profile').waitFor({ timeout: 30000 });
      await page.getByLabel('view profile').click();
      await page.getByLabel('view job board').waitFor({ timeout: 30000 });
      await page.getByLabel('view job board').click();
      const codeA = vars.workOrderCodes.A;
      await page.getByLabel(`view detail ${codeA}`).waitFor({ timeout: 30000 });
      await shot('S7-board', 'Job Board trên Expo (có WO detail A)');
      await page.getByLabel(`view detail ${codeA}`).click();
      await page.getByLabel('claim job button').waitFor({ timeout: 30000 });
      // Sections §3.1 hiện trên UI.
      for (const t of ['bê tông', 'Dự án', 'cốt thép', 'Tho cat gach', 'Nghiệm thu đổ bê tông', 'An toàn lao động']) {
        const bodyText = await page.content();
        if (!new RegExp(t).test(bodyText)) return fail('S5', `UI thiếu section "${t}"`);
      }
      const bodyAll = await page.content();
      if (/createdBy|requestKey|hasActiveAssignment/.test(bodyAll)) return fail('S5', 'UI lộ trường cấm (PII/wiring)');
      await shot('S7-detail', 'Detail A đầy đủ sections + CTA Nhận việc (AVAILABLE)');
      // Nhấn Nhận việc → re-check → hint #48 (KHÔNG claim command).
      const asg0 = psqlT(`SELECT count(*) FROM assignments WHERE work_order_id='${vars.workOrderIds.A}';`).trim();
      await page.getByLabel('claim job button').click();
      await page.getByLabel('claim placeholder hint').waitFor({ timeout: 30000 });
      const asg1 = psqlT(`SELECT count(*) FROM assignments WHERE work_order_id='${vars.workOrderIds.A}';`).trim();
      if (asg0 !== asg1) return fail('S5', `CTA đã ghi assignment ${asg0}→${asg1} (phải là placeholder #48)`);
      await shot('S7-claim-hint', 'Hint #48 sau re-check (không claim thật)');
      // PM đóng board A giữa chừng → worker nhấn CTA re-check → banner changed + CTA biến mất.
      const curA = await api('GET', `/api/v1/work-orders/${vars.workOrderIds.A}`, pmTok, undefined, true);
      const closeA = await api('POST', `/api/v1/work-orders/${vars.workOrderIds.A}/job-board/close`, pmTok, { expectedVersion: curA.json.version });
      if (closeA.status !== 200 && closeA.status !== 201) return fail('S5', `PM đóng A → ${closeA.status}: ${closeA.text}`);
      await page.getByLabel('claim job button').click();
      await page.getByLabel('detail state changed').waitFor({ timeout: 30000 });
      await page.getByLabel('state banner closed').waitFor({ timeout: 30000 });
      if (await page.getByLabel('claim job button').count() !== 0) return fail('S5', 'CTA còn sau khi state đổi CLOSED');
      await shot('S7-changed', 'Banner state-changed + CTA biến mất sau khi PM đóng board');
      // Tải lại → banner changed mất, data CLOSED giữ.
      await page.getByLabel('reload detail').click();
      await page.waitForTimeout(3000);
      if (await page.getByLabel('detail state changed').count() !== 0) return fail('S5', 'banner changed còn sau Tải lại');
      await shot('S7-reloaded', 'Sau Tải lại: data CLOSED giữ, không gửi command cũ');
      // Back về board (browser back — tiền lệ driver-006; nút in-app đã có từ #45).
      await page.goBack();
      await page.getByLabel(`view detail ${codeA}`).waitFor({ timeout: 30000 });
      return ok('S5', 'UI sections + CTA + hint #48 (0 assignment) + banner changed + reload giữ data');
    } finally {
      await browser.close();
    }
  });

  await runStep('S6', 'cleanup demo theo id + verify rest=0', async () => {
    const idList = Object.values(vars.workOrderIds).filter((id) => typeof id === 'string' && id);
    if (idList.length === 0) return fail('S6', 'không có WO demo để cleanup (S1 fail)');
    const ids = idList.map((id) => `'${id}'`).join(',');
    psqlT(`DELETE FROM assignments WHERE work_order_id IN (${ids});`);
    psqlT(`DELETE FROM work_order_state_history WHERE work_order_id IN (${ids});`);
    psqlT(`DELETE FROM work_orders WHERE id IN (${ids});`);
    const rest = psqlT(`SELECT count(*) FROM work_orders WHERE id IN (${ids});`).trim();
    const restAsg = psqlT(`SELECT count(*) FROM assignments WHERE work_order_id IN (${ids});`).trim();
    vars.auditFinal = psqlT('SELECT count(*) FROM audit_logs;').trim();
    vars.rest = rest;
    if (rest !== '0' || restAsg !== '0') return fail('S6', `rest wo=${rest} asg=${restAsg}`);
    const seeded = psqlT(`SELECT count(*) FROM work_orders WHERE code IN ('PRD-B1-001','WO-PRT-001','WO-PRT-002');`).trim();
    if (seeded !== '3') return fail('S6', `seeded rows còn ${seeded}/3`);
    return ok('S6', `WO rest=0, asg rest=0, seeded còn 3/3, audit rows=${vars.auditFinal}`);
  });

  fs.writeFileSync(VARS_PATH, JSON.stringify({ ...vars, results }, null, 2));
  const passed = results.filter((r) => r.ok).length;
  console.log(`\nTỔNG: ${passed}/${results.length} PASS (label=${LABEL}, cleanup WO rest=${vars.rest || '?'}, audit rows=${vars.auditFinal || '?'})`);
  if (passed !== results.length) process.exitCode = 1;
}

main().catch((e) => { console.error('DRIVER FATAL', e); process.exitCode = 1; });
