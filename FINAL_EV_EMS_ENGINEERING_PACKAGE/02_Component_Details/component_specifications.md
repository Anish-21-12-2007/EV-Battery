# Component Specifications, Datasheet Limits & Hardware Boundaries

**Cross-Reference:** [`component_list.csv`](component_list.csv) (42 BOM entries) and [`../07_References/source_register.md`](../07_References/source_register.md) (`S1`–`S17`)  
**Disposition:** Every entry below separates **verified manufacturer IC datasheet specifications** from **unidentified module/breakout hardware**.

---

## 1. Verified Semiconductor IC & Passive Specifications

### 1.1 Allegro `ACS712ELCTR-30A-T` Hall-Effect Current Sensor IC (`S_M` Candidate — Source `S1`)
- **Supply Voltage ($V_{	ext{CC}}$):** `4.5 V` minimum, `5.0 V` nominal, `5.5 V` maximum; supply current $I_{	ext{CC}} = 10	ext{ mA}$ typical (`13 mA` max) at $V_{	ext{CC}} = 5.0	ext{ V}$.
- **Optimized Primary Current Range:** `−30 A` to `+30 A` DC/AC (`ACS712ELCTR-30A-T`). Other family suffixes: `ACS712ELCTR-05B-T` (`±5 A`, `185 mV/A` typical) and `ACS712ELCTR-20A-T` (`±20 A`, `100 mV/A` typical).
- **Sensitivity & Ratiometric Zero Output (`x30A` at $25^\circ	ext{C}$, $V_{	ext{CC}} = 5.0	ext{ V}$):**
  - Zero-current output voltage: $V_{	ext{IOUT(Q)}} = 0.5 	imes V_{	ext{CC}} = 2.500	ext{ V}$ nominal.
  - Sensitivity: `63 mV/A` min, `66 mV/A` typical, `69 mV/A` max.
  - Ratiometric behavior: Both $V_{	ext{IOUT(Q)}}$ and sensitivity scale proportionally with $V_{	ext{CC}}$. A `±2%` (`±100 mV`) variation on the `5.0 V` supply rail shifts $V_{	ext{ZERO}}$ by `±50 mV`, producing a `±0.758 A` zero-offset error if uncompensated.
