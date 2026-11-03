# EV-EMS simulation model

The simulator is an editable educational scenario. Its 96 V vehicle is independent of the proposed 12 V physical monitoring circuit. None of the scenario values are production vehicle specifications, identified battery limits, or a hardware test result.

## Default scenario and measurement boundaries

| Parameter | Symbol | Default | Units | Meaning & applicable limits |
| --- | :---: | ---: | :---: | --- |
| Vehicle mass | $m$ | 720 | $\text{kg}$ | Point-mass longitudinal vehicle ($1\text{–}20{,}000\text{ kg}$) |
| Driveline rotational inertia | $J_{\text{rot}}$ | 0 (editable $0\text{–}50$) | $\text{kg}\cdot\text{m}^2$ | Axle-referred rotational inertia; $m_{\text{eff}} = m + J_{\text{rot}}/r_w^2$ |
| Wheel radius | $r_w$ | 0.31 | $\text{m}$ | Effective rolling radius ($0.05\text{–}2.0\text{ m}$) |
| Gear reduction ratio | $G$ | 8.2 | — | Two-stage reduction $(41/15)\times(60/20)=8.2:1$ ($1\text{–}40$) |
| Speed ceiling | $v_{\max}$ | 22 (79.2) | $\text{m/s}$ ($\text{km/h}$) | Software speed governor ($0.1\text{–}150\text{ m/s}$) |
| Motor torque ceiling | $\tau_{m,\max}$ | 180 | $\text{N}\cdot\text{m}$ | Peak shaft torque ($0\text{–}5{,}000\text{ N}\cdot\text{m}$) |
| Motor mechanical power ceiling | $P_{m,\max}$ | 18,000 | $\text{W}$ | Peak mechanical shaft output ($0\text{–}2{,}000{,}000\text{ W}$) |
| Motor / inverter efficiency | $\eta_m / \eta_{\text{inv}}$ | 0.90 / 0.93 | — | Combined drivetrain efficiency $\eta_{\text{drive}} = 0.837$ ($0.01\text{–}1.0$) |
| Drag coefficient / frontal area | $C_d / A$ | 0.34 / 1.9 | — / $\text{m}^2$ | Aerodynamic drag parameters ($C_d \in [0,2], A \in [0.1,20]\text{ m}^2$) |
| Air density / rolling coeff. | $\rho / C_{rr}$ | 1.225 / 0.012 | $\text{kg/m}^3$ / — | Constant air density and tire rolling resistance ($C_{rr} \in [0,0.2]$) |
| Road gradient | $\text{grade}$ | 0 (editable $-25\text{ to }+25$) | $\%$ | Slope angle $\theta = \arctan(\text{grade}/100)$ |
| Pack nominal voltage / capacity | $V_{\text{nom}} / Q_{\text{nom}}$ | 96 / 150 | $\text{V}$ / $\text{Ah}$ | Nominal arithmetic: $96\times 150 = 14.4\text{ kWh}$ |
| Assumed usable energy | $E_{\text{usable}}$ | 12.96 | $\text{kWh}$ | Nominal $14.4\text{ kWh} \times (1 - 10\%\text{ reserve})$; **unverified assumption** |
| Initial state of charge | $\text{SOC}_0$ | 72 | $\%$ | Reset assumption ($0\text{–}100\%$) |
| Pack internal resistance | $R_{\text{int}}$ | 0.035 | $\Omega$ | Lumped Thévenin resistance ($0\text{–}2\text{ }\Omega$) |
| DC/DC converter efficiency | $\eta_{\text{dcdc}}$ | 0.88 | — | Converts low-voltage auxiliary output demand to pack-bus input |
| Headlights / air conditioning | $P_{\text{HL}} / P_{\text{AC}}$ | 80 / 750 | $\text{W}$ | Editable demonstration output-side loads ($0\text{–}10{,}000\text{ W}$) |
| Cabin lights / infotainment | $P_{\text{CL}} / P_{\text{INF}}$ | 12 / 35 | $\text{W}$ | Editable demonstration output-side loads ($0\text{–}10{,}000\text{ W}$) |
| Maximum braking deceleration | $a_{\text{brake},\max}$ | 3.0 | $\text{m/s}^2$ | Commanded braking deceleration ($0\text{–}12\text{ m/s}^2$) |
| Regeneration fraction / ceiling | $f_{\text{regen}} / P_{\text{regen},\max}$ | 0.28 / 10,000 | — / $\text{W}$ | Fraction of mechanical braking power before $\eta_{\text{drive}}$ ($23.436\%$ net) |
| Fixed integration interval | $\Delta t$ | 0.02 | $\text{s}$ | Frame-rate-independent fixed step ($0.001\text{–}0.1\text{ s}$) |
| Range reserve / observation gate | $\text{SOC}_{\text{res}} / d_{\min}$ | 10% / 500 | $\%$ / $\text{m}$ | Extrapolation withheld before $500\text{ m}$ and positive net energy use |
| Electricity tariff | $T_{\text{INR}}$ | Unset | $₹/\text{kWh}$ | User-entered tariff; no utility tariff assumed by default |

