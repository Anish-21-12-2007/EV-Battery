import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseEngineeringCsv, calculateDivider, calculateCurrentScaler, calculateBranchEnergy } from '../engineering-lab.js';

test('engineering source parser preserves real BOM and all wire conditions', async () => {
  const root = new URL('../FINAL_EV_EMS_ENGINEERING_PACKAGE/', import.meta.url);
  const [bom, wires] = await Promise.all(['02_Component_Details/component_list.csv', '03_Circuit_Design/wiring_connections.csv'].map(async (path) => parseEngineeringCsv(await readFile(new URL(path, root), 'utf8'))));
  assert.equal(bom.length, 42); assert.equal(wires.length, 60);
  assert.equal(wires[52].wire_id, 'W053'); assert.equal(wires[52].net_or_domain, 'KELVIN_STAR_TIE');
  const ids = new Set(bom.map((row) => row.ID));
  assert.ok(wires.every((row) => ids.has(row.source_component) && ids.has(row.destination_component) && row.evidence_or_condition));
  assert.ok(bom.find((row) => row.ID === 'S_M')['Audit note'].includes('not intended for automotive'));
});

test('CSV reader handles quoted delimiters, quotes and line breaks', () => {
  assert.deepEqual(parseEngineeringCsv('\uFEFFID,Note\r\nA,"one, two"\r\nB,"He said ""no""\nand left"\r\n'), [{ ID: 'A', Note: 'one, two' }, { ID: 'B', Note: 'He said "no"\nand left' }]);
  assert.throws(() => parseEngineeringCsv('ID,Note\nA,"broken'));
});

test('divider reproduces independent nominal and tolerance corners', () => {
  const result = calculateDivider({ voltage: 18, topKohm: 68, bottomKohm: 10, tolerancePercent: 1 });
  assert.ok(Math.abs(result.nominalV - 2.3076923076923075) < 1e-12);
  assert.ok(Math.abs(result.maximumV - 18 * 10.1 / (67.32 + 10.1)) < 1e-12);
  assert.ok(result.characterizedInputCeilingV > 18.78 && result.characterizedInputCeilingV < 18.781);
  assert.ok(result.marginV > 0.1 && result.marginV < 0.102);
  assert.equal(calculateDivider({ voltage: NaN, topKohm: 68, bottomKohm: 10, tolerancePercent: 1 }), null);
  assert.equal(calculateDivider({ voltage: 18, topKohm: 0, bottomKohm: 10, tolerancePercent: 1 }), null);
});

test('current scaler exposes small-signal resolution and signed endpoints', () => {
  const small = calculateCurrentScaler(.5);
  assert.ok(Math.abs(small.shiftMv - 14.042553191489363) < 1e-12);
  assert.ok(Math.abs(small.adcErrorA - 2.1363636363636362) < 1e-12);
  assert.ok(Math.abs(calculateCurrentScaler(30).nodeV - 1.9063829787234043) < 1e-12);
  assert.ok(Math.abs(calculateCurrentScaler(-30).nodeV - .22127659574468086) < 1e-12);
  assert.equal(calculateCurrentScaler(31), null);
});

test('energy calculator integrates different branch durations without fabricating totals', () => {
  assert.deepEqual(calculateBranchEnergy({ lightVoltage: 12, lightCurrent: .5, lightHours: 2, motorVoltage: 12, motorCurrent: 4, motorHours: .25, tariff: 8 }), { lightPowerW: 6, motorPowerW: 48, lightWh: 12, motorWh: 12, totalWh: 24, cost: .192 });
  assert.equal(calculateBranchEnergy({ lightVoltage: 12, lightCurrent: .5, lightHours: 2, motorVoltage: 12, motorCurrent: 4, motorHours: .25, tariff: -1 }), null);
});
