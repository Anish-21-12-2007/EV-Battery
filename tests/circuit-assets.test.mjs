import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseEngineeringCsv} from '../engineering-lab.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url));
const manifest = JSON.parse(read('assets/circuit/circuit-manifest.json'));
const csv = read('FINAL_EV_EMS_ENGINEERING_PACKAGE/03_Circuit_Design/wiring_connections.csv');
const wires = parseEngineeringCsv(csv.toString('utf8'));
const bytes = read('assets/circuit/circuit-lab.glb');
assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
const idx = name => gltf.nodes.findIndex(n => n.name === name);
const object = name => {
  assert.equal(gltf.nodes.filter(n => n.name === name).length, 1, `Unambiguous node ${name}`);
  return gltf.nodes[idx(name)];
};
const close = (a, b, message) => a.forEach((n, i) => assert.ok(Math.abs(n - b[i]) < 1e-6, message));
const terminalMap = new Map(manifest.components.flatMap(c => c.terminals.map(t => [`${c.id}.${t.name}`, {c, t}])));

test('Blender export has separate selectable component groups and all 87 exact named contacts', () => {
  assert.equal(manifest.components.length, 36);
  assert.equal(manifest.components.filter(c => c.terminals.length).length, 33);
  assert.equal(terminalMap.size, 87);
  for (const c of manifest.components) {
    const root = object(c.node);
    assert.equal(root.extras.componentId, c.id);
    close(root.translation ?? [0, 0, 0], c.position, c.id + ' assembly location');
    assert.ok(root.children.some(i => gltf.nodes[i].mesh !== undefined), c.id + ' has renderable geometry');
    for (const t of c.terminals) {
      const contact = object(t.node);
      assert.equal(contact.extras.terminalName, t.name);
      assert.equal(contact.extras.componentId, c.id);
      assert.ok(root.children.includes(idx(t.node)), t.node + ' follows moved/rotated component');
      close(contact.translation ?? [0, 0, 0], t.position, t.node + ' physical anchor metadata');
    }
  }
});

test('all 60 model wires preserve the authoritative endpoints, statuses and source evidence', () => {
  assert.equal(manifest.sourceCsvSha256, createHash('sha256').update(csv).digest('hex'));
  assert.equal(manifest.wires.length, wires.length);
  assert.equal(wires.length, 60);
  for (const source of wires) {
    const wire = manifest.wires.find(w => w.wire_id === source.wire_id);
    assert.ok(wire, source.wire_id);
    for (const [key, value] of Object.entries(source)) assert.equal(wire[key], value, source.wire_id + '.' + key);
    for (const [prefix, stored] of [['source', wire.sourcePosition], ['destination', wire.destinationPosition]]) {
      const key = source[prefix + '_component'] + '.' + source[prefix + '_terminal'];
      const {c, t} = terminalMap.get(key);
      close(stored, c.position.map((n, i) => n + t.position[i]), source.wire_id + ' meets ' + key);
    }
    close(wire.points[0], wire.sourcePosition, source.wire_id + ' starts at its contact');
    close(wire.points.at(-1), wire.destinationPosition, source.wire_id + ' ends at its contact');
  }
});

test('unidentified parts, physical placements and unscheduled protection remain explicitly unresolved', () => {
  assert.match(manifest.scaleStatus, /NOT measured/);
  for (const c of manifest.components) {
    assert.match(c.geometryStatus, /ILLUSTRATIVE/);
    assert.equal(c.terminalPlacementStatus, 'UNRESOLVED');
    for (const t of c.terminals) assert.match(t.physicalStatus, /^UNRESOLVED/);
  }
  for (const id of ['D1', 'RP1', 'RLY1']) {
    assert.equal(manifest.components.find(c => c.id === id).unwired, true);
    assert.ok(wires.every(w => w.source_component !== id && w.destination_component !== id));
  }
  assert.ok(!terminalMap.has('TVS1.ANODE'), 'No fabricated return for incomplete W060');
  assert.equal(manifest.wires.find(w => w.wire_id === 'W060').destinationKey, 'TVS1.CATHODE');
  assert.ok(manifest.unresolvedConnections.some(c => c.id === 'T1_PROBE' && /4.7 kOhm/.test(c.detail)));
});
