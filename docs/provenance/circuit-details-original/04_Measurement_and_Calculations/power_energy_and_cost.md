# Power, Energy and Cost

## Instantaneous DC power

For each defined DC branch input boundary:

P_L(t) = V_L(t) × I_L(t)  
P_M(t) = V_M(t) × I_M(t)  
P_load,total(t) = P_L(t) + P_M(t)

Use voltage and current at the same branch input boundary. With PWM or rapidly varying current, average synchronized instantaneous products, mean(V×I), rather than assume mean(V)×mean(I) is identical. The project does not specify sample timing, anti-alias filtering or a calibration error budget.

A measured branch-input product is electrical input power at that boundary. It is not motor shaft output. It excludes electronics unless their power is separately measured or included in a battery-terminal measurement.

## Energy

For sample interval Δt in seconds:

E_i(Wh) = Σ[V_i,k × I_i,k × Δt_k] / 3600  
E_i(kWh) = E_i(Wh) / 1000

Sum the Light and Motor branch energies once. If a separate main battery sensor is also used, do not add its total to the two branches; it already includes them. A main sensor can be used to compare aggregate battery input and branch totals plus electronics/conversion losses.

Coulomb-counting state of charge requires a known initial SOC, battery-specific capacity under conditions, current sign, charge efficiency and correction procedure. The identity alone does not establish SOC.

## Cost

A simple energy charge is C = E_grid,kWh × tariff(₹/kWh). For battery energy delivered to loads, grid energy is higher because charger/conversion losses exist. A meaningful bill comparison needs the actual tariff schedule, charging efficiency and billing boundary; fixed charges and time-of-use rates may apply.

No tariff is present in the project. The dashboard correctly leaves energy cost unavailable. The example in worked_calculation_examples.md uses an invented ₹8/kWh solely to show arithmetic. It is not an actual tariff or meter reading.

The simulator’s petrol panel uses fixed fuel consumption and a CO₂ factor; it does not calculate petrol price or EV charging cost. Its 9.1 kWh/L factor has no declared heating-value basis or traction-efficiency comparison boundary.
