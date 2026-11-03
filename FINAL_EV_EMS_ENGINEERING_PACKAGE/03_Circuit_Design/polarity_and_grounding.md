# Polarity and Grounding

## Battery and branch polarity

- F1 is on BAT+, before SW1. Do not put the main fuse in the battery-negative lead as a substitute for positive-source protection.
- Current sensors are oriented source → load: positive bus to IP+, then IP− to the branch input. For an ACS712 this is the polarity that increases output for positive current.
- Load positive and return terminals must be identified from the actual device; wire colors are not proof.
- The voltage divider top resistor connects to the corresponding load/controller DC input positive. The bottom resistor and ADC reference connect to the designated logic ground.
- The LM2596 is a candidate IC/module only. Verify actual IN+/IN− and OUT+/OUT− markings, and measure output polarity before attaching the ESP32.
- OLED supply and I²C pullups must stay within the identified module’s and ESP32’s allowed rail. Do not assume a 5 V OLED breakout pulls up to 3.3 V.
- DS18B20 probe pin order and wire colors are unknown; do not infer them.

## Ground/return topology

Keep Light and Motor branch returns separate until their intended battery-negative/star point. Keep the high-current motor return out of the ADC reference trace. The buck input negative, buck output negative and ESP32 ground may be common only if the actual converter is non-isolated and its schematic/continuity confirms this. A shared logic reference does not make the whole system isolated.

If the return path has a voltage drop, a positive-to-BAT− divider does not directly measure differential voltage across the load. A ground shift can become measurement error. Use a suitable differential measurement front end when true load-terminal voltage is required.

## Scope boundary

This is a low-voltage proposal with an 18 V DC sense assumption. It is not for the separate illustrative 96 V EV pack. The ACS712 is explicitly not intended for automotive use. No polarity-protection or transient-protection device has been selected.


## Quantitative Return-Drop Error Model (`W007` & `W011` vs. Single-Ended Dividers)

Because the `68 kΩ / 10 kΩ` dividers (`R_LH/R_LL` and `R_VH/R_VL`) measure `L1.INPUT+` and `MDRV.INPUT+` relative to `JGND.LOGIC_GND`, any voltage drop across the negative return conductor between the load's negative terminal and the battery-negative star point (`JGND.STAR_RETURN`) adds directly to the apparent measured branch voltage:
$$V_{	ext{measured}} = V_{	ext{load,diff}} + I_{	ext{return}} 	imes R_{	ext{return,shared}}$$
- **Why Separate Home-Runs (`W007`, `W011`) and Kelvin Tie (`W053`) Are Mandatory:**
  - If `MDRV.INPUT−` (`10 A` motor current) shared even $50	ext{ m}\Omega$ of return wire/contact resistance with `U_ESP.GND` (as drawn in the prior schematic's shared `x=1205` vertical line), the ground offset would be $\Delta V_{	ext{GND}} = 10	ext{ A} 	imes 0.050	ext{ }\Omega = 0.50	ext{ V}$ (`5.0 W` power error at `10 A`).
  - With separate home-run conductors to `JGND.STAR_RETURN` and the single Kelvin tie `W053` to `JGND.LOGIC_GND`, `LOGIC_GND` stays fixed at the star-busbar potential (`BAT−`), eliminating common-impedance coupling with the `ESP32`.
