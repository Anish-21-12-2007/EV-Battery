"use strict";

const AUX_DEVICE_IDS = ["headlights", "airConditioning", "cabinLights", "infotainment"];
const GRAVITY_MPS2 = 9.81;
const AIR_DENSITY_KG_M3 = 1.225;

function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
function finiteOr(value, fallback) { return value !== null && value !== "" && Number.isFinite(Number(value)) ? Number(value) : fallback; }

export function createEvSimulation(manifest, suppliedDefaults = {}) {
  const defaults = {
    massKg: 720, wheelRadiusM: 0.31, gearRatio: 8.2,
    maxMotorTorqueNm: 180, maxMotorPowerW: 18000, maxSpeedMps: 22,
    maxBrakingDecelMps2: 3, integrationStepS: 0.02,
    regenFraction: 0.28, maxRegenPowerW: 10000,
    dragCoeff: 0.34, frontalAreaM2: 1.9, rollingCoeff: 0.012,
    roadGradePercent: 0, rotationalInertiaKgM2: 0,
    motorEff: 0.9, inverterEff: 0.93, dcdcEff: 0.88,
    internalResistanceOhm: 0.035, reserveSoc: 0.1,
    rangeMinimumDistanceM: 500,
  };
  const pack = {
    nominalVoltageV: clamp(finiteOr(manifest?.pack?.nominalVoltage_V, 96), 24, 800),
    capacityAh: clamp(finiteOr(manifest?.pack?.capacityAh, 150), 1, 1000),
  };
  const deviceNames = {
    tractionMotor: "Traction motor",
    headlights: "Headlights",
    airConditioning: "Air conditioning",
    cabinLights: "Cabin lights",
    infotainment: "Infotainment system",
  };
  let running = false, tractionEnabled = false, throttle = 0, braking = 0, soc = 0.72;
  let speedMps = 0, distanceM = 0, elevationChangeM = 0, simulatedSeconds = 0, pendingSeconds = 0;
  let energyTripStartDistanceM = 0, energyTripStartSeconds = 0, tripStartKineticEnergyWh = 0;
  let grossBatteryEnergyWh = 0, recoveredBatteryEnergyWh = 0, rangeObservation = false, tariffInrPerKwh = null;
  let terminalEnergyWh = 0, batteryInternalLossWh = 0;
  let mechanicalDriveEnergyWh = 0, drivetrainLossEnergyWh = 0, aerodynamicLossEnergyWh = 0;
  let rollingLossEnergyWh = 0, potentialEnergyChangeWh = 0, brakingMechanicalEnergyWh = 0, brakingDissipatedEnergyWh = 0;

  const devicePowerW = Object.fromEntries(AUX_DEVICE_IDS.map((id) => {
    const value = manifest?.auxiliaryPowerW?.[id];
    return [id, typeof value === "number" && Number.isFinite(value) && value >= 0 ? clamp(value, 0, 10000) : null];
  }));
  const deviceEnabled = Object.fromEntries(AUX_DEVICE_IDS.map((id) => [id, false]));
  const deviceEnergyWh = Object.fromEntries(["tractionMotor", ...AUX_DEVICE_IDS].map((id) => [id, 0]));
  const listeners = new Set();

  function validateAssumptions(values = {}) {
    const next = { ...defaults };
    for (const [key, raw] of Object.entries(values)) {
      if (!(key in next)) continue;
      const value = finiteOr(raw, next[key]);
      if (Number.isFinite(value)) next[key] = value;
    }
    next.massKg = clamp(next.massKg, 1, 20000); next.wheelRadiusM = clamp(next.wheelRadiusM, 0.05, 2);
    next.gearRatio = clamp(next.gearRatio, 1, 40); next.maxMotorTorqueNm = clamp(next.maxMotorTorqueNm, 0, 5000);
    next.maxMotorPowerW = clamp(next.maxMotorPowerW, 0, 2000000); next.maxSpeedMps = clamp(next.maxSpeedMps, 0.1, 150);
    next.maxBrakingDecelMps2 = clamp(next.maxBrakingDecelMps2, 0, 12); next.integrationStepS = clamp(next.integrationStepS, 0.001, 0.1);
    next.regenFraction = clamp(next.regenFraction, 0, 1); next.maxRegenPowerW = clamp(next.maxRegenPowerW, 0, 2000000);
    next.dragCoeff = clamp(next.dragCoeff, 0, 2); next.frontalAreaM2 = clamp(next.frontalAreaM2, 0.1, 20);
    next.rollingCoeff = clamp(next.rollingCoeff, 0, 0.2);
    next.roadGradePercent = clamp(next.roadGradePercent, -25, 25);
    next.rotationalInertiaKgM2 = clamp(next.rotationalInertiaKgM2, 0, 50);
    next.motorEff = clamp(next.motorEff, 0.01, 1);
    next.inverterEff = clamp(next.inverterEff, 0.01, 1); next.dcdcEff = clamp(next.dcdcEff, 0.01, 1);
    next.internalResistanceOhm = clamp(next.internalResistanceOhm, 0, 2); next.reserveSoc = clamp(next.reserveSoc, 0, 0.95);
    next.rangeMinimumDistanceM = clamp(next.rangeMinimumDistanceM, 100, 100000);
    return next;
  }
  Object.assign(defaults, validateAssumptions(suppliedDefaults));

  function effectiveMassKg() {
    return defaults.massKg + defaults.rotationalInertiaKgM2 / (defaults.wheelRadiusM * defaults.wheelRadiusM);
  }
  function roadSlopeRad() {
    return Math.atan(defaults.roadGradePercent / 100);
  }
  function packEnergyWh() { return pack.nominalVoltageV * pack.capacityAh; }
  // Neither the physical handoff nor the illustrative EV establishes usable capacity.
  // This explicit scenario denominator applies the existing reserve to nominal energy.
  function usablePackEnergyWh() { return packEnergyWh() * (1 - defaults.reserveSoc); }
  function priceEnergy(energyWh) {
    if (tariffInrPerKwh === null) return null;
    const cost = energyWh / 1000 * tariffInrPerKwh;
    return Number.isFinite(cost) ? cost : null;
  }
  function ocvForSoc(value) { return pack.nominalVoltageV * (1 + (13 / 96) * Math.tanh(3.5 * (clamp(value, 0, 1) - 0.5))); }
  function solveBatteryPower(ocvV, requestedPowerW) {
    const resistance = defaults.internalResistanceOhm;
    const maximumPowerW = resistance > 0 ? (ocvV * ocvV) / (4 * resistance) : Infinity;
    const powerW = Math.min(requestedPowerW, maximumPowerW * (1 - 1e-10));
    if (resistance === 0) return { voltageV: ocvV, currentA: powerW / ocvV, powerW };
    const discriminant = Math.max(0, ocvV * ocvV - 4 * resistance * powerW);
    const currentA = (2 * powerW) / (ocvV + Math.sqrt(discriminant));
    return { voltageV: ocvV - currentA * resistance, currentA, powerW };
  }
  function roadForcesN(speed, tractiveN = 0, brakingN = 0) {
    const magnitude = Math.abs(speed);
    const slope = roadSlopeRad();
    const drag = 0.5 * AIR_DENSITY_KG_M3 * defaults.dragCoeff * defaults.frontalAreaM2 * magnitude * magnitude;
    const gravity = defaults.massKg * GRAVITY_MPS2 * Math.sin(slope);
    const normalForce = defaults.massKg * GRAVITY_MPS2 * Math.cos(slope);
    // Rolling resistance acts when moving, or when net forward force (traction - gravity - braking) > 0 at rest.
    const movingOrPushedForward = magnitude > 0 || (tractiveN - gravity - brakingN > 0 && defaults.roadGradePercent !== 0);
    const rolling = movingOrPushedForward ? defaults.rollingCoeff * normalForce : 0;
    return { drag, rolling, gravity, total: drag + rolling + gravity };
  }
  function roadResistanceN(speed) {
    return roadForcesN(speed).total;
  }
  function auxiliaryDevicePowerW() {
    return AUX_DEVICE_IDS.reduce((sum, id) => sum + (deviceEnabled[id] && devicePowerW[id] !== null ? devicePowerW[id] : 0), 0);
  }
  function tractionForceN(speed) {
    if (!running || !tractionEnabled || throttle <= 0 || braking > 0 || soc <= 0) return 0;
    const mechanicalPowerLimitW = defaults.maxMotorPowerW;
    const wheelForceFromTorqueN = (defaults.maxMotorTorqueNm * defaults.gearRatio) / defaults.wheelRadiusM;
    const wheelForceFromPowerN = mechanicalPowerLimitW / Math.max(Math.abs(speed), 0.5);
    let force = throttle * Math.min(wheelForceFromTorqueN, wheelForceFromPowerN);
    if (speed >= defaults.maxSpeedMps - 1e-7) {
      // Every throttle position is constrained to the positive force needed to hold the cap.
      force = Math.min(force, Math.max(0, roadResistanceN(speed)));
    }
    return Math.max(0, force);
  }
  function operatingPoint(speed, dt = 0) {
    const ocvV = ocvForSoc(soc), resistance = defaults.internalResistanceOhm;
    const effMass = effectiveMassKg();
    const drivetrainEfficiency = defaults.motorEff * defaults.inverterEff;
    const curveLimitA = resistance > 0 ? ocvV / (2 * resistance) * (1 - 1e-4) : Infinity;
    const dischargeA = soc <= 0 ? 0 : Math.min(curveLimitA, dt > 0 ? soc * pack.capacityAh * 3600 / dt : Infinity);
    const chargeA = soc >= 1 ? 0 : dt > 0 ? (1 - soc) * pack.capacityAh * 3600 / dt : Infinity;
    const dischargeW = Number.isFinite(dischargeA) ? dischargeA * (ocvV - dischargeA * resistance) : Infinity;
    const chargeW = Number.isFinite(chargeA) ? chargeA * (ocvV + chargeA * resistance) : Infinity;
    const requestedAuxW = running && soc > 0 ? auxiliaryDevicePowerW() / defaults.dcdcEff : 0;
    const devicesBatteryInputW = Math.min(requestedAuxW, dischargeW);
    const auxiliarySupplyFraction = requestedAuxW > 0 ? devicesBatteryInputW / requestedAuxW : 0;
    let brakingForce = running ? braking * defaults.maxBrakingDecelMps2 * defaults.massKg : 0;
    let tractiveForce = tractionForceN(speed);
    const forces = running ? roadForcesN(speed, tractiveForce, brakingForce) : { drag: 0, rolling: 0, gravity: 0, total: 0 };
    let roadLoadForce = forces.total;
    let batteryPowerLimited = requestedAuxW > devicesBatteryInputW + 1e-7;
    if (tractiveForce > 0) {
      const capForce = dt > 0 ? Math.max(0, roadLoadForce + effMass * Math.max(0, defaults.maxSpeedMps - speed) / dt) : Infinity;
      tractiveForce = Math.min(tractiveForce, capForce);
      const availableWheelW = Math.min(defaults.maxMotorPowerW, Math.max(0, dischargeW - devicesBatteryInputW) * drivetrainEfficiency);
      // Solve force × mean velocity ≤ available mechanical power, including launch.
      const a = dt / (2 * effMass), b = speed - roadLoadForce * a;
      let forceLimit = dt > 0
        ? (b >= 0 ? 2 * availableWheelW / (b + Math.sqrt(b * b + 4 * a * availableWheelW) || 1) : (-b + Math.sqrt(b * b + 4 * a * availableWheelW)) / (2 * a))
        : speed > 0 ? availableWheelW / speed : availableWheelW > 0 ? Infinity : 0;
      // A stopped step has mean velocity v/2, even if the unconstrained equation
      // predicts reversing under road resistance. Preserve the power bound there.
      if (dt > 0 && speed > 0) forceLimit = Math.min(forceLimit, 2 * availableWheelW / speed);
      if (availableWheelW === 0) forceLimit = 0;
      batteryPowerLimited ||= tractiveForce > forceLimit + 1e-7 && dischargeW - devicesBatteryInputW < defaults.maxMotorPowerW / drivetrainEfficiency;
      tractiveForce = Math.max(0, Math.min(tractiveForce, forceLimit));
    }
    let dragForce = forces.drag, rollingForce = forces.rolling, gravityForce = forces.gravity;
    if (dt > 0 && running) {
      // Clamp actual stopping forces at zero speed so they cannot reverse the vehicle or regenerate nonexistent kinetic energy.
      const maxRetardingForce = effMass * speed / dt + tractiveForce;
      if (roadLoadForce > maxRetardingForce) {
        const deficit = roadLoadForce - maxRetardingForce;
        const reduceRoll = Math.min(rollingForce, deficit);
        rollingForce -= reduceRoll;
        gravityForce -= (deficit - reduceRoll);
        roadLoadForce = maxRetardingForce;
      }
      brakingForce = Math.min(brakingForce, Math.max(0, maxRetardingForce - roadLoadForce));
      // On a steep downhill where gravity exceeds drag + rolling + commanded brake at the speed ceiling,
      // the speed governor applies retarding brake force so speed does not exceed maxSpeedMps.
      const governorBrakeFloor = tractiveForce - roadLoadForce - effMass * Math.max(0, defaults.maxSpeedMps - speed) / dt;
      if (governorBrakeFloor > brakingForce) brakingForce = governorBrakeFloor;
    } else if (speed === 0) {
      if (roadLoadForce > tractiveForce) roadLoadForce = tractiveForce;
      brakingForce = 0;
    }
    const accelerationMps2 = running ? (tractiveForce - roadLoadForce - brakingForce) / effMass : 0;
    const nextSpeed = dt > 0 ? clamp(speed + accelerationMps2 * dt, 0, defaults.maxSpeedMps) : speed;
    const meanSpeed = (speed + nextSpeed) / 2;
    const mechanicalDriveW = tractiveForce * meanSpeed, tractionInputW = mechanicalDriveW / drivetrainEfficiency;
    const brakingMechanicalW = brakingForce * meanSpeed;
    const regenW = running ? Math.min(brakingMechanicalW * defaults.regenFraction * drivetrainEfficiency, defaults.maxRegenPowerW, chargeW + devicesBatteryInputW) : 0;
    const brakingDissipatedW = Math.max(0, brakingMechanicalW - regenW);
    const electrical = solveBatteryPower(ocvV, tractionInputW + devicesBatteryInputW - regenW);
    return {
      ...electrical, ocvV, nextSpeed, meanSpeed, accelerationMps2, mechanicalDriveW,
      tractiveForce, roadLoadForce, dragForce, rollingForce, gravityForce,
      brakingForce, brakingMechanicalW, brakingDissipatedW,
      tractionInputW, devicesBatteryInputW,
      devicesOutputW: devicesBatteryInputW * defaults.dcdcEff, auxiliarySupplyFraction, regenW, batteryPowerLimited,
    };
  }
  function calculateSnapshot() {
    const point = operatingPoint(speedMps), electrical = point, packWh = packEnergyWh(), usableWh = usablePackEnergyWh();
    const {
      ocvV, tractiveForce, brakingForce, roadLoadForce, dragForce, rollingForce, gravityForce,
      tractionInputW, devicesOutputW, devicesBatteryInputW, regenW,
    } = point;
    const effMass = effectiveMassKg();
    const slopeRad = roadSlopeRad();
    const wheelAngularVelocityRadS = speedMps / defaults.wheelRadiusM;
    const motorAngularVelocityRadS = wheelAngularVelocityRadS * defaults.gearRatio;
    const wheelRpm = wheelAngularVelocityRadS * 60 / (2 * Math.PI);
    const motorRpm = motorAngularVelocityRadS * 60 / (2 * Math.PI);
    const wheelTorqueNm = tractiveForce * defaults.wheelRadiusM;
    const motorTorqueNm = defaults.gearRatio > 0 ? wheelTorqueNm / defaults.gearRatio : 0;
    const translationalKineticEnergyWh = 0.5 * defaults.massKg * speedMps * speedMps / 3600;
    const rotationalKineticEnergyWh = 0.5 * defaults.rotationalInertiaKgM2 * wheelAngularVelocityRadS * wheelAngularVelocityRadS / 3600;
    const kineticEnergyWh = translationalKineticEnergyWh + rotationalKineticEnergyWh;
    const mechanicalWorkNetWh = mechanicalDriveEnergyWh - aerodynamicLossEnergyWh - rollingLossEnergyWh - potentialEnergyChangeWh - brakingMechanicalEnergyWh;
    const mechanicalEnergyBalanceErrorWh = mechanicalWorkNetWh - (kineticEnergyWh - tripStartKineticEnergyWh);
    const netEnergyWh = grossBatteryEnergyWh - recoveredBatteryEnergyWh;
    const tripDistanceM = distanceM - energyTripStartDistanceM;
    const netWhPerKm = tripDistanceM >= defaults.rangeMinimumDistanceM && netEnergyWh > 0 ? netEnergyWh / (tripDistanceM / 1000) : null;
    const availableRangeEnergyWh = Math.max(0, (soc - defaults.reserveSoc) * packWh);
    const estimatedRangeKm = netWhPerKm && netWhPerKm > 0 ? availableRangeEnergyWh / netWhPerKm : null;
    const costInr = priceEnergy(Math.max(0, netEnergyWh));
    const devices = [
      { id: "tractionMotor", name: deviceNames.tractionMotor, enabled: tractionEnabled, ratingW: null, demandW: tractionInputW, batteryInputW: tractionInputW, energyWh: deviceEnergyWh.tractionMotor },
      ...AUX_DEVICE_IDS.map((id) => {
        const demandW = running && deviceEnabled[id] ? (devicePowerW[id] ?? 0) * point.auxiliarySupplyFraction : 0;
        return { id, name: deviceNames[id], enabled: deviceEnabled[id], operating: running && deviceEnabled[id] && point.auxiliarySupplyFraction > 0, ratingW: devicePowerW[id], demandW, batteryInputW: demandW / defaults.dcdcEff, energyWh: deviceEnergyWh[id] };
      }),
    ].map(device => ({
      ...device,
      energyKwh: device.energyWh / 1000,
      batteryPercentConsumed: device.energyWh / usableWh * 100,
      costInr: priceEnergy(device.energyWh),
    }));
    // Gross device totals intentionally retain energy used by devices now switched OFF.
    // Regeneration remains in the separate net battery ledger, never a negative device row.
    const totalDeviceEnergyKwh = devices.reduce((sum, device) => sum + device.energyKwh, 0);
    const totalDeviceBatteryPercent = devices.reduce((sum, device) => sum + device.batteryPercentConsumed, 0);
    const summedCost = devices.every(device => device.costInr !== null) ? devices.reduce((sum, device) => sum + device.costInr, 0) : null;
    const totalDeviceCostInr = Number.isFinite(summedCost) ? summedCost : null;
    return {
      running, tractionEnabled, throttle, braking, speedMps, speedKmh: speedMps * 3.6, distanceM, elevationChangeM, simulatedSeconds,
      voltageV: electrical.voltageV, voltageOcvV: ocvV, currentA: electrical.currentA, powerW: electrical.powerW,
      accelerationMps2: point.accelerationMps2, mechanicalDriveW: point.mechanicalDriveW, batteryPowerLimited: point.batteryPowerLimited,
      tractionPowerW: tractionInputW, auxiliaryOutputW: devicesOutputW, auxiliaryBatteryInputW: devicesBatteryInputW,
      regenW, tractiveForceN: tractiveForce, roadLoadForceN: roadLoadForce, brakingForceN: brakingForce,
      aerodynamicDragForceN: dragForce, rollingResistanceForceN: rollingForce, gravitationalForceN: gravityForce,
      roadSlopeRad: slopeRad, effectiveMassKg: effMass,
      wheelAngularVelocityRadS, motorAngularVelocityRadS, wheelRpm, motorRpm,
      wheelTorqueNm, motorTorqueNm, leftAxleTorqueNm: wheelTorqueNm * 0.5, rightAxleTorqueNm: wheelTorqueNm * 0.5,
      translationalKineticEnergyWh, rotationalKineticEnergyWh, kineticEnergyWh,
      potentialEnergyChangeWh, mechanicalDriveEnergyWh, drivetrainLossEnergyWh,
      aerodynamicLossEnergyWh, rollingLossEnergyWh, brakingMechanicalEnergyWh, brakingDissipatedEnergyWh,
      mechanicalEnergyBalanceErrorWh,
      soc, socPercent: soc * 100, nominalPackEnergyWh: packWh, grossBatteryEnergyWh, recoveredBatteryEnergyWh,
      usablePackEnergyWh: usableWh, usableCapacityVerified: false,
      usableCapacityBasis: "Scenario assumption: nominal energy × (1 − reserve fraction); usable capacity is not verified.",
      tripDistanceM, tripSeconds: simulatedSeconds - energyTripStartSeconds,
      totalDeviceEnergyKwh, totalDeviceBatteryPercent, totalDeviceCostInr,
      costCalculationStatus: tariffInrPerKwh === null ? 'tariff-unset' : totalDeviceCostInr === null || costInr === null ? 'numeric-overflow' : 'available',
      netEnergyWh, energyUsedWh: netEnergyWh, deviceEnergyWh: { ...deviceEnergyWh }, devices, tariffInrPerKwh,
      terminalEnergyWh, batteryInternalLossWh, energyBalanceErrorWh: netEnergyWh - terminalEnergyWh,
      costInr, netWhPerKm, estimatedRangeKm, rangeObservation, reserveSoc: defaults.reserveSoc,
      assumptions: { ...defaults, nominalVoltageV: pack.nominalVoltageV, capacityAh: pack.capacityAh },
      sourceLabel: "SOFTWARE SIMULATION — EDITABLE SCENARIO, NOT VEHICLE DATA",
    };
  }
  function emit() { const state = calculateSnapshot(); for (const listener of listeners) listener(state); return state; }
  function integrateFixedStep(dt) {
    const point = operatingPoint(speedMps, dt), dtHours = dt / 3600;
    const stepDistanceM = point.meanSpeed * dt;
    speedMps = point.nextSpeed;
    distanceM += stepDistanceM;
    elevationChangeM += stepDistanceM * Math.sin(roadSlopeRad());
    simulatedSeconds += dt;
    grossBatteryEnergyWh += (point.tractionInputW + point.devicesBatteryInputW) * dtHours;
    recoveredBatteryEnergyWh += point.regenW * dtHours;
    terminalEnergyWh += point.powerW * dtHours;
    batteryInternalLossWh += point.currentA * point.currentA * defaults.internalResistanceOhm * dtHours;
    mechanicalDriveEnergyWh += point.mechanicalDriveW * dtHours;
    drivetrainLossEnergyWh += (point.tractionInputW - point.mechanicalDriveW) * dtHours;
    aerodynamicLossEnergyWh += point.dragForce * point.meanSpeed * dtHours;
    rollingLossEnergyWh += point.rollingForce * point.meanSpeed * dtHours;
    potentialEnergyChangeWh += point.gravityForce * point.meanSpeed * dtHours;
    brakingMechanicalEnergyWh += point.brakingMechanicalW * dtHours;
    brakingDissipatedEnergyWh += point.brakingDissipatedW * dtHours;
    deviceEnergyWh.tractionMotor += point.tractionInputW * dtHours;
    for (const id of AUX_DEVICE_IDS) if (deviceEnabled[id]) deviceEnergyWh[id] += ((devicePowerW[id] ?? 0) / defaults.dcdcEff) * point.auxiliarySupplyFraction * dtHours;
    soc = clamp(soc - point.currentA * dtHours / pack.capacityAh, 0, 1);
    if (soc < 1e-12) soc = 0;
    if (distanceM - energyTripStartDistanceM >= defaults.rangeMinimumDistanceM && grossBatteryEnergyWh > 0) rangeObservation = true;
  }
  function step(elapsedSeconds) {
    const elapsed = Number(elapsedSeconds);
    if (!running || !Number.isFinite(elapsed) || elapsed <= 0) return calculateSnapshot();
    if (elapsed / defaults.integrationStepS > 1000000) throw new RangeError("Simulation step exceeds the supported work limit.");
    const totalSeconds = pendingSeconds + elapsed, interval = defaults.integrationStepS;
    const steps = totalSeconds / interval;
    // Compute the count once: repeatedly subtracting dt can leave an exact
    // endpoint just below one full interval after a long update. The tolerance
    // is limited to floating-point roundoff, not a fraction of a physical step.
    const stepRoundoff = 8 * Number.EPSILON * Math.max(1, steps);
    const count = Math.floor(steps + stepRoundoff);
    if (count > 1000000) throw new RangeError("Simulation step exceeds the supported work limit.");
    pendingSeconds = totalSeconds - count * interval;
    if (Math.abs(pendingSeconds) <= stepRoundoff * interval) pendingSeconds = 0;
    for (let index = 0; index < count; index += 1) integrateFixedStep(interval);
    return emit();
  }
  function clearTripEnergy() {
    grossBatteryEnergyWh = 0; recoveredBatteryEnergyWh = 0; terminalEnergyWh = 0; batteryInternalLossWh = 0;
    mechanicalDriveEnergyWh = 0; drivetrainLossEnergyWh = 0; aerodynamicLossEnergyWh = 0;
    rollingLossEnergyWh = 0; potentialEnergyChangeWh = 0; brakingMechanicalEnergyWh = 0; brakingDissipatedEnergyWh = 0;
    energyTripStartDistanceM = distanceM; energyTripStartSeconds = simulatedSeconds; rangeObservation = false;
    tripStartKineticEnergyWh = 0.5 * effectiveMassKg() * speedMps * speedMps / 3600;
    for (const key of Object.keys(deviceEnergyWh)) deviceEnergyWh[key] = 0;
  }
  // An input event can arrive between fixed steps. Complete the already elapsed
  // fraction under the old controls before applying the event, so elapsed ON
  // time is neither lost nor reassigned to the next device/switch state.
  function flushPendingTime() {
    if (running && pendingSeconds > 1e-12) integrateFixedStep(pendingSeconds);
    pendingSeconds = 0;
  }
  return {
    getState: calculateSnapshot,
    onChange(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    start() { running = true; emit(); },
    stop() { flushPendingTime(); running = false; throttle = 0; emit(); }, step,
    setThrottle(value) { flushPendingTime(); throttle = clamp(finiteOr(value, 0), 0, 1); if (throttle > 0) braking = 0; emit(); },
    setBraking(value) { flushPendingTime(); braking = clamp(finiteOr(value, 0), 0, 1); if (braking > 0) throttle = 0; emit(); },
    setDeviceEnabled(id, enabled) {
      if (id !== "tractionMotor" && !AUX_DEVICE_IDS.includes(id)) return false;
      flushPendingTime();
      if (id === "tractionMotor") tractionEnabled = !!enabled;
      else if (AUX_DEVICE_IDS.includes(id)) deviceEnabled[id] = !!enabled && devicePowerW[id] !== null;
      else return false;
      emit(); return true;
    },
    setDevicePower(id, watts) {
      if (!AUX_DEVICE_IDS.includes(id)) return false;
      flushPendingTime();
      const value = watts === null || watts === "" ? null : Number(watts);
      devicePowerW[id] = Number.isFinite(value) && value >= 0 ? clamp(value, 0, 10000) : null;
      if (devicePowerW[id] === null) deviceEnabled[id] = false;
      emit(); return true;
    },
    setTariff(value) {
      const numeric = value === null || value === "" ? null : Number(value);
      tariffInrPerKwh = Number.isFinite(numeric) && numeric >= 0 ? numeric : null; emit();
    },
    setAssumptions(values = {}) {
      flushPendingTime();
      const oldEffMass = effectiveMassKg(), oldSpeed = speedMps;
      Object.assign(defaults, validateAssumptions(values));
      pack.nominalVoltageV = clamp(finiteOr(values.nominalVoltageV, pack.nominalVoltageV), 24, 800);
      pack.capacityAh = clamp(finiteOr(values.capacityAh, pack.capacityAh), 1, 1000);
      speedMps = clamp(speedMps, 0, defaults.maxSpeedMps); pendingSeconds = 0;
      const oldKineticWh = 0.5 * oldEffMass * oldSpeed * oldSpeed / 3600;
      const newKineticWh = 0.5 * effectiveMassKg() * speedMps * speedMps / 3600;
      tripStartKineticEnergyWh += (newKineticWh - oldKineticWh);
      emit();
    },
    resetTripEnergy() { flushPendingTime(); clearTripEnergy(); emit(); },
    reset() {
      flushPendingTime();
      running = false; tractionEnabled = false; throttle = 0; braking = 0; soc = 0.72; speedMps = 0;
      distanceM = 0; elevationChangeM = 0; simulatedSeconds = 0; pendingSeconds = 0; clearTripEnergy();
      for (const key of AUX_DEVICE_IDS) deviceEnabled[key] = false;
      emit();
    },
  };
}
