import test from "node:test";
import assert from "node:assert/strict";
import { createEvSimulation } from "../ev-simulation-engine.js";
import { EV_SIM_DEFAULTS, EV_VEHICLE_MANIFEST, EV_DRIVING_SCENARIOS } from "../ev-vehicle-data.js";
import { drivetrainKinematics } from "../drivetrain-kinematics.js";

const approx = (actual, expected, tol = 1e-8, label = "") =>
  assert.ok(Math.abs(actual - expected) <= tol, `${label}: actual=${actual}, expected=${expected}, tol=${tol}`);

test("rotational inertia increases effective mass and conserves translational + rotational kinetic energy", () => {
  const inertia = 2.4; // kg*m^2
  const sim = createEvSimulation(EV_VEHICLE_MANIFEST, {
    ...EV_SIM_DEFAULTS,
    dragCoeff: 0,
    rollingCoeff: 0,
    roadGradePercent: 0,
    rotationalInertiaKgM2: inertia,
  });
  sim.start();
  sim.setDeviceEnabled("tractionMotor", true);
  sim.setThrottle(0.8);
  sim.step(12);
  const s = sim.getState();
  const expectedEffMass = s.assumptions.massKg + inertia / (s.assumptions.wheelRadiusM ** 2);
  approx(s.effectiveMassKg, expectedEffMass, 1e-10, "effectiveMassKg");
  approx(
    s.translationalKineticEnergyWh,
    0.5 * s.assumptions.massKg * s.speedMps ** 2 / 3600,
    1e-12,
    "translational kinetic energy"
  );
  approx(
    s.rotationalKineticEnergyWh,
    0.5 * inertia * s.wheelAngularVelocityRadS ** 2 / 3600,
    1e-12,
    "rotational kinetic energy"
  );
  approx(
    s.kineticEnergyWh,
    s.translationalKineticEnergyWh + s.rotationalKineticEnergyWh,
    1e-12,
    "total kinetic energy"
  );
  approx(s.mechanicalDriveEnergyWh, s.kineticEnergyWh, 1e-10, "lossless road work equals total kinetic energy");
  approx(s.mechanicalEnergyBalanceErrorWh, 0, 1e-10, "mechanical energy conservation residual");
});

test("torque, angular velocity, gear ratio, differential split and mechanical power agree", () => {
  const sim = createEvSimulation(EV_VEHICLE_MANIFEST, {
    ...EV_SIM_DEFAULTS,
    rotationalInertiaKgM2: 1.8,
  });
  sim.start();
  sim.setDeviceEnabled("tractionMotor", true);
  sim.setThrottle(0.6);
  sim.step(5);
  const s = sim.getState();
  const kin = drivetrainKinematics(s);

  approx(s.wheelAngularVelocityRadS, s.speedMps / s.assumptions.wheelRadiusM, 1e-12, "wheel omega = v / r");
  approx(s.motorAngularVelocityRadS, s.wheelAngularVelocityRadS * s.assumptions.gearRatio, 1e-12, "motor omega = G * wheel omega");
  approx(s.wheelTorqueNm, s.tractiveForceN * s.assumptions.wheelRadiusM, 1e-10, "wheel torque = F * r");
  approx(s.motorTorqueNm * s.assumptions.gearRatio, s.wheelTorqueNm, 1e-10, "motor torque * G = wheel torque");
  approx(s.leftAxleTorqueNm + s.rightAxleTorqueNm, s.wheelTorqueNm, 1e-12, "differential 50/50 torque split sum");
  approx(kin.differential.leftAxleTorqueNm, kin.differential.rightAxleTorqueNm, 1e-12, "straight-line equal axle torque");
  // Instantaneous mechanical power F * v == tau_wheel * omega_wheel == tau_motor * omega_motor
  const pForceV = s.tractiveForceN * s.speedMps;
  const pWheelTorqueOmega = s.wheelTorqueNm * s.wheelAngularVelocityRadS;
  const pMotorTorqueOmega = s.motorTorqueNm * s.motorAngularVelocityRadS;
  approx(pForceV, pWheelTorqueOmega, 1e-8, "F * v == tau_wheel * omega_wheel");
  approx(pForceV, pMotorTorqueOmega, 1e-8, "F * v == tau_motor * omega_motor");
});

