"use strict";

const OPTIONAL_NONNEGATIVE = ["lightVoltageV", "lightCurrentA", "motorVoltageV", "motorCurrentA"];

export function normalizeTelemetryRecord(record, now = Date.now()) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  const requiredNumeric = ["voltage", "current", "power", "energyWh", "timestamp"];
  for (const field of requiredNumeric) if (typeof record[field] !== "number" || !Number.isFinite(record[field])) return null;
  if (record.voltage < 0 || record.current < 0 || record.power < 0 || record.energyWh < 0) return null;
  if (!Number.isInteger(record.timestamp) || record.timestamp < Date.UTC(2000, 0, 1) || record.timestamp > now + 5 * 60 * 1000) return null;
  if (record.source !== "esp32") return null;
  if (record.temperatureC !== undefined && (typeof record.temperatureC !== "number" || !Number.isFinite(record.temperatureC) || record.temperatureC < -100 || record.temperatureC > 200)) return null;
  if (record.motorOn !== undefined && typeof record.motorOn !== "boolean") return null;
  for (const field of OPTIONAL_NONNEGATIVE) {
    if (record[field] !== undefined && (typeof record[field] !== "number" || !Number.isFinite(record[field]) || record[field] < 0)) return null;
  }
  const lightPowerW = Number.isFinite(record.lightVoltageV) && Number.isFinite(record.lightCurrentA)
    ? record.lightVoltageV * record.lightCurrentA : null;
  const motorPowerW = Number.isFinite(record.motorVoltageV) && Number.isFinite(record.motorCurrentA)
    ? record.motorVoltageV * record.motorCurrentA : null;
  // Finite fields can still overflow when multiplied; never display Infinity as telemetry.
  if ((lightPowerW !== null && !Number.isFinite(lightPowerW)) || (motorPowerW !== null && !Number.isFinite(motorPowerW))) return null;
  const computedBranchTotalPowerW = lightPowerW !== null && motorPowerW !== null ? lightPowerW + motorPowerW : null;
  if (computedBranchTotalPowerW !== null && !Number.isFinite(computedBranchTotalPowerW)) return null;
  return {
    voltage: record.voltage,
    current: record.current,
    reportedPowerW: record.power,
    energyWh: record.energyWh,
    temperatureC: record.temperatureC ?? null,
    motorOn: record.motorOn ?? null,
    timestamp: record.timestamp,
    source: record.source,
    lightVoltageV: record.lightVoltageV ?? null,
    lightCurrentA: record.lightCurrentA ?? null,
    lightPowerW,
    motorVoltageV: record.motorVoltageV ?? null,
    motorCurrentA: record.motorCurrentA ?? null,
    motorPowerW,
    computedBranchTotalPowerW,
  };
}

export function isFreshTelemetry(record, now = Date.now(), maximumAgeMs = 5 * 60 * 1000) {
  return !!record && Number.isFinite(record.timestamp) && Number.isFinite(now) && Number.isFinite(maximumAgeMs)
    && maximumAgeMs >= 0 && record.timestamp <= now + 5 * 60 * 1000 && now - record.timestamp <= maximumAgeMs;
}
