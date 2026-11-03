# Revision B — proposed two-load hardware

**Status: exact component candidates, not a physically qualified build. No battery operation is approved.** Reviewed on 3 November 2026. No hardware was purchased, energized or calibrated. The machine-readable schedule is [revision-b.json](../hardware/revision-b.json).

This proposal responds to the available equipment: an unidentified ESP32 board, buck converter, 12 V battery, OLED and fuse holder. An Arduino IDE board-menu choice does not identify the carrier or its pin layout. None of those existing items is assumed to match a named part below. The remaining source, protection, wiring and mechanical decisions must be closed before this becomes a complete buying/building list.

The existing Blender assembly, conventional schematic and original 60-wire CSV reproduce the inherited analog design. They remain available for audit. **Revision B uses a different sensing architecture; do not combine its connections with the inherited diagram.** The [independent electrical audit](advanced-circuit-audit.md) explains the original return loop, unscheduled protection and interface contradictions.

## Selected candidates

| ID | Quantity | Exact candidate | Purpose and condition |
|---|---:|---|---|
| ESP | 1 | [Espressif ESP32-DevKitC-32E](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html) | Reference controller with WROOM-32E and 4 MB flash. Verify the actual board before using this pin map. |
| IM, IL | 2 | [Adafruit 904 INA219 breakout](https://www.adafruit.com/product/904) | Separate high-side branch measurements; fitted 0.1 Ω, 1%, 2 W shunts. The delivered IC may be INA219A or B; account for its grade. |
| OLED | 1 | [Adafruit 4440](https://www.adafruit.com/product/4440) | Identified 3.3 V-compatible, 128×32 I²C display at 0x3C. Existing OLED remains conditional on identification. |
| QM, QL | 2 | [Adafruit 5648 MOSFET Driver](https://www.adafruit.com/product/5648) | Motor/lamp on/off switching. Maker specifies 1.5 A continuous, 3 A peak and includes an AO3406 plus 1N4007. Actual transients and temperatures still need qualification. |
| M1 | 1 | [Pololu 3041](https://www.pololu.com/product/3041) | 100:1 HPCB 12 V gearmotor; nominal no-load 80 mA and 330 RPM. Its 0.75 A stall value is theoretical; stalls can damage it. |
| L1 | 1 section | [Adafruit 5864](https://www.adafruit.com/product/5864), cut to ten marked sections / 175 mm | Cool-white 12 V lamp. Approximately 0.16625 A is inferred from the maker's 950 mA/metre, not measured or guaranteed. Purchase is a metre; use only the selected section. |

The source, insulated disconnect, conductor/connector system, battery protection and mounting are **not selected**. Do not substitute a generic driver or INA226 based on appearance. This proposal uses no analog battery divider, ACS712 conditioner, optional temperature probe or buck-to-ESP power connection.

## Power and control boundaries

Power the ESP only through Micro-USB. Its 5 V header receives no external supply; its 3V3 header supplies the two sensors and OLED. Espressif requires one power-input method at a time. All I²C pullups therefore reference the same 3.3 V logic rail. The sensor's **VIN logic pin and Vin+ measurement terminal are different nodes**.

The loads use a separate, isolated, regulated current-limited bench source after its output behavior and wiring have been qualified. Its nominal setting must not exceed 12.0 V for this proposal. A 1.0 A total prototype ceiling is a **design constraint for qualification**, not an approved fuse rating, motor continuous rating or initial power-on setting. Current limiting does not remove energy stored in the source's output capacitors.

JSTAR is one physical common-reference junction: bench negative, dedicated motor return, dedicated lamp return, the sensor reference wires and one ESP ground reference meet there. Load current is routed directly back from each driver, never through an ESP or sensor ground lead. Verify that USB earth, a scope, a second supply or another cable does not add an unreviewed return path. The unknown non-isolated buck is absent from this revision; its internal ground cannot silently add the loop found in the old design.

Use GPIO26 for the motor and GPIO27 for the lamp. Write LOW before enabling either pin as an output. The [driver pinout](https://learn.adafruit.com/adafruit-mosfet-driver/pinouts) identifies **In** as control, **V+** as load supply, **GND** as common return, and output **− / Out** as a switched return. Output **+** is internally tied to V+. The module's input pulldown must be verified against the [manufacturer schematic](https://github.com/adafruit/Adafruit-MOSFET-Driver-STEMMA-PCB) and received board; test actual boot/reset/disconnect behavior. Firmware OFF alone cannot protect against a shorted MOSFET.

The pinout specifies a 2.5–20 V HIGH control range, which includes the ESP's 3.3 V signal. The downloaded manufacturer schematic confirms a 10 kΩ SIGNAL-to-GND pulldown and flyback anode at OUT/cathode at VIN. Its generic diode value is `1N400x/SM4002`, while the product description says 1N4007; verify the received component and its transient ratings rather than relying on the label alone. OLED connections below use the standard STEMMA QT power/ground/data contacts; they do not guess a different display's header order.

### Power loss and restoration

- **ESP reset or USB loss with 12 V still present:** the driver pulldowns are intended to hold both switches off. Verify the actual behavior, rail decay and sensor high-side inputs with logic unpowered; this is not a tested power-sequencing guarantee. Keep the common reference connected until all sources are off.
- **12 V source loss with USB still present:** an asserted GPIO can remain asserted. Firmware must detect source loss, disarm both outputs and require explicit rearming after restoration, rather than automatically restarting the motor.
- **Sensor, I²C or watchdog fault:** command both outputs off, disarm and mark the sampling gap invalid. Firmware response cannot be the sole short-circuit or stuck-switch protection; the qualified source and disconnect are separate measures.
- **Wiring changes:** turn off and disconnect both sources first. Do not unplug live GND or signal wires as a power-control method. Scope/USB ground paths must be included in the topology review.

## Proposed connection schedule

Every entry is conditional on the matching modules and the stage gates below. With all power removed, identify contacts from their labels and official drawings; this table does not specify unverified physical header coordinates. ESP header numbers apply only to the selected DevKitC variant.

| Records | From | To |
|---|---|---|
| B001 | USB Micro-B | ESP Micro-USB only |
| B002–B004 | ESP J2.1 / 3V3 | IM.VIN; IL.VIN; OLED.QT V+, respectively |
| B005 | ESP J2.14 / GND | JSTAR.COMMON |
| B006–B007 | IM.GND; IL.GND | JSTAR.COMMON, separate reference leads |
| B008 | OLED.QT GND | ESP J2.14 / GND |
| B009–B011 | ESP J3.6 / GPIO21 | IM.SDA; IL.SDA; OLED.QT SDA |
| B012–B014 | ESP J3.3 / GPIO22 | IM.SCL; IL.SCL; OLED.QT SCL |
| B015 | ESP J2.10 / GPIO26 | QM.In |
| B016 | ESP J2.11 / GPIO27 | QL.In |
| B017 | Qualified bench NEG | JSTAR.COMMON |
| B018 | Qualified bench POS | JPOS.BUS positive distribution |
| B019–B020 | JPOS.BUS | IM.Vin+; IL.Vin+ |
| B021 | IM.Vin− | QM.V+ |
| B022 | IL.Vin− | QL.V+ |
| B023–B024 | QM.output +; QM.output − | M1 terminals A; B |
| B025–B026 | QL.output +; QL.output − | Selected L1 section +; − |
| B027–B028 | QM.GND; QL.GND | JSTAR.COMMON, separate load-return leads |

At IM leave both address jumpers open (0x40); at IL bridge only A0 (0x41). OLED is 0x3C. The [INA219 module pinout](https://learn.adafruit.com/adafruit-ina219-current-sensor-breakout/pinouts) documents 10 kΩ SDA/SCL pullups on each sensor; they operate in parallel. Include the OLED's pullups when checking total sink current and rise time. Begin at 100 kHz with short logic leads, and verify the three addresses with the load source disconnected. Do not add pullups to 5 V.

## Measurement and arithmetic

At the motor's theoretical 0.75 A, a nominal 0.1 Ω shunt drops 75 mV and dissipates 56.25 mW; the 1% high-resistance corner gives 75.75 mV and 56.8125 mW. A proposed ±160 mV gain setting leaves measurement headroom. It is not a motor current limiter. At the 1 A design ceiling the high-corner shunt drop is 101 mV, still below that measurement range.

For both channels, proposed nominal register scaling is `Current_LSB = 0.0001 A`, `CAL = 4096` with a 0.1 Ω shunt, and `Power_LSB = 0.002 W`. Use the 16 V bus register range and read configuration back after resets. The IC's 26 V input limit is not increased by a 32 V register-range option. Calibrate using reference measurements; decimal display resolution is not accuracy.

The [TI INA219 datasheet](https://www.ti.com/lit/ds/symlink/ina219.pdf) defines bus voltage at Vin− relative to GND. Thus downstream branch power is `Vbus × I`; upstream shunt-input power is `(Vbus + Vshunt) × I`, with their difference equal to `I²R`. Downstream values include driver and wiring losses and the driver's supply indicator. USB-powered logic is outside these two measurements. Their sum is **two-branch energy**, not total battery energy or motor mechanical output.

Use fresh conversion-ready samples and monotonic time. Bus and current conversions occur sequentially, so fast load changes create sampling error. Begin with 12-bit conversions without averaging; quantify timing and transition errors before claiming accuracy. Do not integrate stale/overflow/failed samples as valid measurements. Register scale, shunt tolerance, IC offset/gain, temperature, reference-meter uncertainty and timing all contribute to error.

For elapsed time in seconds, `E_kWh = Σ(P_W × Δt_s) / 3,600,000`; `cost_INR = E_kWh × tariff`. At the selected strip's estimated 1.995 W, one hour would use 0.001995 kWh. This is an estimate to check against measurements. Battery percentage remains unavailable until usable capacity is measured for the actual battery/load/cutoff. The web simulation's 96 V vehicle assumptions are unrelated to this 12 V bench prototype.

## Commissioning gates

1. **Identify and inspect with power removed.** Match products, contacts, polarity and continuity; inspect soldering/insulation. Complete the connector/conductor and accessible-disconnect specifications.
2. **USB-only logic.** Leave the 12 V source and loads disconnected. Verify rail and pullup voltages, all three addresses, configuration/calibration readback, zero readings and OFF behavior through boot/reset/USB loss. Check the 3.3 V peripheral budget with Wi-Fi active.
3. **Qualify the load source and wiring.** Document isolation/grounding, limiting response, output-capacitor energy, wire/contact limits and disconnect behavior. Choose commissioning current limits from the qualified wiring and actual load; a marketing supply-current rating is insufficient.
4. **Commission the lamp.** Only after the preceding checks, compare steady current, voltage and timed energy against a reference instrument, using the selected section. Record uncertainty, heating and shutdown behavior.
5. **Gate the motor separately.** Before its first run, have an experienced electronics reviewer approve mounting/guarding, flyback-loop layout, startup-current duration, rail/Out transient limits and supply backfeed behavior. The onboard diode does not by itself qualify the setup. Do not deliberately stall the motor. Initial scope excludes PWM, reversing, braking and external shaft drive.
6. **Issue a later battery revision.** Identify battery chemistry/model, charge limits and prospective fault current. Coordinate fuse current/time curve, DC voltage/interrupting rating, holder/contact/conductor ratings, disconnect, reverse-polarity protection and transient limits. “12 V fuse with holder” is insufficient information. **This document does not issue a battery connection schedule.**

The physical sampling/control firmware remains to be implemented and validated against this revision, including fail-off behavior and calibration. Browser simulation checks, schematic consistency tests and realistic Blender geometry do not qualify that firmware or the assembled hardware.
