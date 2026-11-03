import { writeFile } from "node:fs/promises";
import { createEvSimulation } from "../ev-simulation-engine.js";
import { EV_SIM_DEFAULTS, EV_VEHICLE_MANIFEST, EV_DRIVING_SCENARIOS } from "../ev-vehicle-data.js";

const round = (v, d = 6) => (typeof v === "number" && Number.isFinite(v) ? Number(v.toFixed(d)) : v);

const results = [];
for (const key of ["acceleration", "cruising", "braking", "downhill", "auxiliary"]) {
  const preset = EV_DRIVING_SCENARIOS[key];
  const sim = createEvSimulation(EV_VEHICLE_MANIFEST, {
    ...EV_SIM_DEFAULTS,
    ...(preset.assumptions || {}),
  });
  sim.setTariff(8.5);
  sim.start();
  if (key === "braking") {
    sim.setDeviceEnabled("tractionMotor", true);
    sim.setThrottle(0.9);
    sim.step(12);
  }
  sim.setDeviceEnabled("tractionMotor", Boolean(preset.tractionEnabled));
  sim.setThrottle(preset.throttle ?? 0);
  sim.setBraking(preset.braking ?? 0);
  for (const [auxId, on] of Object.entries(preset.auxiliaries || {})) {
    sim.setDeviceEnabled(auxId, on);
  }
  const s = sim.step(30);
  results.push({
    scenario: key,
    label: preset.label,
    description: preset.description,
    durationS: round(s.simulatedSeconds, 2),
    roadGradePercent: s.assumptions.roadGradePercent,
    rotationalInertiaKgM2: s.assumptions.rotationalInertiaKgM2,
    effectiveMassKg: round(s.effectiveMassKg, 3),
    finalSpeedMps: round(s.speedMps, 4),
    finalSpeedKmh: round(s.speedKmh, 3),
    distanceM: round(s.distanceM, 3),
    elevationChangeM: round(s.elevationChangeM, 3),
    wheelAngularVelocityRadS: round(s.wheelAngularVelocityRadS, 4),
    motorAngularVelocityRadS: round(s.motorAngularVelocityRadS, 4),
    wheelTorqueNm: round(s.wheelTorqueNm, 4),
    motorTorqueNm: round(s.motorTorqueNm, 4),
    finalSocPercent: round(s.socPercent, 4),
    grossBatteryEnergyWh: round(s.grossBatteryEnergyWh, 6),
    recoveredBatteryEnergyWh: round(s.recoveredBatteryEnergyWh, 6),
    netEnergyWh: round(s.netEnergyWh, 6),
    mechanicalDriveEnergyWh: round(s.mechanicalDriveEnergyWh, 6),
    drivetrainLossEnergyWh: round(s.drivetrainLossEnergyWh, 6),
    aerodynamicLossEnergyWh: round(s.aerodynamicLossEnergyWh, 6),
    rollingLossEnergyWh: round(s.rollingLossEnergyWh, 6),
    potentialEnergyChangeWh: round(s.potentialEnergyChangeWh, 6),
    brakingMechanicalEnergyWh: round(s.brakingMechanicalEnergyWh, 6),
    brakingDissipatedEnergyWh: round(s.brakingDissipatedEnergyWh, 6),
    kineticEnergyWh: round(s.kineticEnergyWh, 6),
    mechanicalEnergyBalanceErrorWh: Number(s.mechanicalEnergyBalanceErrorWh.toExponential(4)),
    electricalEnergyBalanceErrorWh: Number(s.energyBalanceErrorWh.toExponential(4)),
    totalDeviceEnergyKwh: round(s.totalDeviceEnergyKwh, 6),
    totalDeviceBatteryPercent: round(s.totalDeviceBatteryPercent, 5),
    totalDeviceCostInr: round(s.totalDeviceCostInr, 4),
  });
}

const report = {
  date: "2026-11-03",
  tariffInrPerKwh: 8.5,
  usablePackEnergyWhAssumption: 12960,
  scenarios: results,
};

await writeFile("validation/driving-scenarios-validation.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
