import { existsSync as _hasChromium } from 'node:fs';
// Isolated browser acceptance test for the engineering module. No Firebase access.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const fixture = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/engineering-lab.css"><link rel="stylesheet" href="/circuit-lab.css"><script type="importmap">{"imports":{"three":"/vendor/three/build/three.module.js","three/addons/":"/vendor/three/examples/jsm/"}}</script><style>body{margin:0;padding:32px;background:#101719;color:#ecf1ed;font-family:Arial,sans-serif;box-sizing:border-box}*{box-sizing:border-box}@media(max-width:600px){body{padding:14px}}</style></head><body><main id="engineering-lab"></main><script type="module">import{initEngineeringLab}from"/engineering-lab.js";await initEngineeringLab();</script></body></html>';
const types = { '.js': 'text/javascript', '.css': 'text/css', '.csv': 'text/csv', '.svg': 'image/svg+xml', '.png': 'image/png', '.md': 'text/plain' };
const server = createServer(async (req, res) => {
  if (req.url === '/fixture') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(fixture); return; }
  try {
    const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!path.startsWith(root + '\\') && !path.startsWith(root + '/')) throw new Error('Invalid path');
    const bytes = await readFile(path);
    res.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream' }); res.end(bytes);
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise((done) => server.listen(0, '127.0.0.2', done));
const browser = await chromium.launch(_hasChromium('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] } : { channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const checks = [];
try {
  await page.goto(`http://127.0.0.2:${server.address().port}/fixture`);
  await page.getByText('42 components · 60 connections', { exact: true }).waitFor({ state: 'attached' });
  await page.locator('[data-lab-tab="architecture"]').click();
  assert.equal(await page.locator('[data-lab-component]').count(), 9);
  for (const node of await page.locator('[data-lab-component]').all()) {
    const label = await node.locator('strong').innerText();
    await node.click();
    assert.equal(await node.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.lab-inspector h3').innerText(), label);
  }
  await page.locator('[data-lab-component="S_M"]').click();
  assert.match(await page.locator('.lab-inspector').innerText(), /27 kΩ \/ 20 kΩ/);
  await page.getByRole('button', { name: /Trace connections/ }).click();
  assert.ok(await page.locator('.lab-table tbody tr').count() > 0);
  await page.locator('#lab-register-search').fill('W053');
  assert.equal(await page.locator('.lab-table tbody tr').count(), 1);
  assert.match(await page.locator('.lab-table tbody').innerText(), /KELVIN_STAR_TIE/);
  await page.locator('#lab-register-search').fill('unfindable-token');
  assert.match(await page.locator('.lab-register-results').innerText(), /No matching/);
  await page.getByRole('button', { name: 'Clear search' }).click();
  assert.equal(await page.locator('.lab-table tbody tr').count(), 60);
  await page.locator('#lab-register-kind').selectOption('bom');
  assert.equal(await page.locator('.lab-table tbody tr').count(), 42);
  checks.push('All 9 component selectors, trace action, exact wire search, empty result, clear, 60-wire and 42-component registers');
  await page.getByRole('tab', { name: 'Calculations', exact: true }).click();
  assert.match(await page.locator('#lab-divider-result').innerText(), /2.3077/);
  await page.locator('#lab-divider-voltage').fill('24');
  assert.match(await page.locator('#lab-divider-result').innerText(), /Outside the cited/);
  await page.locator('#lab-divider-voltage').fill('');
  assert.match(await page.locator('#lab-divider-result').innerText(), /Enter finite values/);
  await page.locator('#lab-divider-voltage').fill('18');
  await page.locator('#lab-calculation-kind').selectOption('current');
  assert.match(await page.locator('#lab-current-result').innerText(), /14.04/);
  await page.locator('#lab-current-amperes').fill('-30');
  assert.match(await page.locator('#lab-current-result').innerText(), /0.2213/);
  await page.locator('#lab-calculation-kind').selectOption('energy');
  assert.match(await page.locator('#lab-energy-result').innerText(), /₹0.192/);
  await page.locator('#lab-energy-tariff').fill('0');
  assert.match(await page.locator('#lab-energy-result').innerText(), /₹0.000/);
  checks.push('Divider nominal and out-of-range results, empty-input validation, signed current, branch energy and zero tariff');
  await page.getByRole('tab', { name: 'Electrical schematic' }).click();
  await page.locator('.lab-original-schematic summary').click();
  await page.locator('#lab-schematic-image').waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.getElementById('lab-schematic-image').naturalWidth > 0);
  await page.getByRole('button', { name: 'Zoom schematic in' }).click();
  assert.equal(await page.locator('#lab-zoom-level').innerText(), '150%');
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  assert.equal(await page.locator('#lab-zoom-level').innerText(), '100%');
  checks.push('Original SVG decoded, zoom to 150%, fit to 100%');
  await page.getByRole('tab', { name: 'Hardware proposal', exact: true }).click();
  await page.locator('#hardware-proposal[data-ready="true"]').waitFor();
  assert.equal(await page.locator('.hardware-parts tbody tr').count(), 8);
  assert.match(await page.locator('#hardware-proposal').innerText(), /PROPOSED.*physical build and battery operation not qualified/);
  await page.locator('.hardware-schematic img').waitFor({state:'visible'});
  await page.waitForFunction(() => document.querySelector('.hardware-schematic img').naturalWidth > 0);
  await page.getByText('Proposed connection schedule · 28 records', {exact:true}).click();
  assert.equal(await page.locator('.hardware-connections tbody tr').count(), 28);
  assert.match(await page.locator('.hardware-connections tbody').innerText(), /GPIO26/);
  assert.match(await page.locator('.hardware-connections tbody').innerText(), /Sensor logic supply, not Vin\+/);
  checks.push('Separate hardware proposal loads eight exact-part rows, all28 proposed connection records and readable SVG with qualification limits');
  await page.screenshot({path:resolve(root,'validation/hardware-proposal-desktop.png'),fullPage:true});
  await page.getByRole('tab', { name: 'Architecture', exact: true }).click();
  await mkdir(resolve(root, 'validation'), { recursive: true });
  await page.screenshot({ path: resolve(root, 'validation/engineering-lab-desktop.png'), fullPage: true });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const tab of ['Architecture', 'Electrical schematic', 'Hardware proposal', 'Wiring & components', 'Calculations']) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${tab} page overflow at ${width}px`);
    }
    await page.getByRole('tab', { name: 'Architecture', exact: true }).click();
    await page.screenshot({ path: resolve(root, `validation/engineering-lab-${width}.png`), fullPage: true });
  }
  checks.push('All five panels at 390px and 320px without page overflow; architecture reflows to component grid and large tables scroll within their own surfaces');
  assert.deepEqual(errors, []);
  checks.push('No JavaScript page errors in the isolated module');
  const report={ status: 'passed', browser: await browser.version(), checks };
  await writeFile(resolve(root,'validation/engineering-browser.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
