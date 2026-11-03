import test from "node:test";
import assert from "node:assert/strict";
import { createEvSimulation } from "../ev-simulation-engine.js";
import { EV_SIM_DEFAULTS, EV_VEHICLE_MANIFEST } from "../ev-vehicle-data.js";

function makeSimulation() { return createEvSimulation(EV_VEHICLE_MANIFEST, EV_SIM_DEFAULTS); }
function advance(sim, seconds, chunks = 0.02) {
  const count = Math.floor(seconds / chunks);
  for (let index = 0; index < count; index += 1) sim.step(chunks);
  const remainder = seconds - count * chunks;
  if (remainder > 1e-9) sim.step(remainder);
  return sim.getState();
}
function assertElectricalCoherence(state) {
  assert.ok(Math.abs(state.powerW - state.voltageV * state.currentA) < 1e-7, "pack P equals terminal V × I");
  assert.ok(Math.abs(state.voltageV - (state.voltageOcvV - state.currentA * state.assumptions.internalResistanceOhm)) < 1e-8);
  for (const value of Object.values(state)) if (typeof value === "number") assert.ok(Number.isFinite(value));
  const deviceDraw = state.devices.reduce((sum, device) => sum + device.batteryInputW, 0);
  assert.ok(Math.abs(state.powerW - (deviceDraw - state.regenW)) < 1e-6, "devices and regeneration reconcile to terminal demand");
  assert.ok(Math.abs(state.energyBalanceErrorWh) < 1e-7, "integrated terminal energy reconciles to load and regen ledgers");
  assert.ok(Math.abs(state.grossBatteryEnergyWh - Object.values(state.deviceEnergyWh).reduce((sum, value) => sum + value, 0)) < 1e-7);
}

test("simulation begins as an independent software scenario with 5 controllable devices", () => {
  const sim = makeSimulation();
  assert.match(sim.getState().sourceLabel, /SOFTWARE SIMULATION/);
  assert.equal(sim.getState().devices.length, 5);
  assert.equal(sim.getState().powerW, 0);
  assert.equal(sim.getState().estimatedRangeKm, null);
  assert.equal(sim.getState().costInr, null);
  assert.deepEqual(sim.getState().devices.slice(1).map((device) => device.ratingW), [80, 750, 12, 35]);
});

test("auxiliary controls are independent and blank ratings cannot be enabled", () => {
  const sim = makeSimulation();
  sim.setDevicePower("headlights", null);
  assert.equal(sim.setDeviceEnabled("headlights", true), true);
  assert.equal(sim.getState().devices[1].enabled, false);
  sim.setDevicePower("headlights", 100);
  sim.setDeviceEnabled("headlights", true);
  sim.setDevicePower("airConditioning", 600);
  sim.setDeviceEnabled("airConditioning", true);
  sim.setDevicePower("cabinLights", 30);
  sim.setDeviceEnabled("cabinLights", false);
  sim.setDevicePower("infotainment", 80);
  sim.setDeviceEnabled("infotainment", false);
  sim.start();
  let state = advance(sim, 1);
  assert.deepEqual(state.devices.map((device) => device.enabled), [false, true, true, false, false]);
  assert.ok(Math.abs(state.auxiliaryOutputW - 700) < 1e-9);
  assert.ok(Math.abs(state.auxiliaryBatteryInputW - 700 / EV_SIM_DEFAULTS.dcdcEff) < 1e-8);
  assert.ok(state.deviceEnergyWh.headlights > 0);
  assert.ok(state.deviceEnergyWh.airConditioning > state.deviceEnergyWh.headlights);
  assert.equal(state.deviceEnergyWh.cabinLights, 0);
  assert.equal(state.deviceEnergyWh.infotainment, 0);
  assertElectricalCoherence(state);
});

test("traction force is torque limited at low speed", () => {
  const sim = makeSimulation();
  sim.start(); sim.setDeviceEnabled("tractionMotor", true); sim.setThrottle(1);
  const state = sim.getState();
  const torqueForceLimitN = EV_SIM_DEFAULTS.maxMotorTorqueNm * EV_SIM_DEFAULTS.gearRatio / EV_SIM_DEFAULTS.wheelRadiusM;
  assert.ok(state.tractiveForceN > 0 && state.tractiveForceN <= torqueForceLimitN + 1e-9);
});

