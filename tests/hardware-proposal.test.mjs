import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const plan=JSON.parse(await readFile(new URL('../hardware/revision-b.json',import.meta.url),'utf8'));
const approx=(a,b,t=1e-12)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const links=plan.connections.map(c=>[c.from,c.to]);
const connects=(a,b)=>links.some(([x,y])=>(x===a&&y===b)||(x===b&&y===a));

test('proposal keeps inherited design distinct and refuses undocumented battery operation',()=>{
  assert.equal(plan.hardwareTested,false);assert.equal(plan.batteryOperationApproved,false);
  assert.equal(plan.electricalLimits.batteryAllowed,false);
  assert.match(plan.summary,/separate design.*60-wire/);
  assert.ok(!plan.connections.some(c=>/BAT|BUCK/i.test(c.from+c.to)));
  assert.ok(plan.openDecisions.some(s=>/interrupting/.test(s)));
  assert.ok(plan.openDecisions.some(s=>/firmware/i.test(s)));
});

test('every proposed contact references a listed component or external node and has a disposition',()=>{
  const ids=new Set([...plan.parts,...plan.externalNodes].map(p=>p.id));
  assert.equal(ids.size,plan.parts.length+plan.externalNodes.length);
  assert.equal(new Set(plan.connections.map(c=>c.id)).size,plan.connections.length);
  for(const c of plan.connections){for(const endpoint of [c.from,c.to])assert.ok(ids.has(endpoint.split('.')[0]),endpoint);assert.ok(c.status&&c.notes);}
  assert.equal(plan.connections.length,28);
  for(const p of plan.parts){assert.equal(new URL(p.url).protocol,'https:');assert.ok(p.qty>0&&p.conditions.length);}
});

test('3.3V logic devices share noncolliding I2C addresses and do not take a 12V logic supply',()=>{
  const peripherals=['IM','IL','OLED'];
  assert.deepEqual(peripherals.map(id=>plan.parts.find(p=>p.id===id).address),[0x40,0x41,0x3c]);
  for(const id of peripherals){assert.ok(connects('ESP.J2.1 3V3',id+(id==='OLED'?'.QT V+':'.VIN')));assert.ok(connects('ESP.J3.6 GPIO21',id+(id==='OLED'?'.QT SDA':'.SDA')));assert.ok(connects('ESP.J3.3 GPIO22',id+(id==='OLED'?'.QT SCL':'.SCL')));}
  const espPower=links.filter(pair=>pair.some(s=>s.startsWith('ESP.')&&/Micro-USB| 5V$/.test(s)));
  assert.deepEqual(espPower,[['USB.Micro-B','ESP.Micro-USB']]);
  assert.ok(links.filter(pair=>pair.some(s=>/\.VIN$/.test(s))).every(pair=>pair.includes('ESP.J2.1 3V3')));
});

test('source-to-load paths include the appropriate shunt and dedicated driver return',()=>{
  for(const [sensor,driver,load] of [['IM','QM','M1'],['IL','QL','L1']]){
    assert.ok(connects('JPOS.BUS',sensor+'.Vin+'));
    assert.ok(connects(sensor+'.Vin-',driver+'.V+'));
    assert.ok(connects(driver+'.GND','JSTAR.COMMON'));
    assert.ok(links.some(([a,b])=>a===driver+'.output +'&&b.startsWith(load+'.')));
    assert.ok(links.some(([a,b])=>a===driver+'.output −'&&b.startsWith(load+'.')));
    assert.ok(!connects('JPOS.BUS',driver+'.V+'),'would bypass the shunt');
    assert.ok(!connects(driver+'.output −','JSTAR.COMMON'),'would bypass switching');
  }
  assert.ok(connects('BENCH.NEG','JSTAR.COMMON'));
  assert.ok(connects('ESP.J2.14 GND','JSTAR.COMMON'));
});

test('independent tolerance-corner calculations fit proposed sensor range, without treating stall as allowed operation',()=>{
  const lim=plan.electricalLimits,rMax=lim.nominalShuntOhm*(1+lim.shuntToleranceFraction);
  approx(rMax,.101);approx(lim.motorTheoreticalStallA*rMax,.07575);
  approx(lim.motorTheoreticalStallA**2*rMax,.0568125);
  assert.ok(lim.initialPrototypeTotalCurrentCeilingA*rMax<lim.sensorShuntRangeV);
  assert.ok(lim.initialPrototypeTotalCurrentCeilingA<lim.driverContinuousManufacturerA);
  assert.match(lim.motorStallStatus,/prohibited/);
  approx(lim.lampEstimatedCurrentA,.95*(10*17.5/1000));
  assert.match(lim.lampEstimateStatus,/not measured/);
});

test('nominal scaling preserves shunt-loss and energy units at an independent test point',()=>{
  const r=.1,current=.5,vSource=12,vShunt=current*r,vBus=vSource-vShunt;
  approx(vSource*current-vBus*current,current*current*r);
  approx(Math.trunc(.04096/(.0001*r)),4096);
  const lampPower=.95*.175*12;
  approx(lampPower*3600/3600000,.001995);
  assert.ok(plan.measurement.some(s=>/outside.*measurements/.test(s)));
  assert.ok(plan.measurement.some(s=>/sequentially/.test(s)));
  assert.equal(plan.electricalLimits.controlMode,'on-off-only');
  assert.ok(plan.stages.some(s=>/before the first motor run/.test(s)));
});
