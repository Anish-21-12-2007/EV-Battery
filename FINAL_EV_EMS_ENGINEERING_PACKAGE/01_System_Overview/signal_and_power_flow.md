# Power Distribution, Return Routing & Analog Signal Flow

**Reference Drawings:** [`circuit_block_diagram.svg`](circuit_block_diagram.svg) (`.png`) and [`../03_Circuit_Design/2D_circuit_schematic.svg`](../03_Circuit_Design/2D_circuit_schematic.svg) (`.png`)  
**Reference Netlist:** [`../03_Circuit_Design/wiring_connections.csv`](../03_Circuit_Design/wiring_connections.csv) (`W001`–`W060`)

---

## 1. DC Positive Power Distribution Flow (`W001`–`W015`, `W054`–`W055`, `W060`)

1. **Primary Battery Feed (`W001`–`W003`):**
   - `BAT1.BAT+` → (`W001`, `PACK_POS`) → `F1.IN` (Main Fuse, located as close as practical to `BAT+` terminal to minimize unfused cable length).
   - `F1.OUT` → (`W002`, `SWITCHED_POS`, with series reverse-polarity protection candidate `RP1`) → `SW1.IN` (Master Switch).
   - `SW1.OUT` → (`W003`, `BUS_POS`) → `BUS+.IN` (Insulated positive distribution busbar, with transient voltage suppressor candidate `TVS1` across `BUS+` to `JGND.STAR_RETURN` via `W060`).
2. **Branch 1 — Light Power Path (`W004`–`W006`):**
   - `BUS+.OUT_L` → (`W004`) → `FL.IN` (Light branch fuse).
   - `FL.OUT` → (`W005`, `LIGHT_POS`) → `S_L.IP+` (Light series current transducer primary positive terminal).
   - `S_L.IP−` → (`W006`, `LIGHT_INPUT_POS`) → `L1.INPUT+` (12 V DC complete lamp assembly positive input).
3. **Branch 2 — Motor Controller & Motor Power Path (`W008`–`W010`, `W054`–`W055`):**
   - `BUS+.OUT_M` → (`W008`) → `FM.IN` (Motor branch time-delay fuse).
   - `FM.OUT` → (`W009`, `MOTOR_POS`) → `S_M.IP+` (`ACS712ELCTR-30A-T` candidate primary positive terminal).
   - `S_M.IP−` → (`W010`, `MOTOR_INPUT_POS`) → `MDRV.INPUT+` (Motor controller DC supply input positive).
   - `MDRV.MOTOR_OUT+` / `MOTOR_OUT−` → (`W054`, `W055`, `MOTOR_DRIVE_OUT`) → `M1.TERM+` / `TERM−` (DC motor terminals, isolated from single-ended ADC dividers).
4. **Branch 3 — Electronics & Sensor Supply Path (`W012`–`W015`, `W018`, `W020`):**
   - `BUS+.OUT_E` → (`W012`) → `F2.IN` (Electronics branch fuse).
   - `F2.OUT` → (`W013`, `BUCK_INPUT_POS`) → `U_BUCK_BOARD.IN+` (`LM2596` candidate buck converter input).
   - `U_BUCK_BOARD.OUT+` → (`W015`, `LOGIC_SUPPLY`) → `U_ESP.5V_IN` (only after verifying `5.00 V` regulation under load and checking USB/VIN backfeed isolation).
   - `U_BUCK_BOARD.OUT+` → (`W018` to `S_M.VCC` and `W020` to `S_L.VCC`, conditional on sensor voltage rating).

---

## 2. Corrected Kelvin Star Return & Grounding Flow (`W007`, `W011`, `W014`, `W016`, `W017`, `W052`, `W053`)

To eliminate common-impedance ground-bounce error ($\Delta V_{	ext{GND}} = I_{	ext{return}} R_{	ext{return}}$) present in the prior schematic's daisy-chained return line (`Finding I10`), all return paths are segregated into two sub-domains joined at a single Kelvin tie:

