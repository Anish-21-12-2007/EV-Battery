const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const CIRCUIT_REVIEW = [
 {id:'return-loop',wires:['W014','W016','W052','W053'],components:['BAT1','JGND','U_BUCK_BOARD'],title:'Return topology needs revision',detail:'A non-isolated converter joins IN− and OUT− internally. W014/W016/W052 then form a second path parallel to W053. The source does not establish one Kelvin tie or guarantee a quiet logic return.'},
 {id:'sensor-interface',wires:['W020','W021','W022','W023'],components:['S_L','U_I_L'],title:'Select one sensor and interface',detail:'W020 comes from the proposed 5 V rail, while its note permits a 3.3 V alternative. INA219 is a digital I²C device; it cannot replace an analog OUT/conditioner/GPIO32 connection. The revised purchasing proposal uses a different netlist.'},
 {id:'reverse-protection',wires:['W001','W002'],components:['RP1','F1'],title:'Reverse-polarity protection is unscheduled',detail:'The original W002 connects F1 directly to SW1. The RP1 model has no connections and supplies no protection.'},
 {id:'transient-protection',wires:['W060'],components:['TVS1','D1','MDRV','M1'],title:'Transient protection is incomplete',detail:'Only the TVS cathode has a wire row. Its return, selected part, clamp energy and motor suppression are not resolved. The rendering does not constitute a working clamp.'},
 {id:'backfeed',wires:['W015','W018','W030','W031','W037','W044'],components:['U_ESP','S_M','R_LH','R_VH','R_MH'],title:'Power sequencing and fault protection unresolved',detail:'Powered analog nodes can drive an unpowered ESP32. Divider arithmetic does not establish an allowed injection current. For the reference DevKitC use only one of USB, 5 V-header or 3V3-header power at a time.'},
 {id:'optional-interfaces',wires:['W045','W046','W047','W049','W050','W051'],components:['T1_PROBE','U_OLED_BOARD'],title:'Optional interface parts are not finalized',detail:'The DS18B20 pullup is mentioned but not scheduled in the BOM/netlist. OLED pin order, pullup voltage and exact board revision remain unidentified.'},
];

export const FAULT_MODE_ANALYSIS = [
 {
  id: 'unpowered-mcu-backfeed',
  condition: 'Startup / Shutdown / F2 Open (VDD = 0 V while 12–18 V bus or 5 V sensor is live)',
  affected: ['U_ESP', 'R_LH', 'R_VH', 'R_MH', 'S_M', 'NODE_VL', 'NODE_VM', 'NODE_IM', 'W030', 'W037', 'W044'],
  missingInfo: 'ESP32 carrier board input clamp rating, series isolation buffer, and power-sequencing circuit.',
  consequence: 'Unpowered ESP32 absolute maximum GPIO voltage is VDD + 0.3 V = 0.3 V. At 18 V bus, NODE_VL/NODE_VM reach 2.308 V unloaded or inject 230.29 µA KCL into a hypothetical 0.3 V clamp; powered ACS712 at +30 A (4.48 V) injects 139.81 µA KCL via 27 kΩ/20 kΩ, risking parasitic rail backfeed or latch-up.',
 },
 {
  id: 'open-bottom-divider-fault',
  condition: 'Abnormal Fault: Open-Circuit Bottom Divider Resistor (R_LL, R_VL, or R_ML disconnected)',
  affected: ['R_LL', 'R_VL', 'R_ML', 'NODE_VL', 'NODE_VM', 'NODE_IM', 'W026', 'W027', 'W033', 'W034', 'W040', 'W041'],
  missingInfo: 'Dedicated per-channel overvoltage clamp / buffer amplifier ahead of GPIO32–GPIO35.',
  consequence: 'Opening R_LL or R_VL (10 kΩ) removes attenuation and pulls NODE_VL/NODE_VM toward 18 V through 68 kΩ; opening R_ML (20 kΩ) exposes GPIO34 to up to 4.48–5.0 V from S_M, exceeding the 3.6 V powered GPIO absolute maximum.',
 },
 {
  id: 'sensor-disconnect-fault',
  condition: 'Sensor Failure / Disconnected Analog Signal Lead (W022, W030, W031, W037, W044)',
  affected: ['S_L', 'U_I_L', 'S_M', 'W022', 'W023', 'W031', 'W037', 'W044'],
  missingInfo: 'Hardware open-wire detection and calibrated firmware out-of-window fault thresholds.',
  consequence: 'If S_M.OUT (W031) opens while R_ML (20 kΩ) remains connected to ground, NODE_IM drops to 0.000 V, which naive linear firmware maps to −37.88 A instead of flagging a sensor open-circuit fault.',
 },
 {
  id: 'ground-return-open-fault',
  condition: 'Ground Fault: Primary Return W052 Open-Circuit under Load',
  affected: ['BAT1', 'JGND', 'U_BUCK_BOARD', 'W007', 'W011', 'W014', 'W016', 'W052', 'W053'],
  missingInfo: 'Galvanically isolated DC/DC topology or verified fault-rated return bonding.',
  consequence: 'If W052 opens, full L1 + MDRV load current diverts from STAR_RETURN through W053 → LOGIC_GND → W016 → non-isolated U_BUCK_BOARD internal common → W014 → BAT−, elevating logic ground and destroying the MCU/sensors.',
 },
 {
  id: 'inductive-load-turnoff',
  condition: 'Motor Stall / Inductive Turn-Off Transient (SW1 or FM opens under M1 load)',
  affected: ['SW1', 'F1', 'FL', 'FM', 'F2', 'TVS1', 'D1', 'RP1', 'MDRV', 'M1', 'BUS+'],
  missingInfo: 'Motor stall/inrush current, driver topology (unidirectional vs. H-bridge), TVS1 clamping voltage/energy and anode return wire, and fuse DC interrupt ratings.',
  consequence: 'Unclamped inductive energy (L·dI/dt) on BUS+ and MDRV.INPUT+ can exceed the 18 V divider assumption and the 45 V LM2596 IC absolute maximum; placing freewheel diode D1 across a reversing H-bridge would create a dead short on reverse command.',
 },
];

