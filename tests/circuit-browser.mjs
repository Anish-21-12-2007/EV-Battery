import { existsSync as _hasChromium } from 'node:fs';
// Isolated 3D circuit acceptance: no telemetry or hardware writes.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const fixture='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/fonts/fonts.css"><link rel="stylesheet" href="/engineering-lab.css"><link rel="stylesheet" href="/circuit-lab.css"><script type="importmap">{"imports":{"three":"/vendor/three/build/three.module.js","three/addons/":"/vendor/three/examples/jsm/"}}</script><style>*{box-sizing:border-box}body{margin:0;padding:30px;background:#101719;color:#ecf1ed;font-family:Manrope,Arial,sans-serif}@media(max-width:600px){body{padding:12px}}</style></head><body><main id="engineering-lab"></main><script type="module">import{initEngineeringLab}from"/engineering-lab.js";await initEngineeringLab();</script></body></html>';
const types={'.js':'text/javascript','.css':'text/css','.json':'application/json','.csv':'text/csv','.svg':'image/svg+xml','.glb':'model/gltf-binary','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  if(req.url==='/fixture'){res.writeHead(200,{'Content-Type':'text/html'});res.end(fixture);return;}
  try{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!path.startsWith(root+'\\')&&!path.startsWith(root+'/'))throw new Error('Invalid path');res.writeHead(200,{'Content-Type':types[extname(path)]??'application/octet-stream'});res.end(await readFile(path));}
  catch{if(!res.headersSent)res.writeHead(404);res.end('Not found');}
});
await new Promise(done=>server.listen(0,'127.0.0.2',done));
const browser=await chromium.launch(_hasChromium('/usr/bin/chromium') ? {executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']} : {channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1500,height:1100},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const checks=[];
const snapshot=()=>page.evaluate(()=>document.querySelector('#circuit-physical-assembly').circuitLab.snapshot());
const assertContacts=state=>{for(const wire of state.wires){assert.ok(wire.points[0].every((v,i)=>Math.abs(v-wire.sourceContact[i])<1e-8),`${wire.id} source lost contact`);assert.ok(wire.points.at(-1).every((v,i)=>Math.abs(v-wire.destinationContact[i])<1e-8),`${wire.id} destination lost contact`);}};
await mkdir(resolve(root,'validation'),{recursive:true});
try{
  await page.goto(`http://127.0.0.2:${server.address().port}/fixture`);
  await page.waitForFunction(()=>document.querySelector('#circuit-stage')?.dataset.ready==='true',null,{timeout:90000});
  const initial=await snapshot();assert.equal(initial.componentCount,36);assert.equal(initial.terminalCount,87);assert.equal(initial.wireCount,60);assertContacts(initial);
  assert.equal(initial.wires.filter(w=>w.overhead).length,0,'Assembled view must use the Blender floor routes');
  checks.push('36 detailed component roots, 87 modeled contacts and all 60 source connection paths loaded');
  for(const id of ['U_ESP','U_BUCK_BOARD','BAT1','S_M','R_LH','M1','RLY1']){
    await page.locator('#circuit-component').selectOption(id);assert.equal((await snapshot()).selected.id,id);assert.match(await page.locator('.cl-inspector-content').innerText(),new RegExp(id));
  }
  assert.match(await page.locator('.cl-inspector-content').innerText(),/0 source connections/);
  await page.locator('.cl-connections summary').click();assert.match(await page.locator('.cl-inspector-content').innerText(),/No connection is scheduled/);
  await page.locator('#circuit-wire').selectOption('W037');
  assert.equal((await snapshot()).selected.id,'W037');assert.match(await page.locator('.cl-endpoints').innerText(),/NODE_IM[\s\S]*NODE[\s\S]*U_ESP[\s\S]*GPIO34/);
  assert.match(await page.locator('.cl-inspector-content').innerText(),/REQUIRES COMPONENT IDENTIFICATION/);
  checks.push('Component selection and original specifications; full wire selection with both endpoints and conditional source status; unwired relay remains unwired');
  await page.locator('#circuit-component').selectOption('U_ESP');
  await page.locator('#circuit-x').fill('0.6');await page.locator('#circuit-x').press('Tab');
  let moved=await snapshot();const espBefore=initial.components.find(c=>c.id==='U_ESP'),espAfter=moved.components.find(c=>c.id==='U_ESP');
  assert.ok(Math.abs(espAfter.position[0]-espBefore.position[0]-.6)<1e-8);assertContacts(moved);
  await page.locator('[data-circuit-transform="rotate"]').click();await page.locator('#circuit-y').fill('35');await page.locator('#circuit-y').press('Tab');
  const rotated=await snapshot();assert.ok(Math.abs(rotated.components.find(c=>c.id==='U_ESP').rotation[1]-35*Math.PI/180)<1e-8);assertContacts(rotated);
  const rotatedWire=rotated.wires.find(w=>w.id==='W037'),end=rotatedWire.points.at(-1),prior=rotatedWire.points.at(-2),delta=prior.map((v,i)=>v-end[i]),magnitude=Math.hypot(...delta);
  assert.ok(delta.reduce((sum,v,i)=>sum+v/magnitude*rotatedWire.destinationDirection[i],0)>.99,'Rotated contact must retain its local exit direction');
  await page.locator('#circuit-hide').click();assert.equal((await snapshot()).components.find(c=>c.id==='U_ESP').visible,false);
  await page.locator('#circuit-wire').selectOption('W037');assert.equal((await snapshot()).components.find(c=>c.id==='U_ESP').visible,true);
  await page.locator('#circuit-component').selectOption('U_ESP');await page.locator('#circuit-reset-part').click();
  assert.deepEqual((await snapshot()).components.find(c=>c.id==='U_ESP').position,espBefore.position);assert.deepEqual((await snapshot()).components.find(c=>c.id==='U_ESP').rotation,[0,0,0]);
  checks.push('Movement, rotation and hide/reveal preserve cable contact endpoints; wire selection reveals hidden endpoint; component reset restores exact placement');
  await page.locator('[data-circuit-view="exploded"]').click();const exploded=await snapshot();assert.equal(exploded.exploded,true);assert.notDeepEqual(exploded.components[0].position,initial.components[0].position);assertContacts(exploded);
  await page.locator('#circuit-reset-all').click();const restored=await snapshot();assert.equal(restored.exploded,false);assert.deepEqual(restored.components,initial.components);assertContacts(restored);
  checks.push('Exploded assembly keeps wires attached; restore resets all positions, rotations and visibility');
  await page.locator('#circuit-show-wires').uncheck();assert.equal((await snapshot()).wires.filter(w=>w.visible).length,0);await page.locator('#circuit-wire').selectOption('W037');assert.equal(await page.locator('#circuit-show-wires').isChecked(),true);assert.equal((await snapshot()).wires.find(w=>w.id==='W037').visible,true);
  await page.locator('#circuit-labels').selectOption('pins');await page.waitForTimeout(150);assert.ok(await page.locator('.cl-label-pin:visible').count()>0);await page.locator('#circuit-labels').selectOption('components');
  await page.locator('#circuit-component').selectOption('');
  await page.locator('.cl-workspace').screenshot({path:resolve(root,'validation/circuit-3d-assembly.png')});
  await page.locator('#circuit-wire').selectOption('W037');await page.locator('#circuit-focus-wire').click();
  for(const key of ['NODE_IM.NODE','U_ESP.GPIO34']){const p=await page.evaluate(key=>document.querySelector('#circuit-physical-assembly').circuitLab.project('terminal',key),key);assert.ok(p.x>0&&p.x<p.width&&p.y>0&&p.y<p.height,`${key} outside framed view`);}
  await page.locator('.cl-workspace').screenshot({path:resolve(root,'validation/circuit-3d-wire-inspection.png')});
  await page.locator('#circuit-component').selectOption('U_ESP');await page.locator('#circuit-focus').click();
  await page.locator('.cl-workspace').screenshot({path:resolve(root,'validation/circuit-3d-esp32.png')});
  await page.locator('#circuit-fit').click();
  await page.locator('#circuit-component').selectOption('');await page.locator('#circuit-stage canvas').scrollIntoViewIfNeeded();
  const beforeCamera=(await snapshot()).camera;const rect=await page.locator('#circuit-stage canvas').boundingBox();
  await page.mouse.move(rect.x+rect.width*.70,rect.y+rect.height*.7);await page.mouse.down();await page.mouse.move(rect.x+rect.width*.78,rect.y+rect.height*.76,{steps:5});await page.mouse.up();
  await page.waitForTimeout(300);assert.notDeepEqual((await snapshot()).camera.position,beforeCamera.position);
  await page.mouse.wheel(0,-250);await page.waitForTimeout(300);assert.notDeepEqual((await snapshot()).camera.position,beforeCamera.position);
  const targetBefore=(await snapshot()).camera.target;
  await page.mouse.move(rect.x+rect.width*.45,rect.y+rect.height*.5);await page.mouse.down({button:'right'});await page.mouse.move(rect.x+rect.width*.55,rect.y+rect.height*.55,{steps:5});await page.mouse.up({button:'right'});await page.waitForTimeout(300);
  assert.notDeepEqual((await snapshot()).camera.target,targetBefore);
  checks.push('Orbit, zoom and pan mouse gestures, wire visibility and pin labels operate');
  await page.getByRole('tab',{name:'Electrical schematic',exact:true}).click();
  await page.locator('.conventional-schematic').waitFor();assert.equal(await page.locator('[data-schematic-component]').count(),33);assert.equal(await page.locator('[data-schematic-wire]').count(),60);
  await page.getByRole('button',{name:'Zoom electrical schematic in',exact:true}).click();assert.equal(await page.locator('#lab-primary-zoom-level').innerText(),'150%');await page.getByRole('button',{name:'Fit diagram',exact:true}).click();
  await page.locator('#lab-conventional-schematic').screenshot({path:resolve(root,'validation/circuit-conventional-schematic.png')});
  checks.push('Conventional schematic exposes 33 connected symbols and all 60 wire identities from the same source; zoom and fit work');
  for(const width of [390,320]){
    await page.setViewportSize({width,height:900});
    for(const name of ['3D physical assembly','Electrical schematic']){await page.getByRole('tab',{name,exact:true}).click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} overflows at ${width}`);}
    await page.getByRole('tab',{name:'3D physical assembly',exact:true}).click();await page.locator('#circuit-reset-all').click();await page.locator('#circuit-component').selectOption('U_ESP');await page.screenshot({path:resolve(root,`validation/circuit-3d-${width}.png`),fullPage:true});
  }
  checks.push('3D assembly and schematic fit 390px and 320px layouts without page overflow');assert.deepEqual(errors,[]);
  const report={status:'passed',browser:await browser.version(),checks,errors,sourceConnections:initial.wires.map(w=>({id:w.id,source:w.source,destination:w.destination,status:w.status})),physicalTesting:'Not performed. This verifies software, modeled geometry and source connectivity only.'};
  await writeFile(resolve(root,'validation/circuit-3d-browser-validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,checks,errors},null,2));
}finally{await browser.close();await new Promise(done=>server.close(done));}
