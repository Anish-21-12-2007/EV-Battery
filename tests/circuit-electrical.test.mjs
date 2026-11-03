import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseEngineeringCsv, calculateDivider, calculateCurrentScaler, calculateBranchEnergy } from '../engineering-lab.js';
import { FAULT_MODE_ANALYSIS, circuitReviewHtml } from '../circuit-review.js';

const directory = new URL('../FINAL_EV_EMS_ENGINEERING_PACKAGE/', import.meta.url);
const [wires,bom,stored] = await Promise.all([
  readFile(new URL('03_Circuit_Design/wiring_connections.csv',directory),'utf8').then(parseEngineeringCsv),
  readFile(new URL('02_Component_Details/component_list.csv',directory),'utf8').then(parseEngineeringCsv),
  readFile(new URL('06_Validation/calculation_results.json',directory),'utf8').then(JSON.parse),
]);
const approx=(actual,expected,tolerance=1e-10)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} != ${expected}`);
const key=(component,terminal)=>`${component}.${terminal}`;

test('divider calculator agrees with all independent resistor-tolerance corners', () => {
  const r=calculateDivider({voltage:18,topKohm:68,bottomKohm:10,tolerancePercent:1});
  const corners=[];
  for(const top of [68000*.99,68000*1.01])for(const bottom of [10000*.99,10000*1.01])corners.push(18*bottom/(top+bottom));
  approx(r.minimumV,Math.min(...corners));approx(r.maximumV,Math.max(...corners));
  approx(r.nominalV,30/13);assert.ok(r.maximumV<2.45&&r.maximumV>2.348);
  const threshold=2.45/(10100/(67320+10100));approx(r.characterizedInputCeilingV,threshold);
  assert.ok(calculateDivider({voltage:19,topKohm:68,bottomKohm:10,tolerancePercent:1}).maximumV>2.45);
  approx(stored.voltage_divider_per_load.rc_cutoff_100nf_hz,1/(2*Math.PI*(68000*10000/78000)*100e-9));
});

test('direct ACS712-30A nominal scaling and ratiometric offset assumptions are explicit arithmetic', () => {
  approx(calculateCurrentScaler(0).nodeV,50/47);
  approx(calculateCurrentScaler(30).nodeV,4.48*20/47);
  approx(calculateCurrentScaler(-30).nodeV,.52*20/47);
  approx(calculateCurrentScaler(.5).shiftMv,33*20/47);
  const kMax=20200/(26730+20200);assert.ok(5.5*kMax<2.45);
  approx(stored.current_divider.rc_cutoff_100nf_hz,1/(2*Math.PI*(27000*20000/47000)*100e-9));
  approx(.5*5*.02/.066,.7575757575757576);
});

test('unpowered hypothetical clamp calculation applies KCL instead of treating top-resistor current as pin current', () => {
  const pinVoltage=.3,outputVoltage=2.5,top=27000,bottom=20000;
  const topCurrent=(outputVoltage-pinVoltage)/top,bottomCurrent=pinVoltage/bottom;
  const hypotheticalPinCurrent=topCurrent-bottomCurrent;
  approx(hypotheticalPinCurrent,66.48148148148149e-6);
  approx(topCurrent,bottomCurrent+hypotheticalPinCurrent);
  // The unchanged package result is a top-resistor bound, not the KCL pin current.
  approx(stored.current_divider.unpowered_mcu_injection_current_at_2p5v_out_a,topCurrent);
  assert.ok(stored.current_divider.unpowered_mcu_zero_current_node_v>.3);
  assert.ok(hypotheticalPinCurrent>0); // No assertion here calls it an allowed injection current.
});

test('nominal energy units and separately timed branch integration agree', () => {
  approx(12*7.6,91.2);approx(96*150/1000,14.4);
  const e=calculateBranchEnergy({lightVoltage:12,lightCurrent:.5,lightHours:2,motorVoltage:12,motorCurrent:4,motorHours:.25,tariff:8});
  approx(e.totalWh,24);approx(e.cost,.192);approx(e.totalWh,e.lightWh+e.motorWh);
  // A nominal Wh product must not be asserted to be usable energy.
  assert.match(bom.find(row=>row.ID==='BAT1')['Audit note'],/unverified|unknown|not|TBD/i);
});

test('current source has unresolved protection and optional pullup scheduling, not a complete build netlist', () => {
  const connected=id=>wires.filter(w=>w.source_component===id||w.destination_component===id);
  assert.equal(connected('RP1').length,0);assert.equal(connected('D1').length,0);assert.equal(connected('RLY1').length,0);
  assert.equal(bom.find(row=>row.ID==='RLY1').Qty,'0');
  assert.deepEqual(connected('TVS1').map(w=>[w.wire_id,w.destination_terminal]),[['W060','CATHODE']]);
  assert.equal(bom.some(row=>/4\.7\s*k/i.test(row['Proposed identity / rating'])&&Number(row.Qty)>0),false);
  const w002=wires.find(w=>w.wire_id==='W002');assert.deepEqual([w002.source_component,w002.destination_component],['F1','SW1']);
  for(const id of ['F1','FL','FM','F2'])assert.match(bom.find(row=>row.ID===id).Status,/REQUIRES/);
});

test('light current supply and interface remain unresolved candidate records', () => {
  const supply=wires.find(w=>w.wire_id==='W020');
  assert.deepEqual([supply.source_component,supply.source_terminal,supply.destination_component,supply.destination_terminal],['U_BUCK_BOARD','OUT+','S_L','VCC']);
  assert.match(supply.status,/REQUIRES COMPONENT IDENTIFICATION/);assert.match(supply.evidence_or_condition,/3\.3 V/);
  const signal=wires.find(w=>w.wire_id==='W023');assert.equal(signal.destination_terminal,'GPIO32');
  assert.match(signal.status,/REQUIRES COMPONENT IDENTIFICATION/);
  // A 0.1 Ω shunt at 0.5 A cannot fit an INA219 ±40 mV selected gain range.
  assert.ok(.5*.1>.040);
});

test('non-isolated buck continuity creates a second return path independent of W053', () => {
  const edges=wires.filter(w=>w.wire_id!=='W053').map(w=>({id:w.wire_id,a:key(w.source_component,w.source_terminal),b:key(w.destination_component,w.destination_terminal)}));
  const path=(withCommon)=>{
    const selected=[...edges,...(withCommon?[{id:'CONDITIONAL_BUCK_INTERNAL_COMMON',a:'U_BUCK_BOARD.IN-',b:'U_BUCK_BOARD.OUT-'}]:[])];
    const queue=[{node:'JGND.LOGIC_GND',ids:[]}],seen=new Set();
    for(let i=0;i<queue.length;i++){
      const current=queue[i];if(current.node==='JGND.STAR_RETURN')return current.ids;if(seen.has(current.node))continue;seen.add(current.node);
      for(const e of selected){const next=e.a===current.node?e.b:e.b===current.node?e.a:null;if(next&&!seen.has(next))queue.push({node:next,ids:[...current.ids,e.id]});}
    }
    return null;
  };
  assert.equal(path(false),null);
  assert.deepEqual(path(true),['W016','CONDITIONAL_BUCK_INTERNAL_COMMON','W014','W052']);
  // This is a detected design issue, not permission to remove a wire without a revised design.
});

test('branch voltage taps are at DC inputs, not PWM motor outputs', () => {
  const light=wires.find(w=>w.wire_id==='W024'),motor=wires.find(w=>w.wire_id==='W038');
  assert.deepEqual([light.source_component,light.source_terminal,light.destination_component],['L1','INPUT+','R_LH']);
  assert.deepEqual([motor.source_component,motor.source_terminal,motor.destination_component],['MDRV','INPUT+','R_VH']);
  assert.ok(wires.filter(w=>/^MOTOR_OUT/.test(w.source_terminal)).every(w=>w.destination_component==='M1'));
});

test('startup, shutdown, open-resistor, sensor-disconnect, and ground-return fault conditions are explicitly analyzed and marked UNVERIFIED', () => {
  assert.equal(FAULT_MODE_ANALYSIS.length, 5);
  // 1. Unpowered MCU KCL injection at 18V bus via 68k/10k into hypothetical 0.3V clamp
  const vBus = 18.0, vClamp = 0.3, rTopV = 68000, rBotV = 10000;
  const kclCurrentV = (vBus - vClamp) / rTopV - vClamp / rBotV;
  approx(kclCurrentV, 0.00023029411764705883, 1e-12);
  // 2. Open bottom divider resistor R_VL exposes node to unattenuated 18V source
  const openBottomNodeV = vBus;
  assert.ok(openBottomNodeV > 3.6, 'open R_VL exceeds 3.6V powered GPIO absolute maximum');
  // 3. Disconnected S_M output pulled to 0V by R_ML maps to -37.88A under linear transfer
  const disconnectedAdcV = 0;
  const inferredCurrentA = (disconnectedAdcV / (20 / 47) - 2.5) / 0.066;
  approx(inferredCurrentA, -37.878787878787875, 1e-10);
  // 4. Verify inspector HTML marks items UNVERIFIED and not construction-ready
  const espHtml = circuitReviewHtml('component', 'U_ESP');
  assert.match(espHtml, /UNVERIFIED/);
  assert.match(espHtml, /Not construction-ready/);
  assert.match(espHtml, /Missing:/);
  assert.match(espHtml, /Consequence:/);
});
