import { existsSync as _hasChromium } from 'node:fs';
import {chromium} from '@playwright/test';
import {resolve} from 'node:path';
const browser=await chromium.launch(_hasChromium('/usr/bin/chromium') ? {executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']} : {channel:'msedge',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
  page.on('pageerror',e=>console.error(e.message));
  await page.goto('http://127.0.0.2:5500/#simulator');
  await page.waitForFunction(()=>document.querySelector('#vehicle-canvas')?.dataset.ready==='true');
  await page.locator('#studio-drive').click();
  for(const name of ['headlights','airConditioning','cabinLights','infotainment'])await page.locator('#device-'+name).check();
  await page.waitForTimeout(700);
  await page.locator('.vehicle-workspace').screenshot({path:resolve('validation/phase2-live-studio.png')});
  await page.locator('button[data-camera=interior]').click();
  await page.waitForTimeout(150);
  await page.locator('.vehicle-stage').screenshot({path:resolve('validation/phase2-live-cabin.png')});
  await page.locator('button[data-layer=cutaway]').click();
  await page.locator('button[data-camera=hero]').click();
  await page.locator('.vehicle-stage').screenshot({path:resolve('validation/phase2-cutaway.png')});
  await page.locator('button[data-layer=exploded]').click();
  await page.locator('.vehicle-stage').screenshot({path:resolve('validation/phase2-exploded.png')});
  console.log(JSON.stringify(await page.evaluate(()=>window.EVStudioDiagnostics().displays)));
} finally {await browser.close();}
