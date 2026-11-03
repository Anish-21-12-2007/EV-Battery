import { normalizeTelemetryRecord } from "./telemetry.js?v=20261103";
import { createEvSimulation } from "./ev-simulation-engine.js?v=20261103";
import { EV_SIM_DEFAULTS, EV_VEHICLE_MANIFEST, EV_DRIVING_SCENARIOS } from "./ev-vehicle-data.js?v=20261103";
import { updateLineChart } from "./charts.js?v=20261103";
import { drivetrainKinematics } from './drivetrain-kinematics.js';

"use strict";

const byId = (id) => document.getElementById(id);
const format = (value, decimals = 2) => Number.isFinite(value) ? value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : "N/A";
const chartRecords = [];
const chartDefinitions = [
  { id: "voltage-chart", key: "voltage", color: "#287da0", decimals: 2 },
  { id: "current-chart", key: "current", color: "#9c64bf", decimals: 2 },
  { id: "power-chart", key: "reportedPowerW", color: "#be842b", decimals: 1 },
];
let telemetry = null;
let telemetryState = "waiting";
let simulation = createEvSimulation(EV_VEHICLE_MANIFEST, EV_SIM_DEFAULTS);
let rafId = 0;
let lastFrameTime = null;
let lastChartSimulationTime = -1;
const simulationPowerHistory = [];
const runRecords = [];
let studio = null;
let studioPromise = null;
let engineeringPromise = null;
let activeView = 'simulator';
const controlsPanel = document.querySelector('.controls-panel');
if (controlsPanel) byId('vehicle-controls-slot')?.append(controlsPanel);

async function ensureStudio() {
  if (studioPromise) return studioPromise;
  studioPromise = import('./vehicle-studio.js?v=20261103.3').then(async ({ createVehicleStudio }) => {
    studio = await createVehicleStudio(() => simulation.getState());
    studio.setActive(activeView === 'simulator');
    return studio;
  }).catch(() => {
    byId('vehicle-loading').hidden = true;
    byId('vehicle-fallback').hidden = false;
  });
  return studioPromise;
}
byId('studio-retry')?.addEventListener('click', () => {
  studio?.dispose(); studio = null; studioPromise = null;
  byId('vehicle-loading').hidden = false; byId('vehicle-fallback').hidden = true;
  ensureStudio();
});

function setText(id, value) {
  const element = byId(id);
  if (element && element.textContent !== String(value)) element.textContent = value;
}

