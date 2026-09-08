/**
 * JOB-SRS-003 E2E driver — Cập nhật Work Order (issue #43).
 * Evidence-only script; phạm vi docs/evidence/job-srs-003 — KHÔNG sửa source, KHÔNG commit.
 *
 * Pattern theo docs/evidence/job-srs-002 + job-srs-001 (playwright-core absolute
 * path, Chrome headless, creds @vinacons.vn, dữ liệu realistic ADR-0003 —
 * không E2E%/test% trong dữ liệu hiển thị; uniqueness bằng suffix digits;
 * cleanup theo id, audit giữ nguyên append-only).
 *
 * Chạy:   node e2e-driver-job-srs-003.cjs
 * Yêu cầu: stack rebuild từ working tree (api có PATCH /api/v1/work-orders/:id
 *          #43; web có route /work-orders/[id] + WorkOrderEditDialog);
 *          admin hoang.anh (bypass), PM quoc.tran (member PRA),
 *          fixtures PRA / KQ-01 / BT-CT / THO-CAT.
 *
 * Đổi status giữa scenario dùng SQL UPDATE trực tiếp work_orders (không có
 * endpoint publish/assign trong slice này) — ghi rõ trong E2E.md.
 * Không migration mới, không đụng data job-srs-001/002 (cleanup theo id,
 * digits khác mỗi run).
 *
 * Luồng: setup → U1 DRAFT edit qua UI (desc/priority/dueAt) + audit before/after →
 * U2 OPEN khóa lịch/skill (UI read-only + PATCH 400) → U3 ASSIGNED đổi lịch + reason
 * (200 + notification + audit) → U4 thiếu reason → 400 → U5 WORK_DONE: PM ẩn nút +
 * PATCH 400, ADMIN + reason → 200 EXCEPTION → U6 optimistic lock 409 (API + UI notice) →
 * U7 đọc lại non-DRAFT GET 200 (regression G1) → cleanup id-based.
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

const ADMIN = { email: 'hoang.anh@vinacons.vn', pass: process.env.E2E_ADMIN_PASS ?? 'E2EAdmin@2025' };
const PM = { email: 'quoc.tran@vinacons.vn', pass: process.env.E2E_PM_PASS ?? 'E2EPm@2025' };

const DIG = String(Date.now()).slice(-6);
const TITLE = `Cải tạo đường ống nước khu KQ-01 ${DIG}`;
const DESC0 = `Mô tả ban đầu khu KQ-01 ${DIG}`;
const DESC1 = `Mô tả đã cập nhật sau kiểm tra hiện trường ${DIG}`;
const REASON_SCHED = `Dời lịch do chờ vật tư về (đợt T9/2026) ${DIG}`;
const REASON_EXC = `Hiệu chỉnh ngoại lệ sau nghiệm thu đợt T9/2026 ${DIG}`;

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
const unwrap = (b) => (b && b.data !== undefined && b.id === undefined ? b.data : b);

async function main() {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);

  const adminTok = await getToken(ADMIN.email, ADMIN.pass);
  const pmTok = await getToken(PM.email, PM.pass);

  // Resolve fixtures PRA / KQ-01 / BT-CT / THO-CAT qua API thật.
  const projects = await api('GET', '/api/v1/projects', adminTok, undefined, true);
  const list = Array.isArray(projects.body) ? projects.body : (projects.body.data || []);
  const pra = list.find((p) => p.code === 'PRA');
  if (!pra) throw new Error(`missing PRA: ${JSON.stringify(list.map((p) => p.code))}`);
  const areas = await api('GET', `/api/v1/projects/${pra.id}/areas?activeOnly=true`, adminTok, undefined, true);
  const kq01 = (areas.body.data || []).find((a) => a.code === 'KQ-01');
  const wtypes = await api('GET', '/api/v1/work-types/active', adminTok, undefined, true);
  const btct = (wtypes.body.data || []).find((w) => w.code === 'BT-CT');
  const trades = await api('GET', '/api/v1/trades?limit=100', adminTok, undefined, true);
  const thocat = ((trades.body.data || trades.body) || []).find((t) => t.code === 'THO-CAT');
  if (!kq01 || !btct || !thocat) throw new Error('missing fixtures KQ-01/BT-CT/THO-CAT');
  console.log(`fixtures PRA=${pra.id} KQ-01=${kq01.id} BT-CT=${btct.id} THO-CAT=${thocat.id}`);
  const auditBaseline = psqlT('SELECT count(*) FROM audit_logs');

  let woId = null;
  let woCode = null;
  let ver = null;
  const getWO = async (tok) => unwrap((await api('GET', `/api/v1/work-orders/${woId}`, tok, undefined, true)).body);
  const patchWO = (tok, payload) => api('PATCH', `/api/v1/work-orders/${woId}`, tok, payload);
  const auditRows = () => psqlT(
    `SELECT action||'|'||coalesce(before_data::text,'')||'=>'||coalesce(after_data::text,'') FROM audit_logs WHERE entity_id='${woId}' ORDER BY created_at;`);

  // U1 — DRAFT: Sửa mô tả/ưu tiên/hạn qua UI → lưu, audit before/after.
  await runStep('U1', 'DRAFT sửa mô tả/ưu tiên/hạn qua UI + audit before/after', async (id) => {
    const c = await api('POST', '/api/v1/work-orders', adminTok, {
      projectId: pra.id, workTypeId: btct.id, areaId: kq01.id,
      title: TITLE, description: DESC0, priority: 'HIGH',
    });
    if (c.status !== 201) return fail(id, `POST create status=${c.status}: ${JSON.stringify(c.body)}`);
    woId = c.body.id; woCode = c.body.code; ver = c.body.version ?? 1;
    await loginWeb(page, ADMIN.email, ADMIN.pass);
    await page.goto(`${WEB}/work-orders/${woId}`, { waitUntil: 'networkidle' });
    await page.waitForFunction((t) => document.body.textContent.includes(t), TITLE, { timeout: 25000 });
    const editBtn = page.getByRole('button', { name: 'Sửa', exact: true });
    if ((await editBtn.count()) === 0) return fail(id, 'không thấy nút Sửa ở DRAFT (admin)');
    await editBtn.click();
    await page.waitForFunction(() => document.body.textContent.includes('Sửa Work Order'), { timeout: 15000 });
    await page.fill('#woedit-description', DESC1);
    await page.selectOption('#woedit-priority', 'URGENT');
    await page.fill('#woedit-dueat', '2026-12-20T17:00');
    await snap(page, 'U1-dialog-filled', 'dialog Sửa đã điền desc/priority/dueAt');
    await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
    await page.waitForFunction((d) => document.body.textContent.includes(d), DESC1, { timeout: 25000 });
    const t = await bodyText(page);
    if (!t.includes('2026') && !t.includes('20/12')) {
      // Hạn hiển thị định dạng locale — kiểm tra qua API thay vì text cứng.
    }
    await snap(page, 'U1-updated', 'detail sau khi lưu');
    const g = await getWO(adminTok);
    ver = g.version;
    if (g.description !== DESC1) return fail(id, `description chưa đổi: ${g.description}`);
    if (g.priority !== 'URGENT') return fail(id, `priority chưa đổi: ${g.priority}`);
    if (!g.dueAt) return fail(id, 'dueAt chưa lưu');
    if (ver !== 2) return fail(id, `version kỳ vọng 2, được ${ver}`);
    const rows = auditRows();
    const upd = rows.split('\n').filter((r) => r.startsWith('JOB_WORK_ORDER_UPDATED|'));
    if (upd.length !== 1) return fail(id, `audit UPDATED kỳ vọng 1, được ${upd.length}: ${rows.slice(0, 500)}`);
    for (const f of ['description', 'priority', 'dueAt']) {
      if (!upd[0].includes(`"${f}"`)) return fail(id, `audit thiếu field ${f}: ${upd[0].slice(0, 600)}`);
    }
    if (!upd[0].includes(DESC0.slice(0, 20)) || !upd[0].includes(DESC1.slice(0, 20))) {
      return fail(id, `audit thiếu before/after mô tả: ${upd[0].slice(0, 600)}`);
    }
    return ok(id, `200 desc/priority/dueAt đổi, version 1→2, audit UPDATED before/after đủ 3 trường`);
  });

  // U2 — OPEN (seed SQL): UI khóa lịch/skill + PATCH lịch → 400 FIELD_LOCKED.
  await runStep('U2', 'OPEN khóa lịch/skill: UI read-only + PATCH 400 FIELD_LOCKED', async (id) => {
    psqlT(`UPDATE work_orders SET status='OPEN' WHERE id='${woId}';`);
    await page.goto(`${WEB}/work-orders/${woId}`, { waitUntil: 'networkidle' });
    await page.waitForFunction((t) => document.body.textContent.includes(t), TITLE, { timeout: 25000 });
    await page.getByRole('button', { name: 'Sửa', exact: true }).click();
    await page.waitForFunction(() => document.body.textContent.includes('Sửa Work Order'), { timeout: 15000 });
    const startDisabled = await page.locator('#woedit-start').isDisabled();
    const endDisabled = await page.locator('#woedit-end').isDisabled();
    const t = await bodyText(page);
    if (!startDisabled || !endDisabled) return fail(id, `lịch chưa read-only (start=${startDisabled}, end=${endDisabled})`);
    if (!t.includes('Khóa ở trạng thái OPEN')) return fail(id, 'thiếu text Khóa ở trạng thái OPEN');
    await snap(page, 'U2-locked', 'dialog OPEN: lịch/skill read-only');
    await page.getByRole('button', { name: 'Hủy', exact: true }).click();
    const r = await patchWO(adminTok, { plannedStartAt: '2026-10-06T01:00:00.000Z', expectedVersion: ver });
    if (r.status !== 400) return fail(id, `PATCH lịch ở OPEN kỳ vọng 400, được ${r.status}: ${JSON.stringify(r.body)}`);
    if (r.body.code !== 'WORK_ORDER_FIELD_LOCKED') return fail(id, `code kỳ vọng FIELD_LOCKED: ${JSON.stringify(r.body)}`);
    if (!r.body.fieldErrors || !r.body.fieldErrors.plannedStartAt) {
      return fail(id, `thiếu fieldErrors.plannedStartAt: ${JSON.stringify(r.body)}`);
    }
    return ok(id, 'UI lịch read-only + text khóa; PATCH → 400 FIELD_LOCKED per-field');
  });

  // U3 — ASSIGNED (seed SQL): đổi lịch + reason → 200 + notification + audit.
  await runStep('U3', 'ASSIGNED đổi lịch + reason → 200 + notification + audit', async (id) => {
    psqlT(`UPDATE work_orders SET status='ASSIGNED' WHERE id='${woId}';`);
    const S1 = '2026-10-06T01:00:00.000Z';
    const E1 = '2026-10-10T10:00:00.000Z';
    const r = await patchWO(adminTok, { plannedStartAt: S1, plannedEndAt: E1, reason: REASON_SCHED, expectedVersion: ver });
    if (r.status !== 200) return fail(id, `PATCH status=${r.status}: ${JSON.stringify(r.body)}`);
    ver = unwrap(r.body).version;
    if (ver !== 3) return fail(id, `version kỳ vọng 3, được ${ver}`);
    const notif = psqlT(
      `SELECT notification_type||'|'||recipient_user_id||'|'||entity_type||'|'||dedup_key FROM notifications WHERE entity_id='${woId}';`);
    const creator = psqlT(`SELECT created_by FROM work_orders WHERE id='${woId}';`);
    if (!notif.includes('WORK_ORDER_UPDATED')) return fail(id, `thiếu notification row: ${notif}`);
    const parts = notif.split('|');
    if (parts[1] !== creator) return fail(id, `recipient ${parts[1]} != creator ${creator}`);
    if (!parts[3] || !parts[3].startsWith('woupd-')) return fail(id, `dedup_key sai: ${parts[3]}`);
    const rows = auditRows();
    const upd = rows.split('\n').filter((x) => x.startsWith('JOB_WORK_ORDER_UPDATED|'));
    const last = upd[upd.length - 1];
    if (!last.includes('"plannedStartAt"') || !last.includes('"plannedEndAt"')) {
      return fail(id, `audit thiếu before/after 2 trường lịch: ${last.slice(0, 600)}`);
    }
    return ok(id, `200 version→3, notification cho creator dedup woupd-*, audit before/after đủ 2 trường lịch`);
  });

  // U4 — ASSIGNED đổi lịch thiếu reason → 400 REASON_REQUIRED.
  await runStep('U4', 'ASSIGNED đổi lịch thiếu reason → 400 REASON_REQUIRED', async (id) => {
    const r = await patchWO(adminTok, { plannedStartAt: '2026-10-07T01:00:00.000Z', expectedVersion: ver });
    if (r.status !== 400) return fail(id, `kỳ vọng 400, được ${r.status}: ${JSON.stringify(r.body)}`);
    if (r.body.code !== 'WORK_ORDER_REASON_REQUIRED') return fail(id, `code kỳ vọng REASON_REQUIRED: ${JSON.stringify(r.body)}`);
    if (!r.body.fieldErrors || !r.body.fieldErrors.reason) {
      return fail(id, `thiếu fieldErrors.reason: ${JSON.stringify(r.body)}`);
    }
    const g = await getWO(adminTok);
    if (g.version !== ver) return fail(id, `version đổi sau 400 (${ver}→${g.version}) — phải giữ nguyên`);
    return ok(id, '400 REASON_REQUIRED + fieldErrors.reason, version giữ nguyên');
  });

  // U5 — WORK_DONE (seed SQL): PM ẩn nút + PATCH 400; ADMIN + reason → 200 EXCEPTION.
  await runStep('U5', 'WORK_DONE: PM ẩn nút/PATCH 400; ADMIN reason → 200 EXCEPTION', async (id) => {
    psqlT(`UPDATE work_orders SET status='WORK_DONE' WHERE id='${woId}';`);
    const pmCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pmPage = await pmCtx.newPage();
    pmPage.setDefaultTimeout(30000);
    await loginWeb(pmPage, PM.email, PM.pass);
    await pmPage.goto(`${WEB}/work-orders/${woId}`, { waitUntil: 'networkidle' });
    await pmPage.waitForFunction((t) => document.body.textContent.includes(t), TITLE, { timeout: 25000 });
    const count = await pmPage.getByRole('button', { name: 'Sửa', exact: true }).count();
    await snap(pmPage, 'U5-pm-hidden', 'PM xem WORK_DONE: không nút Sửa');
    await pmCtx.close();
    if (count !== 0) return fail(id, `PM vẫn thấy nút Sửa ở WORK_DONE (count=${count})`);
    const p1 = await patchWO(pmTok, { description: `PM sửa lén ${DIG}`, expectedVersion: ver });
    // PM có write-scope nhưng policy khóa terminal với non-ADMIN → 400 FIELD_LOCKED.
    if (p1.status !== 400 && p1.status !== 403) {
      return fail(id, `PM PATCH kỳ vọng 400/403, được ${p1.status}: ${JSON.stringify(p1.body)}`);
    }
    if (p1.status === 400 && p1.body.code !== 'WORK_ORDER_FIELD_LOCKED') {
      return fail(id, `PM code kỳ vọng FIELD_LOCKED: ${JSON.stringify(p1.body)}`);
    }
    const DESC_EXC = `Mô tả hiệu chỉnh ngoại lệ ${DIG}`;
    const p2 = await patchWO(adminTok, { description: DESC_EXC, reason: REASON_EXC, expectedVersion: ver });
    if (p2.status !== 200) return fail(id, `ADMIN EXCEPTION status=${p2.status}: ${JSON.stringify(p2.body)}`);
    ver = unwrap(p2.body).version;
    const rows = auditRows();
    if (!rows.includes('WORK_ORDER_EXCEPTION_EDIT')) return fail(id, `thiếu audit EXCEPTION: ${rows.slice(0, 500)}`);
    const exc = rows.split('\n').filter((x) => x.startsWith('WORK_ORDER_EXCEPTION_EDIT|'));
    if (!exc[exc.length - 1].includes('"description"')) return fail(id, 'audit EXCEPTION thiếu before/after description');
    return ok(id, `PM ẩn nút + PATCH ${p1.status}; ADMIN 200 EXCEPTION audit WORK_ORDER_EXCEPTION_EDIT`);
  });

  // U6 — optimistic lock: 2 bản cùng version → lần 2 409 + UI notice tải lại.
  await runStep('U6', 'optimistic lock: tab cũ 409 + UI notice tải lại', async (id) => {
    psqlT(`UPDATE work_orders SET status='DRAFT' WHERE id='${woId}';`);
    const vA = (await getWO(adminTok)).version;
    const vB = (await getWO(adminTok)).version;
    if (vA !== vB) return fail(id, `2 fetch lệch version (${vA}/${vB}) — setup sai`);
    const r1 = await patchWO(adminTok, { description: `Cập nhật tab một ${DIG}`, expectedVersion: vA });
    if (r1.status !== 200) return fail(id, `tab1 status=${r1.status}: ${JSON.stringify(r1.body)}`);
    ver = unwrap(r1.body).version;
    const r2 = await patchWO(adminTok, { description: `Cập nhật tab hai ${DIG}`, expectedVersion: vB });
    if (r2.status !== 409) return fail(id, `tab2 kỳ vọng 409, được ${r2.status}: ${JSON.stringify(r2.body)}`);
    if (r2.body.code !== 'WORK_ORDER_CONFLICT') return fail(id, `code kỳ vọng CONFLICT: ${JSON.stringify(r2.body)}`);
    // UI: mở dialog (version N), bump qua API (N+1), submit dialog → 409 notice.
    await page.goto(`${WEB}/work-orders/${woId}`, { waitUntil: 'networkidle' });
    await page.waitForFunction((t) => document.body.textContent.includes(t), TITLE, { timeout: 25000 });
    await page.getByRole('button', { name: 'Sửa', exact: true }).click();
    await page.waitForFunction(() => document.body.textContent.includes('Sửa Work Order'), { timeout: 15000 });
    await patchWO(adminTok, { instructions: `Bump làm cũ dialog ${DIG}` });
    ver = (await getWO(adminTok)).version;
    await page.fill('#woedit-description', `Ghi đè từ dialog cũ ${DIG}`);
    await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
    await page.waitForFunction(() => document.body.textContent.includes('Tải lại'), { timeout: 15000 });
    await snap(page, 'U6-conflict', 'notice 409 + nút Tải lại');
    await page.getByRole('button', { name: 'Tải lại', exact: true }).click();
    return ok(id, `API tab2 409 CONFLICT (version hiện tại ${ver}); UI hiện notice + nút Tải lại`);
  });

  // U7 — đọc lại WO non-DRAFT sau edit (regression G1).
  await runStep('U7', 'đọc lại WO non-DRAFT sau edit → GET 200 (regression G1)', async (id) => {
    psqlT(`UPDATE work_orders SET status='ASSIGNED' WHERE id='${woId}';`);
    const g = await api('GET', `/api/v1/work-orders/${woId}`, adminTok, undefined, true);
    if (g.status !== 200) return fail(id, `GET ASSIGNED status=${g.status}: ${JSON.stringify(g.body)}`);
    const wo = unwrap(g.body);
    if (wo.id !== woId || wo.status !== 'ASSIGNED') return fail(id, `GET sai nội dung: ${JSON.stringify(wo).slice(0, 300)}`);
    await page.goto(`${WEB}/work-orders/${woId}`, { waitUntil: 'networkidle' });
    await page.waitForFunction((t) => document.body.textContent.includes(t), TITLE, { timeout: 25000 });
    return ok(id, `GET ASSIGNED 200 + UI detail render (code ${wo.code}, version ${wo.version})`);
  });

  await browser.close();

  // Cleanup id-based (audit giữ nguyên append-only).
  if (woId) {
    psqlT(`DELETE FROM notifications WHERE entity_id='${woId}';`);
    psqlT(`DELETE FROM work_orders WHERE id='${woId}';`);
  }
  const rest = psqlT(`SELECT count(*) FROM work_orders WHERE title LIKE '%${DIG}%';`);
  const notifRest = psqlT(`SELECT count(*) FROM notifications WHERE entity_id='${woId}';`);
  const auditFinal = psqlT('SELECT count(*) FROM audit_logs');
  const vars = {
    _note: 'Throwaway E2E-only demo credentials (seed/reset per evidence docs). Never production.',
    digits: DIG,
    title: TITLE,
    workOrderId: woId,
    workOrderCode: woCode,
    praId: pra ? pra.id : null,
    auditBaseline,
    auditFinal,
    rest: rest.trim(),
    notifRest: (notifRest || '').trim(),
    results: results.map((r) => ({ id: r.id, ok: r.ok, note: r.note })),
  };
  fs.writeFileSync(VARS_PATH, `${JSON.stringify(vars, null, 2)}\n`);

  const passed = results.filter((r) => r.ok).length;
  console.log(`\nTỔNG: ${passed}/${results.length} PASS (digits=${DIG}, code=${woCode}, cleanup WO rest=${rest.trim()}, notif rest=${(notifRest || '').trim()}, audit ${auditBaseline}→${auditFinal})`);
  if (passed !== results.length || rest.trim() !== '0') process.exitCode = 1;
}

main().catch((e) => { console.error('DRIVER FATAL:', e); process.exit(2); });
