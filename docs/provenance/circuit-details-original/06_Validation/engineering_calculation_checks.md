# Engineering Calculation Checks

**Method:** the included Python calculation script was run and its outputs independently spot-checked using exact rational divider ratios, direct equations and unit conversions. No circuit simulator, hardware test, or website test was run in this review. Numerical precision is arithmetic precision, not measurement accuracy.

## Divider and ADC checks

| Network | Calculation | Result | Interpretation |
|---|---|---:|---|
| Current scaler 27 kΩ / 20 kΩ | 20/(27+20) | 0.4255319 | Direct sensor output assumption |
| ACS zero node | 2.5×0.4255319 | 1.06383 V | Assumed 5.00 V rail, nominal VCC/2 |
| ACS ±30 A nodes | (2.5 ± 30×0.066)×0.4255319 | 0.22128–1.90638 V | Nominal x30A sensitivity, not module guarantee |
| ADC current sensitivity | 66 mV/A×0.4255319 | 28.085 mV/A | Nominal |
| ACS output upper rail bound | 5.5×kmax, kmax with 1% corners | 2.36736 V | Under cited 2.45 V suggested upper range, excludes fault/transient |
| Voltage divider 68 kΩ / 10 kΩ | 10/(68+10) | 0.1282051 | Per branch, 1% assumed |
| Voltage node at 18 V | 18×k | 2.30769 V | Assumed DC ceiling |
| Worst 1% voltage node | 18×0.13045725 | 2.34823 V | Top 67.32 kΩ, bottom 10.10 kΩ |
| Input reaching 2.45 V at worst corner | 2.45/0.13045725 | 18.7801 V | Not a safe/transient rating |
| Legacy 120 kΩ / 22 kΩ at 18 V | 18×22/142 | 2.78873 V nominal; 2.83619 V worst | Above 2.45 V target |
| Legacy 15 kΩ / 20 kΩ at +30 A | 4.48×20/35 | 2.56000 V | Above 2.45 V target |
| Legacy positive current at 2.45 V node | (2.45/(20/35)−2.5)/0.066 | 27.083 A | Nominal threshold only |

Classic ESP32 documentation characterizes 11 dB attenuation for most accurate readings from about 150 to 2450 mV. ADC errors remain after divider arithmetic. The Espressif hardware checklist reports a ±60 mV calibrated ADC error example; mapped through this nominal divider that is about ±0.468 V on the source voltage and ±2.14 A for the ACS scaler. These are error-budget illustrations, not expected complete-system accuracy.

## Filters and low-voltage branch budget

- 68 kΩ || 10 kΩ = 8.7179 kΩ; with 100 nF, f_c = 1/(2πRC) = 182.56 Hz.
- 27 kΩ || 20 kΩ = 11.4894 kΩ; with 100 nF, f_c = 138.52 Hz.
- At 18 V, the 78 kΩ voltage divider draws 0.23077 mA and dissipates 4.15385 mW total nominally.
- Assumed buck budget: 5 V×0.60 A / (0.75×10.5 V) + 0.010 A = 0.39095 A input. This does not select F2.

## Capacity and example cost

- 12×7.6 = 91.2 Wh nominal.
- 96×150 = 14,400 Wh = 14.4 kWh nominal.
- Invented load example: 12 V×0.5 A×2 h = 12 Wh; 12 V×4 A×0.25 h = 12 Wh; total 24 Wh = 0.024 kWh. At an assumed ₹8/kWh, the arithmetic charge is ₹0.192. It is not a measured load, tariff or battery-to-grid loss result.

## Existing EV simulator spot-check

At 22 m/s, 50% SOC and defaults: CdA drag force 191.51 N, rolling force 84.76 N, total 276.27 N, wheel power 6.078 kW, required battery power at η = 0.837 plus 180 W auxiliary = 7.441 kW, or 93.96 Wh/km. Yet full throttle keeps requesting 18 kW mechanical at the speed cap, corresponding to 818.18 N and 21.685 kW electrical draw (273.81 Wh/km). This does not balance steady road load.

- Nominal pack division: 14.4 kWh/93.96 Wh/km = 153.26 km; 14.4 kWh/273.81 Wh/km = 52.59 km. Neither is a range prediction.
- Regeneration multiplier: 0.90×0.93×0.28 = 0.23436 = 23.436% before caps/gates, not 28%.
- 11 kW/96 V = 114.58 A if 11 kW were DC pack output at nominal voltage; source does not establish that it is DC output or pack acceptance.
- If 180 W is a 12 V output load and assumed DC/DC efficiency is 88%, idealized input is 204.55 W. The simulator does not apply its defined dcdcEff.
- EPA 8.887 kg/US gal ÷ 3.785411784 L/US gal = 2.34770 kg/L. At 7.2 L/100 km: 16.9034 kg/100 km versus the code’s 16.632 kg/100 km.

The executable values are stored in calculation_results.json. The method and assumptions are printed in calculation_checks.py; nothing there establishes real component performance.