test("at the speed cap, full throttle supplies only road-load force and consistent power", () => {
  const sim = makeSimulation();
  sim.start(); sim.setDeviceEnabled("tractionMotor", true); sim.setThrottle(1);
  const state = advance(sim, 30);
  assert.ok(Math.abs(state.speedMps - EV_SIM_DEFAULTS.maxSpeedMps) < 1e-9);
  assert.ok(Math.abs(state.tractiveForceN - state.roadLoadForceN) < 1e-8);
  const mechanicalPowerW = state.tractiveForceN * state.speedMps;
  const expectedMechanicalW = (
    0.5 * 1.225 * EV_SIM_DEFAULTS.dragCoeff * EV_SIM_DEFAULTS.frontalAreaM2 * state.speedMps ** 2
    + EV_SIM_DEFAULTS.rollingCoeff * EV_SIM_DEFAULTS.massKg * 9.81
  ) * state.speedMps;
  assert.ok(Math.abs(mechanicalPowerW - expectedMechanicalW) < 1e-6);
  assert.ok(state.powerW < 10000, "the cap does not keep requesting 18 kW mechanical output");
  assertElectricalCoherence(state);
});

test("gross draw, regen recovery, SOC, and terminal P=VI remain coherent", () => {
  const sim = makeSimulation();
  sim.start(); sim.setDeviceEnabled("tractionMotor", true); sim.setThrottle(1);
  const driven = advance(sim, 8);
  assert.ok(driven.soc < 0.72 && driven.grossBatteryEnergyWh > 0);
  assertElectricalCoherence(driven);
  sim.setThrottle(0); sim.setBraking(0.5);
  const braking = advance(sim, 1);
  assert.ok(braking.recoveredBatteryEnergyWh > driven.recoveredBatteryEnergyWh);
  assert.ok(braking.currentA < 0);
  assert.ok(braking.soc > driven.soc);
  assert.ok(Math.abs(braking.netEnergyWh - (braking.grossBatteryEnergyWh - braking.recoveredBatteryEnergyWh)) < 1e-9);
  assertElectricalCoherence(braking);
});

test("range is gated by distance and positive energy use; tariff uses INR/kWh", () => {
  const sim = makeSimulation();
  sim.start(); sim.setDevicePower("headlights", 150); sim.setDeviceEnabled("headlights", true);
  sim.setDeviceEnabled("tractionMotor", true); sim.setThrottle(0.45);
  let state = advance(sim, 1);
  assert.equal(state.estimatedRangeKm, null);
  assert.equal(state.costInr, null);
  sim.setTariff(8);
  state = advance(sim, 80);
  assert.ok(state.distanceM >= 500);
  assert.ok(state.estimatedRangeKm > 0);
  assert.ok(Math.abs(state.costInr - (state.netEnergyWh / 1000 * 8)) < 1e-8);
  assert.ok(Math.abs(state.nominalPackEnergyWh - 96 * 150) < 1e-9);
});

test("one 60 Hz-sized update and smaller updates integrate the same fixed steps", () => {
  const a = makeSimulation(), b = makeSimulation();
  for (const sim of [a, b]) { sim.start(); sim.setDeviceEnabled("tractionMotor", true); sim.setThrottle(0.55); }
  const stateA = advance(a, 10, 10);
  const stateB = advance(b, 10, 1 / 120);
  assert.ok(Math.abs(stateA.speedMps - stateB.speedMps) < 1e-9);
  assert.ok(Math.abs(stateA.distanceM - stateB.distanceM) < 1e-8);
  assert.ok(Math.abs(stateA.netEnergyWh - stateB.netEnergyWh) < 1e-8);
});

test("reset pauses, clears simulation energy and disables devices", () => {
  const sim = makeSimulation();
  sim.setDevicePower("cabinLights", 45); sim.setDeviceEnabled("cabinLights", true);
  sim.start(); advance(sim, 3); sim.reset();
  const state = sim.getState();
  assert.equal(state.running, false);
  assert.equal(state.devices[3].enabled, false);
  assert.equal(state.speedMps, 0);
  assert.equal(state.netEnergyWh, 0);
  assert.equal(state.soc, 0.72);
});

