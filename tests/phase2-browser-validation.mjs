import { existsSync as _hasChromium } from 'node:fs';
// Independent phase 2 acceptance against the actual app and authoritative CSV.
// Start the local server, then: node tests/phase2-browser-validation.mjs
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const baseURL = process.env.EV_EMS_TEST_URL || 'http://127.0.0.2:5500';
const output = resolve('validation');
await mkdir(output, { recursive: true });
const report = { date: '2026-11-03', browser: 'Microsoft Edge headless', baseURL, checks: [], pageErrors: [], consoleErrors: [], localHttpErrors: [], hardwareTested: false, firebaseCredentialsSubmitted: false, changedAuthoritativeFiles: false };
// Python stdlib CSV is deliberately independent of the app's CSV parser/model.
const source = JSON.parse(execFileSync(process.platform === 'win32' ? 'py' : 'python3', ['-c', 'import csv,json,sys; print(json.dumps(list(csv.DictReader(open(sys.argv[1],encoding="utf-8-sig",newline="")))))', resolve('FINAL_EV_EMS_ENGINEERING_PACKAGE/03_Circuit_Design/wiring_connections.csv')], { encoding: 'utf8' }));
const browser = await chromium.launch(_hasChromium('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] } : { channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1040 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
const page = await context.newPage();
page.setDefaultTimeout(30000);
page.on('pageerror', e => report.pageErrors.push(e.message));
page.on('console', e => { if (e.type() === 'error' && !/ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(e.text())) report.consoleErrors.push(e.text()); });
page.on('response', r => { if (r.url().startsWith(baseURL) && r.status() >= 400) report.localHttpErrors.push({ url: r.url(), status: r.status() }); });
const diag = () => page.evaluate(() => window.EVStudioDiagnostics());
const hash = b => createHash('sha256').update(b).digest('hex');
const close = (actual, expected, label = '', epsilon = 1e-8) => assert.ok(Math.abs(actual - expected) < epsilon, `${label}: ${actual} vs ${expected}`);
const arrayClose = (actual, expected, label) => actual.forEach((value, i) => close(value, expected[i], `${label}[${i}]`));
async function shot(name, locator = page.locator('#vehicle-canvas')) { return locator.screenshot({ path: resolve(output, `phase2-${name}.png`) }); }
async function check(name, action) {
  const start = Date.now();
  try { const detail = await action(); report.checks.push({ name, passed: true, ms: Date.now() - start, detail }); console.log('PASS', name); }
  catch (error) { report.checks.push({ name, passed: false, ms: Date.now() - start, error: error.stack }); console.error('FAIL', name, error.message); await page.screenshot({ path: resolve(output, `phase2-failure-${report.checks.length}.png`), fullPage: false }).catch(() => {}); }
}
async function view(name) {
  const nav = page.locator(`.primary-nav [data-view="${name}"]`);
  if (await nav.isVisible()) await nav.click();
  else { await page.locator('#menu-toggle').click(); await page.locator(`#mobile-nav [data-view="${name}"]`).click(); }
  await page.locator(`#view-${name}`).waitFor({ state: 'visible' });
}
async function pause() {
  if ((await diag()).state.running) await page.locator('#sim-stop').click();
  await page.waitForFunction(() => { const d = window.EVStudioDiagnostics(); return !d.state.running && !d.displays.readings.running && d.displays.readings.speedKmh === d.state.speedKmh && d.displays.readings.powerW === d.state.powerW; }, null, { timeout: 10000 });
}
async function coordinates(values) { for (const [i, axis] of ['x', 'y', 'z'].entries()) await page.locator('#assembly-' + axis).fill(String(values[i])); await page.locator('#assembly-apply').click(); }
function displayMatchesSnapshot(d) {
  for (const key of ['running', 'speedKmh', 'socPercent', 'powerW', 'voltageV', 'currentA']) assert.equal(d.displays.readings[key], d.state[key], key);
  assert.equal(d.displays.readings.netEnergyWh, d.state.netBatteryEnergyWh ?? d.state.netEnergyWh);
  for (const rendered of d.displays.readings.devices) {
    const expected = d.state.devices.find(device => device.id === rendered.id);
    for (const key of ['enabled', 'demandW', 'batteryInputW', 'energyWh']) assert.equal(rendered[key], expected[key], rendered.id + '.' + key);
    assert.equal(rendered.status, !expected.enabled ? 'OFF' : !d.state.running ? 'PAUSED' : expected.demandW > 0 ? 'ON' : 'NO POWER');
  }
}
try {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.EVStudioDiagnostics?.().displays.readings, null, { timeout: 45000 });
  await page.locator('#studio-quality').selectOption('low');
  await check('Phase 2 model exposes 48 independent assemblies and two mapped live screens', async () => {
    const d = await diag();
    assert.equal(Object.keys(d.assembly.parts).length, 48);
    assert.equal(await page.locator('#assembly-component option').count(), 49);
    for (const name of ['Seat_FL', 'Seat_FR', 'Seat_RL', 'Seat_RR', 'Door_L', 'Door_R', 'Bonnet', 'Dashboard', 'SteeringWheel', 'CenterConsole', 'InstrumentCluster', 'Battery', 'Motor', 'Inverter', 'DCDC', 'Charger']) assert.ok(d.assembly.parts[name], name);
    assert.deepEqual(d.displays.screens.map(s => s.mesh).sort(), ['Screen_Cluster', 'Screen_Infotainment']);
    assert.ok(d.displays.screens.every(s => s.width >= 1024 && s.height >= 400 && s.textureVersion > 0));
    displayMatchesSnapshot(d);
    return { parts: Object.keys(d.assembly.parts), screens: d.displays.screens };
  });
  await check('Actual pointer drag moves the selected 3D gizmo without moving another component', async () => {
    await page.locator('#sim-reset').click();
    await page.locator('#assembly-component').selectOption('Battery');
    await page.locator('#assembly-mode [data-mode="translate"]').click();
    await page.locator('#assembly-focus').click();
    await page.locator('#vehicle-canvas').scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    const before = await diag(); await shot('gizmo-before');
    const b = await page.locator('#vehicle-canvas').boundingBox();
    // Axis stem observed in phase2-gizmo-before.png at this fixed viewport/focus.
    const from = { x: b.x + b.width * .544, y: b.y + b.height * .643 };
    await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(from.x + 80, from.y - 39, { steps: 20 }); await page.mouse.up();
    await page.waitForTimeout(150); const after = await diag(); await shot('gizmo-after');
    assert.notDeepEqual(after.assembly.parts.Battery.offset, before.assembly.parts.Battery.offset, 'pointer drag changed Battery offset');
    for (const name of Object.keys(before.assembly.parts).filter(n => n !== 'Battery')) assert.deepEqual(after.assembly.parts[name].position, before.assembly.parts[name].position, name);
    assert.deepEqual(after.state, before.state);
    const result = { before: before.assembly.parts.Battery.offset, after: after.assembly.parts.Battery.offset };
    await page.locator('#assembly-reset-selected').click(); return result;
  });
  await check('Every component independently translates, rotates, hides and resets with a stable energy model', async () => {
    await pause(); await page.locator('#assembly-reset-all').click();
    const names = Object.keys((await diag()).assembly.parts), results = [];
    for (const name of names) {
      await page.locator('#assembly-component').selectOption(name);
      await page.locator('#assembly-mode [data-mode="translate"]').click();
      const baseline = await diag();
      await coordinates([.25, .15, -.1]);
      let d = await diag(); arrayClose(d.assembly.parts[name].offset, [.25, .15, -.1], name);
      for (const other of names.filter(n => n !== name)) assert.deepEqual(d.assembly.parts[other].position, baseline.assembly.parts[other].position, `${name} translation leaves ${other}`);
      await page.locator('#assembly-mode [data-mode="rotate"]').click(); await coordinates([25, -10, 15]);
      d = await diag(); arrayClose(d.assembly.parts[name].rotation, [25, -10, 15].map(v => v * Math.PI / 180), name);
      for (const other of names.filter(n => n !== name)) arrayClose(d.assembly.parts[other].rotation, baseline.assembly.parts[other].rotation, `${name} rotation leaves ${other}`);
      assert.deepEqual(d.state, baseline.state, name + ' leaves energy model');
      await page.locator('#assembly-hide').click(); d = await diag(); assert.equal(d.assembly.parts[name].hidden, true); assert.equal(d.assembly.parts[name].visible, false);
      await page.locator('#assembly-hide').click(); assert.equal((await diag()).assembly.parts[name].hidden, false);
      await page.locator('#assembly-reset-selected').click(); d = await diag();
      arrayClose(d.assembly.parts[name].position, baseline.assembly.parts[name].position, name + ' restored');
      arrayClose(d.assembly.parts[name].rotation, [0, 0, 0], name + ' restored rotation');
      results.push(name);
    }
    await page.locator('#assembly-reset-all').click(); return { validatedComponents: results.length, names: results };
  });
  await check('Exploded view preserves manual edits and complete restore removes offsets and hidden state', async () => {
    await page.locator('#assembly-component').selectOption('Battery'); await page.locator('#assembly-mode [data-mode="translate"]').click(); await coordinates([.35, .1, .2]);
    const manual = await diag(); await page.locator('[data-layer="exploded"]').click(); const exploded = await diag();
    assert.equal(exploded.assembly.exploded, true); arrayClose(exploded.assembly.parts.Battery.offset, [.35, .1, .2], 'manual offset retained');
    assert.notDeepEqual(exploded.assembly.parts.Battery.position, manual.assembly.parts.Battery.position);
    await page.locator('[data-layer="cutaway"]').click(); arrayClose((await diag()).assembly.parts.Battery.position, manual.assembly.parts.Battery.position, 'manual assembly position restored');
    await page.locator('#assembly-hide').click(); await page.locator('#assembly-reset-all').click(); const d = await diag();
    for (const [name, part] of Object.entries(d.assembly.parts)) { assert.equal(part.hidden, false, name); arrayClose(part.offset, [0, 0, 0], name); arrayClose(part.rotation, [0, 0, 0], name); }
    assert.equal(d.assembly.exploded, false); assert.equal(await page.locator('#vehicle-canvas').getAttribute('data-layer'), 'exterior');
  });
  await check('Start remains stationary at zero throttle; Drive demo provides immediate propulsion', async () => {
    await page.locator('#sim-reset').click(); await page.locator('#studio-run').click(); await page.waitForTimeout(500);
    let d = await diag(); assert.equal(d.state.running, true); assert.equal(d.state.speedKmh, 0); assert.equal(d.state.distanceM, 0);
    await page.locator('#device-tractionMotor').check(); await page.waitForTimeout(350); d = await diag(); assert.equal(d.state.speedKmh, 0);
    await page.locator('#studio-drive').click();
    await page.waitForFunction(() => window.EVStudioDiagnostics().state.speedKmh > 4);
    d = await diag(); assert.equal(await page.locator('#throttle-control').inputValue(), '18'); assert.equal(d.state.running, true); assert.ok(d.state.distanceM > 0); assert.ok(d.state.powerW > 0);
    return { speedKmh: d.state.speedKmh, distanceM: d.state.distanceM, throttlePercent: 18 };
  });
  await check('Reduced-motion wheels and discs visibly rotate from integrated distance while calipers stay fixed', async () => {
    assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
    await page.locator('[data-camera="side"]').click(); await page.locator('#assembly-component').selectOption('');
    await page.waitForTimeout(200); const initial = await diag(); const before = hash(await shot('wheel-fixed-camera-before'));
    await page.waitForTimeout(417); const after = hash(await shot('wheel-fixed-camera-after')); const moved = await diag();
    assert.notEqual(before, after); assert.ok(moved.state.distanceM > initial.state.distanceM); assert.notEqual(moved.wheelAngles.Wheel_FL, initial.wheelAngles.Wheel_FL);
    await pause(); const d = await diag(), a = d.state.distanceM / d.state.assumptions.wheelRadiusM, tau = Math.PI * 2;
    for (const [name, angle] of Object.entries(d.wheelAngles)) close(angle, a % tau, name);
    close(d.rotorAngles.MotorRotor, a * d.state.assumptions.gearRatio % tau, 'motor rotor');
    close(d.rotorAngles.GearIntermediate, -a * d.state.assumptions.gearRatio / (41 / 15) % tau, 'intermediate gear');
    for (const name of ['Differential', 'DriveShaft_L', 'DriveShaft_R']) close(d.rotorAngles[name], a % tau, name);
    for (const name of Object.keys(d.assembly.parts).filter(n => /BrakeCaliper|Suspension/.test(n))) arrayClose(d.assembly.parts[name].operatingRotation, initial.assembly.parts[name].operatingRotation, name + ' fixed');
    return { beforeSHA256: before, afterSHA256: after, distanceM: d.state.distanceM, wheelAngles: d.wheelAngles, rotorAngles: d.rotorAngles };
  });
  await check('User offsets survive active wheel motion and pause freezes operating angles', async () => {
    await pause(); await page.locator('#assembly-reset-all').click(); await page.locator('#sim-reset').click();
    await page.locator('#assembly-component').selectOption('Wheel_FL'); await page.locator('#assembly-mode [data-mode="translate"]').click(); await coordinates([.2, .1, .3]);
    await page.locator('#assembly-mode [data-mode="rotate"]').click(); await coordinates([0, 25, 0]); await page.locator('#studio-drive').click();
    await page.locator('#vehicle-canvas').scrollIntoViewIfNeeded();
    const a = await diag();
    await page.waitForFunction(angle => window.EVStudioDiagnostics().wheelAngles.Wheel_FL !== angle, a.wheelAngles.Wheel_FL, { timeout: 10000 });
    const b = await diag();
    arrayClose(b.assembly.parts.Wheel_FL.offset, [.2, .1, .3], 'moving wheel translation'); arrayClose(b.assembly.parts.Wheel_FL.rotation, [0, 25 * Math.PI / 180, 0], 'moving wheel orientation');
    assert.notEqual(a.wheelAngles.Wheel_FL, b.wheelAngles.Wheel_FL);
    await pause(); const paused = await diag(); await page.waitForTimeout(300); const still = await diag();
    assert.deepEqual(still.wheelAngles, paused.wheelAngles); assert.deepEqual(still.state, paused.state); displayMatchesSnapshot(still);
    await page.locator('#assembly-reset-all').click(); await page.locator('#sim-reset').click();
  });
  await check('All auxiliary switches affect real scene state and screen device ledgers', async () => {
    await pause(); await page.locator('#sim-reset').click(); await page.locator('#assembly-reset-all').click(); await page.locator('#assembly-component').selectOption('');
    await page.locator('[data-camera="interior"]').click(); await page.locator('#studio-environment').selectOption('night'); await page.locator('#sim-start').click();
    const results = [];
    for (const [id, watts] of [['headlights', 80], ['airConditioning', 750], ['cabinLights', 12], ['infotainment', 35]]) {
      await page.waitForTimeout(220); const old = await diag(); const before = hash(await page.locator('#vehicle-canvas').screenshot());
      await page.locator('#device-' + id).check();
      await page.waitForFunction(id => { const d = window.EVStudioDiagnostics().displays.readings.devices.find(s => s.id === id); return d.status === 'ON' && d.energyWh > 0; }, id);
      const d = await diag();
      const device = d.displays.readings.devices.find(s => s.id === id);
      assert.equal(device.status, 'ON'); assert.equal(device.demandW, watts); assert.ok(device.energyWh > 0); close(d.state.powerW, watts / .88, id + ' input');
      assert.ok(d.displays.screens.every((screen, i) => screen.textureVersion > old.displays.screens[i].textureVersion));
      if (id === 'headlights') assert.ok(d.lights.headlights.every(n => n > 0));
      if (id === 'cabinLights') assert.ok(d.lights.cabin > 0);
      if (id === 'airConditioning') assert.equal(d.airflow, true);
      assert.notEqual(hash(await page.locator('#vehicle-canvas').screenshot()), before, id + ' rendered scene changes');
      await pause(); displayMatchesSnapshot(await diag());
      results.push({ id, watts, batteryInputW: device.batteryInputW, energyWh: device.energyWh });
      await page.locator('#device-' + id).uncheck(); await page.locator('#sim-start').click();
    }
    await pause(); await page.locator('#sim-reset').click(); await page.locator('#studio-environment').selectOption('studio'); return results;
  });
  await check('In-car running and paused views share exact numeric readings with the external simulation', async () => {
    await pause(); await page.locator('#sim-reset').click(); await page.locator('#assembly-reset-all').click(); await page.locator('#assembly-component').selectOption(''); await page.locator('[data-camera="interior"]').click();
    for (const id of ['headlights', 'airConditioning', 'cabinLights', 'infotainment']) await page.locator('#device-' + id).check();
    await page.locator('#studio-drive').click(); await page.waitForTimeout(800); await shot('interior-running-screens');
    const running = await diag(); assert.ok(running.displays.readings.speedKmh > 0); assert.ok(running.displays.readings.powerW > 0); assert.ok(running.displays.readings.devices.every(d => d.status === 'ON'));
    await pause(); const d = await diag(); displayMatchesSnapshot(d); assert.ok(d.displays.readings.devices.every(device => device.status === 'PAUSED' && device.demandW === 0));
    await shot('interior-paused-screens'); return { actual: d.state, rendered: d.displays.readings };
  });
  await check('All 60 visual routes and 87 logical terminals exactly match the authoritative CSV', async () => {
    await view('circuit'); await page.locator('[data-lab-tab="wiring"]').click(); await page.waitForFunction(() => document.querySelector('#physical-wiring-layout')?.dataset.ready === 'true');
    const rendered = await page.locator('#wiring-canvas g.wl-wire').evaluateAll(elements => elements.map(el => ({ wire_id: el.dataset.wireId, source_component: el.dataset.sourceComponent, source_terminal: el.dataset.sourcePin, destination_component: el.dataset.destinationComponent, destination_terminal: el.dataset.destinationPin, status: el.dataset.sourceStatus, physical: el.dataset.physicalStatus, path: el.querySelector('.wl-wire-core').getAttribute('d') })));
    assert.equal(rendered.length, 60); assert.equal(source.length, 60);
    assert.deepEqual(rendered.map(r => r.wire_id).sort(), source.map(r => r.wire_id).sort());
    for (const r of rendered) {
      const expected = source.find(s => s.wire_id === r.wire_id);
      for (const key of ['source_component', 'source_terminal', 'destination_component', 'destination_terminal', 'status']) assert.equal(r[key], expected[key], r.wire_id + '.' + key);
      assert.equal(r.physical, 'UNVERIFIED'); assert.ok(r.path.startsWith('M') && r.path.length > 20);
    }
    const expectedPins = [...new Set(source.flatMap(r => [r.source_component + '.' + r.source_terminal, r.destination_component + '.' + r.destination_terminal]))].sort();
    const pins = await page.locator('#wiring-canvas g.wl-pin').evaluateAll(elements => elements.map(el => el.dataset.pinKey).sort());
    assert.deepEqual(pins, expectedPins); assert.equal(pins.length, 87);
    await shot('wiring-overview', page.locator('#lab-panel-wiring'));
    return { independentParser: 'Python stdlib csv.DictReader', routes: rendered.length, terminals: pins.length, endpointMismatches: 0, sourceStatusMismatches: 0, allPhysicalStatuses: 'UNVERIFIED' };
  });
  await check('Every selectable wire highlights its entire original path and exposes its original endpoints', async () => {
    for (const row of source) {
      await page.locator(`[data-wire-id="${row.wire_id}"] .wl-wire-hit`).focus(); await page.keyboard.press('Enter');
      assert.equal(await page.locator('#wiring-canvas').getAttribute('data-selection'), 'wire:' + row.wire_id);
      assert.equal(await page.locator('.wl-wire.is-selected').count(), 1);
      assert.equal(await page.locator(`[data-highlight-wire="${row.wire_id}"]`).getAttribute('d'), await page.locator(`[data-wire-id="${row.wire_id}"] .wl-wire-core`).getAttribute('d'));
      const inspector = await page.locator('.wl-inspector').innerText();
      for (const value of [row.source_component, row.source_terminal, row.destination_component, row.destination_terminal, row.status]) assert.ok(inspector.includes(value), row.wire_id + ': ' + value);
      assert.match(inspector, /UNVERIFIED/);
    }
    const key = 'U_ESP.GPIO34', expected = source.filter(r => r.source_component + '.' + r.source_terminal === key || r.destination_component + '.' + r.destination_terminal === key).map(r => r.wire_id).sort();
    await page.locator(`[data-pin-key="${key}"]`).focus(); await page.keyboard.press('Enter');
    assert.deepEqual(await page.locator('.wl-wire.is-selected').evaluateAll(elements => elements.map(el => el.dataset.wireId).sort()), expected);
    assert.match(await page.locator('.wl-inspector').innerText(), /UNRESOLVED physical footprint and pin positions/);
    return { completeWireSelections: 60, pin: key, incidentWireIds: expected };
  });
  await check('Wiring search, full index, zoom, pan, focus and family filtering work', async () => {
    await page.locator('#wiring-search').fill('W053'); await page.locator('[data-find-type="wire"][data-find-id="W053"]').click(); assert.equal(await page.locator('#wiring-canvas').getAttribute('data-selection'), 'wire:W053');
    const canvas = page.locator('#wiring-canvas'); let box = await canvas.getAttribute('viewBox');
    await page.locator('[data-wiring-tool="in"]').click(); assert.notEqual(await canvas.getAttribute('viewBox'), box);
    box = await canvas.getAttribute('viewBox'); await page.locator('[data-wiring-pan="right"]').click(); assert.notEqual(await canvas.getAttribute('viewBox'), box);
    await canvas.focus(); box = await canvas.getAttribute('viewBox'); await page.keyboard.press('ArrowDown'); assert.notEqual(await canvas.getAttribute('viewBox'), box);
    await page.locator('[data-wiring-tool="fit"]').click(); box = await canvas.getAttribute('viewBox'); await page.locator('[data-wiring-tool="focus"]').click(); assert.notEqual(await canvas.getAttribute('viewBox'), box);
    await page.locator('#wiring-family').selectOption('ground'); assert.ok(await page.locator('.wl-wire.is-filtered').count() > 0); assert.ok(await page.locator('.wl-wire:not(.is-filtered)').count() > 0);
    assert.equal(await page.locator('.wl-wire').count(), 60);
    await page.locator('#wiring-family').selectOption('all'); await page.locator('.wl-register summary').click(); await page.locator('[data-wiring-index="W001"]').click(); assert.equal(await canvas.getAttribute('data-selection'), 'wire:W001');
    await page.locator('.wl-register summary').click(); await page.locator('[data-wiring-tool="clear"]').click(); assert.equal(await canvas.getAttribute('data-selection'), 'none');
    await page.locator('[data-wiring-tool="fit"]').click();
    return { controls: ['search', 'index', 'zoom', 'button pan', 'keyboard pan', 'focus', 'family', 'clear'] };
  });
  await check('Unscheduled hardware has no invented terminal mappings', async () => {
    for (const id of ['RP1', 'D1', 'RLY1']) {
      await page.locator(`#wiring-canvas [data-component-id="${id}"]`).focus(); await page.keyboard.press('Enter');
      assert.equal(await page.locator('.wl-wire.is-selected').count(), 0); assert.equal(await page.locator(`#wiring-canvas .wl-pin[data-component="${id}"]`).count(), 0);
      assert.match(await page.locator('.wl-inspector').innerText(), /No endpoints are scheduled/);
    }
    await page.locator('[data-wiring-tool="clear"]').click();
  });
  await check('320, 390, 768 and 1440 pixel simulator and wiring layouts stay within the viewport', async () => {
    const results = [];
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 980 });
      for (const section of ['simulator', 'circuit']) {
        await view(section); await page.waitForTimeout(150);
        const size = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth })); assert.ok(size.document <= size.viewport + 1, `${width} ${section}: ${size.document}`);
        results.push({ width, section, ...size });
        if (width === 390) await page.screenshot({ path: resolve(output, `phase2-${section}-mobile.png`), fullPage: false });
      }
    }
    return results;
  });
  await check('Browser reports no application errors or missing local assets', async () => {
    assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.localHttpErrors, []);
  });
} finally {
  report.passed = report.checks.filter(c => c.passed).length; report.failed = report.checks.length - report.passed;
  await writeFile(resolve(output, 'phase2-browser-validation.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
console.log(JSON.stringify({ passed: report.passed, failed: report.failed, report: 'validation/phase2-browser-validation.json' }));
if (report.failed) process.exitCode = 1;
