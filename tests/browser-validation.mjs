import { existsSync as _hasChromium } from 'node:fs';
// Local, isolated browser acceptance tests. No real credentials or hardware writes.
// Start the project server, then: node tests/browser-validation.mjs
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const baseURL = process.env.EV_EMS_TEST_URL || 'http://127.0.0.2:5500';
const output = resolve(process.env.EV_EMS_VALIDATION_OUTPUT || 'validation');
await mkdir(output, { recursive: true });
const report = { date: '2026-11-03', browser: 'Microsoft Edge headless', baseURL, checks: [], pageErrors: [], consoleErrors: [], localHttpErrors: [], externalRequestFailures: [], hardwareTested: false, firebaseCredentialsSubmitted: false };
const browser = await chromium.launch(_hasChromium('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] } : { channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1040 }, deviceScaleFactor: 1, reducedMotion: 'reduce', acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(30000);
page.on('pageerror', (error) => report.pageErrors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error' && !/ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(message.text())) report.consoleErrors.push(message.text()); });
page.on('response', (response) => { if (response.url().startsWith(baseURL) && response.status() >= 400) report.localHttpErrors.push({ url: response.url(), status: response.status() }); });
page.on('requestfailed', (request) => { if (!request.url().startsWith(baseURL)) report.externalRequestFailures.push({ url: request.url(), failure: request.failure()?.errorText }); });
const num = async (id) => Number((await page.locator(id).innerText()).replaceAll(',', '').match(/-?[\d.]+/)?.[0]);
const fingerprint = (buffer) => createHash('sha256').update(buffer).digest('hex');
async function screenshot(name) { await page.screenshot({ path: resolve(output, name), fullPage: false }); }
async function check(name, action) {
  const started = Date.now();
  try { const detail = await action(); report.checks.push({ name, passed: true, ms: Date.now() - started, ...(detail ? { detail } : {}) }); console.log('PASS', name); }
  catch (error) { report.checks.push({ name, passed: false, ms: Date.now() - started, error: error.message }); console.error('FAIL', name, error.message); await screenshot('browser-last-failure.png').catch(() => {}); }
}
async function view(name) {
  const desktop = page.locator(`.primary-nav [data-view="${name}"]`);
  if (await desktop.isVisible()) await desktop.click();
  else { await page.locator('#menu-toggle').click(); await page.locator(`#mobile-nav [data-view="${name}"]`).click(); }
  await page.locator(`#view-${name}`).waitFor({ state: 'visible' });
  assert.equal(await page.locator('[data-section]:visible').count(), 1);
}
async function range(id, value) {
  const slider = page.locator(id);
  await slider.focus(); await slider.press(value === 100 ? 'End' : 'Home');
  if (value !== 100) for (let i = 0; i < value; i++) await slider.press('ArrowRight');
  assert.equal(await slider.inputValue(), String(value));
}
async function waitNumber(id, predicate, timeout = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeout) { const n = await num(id); if (predicate(n)) return n; await page.waitForTimeout(150); }
  throw new Error(`Timed out waiting for ${id}; value=${await page.locator(id).innerText()}`);
}
try {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await check('All three primary sections navigate with one active section', async () => {
    for (const name of ['monitor', 'circuit', 'simulator']) await view(name);
    assert.equal(await page.locator('[data-section]').count(), 3);
  });
  await check('3D asset loads into a real WebGL canvas', async () => {
    await page.waitForFunction(() => document.getElementById('vehicle-canvas')?.dataset.ready === 'true', { timeout: 45000 });
    assert.equal(await page.locator('#vehicle-canvas canvas').count(), 1);
    assert.ok(Number(await page.locator('#vehicle-canvas').getAttribute('data-meshes')) > 0);
    assert.equal(await page.locator('#vehicle-fallback').isVisible(), false);
    await screenshot('browser-studio-desktop.png');
  });
  await check('Hardware monitor starts unavailable with empty graphs and no actuator', async () => {
    await view('monitor');
    for (const id of ['voltage', 'current', 'light-current', 'motor-current', 'light-power', 'motor-power', 'total-power', 'energy', 'temperature', 'motor-state']) assert.equal(await page.locator('#metric-' + id).innerText(), 'N/A');
    assert.match(await page.locator('#recent-readings').innerText(), /No telemetry/);
    assert.match(await page.locator('#top-status').innerText(), /unavailable|Waiting/);
    assert.match(await page.locator('#firebase-connection-state').innerText(), /Not connected|Disconnected|Checking/);
    assert.equal(await page.locator('#view-monitor button').filter({ hasText: /motor on|motor off|start motor/i }).count(), 0);
    await screenshot('browser-monitor-desktop.png');
    return { auth: await page.locator('#auth-state').innerText(), database: await page.locator('#firebase-connection-state').innerText() };
  });
  await check('Isolated telemetry fixtures exercise branches, charts, stale state, tariff and clearing', async () => {
    const accepted = await page.evaluate(() => {
      // TEST FIXTURE ONLY in this isolated context. No Firebase or production publisher.
      const fixture = { voltage: 12, current: 2.5, power: 30, energyWh: 250, timestamp: Date.now() - 3000, source: 'esp32', lightVoltageV: 12, lightCurrentA: .5, motorVoltageV: 12, motorCurrentA: 2 };
      for (let i = 0; i < 3; i++) window.ECSBatteryData.ingestReading({ ...fixture, timestamp: fixture.timestamp + i * 1000, voltage: 12 + i * .1 });
      window.ECSBatteryData.setTelemetryStatus('stale', 'TEST FIXTURE — stale historical record, not hardware');
      return window.ECSBatteryData.ingestReading({ ...fixture, source: 'simulation' });
    });
    assert.equal(accepted, false);
    assert.equal(await num('#metric-light-power'), 6); assert.equal(await num('#metric-motor-power'), 24); assert.equal(await num('#metric-total-power'), 30);
    assert.match(await page.locator('#firebase-data-state').innerText(), /TEST FIXTURE/);
    assert.equal(await page.locator('#metric-temperature').innerText(), 'N/A');
    assert.ok((await page.locator('#voltage-chart path[data-series]').getAttribute('d')).length > 5);
    await page.locator('#monitor-tariff').fill('8'); assert.equal(await num('#monitor-cost'), 2);
    await page.evaluate(() => { window.ECSBatteryData.resetTelemetry(); window.ECSBatteryData.setTelemetryStatus('signed-out'); });
    assert.equal(await page.locator('#metric-voltage').innerText(), 'N/A');
    assert.match(await page.locator('#recent-readings').innerText(), /No telemetry/);
  });
  await check('Four auxiliary controls independently change demand and energy', async () => {
    await view('simulator'); await page.locator('#sim-reset').click(); await page.locator('#sim-start').click();
    for (const [id, watts] of [['headlights', 80], ['airConditioning', 750], ['cabinLights', 12], ['infotainment', 35]]) {
      await page.locator('#device-' + id).check();
      await waitNumber('#sim-pack-power', n => n > 0);
      assert.match(await page.locator('#demand-' + id).innerText(), new RegExp(`^${watts} W`));
      for (const other of ['headlights', 'airConditioning', 'cabinLights', 'infotainment'].filter(x => x !== id)) assert.equal(await page.locator('#device-' + other).isChecked(), false);
      const pack = await num('#sim-pack-power'); assert.ok(Math.abs(pack - watts / .88) < .15);
      await page.waitForTimeout(250); await page.locator('#device-' + id).uncheck();
    }
    assert.ok(await num('#sim-net-energy') > 0);
    assert.ok((await page.locator('#sim-power-chart path[data-series]').getAttribute('d')).length > 5);
    await page.locator('#sim-stop').click();
  });
  await check('Traction throttle, braking, pause and reset stay synchronized', async () => {
    await page.locator('#sim-reset').click(); await page.locator('#device-tractionMotor').check(); await page.locator('#sim-start').click();
    await range('#throttle-control', 100); await waitNumber('#sim-speed', n => n > 8);
    assert.ok(await num('#sim-pack-power') > 0); assert.ok(await num('#sim-acceleration') > 0);
    await range('#brake-control', 100);
    assert.equal(await page.locator('#throttle-control').inputValue(), '0');
    await waitNumber('#sim-regen', n => n > 0);
    assert.ok(await num('#sim-pack-power') < 0);
    await page.locator('#sim-stop').click();
    const energy = await num('#sim-net-energy'), speed = await num('#sim-speed');
    await page.waitForTimeout(400);
    assert.equal(await num('#sim-net-energy'), energy); assert.equal(await num('#sim-speed'), speed); assert.equal(await num('#sim-pack-power'), 0);
    await page.locator('#sim-reset').click();
    assert.equal(await num('#sim-speed'), 0); assert.equal(await num('#sim-net-energy'), 0); assert.equal(await num('#sim-soc'), 72);
    assert.equal(await page.locator('#brake-control').inputValue(), '0');
    for (const id of ['tractionMotor', 'headlights', 'airConditioning', 'cabinLights', 'infotainment']) assert.equal(await page.locator('#device-' + id).isChecked(), false);
  });
  await check('Tariff and exported CSV use real simulated run samples', async () => {
    await page.locator('#sim-tariff').fill('800'); await page.locator('#device-airConditioning').check(); await page.locator('#sim-start').click();
    await waitNumber('#sim-cost', n => n > .1); await page.locator('#sim-stop').click();
    assert.ok(Math.abs(await num('#sim-cost') - await num('#sim-net-energy') / 1000 * 800) < .007);
    const downloadPromise = page.waitForEvent('download', { timeout: 2500 }).catch(() => null);
    await page.locator('#sim-export').click();
    const download = await downloadPromise;
    const exported = await page.evaluate(() => window.lastExportedRunCsv);
    assert.equal(download ? download.suggestedFilename() : exported?.filename, 'EV_EMS_simulated_run.csv');
    const csv = download ? await readFile(await download.path(), 'utf8') : exported.content;
    assert.match(csv, /source,simulated_seconds,speed_kmh/); assert.match(csv, /SOFTWARE_SIMULATION/); assert.match(csv, /Scenario metadata/); assert.match(csv, /"tariffInrPerKwh":800/);
    assert.ok(csv.split('\n').filter(line => line.startsWith('SOFTWARE_SIMULATION,')).length >= 1);
    await page.locator('#sim-reset').click(); await page.locator('#sim-export').click();
    assert.match(await page.locator('.toast').innerText(), /Start the simulation/);
  });
  await check('Editable assumptions apply, update displayed pack and reset the scenario', async () => {
    await page.locator('.assumptions-panel summary').click();
    assert.deepEqual(await page.locator('[data-assumption]').evaluateAll(inputs => inputs.filter(input => !input.checkValidity()).map(input => ({ name: input.dataset.assumption, value: input.value }))), []);
    await page.locator('[data-assumption="nominalVoltageV"]').fill('120');
    await page.locator('[data-assumption="massKg"]').fill('800'); await page.locator('#apply-assumptions').click();
    assert.match(await page.locator('.toast').innerText(), /applied/);
    await page.locator('#studio-component').selectOption('overview');
    await page.waitForFunction(() => document.getElementById('component-reading').textContent.includes('120 V'));
    assert.equal(await num('#sim-speed'), 0); assert.equal(await page.locator('#sim-start').isEnabled(), true);
    await page.locator('[data-assumption="roadGradePercent"]').fill('-6');
    await page.locator('[data-assumption="rotationalInertiaKgM2"]').fill('1.8');
    await page.locator('[data-assumption="nominalVoltageV"]').fill('96'); await page.locator('[data-assumption="massKg"]').fill('720'); await page.locator('#apply-assumptions').click();
    assert.match(await page.locator('#sim-grade-force').innerText(), /-6\.0%/);
    await page.locator('[data-assumption="roadGradePercent"]').fill('0');
    await page.locator('[data-assumption="rotationalInertiaKgM2"]').fill('0');
    await page.locator('#apply-assumptions').click();
    await page.locator('.assumptions-panel summary').click();
    await page.locator('#sim-scenario-preset').selectOption('downhill');
    await waitNumber('#sim-speed', n => n > 0.3);
    assert.match(await page.locator('#sim-grade-force').innerText(), /-6\.0%/);
    assert.notEqual(await page.locator('#sim-angular-velocity').innerText(), '0.0 / 0.0 rad/s');
    await page.locator('#sim-reset').click();
    assert.equal(await page.locator('#sim-scenario-preset').inputValue(), 'manual');
  });
  await check('Camera presets change the rendered vehicle; orbit and zoom are functional', async () => {
    await page.locator('#studio-quality').selectOption('low'); await page.locator('#vehicle-canvas').scrollIntoViewIfNeeded();
    let previous = fingerprint(await page.locator('#vehicle-canvas').screenshot());
    for (const preset of ['front', 'side', 'rear', 'top', 'interior', 'hero']) {
      await page.locator(`button[data-camera="${preset}"]`).click();
      assert.equal(await page.locator('#vehicle-canvas').getAttribute('data-camera'), preset);
      await page.waitForTimeout(100);
      const current = fingerprint(await page.locator('#vehicle-canvas').screenshot()); assert.notEqual(current, previous, `Rendered camera ${preset} changes`); previous = current;
    }
    const bounds = await page.locator('#vehicle-canvas').boundingBox();
    await page.mouse.move(bounds.x + bounds.width * .5, bounds.y + bounds.height * .5); await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width * .65, bounds.y + bounds.height * .58, { steps: 12 }); await page.mouse.up(); await page.waitForTimeout(200);
    assert.notEqual(fingerprint(await page.locator('#vehicle-canvas').screenshot()), previous);
    previous = fingerprint(await page.locator('#vehicle-canvas').screenshot());
    await page.locator('#studio-zoom-in').click(); await page.waitForTimeout(100); assert.notEqual(fingerprint(await page.locator('#vehicle-canvas').screenshot()), previous);
    await page.locator('#studio-zoom-out').click(); await page.locator('#studio-orbit').click(); assert.equal(await page.locator('#studio-orbit').getAttribute('aria-pressed'), 'true'); await page.locator('#studio-orbit').click();
  });
  await check('Layers, component selection, paint and rendering quality respond', async () => {
    const layers = await page.locator('button[data-layer]').evaluateAll(buttons => buttons.map(button => button.dataset.layer));
    for (const layer of layers) { await page.locator(`button[data-layer="${layer}"]`).click(); assert.equal(await page.locator('#vehicle-canvas').getAttribute('data-layer'), layer); }
    await page.locator('button[data-layer="exterior"]').click();
    await page.locator('#studio-component').selectOption('battery'); assert.equal(await page.locator('#component-title-studio').innerText(), 'Traction battery'); assert.equal(await page.locator('#vehicle-canvas').getAttribute('data-layer'), 'cutaway');
    await screenshot('browser-studio-cutaway.png');
    for (const id of ['motor', 'inverter', 'dcdc', 'charger', 'cooling', 'headlights', 'cabinLights', 'airConditioning', 'infotainment']) { await page.locator('#studio-component').selectOption(id); assert.ok((await page.locator('#component-description').innerText()).length > 60); }
    await page.getByRole('button', { name: 'Copper paint', exact: true }).click(); assert.equal(await page.locator('#paint-name').innerText(), 'Copper');
    await page.locator('#studio-quality').selectOption('low'); assert.equal(await page.locator('#vehicle-canvas').getAttribute('data-quality'), 'efficient');
    await page.locator('#studio-quality').selectOption('high'); assert.equal(await page.locator('#vehicle-canvas').getAttribute('data-quality'), 'high');
    await page.locator('#studio-quality').selectOption('low');
    await page.locator('#studio-environment').selectOption('night'); assert.equal(await page.locator('#studio-environment').inputValue(), 'night');
    await page.locator('#studio-environment').selectOption('studio'); await page.getByRole('button', { name: 'Glacier silver paint', exact: true }).click(); await page.locator('button[data-layer="exterior"]').click(); await page.locator('button[data-camera="hero"]').click();
  });
  await check('Auxiliary switches change actual lighting, display and airflow renders', async () => {
    await page.locator('#sim-reset').click(); await page.locator('#sim-start').click();
    await page.locator('#studio-environment').selectOption('night');
    for (const [device, camera] of [['headlights', 'front'], ['cabinLights', 'interior'], ['infotainment', 'interior'], ['airConditioning', 'interior']]) {
      await page.locator(`button[data-camera="${camera}"]`).click(); await page.waitForTimeout(150);
      const before = fingerprint(await page.locator('#vehicle-canvas').screenshot());
      await page.locator('#device-' + device).check(); await page.waitForTimeout(200);
      assert.notEqual(fingerprint(await page.locator('#vehicle-canvas').screenshot()), before, `${device} changes visible rendered output`);
      await page.locator('#device-' + device).uncheck();
    }
    await page.locator('#sim-reset').click(); await page.locator('#studio-environment').selectOption('studio'); await page.locator('button[data-camera="hero"]').click();
  });
  await check('Engineering components, source registers, calculations and schematic work in the app', async () => {
    await view('circuit'); await page.waitForFunction(() => document.querySelector('.lab-data-status')?.textContent.includes('60 connections'));
    await page.locator('[data-lab-tab="architecture"]').click();
    await page.locator('[data-lab-component="S_M"]').click(); assert.match(await page.locator('.lab-inspector').innerText(), /27 kΩ \/ 20 kΩ/);
    await page.locator('[data-lab-trace]').click(); assert.ok(await page.locator('.lab-table tbody tr').count() > 0);
    await page.locator('#lab-register-search').fill('W053'); assert.equal(await page.locator('.lab-table tbody tr').count(), 1);
    await page.locator('#lab-register-clear').click(); assert.equal(await page.locator('.lab-table tbody tr').count(), 60);
    await page.locator('#lab-register-kind').selectOption('bom'); assert.equal(await page.locator('.lab-table tbody tr').count(), 42);
    await page.locator('[data-lab-tab="calculations"]').click(); assert.match(await page.locator('#lab-divider-result').innerText(), /2.3077/);
    await page.locator('#lab-divider-voltage').fill('24'); assert.match(await page.locator('#lab-divider-result').innerText(), /Outside the cited/); await page.locator('#lab-divider-voltage').fill('18');
    await page.locator('#lab-calculation-kind').selectOption('current'); assert.match(await page.locator('#lab-current-result').innerText(), /14.04/);
    await page.locator('#lab-calculation-kind').selectOption('energy'); assert.match(await page.locator('#lab-energy-result').innerText(), /₹0.192/);
    await page.locator('[data-lab-tab="schematic"]').click();
    await page.locator('.conventional-schematic').waitFor();
    assert.equal(await page.locator('[data-schematic-component]').count(),33);
    await page.locator('[data-lab-primary-zoom="in"]').click();
    assert.equal(await page.locator('#lab-primary-zoom-level').innerText(),'150%');
    await page.locator('[data-lab-primary-zoom="reset"]').click();
    await page.locator('.lab-original-schematic summary').click();
    await page.waitForFunction(() => document.getElementById('lab-schematic-image').naturalWidth > 0);
    await page.locator('[data-lab-zoom="in"]').click(); assert.equal(await page.locator('#lab-zoom-level').innerText(), '150%'); await page.locator('[data-lab-zoom="reset"]').click();
    await page.locator('[data-lab-tab="architecture"]').click(); await screenshot('browser-engineering-desktop.png');
  });
  await check('Every local document and asset hyperlink resolves', async () => {
    const links = await page.locator('a[href]').evaluateAll((anchors, base) => [...new Set(anchors.map(a => a.href).filter(href => href.startsWith(base) && !href.slice(base.length).startsWith('/#')))], baseURL);
    for (const url of links) { const response = await context.request.get(url); assert.ok(response.ok(), `${url} returned ${response.status()}`); }
    return { checkedLinks: links.length };
  });
  await check('320, 390, 768 and 1440 pixel layouts and mobile navigation have no page overflow', async () => {
    const dimensions = [];
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 980 });
      for (const name of ['monitor', 'circuit', 'simulator']) {
        await view(name); await page.waitForTimeout(100);
        const size = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
        assert.ok(size.scrollWidth <= size.width + 1, `${width}px ${name}: scroll width ${size.scrollWidth}`); dimensions.push({ width, name, ...size });
        if (width === 390 && name === 'simulator') await screenshot('browser-studio-mobile.png');
      }
    }
    return dimensions;
  });
  await check('Healthy browser run has no script errors or missing local assets', async () => {
    assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.localHttpErrors, []); assert.deepEqual(report.consoleErrors, []);
  });
} finally { await context.close(); }

