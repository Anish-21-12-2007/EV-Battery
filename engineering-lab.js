import { initWiringLayout } from './wiring-layout.js';
// The original engineering package is the source of the register and netlist.
// This module does not modify hardware, telemetry, or simulation settings.
const PACKAGE = './FINAL_EV_EMS_ENGINEERING_PACKAGE/';
const FILES = {
  bom: '02_Component_Details/component_list.csv',
  wires: '03_Circuit_Design/wiring_connections.csv',
  pins: '03_Circuit_Design/pin_mapping.md',
  schematic: '03_Circuit_Design/2D_circuit_schematic.svg',
  current: '04_Measurement_and_Calculations/current_measurement.md',
  voltage: '04_Measurement_and_Calculations/voltage_measurement.md',
  energy: '04_Measurement_and_Calculations/power_energy_and_cost.md',
  safety: '05_Protection_and_Safety/unresolved_safety_decisions.md',
};
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const number = (value, digits = 3) => Number.isFinite(value) ? value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';
const valid = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;

export function parseEngineeringCsv(text) {
  const rows = []; let row = [], field = '', quoted = false;
  const input = String(text).replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (c === ',' && !quoted) { row.push(field); field = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && input[i + 1] === '\n') i++;
      row.push(field); if (row.some((cell) => cell.trim())) rows.push(row);
      row = []; field = '';
    } else field += c;
  }
  if (quoted) throw new Error('Unclosed CSV quotation');
  row.push(field); if (row.some((cell) => cell.trim())) rows.push(row);
  if (!rows.length) return [];
  const headers = rows.shift();
  return rows.map((cells) => Object.fromEntries(headers.map((key, index) => [key.trim(), (cells[index] ?? '').trim()])));
}

export function calculateDivider({ voltage, topKohm, bottomKohm, tolerancePercent }) {
  if (!valid(voltage, 0, 60) || !valid(topKohm, 0.01, 10000) || !valid(bottomKohm, 0.01, 10000) || !valid(tolerancePercent, 0, 10)) return null;
  const t = tolerancePercent / 100;
  const ratio = bottomKohm / (topKohm + bottomKohm);
  const maximumRatio = bottomKohm * (1 + t) / (topKohm * (1 - t) + bottomKohm * (1 + t));
  const minimumRatio = bottomKohm * (1 - t) / (topKohm * (1 + t) + bottomKohm * (1 - t));
  return { ratio, nominalV: voltage * ratio, maximumV: voltage * maximumRatio, minimumV: voltage * minimumRatio,
    currentMa: voltage / (topKohm + bottomKohm), dissipationMw: voltage ** 2 / (topKohm + bottomKohm),
    characterizedInputCeilingV: 2.45 / maximumRatio, marginV: 2.45 - voltage * maximumRatio };
}

export function calculateCurrentScaler(currentA) {
  if (!valid(currentA, -30, 30)) return null;
  const ratio = 20 / 47, sensitivity = 0.066;
  return { rawV: 2.5 + sensitivity * currentA, nodeV: (2.5 + sensitivity * currentA) * ratio,
    zeroV: 2.5 * ratio, shiftMv: currentA * sensitivity * ratio * 1000,
    scaledSensitivityMvA: sensitivity * ratio * 1000, adcErrorA: 0.060 / (sensitivity * ratio) };
}

export function calculateBranchEnergy({ lightVoltage, lightCurrent, lightHours, motorVoltage, motorCurrent, motorHours, tariff }) {
  if (![lightVoltage, motorVoltage].every((v) => valid(v, 0, 60)) || ![lightCurrent, motorCurrent].every((v) => valid(v, 0, 1000)) ||
      ![lightHours, motorHours].every((v) => valid(v, 0, 10000)) || !valid(tariff, 0, 100000)) return null;
  const lightPowerW = lightVoltage * lightCurrent, motorPowerW = motorVoltage * motorCurrent;
  const lightWh = lightPowerW * lightHours, motorWh = motorPowerW * motorHours;
  return { lightPowerW, motorPowerW, lightWh, motorWh, totalWh: lightWh + motorWh, cost: (lightWh + motorWh) * tariff / 1000 };
}

