# Voltage Measurement

For each branch use a divider only after its positive DC input maximum and ground reference are known:

V_ADC = V_branch × R_bottom / (R_top + R_bottom)

Proposed per-channel values are R_top = 68 kΩ and R_bottom = 10 kΩ, each 1%. Nominal ratio = 0.128205. At the design-assumption limit of 18.0 V, the node is 2.3077 V. Choosing the resistor corner that maximizes the node (R_top = 67.32 kΩ; R_bottom = 10.10 kΩ) gives 2.3482 V. The upper 2.45 V classic ESP32 11 dB suggested accuracy point is reached at about 18.780 V for that corner.

At 18 V nominal, divider current is 18/78k = 0.2308 mA and total resistor dissipation is 18²/78k = 4.154 mW. This is not a fault, surge or resistor-voltage rating check. The 18 V limit is not sourced from the Amptek battery listing and is not a charging recommendation.

The divider measures its input node relative to logic ground. If the return conductor has nontrivial drop, that is not exactly the voltage across the load terminals. A fuse, TVS or reverse-protection device is not present merely because a divider is present.

The classic ESP32 11 dB suggested range is approximately 0.150–2.450 V. A zero-volt bus lies below the suggested range. Calibrate actual ADC response over expected operating points; do not infer precision or GPIO survival from this divider arithmetic.
