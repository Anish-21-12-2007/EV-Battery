# System Architecture — Conditional Two-Load (Light + Motor) 12 V Monitoring Proposal

**Status:** Documentary engineering concept and audit reference; not an as-built or physically tested assembly.

---

## 1. Architectural Defect in the Legacy Single-Sensor Handoff (`Finding I3` & `R7`)

The existing project handoff describes:
- A nominal 12 V battery (`BAT1`), main fuse `F1`, master switch `SW1`, a single `ACS712` current sensor placed in the common upstream switched positive path before `BUS+`, a motor branch, and an electronics branch with fuse `F2` feeding an `LM2596`-class buck converter and `ESP32`.
- **Fundamental Measurement Limitation:** Because that single `ACS712` sits upstream of `BUS+`, its primary conductor carries the **aggregate sum** of motor current plus electronics (`LM2596` + `ESP32`) current:
  $$I_{	ext{upstream}}(t) = I_{	ext{motor}}(t) + I_{	ext{electronics}}(t)$$
  Furthermore, the legacy handoff contains no separate Light branch (`L1`). Even if a Light branch were connected to `BUS+`, a single upstream current sensor cannot decompose $I_{	ext{upstream}}(t)$ into individual Light current $I_L(t)$ and Motor current $I_M(t)$.
- **Historical Documentation Conflict (`Finding I3`):** An even earlier revision placed the `ACS712` in the motor-only branch while claiming in prose that the electronics branch was fused—even though its schematic and netlist omitted `F2`. Do not mix BOMs or wiring tables across those superseded files.

---

## 2. Upgraded Conditional Two-Load Architecture (`FINAL_EV_EMS_ENGINEERING_PACKAGE`)

To measure a 12 V DC Light load (`L1`) and a 12 V DC Motor subsystem (`MDRV` + `M1`) independently and accurately, this upgraded package defines a three-branch distribution architecture from an insulated positive busbar (`BUS+`) paired with a Kelvin star-ground return system (`JGND`):

1. **Primary Source & Main Protection (`W001`–`W003`, `W060`):**
   - `BAT1` (`BAT+`) → Main Fuse `F1` (placed as close as practical to `BAT+`) → Reverse-Polarity Protection candidate `RP1` → Master Switch `SW1` → Positive Distribution Busbar `BUS+` (with transient voltage suppressor candidate `TVS1` across `BUS+` to `JGND.STAR_RETURN` via `W060`).
2. **Branch 1 — Light Load & Sensing Boundary (`W004`–`W007`, `W020`–`W030`):**
   - `BUS+` → Light Branch Fuse `FL` → Light Current Sensor `S_L` (`IP+` → `IP−`) → Complete 12 V DC Light assembly input (`L1.INPUT+`).
   - **Voltage Channel (`GPIO33` / `ADC1_CH5`):** Kelvin tap `W024` at `L1.INPUT+` feeds the `68 kΩ / 10 kΩ` (1%) divider (`R_LH`, `R_LL`) and `100 nF` filter capacitor (`C_L`) referenced to quiet `JGND.LOGIC_GND`.
   - **Current Channel (`GPIO32` / `ADC1_CH4`):** `S_L.OUT` (`W022`) feeds signal conditioner `U_I_L` (`W023` to `GPIO32`). Because an `ACS712ELCTR-30A-T` has a scaled sensitivity of only `28.085 mV/A` (`14.04 mV` shift at `0.5 A` against a `±60 mV` ESP32 ADC error budget = `±427.3%` error), `S_L` must be selected to match the actual lamp current (or replaced by a digital $	ext{I}^2	ext{C}$ high-side shunt monitor such as `INA219`).
   - **Return Path (`W007`):** Dedicated home-run conductor from `L1.INPUT−` directly to `JGND.STAR_RETURN`.
3. **Branch 2 — Motor Controller & DC Motor Sensing Boundary (`W008`–`W011`, `W018`–`W019`, `W031`–`W044`, `W054`–`W059`):**
   - `BUS+` → Motor Branch Fuse `FM` → Motor Current Sensor candidate `S_M` (`ACS712ELCTR-30A-T`, `IP+` → `IP−`) → Motor Controller DC Supply Input (`MDRV.INPUT+`) → Switched Motor Output (`W054`, `W055`) to DC Motor `M1`.
   - **Measurement Boundary Rule:** Both current (`S_M`) and voltage (`R_VH/R_VL` via `W038` on `GPIO35` / `ADC1_CH7`) are sensed at the **DC input boundary of `MDRV`**, never across PWM-switched motor terminals (`M1.TERM+`/`TERM−`).
   - **Current Channel (`GPIO34` / `ADC1_CH6`):** Conditional on a verified direct 5 V `ACS712-30A` output with no onboard module divider, `R_MH` (`27 kΩ` 1%), `R_ML` (`20 kΩ` 1%), and `C_M` (`100 nF`) scale the sensor output by $k_I = 20/47 pprox 0.425532$.
   - **Return Path (`W011`):** Dedicated heavy-gauge home-run conductor from `MDRV.INPUT−` directly to `JGND.STAR_RETURN`, isolated from logic ground so motor return voltage drop ($I_M R_{	ext{ret}}$) cannot corrupt single-ended ADC measurements.
4. **Branch 3 — Electronics Supply & MCU Reference (`W012`–`W017`, `W045`–`W053`):**
   - `BUS+` → Electronics Branch Fuse `F2` → Buck Converter `U_BUCK_BOARD` (`LM2596` IC candidate, 4.5–40 V input) → Regulated `5.00 V` logic/sensor supply (`W015`, `W018`, `W020`) → `U_ESP` (`ESP32`).
   - **Kelvin Star-Ground Reference (`JGND`, `W052`, `W053`):** High-current returns (`W007`, `W011`, `W014`) land on `JGND.STAR_RETURN` (tied to `BAT1−` via `W052`), while `U_BUCK_BOARD.OUT−` (`W016`), `U_ESP.GND` (`W017`), sensor grounds (`W019`, `W021`), and analog divider/filter grounds (`W027`–`W043`) land on `JGND.LOGIC_GND`, linked to `STAR_RETURN` by a single Kelvin tie (`W053`).

---

## 3. Strict Separation from the 96 V Illustrative EV Simulator

| Attribute | System A: 12 V Educational Monitoring Circuit Proposal | System B: 96 V Illustrative EV Simulator Proxy |
| :--- | :--- | :--- |
| **Nominal Voltage & Capacity** | `12 V`, `7.6 Ah` (`91.2 Wh` nominal product from [Amptek listing, `S5`](https://amptek.aukark.co.in/electric-toy-ride-ons/)) | `96 V`, `150 Ah` (`14,400 Wh` / `14.4 kWh` illustrative software parameters) |
| **Maximum Allowed Input Voltage** | `18.0 V DC` divider design ceiling; `40.0 V` absolute max IC input for [TI LM2596 (`S4`)](https://www.ti.com/lit/ds/symlink/lm2596.pdf) | Simulated OCV curve spans `83.76 V` (0% SOC) to `108.24 V` (100% SOC) |
| **Current Sensor Automotive Rating** | [Allegro ACS712 (`S1`)](https://www.allegromicro.com/-/media/files/datasheets/acs712-datasheet.pdf) explicitly states: *"Not intended for automotive applications"* | Simulated traction current reaches `225.9 A` (`21.685 kW` at `96 V` full throttle) |
| **Electrical Interconnection Rule** | **Low-voltage educational bench concept only (requires part ID & fusing)** | **Standalone software physics equation demo — NEVER connect to 12 V hardware** |