const COMPONENTS = [
  { id: 'BAT1', code: 'BAT1', title: 'Battery source', meta: '12 V candidate', x: 18, y: 184, w: 132,
    lead: 'The low-voltage educational supply. Its physical identity remains unverified.',
    facts: [['Candidate only', '12 V × 7.6 Ah = 91.2 Wh nominal arithmetic'], ['Still needed', 'Chemistry, label/revision, charging limits and prospective short-circuit current'], ['Boundary', 'This circuit has no connection to the 96 V software vehicle.']], source: '02_Component_Details/component_specifications.md', query: 'BAT1' },
  { id: 'F1', code: 'F1 · SW1', title: 'Protected distribution', meta: 'Ratings unresolved', x: 187, y: 184, w: 151,
    lead: 'F1 and the master switch feed BUS+. Each branch needs its own protection at the takeoff.',
    facts: [['Main path', 'BAT1 → F1 → SW1 → BUS+ in W001–W003'], ['Three branches', 'FL for Light, FM for Motor, F2 for electronics'], ['Selection pending', 'DC voltage, interrupt capacity, time-current/I²t, inrush and protected conductor data'], ['Protection placeholders', 'RP1 and TVS1 remain unselected; the register does not constitute a complete construction netlist.']], source: '05_Protection_and_Safety/fuse_and_protection_requirements.md', query: 'fuse' },
  { id: 'S_L', code: 'FL · S_L', title: 'Light current sensing', meta: 'Sensor not selected', x: 401, y: 30, w: 167,
    lead: 'A dedicated series current transducer is needed to distinguish Light consumption from Motor consumption.',
    facts: [['Primary path', 'BUS+ → FL → S_L → L1'], ['Signal path', 'S_L → U_I_L → candidate GPIO32'], ['Resolution issue', 'The ACS712-30A example gives only 14.04 mV of scaled change at 0.50 A.'], ['Pending design', 'A suitable low-current sensor and its interface must be selected for the actual lamp.']], source: FILES.current, query: 'LIGHT' },
  { id: 'L1', code: 'L1 · V_L', title: 'Light branch input', meta: 'Separate V × I boundary', x: 639, y: 30, w: 168,
    lead: 'Light input power pairs branch current with the voltage measured at the complete lamp input.',
    facts: [['Load assumption', 'A complete 12 V DC lamp assembly; not a bare LED'], ['Voltage channel', '68 kΩ / 10 kΩ and 100 nF → candidate GPIO33'], ['Return', 'Dedicated W007 home-run to JGND.STAR_RETURN'], ['Measurement limitation', 'A single-ended voltage tap includes return-wire drop; it is not a differential terminal measurement.']], source: '03_Circuit_Design/complete_circuit_explanation.md', query: 'LIGHT' },
  { id: 'S_M', code: 'FM · S_M', title: 'Motor current sensing', meta: 'ACS712 IC candidate', x: 401, y: 184, w: 167,
    lead: 'The proposed sensor measures DC input current to the motor controller.',
    facts: [['IC assumption', 'Direct ACS712-30A output, 5.00 V supply, 66 mV/A typical'], ['Output scaler', '27 kΩ / 20 kΩ with 100 nF → candidate GPIO34'], ['Module unknown', 'PCB traces, terminals, onboard scaling and filters still require identification'], ['Scope', 'Allegro states ACS712 is not intended for automotive applications.']], source: FILES.current, query: 'S_M' },
  { id: 'MDRV', code: 'MDRV · M1', title: 'Motor drive input', meta: 'PWM output excluded', x: 639, y: 184, w: 168,
    lead: 'Motor branch energy is measured before the controller, at its DC supply input.',
    facts: [['Voltage channel', 'MDRV.INPUT+ → 68 kΩ / 10 kΩ → candidate GPIO35'], ['Motor output', 'W054/W055 connect MDRV to M1; do not attach the input divider to PWM output.'], ['Still needed', 'Motor and driver identity, starting/stall current, reversing and regeneration behavior'], ['Suppression', 'A diode across a reversing H-bridge load can short the reverse output. D1 is conditional.']], source: '05_Protection_and_Safety/motor_and_inductive_load_protection.md', query: 'MOTOR' },
  { id: 'U_BUCK_BOARD', code: 'F2 · DC/DC', title: 'Electronics supply', meta: '5.00 V proposal', x: 401, y: 338, w: 167,
    lead: 'The independently fused electronics branch supplies the MCU and compatible sensors.',
    facts: [['Candidate IC', 'LM2596; IC data does not establish unknown module capability'], ['Before connection', 'Verify loaded output, polarity, common input/output return and board thermal limits'], ['Power sequencing', 'Sensor and divider nodes must not backfeed an unpowered ESP32.'], ['Boundary', 'Electronics consumption is separate from the sum of the two measured load branches.']], source: '05_Protection_and_Safety/reverse_polarity_and_transient_protection.md', query: 'U_BUCK' },
  { id: 'U_ESP', code: 'U_ESP · ADC1', title: 'Measurement & uplink', meta: 'Board unverified', x: 639, y: 338, w: 168,
    lead: 'The classic ESP32 candidate collects conditioned signals; the website reads Firebase telemetry.',
    facts: [['Candidate ADC1', 'GPIO32 / 33 / 34 / 35; GPIO34 and GPIO35 are input-only'], ['ADC reference', '150–2450 mV suggested range at 11 dB is not a pin absolute maximum.'], ['Cloud read path', 'readings/latest — source tags alone do not prove publisher provenance'], ['No motor command', 'The hardware design does not establish a remotely controlled motor interface.']], source: FILES.pins, query: 'U_ESP' },
  { id: 'JGND', code: 'JGND · W053', title: 'Return topology review', meta: 'Parallel path unresolved', x: 18, y: 338, w: 320,
    lead: 'The source proposes a star reference, but a non-isolated converter creates another return path that must be resolved.',
    facts: [['STAR_RETURN', 'Dedicated Light and Motor home-runs meet the battery return.'], ['LOGIC_GND', 'ESP32, sensor signals, analog filters and the converter output reference'], ['Parallel paths', 'W053 is parallel to W016 → converter OUT−/IN− → W014 → BAT− → W052.'], ['Revision required', 'Do not assume one Kelvin tie or a load-free logic return. See the independent audit and separate hardware proposal.']], source: '03_Circuit_Design/polarity_and_grounding.md', query: 'RETURN' },
];
const PINS = [
  ['GPIO32', 'Light current', 'ADC1_CH4', 'Sensor and U_I_L interface unresolved'],
  ['GPIO33', 'Light voltage', 'ADC1_CH5', '68 kΩ / 10 kΩ proposed divider'],
  ['GPIO34', 'Motor current', 'ADC1_CH6 · input-only', 'Direct ACS712 output scaling conditional'],
  ['GPIO35', 'Motor DC input voltage', 'ADC1_CH7 · input-only', 'Physical board header not established'],
  ['GPIO21 / 22', 'Optional OLED SDA / SCL', 'I²C by firmware', 'Verify 3.3 V pullups and module'],
  ['GPIO4', 'Optional DS18B20 DQ', '1-Wire by firmware', 'Probe wiring and 4.7 kΩ pullup conditional'],
];
const GATES = [
  ['01', 'Identify the actual parts', 'Battery, lamp, motor/controller, current sensors, buck and ESP32 carrier board.'],
  ['02', 'Coordinate protection', 'Resolve fuse curves and DC interruption, conductor sizes, switch and connector ratings.'],
  ['03', 'Resolve faults and sequencing', 'Reverse polarity, transients, motor suppression, GPIO faults and unpowered backfeed.'],
  ['04', 'Validate measurement', 'Define boundaries, calibration uncertainty, sampling, synchronization and missing records.'],
];
function sourceLink(file, label = 'Read source document ↗') { return `<a class="lab-source" href="${PACKAGE}${file}" target="_blank" rel="noopener">${label}</a>`; }
function field(id, label, value, min, max, step = 'any') {
  return `<label class="lab-field" for="${id}"><span>${label}</span><input id="${id}" type="number" value="${value}" min="${min}" max="${max}" step="${step}" inputmode="decimal"></label>`;
}
function result(label, value, unit) { return `<div class="lab-result"><span>${label}</span><strong>${value}<small>${unit}</small></strong></div>`; }

