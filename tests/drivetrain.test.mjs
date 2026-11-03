import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { drivetrainKinematics } from '../drivetrain-kinematics.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} equals ${b}`);
test('one wheel circumference turns wheels once, and two external reductions preserve output direction',()=>{
  const pose=drivetrainKinematics({distanceM:2*Math.PI*.31,speedMps:2*Math.PI*.31,assumptions:{wheelRadiusM:.31,gearRatio:8.2}});
  near(pose.wheelAngle,2*Math.PI);near(pose.wheelRpm,60);near(pose.motorRpm,492);
  near(pose.rotations.MotorRotor/pose.rotations.GearIntermediate,-41/15);
  near(pose.rotations.GearIntermediate/pose.rotations.Differential,-60/20);
  near(pose.rotations.DriveShaft_L,pose.rotations.DriveShaft_R);
});
test('stopping preserves integrated mechanical position with zero rpm',()=>{
  const pose=drivetrainKinematics({distanceM:100,speedMps:0,assumptions:{wheelRadiusM:.31,gearRatio:8.2}});
  near(pose.wheelRpm,0);near(pose.motorRpm,0);near(pose.wheelAngle,100/.31);
});
test('export contains separately pivoted moving parts and stationary brake calipers',()=>{
  const buffer=readFileSync(new URL('../assets/vehicle/ev-ems-gt-phase2.glb',import.meta.url));
  assert.equal(buffer.toString('ascii',0,4),'glTF');
  const gltf=JSON.parse(buffer.toString('utf8',20,20+buffer.readUInt32LE(12)));
  const names=gltf.nodes.map(n=>n.name);
  for(const name of ['MotorRotor','MotorStator','GearIntermediate','Differential','DriveShaft_L','DriveShaft_R'])assert.ok(names.includes(name),name);
  for(const name of ['Wheel_FL','Wheel_FR','Wheel_RL','Wheel_RR']) {
    const node=gltf.nodes.find(n=>n.name===name);assert.ok(node.translation?.length===3);
    const children=node.children.map(i=>gltf.nodes[i].name);
    const suffix=name.slice(-2),disc=gltf.nodes.find(n=>n.name==='BrakeDisc_'+suffix);
    assert.ok(disc?.children?.length,`${name} has a separately movable rotating brake disc`);
    assert.deepEqual(disc.translation,node.translation,`${name} and its brake disc share the local axle pivot`);
    assert.ok(children.every(n=>!/caliper|spring|damper|BrakeDisc/i.test(n)),`${name} excludes independently movable brake and suspension groups`);
  }
});