test("partial throttle at the cap uses only the road-load holding power", () => {
  const sim = makeSimulation();
  sim.start(); sim.setDeviceEnabled("tractionMotor", true); sim.setThrottle(0.8);
  const state = advance(sim, 60);
  assert.equal(state.speedMps, EV_SIM_DEFAULTS.maxSpeedMps);
  assert.ok(Math.abs(state.tractiveForceN - state.roadLoadForceN) < 1e-7);
  assert.ok(Math.abs(state.accelerationMps2) < 1e-9);
  assertElectricalCoherence(state);
  sim.setThrottle(0.1);
  assert.ok(advance(sim, 1).speedMps < EV_SIM_DEFAULTS.maxSpeedMps);
});

test("acceleration work including the speed-cap boundary equals kinetic energy on a lossless road", () => {
  const sim = createEvSimulation(EV_VEHICLE_MANIFEST, { ...EV_SIM_DEFAULTS, dragCoeff: 0, rollingCoeff: 0 });
  sim.start(); sim.setDeviceEnabled("tractionMotor", true); sim.setThrottle(1);
  const state = advance(sim, 60);
  const kineticWh = 0.5 * state.assumptions.massKg * state.speedMps ** 2 / 3600;
  assert.ok(Math.abs(state.grossBatteryEnergyWh * state.assumptions.motorEff * state.assumptions.inverterEff - kineticWh) < 1e-8);
  assert.equal(state.powerW, 0, "no continuing propulsion demand after acceleration on a lossless road");
  assertElectricalCoherence(state);
});

test("battery-limited loads reduce actual device draw and motion instead of inventing power", () => {
  const sim = createEvSimulation({ ...EV_VEHICLE_MANIFEST, pack: { nominalVoltage_V: 24, capacityAh: 150 } }, { ...EV_SIM_DEFAULTS, internalResistanceOhm: 2 });
  for (const id of ["headlights", "airConditioning", "cabinLights", "infotainment"]) {
    sim.setDevicePower(id, 10000); sim.setDeviceEnabled(id, true);
  }
  sim.start(); sim.setDeviceEnabled("tractionMotor", true); sim.setThrottle(1);
  const state = advance(sim, 10);
  assert.ok(state.batteryPowerLimited);
  assert.equal(state.speedMps, 0);
  assert.ok(state.powerW > 0 && state.powerW <= state.voltageOcvV ** 2 / (4 * state.assumptions.internalResistanceOhm));
  assert.ok(state.devices[1].demandW < state.devices[1].ratingW);
  assertElectricalCoherence(state);
});

test("depletion stops auxiliary power and energy integration while preserving the ledger", () => {
  const sim = createEvSimulation({ ...EV_VEHICLE_MANIFEST, pack: { nominalVoltage_V: 24, capacityAh: 1 } }, { ...EV_SIM_DEFAULTS, internalResistanceOhm: 0 });
  sim.setDevicePower("airConditioning", 10000); sim.setDeviceEnabled("airConditioning", true); sim.start();
  const empty = advance(sim, 30);
  assert.equal(empty.soc, 0);
  assert.equal(empty.powerW, 0);
  assert.equal(empty.devices[2].demandW, 0);
  assert.equal(empty.devices[2].operating, false);
  assert.ok(empty.grossBatteryEnergyWh > 0);
  const later = advance(sim, 30);
  assert.equal(later.grossBatteryEnergyWh, empty.grossBatteryEnergyWh);
  assertElectricalCoherence(later);
});

test("regen recovery cannot exceed actual removed kinetic energy, including the stopping step", () => {
  const sim = createEvSimulation(EV_VEHICLE_MANIFEST, { ...EV_SIM_DEFAULTS, dragCoeff: 0, rollingCoeff: 0, regenFraction: 1, maxRegenPowerW: 2000000 });
  sim.start(); sim.setDeviceEnabled("tractionMotor", true); sim.setThrottle(1);
  const driven = advance(sim, 10);
  const kineticWh = 0.5 * driven.assumptions.massKg * driven.speedMps ** 2 / 3600;
  sim.setBraking(1);
  const stopped = advance(sim, 30);
  assert.equal(stopped.speedMps, 0);
  const expectedRecovery = kineticWh * driven.assumptions.motorEff * driven.assumptions.inverterEff;
  assert.ok(Math.abs(stopped.recoveredBatteryEnergyWh - expectedRecovery) < 1e-7);
  assert.equal(stopped.regenW, 0);
  assertElectricalCoherence(stopped);
});

