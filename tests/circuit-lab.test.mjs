import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseEngineeringCsv } from '../engineering-lab.js';
import { validateCircuitManifest, routeCircuitCable } from '../circuit-lab.js';

test('manifest rejects missing contacts, duplicate parts and false physical verification', () => {
  const wires=[{wire_id:'W001',source_component:'A',source_terminal:'OUT',destination_component:'B',destination_terminal:'IN'}];
  const bom=[{ID:'A'},{ID:'B'}];
  const manifest={components:[{id:'A',node:'A',position:[0,0,0],terminals:[{name:'OUT',position:[.5,.2,0],physicalStatus:'UNRESOLVED'}]},{id:'B',node:'B',position:[2,0,0],terminals:[{name:'IN',position:[-.5,.2,0],physicalStatus:'UNRESOLVED'}]}]};
  assert.equal(validateCircuitManifest(manifest,wires,bom).wireCount,1);
  const missing=structuredClone(manifest);missing.components[1].terminals=[];
  assert.throws(()=>validateCircuitManifest(missing,wires,bom),/Missing modeled contact B.IN/);
  const duplicate=structuredClone(manifest);duplicate.components.push(manifest.components[0]);
  assert.throws(()=>validateCircuitManifest(duplicate,wires,bom),/Invalid component A/);
  const falseVerification=structuredClone(manifest);falseVerification.components[1].terminals[0].physicalStatus='VERIFIED';
  assert.throws(()=>validateCircuitManifest(falseVerification,wires,bom),/must remain unresolved/);
});

test('floor cable route preserves both contact endpoints and avoids an intervening board', () => {
  const source=[-2,.3,0],destination=[2,.3,0];
  const boxes=[{id:'A',min:[-2.5,0,-.5],max:[-1.5,.3,.5]},{id:'BLOCK',min:[-.6,0,-.6],max:[.6,.5,.6]},{id:'B',min:[1.5,0,-.5],max:[2.5,.3,.5]}];
  const route=routeCircuitCable(source,destination,boxes,'A','B');
  assert.deepEqual(route.points[0],source);assert.deepEqual(route.points.at(-1),destination);
  assert.equal(route.overhead,false);assert.ok(route.points.length>=8);
  for(let i=1;i<route.points.length;i++) {
    const a=route.points[i-1],b=route.points[i];
    for(let t=0;t<=1;t+=.02) {
      const p=a.map((v,k)=>v+(b[k]-v)*t);
      assert.ok(!(p[0]>-.6&&p[0]<.6&&p[1]<.5&&p[2]>-.6&&p[2]<.6),'Cable intersects intervening board');
    }
  }
});

test('a same-component Kelvin tie remains a continuous source-matched cable', () => {
  const source=[0,.2,0],destination=[.3,.2,0],boxes=[{id:'JGND',min:[-.2,0,-.2],max:[.5,.2,.2]}];
  const route=routeCircuitCable(source,destination,boxes,'JGND','JGND',52);
  assert.deepEqual(route.points[0],source);assert.deepEqual(route.points.at(-1),destination);
  assert.ok(route.points.every(p=>p.every(Number.isFinite)));
});

test('inspection cable exits follow rotated terminal directions at both ends', () => {
  const source=[-1,.5,0],destination=[1,.5,0],boxes=[{id:'A',min:[-1.3,.2,-.3],max:[-.7,.6,.3]},{id:'B',min:[.7,.2,-.3],max:[1.3,.6,.3]}];
  const route=routeCircuitCable(source,destination,boxes,'A','B',0,{source:[0,-1,0],destination:[0,0,1]});
  const beginning=route.points[1].map((v,i)=>v-source[i]),ending=route.points.at(-2).map((v,i)=>v-destination[i]);
  assert.ok(beginning[1]<0&&Math.abs(beginning[0])<1e-9&&Math.abs(beginning[2])<1e-9);
  assert.ok(ending[2]>0&&Math.abs(ending[0])<1e-9&&Math.abs(ending[1])<1e-9);
});

test('every exported circuit contact resolves the actual 60-row source netlist', async () => {
  const base=new URL('../',import.meta.url);
  const [manifest,wires,bom]=await Promise.all([
    readFile(new URL('assets/circuit/circuit-manifest.json',base),'utf8').then(JSON.parse),
    readFile(new URL('FINAL_EV_EMS_ENGINEERING_PACKAGE/03_Circuit_Design/wiring_connections.csv',base),'utf8').then(parseEngineeringCsv),
    readFile(new URL('FINAL_EV_EMS_ENGINEERING_PACKAGE/02_Component_Details/component_list.csv',base),'utf8').then(parseEngineeringCsv),
  ]);
  const result=validateCircuitManifest(manifest,wires,bom);
  assert.equal(result.wireCount,60);assert.equal(result.terminals.size,87);assert.equal(result.components.size,36);
  assert.equal(result.components.get('RLY1').terminals.length,0);
  assert.equal(result.components.get('RP1').terminals.length,0);
  assert.equal(result.components.get('TVS1').terminals.length,1);
});