function setView(view, updateHash = true) {
  const known = ["monitor", "circuit", "simulator"];
  const selected = known.includes(view) ? view : "simulator";
  activeView = selected;
  document.querySelectorAll("[data-section]").forEach((section) => {
    section.hidden = section.dataset.section !== selected;
  });
  document.querySelectorAll("[data-view]").forEach((button) => {
    const active = button.dataset.view === selected;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  if (updateHash && window.location.hash !== "#" + selected) history.replaceState(null, "", "#" + selected);
  const menu = byId("mobile-nav");
  const toggle = byId("menu-toggle");
  if (menu) menu.hidden = true;
  if (toggle) { toggle.setAttribute("aria-expanded", "false"); toggle.setAttribute("aria-label", "Open navigation"); }
  if (selected === 'simulator') ensureStudio();
  studio?.setActive(selected === 'simulator');
  if (selected === 'circuit' && !engineeringPromise) {
    engineeringPromise = import('./engineering-lab.js').then(module => module.initEngineeringLab()).catch(() => {
      byId('engineering-lab').textContent = 'The interactive lab could not load. The complete original engineering reference is available below.';
    });
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
document.querySelectorAll("[data-go]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.go)));
byId("menu-toggle")?.addEventListener("click", () => {
  const menu = byId("mobile-nav");
  const button = byId("menu-toggle");
  if (!menu || !button) return;
  menu.hidden = !menu.hidden;
  button.setAttribute("aria-expanded", String(!menu.hidden));
  button.setAttribute("aria-label", menu.hidden ? "Open navigation" : "Close navigation");
});
window.addEventListener("hashchange", () => setView(window.location.hash.slice(1), false));
setView(window.location.hash.slice(1), false);

function applyTheme(theme) {
  const selected = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = selected;
  try { localStorage.setItem("ecs-theme", selected); } catch (_) { /* storage can be disabled */ }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = selected === "dark" ? "#11191d" : "#f2f5f7";
}
applyTheme('dark');
byId("theme-toggle-btn")?.addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));

function renderTelemetryCharts() {
  chartDefinitions.forEach((chart) => updateLineChart(byId(chart.id), {values:chartRecords, key:chart.key, timeKey:"timestamp", unit:chart.key === "voltage" ? "V" : chart.key === "current" ? "A" : "W", decimals:chart.decimals, color:chart.color}));
  const empty = byId("chart-empty");
  if (empty) empty.hidden = chartRecords.length > 0;
}

function renderRecentReadings() {
  const body = byId("recent-readings");
  if (!body) return;
  body.replaceChildren();
  if (!chartRecords.length) {
    const row = document.createElement("tr"), cell = document.createElement("td");
    cell.colSpan = 5; cell.className = "empty-cell"; cell.textContent = "No telemetry records received."; row.append(cell); body.append(row); return;
  }
  chartRecords.slice(-8).reverse().forEach((reading) => {
    const row = document.createElement("tr");
    const values = [new Date(reading.timestamp).toLocaleTimeString(), format(reading.voltage, 2), format(reading.current, 2), format(reading.reportedPowerW, 1), format(reading.energyWh, 3)];
    values.forEach((value) => { const cell = document.createElement("td"); cell.textContent = value; row.append(cell); });
    body.append(row);
  });
}

function renderTelemetry(reading) {
  telemetry = reading;
  const fields = [
    ["metric-voltage", reading?.voltage, 2],
    ["metric-current", reading?.current, 2],
    ["metric-light-current", reading?.lightCurrentA, 2],
    ["metric-motor-current", reading?.motorCurrentA, 2],
    ["metric-light-power", reading?.lightPowerW, 2],
    ["metric-motor-power", reading?.motorPowerW, 2],
    ["metric-energy", reading?.energyWh, 3],
    ["metric-temperature", reading?.temperatureC, 1],
  ];
  fields.forEach(([id, value, digits]) => setText(id, value === null || value === undefined ? "N/A" : format(value, digits)));
  setText("metric-motor-state", reading?.motorOn === null || reading?.motorOn === undefined ? "N/A" : reading.motorOn ? "ON" : "OFF");
  if (reading?.computedBranchTotalPowerW !== null && reading?.computedBranchTotalPowerW !== undefined) {
    setText("metric-total-power", format(reading.computedBranchTotalPowerW, 2));
    setText("total-power-note", "Computed from both branch V × I values");
  } else if (reading) {
    setText("metric-total-power", format(reading.reportedPowerW, 2));
    setText("total-power-note", "ESP32-reported aggregate; branch split unavailable");
  } else {
    setText("metric-total-power", "N/A"); setText("total-power-note", "Awaiting telemetry");
  }
  if (reading) {
    const timestamp = new Date(reading.timestamp);
    setText("last-updated", "Record time " + timestamp.toLocaleString());
    const old = chartRecords.at(-1);
    if (old && old.timestamp === reading.timestamp) chartRecords[chartRecords.length - 1] = reading;
    else chartRecords.push(reading);
    while (chartRecords.length > 30) chartRecords.shift();
  } else {
    setText("last-updated", "No record yet");
    chartRecords.length = 0;
  }
  renderTelemetryCharts(); renderRecentReadings(); updateMonitorCost();
}

function updateMonitorCost() {
  const input = byId("monitor-tariff");
  const tariff = input && input.value.trim() !== "" ? Number(input.value) : null;
  const cost = telemetry && tariff !== null && Number.isFinite(tariff) && tariff >= 0 ? (telemetry.energyWh / 1000) * tariff : null;
  setText("monitor-cost", cost === null ? "N/A" : "₹" + format(cost, 2));
}
byId("monitor-tariff")?.addEventListener("input", updateMonitorCost);

function setTelemetryStatus(state, message) {
  telemetryState = state;
  const text = message || ({
    "signed-out": "Sign in to read telemetry",
    connecting: "Waiting for database connection",
    waiting: "Connected · waiting for a valid sensor record",
    fresh: "ESP32-tagged record received · provenance unverified",
    stale: "Stale record · current device state unknown",
    invalid: "Latest record failed validation",
    "permission-denied": "Firebase read permission denied",
    error: "Firebase connection error",
    "not-configured": "Firebase not configured",
  }[state] || "Telemetry state unavailable");
  setText("firebase-data-state", text);
  const banner = byId("device-banner"), bannerText = byId("device-banner-text");
  if (banner) banner.dataset.state = state === "fresh" ? "fresh" : ["error", "invalid", "permission-denied", "not-configured"].includes(state) ? "error" : "off";
  if (bannerText) bannerText.textContent = state === "fresh" ? "ESP32-tagged record received · source not independently verified" : "No confirmed current physical reading";
  setText("top-status", state === "fresh" ? "Telemetry record received" : state === "waiting" ? "Waiting for sensor record" : "Hardware data unavailable");
  if (["signed-out", "connecting", "waiting", "invalid", "permission-denied", "error", "not-configured"].includes(state)) renderTelemetry(null);
}

function setFirebaseConnectivity(connected) {
  setText("firebase-connection-state", connected === true ? "Connected" : connected === false ? "Disconnected" : "Checking");
}

function setAuthUi(state, message = "") {
  setText("auth-state", ({ checking: "Checking Firebase…", "signed-out": "Signed out", "signing-in": "Signing in…", authenticated: "Authenticated", error: "Authentication unavailable" }[state] || state));
  const authState = byId("auth-state");
  if (authState) authState.dataset.state = state === "error" ? "error" : "";
  const form = byId("auth-form"), session = byId("auth-session"), submit = byId("auth-submit");
  if (form) form.hidden = state !== "signed-out" && state !== "signing-in";
  if (session) session.hidden = state !== "authenticated";
  if (submit) submit.disabled = state !== "signed-out";
  const feedback = byId("auth-feedback");
  if (feedback) { feedback.textContent = message; feedback.hidden = !message; }
}

function resetTelemetry() { renderTelemetry(null); }

// Only real Firebase records are passed through this adapter. There is no demo telemetry producer.
window.ECSBatteryData = Object.freeze({
  ingestReading(record) {
    const normalized = normalizeTelemetryRecord(record);
    if (!normalized) return false;
    renderTelemetry(normalized); return true;
  },
  resetTelemetry,
  setTelemetryStatus,
  setFirebaseConnectivity,
  setAuthUi,
  setView,
});

function stopSimulationLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0; lastFrameTime = null;
}
function startSimulationLoop() {
  stopSimulationLoop();
  function frame(now) {
    if (!simulation.getState().running) { stopSimulationLoop(); return; }
    if (document.hidden) lastFrameTime = now;
    else if (lastFrameTime !== null) simulation.step(Math.min((now - lastFrameTime) / 1000, 0.1));
    lastFrameTime = now;
    rafId = requestAnimationFrame(frame);
  }
  rafId = requestAnimationFrame(frame);
}
document.addEventListener("visibilitychange", () => { if (document.hidden) lastFrameTime = null; });

function renderSimulationChart(state) {
  if (state.simulatedSeconds > lastChartSimulationTime + 0.4) {
    simulationPowerHistory.push({ time: state.simulatedSeconds, powerW: state.powerW });
    while (simulationPowerHistory.length > 150) simulationPowerHistory.shift();
    if (state.running) runRecords.push({time:state.simulatedSeconds,speed:state.speedKmh,voltage:state.voltageV,current:state.currentA,power:state.powerW,energy:state.netEnergyWh,soc:state.socPercent,regen:state.regenW});
    if(runRecords.length>7200)runRecords.shift();
    lastChartSimulationTime = state.simulatedSeconds;
    updateLineChart(byId('sim-power-chart'), {values:simulationPowerHistory,key:'powerW',timeKey:'time',unit:'W',decimals:0,simulation:true});
  }
}

function renderDeviceEnergy(state) {
  const root=byId('sim-device-energy');if(!root)return;
  const maximum=Math.max(...state.devices.map(d=>d.energyWh),.0001);
  if (!root.querySelector('.energy-row')) {
    root.replaceChildren();
    state.devices.forEach(device=>{
      const row=document.createElement('div');row.className='energy-row';row.dataset.device=device.id;
      const name=document.createElement('span');name.textContent=device.name;
      const track=document.createElement('span');track.className='energy-track';track.setAttribute('aria-hidden','true');track.append(document.createElement('i'));
      const value=document.createElement('strong');row.append(name,track,value);root.append(row);
    });
  }
  state.devices.forEach(device=>{
    const row=root.querySelector('[data-device="'+device.id+'"]');
    row.querySelector('i').style.width=Math.max(0,device.energyWh/maximum*100).toFixed(1)+'%';
    row.querySelector('strong').textContent=format(device.energyWh,3)+' Wh';
  });
}

function syncAssumptionInputs(state) {
  document.querySelectorAll('[data-assumption]').forEach(input => {
    let value = state.assumptions[input.dataset.assumption];
    if (value === undefined) return;
    if (input.dataset.speedConversion === 'true') value *= 3.6;
    if (input.dataset.percentConversion === 'true') value *= 100;
    input.value = String(Number(value.toFixed(5)));
  });
}

function renderSimulation(state) {
  const {wheelRpm,motorRpm,wheelAngularVelocityRadS,motorAngularVelocityRadS}=drivetrainKinematics(state);
  setText('studio-motion',state.running?(state.speedMps>.02?`${format(wheelRpm,0)} rpm · ${format(state.speedKmh,1)} km/h`:'Stationary · enable drive to turn the wheels'):'Paused · press Drive to see the wheels turn');
  setText('studio-run',state.running?'Pause simulation':'Start simulation ↗');
  setText("sim-status", state.running ? (state.tractionEnabled ? "Running · motor enabled" : "Running · loads only") : "Paused · ready");
  const start = byId("sim-start"), stop = byId("sim-stop");
  if (start) start.disabled = state.running;
  if (stop) stop.disabled = !state.running;
  setText("sim-speed", format(state.speedKmh, 1));
  setText("sim-distance", state.distanceM < 1000 ? format(state.distanceM, 0) + " m traveled" : format(state.distanceM / 1000, 2) + " km traveled");
  setText("sim-soc", format(state.socPercent, 1));
  const socBar = byId("sim-soc-bar"); if (socBar) socBar.style.width = state.socPercent.toFixed(2) + "%";
  setText("sim-pack-power", format(state.powerW, 1));
  setText("sim-net-energy", format(state.netEnergyWh, 3));
  setText("sim-gross-energy", format(state.grossBatteryEnergyWh, 3));
  setText("sim-recovered-energy", format(state.recoveredBatteryEnergyWh, 3));
  setText("sim-range", state.estimatedRangeKm === null ? "N/A" : format(state.estimatedRangeKm, 1));
  setText("sim-range-unit", state.estimatedRangeKm === null ? "" : "km");
  setText("sim-range-note", state.estimatedRangeKm === null ? "Requires at least 0.5 km and positive net consumption" : "Scenario extrapolation · " + format(state.netWhPerKm, 1) + " net Wh/km");
  setText("sim-cost", state.costInr === null ? "N/A" : format(state.costInr, 2));
  const tariffInput = byId('sim-tariff');
  if (tariffInput) {
    const error = state.costCalculationStatus === 'numeric-overflow' ? 'Tariff too large for cost calculation. Enter a smaller value.' : '';
    tariffInput.setCustomValidity(error);
    tariffInput.setAttribute('aria-invalid', String(Boolean(error)));
    tariffInput.title = error;
  }
  setText('sim-capacity-note', `Scenario battery: ${format(state.nominalPackEnergyWh / 1000, 2)} kWh nominal; ${format(state.usablePackEnergyWh / 1000, 2)} kWh assumed usable (${format(state.assumptions.reserveSoc * 100, 0)}% reserve). Usable capacity is unverified. Battery % used = device kWh / assumed usable kWh × 100.`);
  setText("throttle-value", Math.round(state.throttle * 100) + "%");
  setText("brake-value", Math.round(state.braking * 100) + "%");
  const throttleInput = byId("throttle-control"); if (throttleInput) { throttleInput.disabled = !state.tractionEnabled; throttleInput.value = String(Math.round(state.throttle * 100)); }
  const brakeInput = byId("brake-control"); if (brakeInput && state.braking !== Number(brakeInput.value) / 100) brakeInput.value = String(Math.round(state.braking * 100));
  const tractionToggle = byId("device-tractionMotor"); if (tractionToggle) tractionToggle.checked = state.tractionEnabled;
  state.devices.filter((device) => device.id !== "tractionMotor").forEach((device) => {
    const checkbox = byId("device-" + device.id); if (checkbox) { checkbox.disabled = device.ratingW === null; checkbox.checked = device.enabled; }
  });
  state.devices.forEach(device => setText('demand-'+device.id, format(device.demandW || 0, 0)+' W · '+(device.enabled ? state.running && device.demandW > 0 ? 'Operating' : 'Enabled' : 'Off')));
  setText('sim-acceleration',format(state.accelerationMps2,2)+' m/s²');
  setText('sim-voltage',format(state.voltageV,1)+' V');
  setText('sim-current',format(state.currentA,1)+' A');
  setText('sim-forces',format(state.roadLoadForceN,0)+' / '+format(state.tractiveForceN,0)+' N');
  setText('sim-regen',format(state.regenW,0)+' W');
  setText('sim-angular-velocity',format(wheelAngularVelocityRadS,1)+' / '+format(motorAngularVelocityRadS,1)+' rad/s');
  setText('sim-grade-force',format(state.assumptions.roadGradePercent,1)+'% · '+format(state.gravitationalForceN,0)+' N');
  setText('sim-brake-dissipation',format(state.brakingDissipatedEnergyWh,3)+' Wh');
  setText('mech-motor-rpm',format(motorRpm,0)+' rpm');
  setText('mech-wheel-rpm',format(wheelRpm,0)+' rpm');
  setText('mech-ratio',format(state.assumptions.gearRatio,1)+' : 1');
  setText('mech-wheel-torque',format(state.tractiveForceN*state.assumptions.wheelRadiusM,1)+' N·m');
  setText('sim-time',String(Math.floor(state.simulatedSeconds/60)).padStart(2,'0')+':'+String(Math.floor(state.simulatedSeconds%60)).padStart(2,'0'));
  renderDeviceEnergy(state); renderSimulationChart(state);
}
simulation.onChange(renderSimulation);
byId('studio-run')?.addEventListener('click',()=>{if(simulation.getState().running){simulation.stop();stopSimulationLoop();}else{simulation.start();startSimulationLoop();}});
byId('studio-drive')?.addEventListener('click',()=>{simulation.setDeviceEnabled('tractionMotor',true);simulation.setBraking(0);simulation.setThrottle(.18);simulation.start();startSimulationLoop();});

byId("sim-start")?.addEventListener("click", () => { simulation.start(); startSimulationLoop(); });
byId("sim-stop")?.addEventListener("click", () => { simulation.stop(); stopSimulationLoop(); });
byId('sim-trip-reset')?.addEventListener('click', () => {
  const confirmBox = byId('trip-reset-confirm');
  if (confirmBox) {
    confirmBox.hidden = false;
    byId('sim-trip-reset-confirm')?.focus();
  }
});
byId('sim-trip-reset-cancel')?.addEventListener('click', () => {
  const confirmBox = byId('trip-reset-confirm');
  if (confirmBox) confirmBox.hidden = true;
  byId('sim-trip-reset')?.focus();
});
byId('sim-trip-reset-confirm')?.addEventListener('click', () => {
  const confirmBox = byId('trip-reset-confirm');
  if (confirmBox) confirmBox.hidden = true;
  simulation.resetTripEnergy();
  simulationPowerHistory.length = 0; runRecords.length = 0; lastChartSimulationTime = -1;
  showToast('Trip energy reset. Battery charge, device switches and driving state are retained.');
});
byId("sim-reset")?.addEventListener("click", () => {
  const confirmBox = byId('trip-reset-confirm'); if (confirmBox) confirmBox.hidden = true;
  const presetSelect = byId('sim-scenario-preset'); if (presetSelect) presetSelect.value = 'manual';
  simulation.stop(); stopSimulationLoop(); simulationPowerHistory.length = 0; runRecords.length=0; lastChartSimulationTime = -1; simulation.reset();
  const throttle = byId("throttle-control"), brake = byId("brake-control");
  if (throttle) throttle.value = "0"; if (brake) brake.value = "0";
});
byId('sim-scenario-preset')?.addEventListener('change', (event) => {
  const key = event.target.value;
  const preset = EV_DRIVING_SCENARIOS[key];
  if (!preset || key === 'manual') return;
  simulation.setAssumptions({
    ...simulation.getState().assumptions,
    roadGradePercent: preset.assumptions?.roadGradePercent ?? 0,
    rotationalInertiaKgM2: preset.assumptions?.rotationalInertiaKgM2 ?? 0,
  });
  syncAssumptionInputs(simulation.getState());
  simulation.setDeviceEnabled('tractionMotor', Boolean(preset.tractionEnabled));
  simulation.setThrottle(preset.throttle ?? 0);
  simulation.setBraking(preset.braking ?? 0);
  for (const [auxId, enabled] of Object.entries(preset.auxiliaries || {})) {
    simulation.setDeviceEnabled(auxId, Boolean(enabled));
  }
  simulation.start();
  startSimulationLoop();
  showToast(`${preset.label} loaded and running.`);
});
byId("device-tractionMotor")?.addEventListener("change", (event) => simulation.setDeviceEnabled("tractionMotor", event.target.checked));
byId("throttle-control")?.addEventListener("input", (event) => simulation.setThrottle(Number(event.target.value) / 100));
byId("brake-control")?.addEventListener("input", (event) => simulation.setBraking(Number(event.target.value) / 100));
[
  ["headlights", "power-headlights"], ["airConditioning", "power-airConditioning"],
  ["cabinLights", "power-cabinLights"], ["infotainment", "power-infotainment"],
].forEach(([deviceId, inputId]) => {
  const input = byId(inputId), toggle = byId("device-" + deviceId);
  input?.addEventListener("input", () => {
    simulation.setDevicePower(deviceId, input.value === "" ? null : Number(input.value));
    if (toggle) { toggle.disabled = input.value.trim() === "" || !Number.isFinite(Number(input.value)) || Number(input.value) < 0; if (toggle.disabled) toggle.checked = false; }
  });
  input?.addEventListener('change', () => { const value=simulation.getState().devices.find(d=>d.id===deviceId)?.ratingW;input.value=value===null?'':String(value); });
  toggle?.addEventListener("change", () => simulation.setDeviceEnabled(deviceId, toggle.checked));
});
byId("sim-tariff")?.addEventListener("input", (event) => simulation.setTariff(event.target.value));
byId("apply-assumptions")?.addEventListener("click", () => {
  const invalid=[...document.querySelectorAll('[data-assumption]')].find(input=>input.value.trim()==='' || !input.checkValidity());
  if(invalid) {invalid.reportValidity();showToast('Enter valid values for every scenario assumption.');return;}
  const values = {};
  document.querySelectorAll("[data-assumption]").forEach((input) => {
    let value = Number(input.value);
    if (input.dataset.speedConversion === "true") value /= 3.6;
    if (input.dataset.percentConversion === "true") value /= 100;
    values[input.dataset.assumption] = value;
  });
  simulation.stop(); stopSimulationLoop(); simulation.setAssumptions(values);
  simulationPowerHistory.length = 0; runRecords.length=0; lastChartSimulationTime = -1; simulation.reset();
  syncAssumptionInputs(simulation.getState());
  showToast('Scenario inputs applied. The drive has been reset.');
});

function showToast(message) {
  document.querySelector('.toast')?.remove();
  const toast=document.createElement('div');toast.className='toast';toast.setAttribute('role','status');toast.textContent=message;document.body.append(toast);setTimeout(()=>toast.remove(),4000);
}
byId('sim-export')?.addEventListener('click',()=>{
  const s=simulation.getState();
  const rows=['source,simulated_seconds,speed_kmh,terminal_voltage_v,battery_current_a,power_w,net_energy_wh,soc_percent,regen_w',...runRecords.map(r=>['SOFTWARE_SIMULATION',r.time,r.speed,r.voltage,r.current,r.power,r.energy,r.soc,r.regen].map(v=>typeof v==='number'?v.toFixed(6):v).join(','))];
  if(!runRecords.length){showToast('Start the simulation to collect run data.');return;}
  const data={source:s.sourceLabel,assumptions:s.assumptions,auxiliaryRatings:s.devices.filter(d=>d.id!=='tractionMotor').map(d=>({id:d.id,watts:d.ratingW})),tariffInrPerKwh:s.tariffInrPerKwh,samples:runRecords.length};
  const csvText=rows.join('\n')+'\n\n# Scenario metadata\n# '+JSON.stringify(data);
  window.lastExportedRunCsv={filename:'EV_EMS_simulated_run.csv',content:csvText};
  const url=URL.createObjectURL(new Blob([csvText],{type:'text/csv'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download='EV_EMS_simulated_run.csv';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  showToast('Simulated run exported with its scenario assumptions.');
});

simulation.getState().devices.filter(d=>d.id!=='tractionMotor').forEach(d=>{const input=byId('power-'+d.id);if(input)input.value=d.ratingW===null?'':String(d.ratingW);});

renderSimulation(simulation.getState());
setTelemetryStatus("waiting");
window.dispatchEvent(new Event("ecs-app-ready"));