test("full charge rejects further regeneration without creating terminal energy", () => {
  const sim = createEvSimulation(EV_VEHICLE_MANIFEST, { ...EV_SIM_DEFAULTS, dragCoeff: 0, rollingCoeff: 0, regenFraction: 1, maxRegenPowerW: 2000000, internalResistanceOhm: 0 });
  sim.start(); sim.setDeviceEnabled("tractionMotor", true); sim.setThrottle(1); advance(sim, 20);
  // Deliberately extreme editable scenario: a small pack cannot absorb all kinetic energy.
  sim.setAssumptions({ nominalVoltageV: 24, capacityAh: 1 }); sim.setBraking(1);
  const state = advance(sim, 20);
  assert.equal(state.soc, 1);
  assert.equal(state.currentA, 0);
  assertElectricalCoherence(state);
});

test("pause freezes time and sets device demand to zero without losing selections", () => {
  const sim = makeSimulation();
  sim.setDeviceEnabled("headlights", true); sim.start(); advance(sim, 1); sim.stop();
  const before = sim.getState(), after = sim.step(20);
  assert.equal(after.simulatedSeconds, before.simulatedSeconds);
  assert.equal(after.netEnergyWh, before.netEnergyWh);
  assert.equal(after.devices[1].enabled, true);
  assert.equal(after.devices[1].demandW, 0);
  assert.equal(after.powerW, 0);
  assertElectricalCoherence(after);
});

test("invalid assumptions preserve defaults and excessive step requests fail before advancing", () => {
  const sim = createEvSimulation({ pack: { nominalVoltage_V: null, capacityAh: 0 } }, { massKg: Number.NaN, motorEff: Infinity, integrationStepS: 0 });
  assert.equal(sim.getState().assumptions.massKg, 720);
  assert.equal(sim.getState().assumptions.nominalVoltageV, 96);
  assert.equal(sim.getState().assumptions.capacityAh, 1);
  assert.equal(sim.getState().assumptions.integrationStepS, 0.001);
  sim.start();
  assert.throws(() => sim.step(1001), RangeError);
  assert.equal(sim.getState().simulatedSeconds, 0);
  sim.setAssumptions({ massKg: "", motorEff: -1 });
  assert.equal(sim.getState().assumptions.massKg, 720);
  assert.equal(sim.getState().assumptions.motorEff, 0.01);
  assertElectricalCoherence(sim.getState());
});

test("high rolling resistance plus a battery-saturating auxiliary cannot produce phantom traction work", () => {
  const sim = createEvSimulation(EV_VEHICLE_MANIFEST, { ...EV_SIM_DEFAULTS, rollingCoeff: 0.2, internalResistanceOhm: 2, integrationStepS: 0.1, maxMotorPowerW: 2000000, gearRatio: 40, maxMotorTorqueNm: 5000 });
  sim.start(); sim.setDeviceEnabled("tractionMotor", true); sim.setThrottle(0.6); advance(sim, 2, 0.1);
  sim.setDevicePower("airConditioning", 10000); sim.setDeviceEnabled("airConditioning", true);
  for (let index = 0; index < 30; index++) assertElectricalCoherence(sim.step(0.1));
  assert.equal(sim.getState().speedMps, 0);
  assert.equal(sim.getState().tractionPowerW, 0);
});