- **High-Current Power Return Sub-Domain (`JGND.STAR_RETURN`):**
  - `L1.INPUT−` → (`W007`, `LIGHT_RETURN`) → `JGND.STAR_RETURN`
  - `MDRV.INPUT−` → (`W011`, `MOTOR_RETURN`) → `JGND.STAR_RETURN`
  - `U_BUCK_BOARD.IN−` → (`W014`, `PACK_RETURN`) → `JGND.STAR_RETURN`
  - `JGND.STAR_RETURN` → (`W052`, heavy-gauge main negative cable) → `BAT1.BAT−`
- **Quiet Analog & Logic Reference Sub-Domain (`JGND.LOGIC_GND`):**
  - `U_BUCK_BOARD.OUT−` → (`W016`, `LOGIC_RETURN`) → `JGND.LOGIC_GND` (requires continuity check confirming non-isolated common-ground converter)
  - `U_ESP.GND` → (`W017`, `LOGIC_RETURN`) → `JGND.LOGIC_GND`
  - `S_M.GND` (`W019`), `S_L.GND` (`W021`), `C_BYP_M.B` (`W057`), `C_FILTER_M.B` (`W059`) → `JGND.LOGIC_GND`
  - Divider bottom resistors `R_LL.B` (`W027`), `R_ML.B` (`W034`), `R_VL.B` (`W041`) and filter capacitors `C_L.B` (`W029`), `C_M.B` (`W036`), `C_V.B` (`W043`) → `JGND.LOGIC_GND`
  - **Kelvin Link (`W053`):** Single low-impedance tie between `JGND.LOGIC_GND` and `JGND.STAR_RETURN` right at the star terminal block so zero motor or lamp return current flows through `LOGIC_GND` conductors.

---

## 3. Four-Channel Analog Measurement Chain (`W022`–`W044`)

| Channel | Sensed Quantity & Boundary | Passive / Conditioning Network | Filter Pole ($f_c$) & Impedance ($R_{	ext{th}}$) | Candidate Classic `ESP32` Pin | Nominal & Worst-Corner Node Voltage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **CH 1** | Light Branch Current $I_L$ (`S_L.OUT`, `W022`) | `U_I_L` conditioner (`W023`, TBD after `S_L` selection) | TBD (Depends on `S_L` & `U_I_L`) | `GPIO32` (`ADC1_CH4`) | Must be bounded within `0.150–2.450 V` (or replaced by `INA219` $	ext{I}^2	ext{C}$ on `GPIO21`/`22`) |
| **CH 2** | Light Input Voltage $V_L$ (`L1.INPUT+`, `W024`) | `R_LH = 68 kΩ` (1%), `R_LL = 10 kΩ` (1%), `C_L = 100 nF` (`NODE_VL`) | $R_{	ext{th}} = 8.718	ext{ k}\Omega$<br>$f_c = 182.56	ext{ Hz}$ | `GPIO33` (`ADC1_CH5`) | `1.5385 V` @ `12 V`; `2.3077 V` nom / `2.3482 V` worst-1% @ `18 V` (`2.45 V` hit at `18.78 V`) |
| **CH 3** | Motor Driver Input Current $I_M$ (`S_M.OUT`, `W031`) | `R_MH = 27 kΩ` (1%), `R_ML = 20 kΩ` (1%), `C_M = 100 nF` (`NODE_IM`) | $R_{	ext{th}} = 11.489	ext{ k}\Omega$<br>$f_c = 138.52	ext{ Hz}$ | `GPIO34` (`ADC1_CH6`, input-only) | `1.0638 V` @ `0 A`; `0.2213–1.9064 V` nom (`1.9283 V` worst-1%) @ `±30 A`; `2.3674 V` @ `5.5 V` rail bound |
| **CH 4** | Motor Driver Input Voltage $V_M$ (`MDRV.INPUT+`, `W038`) | `R_VH = 68 kΩ` (1%), `R_VL = 10 kΩ` (1%), `C_V = 100 nF` (`NODE_VM`) | $R_{	ext{th}} = 8.718	ext{ k}\Omega$<br>$f_c = 182.56	ext{ Hz}$ | `GPIO35` (`ADC1_CH7`, input-only) | `1.5385 V` @ `12 V`; `2.3077 V` nom / `2.3482 V` worst-1% @ `18 V` (`2.45 V` hit at `18.78 V`) |
