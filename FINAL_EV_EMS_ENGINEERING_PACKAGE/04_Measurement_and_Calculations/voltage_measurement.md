# Voltage Measurement

For each branch use a divider only after its positive DC input maximum and ground reference are known:

V_ADC = V_branch × R_bottom / (R_top + R_bottom)

Proposed per-channel values are R_top = 68 kΩ and R_bottom = 10 kΩ, each 1%. Nominal ratio = 0.128205. At the design-assumption limit of 18.0 V, the node is 2.3077 V. Choosing the resistor corner that maximizes the node (R_top = 67.32 kΩ; R_bottom = 10.10 kΩ) gives 2.3482 V. The upper 2.45 V classic ESP32 11 dB suggested accuracy point is reached at about 18.780 V for that corner.

At 18 V nominal, divider current is 18/78k = 0.2308 mA and total resistor dissipation is 18²/78k = 4.154 mW. This is not a fault, surge or resistor-voltage rating check. The 18 V limit is not sourced from the Amptek battery listing and is not a charging recommendation.

The divider measures its input node relative to logic ground. If the return conductor has nontrivial drop, that is not exactly the voltage across the load terminals. A fuse, TVS or reverse-protection device is not present merely because a divider is present.

The classic ESP32 11 dB suggested range is approximately 0.150–2.450 V. A zero-volt bus lies below the suggested range. Calibrate actual ADC response over expected operating points; do not infer precision or GPIO survival from this divider arithmetic.


---

## Upgraded Tolerance Corner, Fault Current & Return-Drop Derivations

### 1. Exact 1% vs. 0.1% Resistor Corner Summary (`68 kΩ / 10 kΩ`)

| Input Condition | Nominal ($k = 5/39 pprox 0.128205$) | 1% Worst High ($k_{\max} = 0.130457$) | 1% Worst Low ($k_{\min} = 0.125986$) | 0.1% Worst High ($k_{\max,0.1\%} = 0.128429$) |
| :--- | ---: | ---: | ---: | ---: |
| `12.00 V` Nominal Bus | `1.5385 V` | `1.5655 V` | `1.5118 V` | `1.5411 V` |
| `18.00 V` Design Ceiling | `2.3077 V` | `2.3482 V` | `2.2678 V` | `2.3117 V` |
| Input Reaching `2.450 V` (`ADC1` Ceiling) | `19.1100 V` | `18.7801 V` | `19.4466 V` | `19.0767 V` |
| Input Reaching `3.600 V` (`GPIO` Powered Abs Max) | `28.0800 V` | `27.5952 V` | `28.5745 V` | `28.0311 V` |

### 2. Open-Bottom-Resistor & Unpowered-MCU Fault Currents
- **Open Bottom Resistor (`R_LL` or `R_VL` Open Circuit at `18.0 V`):**
  - If the ground connection to `R_LL` or `R_VL` opens while `18.0 V` is present on the branch, `R_LH` / `R_VH` (`68 kΩ`) connects `18.0 V` directly to the `ESP32` `ADC1` pin (`GPIO33` / `GPIO35`).
  - With the `ESP32` powered ($V_{	ext{DD}} = 3.3	ext{ V}$, clamp at $3.6	ext{ V}$):
    $$I_{	ext{fault,powered}} = rac{18.0	ext{ V} - 3.6	ext{ V}}{68\,000	ext{ }\Omega} = 0.2118	ext{ mA}$$
  - With the `ESP32` unpowered ($V_{	ext{DD}} = 0	ext{ V}$, absolute maximum pin voltage $0.3	ext{ V}$ per `S15`):
    $$I_{	ext{fault,unpowered}} = rac{18.0	ext{ V} - 0.3	ext{ V}}{68\,000	ext{ }\Omega} = 0.2603	ext{ mA}$$
  - Always disconnect or switch off the battery (`SW1`) before removing `ESP32` power, or add a low-leakage `3.3 V` clamping/isolation buffer.