test("downhill operation accelerates under gravity and recovers bounded regenerative energy with exact energy balance", () => {
  const sim = createEvSimulation(EV_VEHICLE_MANIFEST, {
    ...EV_SIM_DEFAULTS,
    roadGradePercent: -6, // 6% downhill grade
    rotationalInertiaKgM2: 1.8,
  });
  sim.start();
  // Coast downhill for 15 seconds with zero throttle and zero braking
  sim.step(15);
  const coasting = sim.getState();
  assert.ok(coasting.speedMps > 5, "gravity accelerates vehicle downhill from rest when |F_gravity| > F_roll");
  assert.ok(coasting.elevationChangeM < 0, "downhill travel reduces elevation");
  assert.ok(coasting.potentialEnergyChangeWh < 0, "downhill travel releases gravitational potential energy");
  approx(coasting.mechanicalEnergyBalanceErrorWh, 0, 1e-10, "coasting downhill mechanical work-energy balance");

  // Apply 45% regenerative braking on the downhill slope for 20 seconds
  sim.setBraking(0.45);
  sim.step(20);
  const regenState = sim.getState();
  assert.ok(regenState.recoveredBatteryEnergyWh > 0, "downhill braking recovers regenerative energy");
  assert.ok(regenState.brakingDissipatedEnergyWh > 0, "unrecovered braking work is tracked as dissipated energy");
  approx(
    regenState.recoveredBatteryEnergyWh + regenState.brakingDissipatedEnergyWh,
    regenState.brakingMechanicalEnergyWh,
    1e-10,
    "braking mechanical work = recovered electrical energy + dissipated friction/conversion energy"
  );
  const maxTheoreticalRegen = regenState.brakingMechanicalEnergyWh * regenState.assumptions.regenFraction * regenState.assumptions.motorEff * regenState.assumptions.inverterEff;
  assert.ok(regenState.recoveredBatteryEnergyWh <= maxTheoreticalRegen + 1e-10, "regen cannot exceed physical efficiency bound");
  approx(regenState.mechanicalEnergyBalanceErrorWh, 0, 1e-10, "downhill braking mechanical work-energy balance");
  approx(regenState.energyBalanceErrorWh, 0, 1e-10, "downhill braking electrical energy balance");
});

test("uphill gradient increases road load and prevents unphysical backward rollback at rest", () => {
  const sim = createEvSimulation(EV_VEHICLE_MANIFEST, {
    ...EV_SIM_DEFAULTS,
    roadGradePercent: 8, // +8% uphill
    rotationalInertiaKgM2: 1.8,
  });
  sim.start();
  // At zero throttle on an uphill slope, anti-rollback holds speed at 0 without phantom energy
  sim.step(5);
  let s = sim.getState();
  assert.equal(s.speedMps, 0);
  assert.equal(s.distanceM, 0);
  assert.equal(s.kineticEnergyWh, 0);
  approx(s.mechanicalEnergyBalanceErrorWh, 0, 1e-12, "stationary uphill hold balance");

  // Apply 80% throttle to climb the hill
  sim.setDeviceEnabled("tractionMotor", true);
  sim.setThrottle(0.8);
  sim.step(20);
  s = sim.getState();
  assert.ok(s.speedMps > 0 && s.elevationChangeM > 0 && s.potentialEnergyChangeWh > 0);
  approx(
    s.potentialEnergyChangeWh,
    s.assumptions.massKg * 9.81 * s.elevationChangeM / 3600,
    1e-10,
    "gravitational potential energy m*g*dh"
  );
  approx(s.mechanicalEnergyBalanceErrorWh, 0, 1e-10, "uphill climb mechanical work-energy balance");
});

test("all five canonical driving scenarios execute with zero mechanical or electrical energy conservation error", () => {
  for (const key of ["acceleration", "cruising", "braking", "downhill", "auxiliary"]) {
    const preset = EV_DRIVING_SCENARIOS[key];
    const sim = createEvSimulation(EV_VEHICLE_MANIFEST, {
      ...EV_SIM_DEFAULTS,
      ...(preset.assumptions || {}),
    });
    sim.setTariff(8.5);
    sim.start();
    if (key === "braking") {
      // Accelerate first so braking scenario has initial kinetic energy to dissipate and recover
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
    const finalState = sim.step(30);
    approx(finalState.mechanicalEnergyBalanceErrorWh, 0, 1e-9, `${key} mechanical energy conservation`);
    approx(finalState.energyBalanceErrorWh, 0, 1e-9, `${key} electrical energy conservation`);
    approx(
      finalState.mechanicalDriveEnergyWh + finalState.drivetrainLossEnergyWh,
      finalState.deviceEnergyWh.tractionMotor,
      1e-9,
      `${key} traction input equals wheel work + drivetrain loss`
    );
  }
});
