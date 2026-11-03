# Student Laboratory Pre-Energization Safety & Inspection Checklist

**Mandatory Rule:** Do **NOT** connect `BAT1` or energize any portion of the 12 V monitoring circuit until every item in Stages 1–4 below has been physically verified with a calibrated Digital Multimeter (DMM) and signed off by a qualified lab instructor.

---

## Stage 1 — Component Identification & Rating Sign-Off (Unpowered)

- [ ] **1.1 System Voltage Separation Check:** Confirm the battery is a nominal **12 V DC** source (never connect a 24 V, 48 V, or 96 V pack).
- [ ] **1.2 Fuse & Holder Verification (`F1`, `FL`, `FM`, `F2`):** Confirm all four fuses are installed in insulated holders, rated $\ge 32	ext{ V DC}$, and satisfy $1.25 	imes I_{	ext{cont}} \le I_{	ext{fuse}} \le I_{	ext{wire,max}}$. Confirm `F1` is mounted within `15 cm` of `BAT1+`.
- [ ] **1.3 Conductor & Busbar Inspection (`WIRE`, `BUS+`, `JGND`):** Confirm no motor or lamp current passes through a solderless breadboard. Confirm all high-current terminations use insulated crimp lugs or rated screw blocks.
- [ ] **1.4 Motor Controller & Flyback Diode Check (`MDRV`, `M1`, `D1`):** Check whether `MDRV` is a unidirectional driver or a bidirectional H-bridge. **If `MDRV` can reverse polarity (H-bridge), confirm no unidirectional parallel diode `D1` is installed across `M1`.**
- [ ] **1.5 Sensor Breakout Inspection (`S_M_BOARD`, `S_L`):** Inspect `S_M_BOARD` PCB traces and terminals. Measure with a DMM (unpowered) from `S_M.OUT` to `GND` to confirm whether an onboard voltage divider is already populated before adding `R_MH` (`27 kΩ`) and `R_ML` (`20 kΩ`).

---

## Stage 2 — Unpowered DMM Continuity & Resistance Verification

- [ ] **2.1 Short-Circuit Check:** With `BAT1` disconnected and `SW1` open, measure resistance between `BUS+` and `JGND.STAR_RETURN` (must be high impedance, no dead short).
- [ ] **2.2 Buck Common-Ground Continuity (`U_BUCK_BOARD`):** Measure resistance between `U_BUCK_BOARD.IN−` and `U_BUCK_BOARD.OUT−`. Proceed with the shared `JGND` topology (`W014`, `W016`, `W053`) **only** if `IN−` and `OUT−` are directly continuous ($< 0.1	ext{ }\Omega$).
- [ ] **2.3 Passive Divider Verification (`R_LH/R_LL`, `R_VH/R_VL`, `R_MH/R_ML`):**
  - Measure each resistor before installation (`68.0 kΩ ±1%`, `10.0 kΩ ±1%`, `27.0 kΩ ±1%`, `20.0 kΩ ±1%`).
  - Confirm bottom resistors (`R_LL`, `R_VL`, `R_ML`) have solid continuity ($< 0.2	ext{ }\Omega$) to `JGND.LOGIC_GND` so an open-ground fault cannot apply `12–18 V` to an `ESP32` GPIO.

---

## Stage 3 — Staged Power-Up & Buck Pre-Adjustment (`ESP32` & Sensors Disconnected!)

- [ ] **3.1 Disconnect `U_ESP`, `S_M`, `S_L`, `L1`, and `MDRV`:** Leave `FL` and `FM` removed for initial buck bring-up.
- [ ] **3.2 Power `U_BUCK_BOARD` Only (`F1` and `F2` installed):** Connect a current-limited bench supply (`12.0 V`, current limit `0.5 A`) or fused `BAT1`, close `SW1`, and measure `U_BUCK_BOARD.OUT+` to `OUT−` with a DMM.
- [ ] **3.3 Trim Buck Output to `5.00 V ± 0.05 V`:** Adjust the converter potentiometer until the DMM reads `5.00 V` DC. Turn power off before connecting `U_ESP` or `S_M`.

---

## Stage 4 — Analog Node & Sequencing Verification Before Connecting `ESP32` ADC Pins

- [ ] **4.1 Verify ADC Node Voltages With `ESP32` GPIO Leads Disconnected:**
  - At `12.0 V` bus input, verify `NODE_VL` and `NODE_VM` read `~1.538 V` (`< 2.45 V`).
  - With `S_M` powered at `5.00 V` and `0 A` primary current, verify `S_M.OUT` reads `~2.50 V` and `NODE_IM` reads `~1.064 V` (`< 2.45 V`).
- [ ] **4.2 Power Sequencing Rule:** Never energize `S_M` (`5 V`) or apply `12 V` to the voltage dividers while `U_ESP` is unpowered ($V_{	ext{DD}} = 0	ext{ V}$). Ensure `U_ESP` powers up simultaneously from the same switched `BUS+` rail (`F2` → `U_BUCK_BOARD`).
