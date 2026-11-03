# Complete Circuit Explanation — Upgraded Conditional Two-Load 12 V Proposal

**Schematic Reference:** [`2D_circuit_schematic.svg`](2D_circuit_schematic.svg) and [`2D_circuit_schematic.png`](2D_circuit_schematic.png)  
**Netlist Reference:** [`wiring_connections.csv`](wiring_connections.csv) (`W001`–`W060`)  
**BOM Reference:** [`../02_Component_Details/component_list.csv`](../02_Component_Details/component_list.csv) (42 items)

---

## 1. Positive Power Distribution & Branch Takeoffs (`W001`–`W015`, `W054`–`W055`, `W060`)

1. **Primary Battery Protection & Master Isolation (`W001`–`W003`):**
   - Battery positive (`BAT1.BAT+`) routes via `W001` to the main fuse (`F1`). `F1` must be mounted immediately adjacent to `BAT+` so the unfused lead length is minimized against accidental short-circuit contact.
   - Downstream of `F1`, `W002` passes through the reverse-polarity protection placeholder (`RP1`) and master switch (`SW1`) to the insulated positive distribution busbar (`BUS+`, `W003`), where transient voltage suppressor placeholder `TVS1` (`W060`) clamps bus surges relative to `JGND.STAR_RETURN`.
2. **Three Independently Fused Branch Takeoffs from `BUS+`:**
   - **Branch 1 — Light (`W004`–`W006`):** `BUS+.OUT_L` → Light branch fuse `FL` → Light current transducer `S_L` (`IP+` to `IP−`) → 12 V DC Light load input (`L1.INPUT+`).
   - **Branch 2 — Motor (`W008`–`W010`, `W054`–`W055`):** `BUS+.OUT_M` → Motor branch fuse `FM` → Motor current sensor candidate `S_M` (`ACS712ELCTR-30A-T`, `IP+` to `IP−`) → Motor controller DC supply input (`MDRV.INPUT+`). The DC motor `M1` connects downstream of `MDRV` via `W054` and `W055`.
   - **Branch 3 — Electronics (`W012`–`W015`):** `BUS+.OUT_E` → Electronics fuse `F2` → `U_BUCK_BOARD.IN+` (`LM2596` candidate regulator) → `5.00 V` regulated output (`W015`) feeding `U_ESP.5V_IN` and sensor supply rails (`W018`, `W020`).

---

## 2. Corrected Return & Kelvin Star-Ground Topology (`W007`, `W011`, `W014`, `W016`, `W017`, `W052`, `W053`)

A critical correction in this upgraded package (`Finding I10` / `COR-04`) is the elimination of the daisy-chained return wire (`x=1205`) that appeared in the prior schematic:
- **High-Current Return Busbar (`JGND.STAR_RETURN`):**
  - `L1.INPUT−` (`W007`), `MDRV.INPUT−` (`W011`), and `U_BUCK_BOARD.IN−` (`W014`) each use a **separate home-run return conductor** directly to `JGND.STAR_RETURN`, which ties to `BAT1.BAT−` via heavy-gauge cable `W052`.
- **Quiet Analog/Logic Reference Busbar (`JGND.LOGIC_GND`):**
  - `U_BUCK_BOARD.OUT−` (`W016`), `U_ESP.GND` (`W017`), sensor signal grounds `S_M.GND` (`W019`) and `S_L.GND` (`W021`), decoupling capacitors `C_BYP_M`/`C_FILTER_M` (`W057`, `W059`), and all three passive divider/filter returns (`W027`, `W029`, `W034`, `W036`, `W041`, `W043`) terminate on `JGND.LOGIC_GND`.
- **Single-Point Kelvin Tie (`W053`):**
  - `JGND.LOGIC_GND` connects to `JGND.STAR_RETURN` at a single Kelvin star link (`W053`). Consequently, no motor startup current ($I_M$) or lamp current ($I_L$) flows through the `LOGIC_GND` reference path.

---

## 3. Analog Front-End Conditioning & Fault Boundaries (`W022`–`W044`)

1. **Branch Voltage Dividers (`GPIO33` via `NODE_VL` and `GPIO35` via `NODE_VM`):**
   - Each channel uses `68 kΩ` (`R_LH`, `R_VH`) over `10 kΩ` (`R_LL`, `R_VL`) with `1%` tolerance and a parallel `100 nF` ceramic filter capacitor (`C_L`, `C_V`).
   - Exact nominal ratio: $k_V = rac{10}{78} = rac{5}{39} pprox 0.128205$. At `18.0 V` DC, nominal output is `2.3077 V` (`2.3482 V` worst-1% corner), safely below the `2.450 V` classic `ESP32` `ADC1` 11 dB upper characterization limit (reached at `18.78 V` worst-1% corner).
2. **Motor Current Scaler (`GPIO34` via `NODE_IM`):**
   - Conditional on a verified direct `5.00 V` `ACS712ELCTR-30A-T` output with no onboard module divider, `R_MH` (`27 kΩ` 1%), `R_ML` (`20 kΩ` 1%), and `C_M` (`100 nF`) form a scaler of ratio $k_I = rac{20}{47} pprox 0.425532$ ($f_c = 138.52	ext{ Hz}$).
   - Maps `0 A` (`2.50 V` raw) to `1.0638 V`, `+30 A` (`4.48 V` raw) to `1.9064 V` nominal (`1.9283 V` worst-1% corner), and `−30 A` (`0.52 V` raw) to `0.2213 V` (`28.085 mV/A` scaled sensitivity).
3. **Light Current Channel (`GPIO32` via `U_I_L`):**
   - Kept explicitly conditional (`TBD`) until `L1` and `S_L` are identified. See [`../04_Measurement_and_Calculations/current_measurement.md`](../04_Measurement_and_Calculations/current_measurement.md) for the quantitative comparison between `ACS712-30A`, `ACS712-05B`, and `INA219` $	ext{I}^2	ext{C}$ digital shunt sensing.
