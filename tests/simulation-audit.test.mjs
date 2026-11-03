import test from 'node:test';
import assert from 'node:assert/strict';
import { createEvSimulation } from '../ev-simulation-engine.js';

const manifest = {
  pack: { nominalVoltage_V: 96, capacityAh: 150 },
  auxiliaryPowerW: { headlights: 500, airConditioning: 750, cabinLights: 12, infotainment: 35 },
};
const close = (actual, expected, tolerance, message) => assert.ok(Math.abs(actual - expected) <= tolerance,
  `${message}: actual=${actual}, expected=${expected}, tolerance=${tolerance}`);
function loadSimulation(overrides = {}) {
  const sim = createEvSimulation(manifest, { dcdcEff: 0.8, ...overrides });
  sim.setDeviceEnabled('headlights', true); sim.start();
  return sim;
}
// Independent antiderivative of the documented OCV(SOC) curve. Multiplying by
// charge capacity converts the integral over SOC into chemical energy in Wh.
function chemicalEnergyRemovedWh(initialSoc, finalSoc, capacityAh, nominalV) {
  const primitive = soc => soc + (13 / 96) / 3.5 * Math.log(Math.cosh(3.5 * (soc - 0.5)));
  return capacityAh * nominalV * (primitive(initialSoc) - primitive(finalSoc));
}

test('substep ON time belongs to the old state when a switch turns OFF', () => {
  const sim = loadSimulation();
  sim.step(0.01); sim.setDeviceEnabled('headlights', false); sim.step(0.01); sim.stop();
  const state = sim.getState();
  close(state.simulatedSeconds, 0.02, 1e-14, 'elapsed time');
  close(state.deviceEnergyWh.headlights, 500 / 0.8 * 0.01 / 3600, 1e-14, 'only the ON interval is billed');
  close(state.grossBatteryEnergyWh, state.deviceEnergyWh.headlights, 1e-14, 'load ledger');
});

test('piecewise power and efficiency edits preserve elapsed energy under the preceding settings', () => {
  const sim = loadSimulation();
  sim.step(0.007); sim.setDevicePower('headlights', 250);
  sim.step(0.006); sim.setAssumptions({ dcdcEff: 0.5 });
  sim.step(0.008); sim.stop();
  const expectedWh = (500 / 0.8 * 0.007 + 250 / 0.8 * 0.006 + 250 / 0.5 * 0.008) / 3600;
  close(sim.getState().deviceEnergyWh.headlights, expectedWh, 1e-14, 'piecewise analytic power integral');
  close(sim.getState().simulatedSeconds, 0.021, 1e-14, 'elapsed time across assumption change');
});

test('pause includes the last elapsed fraction and resume does not replay it', () => {
  const sim = loadSimulation();
  sim.step(0.013); sim.stop();
  const paused = sim.getState();
  close(paused.netEnergyWh, 625 * 0.013 / 3600, 1e-14, 'energy at pause');
  sim.step(100); assert.equal(sim.getState().netEnergyWh, paused.netEnergyWh);
  sim.start(); sim.step(0.007); sim.stop();
  close(sim.getState().netEnergyWh, 625 * 0.02 / 3600, 1e-14, 'no duplicated fraction on resume');
});

test('trip reset settles pre-reset elapsed time before establishing a new ledger', () => {
  const sim = loadSimulation();
  sim.step(0.011); sim.resetTripEnergy();
  const reset = sim.getState();
  assert.equal(reset.netEnergyWh, 0); assert.equal(reset.tripSeconds, 0);
  close(reset.simulatedSeconds, 0.011, 1e-14, 'pre-reset elapsed time');
  assert.ok(reset.soc < 0.72, 'pre-reset charge removal is retained');
  sim.step(0.009); sim.stop();
  close(sim.getState().netEnergyWh, 625 * 0.009 / 3600, 1e-14, 'only post-reset energy');
  close(sim.getState().tripSeconds, 0.009, 1e-14, 'only post-reset time');
});

test('large exact-duration calls cannot defer one full step through repeated-subtraction roundoff', () => {
  for (const dt of [0.1, 0.02, 0.001]) {
    const seconds = dt === 0.001 ? 120 : 1200;
    const sim = loadSimulation({ integrationStepS: dt });
    sim.step(seconds);
    close(sim.getState().simulatedSeconds, seconds, 2e-8, `full elapsed time for dt=${dt}`);
    close(sim.getState().netEnergyWh, 625 * seconds / 3600, 2e-8, `constant-load integral for dt=${dt}`);
  }
});

test('fractional scheduling preserves a real remainder and partitioned constant-load duration', () => {
  const a = loadSimulation({ integrationStepS: 0.1 }), b = loadSimulation({ integrationStepS: 0.1 });
  a.step(1.05);
  close(a.getState().simulatedSeconds, 1, 1e-14, 'unsettled fraction is not rounded into a step');
  for (let index = 0; index < 105; index++) b.step(0.01);
  a.stop(); b.stop();
  for (const sim of [a, b]) {
    close(sim.getState().simulatedSeconds, 1.05, 1e-13, 'settled time');
    close(sim.getState().netEnergyWh, 625 * 1.05 / 3600, 1e-12, 'settled power integral');
  }
});

test('terminal energy plus internal heat converges to independent integrated chemical energy', () => {
  const errors = [];
  for (const dt of [0.1, 0.02, 0.004]) {
    const sim = loadSimulation({ integrationStepS: dt });
    sim.step(1200);
    const state = sim.getState();
    const chemicalWh = chemicalEnergyRemovedWh(0.72, state.soc, 150, 96);
    const electricalAndHeatWh = state.terminalEnergyWh + state.batteryInternalLossWh;
    const errorWh = Math.abs(chemicalWh - electricalAndHeatWh);
    errors.push(errorWh);
    close(state.terminalEnergyWh, 625 * 1200 / 3600, 2e-8, 'independent constant-load energy');
    assert.ok(state.batteryInternalLossWh > 0, 'I²R loss is positive');
    assert.ok(errorWh < dt * 0.008, `chemical/terminal/heat residual ${errorWh} Wh for dt=${dt}`);
  }
  assert.ok(errors[1] < errors[0] * 0.23, `finer integration improves residual: ${errors}`);
  assert.ok(errors[2] < errors[1] * 0.23, `finer integration improves residual: ${errors}`);
});

test('finite tariff overflow is withheld and recovers when a representable tariff is entered', () => {
  const sim = loadSimulation();
  sim.setDevicePower('headlights', 10000); sim.step(600);
  sim.setTariff(Number.MAX_VALUE);
  let state = sim.getState();
  assert.equal(state.costCalculationStatus, 'numeric-overflow');
  assert.equal(state.totalDeviceCostInr, null); assert.equal(state.costInr, null);
  assert.equal(state.devices.find(device => device.id === 'headlights').costInr, null);
  sim.setTariff(8); state = sim.getState();
  assert.equal(state.costCalculationStatus, 'available');
  close(state.totalDeviceCostInr, state.totalDeviceEnergyKwh * 8, 1e-12, 'recalculated cost');
});

test('an excessive step request leaves both integrated and pending state unchanged', () => {
  const sim = loadSimulation({ integrationStepS: 0.001 });
  sim.step(0.0005);
  assert.throws(() => sim.step(1001), RangeError);
  assert.equal(sim.getState().simulatedSeconds, 0);
  sim.stop();
  close(sim.getState().netEnergyWh, 625 * 0.0005 / 3600, 1e-14, 'pending state survives rejected call');
});