test("device kWh, usable-battery percentages and tariff costs reconcile for all five devices", () => {
  const sim = makeSimulation();
  for (const id of ['tractionMotor', 'headlights', 'airConditioning', 'cabinLights', 'infotainment']) sim.setDeviceEnabled(id, true);
  sim.setThrottle(.4); sim.setTariff(8); sim.start();
  const state = advance(sim, 60);
  assert.equal(state.nominalPackEnergyWh, 14400);
  assert.equal(state.usablePackEnergyWh, 12960);
  assert.equal(state.usableCapacityVerified, false);
  assert.match(state.usableCapacityBasis, /assumption.*not verified/);
  for (const device of state.devices) {
    assert.ok(device.energyKwh > 0, device.id);
    assert.equal(device.energyKwh, device.energyWh / 1000);
    assert.ok(Math.abs(device.batteryPercentConsumed - device.energyKwh / 12.96 * 100) < 1e-12);
    assert.equal(device.costInr, device.energyKwh * 8);
  }
  assert.equal(state.totalDeviceEnergyKwh, state.devices.reduce((sum, device) => sum + device.energyKwh, 0));
  assert.equal(state.totalDeviceBatteryPercent, state.devices.reduce((sum, device) => sum + device.batteryPercentConsumed, 0));
  assert.equal(state.totalDeviceCostInr, state.devices.reduce((sum, device) => sum + device.costInr, 0));
  const energy = state.deviceEnergyWh;
  sim.stop(); sim.setTariff(16);
  const repriced = sim.getState();
  assert.deepEqual(repriced.deviceEnergyWh, energy);
  assert.equal(repriced.totalDeviceCostInr, state.totalDeviceCostInr * 2);
  sim.setTariff('');
  assert.equal(sim.getState().totalDeviceCostInr, null);
  assert.ok(sim.getState().devices.every(device => device.costInr === null));
  sim.setTariff(0);
  assert.equal(sim.getState().totalDeviceCostInr, 0);
});

test("switching each device OFF stops its accumulation and retains its previous consumption", () => {
  const sim = makeSimulation();
  for (const id of ['tractionMotor', 'headlights', 'airConditioning', 'cabinLights', 'infotainment']) sim.setDeviceEnabled(id, true);
  sim.setThrottle(.4); sim.start(); advance(sim, 10);
  for (const device of sim.getState().devices) {
    const before = sim.getState().deviceEnergyWh[device.id];
    assert.ok(before > 0);
    sim.setDeviceEnabled(device.id, false); const after = advance(sim, 2);
    assert.equal(after.deviceEnergyWh[device.id], before, device.id);
    assert.equal(after.devices.find(d => d.id === device.id).demandW, 0);
  }
  const allOff = sim.getState();
  assert.ok(allOff.totalDeviceEnergyKwh > 0);
  assert.equal(advance(sim, 10).totalDeviceEnergyKwh, allOff.totalDeviceEnergyKwh);
  assertElectricalCoherence(sim.getState());
});

test("trip-energy reset keeps motion, SOC and switches, resets range observation, then integrates new consumption", () => {
  const sim = makeSimulation();
  sim.setDeviceEnabled('tractionMotor', true); sim.setDeviceEnabled('airConditioning', true);
  sim.setThrottle(.45); sim.setTariff(8); sim.start();
  const before = advance(sim, 80);
  assert.ok(before.estimatedRangeKm > 0);
  sim.resetTripEnergy(); const reset = sim.getState();
  for (const key of ['running', 'speedMps', 'distanceM', 'simulatedSeconds', 'soc', 'throttle', 'tariffInrPerKwh']) assert.equal(reset[key], before[key], key);
  assert.deepEqual(reset.devices.map(d => d.enabled), before.devices.map(d => d.enabled));
  for (const key of ['grossBatteryEnergyWh', 'netEnergyWh', 'recoveredBatteryEnergyWh', 'terminalEnergyWh', 'batteryInternalLossWh', 'totalDeviceEnergyKwh', 'totalDeviceBatteryPercent', 'totalDeviceCostInr', 'tripDistanceM', 'tripSeconds']) assert.equal(reset[key], 0, key);
  assert.equal(reset.estimatedRangeKm, null);
  assert.equal(reset.rangeObservation, false);
  assert.ok(reset.devices.every(device => device.energyWh === 0 && device.costInr === 0));
  const resumed = advance(sim, 1);
  assert.ok(resumed.totalDeviceEnergyKwh > 0);
  assert.ok(resumed.tripDistanceM > 0 && resumed.tripDistanceM < 100);
  assert.equal(resumed.estimatedRangeKm, null);
  assertElectricalCoherence(resumed);
});
