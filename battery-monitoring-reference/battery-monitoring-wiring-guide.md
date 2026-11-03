# ECS Battery Monitoring — proposed wiring guide

**Status: engineering proposal, not a build authorization.** It is not safe to energize until the component-specific checks in this guide are completed. Every component/module pinout that cannot be tied to an inspected physical part is marked conditional.

## Architecture

The proposed measurement arrangement places the fuse and main switch in the battery positive lead. With the relay intentionally held out of the motor path for now, the ACS712 primary conductor senses motor current in series. A switched, fused branch feeds an adjustable LM2596 module; its verified 5 V output powers the ESP32 development board only through the board's documented 5 V input. ADC1 channels measure the attenuated current signal and battery voltage; I²C connects the OLED. Battery negative, buck negative, ESP32 GND, ACS712 signal GND and OLED GND share a low-voltage reference **only after confirming a non-isolated common-ground module topology**. Keep the high-current motor return physically separate from delicate ADC/I²C wiring and join at a deliberate battery-negative/star-return point.

```text
Battery + → fuse (rating TBD) → rocker switch (rating TBD) → switched + bus
                                                    ├→ ACS712 IP+ → IP− → motor +
                                                    │                         motor − → Battery −
                                                    ├→ LM2596 IN+ ; LM2596 IN− → Battery −
                                                    └→ battery divider top (measurement enabled only when switched on)

LM2596 OUT+ (set and meter-verified 5.00 V) → ESP32 board 5V/VIN only if that exact pin is confirmed
LM2596 OUT+ → ACS712 VCC (5 V); ACS712 OUT → 15k series / 20k-to-GND divider → GPIO34 / ADC1
Switched + → 120k series / 22k-to-GND divider → GPIO35 / ADC1
ESP32 GPIO21 SDA + GPIO22 SCL ↔ OLED SDA + SCL (3.3-V-compatible pull-ups only)
Relay module and its contacts: NOT CONNECTED until its actual module, driver and motor/contact suitability are established.
```

## A. Battery, fuse and switch

Use the battery manufacturer's `+`/`−` marks, not wire color alone. Put an appropriately DC-rated fuse physically close to battery positive, before the positive harness branches. The provided 30 A fuse is **not yet approved as the correct protective value**: choose fuse rating and interrupt/DC voltage rating only after the motor's normal/start/stall current, conductor ampacity/length, connector ratings and holder rating are known. The fuse protects conductors against faults; it is not a battery-management device. A 30 A fuse can fail to protect undersized leads. The rocker switch belongs after the fuse in the positive line and must have a DC rating adequate for the actual load and inrush. Do not use the 3D model's apparent wiring as an instruction.

## B. Motor path and ACS712

For the proposed *unidirectional discharge demonstration only*: switched battery `+` → ACS module primary `IP+` → `IP−` → motor `+`; motor `−` → battery `−`. This series placement measures current to that motor alone. It does not measure ESP32/buck current. Confirm the exact module's current terminals, copper/connector ratings, cooling, polarity markings, and permissible continuous/peak current; a chip's ±30 A nominal range does not establish that a low-cost breakout PCB, screw terminal or jumper can carry 30 A. Verify motor rated voltage and measure current with a suitably rated instrument before selecting fuse, switch, wire, connectors or relay. Do not use a solderless breadboard for motor power. Add motor transient suppression only from the motor/driver manufacturer's requirements; do not put an arbitrary diode across a motor whose direction may reverse.

Allegro's ACS712-30A IC is a 5 V device; its nominal zero-current output is near VCC/2 and its nominal sensitivity is 66 mV/A (datasheet range 63–69 mV/A). Therefore the IC output can exceed an ESP32 input. Proposed conservative scaling: ACS `VIOUT` → **15 kΩ series** → ADC node; **20 kΩ from ADC node to signal GND**. This is a nominal factor 20/(15+20)=0.5714; 4.5 V becomes 2.57 V. Fit 1% resistors and optionally 100 nF from node to GND for noise filtering; calibrate the actual zero-current offset and slope against a meter. This divider reduces usable ADC swing/resolution, so do not treat current readings as precision instrumentation. The breakout may already contain circuitry; inspect it before adding parts.

## C. Buck converter and ESP32

Feed the LM2596 module from the fused/switched supply (`IN+`, `IN−`). Module terminals and polarity must be read from the actual board. With the module disconnected from the ESP32 and other electronics, power it from the battery and measure `OUT+` to `OUT−` with a multimeter. Adjust to **5.00 V** and verify stability under an appropriate test load before connecting anything. A module bearing “LM2596” may have a different clone/layout, thermal rating, capacitor quality, or actual current capacity than TI's IC rating. Do not assume 3 A continuous from an inexpensive module.

