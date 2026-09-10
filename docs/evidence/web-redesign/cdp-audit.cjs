/**
 * F015 — Web redesign evidence: screenshots 3 viewport + CDP audit.
 * Chay: node docs/evidence/web-redesign/cdp-audit.cjs [baseUrl]
 *   baseUrl mac dinh http://localhost:3100 (build moi tu working tree).
 * Yeu cau: API http://localhost:3000 + Postgres seeded chay.
 * Output: docs/evidence/web-redesign/after/_projects_*.png + cdp-audit.md
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('/home/trung/.npm-global/lib/node_modules/@playwright/mcp/node_modules/playwright-core');

const WEB = process.argv[2] || 'http://localhost:3100';
const API = 'http://localhost:3000';
const ADMIN_EMAIL = 'hoang.anh@vinacons.vn';
const ADMIN_PASS = 'E2EAdmin@2025';
const HERE = __dirname;
const AFTER = path.join(HERE, 'after');

async function api(method, urlPath, token, body) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${urlPath}`, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, body: json };
}

(async () => {
  if (!fs.existsSync(AFTER)) fs.mkdirSync(AFTER, { recursive: true });
  const out = { steps: [], metrics: {}, errors: [] };
  const step = (id, ok, note) => {
    out.steps.push({ id, ok, note });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${note ? ' :: ' + String(note).slice(0, 220) : ''}`);
  };

  const login = await api('POST', '/api/v1/auth/login', null, { email: ADMIN_EMAIL, password: ADMIN_PASS });
  if (!login.body || !login.body.accessToken) {
    console.log('FAIL login :: ' + JSON.stringify(login.body).slice(0, 200));
    process.exit(1);
  }
  const token = login.body.accessToken;
  const list = await api('GET', '/api/v1/projects?limit=100&offset=0', token);
  const projects = Array.isArray(list.body) ? list.body : [];
  const firstId = projects.length ? projects[0].id : null;
  step('auth', true, `login ok, projects=${projects.length}`);

  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    const ctx = await browser.newContext();
    // Seed session nhu web client (buildflow.auth.v1) de qua AppShell guard.
    await ctx.addInitScript((auth) => {
      window.localStorage.setItem('buildflow.auth.v1', JSON.stringify(auth));
    }, login.body);
    const page = await ctx.newPage();

    async function loginUi() {
      await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    }
    await loginUi();

    // ---- 1. /projects @1440x900 (primary) ----
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${WEB}/projects`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.bf-table tbody tr', { timeout: 25000 });
    const fb1 = await page.getAttribute('.bf-shell', 'data-fullbleed');
    step('fullbleed-/projects', fb1 === 'true', `data-fullbleed=${fb1}`);

    // F008: do chi so hang TRUOC khi mo inspector (base density, khong wrap).
    const cdp = await ctx.newCDPSession(page);
    try { await cdp.send('DOM.enable'); await cdp.send('CSS.enable'); } catch {}
    const rowHeights = await page.$$eval('.bf-table tbody tr', (rows) =>
      rows.map((r) => Math.round(r.getBoundingClientRect().height)),
    );
    const sorted = [...rowHeights].sort((a, b) => a - b);
    const rowStats = rowHeights.length
      ? { n: rowHeights.length, min: sorted[0], p50: sorted[Math.floor(sorted.length / 2)], max: sorted[sorted.length - 1] }
      : { n: 0 };
    out.metrics.rowHeights1440 = rowStats;
    const inRange = rowHeights.length > 0 && sorted[0] >= 44 && sorted[sorted.length - 1] <= 48;
    step('row-44-48', inRange, JSON.stringify(rowStats));
    // Computed padding via CDP CSS.getComputedStyleForNode.
    let padNote = '';
    try {
      const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.bf-table tbody td' });
      const { computedStyle } = await cdp.send('CSS.getComputedStyleForNode', { nodeId });
      const pick = (n) => (computedStyle.find((p) => p.name === n) || {}).value;
      padNote = `padding=${pick('padding-top')} ${pick('padding-right')} ${pick('padding-bottom')} ${pick('padding-left')}`;
      out.metrics.tdPadding = padNote;
    } catch (e) { padNote = 'cdp-css-warn ' + String(e.message || e).slice(0, 120); }
    step('cdp-td-padding', /6px/.test(padNote), padNote);
    // Sau do: chon row dau tien -> inspector hien (khong reload).
    await page.locator('.bf-table tbody tr').first().click();
    await page.waitForSelector('[data-testid="project-inspector"]', { timeout: 15000 });
    const inspVisible = await page.locator('[data-testid="project-inspector"]').isVisible();
    step('inspector-select', inspVisible, 'click row -> inspector, khong reload');
    // Ghi nhan phu: khi inspector mo, bang hep lai, ten dai wrap -> hang cao hon (expected).
    const wrappedHeights = await page.$$eval('.bf-table tbody tr', (rows) =>
      rows.map((r) => Math.round(r.getBoundingClientRect().height)),
    );
    out.metrics.rowHeights1440InspectorOpen = {
      n: wrappedHeights.length, min: Math.min(...wrappedHeights), max: Math.max(...wrappedHeights),
    };
    const inspDisplay = await page.$eval('[data-testid="project-inspector"]', (el) => getComputedStyle(el).display);
    out.metrics.inspectorDisplay1440 = inspDisplay;
    step('inspector-visible-1440', inspDisplay !== 'none', `display=${inspDisplay}`);
    await page.screenshot({ path: path.join(AFTER, '_projects_1440x900.png') });
    step('shot-1440', true, 'after/_projects_1440x900.png');

    // ---- 2. F007: /projects/:id + /projects/new giu layout cu ----
    if (firstId) {
      await page.goto(`${WEB}/projects/${firstId}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      const fbD = await page.getAttribute('.bf-shell', 'data-fullbleed');
      const scrollD = await page.evaluate(() => {
        const sc = document.scrollingElement;
        const max = sc ? sc.scrollHeight - sc.clientHeight : 0;
        if (sc && max > 0) sc.scrollTop = max;
        return { scrollHeight: sc ? sc.scrollHeight : 0, clientHeight: sc ? sc.clientHeight : 0, scrolled: sc ? sc.scrollTop : 0 };
      });
      const okD = fbD === 'false' && scrollD.scrollHeight >= scrollD.clientHeight;
      step('detail-old-layout', okD, `fullbleed=${fbD} scroll=${JSON.stringify(scrollD)}`);
      await page.screenshot({ path: path.join(AFTER, '_projects-detail_1440x900.png') });
    } else {
      step('detail-old-layout', false, 'khong co project de mo detail');
    }
    await page.goto(`${WEB}/projects/new`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const fbN = await page.getAttribute('.bf-shell', 'data-fullbleed');
    const hasForm = (await page.locator('form').count()) > 0;
    const scrollN = await page.evaluate(() => {
      const sc = document.scrollingElement;
      const max = sc ? sc.scrollHeight - sc.clientHeight : 0;
      if (sc && max > 0) sc.scrollTop = max;
      return { scrollHeight: sc ? sc.scrollHeight : 0, clientHeight: sc ? sc.clientHeight : 0, scrolled: sc ? sc.scrollTop : 0 };
    });
    step('new-old-layout', fbN === 'false' && hasForm, `fullbleed=${fbN} form=${hasForm} scroll=${JSON.stringify(scrollN)}`);
    await page.screenshot({ path: path.join(AFTER, '_projects-new_1440x900.png') });

    // ---- 3. /projects @1279x900 (inspector an) ----
    await page.setViewportSize({ width: 1279, height: 900 });
    await page.goto(`${WEB}/projects`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.bf-table tbody tr', { timeout: 25000 });
    await page.locator('.bf-table tbody tr').first().click();
    await page.waitForTimeout(1200);
    const inspCount = await page.locator('[data-testid="project-inspector"]').count();
    let inspHidden = inspCount === 0;
    let disp1279 = 'not-rendered';
    if (inspCount > 0) {
      disp1279 = await page.$eval('[data-testid="project-inspector"]', (el) => getComputedStyle(el).display);
      inspHidden = disp1279 === 'none' || !(await page.locator('[data-testid="project-inspector"]').isVisible());
    }
    out.metrics.inspectorDisplay1279 = disp1279;
    step('inspector-hidden-1279', inspHidden, `display=${disp1279}`);
    await page.screenshot({ path: path.join(AFTER, '_projects_1279x900.png') });
    step('shot-1279', true, 'after/_projects_1279x900.png');

    // ---- 4. /projects @900x900 (drawer mode) ----
    await page.setViewportSize({ width: 900, height: 900 });
    await page.goto(`${WEB}/projects`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.bf-table tbody tr', { timeout: 25000 });
    const ml900 = await page.$eval('.bf-main', (el) => getComputedStyle(el).marginLeft);
    out.metrics.mainMarginLeft900 = ml900;
    step('drawer-900-margin', ml900 === '0px', `margin-left=${ml900}`);
    await page.screenshot({ path: path.join(AFTER, '_projects_900x900.png') });
    step('shot-900', true, 'after/_projects_900x900.png');
  } finally {
    await browser.close();
  }

  const allPass = out.steps.every((s) => s.ok);
  const md = [
    '# CDP audit — web redesign (F015/F008/F007)',
    '',
    `Ngay: ${new Date().toISOString()} | WEB=${WEB} | API=${API} | admin=${ADMIN_EMAIL}`,
    '',
    '## Cach do',
    '- Playwright (Chromium, CDP) + `DOM.querySelector` / `CSS.getComputedStyleForNode`:',
    '  padding o `td`, `getBoundingClientRect().height` moi hang `tbody tr`;',
    '  `data-fullbleed` doc tu `.bf-shell`; inspector `display` tu computed style;',
    '  scroll route detail/new: so `scrollHeight` vs `clientHeight` + `scrollTop` sau khi keo xuong day.',
    '- Login that qua `/api/v1/auth/login`, seed `buildflow.auth.v1` vao localStorage (giong web client).',
    '',
    '## Ket qua so lieu',
    '',
    '```json',
    JSON.stringify(out.metrics, null, 2),
    '```',
    '',
    '## Steps',
    '',
    ...out.steps.map((s) => `- [${s.ok ? 'x' : ' '}] ${s.id}${s.note ? ` — ${s.note}` : ''}`),
    '',
    `Ket luan: ${allPass ? 'ALL-PASS' : 'CO FAIL (xem steps)'}`,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(HERE, 'cdp-audit.md'), md);
  console.log(allPass ? 'AUDIT ALL-PASS' : 'AUDIT HAS FAILURES');
  process.exit(allPass ? 0 : 1);
})().catch((e) => {
  console.error('AUDIT ERROR', e);
  process.exit(2);
});
