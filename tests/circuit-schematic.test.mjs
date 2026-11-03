import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseEngineeringCsv} from '../engineering-lab.js';
import {buildCircuitNets,renderCircuitSchematic} from '../circuit-schematic.js';
const wires=parseEngineeringCsv(await readFile(new URL('../FINAL_EV_EMS_ENGINEERING_PACKAGE/03_Circuit_Design/wiring_connections.csv',import.meta.url),'utf8'));
const bom=parseEngineeringCsv(await readFile(new URL('../FINAL_EV_EMS_ENGINEERING_PACKAGE/02_Component_Details/component_list.csv',import.meta.url),'utf8'));
test('schematic joins every CSV endpoint pair without bridging device internals',()=>{
  const {ports}=buildCircuitNets(wires), byKey=new Map(ports.map(p=>[p.key,p]));
  assert.equal(ports.length,87);
  for(const w of wires)assert.equal(byKey.get(w.source_component+'.'+w.source_terminal).net,byKey.get(w.destination_component+'.'+w.destination_terminal).net,w.wire_id);
  assert.notEqual(byKey.get('R_LH.A').net,byKey.get('R_LH.B').net,'top resistor must remain a component, not a wire');
  assert.notEqual(byKey.get('BAT1.BAT+').net,byKey.get('BAT1.BAT-').net,'battery must not be shorted');
  assert.notEqual(byKey.get('U_ESP.5V_IN').net,byKey.get('U_ESP.GND').net,'logic power separated');
  assert.equal(byKey.get('JGND.STAR_RETURN').net,byKey.get('JGND.LOGIC_GND').net,'W053 explicit Kelvin star tie');
  for(const port of ports.filter(p=>p.component==='BUS+'))assert.equal(port.net,byKey.get('BUS+.IN').net,'documented continuous distribution bus');
  assert.equal(byKey.has('TVS1.ANODE'),false,'unscheduled return not invented');
});
test('conventional diagram accounts for all 33 connected components and all 60 identities',()=>{
  const html=renderCircuitSchematic(wires,bom);
  assert.equal((html.match(/data-schematic-component=/g)||[]).length,33);
  assert.equal((html.match(/data-schematic-wire=/g)||[]).length,60);
  assert.match(html,/Return not scheduled/);assert.match(html,/RLY1 is quantity zero and unwired/);
  for(const wire of wires) assert.ok(html.includes(`data-schematic-wire="${wire.wire_id}"`));
});
