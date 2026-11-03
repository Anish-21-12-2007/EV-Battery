# Source-derived wiring layout

The Engineering lab now opens on **Wiring layout**. It is a physical-style component arrangement with recognizable battery, fuse holder, switch, terminal block, circuit module, resistor/capacitor, motor, lamp, display and probe illustrations. The older functional architecture and original schematic remain available as separate tabs.

## Source and verification

The original `FINAL_EV_EMS_ENGINEERING_PACKAGE.zip` was read directly from the retained external pre-cleanup copy before layout construction. All 36 extracted authoritative files matched the original ZIP bytes. The original wiring CSV contains **60 rows, 33 connected component IDs and 87 unique logical terminals**. See [validation/wiring-source-verification.json](validation/wiring-source-verification.json) for the archive hash, per-file hashes and executed comparison.

`engineering-lab.js` loads the authoritative BOM and wiring CSV. `wiring-layout.js` derives its terminal inventory and every displayed route directly from those records. It does not contain a second manually curated connection schedule. Its orthogonal route planner avoids component bodies; routed positions affect presentation only. Every displayed wire retains the exact source component, source terminal, destination component, destination terminal, domain, status and condition. The model rejects unknown component IDs, missing terminal names or a missing placement instead of silently inventing them.

## Physical limits

The package explicitly does **not** identify the installed ESP32 carrier board, ACS712 breakout, converter board, relay module, OLED connector order, DS18B20 probe lead order, battery, motor or lamp. The component bodies are therefore illustrative. **Their terminal rails are logical anchors, not physical pin positions or footprints.** Body dimensions, anchor order and placement on the planning surface cannot be used to wire a board. Exact board variants and physical header locations remain UNRESOLVED.

The view makes no physical verification claim. Solid routes indicate proposed source connections, including rows whose arithmetic was cross-checked. Dashed routes indicate unresolved/conditional source rows. A source-matched endpoint is not a physically verified connection. None of the 60 wires is a 96 V simulation connection.

RP1, D1 and RLY1 appear as disconnected unresolved items. RLY1 has quantity zero and no active netlist connection; no relay coil/contact functions are guessed. W060 terminates at the named TVS cathode exactly as scheduled. Its prose-only anode return and RP1 insertion are not converted into invented additional wires. Optional OLED and temperature-probe routes retain their unresolved source conditions. The complete source BOM remains searchable, including items without active wire rows.

## Interaction and conventions

- Search a wire ID, component or logical terminal, such as `W037`, `S_M.OUT` or `U_ESP.GPIO34`. Search results select and focus the relevant route or component.
- Select a visible cable to highlight its complete routed path and endpoints. The inspector presents the wire ID, exact terminals, purpose, original status, condition and physical verification limit.
- Select a pin to highlight every source row incident on that logical terminal. Select a component for its BOM details and all scheduled connections.
- Use zoom controls, mouse wheel, background drag, pan buttons or the focused canvas arrow keys. **Focus selection** frames the selected paths; **Fit all** restores the complete layout. The complete connection index provides access to every row independently of canvas hit targets.
- Filter cable families to reduce clutter. Red denotes positive distribution, orange 5 V, purple 3.3 V, black return/reference, teal analog, blue communication and brown switched motor output. An unresolved supply/protection category avoids guessing the Light sensor supply rail. These are display colours only; written terminal names and source notes govern meaning.
- Crossings and overlapping drawing segments do not indicate electrical joins. Only shared labeled logical terminals join source connections. No wire gauge, length, fuse rating, terminal ampacity or physical routing requirement is inferred from the picture.

## Implementation and checks

`initWiringLayout(container, { wires, bom })` builds and mounts the view. `buildWiringModel(wires, bom)` is a DOM-independent model builder. Rendered `g.wl-wire` elements expose exact `data-wire-id`, source/destination component and pin attributes, original source status, and `data-physical-status="UNVERIFIED"`. `g.wl-pin` exposes its source-derived terminal key. These are inspectable by independent tests.

The module was executed in headless Microsoft Edge and visually reviewed at desktop and mobile sizes. It mounted 60 routes and 87 terminals without JavaScript errors. Integrated application checks compared every displayed wire ID, endpoint and original source status to the CSV with zero mismatches; selecting `U_ESP.GPIO34` highlighted W037, pan changed the view, and 390 px and 320 px page widths had no overflow. Its isolated overview, focus and mobile screenshots are `validation/wiring-layout-desktop.png`, `wiring-layout-focus.png` and `wiring-layout-mobile.png`; integrated views are `wiring-layout-integrated.png` and `wiring-layout-terminal.png`. Complete phase 2 application acceptance checks are maintained separately by the independent validation suite.

No physical circuit was inspected, powered or measured. The low-voltage layout remains separate from the vehicle simulator and does not offer hardware actuation.
