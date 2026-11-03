# Independent simulation audit — 2026-11-03

The maintained software model is a numerical, educational scenario. These checks establish specific arithmetic and accounting properties; they do not certify the proposed 12 V hardware, predict an identified battery, or establish exact real-world vehicle physics.

## Corrections completed

1. **Controls between integration steps.** Previously, 0.01 s with a load ON followed by 0.01 s with it OFF could attribute both intervals to the OFF state, because the integration interval is 0.02 s. Input changes now settle the already elapsed fraction using the preceding controls. The same rule covers load ratings, physical assumptions, pause, throttle/brake and trip reset. Trip reset settles the elapsed charge removal before clearing the energy ledger, so battery state is retained and the new trip does not inherit old consumption.
2. **Long-call scheduling roundoff.** Repeatedly subtracting 0.1 s from a 1200 s update could perform 11,999 intervals rather than 12,000, leaving a nearly complete interval pending. The scheduler now calculates the integer interval count once and subtracts its duration once. Its tolerance is proportional to machine roundoff, not a material fraction of an interval. Real fractional remainders remain pending until enough time arrives or an input boundary settles them. Excessive calls are rejected before changing integrated or pending state.
3. **Representable cost results.** A finite, nonnegative tariff can still overflow JavaScript's representable range when multiplied by energy or when summing device costs. Unrepresentable costs are returned as `null`, with `costCalculationStatus: "numeric-overflow"`; changing to a representable tariff recovers immediately. Unset tariffs remain a separate `tariff-unset` state. Neither case is reported as zero cost.

## Independent calculation checks

`tests/simulation-audit.test.mjs` adds nine checks. The closed-form comparisons use known load-duration products and an independent antiderivative, rather than comparing one exported engine ledger with another exported engine ledger.

For an auxiliary output of 500 W and an assumed DC/DC efficiency of 0.8, terminal demand is 625 W. Over 1200 s, terminal energy must equal `625 × 1200 / 3600 = 208.333333333 Wh`. The test checks this at 0.1 s, 0.02 s and 0.001 s integration intervals (120 s for the 0.001 s case), including exact-duration scheduling. A separate piecewise test changes the load from 500 W to 250 W and the efficiency from 0.8 to 0.5 at substep boundaries, then compares against the analytic sum of the three power-duration products.

For the inherited proxy OCV curve, the change in chemical energy implied by coulomb-counted SOC has the independent closed form:

```text
F(s) = s + (13 / 96) / 3.5 × ln(cosh(3.5 × (s − 0.5)))
ΔEchemical_Wh = capacity_Ah × nominalVoltage_V × [F(initialSOC) − F(finalSOC)]
```

This is compared with signed terminal energy plus separately accumulated internal `I²R` heat. For 500 W output, 0.8 converter efficiency, 96 V nominal, 150 Ah, 0.035 Ω, initial SOC 0.72 and a 1200 s run:

| Integration interval | Terminal energy | Internal heat | Absolute chemical-energy residual |
| --- | ---: | ---: | ---: |
| 0.1 s | 208.333333333 Wh | 0.421188948 Wh | 0.000030377 Wh |
| 0.02 s (default) | 208.333333334 Wh | 0.421189047 Wh | 0.000006076 Wh |
| 0.004 s | 208.333333332 Wh | 0.421189067 Wh | 0.000001214 Wh |

The residual decreases by approximately five when the interval decreases by five, as expected for the first-order SOC integration. This is evidence of convergence for this scenario, not a universal error bound. The instantaneous OCV and battery current vary during the run; nominal voltage multiplied by removed charge is not the correct independent chemical-energy reference for this proxy curve.

The existing maintained tests also check kinetic-energy work, torque and power limits, speed-governor holding force, proportional load reduction at battery power limits, depletion, stopping-step regeneration, full-charge rejection, independent device accounting, retained OFF history, tariff recalculation and the actual infotainment texture's displayed columns.

## Measurement and physics limits

- Device energy measures supplied pack-terminal input energy. Auxiliary conversion losses are included in each auxiliary row; internal cell heat is reported separately. The gross device total retains prior use by devices now OFF. Regeneration is a separate recovered-energy ledger and reduces net battery energy, not an individual device row.
- Device battery percentages normalize consumption by the explicitly assumed usable energy, initially `96 V × 150 Ah × 0.9 = 12.96 kWh`. They are not measured SOC loss. Actual SOC follows the model's coulomb counter and proxy OCV; a percentage row may exceed 100% over a sufficiently long trip with recovery.
- The model uses a level-road point mass, fixed efficiencies and a lumped electrical resistance. It does not model validated tire traction/slip, temperature, chemical aging, measured OCV curves, battery polarization, converter transients, switching waveforms, wiring faults, contact resistance, or actual BMS/controller protection.
- The battery's theoretical resistance-model maximum power is a numerical constraint, not a safe current rating. The software scenario must not be used to select real fuses, conductors, motor drivers or battery limits.
- Pack/efficiency edits change the scenario. They cannot preserve a physically continuous experiment across arbitrary changes to capacity, mass or chemistry. The application resets a run when applying its physical-assumption form.

Validation command: `node --test tests/simulation-audit.test.mjs tests/ev-simulation.test.mjs tests/vehicle-displays.test.mjs` — **33 tests passed, 0 failed**. All results are software-only; no physical hardware was energized or measured in this audit.