All five devices are independently enabled. Auxiliary ratings can be changed or cleared. Clearing a rating disables that device; zero is a valid scenario value. Pausing freezes simulation time and all demand while retaining auxiliary selections. Reset clears travel and energy and disables devices, retaining the selected ratings, tariff and assumptions.

**Reset trip energy** requires explicit user confirmation (with a Cancel option) and clears the device, gross, recovered, net, terminal, mechanical and internal-loss energy ledgers without changing motion, state of charge, switches, throttle, elapsed simulation time or traveled distance. A new trip-distance baseline and kinetic-energy baseline start at that instant; range observation must accumulate another 500 m. Switching a device OFF stops its own accumulation and retains all consumption already recorded.

## Governing equations, longitudinal dynamics and kinematics

1. **Slope geometry and road load forces:**
   $$\theta = \arctan\left(\frac{\text{grade}}{100}\right), \quad F_{\text{drag}} = \frac{1}{2}\rho C_d A v^2, \quad F_{\text{roll}} = C_{rr} m g \cos\theta, \quad F_{\text{gravity}} = m g \sin\theta$$
   $$F_{\text{road}} = F_{\text{drag}} + F_{\text{roll}} + F_{\text{gravity}}$$
2. **Rotational inertia and effective inertial mass:**
   $$m_{\text{eff}} = m + \frac{J_{\text{rot}}}{r_w^2}, \quad a = \frac{F_{\text{tractive}} - F_{\text{road}} - F_{\text{brake}}}{m_{\text{eff}}}$$
   $$E_{k,\text{trans}} = \frac{1}{2} m v^2, \quad E_{k,\text{rot}} = \frac{1}{2} J_{\text{rot}} \omega_w^2 = \frac{1}{2}\left(\frac{J_{\text{rot}}}{r_w^2}\right)v^2, \quad E_{k,\text{total}} = \frac{1}{2} m_{\text{eff}} v^2$$
3. **Drivetrain kinematics, gearing and open differential:**
   $$\omega_w = \frac{v}{r_w}\text{ (rad/s)}, \quad \omega_m = G \omega_w, \quad \omega_{\text{int}} = -\frac{\omega_m}{41/15}, \quad \text{RPM}_w = \frac{60\,\omega_w}{2\pi}, \quad \text{RPM}_m = G\,\text{RPM}_w$$
   $$\tau_w = F_{\text{tractive}} r_w, \quad \tau_m = \frac{\tau_w}{G}, \quad \tau_L = \tau_R = \frac{\tau_w}{2}, \quad P_{\text{mech,drive}} = F_{\text{tractive}}\bar{v} = \tau_w \bar{\omega}_w = \tau_m \bar{\omega}_m$$
4. **Exact step-level mechanical work-energy conservation:**
   Each fixed step $\Delta t$ integrates velocity with $v_1 = v_0 + a\Delta t$ and midpoint velocity $\bar{v} = \frac{v_0 + v_1}{2}$. Because $(F_{\text{tractive}} - F_{\text{road}} - F_{\text{brake}})\bar{v}\Delta t = m_{\text{eff}} a \left(\frac{v_0+v_1}{2}\right)\Delta t = \frac{1}{2}m_{\text{eff}}(v_1^2 - v_0^2)$, the mechanical energy balance holds to floating-point machine epsilon ($\sim 10^{-14}\text{ Wh}$):
   $$W_{\text{traction,mech}} - E_{\text{aero}} - E_{\text{roll}} - \Delta E_{\text{potential}} - E_{\text{brake,mech}} = \Delta E_{k,\text{trans}} + \Delta E_{k,\text{rot}}$$
