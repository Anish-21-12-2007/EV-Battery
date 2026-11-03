// End-to-end acceptance of the actual in-car energy material and external controls.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseURL=process.env.EV_EMS_TEST_URL||'http://127.0.0.2:5500';
const output=resolve('validation');await mkdir(output,{recursive:true});
const report={date:'2026-11-03',baseURL,checks:[],pageErrors:[],hardwareTested:false};
const launchOpts=existsSync('/usr/bin/chromium')
  ? {executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']}
  : {channel:'msedge',headless:true};
const browser=await chromium.launch(launchOpts);
const page=await browser.newPage({viewport:{width:1440,height:1040},reducedMotion:'reduce',deviceScaleFactor:1});
page.on('pageerror',error=>report.pageErrors.push(error.message));
const diag=()=>page.evaluate(()=>window.EVStudioDiagnostics());
const close=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-10,label+': '+a+' vs '+b);
const capture=name=>page.locator('#vehicle-canvas').screenshot({path:resolve(output,'energy-'+name+'.png')});
async function pause(){
  if((await diag()).state.running)await page.locator('#sim-stop').click();
  await page.waitForFunction(()=>{const d=window.EVStudioDiagnostics();return !d.state.running&&!d.displays.readings.running&&d.displays.readings.energy.totalKwh===d.state.totalDeviceEnergyKwh;});
}
function matches(d){
  assert.equal(d.displays.readings.devices.length,5);
  for(const shown of d.displays.readings.devices){
    const expected=d.state.devices.find(device=>device.id===shown.id);
    for(const key of ['enabled','energyKwh','batteryPercentConsumed','costInr'])assert.equal(shown[key],expected[key],shown.id+'.'+key);
    close(shown.batteryPercentConsumed,shown.energyKwh/(d.state.usablePackEnergyWh/1000)*100,shown.id+' percentage');
    if(d.state.tariffInrPerKwh!==null)close(shown.costInr,shown.energyKwh*d.state.tariffInrPerKwh,shown.id+' cost');
  }
  const rows=d.displays.readings.devices,energy=d.displays.readings.energy;
  close(energy.totalKwh,rows.reduce((sum,row)=>sum+row.energyKwh,0),'total electricity');
  close(energy.totalBatteryPercent,rows.reduce((sum,row)=>sum+row.batteryPercentConsumed,0),'total percentage');
  if(energy.totalCostInr!==null)close(energy.totalCostInr,rows.reduce((sum,row)=>sum+row.costInr,0),'total cost');
}
async function check(name,fn){const detail=await fn();report.checks.push({name,passed:true,detail});console.log('PASS',name);}
try{
  await page.goto(baseURL+'/#simulator',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.EVStudioDiagnostics?.().displays.readings,null,{timeout:60000});
  await page.locator('#studio-quality').selectOption('low');
  await page.locator('button[data-camera="energy"]').click();
  await page.locator('#sim-tariff').fill('8');
  for(const id of ['headlights','airConditioning','cabinLights','infotainment'])await page.locator('#device-'+id).check();
  await page.locator('#studio-drive').click();
  await page.waitForFunction(()=>window.EVStudioDiagnostics().state.devices.every(device=>device.energyKwh>0));
  await pause();
  await check('Actual infotainment texture shows all five device ledgers and exact totals',async()=>{
    const d=await diag();matches(d);
    assert.equal(d.displays.screens.find(screen=>screen.mesh==='Screen_Infotainment').material,'Screen_Infotainment_Live');
    assert.equal(d.state.usableCapacityVerified,false);
    assert.match(await page.locator('#sim-capacity-note').textContent(),/14\.40.*12\.96.*unverified/);
    await capture('screen-five-devices');return {energy:d.displays.readings.energy,devices:d.displays.readings.devices};
  });
  await check('Tariff changes immediately recalculate costs while retaining electricity',async()=>{
    const before=await diag();await page.locator('#sim-tariff').fill('16');
    await page.waitForFunction(()=>window.EVStudioDiagnostics().displays.readings.energy.tariffInrPerKwh===16);
    const after=await diag();matches(after);
    assert.deepEqual(after.state.deviceEnergyWh,before.state.deviceEnergyWh);
    close(after.displays.readings.energy.totalCostInr,before.displays.readings.energy.totalCostInr*2,'repriced total');
    return {before:before.displays.readings.energy.totalCostInr,after:after.displays.readings.energy.totalCostInr};
  });
  await check('OFF stops every device and retains all energy on the in-car screen',async()=>{
    const before=await diag();
    for(const id of ['tractionMotor','headlights','airConditioning','cabinLights','infotainment'])await page.locator('#device-'+id).uncheck();
    await page.locator('#sim-start').click();
    await page.waitForFunction(t=>window.EVStudioDiagnostics().state.simulatedSeconds>t+1,before.state.simulatedSeconds);
    await pause();const after=await diag();matches(after);
    assert.deepEqual(after.state.deviceEnergyWh,before.state.deviceEnergyWh);
    assert.ok(after.displays.readings.devices.every(device=>device.status==='OFF'&&device.energyKwh>0));
    assert.ok(after.lights.headlights.every(value=>value===0));assert.equal(after.lights.cabin,0);
    await capture('screen-retained-off');return {retainedEnergyKwh:after.state.totalDeviceEnergyKwh};
  });
  await check('Reset trip energy requires confirmation, supports cancel, and clears the screen upon confirmation while retaining battery charge and driving state',async()=>{
    const before=await diag();
    await page.locator('#sim-trip-reset').click();
    assert.equal(await page.locator('#trip-reset-confirm').isVisible(),true,'confirmation prompt appears');
    assert.equal((await diag()).displays.readings.energy.totalKwh,before.displays.readings.energy.totalKwh,'energy retained before confirming');
    await page.locator('#sim-trip-reset-cancel').click();
    assert.equal(await page.locator('#trip-reset-confirm').isVisible(),false,'cancel hides prompt');
    assert.equal((await diag()).displays.readings.energy.totalKwh,before.displays.readings.energy.totalKwh,'cancel preserves trip energy');
    await page.locator('#sim-trip-reset').click();
    await page.locator('#sim-trip-reset-confirm').click();
    assert.equal(await page.locator('#trip-reset-confirm').isVisible(),false,'confirm hides prompt');
    await page.waitForFunction(()=>window.EVStudioDiagnostics().displays.readings.energy.totalKwh===0);
    const after=await diag();matches(after);
    for(const key of ['speedMps','soc','distanceM','simulatedSeconds','running'])assert.equal(after.state[key],before.state[key],key);
    assert.deepEqual(after.state.devices.map(d=>d.enabled),before.state.devices.map(d=>d.enabled));
    assert.equal(after.state.totalDeviceCostInr,0);assert.equal(after.state.totalDeviceBatteryPercent,0);
    await capture('screen-reset');
  });
  await check('Energy camera and controls remain accessible at 390 and 320 pixels',async()=>{
    for(const width of [390,320]){
      await page.setViewportSize({width,height:920});
      await page.locator('button[data-camera="energy"]').click();
      assert.equal(await page.locator('#vehicle-canvas').getAttribute('data-camera'),'energy');
      await capture('screen-'+width);
      const layout=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.right>innerWidth+1;}).map(el=>({id:el.id,tag:el.tagName,className:String(el.className),right:el.getBoundingClientRect().right,width:el.getBoundingClientRect().width})).slice(0,15)}));
      assert.ok(layout.scrollWidth<=width+1,JSON.stringify(layout));
    }
  });
  assert.deepEqual(report.pageErrors,[]);
}catch(error){report.error=error.stack;process.exitCode=1;console.error(error);}
finally{await writeFile(resolve(output,'energy-display-browser.json'),JSON.stringify(report,null,2));await browser.close();}
