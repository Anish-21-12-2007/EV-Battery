# Worked Calculation Examples

These are arithmetic examples only. None is a physical test, measured component value, actual tariff, or prediction.

## Existing/candidate divider calculations

For 68 kΩ / 10 kΩ: k = 10/(68+10) = 0.128205. At 18 V, V_ADC = 18k = 2.3077 V. At the worst 1% corner, k = 10.10/(67.32+10.10) = 0.130457 and V_ADC = 2.3482 V.

For 27 kΩ / 20 kΩ: k = 20/47 = 0.425532. Assuming ACS712-30A typical VZERO = 2.50 V and S = 0.066 V/A:
- V_ADC,0 = 2.50 × 0.425532 = 1.0638 V.
- V_ADC,+30A = (2.50 + 30×0.066) × 0.425532 = 1.9064 V.
- V_ADC,−30A = (2.50 − 30×0.066) × 0.425532 = 0.2213 V.
- Sensitivity at the ADC = 0.066 × 0.425532 = 28.085 mV/A.

The old 120 kΩ / 22 kΩ divider gives 18×22/142 = 2.7887 V nominal. The old 15 kΩ / 20 kΩ current scaler gives 4.48×20/35 = 2.560 V at nominal +30 A.

## Buck example budget

Assume 5.00 V × 0.60 A output, 75% efficiency at 10.5 V input, plus 10 mA overhead:
I_in = 5×0.60/(0.75×10.5) + 0.010 = 0.391 A.
This is an example budget only. It is not a fuse selection or measured converter load.

## Illustrative two-load energy/cost arithmetic

Assume, only for arithmetic:
- Light: 12 V × 0.50 A for 2 h = 12 Wh.
- Motor branch: 12 V × 4.0 A for 0.25 h = 12 Wh.
- Total = 24 Wh = 0.024 kWh.
- At an assumed tariff of ₹8/kWh, energy charge = 0.024×8 = ₹0.192.

Actual battery input energy and actual grid-billed energy differ by charger/converter losses and billing rules. This example does not describe any installed lamp/motor or actual tariff.

## EV diagnostic arithmetic from existing code

At 22 m/s, 720 kg, Cd 0.34, area 1.9 m² and Crr 0.012:
- F_drag = 0.5×1.225×0.34×1.9×22² = 191.51 N.
- F_roll = 0.012×720×9.81 = 84.76 N.
- Road load = 276.27 N; wheel power to hold speed = 276.27×22 = 6.078 kW.
- Combined motor/inverter efficiency = 0.90×0.93 = 0.837.
- Holding-speed battery input = 6.078/0.837 + 0.180 = 7.441 kW = 93.96 Wh/km at 79.2 km/h.
- Code full-throttle request remains 18 kW mechanical, force 18,000/22 = 818.18 N and battery power 18/0.837 + 0.180 = 21.685 kW = 273.81 Wh/km.

The nominal 14.4 kWh pack divided by those rates yields 153.3 km and 52.6 km respectively, but the model’s speed cap/full-throttle mismatch and unverified usable capacity make both invalid as range estimates.

The complete executable calculations and JSON output are in 06_Validation/calculation_checks.py and calculation_results.json.