5. **Braking energy split and regenerative braking bounds:**
   $$P_{\text{brake,mech}} = F_{\text{brake}}\bar{v}, \quad P_{\text{regen}} = \min\left(P_{\text{brake,mech}} f_{\text{regen}} \eta_m \eta_{\text{inv}},\, P_{\text{regen},\max},\, P_{\text{charge,limit}} + P_{\text{aux,bus}}\right)$$
   $$P_{\text{brake,dissipated}} = P_{\text{brake,mech}} - P_{\text{regen}}$$
6. **Thévenin battery model and coulomb counting:**
   $$V_{\text{oc}}(\text{SOC}) = V_{\text{nom}}\left[1 + \frac{13}{96}\tanh\big(3.5(\text{SOC} - 0.5)\big)\right], \quad V_{\text{term}} = V_{\text{oc}} - I R_{\text{int}}, \quad P_{\text{term}} = V_{\text{term}} I$$
   $$I = \frac{2 P_{\text{term}}}{V_{\text{oc}} + \sqrt{V_{\text{oc}}^2 - 4 R_{\text{int}} P_{\text{term}}}}, \quad \text{SOC}(t + \Delta t) = \text{SOC}(t) - \frac{I \Delta t}{3600 \, Q_{\text{nom}}}$$

## Validated multi-scenario simulation results

Executed via `node scripts/run-driving-scenarios.mjs` (saved in `validation/driving-scenarios-validation.json`, tariff ₹8.50/kWh):

| Scenario | Grade (%) | $J_{\text{rot}}$ ($\text{kg}\cdot\text{m}^2$) | Final speed ($\text{km/h}$) | Distance ($\text{m}$) | Gross draw ($\text{Wh}$) | Regen ($\text{Wh}$) | Net pack ($\text{Wh}$) | Kinetic ($\text{Wh}$) | Potential $\Delta E_p$ ($\text{Wh}$) | Mech. balance error ($\text{Wh}$) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **1. Acceleration** (30 s, 100% throttle) | 0.0 | 1.8 | 79.200 | 572.444 | 107.784616 | 0.000000 | 107.784616 | 49.659105 | 0.000000 | $-6.47\times 10^{-13}$ |
| **2. Cruising** (30 s, 65% throttle, governor) | 0.0 | 0.0 | 79.200 | 519.549 | 99.301758 | 0.000000 | 99.301758 | 48.400000 | 0.000000 | $-1.06\times 10^{-12}$ |
| **3. Braking & Regen** (12 s accel + 30 s 60% brake) | 0.0 | 1.8 | 0.000 | 274.597 | 63.910973 | 9.081744 | 54.829229 | 0.000000 | 0.000000 | $-2.84\times 10^{-14}$ |
| **4. Downhill Grade** (30 s, $-6\%$ slope, 10% brake) | $-6.0$ | 1.8 | 17.437 | 73.605 | 1.202652 | 1.034997 | 0.167654 | 2.407008 | $-8.649170$ | $+1.87\times 10^{-14}$ |
| **5. All 5 Devices** (30 s, 25% throttle + 4 aux) | 0.0 | 1.8 | 54.383 | 313.665 | 51.242898 | 0.000000 | 51.242898 | 23.414244 | 0.000000 | $-2.13\times 10^{-14}$ |

## In-car trip-energy display

The actual `Screen_Infotainment` mesh uses a dynamic canvas texture. The energy page contains five device rows and a total, with **only** electricity consumed (kWh), battery percentage consumed (%) and cost (₹). Each row uses `energyWh / 1000`, `(energyKwh / usablePackEnergyKwh) × 100`, and `energyKwh × tariffInrPerKwh`. The total sums all five cumulative rows, including consumption retained by devices now OFF. No voltage, current, watts, RPM, frequency or instantaneous demand is rendered on the infotainment energy page.

## Limits and regression evidence

Run `npm test` (`79` unit tests across `13` test files) and `node scripts/run-driving-scenarios.mjs` for numerical, physics, circuit and display verification. These are software checks, not physical hardware tests.