- **Internal Bandwidth & Filter Pin (`Pin 6`):** Internal filter resistance $R_{F(	ext{INT})} = 1.7	ext{ k}\Omega$ typical; maximum bandwidth `80 kHz` (`1 nF` external `C_FILTER_M` sets pole near `90 kHz`; `47 nF` sets pole near `2 kHz`). Typical application requires a `0.1 µF` (`100 nF`) `C_BYP_M` ceramic decoupling capacitor from `VCC` to `GND`.
- **Primary Conductor Resistance:** `1.2 mΩ` typical internal copper conduction path inside the SOIC-8 package.
- **Explicit Automotive Exclusion:** The [Allegro ACS712 Datasheet, Rev. 22](https://www.allegromicro.com/-/media/files/datasheets/acs712-datasheet.pdf) explicitly states on Page 1: **"The device is not intended for automotive applications."**
- **IC vs. Breakout Distinction (`S_M` vs. `S_M_BOARD`):** The IC's `±30 A` range and `2.1 kV RMS` package isolation apply only to the bare SOIC-8 IC properly mounted on an Allegro-evaluation-grade layout. Generic screw-terminal clone breakout boards frequently have thin `1 oz` (`35 µm`) copper traces, unrated 2-pin terminal blocks (often rated only `10–15 A`), compromised creepage, and occasionally unannounced onboard resistor dividers. Inspect `S_M_BOARD` before use.

### 1.2 Classic `ESP32` Microcontroller & `ADC1` Subsystem (`U_ESP` Candidate — Sources `S2`, `S3`, `S14`, `S15`, `S17`)
- **Supply Voltage ($V_{	ext{DD3P3}}$):** `3.0 V` to `3.6 V` (`3.3 V` nominal).
- **Absolute Maximum GPIO Input Voltage Ratings ([ESP32-WROOM-32 Datasheet, `S15`](https://documentation.espressif.com/esp32-wroom-32_datasheet_en.html)):**
  - Lower limit: `−0.3 V`.
  - Upper limit: $V_{	ext{DD}} + 0.3	ext{ V}$ (`3.6 V` at nominal $V_{	ext{DD}} = 3.3	ext{ V}$; **`0.3 V` when unpowered at $V_{	ext{DD}} = 0	ext{ V}$!**).
- **ADC1 Channel Mapping ([Espressif GPIO Guide, `S3`](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/peripherals/gpio.html)):**
  - `GPIO32` (`ADC1_CH4`), `GPIO33` (`ADC1_CH5`), `GPIO34` (`ADC1_CH6`, input-only, no internal pullup/pulldown), `GPIO35` (`ADC1_CH7`, input-only, no internal pullup/pulldown).
  - Why `ADC1` is mandatory over `ADC2`: `ADC2` (`GPIO0, 2, 4, 12–15, 25–27`) is shared with the internal Wi-Fi radio controller and cannot take reliable readings whenever Wi-Fi is active.
- **ADC1 11 dB Attenuation (`ADC_ATTEN_DB_11`) Suggested Accuracy Window ([Espressif ESP-IDF v4.2 ADC Guide, `S2`](https://docs.espressif.com/projects/esp-idf/en/v4.2/esp32/api-reference/peripherals/adc.html)):**
  - Suggested measurable range for best accuracy: **`150 mV` to `2450 mV`** (`0.150 V` to `2.450 V`).
  - Above `2.45 V`, the internal SAR ADC exhibits severe compression/roll-off; below `0.15 V`, readings suffer from dead-zone offset.
  - Per [Espressif ESP32 Schematic Checklist (`S17`)](https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32/schematic-checklist.html), after `100 nF` bypass filtering and eFuse calibration, residual error over `150–2450 mV` is approximately `±60 mV` (which maps to `±0.468 V` on a `68 kΩ / 10 kΩ` voltage divider and `±2.136 A` on a `27 kΩ / 20 kΩ`-scaled `ACS712-30A`).

### 1.3 Texas Instruments `LM2596` Step-Down Switching Regulator IC (`U_BUCK_IC` Candidate — Source `S4`)
- **Input Voltage Range ($V_{	ext{IN}}$):** `4.5 V` to **`40.0 V` absolute maximum** ([TI LM2596 Datasheet, SNVS124G](https://www.ti.com/lit/ds/symlink/lm2596.pdf)).
- **Output Current Rating:** Up to `3.0 A` continuous **only** when paired with TI-specified inductor saturation rating, Schottky catch diode (`1N5824` / `5 A`), low-ESR capacitors, and adequate copper PCB thermal heatsinking.
- **Switching Frequency:** `150 kHz` nominal (genuine TI silicon).
- **IC vs. Generic Module Distinction (`U_BUCK_IC` vs. `U_BUCK_BOARD`):** Low-cost adjustable `LM2596` modules often carry undersized toroidal/drum inductors, `35 V` electrolytic input capacitors, high thermal resistance without a heatsink (limiting continuous current to `~1.0–1.5 A`), and an uncalibrated multi-turn potentiometer. Always verify `IN−` to `OUT−` ground continuity and pre-adjust the output to `5.00 V` under dummy load before connecting `U_ESP` or `S_M`.

### 1.4 Amptek `12 V, 7.6 Ah` Battery Listing Candidate (`BAT1` — Source `S5`)
- **Manufacturer Table Listing ([Amptek India, `S5`](https://amptek.aukark.co.in/electric-toy-ride-ons/)):** Model row lists `12 V`, `7.6 Ah`, mass `2050 g` (`91.2 Wh` nominal product).
- **Unverified Physical Parameters:** Physical battery installation, terminal type (e.g., `F1`/`F2` faston spade lugs), chemistry/revision, C-rate discharge curve (typically `20-hour` rate `0.38 A` for SLA), Peukert capacity reduction at `4–30 A` motor loads, maximum float/cycle charge voltage (`~13.8–14.7 V`), low-voltage cutoff (`~10.5 V`), internal resistance ($R_{	ext{int}}$), and prospective short-circuit fault current ($I_{	ext{sc}}$, often `>100–200 A` for lead-acid) are unverified.

### 1.5 Passive Conditioning Networks (`R_LH`, `R_LL`, `R_VH`, `R_VL`, `R_MH`, `R_ML`, `C_L`, `C_V`, `C_M`)
- **Voltage Dividers (`68 kΩ / 10 kΩ`, 1% metal film, `C = 100 nF` X7R ceramic $\ge 25	ext{ V}$):**
  - Ratio $k_V = rac{10}{78} = rac{5}{39} pprox 0.128205$; 1% corner bounds $k_{V,\min} = 0.125986$, $k_{V,\max} = 0.130457$.
  - At `18.0 V` DC design ceiling: $V_{	ext{ADC,nom}} = 2.3077	ext{ V}$, $V_{	ext{ADC,max}} = 2.3482	ext{ V}$, $I_{	ext{div}} = 0.2308	ext{ mA}$, $P_{	ext{total}} = 4.154	ext{ mW}$ ($3.621	ext{ mW}$ in `68 kΩ`, $0.533	ext{ mW}$ in `10 kΩ`).
  - Thévenin impedance $R_{	ext{th}} = 8.718	ext{ k}\Omega$; RC pole $f_c = 182.56	ext{ Hz}$.
- **Motor Current Scaler (`27 kΩ / 20 kΩ`, 1% metal film, `C_M = 100 nF` X7R ceramic $\ge 16	ext{ V}$):**
  - Ratio $k_I = rac{20}{47} pprox 0.425532$; 1% corner bounds $k_{I,\min} = 0.420650$, $k_{I,\max} = 0.430428$.
  - Scales `2.50 V` ($0	ext{ A}$) to $1.0638	ext{ V}$ and `4.48 V` ($+30	ext{ A}$) to $1.9064	ext{ V}$ nominal ($1.9283	ext{ V}$ worst 1% resistor corner; $1.9671	ext{ V}$ combining `69 mV/A` max sensitivity + 1% resistor corner).
  - Thévenin impedance $R_{	ext{th}} = 11.489	ext{ k}\Omega$; RC pole $f_c = 138.52	ext{ Hz}$.