await check('Aborted GLB load shows poster, useful component descriptions, working controls and retry', async () => {
  const isolated = await browser.newContext({ viewport: { width: 1280, height: 950 }, reducedMotion: 'reduce' });
  const fallbackPage = await isolated.newPage(); fallbackPage.setDefaultTimeout(20000);
  const errors = []; fallbackPage.on('pageerror', e => errors.push(e.message));
  const blocked = '**/assets/vehicle/ev-ems-gt*.glb*'; await fallbackPage.route(blocked, route => route.abort('failed'));
  try {
    await fallbackPage.goto(baseURL, { waitUntil: 'domcontentloaded' }); await fallbackPage.locator('#vehicle-fallback').waitFor({ state: 'visible' });
    assert.equal(await fallbackPage.locator('#vehicle-canvas').getAttribute('data-ready'), 'fallback');
    assert.ok(await fallbackPage.locator('#vehicle-fallback img').evaluate(img => img.complete && img.naturalWidth > 0));
    await fallbackPage.locator('#studio-component').selectOption('battery'); assert.equal(await fallbackPage.locator('#component-title-studio').innerText(), 'Traction battery');
    await fallbackPage.locator('#device-headlights').check(); await fallbackPage.locator('#sim-start').click();
    await fallbackPage.waitForFunction(() => Number(document.getElementById('sim-pack-power').textContent.replaceAll(',', '')) > 0);
    await fallbackPage.locator('#sim-stop').click(); await fallbackPage.locator('.vehicle-stage').screenshot({ path: resolve(output, 'browser-fallback.png') });
    await fallbackPage.unroute(blocked); await fallbackPage.locator('#studio-retry').click();
    await fallbackPage.waitForFunction(() => document.getElementById('vehicle-canvas').dataset.ready === 'true', { timeout: 45000 });
    assert.equal(await fallbackPage.locator('#vehicle-canvas canvas').count(), 1); assert.deepEqual(errors, []);
  } finally { await isolated.close(); }
});

