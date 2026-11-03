import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../assets/vehicle/ev-ems-gt-phase2.glb', import.meta.url));
assert.equal(source.toString('ascii', 0, 4), 'glTF');
const gltf = JSON.parse(source.toString('utf8', 20, 20 + source.readUInt32LE(12)));
const index = name => gltf.nodes.findIndex(node => node.name === name);
const node = name => { const i = index(name); assert.ok(i >= 0, `Required semantic group ${name}`); return gltf.nodes[i]; };
const parent = id => gltf.nodes.findIndex(n => n.children?.includes(id));
const descendantMeshes = n => (n.mesh === undefined ? [] : [gltf.meshes[n.mesh]]).concat((n.children ?? []).flatMap(i => descendantMeshes(gltf.nodes[i])));
const closeVector = (a, b) => a.forEach((value, i) => assert.ok(Math.abs(value - b[i]) < 1e-6));

test('phase 2 assembly exposes individual seats, coachwork and drivetrain groups', () => {
  const required = ['Seat_FL', 'Seat_FR', 'Seat_RL', 'Seat_RR', 'Door_L', 'Door_R', 'Bonnet', 'Dashboard', 'SteeringWheel', 'CenterConsole', 'InstrumentCluster', 'Battery', 'Motor', 'Inverter', 'MotorRotor', 'MotorStator', 'GearIntermediate', 'Differential', 'DriveShaft_L', 'DriveShaft_R'];
  const parents = required.map(name => {
    const object = node(name); assert.ok(descendantMeshes(object).length > 0, `${name} owns renderable geometry`);
    assert.equal(gltf.nodes.filter(n => n.name === name).length, 1, `${name} is unambiguous`);
    return parent(index(name));
  });
  assert.ok(parents.every(p => p === parents[0]), 'Major assemblies are sibling groups, so individual edits cannot move neighboring parts by hierarchy');
});

test('brake discs share wheel pivots while calipers and suspension remain independent siblings', () => {
  for (const suffix of ['FL', 'FR', 'RL', 'RR']) {
    const wheel = node('Wheel_' + suffix), disc = node('BrakeDisc_' + suffix), caliper = node('BrakeCaliper_' + suffix), suspension = node('Suspension_' + suffix);
    assert.ok(wheel.translation?.length === 3); assert.ok(disc.translation?.length === 3);
    closeVector(wheel.translation, disc.translation);
    const p = parent(index('Wheel_' + suffix));
    for (const name of ['BrakeDisc_', 'BrakeCaliper_', 'Suspension_']) assert.equal(parent(index(name + suffix)), p);
    assert.ok(descendantMeshes(disc).length > 0 && descendantMeshes(caliper).length > 0 && descendantMeshes(suspension).length > 0);
    assert.ok((wheel.children ?? []).every(i => !/BrakeDisc|BrakeCaliper|Suspension/.test(gltf.nodes[i].name)), 'No duplicate fixed/rotating brake assembly baked under the wheel');
  }
});

test('both in-car screens are distinct UV-mapped meshes attached to cabin assemblies', () => {
  for (const [screen, expectedParent] of [['Screen_Cluster', 'InstrumentCluster'], ['Screen_Infotainment', 'Infotainment']]) {
    const meshNode = node(screen); assert.notEqual(meshNode.mesh, undefined);
    assert.equal(gltf.nodes[parent(index(screen))].name, expectedParent);
    const mesh = gltf.meshes[meshNode.mesh];
    for (const primitive of mesh.primitives) {
      assert.notEqual(primitive.attributes.TEXCOORD_0, undefined, `${screen} has UV0 for the live CanvasTexture`);
      assert.equal(gltf.accessors[primitive.attributes.POSITION].count, gltf.accessors[primitive.attributes.TEXCOORD_0].count);
      const materialName = gltf.materials[primitive.material].name;
      assert.match(materialName, /^Display_/);
    }
  }
  assert.notEqual(node('Screen_Cluster').mesh, node('Screen_Infotainment').mesh);
});
