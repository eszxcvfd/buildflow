/**
 * PRJ-SRS-009 (#40) E2E driver — Attachments cơ bản (project + WO extension).
 * Evidence-only script; phạm vi docs/evidence — KHÔNG commit, KHÔNG sửa source.
 *
 * Chạy:   node e2e-driver-prj-srs-009.cjs
 * Yêu cầu: stack từ working tree (api có attachments #40 — PHẢI rebuild sau
 *          stage-1 vì image cũ thiếu route, xem PRJ-SRS-009-E2E.md §4a F1;
 *          web có ProjectAttachments slice).
 * Tài khoản canonical nguyên trạng (không reset password, không tạo user):
 *   PM    quoc.tran@vinacons.vn / E2EPm@2025      (MANAGER của PRA + PRD)
 *   WORKER hau.le@vinacons.vn / E2EWorker2@2025   (WORKER của PRA, ∉ PRD)
 *   OUTSIDER thang.nguyen@vinacons.vn / E2EWorker@2025 (∉ PRA, WORKER của PRD)
 *   ADMIN hoang.anh@vinacons.vn / E2EAdmin@2025   (đọc /audit-logs)
 *
 * Dữ liệu dùng sẵn: project PRA (canonical) + WO PRD-B1-001 (canonical, cho L5).
 * Seed SQL KHÔNG cần (project/member đã có) — attachments tạo hoàn toàn qua API/UI.
 *
 * Luồng: A1 upload PDF qua UI dialog (metadata+uploader) → A2 JPEG+WebP qua API →
 * A3 fake txt/exe rename .jpg → 400 magic-byte → A4 >10MB → 400 (không chạm disk) →
 * A5 download byte-equal (sha256) → A6 retire qua UI + reason → badge + audit →
 * A7 permission (WORKER upload 403 + list/download ok; non-member 403 không leak;
 * WORKER UI ẩn nút Tải lên) → A8 replay cùng requestKey → 1 file →
 * L5 WO attach (upload + list + outsider 403) → cleanup id-based.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { chromium } = require('/home/trung/.npm-global/lib/node_modules/@playwright/mcp/node_modules/playwright-core');

const WEB = 'http://localhost:3001';
const API = 'http://localhost:3000';
const SHOTS = path.join(__dirname, 'shots');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const PM_EMAIL = 'quoc.tran@vinacons.vn';
const PM_PASS = 'E2EPm@2025';
const WORKER_EMAIL = 'hau.le@vinacons.vn';
const WORKER_PASS = 'E2EWorker2@2025';
const OUTSIDER_EMAIL = 'thang.nguyen@vinacons.vn';
const OUTSIDER_PASS = 'E2EWorker@2025';
const ADMIN_EMAIL = 'hoang.anh@vinacons.vn';
const ADMIN_PASS = 'E2EAdmin@2025';

const PRA_ID = '10000000-0000-4000-8000-000000000001';
const PRD_ID = 'e2e4b000-0000-4000-8000-0000000000b1';
const WO_ID = 'e2e4b300-0000-4000-8000-0000000000b4'; // PRD-B1-001 (canonical)

const CAPTION_A1 = 'Bản vẽ mặt bằng tầng 1 — bản cập nhật tháng 9 (E2E #40)';
const RETIRE_REASON = 'Bản vẽ cũ, đã có bản cập nhật mới (E2E #40)';

// ---- Fixtures (magic bytes thật, đúng sniff policy attachment.policy.ts) ----
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'att-e2e-'));
const PDF_BYTES = Buffer.concat([
  Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< >>\n%%EOF\n', 'utf8'),
  Buffer.from('E2E-PRJ-SRS-009-PDF-CONTENT-'.repeat(40), 'utf8'),
]);
const JPG_BYTES = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]),
  Buffer.from('E2E-PRJ-SRS-009-JPEG-CONTENT-'.repeat(40), 'utf8'),
]);
const WEBP_BYTES = Buffer.concat([
  Buffer.from('RIFF', 'ascii'), Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP', 'ascii'),
  Buffer.from('E2E-PRJ-SRS-009-WEBP-CONTENT-'.repeat(40), 'utf8'),
]);
const FAKE_TXT_AS_JPG = Buffer.from('Day chi la file text doi ten .jpg — khong co magic bytes anh nao.\n'.repeat(10), 'utf8');
const FAKE_EXE_AS_JPG = Buffer.concat([
  Buffer.from('MZ\x90\x00FAKE-EXE-DOI-TEN-THANH-JPG', 'utf8'),
  Buffer.from('E2E-FAKE-EXE-'.repeat(40), 'utf8'),
]);
const BIG_BYTES = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(10 * 1024 * 1024 + 100 - 4, 0x41), // >10MB, magic JPEG hợp lệ
]);
const PDF_PATH = path.join(TMP, 'e2e-ban-ve-t1.pdf');
const JPG_PATH = path.join(TMP, 'e2e-anh-cong-truong.jpg');
const WEBP_PATH = path.join(TMP, 'e2e-so-do.webp');
fs.writeFileSync(PDF_PATH, PDF_BYTES);
fs.writeFileSync(JPG_PATH, JPG_BYTES);
fs.writeFileSync(WEBP_PATH, WEBP_BYTES);
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');

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
function uploadsList(projectId) {
  try {
    return execFileSync('docker', [
      'exec', 'buildflow-api-1', 'sh', '-c', `ls -1 /app/uploads/${projectId} 2>/dev/null | sort`,
    ], { encoding: 'utf8', timeout: 15000 }).trim();
  } catch { return ''; }
}

async function apiJson(method, urlPath, token, body, extraHeaders) {
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
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16));
}
/** Multipart upload qua API (mirror web client: FormData, không set Content-Type tay). */
async function apiUpload(basePath, token, { fileName, mime, bytes, caption, requestKey }) {
  const form = new FormData();
  form.append('file', new File([bytes], fileName, { type: mime }), fileName);
  if (caption !== undefined && caption !== null) form.append('caption', caption);
  if (requestKey) form.append('requestKey', requestKey);
  const res = await fetch(`${API}${basePath}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'X-Correlation-Id': uuid() },
    body: form,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, headers: res.headers, body: json };
}
async function apiDownload(urlPath, token) {
  const res = await fetch(`${API}${urlPath}`, {
    method: 'GET', headers: { Authorization: `Bearer ${token}` },
  });
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, headers: res.headers, bytes: buf };
}
async function getToken(email, password) {
  const r = await apiJson('POST', '/api/v1/auth/login', null, { email, password });
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

/** Cleanup id-based: attachments driver + files uploads mới. Audit giữ nguyên. */
let driverAttIds = [];
function cleanupRun(uploadsBaseline) {
  if (driverAttIds.length) {
    const ids = driverAttIds.map((id) => `'${id}'`).join(',');
    psqlT(`DELETE FROM attachments WHERE id IN (${ids})`);
  }
  for (const pid of [PRA_ID, PRD_ID]) {
    const now = uploadsList(pid);
    const base = (uploadsBaseline && uploadsBaseline[pid]) || '';
    const baseSet = new Set(base.split('\n').filter(Boolean));
    for (const f of now.split('\n').filter(Boolean)) {
      if (!baseSet.has(f)) {
        execFileSync('docker', ['exec', 'buildflow-api-1', 'rm', '-f', `/app/uploads/${pid}/${f}`], { timeout: 15000 });
      }
    }
  }
}
function restCount() {
  const ids = driverAttIds.length ? driverAttIds.map((id) => `'${id}'`).join(',') : `'00000000-0000-0000-0000-000000000000'`;
  const db = psqlT(`SELECT count(*) FROM attachments WHERE id IN (${ids})`);
  const files = [uploadsList(PRA_ID), uploadsList(PRD_ID)].join('\n').split('\n').filter(Boolean).length;
  return `${db}/${files}`;
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
  const workerToken = await getToken(WORKER_EMAIL, WORKER_PASS);
  const outsiderToken = await getToken(OUTSIDER_EMAIL, OUTSIDER_PASS);
  const adminToken = await getToken(ADMIN_EMAIL, ADMIN_PASS);
  if (!pmToken || !workerToken || !outsiderToken || !adminToken) {
    console.error(`Không lấy được token (pm=${!!pmToken} worker=${!!workerToken} outsider=${!!outsiderToken} admin=${!!adminToken})`);
    await browser.close().catch(() => {});
    process.exit(2);
  }
  const pmUserId = psqlT(`SELECT id FROM users WHERE email='${PM_EMAIL}'`);

  // ---- Setup: baseline uploads + pre-cleanup (không seed project/member — dùng canonical) ----
  const uploadsBaseline = { [PRA_ID]: uploadsList(PRA_ID), [PRD_ID]: uploadsList(PRD_ID) };
  cleanupRun(uploadsBaseline);
  const probe = await apiJson('GET', `/api/v1/projects/${PRA_ID}/attachments`, pmToken);
  if (probe.status !== 200) {
    console.error(`Route attachments chưa live (GET list status=${probe.status}) — cần rebuild api từ working tree`);
    await browser.close().catch(() => {});
    process.exit(2);
  }
  console.log(`setup: PRA list probe=200 total=${probe.body.total}; uploads baseline PRA/PRD='${uploadsBaseline[PRA_ID]}'/'${uploadsBaseline[PRD_ID]}'`);
  const auditBaseline = psqlT(`SELECT count(*) FROM audit_logs WHERE action IN ('PRJ_ATTACHMENT_UPLOADED','PRJ_ATTACHMENT_RETIRED')`);

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  await loginWeb(page, PM_EMAIL, PM_PASS);

  let attA1 = null;   // PDF qua UI (A1) → retire ở A6
  let attJpg = null;  // JPEG qua API (A2)
  let attWebp = null; // WebP qua API (A2)
  let attReplay = null; // A8
  let attWo = null;   // L5

  // ============ A1: upload PDF qua UI dialog ============
  await runStep('A1', 'Upload PDF hợp lệ qua UI dialog (metadata đúng)', async (id) => {
    await page.goto(`${WEB}/projects/${PRA_ID}`, { waitUntil: 'networkidle' });
    let t = await bodyText(page);
    if (!t.includes('Tài liệu đính kèm')) return fail(id, `detail không hiện panel attachments: ${t.slice(0, 300)}`);
    await page.getByRole('button', { name: 'Tải lên', exact: true }).click();
    await page.waitForFunction(
      () => (document.body.textContent || '').includes('Tải lên tài liệu'),
      null, { timeout: 20000 },
    );
    await page.locator('#attachment-upload-file').setInputFiles(PDF_PATH);
    await page.locator('#attachment-upload-caption').fill(CAPTION_A1);
    await page.getByRole('button', { name: 'Xác nhận tải lên' }).click();
    await page.waitForFunction(
      (txt) => (document.body.textContent || '').includes(txt),
      'Đã tải lên', { timeout: 25000 },
    );
    await page.waitForFunction(
      (nm) => (document.body.textContent || '').includes(nm),
      'e2e-ban-ve-t1.pdf', { timeout: 25000 },
    );
    await snap(page, `${id}-uploaded`, 'Upload PDF qua dialog → toast + row trong list');

    const l = await apiJson('GET', `/api/v1/projects/${PRA_ID}/attachments`, pmToken);
    const rows = (l.body && l.body.data) || [];
    const hit = rows.find((a) => a.fileName === 'e2e-ban-ve-t1.pdf');
    if (!hit) return fail(id, `API list không thấy file vừa tải (total=${l.body.total})`);
    if (hit.mimeType !== 'application/pdf') return fail(id, `mimeType=${hit.mimeType} (mong application/pdf)`);
    if (hit.sizeBytes !== PDF_BYTES.length) return fail(id, `sizeBytes=${hit.sizeBytes} (mong ${PDF_BYTES.length})`);
    if (hit.caption !== CAPTION_A1) return fail(id, `caption không khớp: ${hit.caption}`);
    if (hit.isActive !== true) return fail(id, 'isActive=false ngay sau upload');
    if ('storageKey' in hit || 'requestKey' in hit) return fail(id, 'profile lộ storageKey/requestKey');
    const dbUp = psqlT(`SELECT uploaded_by::text FROM attachments WHERE id='${hit.id}'`);
    if (dbUp !== pmUserId) return fail(id, `uploaded_by=${dbUp} (mong PM ${pmUserId})`);
    // no-store trên list
    if (!(l.headers.get('cache-control') || '').includes('no-store')) {
      return fail(id, `list thiếu Cache-Control: no-store (${l.headers.get('cache-control')})`);
    }
    attA1 = hit;
    driverAttIds.push(hit.id);
    return ok(id, `UI upload OK; metadata name/type/size/uploader đúng; no-store; id=${hit.id.slice(0, 8)}…`);
  });

  // ============ A2: upload JPEG + WebP qua API ============
  await runStep('A2', 'Upload JPEG + WebP qua API (sniff magic đúng)', async (id) => {
    const r1 = await apiUpload(`/api/v1/projects/${PRA_ID}/attachments`, pmToken,
      { fileName: 'e2e-anh-cong-truong.jpg', mime: 'image/jpeg', bytes: JPG_BYTES, caption: 'Ảnh tiến độ E2E', requestKey: uuid() });
    if (r1.status !== 201) return fail(id, `JPEG upload status=${r1.status} body=${JSON.stringify(r1.body).slice(0, 300)}`);
    const r2 = await apiUpload(`/api/v1/projects/${PRA_ID}/attachments`, pmToken,
      { fileName: 'e2e-so-do.webp', mime: 'image/webp', bytes: WEBP_BYTES, caption: null, requestKey: uuid() });
    if (r2.status !== 201) return fail(id, `WebP upload status=${r2.status} body=${JSON.stringify(r2.body).slice(0, 300)}`);
    if (r1.body.mimeType !== 'image/jpeg' || r2.body.mimeType !== 'image/webp') {
      return fail(id, `mime sniff sai: ${r1.body.mimeType}/${r2.body.mimeType}`);
    }
    attJpg = r1.body; attWebp = r2.body;
    driverAttIds.push(r1.body.id, r2.body.id);
    return ok(id, `JPEG 201 + WebP 201, mime sniff đúng; ids=${r1.body.id.slice(0, 8)}…/${r2.body.id.slice(0, 8)}…`);
  });

  // ============ A3: sai loại (txt/exe rename .jpg) → 400 magic-byte ============
  await runStep('A3', 'Sai loại (txt/exe đổi tên .jpg) → 400 magic-byte, lý do rõ', async (id) => {
    const filesBefore = uploadsList(PRA_ID);
    const b1 = await apiUpload(`/api/v1/projects/${PRA_ID}/attachments`, pmToken,
      { fileName: 'e2e-gia-mao.jpg', mime: 'image/jpeg', bytes: FAKE_TXT_AS_JPG, caption: null, requestKey: uuid() });
    if (b1.status !== 400) return fail(id, `fake-txt status=${b1.status} (mong 400)`);
    const b2 = await apiUpload(`/api/v1/projects/${PRA_ID}/attachments`, pmToken,
      { fileName: 'e2e-virus.jpg', mime: 'image/jpeg', bytes: FAKE_EXE_AS_JPG, caption: null, requestKey: uuid() });
    if (b2.status !== 400) return fail(id, `fake-exe status=${b2.status} (mong 400)`);
    for (const [lbl, b] of [['txt', b1], ['exe', b2]]) {
      const s = JSON.stringify(b.body || {});
      if (!/file/i.test(s)) return fail(id, `${lbl}: 400 không nêu field file: ${s.slice(0, 300)}`);
    }
    const cnt = psqlT(`SELECT count(*) FROM attachments WHERE file_name IN ('e2e-gia-mao.jpg','e2e-virus.jpg')`);
    if (cnt !== '0') return fail(id, 'file giả đã lọt vào DB');
    if (uploadsList(PRA_ID) !== filesBefore) return fail(id, 'file giả đã chạm disk uploads');
    return ok(id, 'txt/exe rename .jpg → 400 fieldErrors.file; không DB row, không chạm disk');
  });

  // ============ A4: quá 10MB → 400 ============
  await runStep('A4', 'File quá 10MB → 400, không chạm disk', async (id) => {
    const filesBefore = uploadsList(PRA_ID);
    const r = await apiUpload(`/api/v1/projects/${PRA_ID}/attachments`, pmToken,
      { fileName: 'e2e-qua-lon.jpg', mime: 'image/jpeg', bytes: BIG_BYTES, caption: null, requestKey: uuid() });
    if (r.status !== 400) return fail(id, `status=${r.status} (mong 400) body=${JSON.stringify(r.body).slice(0, 300)}`);
    const s = JSON.stringify(r.body || {});
    if (!/10MB|quá lớn|quá hạn|size/i.test(s)) return fail(id, `400 không nêu lý do kích thước: ${s.slice(0, 300)}`);
    const cnt = psqlT(`SELECT count(*) FROM attachments WHERE file_name='e2e-qua-lon.jpg'`);
    if (cnt !== '0') return fail(id, 'file quá hạn đã lọt vào DB');
    if (uploadsList(PRA_ID) !== filesBefore) return fail(id, 'file quá hạn đã chạm disk uploads');
    return ok(id, `>10MB (${BIG_BYTES.length}B) → 400 lý do rõ; không DB row, không chạm disk`);
  });

  // ============ A5: tải xuống byte-equal ============
  await runStep('A5', 'Tải xuống — nội dung byte-equal file gốc (sha256)', async (id) => {
    if (!attA1) return fail(id, 'thiếu attA1 (A1 fail)');
    const d = await apiDownload(`/api/v1/projects/${PRA_ID}/attachments/${attA1.id}/content`, pmToken);
    if (d.status !== 200) return fail(id, `download status=${d.status}`);
    if (sha256(d.bytes) !== sha256(PDF_BYTES)) return fail(id, 'bytes tải về khác file gốc');
    const cd = d.headers.get('content-disposition') || '';
    if (!/attachment/i.test(cd)) return fail(id, `thiếu Content-Disposition: attachment (${cd})`);
    if (!(d.headers.get('cache-control') || '').includes('no-store')) {
      return fail(id, `content thiếu no-store (${d.headers.get('cache-control')})`);
    }
    return ok(id, `sha256 khớp ${sha256(PDF_BYTES).slice(0, 16)}…; attachment + no-store`);
  });

  // ============ A6: ngừng sử dụng qua UI + reason → badge + audit ============
  await runStep('A6', 'Ngừng sử dụng + reason qua UI → badge Đã ngừng + audit (history giữ)', async (id) => {
    if (!attA1) return fail(id, 'thiếu attA1 (A1 fail)');
    await page.goto(`${WEB}/projects/${PRA_ID}`, { waitUntil: 'networkidle' });
    const row = page.locator('tr', { hasText: 'e2e-ban-ve-t1.pdf' });
    await row.getByRole('button', { name: 'Ngừng sử dụng' }).click();
    await page.locator('#attachment-retire-reason').fill(RETIRE_REASON);
    await page.getByRole('button', { name: 'Xác nhận ngừng sử dụng' }).click();
    await page.waitForFunction(
      (txt) => (document.body.textContent || '').includes(txt),
      'Đã ngừng sử dụng', { timeout: 25000 },
    );
    await page.waitForFunction(
      () => {
        const rows = Array.from(document.querySelectorAll('tr'));
        const hit = rows.find((r) => (r.textContent || '').includes('e2e-ban-ve-t1.pdf'));
        return hit && (hit.textContent || '').includes('Đã ngừng');
      }, null, { timeout: 25000 },
    );
    await snap(page, `${id}-retired`, 'Retire qua UI → badge Đã ngừng, row vẫn trong list');

    const g = await apiJson('GET', `/api/v1/projects/${PRA_ID}/attachments`, pmToken);
    const hit = ((g.body && g.body.data) || []).find((a) => a.id === attA1.id);
    if (!hit) return fail(id, 'file retired biến mất khỏi list (phải giữ history)');
    if (hit.isActive !== false) return fail(id, 'isActive vẫn true sau retire');
    const dbReason = psqlT(`SELECT deactivate_reason FROM attachments WHERE id='${attA1.id}'`);
    if (dbReason !== RETIRE_REASON) return fail(id, `deactivate_reason không khớp: ${dbReason}`);
    const a = await apiJson('GET', '/api/v1/audit-logs?action=PRJ_ATTACHMENT_RETIRED&limit=20', adminToken);
    const rows2 = (a.body && a.body.data) || [];
    const audit = rows2.find((r) => r.entityId === attA1.id);
    if (!audit) return fail(id, `không thấy audit RETIRED cho att: ${JSON.stringify(a.body).slice(0, 300)}`);
    // download bản retired vẫn được
    const d = await apiDownload(`/api/v1/projects/${PRA_ID}/attachments/${attA1.id}/content`, pmToken);
    if (d.status !== 200 || sha256(d.bytes) !== sha256(PDF_BYTES)) {
      return fail(id, `download sau retire status=${d.status} / bytes khác gốc`);
    }
    // retire lần 2 → alreadyInactive, không audit mới
    const auditBefore = psqlT(`SELECT count(*) FROM audit_logs WHERE action='PRJ_ATTACHMENT_RETIRED' AND entity_id='${attA1.id}'`);
    const r2 = await apiJson('PATCH', `/api/v1/projects/${PRA_ID}/attachments/${attA1.id}/retire`, pmToken,
      { reason: 'lặp' }, { 'X-Correlation-Id': uuid() });
    if (r2.status !== 200 || r2.body.alreadyInactive !== true) {
      return fail(id, `retire lần 2 status=${r2.status} body=${JSON.stringify(r2.body).slice(0, 200)}`);
    }
    const auditAfter = psqlT(`SELECT count(*) FROM audit_logs WHERE action='PRJ_ATTACHMENT_RETIRED' AND entity_id='${attA1.id}'`);
    if (auditAfter !== auditBefore) return fail(id, 'alreadyInactive đã ghi audit mới');
    return ok(id, `badge Đã ngừng + audit ${audit.id.slice(0, 8)}…; history giữ + download ok; alreadyInactive không audit`);
  });

  // ============ A7: permission ============
  await runStep('A7', 'Permission: WORKER upload 403 + đọc ok; non-member 403 không leak; UI ẩn nút', async (id) => {
    // WORKER member PRA: upload → 403
    const w1 = await apiUpload(`/api/v1/projects/${PRA_ID}/attachments`, workerToken,
      { fileName: 'e2e-worker.jpg', mime: 'image/jpeg', bytes: JPG_BYTES, caption: null, requestKey: uuid() });
    if (w1.status !== 403) return fail(id, `WORKER upload status=${w1.status} (mong 403)`);
    // WORKER: list + download ok
    const w2 = await apiJson('GET', `/api/v1/projects/${PRA_ID}/attachments`, workerToken);
    if (w2.status !== 200 || (w2.body.total || 0) < 3) {
      return fail(id, `WORKER list status=${w2.status} total=${w2.body && w2.body.total}`);
    }
    const w3 = await apiDownload(`/api/v1/projects/${PRA_ID}/attachments/${attJpg.id}/content`, workerToken);
    if (w3.status !== 200 || sha256(w3.bytes) !== sha256(JPG_BYTES)) {
      return fail(id, `WORKER download status=${w3.status}`);
    }
    // WORKER: retire → 403
    const w4 = await apiJson('PATCH', `/api/v1/projects/${PRA_ID}/attachments/${attJpg.id}/retire`, workerToken,
      { reason: 'worker retire' }, { 'X-Correlation-Id': uuid() });
    if (w4.status !== 403) return fail(id, `WORKER retire status=${w4.status} (mong 403)`);
    // non-member PRA: list/upload/download → 403, không leak tên project
    const n1 = await apiJson('GET', `/api/v1/projects/${PRA_ID}/attachments`, outsiderToken);
    if (n1.status !== 403) return fail(id, `non-member list status=${n1.status} (mong 403)`);
    const n1s = JSON.stringify(n1.body || {});
    if (/Sunshine|PRA/i.test(n1s)) return fail(id, `non-member 403 leak tên project: ${n1s.slice(0, 200)}`);
    const n2 = await apiUpload(`/api/v1/projects/${PRA_ID}/attachments`, outsiderToken,
      { fileName: 'e2e-out.jpg', mime: 'image/jpeg', bytes: JPG_BYTES, caption: null, requestKey: uuid() });
    if (n2.status !== 403) return fail(id, `non-member upload status=${n2.status} (mong 403)`);
    const n3 = await apiDownload(`/api/v1/projects/${PRA_ID}/attachments/${attJpg.id}/content`, outsiderToken);
    if (n3.status !== 403) return fail(id, `non-member download status=${n3.status} (mong 403)`);
    const cnt = psqlT(`SELECT count(*) FROM attachments WHERE file_name IN ('e2e-worker.jpg','e2e-out.jpg')`);
    if (cnt !== '0') return fail(id, 'upload 403 đã lọt vào DB');

    // UI: WORKER mở detail → KHÔNG có nút Tải lên, vẫn thấy list
    const wctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const wpage = await wctx.newPage();
    wpage.setDefaultTimeout(30000);
    await loginWeb(wpage, WORKER_EMAIL, WORKER_PASS);
    await wpage.goto(`${WEB}/projects/${PRA_ID}`, { waitUntil: 'networkidle' });
    const wt = await bodyText(wpage);
    if (!wt.includes('Tài liệu đính kèm')) { await wctx.close(); return fail(id, 'WORKER UI không thấy panel attachments'); }
    if ((await wpage.getByRole('button', { name: 'Tải lên', exact: true }).count()) !== 0) {
      await wctx.close(); return fail(id, 'WORKER UI vẫn thấy nút Tải lên (phải ẩn)');
    }
    if (!wt.includes('e2e-ban-ve-t1.pdf')) { await wctx.close(); return fail(id, 'WORKER UI không thấy list file'); }
    await snap(wpage, `${id}-worker`, 'WORKER UI: ẩn nút Tải lên, vẫn thấy list');
    await wctx.close();
    return ok(id, 'WORKER upload/retire 403 + list/download ok; non-member 403 không leak; UI ẩn nút');
  });

  // ============ A8: retry idempotent cùng requestKey ============
  await runStep('A8', 'Retry idempotent: 2 lần cùng requestKey → 1 file', async (id) => {
    const key = uuid();
    const before = await apiJson('GET', `/api/v1/projects/${PRA_ID}/attachments`, pmToken);
    const r1 = await apiUpload(`/api/v1/projects/${PRA_ID}/attachments`, pmToken,
      { fileName: 'e2e-idempotent.pdf', mime: 'application/pdf', bytes: PDF_BYTES, caption: 'retry test', requestKey: key });
    if (r1.status !== 201) return fail(id, `lần 1 status=${r1.status} (mong 201)`);
    const r2 = await apiUpload(`/api/v1/projects/${PRA_ID}/attachments`, pmToken,
      { fileName: 'e2e-idempotent.pdf', mime: 'application/pdf', bytes: PDF_BYTES, caption: 'retry test', requestKey: key });
    if (r2.status !== 200 || r2.body.idempotentReplay !== true) {
      return fail(id, `lần 2 status=${r2.status} body=${JSON.stringify(r2.body).slice(0, 200)} (mong 200+replay)`);
    }
    if (r2.body.id !== r1.body.id) return fail(id, 'replay trả id khác bản gốc');
    const after = await apiJson('GET', `/api/v1/projects/${PRA_ID}/attachments`, pmToken);
    if ((after.body.total || 0) !== (before.body.total || 0) + 1) {
      return fail(id, `total ${before.body.total}→${after.body.total} (mong +1)`);
    }
    const auditN = psqlT(`SELECT count(*) FROM audit_logs WHERE action='PRJ_ATTACHMENT_UPLOADED' AND entity_id='${r1.body.id}'`);
    if (auditN !== '1') return fail(id, `replay ghi audit mới (n=${auditN})`);
    attReplay = r1.body;
    driverAttIds.push(r1.body.id);
    return ok(id, `201 → 200+idempotentReplay cùng id; total +1; audit=1`);
  });

  // ============ L5: WO attach extension ============
  await runStep('L5', 'WO attach: upload + list trên WO; outsider 403', async (id) => {
    const r1 = await apiUpload(`/api/v1/work-orders/${WO_ID}/attachments`, pmToken,
      { fileName: 'e2e-wo Bien-ban.pdf', mime: 'application/pdf', bytes: PDF_BYTES, caption: 'Biên bản WO E2E', requestKey: uuid() });
    if (r1.status !== 201) return fail(id, `WO upload status=${r1.status} body=${JSON.stringify(r1.body).slice(0, 300)}`);
    if (r1.body.ownerType !== 'WORK_ORDER') return fail(id, `ownerType=${r1.body.ownerType} (mong WORK_ORDER)`);
    if (r1.body.workOrderId !== WO_ID) return fail(id, `workOrderId=${r1.body.workOrderId} (mong ${WO_ID})`);
    if (r1.body.projectId !== PRD_ID) return fail(id, `projectId=${r1.body.projectId} (mong PRD resolve từ WO)`);
    const l = await apiJson('GET', `/api/v1/work-orders/${WO_ID}/attachments`, pmToken);
    const hit = ((l.body && l.body.data) || []).find((a) => a.id === r1.body.id);
    if (!hit) return fail(id, `WO list không chứa file vừa tải (total=${l.body.total})`);
    // outsider của PRD (hau.le ∉ PRD): upload + list → 403
    const o1 = await apiUpload(`/api/v1/work-orders/${WO_ID}/attachments`, workerToken,
      { fileName: 'e2e-wo-out.jpg', mime: 'image/jpeg', bytes: JPG_BYTES, caption: null, requestKey: uuid() });
    if (o1.status !== 403) return fail(id, `WO outsider upload status=${o1.status} (mong 403)`);
    const o2 = await apiJson('GET', `/api/v1/work-orders/${WO_ID}/attachments`, workerToken);
    if (o2.status !== 403) return fail(id, `WO outsider list status=${o2.status} (mong 403)`);
    attWo = r1.body;
    driverAttIds.push(r1.body.id);
    return ok(id, `WO upload 201 ownerType=WORK_ORDER + list thấy; outsider 403; id=${r1.body.id.slice(0, 8)}…`);
  });

  // ============ Cleanup + vars ============
  cleanupRun(uploadsBaseline);
  const rest = restCount();
  const auditFinal = psqlT(`SELECT count(*) FROM audit_logs WHERE action IN ('PRJ_ATTACHMENT_UPLOADED','PRJ_ATTACHMENT_RETIRED')`);
  const uploadedN = psqlT(`SELECT count(*) FROM audit_logs WHERE action='PRJ_ATTACHMENT_UPLOADED'`);
  const allOk = results.every((r) => r.ok);
  const vars = {
    _note: 'Throwaway E2E-only demo credentials (seed/reset per evidence docs). Never production.',
    pm: PM_EMAIL,
    worker: WORKER_EMAIL,
    outsider: OUTSIDER_EMAIL,
    admin: ADMIN_EMAIL,
    projectId: PRA_ID,
    workOrderId: WO_ID,
    attIds: driverAttIds,
    attA1Id: attA1 && attA1.id,
    attJpgId: attJpg && attJpg.id,
    attWebpId: attWebp && attWebp.id,
    attReplayId: attReplay && attReplay.id,
    attWoId: attWo && attWo.id,
    pdfSha256: sha256(PDF_BYTES),
    jpgSha256: sha256(JPG_BYTES),
    auditBaseline,
    auditFinal,
    uploadedTotal: uploadedN,
    rest,
    results: results.map((r) => ({ id: r.id, ok: r.ok, note: r.note })),
  };
  fs.writeFileSync(path.join(__dirname, 'e2e-vars.json'), `${JSON.stringify(vars, null, 2)}\n`);
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`cleanup: rest(attachments/files)=${rest}, audit(UPLOADED+RETIRED) ${auditBaseline}→${auditFinal}`);
  console.log(`TỔNG: ${results.filter((r) => r.ok).length}/${results.length} PASS`);
  await browser.close().catch(() => {});
  process.exit(allOk && rest === '0/0' ? 0 : 1);
})().catch((e) => { console.error('DRIVER FATAL', e); process.exit(2); });
