import { existsSync as _hasChromium } from 'node:fs';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const url=process.env.EV_EMS_TEST_URL||'http://127.0.0.2:5500';
const output=resolve('validation');await mkdir(output,{recursive:true});
const browser=await chromium.launch(_hasChromium('/usr/bin/chromium') ? {executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']} : {channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1040},reducedMotion:'reduce',deviceScaleFactor:1});
const report={date:'2026-11-03',checks:[],errors:[],actualVehicleMesh:'Screen_Infotainment'};
page.on('pageerror',e=>report.errors.push(e.message));
const diag=()=>page.evaluate(()=>window.EVStudioDiagnostics());
const shot=name=>page.locator('#vehicle-stage').screenshot({path:resolve(output,'camera-'+name+'.png')});
async function check(name,fn){const detail=await fn();report.checks.push({name,passed:true,detail});console.log('PASS',name);}
try{
  await page.goto(url+'/#simulator',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.EVStudioDiagnostics?.().camera,null,{timeout:60000});
  await page.locator('#studio-quality').selectOption('low');
  await page.evaluate(()=>{window.originalVehicleCanvas=document.querySelector('#vehicle-canvas canvas');});
  await check('Every view allows close zoom and panning instead of the old exterior distance barrier',async()=>{
    let d=await diag();assert.equal(d.camera.minDistance,.015);assert.equal(d.camera.near,.005);assert.equal(d.camera.enablePan,true);assert.equal(d.camera.enableZoom,true);
    for(let i=0;i<19;i++)await page.locator('#studio-zoom-in').click();
    d=await diag();assert.ok(d.camera.distance<.3,'exterior zoom must pass the previous 3.4 m barrier');
    await page.locator('#assembly-component').selectOption('Battery');await page.locator('#studio-orbit').click();await page.locator('#assembly-focus').click();
    const focused=await diag();assert.equal(focused.camera.minDistance,.015);assert.equal(focused.camera.autoOrbit,false);
    await page.locator('#studio-reset-camera').click();return {closestExteriorDistance:d.camera.distance,near:d.camera.near};
  });
  await check('Open energy screen reveals a large real vehicle display with every corner inside the view',async()=>{
    await page.locator('#assembly-component').selectOption('Infotainment');
    await page.locator('#assembly-x').fill('0.04');await page.locator('#assembly-apply').click();
    const original=await diag();
    await page.locator('#assembly-hide').click();
    assert.equal((await diag()).assembly.parts.Infotainment.hidden,true);
    await page.locator('#studio-orbit').click();assert.equal((await diag()).camera.autoOrbit,true);
    await page.locator('#studio-open-energy').click();
    await page.waitForFunction(()=>window.EVStudioDiagnostics().camera.expanded);
    const d=await diag();assert.equal(d.camera.autoOrbit,false);assert.equal(await page.locator('#vehicle-canvas').getAttribute('data-camera'),'energy');
    assert.equal(d.assembly.parts.Infotainment.hidden,false);assert.equal(d.assembly.parts.Infotainment.visible,true);
    assert.equal(d.assembly.selected,'','selection helpers must not cross the screen');
    assert.deepEqual(d.assembly.parts.Infotainment.offset,original.assembly.parts.Infotainment.offset);
    assert.equal(d.state.socPercent,original.state.socPercent);assert.equal(d.state.totalDeviceEnergyKwh,original.state.totalDeviceEnergyKwh);
    assert.ok(d.camera.energyScreenCorners.every(p=>Math.abs(p[0])<.95&&Math.abs(p[1])<.95&&p[2]>-1&&p[2]<1));
    assert.ok(d.camera.energyScreenUnobstructed.every(Boolean),'center and four corners must be visible without any vehicle mesh blocking them');
    const maxExtent=Math.max(...d.camera.energyScreenCorners.flatMap(p=>[Math.abs(p[0]),Math.abs(p[1])]));assert.ok(maxExtent>.8,'screen must fill most of one viewport dimension');
    assert.ok(await page.evaluate(()=>document.querySelector('#vehicle-canvas canvas')===window.originalVehicleCanvas));
    await shot('expanded-energy-desktop');return d.camera;
  });
  await check('Pan gesture moves the target; zoom can inspect fine details; reset restores complete screen framing',async()=>{
    await page.locator('[data-camera-drag="pan"]').click();const before=await diag();
    const r=await page.locator('#vehicle-canvas canvas').boundingBox();await page.mouse.move(r.x+r.width*.5,r.y+r.height*.5);await page.mouse.down();await page.mouse.move(r.x+r.width*.56,r.y+r.height*.54,{steps:5});await page.mouse.up();
    await page.waitForTimeout(180);assert.notDeepEqual((await diag()).camera.target,before.camera.target);
    await page.locator('#studio-reset-camera').click();
    for(let i=0;i<18;i++)await page.locator('#studio-zoom-in').click();
    const close=await diag();assert.ok(close.camera.distance<.03);assert.ok(close.camera.distance>=close.camera.minDistance-1e-6);
    await page.locator('#studio-reset-camera').click();await page.locator('[data-camera-drag="orbit"]').click();
    const restored=await diag();assert.ok(restored.camera.energyScreenCorners.every(p=>Math.abs(p[0])<.95&&Math.abs(p[1])<.95));return {closestDistance:close.camera.distance,dragMode:restored.camera.dragMode};
  });
  await check('Native fullscreen uses the existing vehicle stage and closes cleanly',async()=>{
    await page.locator('#studio-fullscreen').click();
    await page.waitForFunction(()=>document.fullscreenElement===document.getElementById('vehicle-stage')||document.querySelector('#studio-view-status').textContent.includes('Expanded view is open'));
    const native=await page.evaluate(()=>document.fullscreenElement?.id||(document.getElementById('vehicle-stage')?.classList.contains('is-expanded')?'vehicle-stage':null));assert.equal(native,'vehicle-stage','Fullscreen or policy-fallback expanded stage should activate');
    assert.ok(await page.evaluate(()=>document.querySelector('#vehicle-canvas canvas')===window.originalVehicleCanvas));
    await shot('native-fullscreen');await page.locator('#studio-fullscreen').click();
    await page.waitForFunction(()=>!document.fullscreenElement&&!document.body.classList.contains('studio-expanded'));return {fullscreenElement:native};
  });
  await check('Fullscreen rejection falls back to an expanded view of the same WebGL canvas',async()=>{
    await page.evaluate(()=>{document.getElementById('vehicle-stage').requestFullscreen=()=>Promise.reject(new Error('Test fallback'));});
    await page.locator('#studio-fullscreen').click();
    await page.waitForFunction(()=>document.querySelector('#studio-view-status').textContent.includes('Expanded view is open'));
    assert.ok((await diag()).camera.expanded);assert.ok(await page.evaluate(()=>document.querySelector('#vehicle-canvas canvas')===window.originalVehicleCanvas));
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.body.classList.contains('studio-expanded'));
  });
  await check('Look inside opens the cabin in the same expanded viewport without changing the trip',async()=>{
    const before=await diag();await page.locator('#studio-open-cabin').click();
    const after=await diag();assert.equal(await page.locator('#vehicle-canvas').getAttribute('data-camera'),'interior');
    assert.equal(after.camera.expanded,true);assert.equal(after.camera.minDistance,.015);assert.equal(after.camera.autoOrbit,false);
    assert.equal(after.state.socPercent,before.state.socPercent);assert.equal(after.state.totalDeviceEnergyKwh,before.state.totalDeviceEnergyKwh);
    assert.ok(await page.evaluate(()=>document.querySelector('#vehicle-canvas canvas')===window.originalVehicleCanvas));
    await page.locator('#studio-expand').click();
  });
  await check('Mobile expansion fills the viewport and preserves the actual screen in landscape',async()=>{
    await page.setViewportSize({width:390,height:844});await page.locator('#studio-open-energy').click();
    await page.waitForFunction(()=>window.EVStudioDiagnostics().camera.width===390);
    assert.ok((await diag()).camera.expanded);assert.ok((await diag()).camera.energyScreenUnobstructed.every(Boolean),'portrait view must not retreat through a seat');await shot('expanded-energy-mobile');
    await page.setViewportSize({width:844,height:390});
    await page.waitForFunction(()=>window.EVStudioDiagnostics().camera.width===844);
    const d=await diag();assert.ok(d.camera.energyScreenCorners.every(p=>Math.abs(p[0])<.98&&Math.abs(p[1])<.98));
    assert.ok(d.camera.energyScreenUnobstructed.every(Boolean),'landscape view must retain clear sight to the physical display');
    assert.ok(await page.evaluate(()=>document.querySelector('#vehicle-canvas canvas')===window.originalVehicleCanvas));await shot('expanded-energy-landscape');
    await page.locator('#studio-expand').click();assert.ok(!(await diag()).camera.expanded);return {landscapeWidth:d.camera.width,landscapeHeight:d.camera.height};
  });
  assert.deepEqual(report.errors,[]);
}catch(error){report.error=error.stack;process.exitCode=1;console.error(error);}
finally{await writeFile(resolve(output,'vehicle-camera-browser.json'),JSON.stringify(report,null,2));await browser.close();}
