import { existsSync as _hasChromium } from 'node:fs';
// Diagnostic only: records the initial wheel-motion/Start interaction issue.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const output = resolve('validation');
await mkdir(output, { recursive: true });
const browser = await chromium.launch(_hasChromium('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] } : { channel: 'msedge', headless: true });
const cases = [];
const digest = data => createHash('sha256').update(data).digest('hex');
try {
  for (const reducedMotion of ['reduce', 'no-preference']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion });
    const page = await context.newPage();
    try {
      await page.goto('http://127.0.0.2:5500', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelector('#vehicle-canvas')?.dataset.ready === 'true');
      await page.locator('#studio-quality').selectOption('low');
      await page.locator('button[data-camera="side"]').click();
      await page.waitForTimeout(1400);
      const state = async () => page.evaluate(() => ({
        speed: document.querySelector('#sim-speed').textContent,
        distance: document.querySelector('#sim-distance').textContent,
        throttle: document.querySelector('#throttle-control').value,
        traction: document.querySelector('#device-tractionMotor').checked,
        status: document.querySelector('#sim-status').textContent,
        prefersReducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      }));
      await page.locator('#studio-run').click(); await page.waitForTimeout(500);
      const startOnly = await state();
      await page.locator('#device-tractionMotor').check(); await page.waitForTimeout(500);
      const motorOnly = await state();
      await page.locator('#throttle-control').focus(); await page.locator('#throttle-control').press('Home');
      for (let i = 0; i < 18; i++) await page.locator('#throttle-control').press('ArrowRight');
      await page.waitForFunction(() => Number(document.querySelector('#sim-speed').textContent) > 4);
      await page.locator('#vehicle-canvas').scrollIntoViewIfNeeded();
      const before = await page.locator('#vehicle-canvas').screenshot({ path: resolve(output, `phase2-wheel-before-${reducedMotion}.png`) });
      const driveBefore = await state(); await page.waitForTimeout(347);
      const after = await page.locator('#vehicle-canvas').screenshot({ path: resolve(output, `phase2-wheel-after-${reducedMotion}.png`) });
      const driveAfter = await state();
      await page.locator('#studio-run').click(); const paused = await state();
      await page.locator('#studio-run').click(); await page.waitForTimeout(300); const restarted = await state();
      cases.push({ reducedMotion, startOnly, motorOnly, driveBefore, driveAfter, renderChangesDuringDrive: digest(before) !== digest(after), beforeSHA256: digest(before), afterSHA256: digest(after), paused, restarted });
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
const report = { date: '2026-11-03', scope: 'Initial phase 2 diagnostic, before functional motion fix. Screenshots compare a fixed side camera with auxiliaries off.', cases };
await writeFile(resolve(output, 'phase2-initial-motion-diagnosis.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
