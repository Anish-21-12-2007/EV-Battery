"use strict";

// Values carried forward from the prior software model. They are scenario assumptions,
// not measurements or specifications for a commercially available vehicle.
export const EV_VEHICLE_MANIFEST = {
  revision: "illustrative-scenario-2026-11-03",
  caveat: "Software-only 96 V scenario, separate from the proposed 12 V educational monitor. No physical EV or production specification is represented.",
  pack: { label: "Illustrative traction pack", nominalVoltage_V: 96, capacityAh: 150, chemistry: "Unverified NMC proxy", note: "Nominal energy is calculated as nominal voltage × capacity; usable energy and charge limits are not established." },
  // Editable output-side demonstration loads, not measured appliance ratings.
  auxiliaryPowerW: { headlights: 80, airConditioning: 750, cabinLights: 12, infotainment: 35 },
};

export const EV_SIM_DEFAULTS = {
  massKg: 720,
  wheelRadiusM: 0.31,
  gearRatio: 8.2,
  maxMotorTorqueNm: 180,
  maxMotorPowerW: 18000,
  maxSpeedMps: 22,
  maxBrakingDecelMps2: 3,
  integrationStepS: 0.02,
  regenFraction: 0.28,
  maxRegenPowerW: 10000,
  dragCoeff: 0.34,
  frontalAreaM2: 1.9,
  rollingCoeff: 0.012,
  roadGradePercent: 0,
  rotationalInertiaKgM2: 0,
  motorEff: 0.9,
  inverterEff: 0.93,
  dcdcEff: 0.88,
  internalResistanceOhm: 0.035,
  reserveSoc: 0.1,
  rangeMinimumDistanceM: 500,
};

export const EV_DRIVING_SCENARIOS = {
  manual: {
    id: "manual",
    label: "Manual / custom controls",
    description: "Interactive driver controls with user-selected throttle, braking, slope, and auxiliary device switches.",
  },
  acceleration: {
    id: "acceleration",
    label: "Scenario 1 · Full-throttle acceleration",
    description: "Level road (0% grade), 100% throttle launch from rest with torque-to-power transition and driveline rotational inertia (1.8 kg·m²).",
    assumptions: { roadGradePercent: 0, rotationalInertiaKgM2: 1.8 },
    tractionEnabled: true,
    throttle: 1.0,
    braking: 0,
    auxiliaries: { headlights: false, airConditioning: false, cabinLights: false, infotainment: true },
  },
  cruising: {
    id: "cruising",
    label: "Scenario 2 · Steady-state level cruising",
    description: "Level road cruising at the 22 m/s (79.2 km/h) governor ceiling where tractive force balances aerodynamic drag plus rolling resistance.",
    assumptions: { roadGradePercent: 0, rotationalInertiaKgM2: 0 },
    tractionEnabled: true,
    throttle: 0.65,
    braking: 0,
    auxiliaries: { headlights: true, airConditioning: false, cabinLights: false, infotainment: true },
  },
  braking: {
    id: "braking",
    label: "Scenario 3 · Regenerative braking",
    description: "Deceleration under 60% braking command, recovering a bounded fraction of kinetic energy back to the 96 V pack bus.",
    assumptions: { roadGradePercent: 0, rotationalInertiaKgM2: 1.8 },
    tractionEnabled: true,
    throttle: 0,
    braking: 0.6,
    auxiliaries: { headlights: true, airConditioning: false, cabinLights: false, infotainment: true },
  },
  downhill: {
    id: "downhill",
    label: "Scenario 4 · Downhill grade & regen (-6% slope)",
    description: "Downhill operation on a -6% gradient where gravity propels the vehicle and controlled 10% regenerative braking recovers gravitational potential energy.",
    assumptions: { roadGradePercent: -6, rotationalInertiaKgM2: 1.8 },
    tractionEnabled: true,
    throttle: 0,
    braking: 0.1,
    auxiliaries: { headlights: true, airConditioning: false, cabinLights: true, infotainment: true },
  },
  auxiliary: {
    id: "auxiliary",
    label: "Scenario 5 · All 5 devices & auxiliary load audit",
    description: "Simultaneous operation of traction motor (25% throttle) and all four low-voltage auxiliary loads via the 88% efficient DC/DC converter.",
    assumptions: { roadGradePercent: 0, rotationalInertiaKgM2: 1.8 },
    tractionEnabled: true,
    throttle: 0.25,
    braking: 0,
    auxiliaries: { headlights: true, airConditioning: true, cabinLights: true, infotainment: true },
  },
};
