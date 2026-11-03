# Current Measurement

Separate Light and Motor readings require separate transducers. For each channel, place the sensor in series with the corresponding branch input conductor, after its branch fuse and before the measured equipment input. The single ACS712 in the existing handoff is upstream of a common bus; it measures aggregate switched current and cannot distinguish two branches.

For a direct ACS712 output:
V_OUT = V_ZERO + S × I
I = (V_OUT − V_ZERO) / S

For the conditional ACS712-30A example, S = 0.066 V/A typical at 25 °C and V_ZERO is nominally VCC/2. The actual zero, gain, temperature drift, supply variation, noise and module conditioning require calibration. Allegro’s specified suffix table gives 63–69 mV/A for the x30A family at 25 °C; using typical sensitivity for a worked estimate is not an accuracy guarantee.

With 27 kΩ above 20 kΩ, node ratio is k = 20/47 = 0.425532. Nominal zero node is 2.5 × k = 1.0638 V and scaled sensitivity is S_ADC = 0.066 × k = 0.028085 V/A. Invert as I = (V_ADC − V_ZERO × k)/(S × k). The nominal ±30 A output endpoints scale to 0.2213 V and 1.9064 V. A conservative 5.5 V sensor-rail bound with 1% resistor corners gives 2.3674 V at the ADC node; this bounds a rail-level output for the scaler only and does not protect against wiring faults or a powered sensor driving an unpowered ESP32.

The 100 nF capacitor with 27 kΩ || 20 kΩ has a nominal first-order pole around 138.5 Hz. It attenuates rapid variation and does not establish adequate sampling for motor PWM or capture fuse-clearing peaks. The Light sensor’s signal interface stays TBD until its exact sensor is selected.

Do not zero the sensor while electronics current flows through its primary path. Calibrate zero with genuine zero primary current and safe independent signal power, then characterize offset/gain against a suitable reference over the expected range. Do not hide electronics load with an auto-zero/deadband in coulomb integration.


---

## Upgraded Quantitative Analysis: Why `ACS712-30A` Is Unsuitable for a Small Light Branch (`S_L`)

In the worked two-load example (`12.0 V`, `I_L = 0.50 A` Light load), using an `ACS712ELCTR-30A-T` (`66 mV/A` typical sensitivity, scaled by `27 kΩ / 20 kΩ` where $k_I = 20/47 pprox 0.425532$) yields:
- Raw sensor voltage shift at `0.50 A`:
  $$\Delta V_{	ext{OUT}} = 0.50	ext{ A} 	imes 66	ext{ mV/A} = 33.00	ext{ mV}$$
- Scaled `ESP32` `ADC1` voltage shift at `0.50 A`:
  $$\Delta V_{	ext{ADC}} = 33.00	ext{ mV} 	imes rac{20}{47} = 14.04	ext{ mV}$$
- Against Espressif's cited `±60 mV` calibrated `ADC1` error example (`S17`), the equivalent current uncertainty is:
  $$\Delta I_{	ext{ADC,err}} = rac{\pm 60	ext{ mV}}{28.085	ext{ mV/A}} = \pm 2.136	ext{ A} \quad (\pm 427.3\% 	ext{ relative error at } 0.50	ext{ A!})$$

### Comparative Evaluation of Candidate Transducers for Light Branch `S_L`

| Transducer Candidate | Sensitivity / Shunt | Signal at `0.50 A` | Equivalent Error from `±60 mV` `ESP32` `ADC1` | Engineering Assessment for `S_L` |
| :--- | :--- | :--- | :--- | :--- |
| **`ACS712ELCTR-30A-T`** (`±30 A` Hall IC + `27k/20k`) | `66 mV/A` raw (`28.085 mV/A` scaled) | `14.04 mV` at `ADC1` | `±2.136 A` (`±427.3%`) | **Unsuitable** for a `0.5 A` lamp branch; signal is buried inside `ESP32` ADC noise/non-linearity and ratiometric `5 V` drift (`±0.758 A` per `±2%` $V_{	ext{CC}}$ shift). |
| **`ACS712ELCTR-05B-T`** (`±5 A` Hall IC + `27k/20k`) | `185 mV/A` raw (`78.723 mV/A` scaled) | `39.36 mV` at `ADC1` (`1.457 V` at `+5 A`) | `±0.762 A` (`±152.4%`) | **Marginal** if routed directly to `ESP32` `ADC1` without external precision ADC or op-amp zero-subtraction. |
| **`TI INA219 / INA226`** (High-Side $	ext{I}^2	ext{C}$ Shunt Monitor @ `3.3 V`) | `0.10 Ω` shunt (`100 mV/A`, `25 mW` @ `0.5 A`) | `50.00 mV` differential across shunt | **Bypasses `ESP32` `ADC1`** (`10 µV` LSB = `0.1 mA` step; `±0.5%` internal ADC) | **Recommended Architectural Option** once `L1` is confirmed `<3 A`: operates from `3.3 V` logic rail (`GPIO21`/`22` $	ext{I}^2	ext{C}$), measures high-side bus voltage (`0–26 V`) and current digitally, and eliminates `5 V` ratiometric drift. |