export function circuitReviewHtml(type,id) {
 const items=CIRCUIT_REVIEW.filter(r=>(type==='wire'?r.wires:r.components).includes(id));
 const faults=FAULT_MODE_ANALYSIS.filter(f=>f.affected.includes(id));
 const unverifiedBanner=`<div class="cl-audit-finding"><strong>Status: UNVERIFIED · Not construction-ready</strong><p>Physical part revision, terminal pinout, conductor ampacity and protection coordination are UNVERIFIED in the source package. Do not energize or substitute guessed ratings.</p></div>`;
 const reviewBlocks=items.map(r=>`<div class="cl-audit-finding"><strong>${esc(r.title)}</strong><p>${esc(r.detail)}</p><a href="docs/advanced-circuit-audit.md" target="_blank" rel="noopener">Independent audit ↗</a></div>`).join('');
 const faultBlocks=faults.map(f=>`<div class="cl-audit-finding"><strong>Fault &amp; abnormal mode: ${esc(f.condition)}</strong><p><em>Missing:</em> ${esc(f.missingInfo)}<br><em>Consequence:</em> ${esc(f.consequence)}</p></div>`).join('');
 return unverifiedBanner+reviewBlocks+faultBlocks;
}

export async function initHardwareProposal(host) {
 try {
  const response=await fetch('./hardware/revision-b.json');if(!response.ok)throw new Error(`HTTP ${response.status}`);
  const plan=await response.json();
  const list=items=>`<ul>${(items??[]).map(item=>`<li>${esc(typeof item==='string'?item:JSON.stringify(item))}</li>`).join('')}</ul>`;
  host.innerHTML=`<div class="lab-section-heading"><div><span class="lab-kicker">SEPARATE DESIGN REVISION / NOT THE SOURCE ASSEMBLY</span><h3>${esc(plan.title)}</h3></div><a class="lab-source" href="docs/hardware-build-proposal.md" target="_blank" rel="noopener">Complete build proposal ↗</a></div>
   <p class="lab-inline-warning"><strong>${esc(plan.status)}</strong> · ${esc(plan.summary)}</p>
   <p>The 3D assembly and original wiring tabs reproduce the inherited 60-wire proposal. This purchasing proposal changes the sensing architecture. Do not combine their wiring instructions.</p>
   <div class="lab-section-heading"><h4>Proposed electrical connections</h4><a class="lab-source" href="hardware/revision-b-schematic.svg" target="_blank" rel="noopener">Open full-size schematic ↗</a></div>
   <div class="hardware-schematic"><img src="hardware/revision-b-schematic.svg" alt="Revision B proposed bench circuit with exact module pins and 28 connection records. Not battery wiring."></div>
   <div class="lab-table-scroll"><table class="hardware-parts"><thead><tr><th>Part / quantity</th><th>Exact product</th><th>Verified specification</th><th>Condition</th></tr></thead><tbody>${plan.parts.map(p=>`<tr><td><strong>${esc(p.id)}</strong> · ${esc(p.qty)}<br>${esc(p.name)}</td><td><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.mpn)} ↗</a></td><td>${list(p.verifiedSpecs)}</td><td>${list(p.conditions)}<strong>${esc(p.status)}</strong></td></tr>`).join('')}</tbody></table></div>
   <h4>Before a battery-powered build</h4>${list(plan.openDecisions)}
   <details class="lab-original-schematic"><summary>Commissioning stages</summary>${list(plan.stages)}</details>
   <details class="lab-original-schematic"><summary>Measurement boundaries and calculations</summary>${list(plan.measurement)}</details>
   <details class="lab-original-schematic"><summary>Proposed connection schedule · ${plan.connections.length} records</summary><p>Use the exact selected board documentation. These are proposed connections, not a verified physical build.</p><div class="lab-table-scroll"><table class="hardware-connections"><thead><tr><th>ID</th><th>From</th><th>To</th><th>Status / condition</th></tr></thead><tbody>${plan.connections.map(c=>`<tr><td>${esc(c.id)}</td><td>${esc(c.from)}</td><td>${esc(c.to)}</td><td>${esc(c.status)}<br>${esc(c.notes)}</td></tr>`).join('')}</tbody></table></div></details>
   <p class="lab-caption">Manufacturer documentation confirms only the listed component claims. Hardware current limits, wiring workmanship, calibration and power-on measurements still require verification. <a href="docs/advanced-circuit-audit.md" target="_blank" rel="noopener">Read corrections to the inherited design ↗</a></p>`;
  host.dataset.ready='true';
 } catch(error) {host.innerHTML=`<p class="lab-empty">The hardware proposal could not load (${esc(error.message)}). <a href="docs/hardware-build-proposal.md">Open the saved proposal</a>.</p>`;}
}
