import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTelemetryRecord, isFreshTelemetry } from "../telemetry.js";

const now = Date.UTC(2026, 10, 2, 12);
const baseRecord = {
  voltage: 12.4,
  current: 1.25,
  power: 15.5,
  energyWh: 4.75,
  timestamp: now,
  source: "esp32",
};

test("accepts the minimal aggregate schema and leaves optional sensors unavailable", () => {
  const record = normalizeTelemetryRecord(baseRecord, now);
  assert.ok(record);
  assert.equal(record.lightCurrentA, null);
  assert.equal(record.motorPowerW, null);
  assert.equal(record.temperatureC, null);
  assert.equal(record.motorOn, null);
});

test("computes branch powers and sum only when both branch V/I pairs exist", () => {
  const record = normalizeTelemetryRecord({
    ...baseRecord,
    lightVoltageV: 12,
    lightCurrentA: 0.5,
    motorVoltageV: 11.8,
    motorCurrentA: 2,
  }, now);
  assert.equal(record.lightPowerW, 6);
  assert.equal(record.motorPowerW, 23.6);
  assert.equal(record.computedBranchTotalPowerW, 29.6);
  const incomplete = normalizeTelemetryRecord({ ...baseRecord, lightVoltageV: 12, lightCurrentA: 0.5 }, now);
  assert.equal(incomplete.computedBranchTotalPowerW, null);
});

test("rejects malformed, non-finite, negative, implausible-time and mislabeled records", () => {
  const badRecords = [
    null,
    {},
    { ...baseRecord, current: -0.1 },
    { ...baseRecord, power: Number.NaN },
    { ...baseRecord, temperatureC: 201 },
    { ...baseRecord, motorOn: 1 },
    { ...baseRecord, lightCurrentA: -1 },
    { ...baseRecord, timestamp: now + 6 * 60 * 1000 },
    { ...baseRecord, timestamp: 0 },
    { ...baseRecord, source: "simulation" },
  ];
  for (const record of badRecords) assert.equal(normalizeTelemetryRecord(record, now), null);
});

test("freshness is a display policy based on timestamp age", () => {
  const record = normalizeTelemetryRecord(baseRecord, now);
  assert.equal(isFreshTelemetry(record, now + 5 * 60 * 1000), true);
  assert.equal(isFreshTelemetry(record, now + 5 * 60 * 1000 + 1), false);
  assert.equal(isFreshTelemetry({ timestamp: now + 6 * 60 * 1000 }, now), false);
  assert.equal(isFreshTelemetry({ timestamp: Number.NaN }, now), false);
  assert.equal(isFreshTelemetry(record, now, -1), false);
});

test("rejects derived branch power overflow rather than rendering nonfinite measurements", () => {
  assert.equal(normalizeTelemetryRecord({ ...baseRecord, lightVoltageV: 1e308, lightCurrentA: 1e308 }, now), null);
  assert.equal(normalizeTelemetryRecord({ ...baseRecord, lightVoltageV: 1e308, lightCurrentA: 1, motorVoltageV: 1e308, motorCurrentA: 1 }, now), null);
});
