import test from 'node:test';
import assert from 'node:assert/strict';
import { displayReadings, createVehicleDisplays } from '../vehicle-displays.js';
import * as THREE from 'three';
import { createEvSimulation } from '../ev-simulation-engine.js';
import { EV_VEHICLE_MANIFEST, EV_SIM_DEFAULTS } from '../ev-vehicle-data.js';

test('in-car display values come from the same simulation snapshot and device ledgers', () => {
  const sim = createEvSimulation(EV_VEHICLE_MANIFEST, EV_SIM_DEFAULTS);
  sim.setDeviceEnabled('tractionMotor', true); sim.setThrottle(.18);
  for (const id of ['headlights', 'airConditioning', 'cabinLights', 'infotainment']) sim.setDeviceEnabled(id, true);
  sim.start(); sim.step(2);
  const source = sim.getState(), display = displayReadings(source);
  for (const key of ['running', 'speedKmh', 'socPercent', 'powerW', 'voltageV', 'currentA', 'netEnergyWh']) assert.equal(display[key], source[key]);
  assert.equal(display.devices.length, 5);
  for (const device of display.devices) {
    const expected = source.devices.find(item => item.id === device.id);
    assert.equal(device.status, 'ON'); assert.equal(device.operating, true);
    for (const key of ['enabled', 'demandW', 'batteryInputW', 'energyWh', 'energyKwh', 'batteryPercentConsumed', 'costInr']) assert.equal(device[key], expected[key]);
  }
  assert.ok(Math.abs(source.powerW - (source.devices.reduce((sum, d) => sum + d.batteryInputW, 0) - source.regenW)) < 1e-8);
});

test('the actual infotainment texture draws only the requested energy columns for all five devices, even when OFF', () => {
  const sim = createEvSimulation(EV_VEHICLE_MANIFEST, EV_SIM_DEFAULTS);
  sim.setTariff(8); sim.setDeviceEnabled('headlights', true); sim.start(); sim.step(60);
  sim.setDeviceEnabled('headlights', false);
  const labels=[];
  const context={fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){},fillText(value){labels.push(value);}};
  const previousDocument=globalThis.document;
  globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context})};
  const model=new THREE.Group(), mesh=new THREE.Mesh(new THREE.PlaneGeometry(.28,.175),new THREE.MeshBasicMaterial());
  mesh.name='Screen_Infotainment';model.add(mesh);
  const displays=createVehicleDisplays(model);
  try {
    displays.update(sim.getState(),0);
    assert.equal(mesh.material.name,'Screen_Infotainment_Live');
    assert.ok(mesh.material.map?.isCanvasTexture);
    for(const label of ['Traction motor','Headlights','Air conditioning','Cabin lights','Infotainment','TOTAL','Electricity (kWh)','Battery used (%)','Cost (₹)']) assert.ok(labels.includes(label),label);
    assert.ok(labels.includes('AERIS  /  RETAINED ENERGY VIEW'));
    assert.ok(labels.includes((sim.getState().devices[1].energyKwh).toFixed(6)));
    assert.ok(labels.includes((sim.getState().devices[1].costInr).toFixed(4)));
    assert.doesNotMatch(labels.join('\n'), /voltage|current|\bwatts?\b|\bRPM\b|frequency|\b[\d.]+ W\b|\b[\d.]+ Wh\b|pack power/i);
    const originalCost=sim.getState().devices[1].costInr;
    labels.length=0;sim.setTariff(16);displays.update(sim.getState(),1);
    assert.ok(labels.includes((originalCost*2).toFixed(4)), 'tariff redraw bypasses periodic refresh limit');
    assert.equal(displays.snapshot().readings.devices[1].status,'OFF');
    assert.equal(displays.snapshot().readings.energy.totalCostInr,sim.getState().totalDeviceCostInr);
  } finally {
    displays.dispose();mesh.geometry.dispose();globalThis.document=previousDocument;
  }
});

test('in-car display distinguishes OFF, PAUSED and NO POWER without invented load readings', () => {
  const sim = createEvSimulation(EV_VEHICLE_MANIFEST, EV_SIM_DEFAULTS);
  sim.setDeviceEnabled('headlights', true);
  let display = displayReadings(sim.getState());
  assert.equal(display.devices.find(d => d.id === 'headlights').status, 'PAUSED');
  assert.equal(display.devices.find(d => d.id === 'headlights').demandW, 0);
  assert.equal(display.devices.find(d => d.id === 'infotainment').status, 'OFF');
  sim.setDevicePower('headlights', 0); sim.start();
  display = displayReadings(sim.getState());
  assert.equal(display.devices.find(d => d.id === 'headlights').status, 'NO POWER');
  assert.equal(display.devices.find(d => d.id === 'headlights').operating, false);
});

test('display projection does not mutate the source state or expose mutable device objects', () => {
  const sim = createEvSimulation(EV_VEHICLE_MANIFEST, EV_SIM_DEFAULTS);
  const state = sim.getState(), copy = JSON.stringify(state), display = displayReadings(state);
  display.devices[0].energyWh = 12345; display.speedKmh = 99;
  assert.equal(JSON.stringify(state), copy);
  assert.equal(sim.getState().speedKmh, 0);
});