Power the board through exactly one documented input: preferably the confirmed `5V`/`VIN` input from buck 5 V, or USB during bench programming—not both unless that exact board documentation explicitly permits it. Never connect battery voltage to 5V, 3V3, GPIO, ADC or OLED VCC. The friend must provide a clear board photo/model before the exact supply pin is finalized. Use short twisted motor supply/return conductors, route them away from ADC/I²C, and add bulk capacitance only if selected against the buck/module datasheet and motor transient measurements.

## D. ESP32 pin plan (conditional on physical board exposing classic ESP32 labels)

- **GPIO34**: ACS712 scaled output. On classic ESP32, GPIO34 is ADC1_CH6 and input-only; ADC1 avoids the ADC2/Wi-Fi conflict. No pull-up/down is needed.
- **GPIO35**: battery divider node. Classic ESP32 ADC1_CH7, input-only.
- **GPIO21**: I²C SDA; **GPIO22**: I²C SCL. Common classic-ESP32 assignments, explicitly set in firmware; verify the chosen board breakout and OLED header.
- **GPIO25**: reserved as a possible relay-module logic signal only after checking the module input electrical requirements, default state, and exact board. It is not connected in this proposal. Do not drive a bare 5 V relay coil from GPIO.

These are not generic-board guarantees. Avoid ESP32 strapping pins for external pull states, and do not use flash pins GPIO6–11. ESP32 input absolute maximum is not a normal operating target; keep all analog nodes below 3.3 V with margin and within the chip/board's recommended ADC range. Use calibrated ADC conversion and average samples; ADC counts are not inherently precision voltage measurements.

## E. Battery-voltage divider

Proposed divider (read only while main switch is on): switched battery `+` → **120 kΩ (1%)** → ADC node → **22 kΩ (1%)** → signal GND. ADC node → GPIO35; optionally put **100 nF** from ADC node to signal GND. Divider ratio is 22/(120+22)=0.15493. At an **assumed design ceiling of 18.0 V**, ideal ADC node is 2.79 V; worst ratio using 1% extremes is about 2.85 V. At 14.5 V it is about 2.25 V. This is a design range with headroom, not a statement of the Amptek battery's maximum voltage. Confirm the actual battery's charge/equalization limits and any wiring transients; if the maximum can exceed 18 V, recalculate and protect the input. ADC attenuation, nonlinearity, resistor tolerance and calibration still apply. Do not infer state-of-charge from voltage alone during motor load/charging.

## F. OLED and I²C

Typical SSD1306 controller modules may use address `0x3C` or `0x3D`, but the panel breakout is not identified. Check its silkscreen and measure/inspect its pull-ups. Connect its `VCC` to 3.3 V only if the exact module allows this; connect `GND` to common logic ground, `SDA` to GPIO21 and `SCL` to GPIO22. Ensure pull-ups terminate at 3.3 V, never an unverified 5 V rail. Run an I²C scan to establish address. Do not infer module voltage tolerance from the SSD1306 controller datasheet alone.

## G. Relay and motor switching — deliberately unresolved

The exact part string `SRD-05VDC-SL-C`, if verified on a *bare relay*, describes a 5 V coil and changeover contact form; the common datasheet's DC contact rating is only 28 VDC/10 A under its specified test conditions. That does not establish a motor/inductive-load switching rating. A relay module adds a driver, input polarity/threshold, possible optocoupler, and sometimes separate `VCC/JD-VCC`; those cannot be guessed from the relay can marking. A motor's startup/stall current can exceed running current. Until exact board photos/datasheets and motor inrush/stall measurement are available, leave module `IN/VCC/GND`, `COM/NO/NC` and GPIO25 disconnected from the real assembly; do not route motor current through it. If switching is required, choose a properly DC motor-rated MOSFET/driver or a DC-rated relay/contactor with appropriate suppression and verified inrush capacity.

## H. Grounding, layout and commissioning order

For a non-isolated low-voltage system, logic grounds must share a reference for ADC/I²C signals; use a deliberate low-current/star reference and keep motor return current out of the ESP32 ground path. ACS712's internal Hall isolation does not mean the breakout is optically isolated, nor does it establish module PCB safety. Disconnect USB before connecting an externally powered board unless its exact power architecture allows simultaneous supply. First inspect labels, then verify battery polarity and open-circuit voltage, confirm fuse/switch/wire ratings, set and meter-check buck output without the ESP32 attached, verify divider/ACS node voltages with a bench meter, test logic at a current-limited safe supply, and only then perform a supervised motor test with a correctly selected fuse. Stop if any part heats, smells, arcs, resets, or reads unexpectedly.

## Connection table

See [`battery-monitoring-pinout.csv`](battery-monitoring-pinout.csv) for one connection per row. “CONDITIONAL” means proposed wiring pending physical verification, not permission to energize. No row is marked VERIFIED for an unseen assembly. `SIMULATED` is reserved for the separate Wokwi logic-only analogue.