export async function initEngineeringLab(target = document.getElementById('engineering-lab')) {
  if (!target || target.dataset.initialized) return;
  target.dataset.initialized = 'true';
  target.innerHTML = `
    <div class="lab-inline-warning"><strong>Physical build review: revision required.</strong> The inherited diagram has a possible converter ground loop, unresolved protection and incompatible light-sensor alternatives. The 3D model preserves that source for inspection. <a href="docs/advanced-circuit-audit.md" target="_blank" rel="noopener">Read the independent electrical audit ↗</a></div>
    <div class="lab-tabs" role="tablist" aria-label="Engineering workspace">
      ${[['physical', '3D physical assembly'], ['schematic', 'Electrical schematic'], ['hardware', 'Hardware proposal'], ['wiring', 'Wiring layout'], ['architecture', 'Architecture'], ['register', 'Wiring & components'], ['calculations', 'Calculations']].map(([id, name], i) => `<button type="button" role="tab" id="lab-tab-${id}" aria-controls="lab-panel-${id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-lab-tab="${id}">${name}</button>`).join('')}
    </div>
    <section id="lab-panel-physical" class="lab-tab-panel" role="tabpanel" aria-labelledby="lab-tab-physical"><div id="circuit-physical-assembly"><p class="lab-caption">Loading the 3D assembly and original connection records…</p></div></section>
    <section id="lab-panel-wiring" class="lab-tab-panel" role="tabpanel" aria-labelledby="lab-tab-wiring" hidden><div id="physical-wiring-layout"><p class="lab-caption">Loading the original source connections…</p></div></section>
    <section id="lab-panel-hardware" class="lab-tab-panel" role="tabpanel" aria-labelledby="lab-tab-hardware" hidden><div id="hardware-proposal"><p>Preparing the separate hardware purchase and wiring proposal…</p></div></section>
    <section id="lab-panel-architecture" class="lab-tab-panel" role="tabpanel" aria-labelledby="lab-tab-architecture" hidden>
      <div class="lab-architecture-layout">
        <div class="lab-board">
          <div class="lab-board-heading"><div><span class="lab-kicker">CONDITIONAL REFERENCE / REV. 02 NOV 2026</span><h3>Follow the energy. Isolate the signal.</h3></div><span class="lab-domain">12 V</span></div>
          <div class="lab-diagram-scroll" aria-label="Interactive functional architecture">
            <div class="lab-diagram">
              <svg class="lab-routes" viewBox="0 0 840 480" aria-hidden="true">
                <defs><pattern id="lab-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.7" fill="currentColor"/></pattern></defs>
                <rect width="840" height="480" fill="url(#lab-grid)" class="lab-grid-dots"/>
                <g class="lab-power-route"><path d="M150 230 H187 M338 230 H370 V76 H401 M370 230 H401 M370 230 V384 H401 M568 76 H639 M568 230 H639 M568 384 H639"/></g>
                <g class="lab-signal-route"><path d="M484 122 V150 H608 V344 M723 122 V138 H623 V344 M484 276 V306 H608 V344 M723 276 V306 H623"/></g>
                <g class="lab-return-route"><path d="M85 276 V338 M177 430 V452 H724 V430 M564 452 V430"/></g>
                <g class="lab-junction"><circle cx="370" cy="230" r="4"/><circle cx="370" cy="76" r="3"/><circle cx="370" cy="384" r="3"/></g>
                <text x="575" y="151" class="lab-wire-label" transform="rotate(90 575 151)">CONDITIONED SIGNALS</text>
                <text x="350" y="22" class="lab-wire-label">LIGHT</text><text x="350" y="177" class="lab-wire-label">MOTOR</text><text x="350" y="331" class="lab-wire-label">LOGIC</text>
              </svg>
              ${COMPONENTS.map((c, i) => `<button type="button" class="lab-node${i === 0 ? ' is-selected' : ''}" data-lab-component="${c.id}" aria-pressed="${i === 0}" style="--node-x:${c.x / 8.4}%;--node-y:${c.y / 4.8}%;--node-w:${c.w / 8.4}%"><span class="lab-node-code">${c.code}</span><strong>${c.title}</strong><span>${c.meta}</span></button>`).join('')}
            </div>
          </div>
          <div class="lab-legend"><span><i class="lab-legend-power"></i>Power flow</span><span><i class="lab-legend-signal"></i>Conditioned signal</span><span><i class="lab-legend-return"></i>Reference return</span></div>
          <p class="lab-caption">Functional overview only. Select a block to inspect its measurement boundary. Use the original schematic and wiring register for the complete conditional design.</p>
        </div>
        <aside class="lab-inspector" aria-label="Selected component" aria-live="polite"></aside>
      </div>
      <div class="lab-open-gates"><div><span class="lab-kicker">OPEN ENGINEERING GATES</span><h3>Evidence comes before energization.</h3>${sourceLink(FILES.safety, 'Review all unresolved decisions ↗')}</div><div class="lab-gates">${GATES.map(([n, name, text]) => `<div><span>${n}</span><section><h4>${name}</h4><p>${text}</p></section></div>`).join('')}</div></div>
    </section>
    <section id="lab-panel-schematic" class="lab-tab-panel" role="tabpanel" aria-labelledby="lab-tab-schematic" hidden>
      <div class="lab-section-heading"><div><span class="lab-kicker">ELECTRICAL SYMBOLS / SAME SOURCE NETLIST</span><h3>Electrical schematic diagram</h3></div><div class="lab-zoom-controls"><button type="button" data-lab-primary-zoom="out" aria-label="Zoom electrical schematic out">−</button><output id="lab-primary-zoom-level">100%</output><button type="button" data-lab-primary-zoom="in" aria-label="Zoom electrical schematic in">+</button><button type="button" data-lab-primary-zoom="reset">Fit diagram</button></div></div>
      <div id="lab-conventional-schematic"><p class="lab-caption">Loading the electrical schematic from the same source connections…</p></div>
      <details class="lab-original-schematic"><summary>Preserved engineering-package source drawing</summary>
      <div class="lab-section-heading"><div><span class="lab-kicker">PRESERVED SOURCE DRAWING</span><h3>Complete conditional schematic</h3></div><div class="lab-zoom-controls"><button type="button" data-lab-zoom="out" aria-label="Zoom schematic out">−</button><output id="lab-zoom-level">100%</output><button type="button" data-lab-zoom="in" aria-label="Zoom schematic in">+</button><button type="button" data-lab-zoom="reset">Fit</button></div></div>
      <div class="lab-schematic-viewport" tabindex="0" aria-label="Scrollable schematic. Use zoom controls to enlarge, then scroll to inspect."><img id="lab-schematic-image" src="${PACKAGE}${FILES.schematic}" alt="Original final-package two-load schematic showing separate Light and Motor sensors, three fused branches, ESP32 conditioned ADC channels and Kelvin star grounding" loading="lazy"></div>
      <div class="lab-schematic-footer"><p>Enlarge and scroll to inspect. This original drawing is preserved with its engineering evidence; it is not an as-built record.</p>${sourceLink(FILES.schematic, 'Open full-size SVG ↗')}</div>
      <p class="lab-inline-warning">Protection remains conditional. RP1 is a placeholder; its insertion is not fully scheduled. W060 describes the TVS anode return in its note without a separate return row. Resolve these details before construction.</p>
      </details>
    </section>
    <section id="lab-panel-register" class="lab-tab-panel" role="tabpanel" aria-labelledby="lab-tab-register" hidden>
      <div class="lab-section-heading"><div><span class="lab-kicker">DIRECT FROM THE ENGINEERING PACKAGE</span><h3>Trace the design</h3></div><span class="lab-data-status" role="status">Loading source registers…</span></div>
      <div class="lab-register-controls"><label class="lab-field"><span>Register</span><select id="lab-register-kind"><option value="wires">Wiring connections</option><option value="bom">Component register</option></select></label><label class="lab-field lab-search"><span>Find a component, wire or condition</span><input type="search" id="lab-register-search" placeholder="e.g. GPIO34, W053, fuse" autocomplete="off"></label><button class="lab-action" type="button" id="lab-register-clear">Clear search</button></div>
      <div class="lab-register-results" aria-live="polite"></div>
      <div class="lab-register-sources">${sourceLink(FILES.wires, 'Original wiring CSV ↗')}${sourceLink(FILES.bom, 'Original component CSV ↗')}</div>
      <div class="lab-section-heading lab-pin-heading"><div><span class="lab-kicker">LOGICAL CANDIDATES ONLY</span><h3>ESP32 signal map</h3></div>${sourceLink(FILES.pins, 'Board conditions ↗')}</div>
      <div class="lab-pin-grid">${PINS.map(([pin, name, type, note]) => `<div class="lab-pin"><strong>${pin}</strong><div><h4>${name}</h4><span>${type}</span><p>${note}</p></div></div>`).join('')}</div>
      <p class="lab-caption">These are classic ESP32 logical pins, not verified header positions. Optional 3V3 supply and module compatibility require the exact board documentation.</p>
    </section>
    <section id="lab-panel-calculations" class="lab-tab-panel" role="tabpanel" aria-labelledby="lab-tab-calculations" hidden>
      <div class="lab-section-heading"><div><span class="lab-kicker">ARITHMETIC WORKSPACE / NO HARDWARE INPUT</span><h3>Explore the transfer functions</h3></div><label class="lab-field"><span>Calculation</span><select id="lab-calculation-kind"><option value="divider">Voltage divider</option><option value="current">Current-sensor scaler</option><option value="energy">Branch energy & cost</option></select></label></div>
      <div class="lab-calculation" data-lab-calculation="divider"><div class="lab-calc-inputs"><p class="lab-calc-intro">The package proposes a 68 kΩ / 10 kΩ divider. Change values to explore the arithmetic; these edits do not change the engineering design.</p><div class="lab-field-grid">${field('lab-divider-voltage', 'DC input (V)', 18, 0, 60)}${field('lab-divider-top', 'Top resistor (kΩ)', 68, .01, 10000)}${field('lab-divider-bottom', 'Bottom resistor (kΩ)', 10, .01, 10000)}${field('lab-divider-tolerance', 'Each resistor tolerance (%)', 1, 0, 10)}</div><p class="lab-formula">V<sub>ADC</sub> = V<sub>IN</sub> × R<sub>bottom</sub> / (R<sub>top</sub> + R<sub>bottom</sub>)</p>${sourceLink(FILES.voltage)}</div><div id="lab-divider-result" class="lab-calc-output" aria-live="polite"></div></div>
      <div class="lab-calculation" data-lab-calculation="current" hidden><div class="lab-calc-inputs"><p class="lab-calc-intro">Conditional direct ACS712-30A output: 5.00 V supply, 2.50 V nominal zero, 66 mV/A typical at 25 °C, and a 27 kΩ / 20 kΩ scaler. The unknown breakout may differ.</p>${field('lab-current-amperes', 'Illustrative primary current (A)', .5, -30, 30)}<p class="lab-formula">V<sub>ADC</sub> = (2.50 + 0.066 × I) × 20 / 47</p><p class="lab-caption">The ±60 mV ADC example below is one error term, not a total uncertainty budget. No physical sensor calibration is represented.</p>${sourceLink(FILES.current)}</div><div id="lab-current-result" class="lab-calc-output" aria-live="polite"></div></div>
      <div class="lab-calculation" data-lab-calculation="energy" hidden><div class="lab-calc-inputs"><p class="lab-calc-intro">The package’s two-load worked example. Values here are arithmetic assumptions, never physical telemetry.</p><h4>Light branch</h4><div class="lab-field-grid lab-field-grid-three">${field('lab-energy-light-voltage', 'Voltage (V)', 12, 0, 60)}${field('lab-energy-light-current', 'Current (A)', .5, 0, 1000)}${field('lab-energy-light-hours', 'Duration (h)', 2, 0, 10000)}</div><h4>Motor DC input branch</h4><div class="lab-field-grid lab-field-grid-three">${field('lab-energy-motor-voltage', 'Voltage (V)', 12, 0, 60)}${field('lab-energy-motor-current', 'Current (A)', 4, 0, 1000)}${field('lab-energy-motor-hours', 'Duration (h)', .25, 0, 10000)}</div>${field('lab-energy-tariff', 'Assumed tariff (₹/kWh)', 8, 0, 100000)}<p class="lab-formula">E = V × I × t &nbsp; · &nbsp; Cost = E<sub>Wh</sub> / 1000 × tariff</p>${sourceLink(FILES.energy)}</div><div id="lab-energy-result" class="lab-calc-output" aria-live="polite"></div></div>
    </section>`;

  const $ = (selector) => target.querySelector(selector);
  const $$ = (selector) => [...target.querySelectorAll(selector)];
  let hardwarePromise;
  let selected = 'BAT1', registers = null, zoom = 1, primaryZoom = 1;
  function activateTab(id, focus = false) {
    if(id==='hardware'&&!hardwarePromise)hardwarePromise=import('./circuit-review.js').then(m=>m.initHardwareProposal($('#hardware-proposal')));
    $$('[data-lab-tab]').forEach((tab) => { const active = tab.dataset.labTab === id; tab.setAttribute('aria-selected', active); tab.tabIndex = active ? 0 : -1; if (active && focus) tab.focus(); });
    $$('.lab-tab-panel').forEach((panel) => { panel.hidden = panel.id !== 'lab-panel-' + id; });
  }
  $$('[data-lab-tab]').forEach((tab, index, tabs) => {
    tab.addEventListener('click', () => activateTab(tab.dataset.labTab));
    tab.addEventListener('keydown', (event) => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next !== undefined) { event.preventDefault(); activateTab(tabs[next].dataset.labTab, true); }
    });
  });
  function inspect(id) {
    selected = id;
    const c = COMPONENTS.find((component) => component.id === id);
    if (!c) return;
    $$('[data-lab-component]').forEach((button) => { const active = button.dataset.labComponent === id; button.classList.toggle('is-selected', active); button.setAttribute('aria-pressed', active); });
    const matching = registers?.wires.filter((wire) => Object.values(wire).some((value) => value.toLowerCase().includes(c.query.toLowerCase()))).length;
    $('.lab-inspector').innerHTML = `<span class="lab-kicker">COMPONENT INSPECTOR</span><div class="lab-inspector-code">${c.code}</div><h3>${c.title}</h3><p class="lab-inspector-lead">${c.lead}</p><dl>${c.facts.map(([name, value]) => `<div><dt>${name}</dt><dd>${value}</dd></div>`).join('')}</dl><div class="lab-inspector-footer">${sourceLink(c.source)}<button class="lab-action" type="button" data-lab-trace="${c.query}">Trace connections${matching ? ` · ${matching}` : ''} →</button></div>`;
    $('[data-lab-trace]').addEventListener('click', (event) => { $('#lab-register-kind').value = 'wires'; $('#lab-register-search').value = event.currentTarget.dataset.labTrace; renderRegister(); activateTab('register', true); });
  }
  $$('[data-lab-component]').forEach((button) => button.addEventListener('click', () => inspect(button.dataset.labComponent)));
  inspect(selected);
  $$('[data-lab-zoom]').forEach((button) => button.addEventListener('click', () => {
    zoom = button.dataset.labZoom === 'reset' ? 1 : Math.min(4, Math.max(1, zoom + (button.dataset.labZoom === 'in' ? .5 : -.5)));
    $('#lab-schematic-image').style.width = `${zoom * 100}%`;
    $('#lab-zoom-level').textContent = `${Math.round(zoom * 100)}%`;
    $('[data-lab-zoom="out"]').disabled = zoom === 1;
    $('[data-lab-zoom="in"]').disabled = zoom === 4;
    if (zoom === 1) $('.lab-schematic-viewport').scrollTo({ top: 0, left: 0 });
  }));
  $('[data-lab-zoom="out"]').disabled = true;
  $$('[data-lab-primary-zoom]').forEach(button => button.addEventListener('click', () => {
    primaryZoom = button.dataset.labPrimaryZoom === 'reset' ? 1 : Math.min(8, Math.max(1, primaryZoom + (button.dataset.labPrimaryZoom === 'in' ? .5 : -.5)));
    const drawing = $('.conventional-schematic');
    if (drawing) drawing.style.width = `${primaryZoom * 100}%`;
    $('#lab-primary-zoom-level').textContent = `${Math.round(primaryZoom * 100)}%`;
    $('[data-lab-primary-zoom="out"]').disabled = primaryZoom === 1;
    $('[data-lab-primary-zoom="in"]').disabled = primaryZoom === 8;
    if (primaryZoom === 1) $('.lab-conventional-viewport')?.scrollTo({top:0,left:0});
  }));
  $('[data-lab-primary-zoom="out"]').disabled = true;
  $('#lab-schematic-image').addEventListener('error', () => { $('.lab-schematic-footer p').textContent = 'The schematic could not load. Check the project assets or open the source SVG below.'; });

  function renderRegister() {
    const container = $('.lab-register-results');
    if (!registers) return;
    const kind = $('#lab-register-kind').value;
    const query = $('#lab-register-search').value.trim().toLowerCase();
    const rows = registers[kind].filter((row) => Object.values(row).some((value) => value.toLowerCase().includes(query)));
    const heads = kind === 'wires' ? ['Wire', 'Source → destination', 'Network / condition', 'Engineering note'] : ['ID', 'Proposed component', 'Status / source', 'Audit note'];
    container.innerHTML = `<p class="lab-result-count">${rows.length} of ${registers[kind].length} ${kind === 'wires' ? 'connections' : 'components'}${query ? ' match this search' : ' in the preserved source'}</p>${!rows.length ? '<div class="lab-empty">No matching source records. Try a component identifier or clear the search.</div>' : `<div class="lab-table-scroll"><table class="lab-table"><thead><tr>${heads.map((head) => `<th scope="col">${head}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => kind === 'wires' ? `<tr><th scope="row">${escapeHtml(row.wire_id)}</th><td><code>${escapeHtml(row.source_component)}.${escapeHtml(row.source_terminal)}</code><span class="lab-connection-arrow">→</span><code>${escapeHtml(row.destination_component)}.${escapeHtml(row.destination_terminal)}</code></td><td><span class="lab-net">${escapeHtml(row.net_or_domain)}</span><span class="lab-condition">${escapeHtml(row.status)}</span></td><td>${escapeHtml(row.evidence_or_condition)}</td></tr>` : `<tr><th scope="row">${escapeHtml(row.ID)}</th><td><strong>${escapeHtml(row.Class)}</strong><span class="lab-bom-rating">${escapeHtml(row['Proposed identity / rating'])}</span></td><td><span class="lab-condition">${escapeHtml(row.Status)}</span><span class="lab-net">Source ${escapeHtml(row['Evidence source'])} · Qty ${escapeHtml(row.Qty)}</span></td><td>${escapeHtml(row['Audit note'])}</td></tr>`).join('')}</tbody></table></div>`}`;
  }
  $('#lab-register-kind').addEventListener('change', renderRegister);
  $('#lab-register-search').addEventListener('input', renderRegister);
  $('#lab-register-clear').addEventListener('click', () => { $('#lab-register-search').value = ''; renderRegister(); $('#lab-register-search').focus(); });
  $('#lab-calculation-kind').addEventListener('change', (event) => { $$('[data-lab-calculation]').forEach((calc) => { calc.hidden = calc.dataset.labCalculation !== event.target.value; }); });
  const inputValue = (id) => { const input = $('#' + id); return input.value.trim() === '' ? NaN : Number(input.value); };
  const invalidResult = '<p class="lab-inline-warning" role="alert">Enter finite values within the displayed input limits to calculate.</p>';
  function updateCalculations() {
    const divider = calculateDivider({ voltage: inputValue('lab-divider-voltage'), topKohm: inputValue('lab-divider-top'), bottomKohm: inputValue('lab-divider-bottom'), tolerancePercent: inputValue('lab-divider-tolerance') });
    $('#lab-divider-result').innerHTML = !divider ? invalidResult : `<span class="lab-kicker">CALCULATED ADC NODE</span><div class="lab-primary-result">${number(divider.nominalV, 4)}<span>V nominal</span></div><div class="lab-result-grid">${result('Worst high corner', number(divider.maximumV, 4), 'V')}${result('Worst low corner', number(divider.minimumV, 4), 'V')}${result('Divider ratio', number(divider.ratio, 6), '')}${result('Total dissipation', number(divider.dissipationMw, 3), 'mW')}</div><div class="lab-adc-scale" aria-label="ADC voltage relative to the suggested 2.45 V upper measurement range"><div style="width:${Math.min(100, Math.max(0, divider.maximumV / 2.45 * 100))}%" class="${divider.marginV < 0 ? 'outside' : ''}"></div></div><p class="lab-calc-note">Worst-corner ${divider.marginV < 0 ? 'excess above' : 'margin below'} the cited 2.45 V range: <strong>${number(Math.abs(divider.marginV) * 1000, 1)} mV</strong>.</p><p class="lab-inline-warning">${divider.maximumV > 2.45 || divider.minimumV < .15 ? 'Outside the cited 0.15–2.45 V measurement window at one or more corners. ' : ''}This window is an ADC characterization reference, not construction approval or a pin absolute-maximum rating. Transients and power sequencing are not included.</p>`;
    const current = calculateCurrentScaler(inputValue('lab-current-amperes'));
    $('#lab-current-result').innerHTML = !current ? invalidResult : `<span class="lab-kicker">SCALED SENSOR OUTPUT</span><div class="lab-primary-result">${number(current.nodeV, 4)}<span>V at ADC</span></div><div class="lab-result-grid">${result('Raw IC output', number(current.rawV, 4), 'V')}${result('Change from zero', number(current.shiftMv, 2), 'mV')}${result('Scaled sensitivity', number(current.scaledSensitivityMvA, 3), 'mV/A')}${result('±60 mV equivalent', '±' + number(current.adcErrorA, 3), 'A')}</div><p class="lab-inline-warning">A small ADC voltage change does not establish useful current resolution. Offset, gain, temperature, supply drift and actual module conditioning still require calibration.</p>`;
    const energy = calculateBranchEnergy({ lightVoltage: inputValue('lab-energy-light-voltage'), lightCurrent: inputValue('lab-energy-light-current'), lightHours: inputValue('lab-energy-light-hours'), motorVoltage: inputValue('lab-energy-motor-voltage'), motorCurrent: inputValue('lab-energy-motor-current'), motorHours: inputValue('lab-energy-motor-hours'), tariff: inputValue('lab-energy-tariff') });
    $('#lab-energy-result').innerHTML = !energy ? invalidResult : `<span class="lab-kicker">SUM OF THE TWO LOAD BRANCHES</span><div class="lab-primary-result">${number(energy.totalWh, 3)}<span>Wh</span></div><div class="lab-result-grid">${result('Light energy', number(energy.lightWh, 3), 'Wh')}${result('Motor input energy', number(energy.motorWh, 3), 'Wh')}${result('Light / Motor power', number(energy.lightPowerW, 1) + ' / ' + number(energy.motorPowerW, 1), 'W')}${result('Energy charge', '₹' + number(energy.cost, 3), '')}</div><p class="lab-inline-warning">Excludes electronics-branch demand, charging losses and billing rules. Different branch durations are integrated separately. This is an assumed arithmetic example.</p>`;
  }
  $$('.lab-calculation input').forEach((input) => input.addEventListener('input', updateCalculations));
  updateCalculations();
  async function loadRegisters() {
    $('.lab-data-status').textContent = 'Loading source registers…';
    try {
      const texts = await Promise.all([FILES.wires, FILES.bom].map(async (file) => {
        const response = await fetch(PACKAGE + file);
        if (!response.ok) throw new Error(`Source file returned HTTP ${response.status}`);
        return response.text();
      }));
      registers = { wires: parseEngineeringCsv(texts[0]), bom: parseEngineeringCsv(texts[1]) };
      if (!registers.wires.every((row) => row.wire_id && row.evidence_or_condition) || !registers.bom.every((row) => row.ID && row['Audit note']) || !registers.wires.length || !registers.bom.length) throw new Error('Source register format was not recognized');
      $('.lab-data-status').textContent = `${registers.bom.length} components · ${registers.wires.length} connections`;
      initWiringLayout($('#physical-wiring-layout'), registers);
      renderRegister(); inspect(selected);
      const sourceData = registers;
      import('./circuit-lab.js').then(({initCircuitLab}) => initCircuitLab($('#circuit-physical-assembly'), sourceData)).catch(error => {
        $('#circuit-physical-assembly').innerHTML = `<p class="lab-empty" role="alert">3D viewer could not initialize: ${escapeHtml(error.message)}. The source schematic and wiring register remain available.</p>`;
      });
      import('./circuit-schematic.js').then(({renderCircuitSchematic}) => {
        $('#lab-conventional-schematic').innerHTML = renderCircuitSchematic(sourceData.wires, sourceData.bom);
        const drawing = $('.conventional-schematic'), viewport = document.createElement('div');
        viewport.className = 'lab-conventional-viewport'; viewport.tabIndex = 0;
        viewport.setAttribute('aria-label','Electrical schematic. Use zoom controls and scroll to inspect.');
        drawing.before(viewport); viewport.append(drawing);
      }).catch(error => {
        $('#lab-conventional-schematic').innerHTML = `<p class="lab-empty" role="alert">The conventional schematic could not load: ${escapeHtml(error.message)}. Open the preserved source drawing below.</p>`;
      });
    } catch (error) {
      registers = null;
      $('.lab-data-status').textContent = 'Source register unavailable';
      $('.lab-register-results').innerHTML = '<div class="lab-empty" role="alert">Could not load the source registers. Serve the project over HTTP and check the original CSV links below.<button class="lab-action" type="button" id="lab-retry">Retry source load</button></div>';
      $('#physical-wiring-layout').innerHTML = '<div class="lab-empty" role="alert">The source wiring layout could not load. Check that the project is served over HTTP and the original source files are available.<button class="lab-action" type="button" id="wiring-source-retry">Retry wiring load</button></div>';
      $('#circuit-physical-assembly').innerHTML = '<p class="lab-empty" role="alert">The original connection records are unavailable. The 3D assembly cannot be validated until they load.</p>';
      $('#lab-retry').addEventListener('click', loadRegisters);
      $('#wiring-source-retry').addEventListener('click', loadRegisters);
    }
  }
  await loadRegisters();
}
