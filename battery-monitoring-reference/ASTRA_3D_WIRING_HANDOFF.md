# Astra handoff — ECS battery-monitoring wiring reference

This note is self-contained. Use it only as a **conditional visualization specification**, not as a real wiring/safety approval. Final component pinouts and high-current ratings are not yet physically verified. Do not invent missing wires. Every solid connection below remains conditional on actual board/module labels and ratings.

## Inventory

- Amptek AT12-7.6 nominal 12 V 7.6 Ah VRLA battery (manufacturer page confirms model/nominal values; charge limits and physical terminals still to confirm).
- 30 A fuse and holder (value is not endorsed until wire/load protection calculation is complete).
- Rocker switch (DC current/inrush rating unknown).
- ACS712-30A breakout (exact chip suffix, terminal map and PCB current rating unknown).
- DC motor (rated voltage, running, startup and stall current unknown).
- LM2596 adjustable buck module (input/output labels and actual capability must be inspected; adjust/measure output before connecting loads).
- ESP32-WROOM-32/NodeMCU-style board (exact variant unknown).
- 0.96-inch OLED breakout (likely SSD1306 I²C; pin order/address/pullups/supply unknown).
- Songle SRD-05VDC-SL-C bare relay or 5 V module (not resolved; do not model as connected to motor yet).
- Proposed divider parts: 120 kΩ + 22 kΩ, 1% for battery voltage; 15 kΩ + 20 kΩ, 1% for ACS output attenuation; optional 100 nF at each ADC node after review.
- Terminal blocks / wires must be appropriately DC/current rated; gauge and color are representation conventions, not verified hardware.

## Proposed terminal-to-terminal netlist

1. Battery `+` → fuse holder battery-side `IN`; fuse `OUT` → rocker `IN`; rocker `OUT` → switched positive bus.
2. Switched bus → ACS module primary `IP+`; `IP−` → motor `+`; motor `−` → battery `−`/motor return star point. This is a proposed one-way current measurement path only; **do not fabricate this wiring in the model as confirmed** before ACS breakout current capability and motor/fuse/wire ratings are checked.
3. Switched bus → LM2596 `IN+`; battery `−` → LM2596 `IN−` (low-current return branch). LM2596 `OUT+` must first be adjusted/metered to 5.00 V. Then it may supply ESP32 `5V/VIN` only if the exact board identifies and documents that input; power through one source only.
4. LM2596 5 V → ACS module `VCC`; LM2596 `OUT−` → ACS `GND` only after actual module silkscreen confirms those pins.
5. ACS module `OUT/VIOUT` → 15 kΩ series resistor → ADC node → classic ESP32 `GPIO34 / ADC1_CH6`; 20 kΩ from ADC node to logic ground. Optional 100 nF ADC node to ground. This attenuates rather than connects the nominal 5 V sensor output directly.
6. Switched battery `+` → 120 kΩ → divider node → classic ESP32 `GPIO35 / ADC1_CH7`; 22 kΩ from node to logic ground. Optional 100 nF node-to-ground. Divider nominal factor 0.15493; 18 V assumed ceiling gives 2.79 V nominal / about 2.84 V worst resistor ratio. 18 V is a design assumption, not Amptek's published maximum.
7. Classic ESP32 `GPIO21 SDA` ↔ OLED `SDA`; `GPIO22 SCL` ↔ OLED `SCL`; OLED `GND` ↔ logic GND. OLED `VCC` goes only to a rail verified from its actual module (3.3 V candidate); confirm pull-ups are not tied to 5 V and scan I²C address (0x3C is common, 0x3D also possible).
8. ESP32 `GND`, ACS signal `GND`, OLED `GND` and buck `OUT−` share a low-current logic reference only if actual design is non-isolated. Route motor return directly to the battery-negative/star junction, not through the ESP32 board or signal-ground lead.
9. Relay `VCC`, `GND`, `IN`, `COM`, `NO`, `NC` are **unconnected/unrouted** in the current package. GPIO25 is merely a candidate signal pin pending module driver/input checks. Do not wire a bare coil to ESP32. Do not put relay contacts in the motor path until the actual DC inductive/inrush rating is adequate.

## Model visualization notes

- Separate high-current battery/motor wiring from 5 V power and low-level logic/signal wiring using distinct colors, widths and labels. Suggested colors: red high-side DC, black motor/battery return, orange 5 V, blue I²C, purple ADC signal, green logic ground. Clearly label these as diagram conventions, not measured conductor specs.
- Route continuous smooth curves with both endpoints seated at the named terminals: `BAT+ → FUSE IN/OUT → SWITCH IN/OUT → switched bus`; bus to `ACS IP+`, then `IP− → MOTOR+`, and `MOTOR− → BAT−`. Separate branch from switched bus to buck `IN+`; buck `IN− → BAT−` star return. Render dividers between their actual nodes and the GPIO pins. Render OLED four-wire interface only after actual pinout confirmation.
- Do not draw guessed relay coil/control/contact connections; keep those terminals visibly marked “TBD / NOT CONNECTED”. Do not show the relay as controlling the motor until resolved.
- Do not add floating wire ends, arbitrarily connect battery `+` to ESP32, or portray the 30 A fuse as an approved value. Never create a wire from 12 V directly to any ESP32 GPIO/ADC/3V3/OLED pin.
- Preserve the current website's telemetry, Firebase settings, dashboard, and viewer controls. No website or GLB modifications are part of this handoff. Electrical model must be revised only from a later physically checked connection table and schematic.
- Keep a visible caveat: “Conditional educational visualization; not electrically verified; see wiring guide and validation report.” 3D curves are not a substitute for a real electrical schematic.

## Reference artifacts

- Proposed connection table: `battery-monitoring-pinout.csv`
- Student-oriented wiring guide: `battery-monitoring-wiring-guide.md`
- Research/calculations/limitations: `battery-monitoring-validation-report.md`
- Visual diagram: `battery-monitoring-schematic.svg` and `.png`
- Actual verified schematic file paths: **none yet**; current schematic is a proposed conditional architecture only.