await check('Disabled WebGL still leaves a usable software simulator', async () => {
  const disabled = await chromium.launch(_hasChromium('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-webgl', '--disable-webgl2'] } : { channel: 'msedge', headless: true, args: ['--disable-webgl', '--disable-webgl2'] });
  const isolated = await disabled.newContext({ viewport: { width: 390, height: 900 } }); const noGL = await isolated.newPage();
  try {
    await noGL.goto(baseURL, { waitUntil: 'domcontentloaded' }); await noGL.locator('#vehicle-fallback').waitFor({ state: 'visible', timeout: 30000 });
    assert.equal(await noGL.locator('#vehicle-canvas').getAttribute('data-ready'), 'fallback');
    await noGL.locator('#device-tractionMotor').check(); await noGL.locator('#sim-start').click(); await noGL.locator('#throttle-control').focus(); await noGL.locator('#throttle-control').press('End');
    await noGL.waitForFunction(() => Number(document.getElementById('sim-speed').textContent) > 1);
    await noGL.locator('#sim-stop').click();
    assert.ok(await noGL.locator('#vehicle-fallback img').evaluate(img => img.naturalWidth > 0));
  } finally { await isolated.close(); await disabled.close(); }
});
await check('External services unavailable preserves local 3D and reports Firebase unavailable', async () => {
  const isolated = await browser.newContext({ viewport: { width: 1000, height: 800 }, reducedMotion: 'reduce' });
  await isolated.route('**/*', route => route.request().url().startsWith(baseURL) ? route.continue() : route.abort('internetdisconnected'));
  const offline = await isolated.newPage(); const errors = []; offline.on('pageerror', e => errors.push(e.message));
  try {
    await offline.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await offline.waitForFunction(() => document.getElementById('vehicle-canvas')?.dataset.ready === 'true');
    await offline.locator('.primary-nav [data-view="monitor"]').click();
    await offline.waitForFunction(() => document.getElementById('auth-state')?.textContent.includes('unavailable'));
    assert.equal(await offline.locator('#metric-voltage').innerText(), 'N/A'); assert.match(await offline.locator('#firebase-data-state').innerText(), /error|unavailable/i);
    assert.deepEqual(errors, []);
  } finally { await isolated.close(); }
});
await browser.close();
report.passed = report.checks.filter(c => c.passed).length; report.failed = report.checks.filter(c => !c.passed).length;
await writeFile(resolve(output, 'browser-validation.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`Browser acceptance: ${report.passed} passed, ${report.failed} failed.`);
if (report.failed) process.exitCode = 1;
