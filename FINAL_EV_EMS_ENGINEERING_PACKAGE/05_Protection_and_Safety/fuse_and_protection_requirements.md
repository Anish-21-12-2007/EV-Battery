# Fuse and Protection Requirements

**Status:** requirements audit, not selected ratings. No fuse is approved in this package.

## Required fuse locations

| Device | Intended location | Rating status |
|---|---|---|
| F1 main | Battery positive, close to BAT+ | TBD |
| FL Light | Positive bus branch takeoff, before Light wiring/sensor | TBD |
| FM Motor | Positive bus branch takeoff, before motor branch wiring/sensor/driver | TBD |
| F2 electronics | Positive bus branch takeoff, before thin sense and converter wiring | TBD |

Fuse placement protects only the conductors and components downstream when the correct fuse and holder are selected. A fuse does not regulate voltage, suppress motor transients or protect a GPIO from a sensor output fault.

## Required selection data

Do not select from nominal load current alone. Obtain:
- Battery maximum voltage and prospective short-circuit current at each branch.
- Load steady, startup/inrush, stall/locked-rotor and fault current versus time.
- Wire copper area/gauge, strand, insulation, length, routing/bundling, ambient temperature and terminal rating.
- Fuse time-current curve, I²t, DC voltage rating and interrupting/breaking capacity.
- Fuse-holder contact resistance, temperature, enclosure and mounting data.
- Switch and sensor/module series-current limits, if any.
- Coordination with driver protection and charger/regen direction.

Select each fuse to protect the weakest conductor/component while tolerating legitimate operating transients. Confirm interrupting rating exceeds prospective fault current at the actual DC voltage. A generic fuse amperage or an AC rating is not enough. Littelfuse’s fuse guidance explains current rating, time-current behavior, voltage rating, interrupting rating and I²t considerations.

## Project-specific correction

The older project states a 30 A main fuse in one artifact and 1–2 A F2 in another, without source fault current, load profile or conductor coordination. Neither is approved. The latest handoff correctly leaves F1/F2 values TBD. The buck example input of about 0.391 A is not a fuse recommendation.

## Other protection layers

Reverse-polarity protection, overvoltage/transient clamping, sensor powered-off isolation, branch overcurrent coordination, enclosure, strain relief and battery-terminal protection remain open. They must be selected from actual source/load limits; the current schematic intentionally shows no unselected protection part as installed.


---

## Upgraded Engineering Selection Methodology for Fuses (`F1`, `FL`, `FM`, `F2`) & Conductors (`WIRE`)

While `F1`, `FL`, `FM`, `F2`, and `WIRE` remain flagged **`TBD`** until the physical battery (`BAT1`), lamp (`L1`), and motor (`M1` / `MDRV`) are identified, students must follow the four-step engineering procedure below once nameplate data are obtained:

### Step 1 — Determine Continuous & Inrush Branch Currents
- **Steady Continuous Current ($I_{	ext{cont}}$):** Maximum continuous DC current drawn by the branch at minimum operating voltage.
- **Startup / Inrush Pulse ($I_{	ext{inrush}}(t)$ and $I^2t_{	ext{pulse}}$):**
  - Incandescent/halogen lamps (`L1`) draw `8–12×` steady current for `~5–20 ms` (cold tungsten filament).
  - DC motors (`M1`) draw locked-rotor / startup current $I_{	ext{stall}} = V_{	ext{bus}} / R_{	ext{armature}}$ (often `5–10×` rated current for `50–500 ms` unless soft-started by `MDRV`).

### Step 2 — Size Copper Conductors (`WIRE`) for Ampacity & Voltage Drop
1. **Thermal Ampacity Rule:** Select copper wire gauge so its derated continuous ampacity ($I_{	ext{wire,max}}$) exceeds $1.25 	imes I_{	ext{cont}}$ and exceeds the branch fuse rating ($I_{	ext{fuse}} \le I_{	ext{wire,max}}$).
2. **Round-Trip Voltage Drop Rule ($\le 2	ext{–}3\%$ of $12.0	ext{ V} = 0.24	ext{–}0.36	ext{ V}$):**
   $$A_{	ext{mm}^2,\min} = rac{2 	imes ho_{	ext{Cu}} 	imes L_{	ext{one-way}} 	imes I_{	ext{cont}}}{\Delta V_{\max}} \quad (ho_{	ext{Cu}} pprox 0.01724	ext{ }\Omega\cdot	ext{mm}^2/	ext{m at } 20^\circ	ext{C})$$

| Copper Gauge (`AWG`) | Cross-Section ($	ext{mm}^2$) | Resistance at $20^\circ	ext{C}$ ($	ext{m}\Omega/	ext{m}$) | Conservative Bundled Chassis Ampacity ($I_{	ext{wire,max}}$) | Max Suggested Fuse Rating ($I_{	ext{fuse}} \le I_{	ext{wire,max}}$) |
| :--- | ---: | ---: | ---: | ---: |
| `22 AWG` (Signal/Sense only) | `0.326 mm²` | `52.96 mΩ/m` | `3.0 A` | `1 A – 2 A` (Sense/Electronics only) |
| `18 AWG` | `0.823 mm²` | `20.95 mΩ/m` | `7.0 A` | `5 A` |
| `16 AWG` | `1.310 mm²` | `13.17 mΩ/m` | `10.0 A` | `7.5 A – 10 A` |
| `14 AWG` | `2.080 mm²` | `8.286 mΩ/m` | `15.0 A` | `15 A` |
| `12 AWG` | `3.310 mm²` | `5.211 mΩ/m` | `20.0 A` | `20 A` |
| `10 AWG` | `5.260 mm²` | `3.277 mΩ/m` | `30.0 A` | `30 A` |

### Step 3 — Select Fuse Rating, Time-Current Characteristic & Breaking Capacity ([Littelfuse `S6`](https://www.littelfuse.com/assetdocs/fuse-fundamentals-technical-paper?assetguid=82021200-8d3c-4449-843b-4959181a04af))
1. **Current Coordination Inequality:**
   $$rac{I_{	ext{cont}}}{0.75 	imes K_{	ext{temp}}} \le I_{	ext{fuse,rated}} \le I_{	ext{wire,max}}$$
   *(Standard `25%` derating ensures the fuse operates at $\le 75\%$ of its nominal rating to prevent nuisance thermal fatigue).*
2. **Inrush Melting Integral ($I^2t$) Check:**
   - For Motor (`FM`) and Lamp (`FL`) branches, select a **time-delay (slow-blow)** fuse whose pre-arcing $I^2t_{	ext{melt}}$ exceeds the startup pulse energy:
     $$I^2t_{	ext{pulse}} = \int_{0}^{t_{	ext{start}}} i_{	ext{inrush}}^2(t)\,dt \le 0.25 	imes I^2t_{	ext{fuse,melt}}$$
3. **DC Voltage & Interrupting Rating Check:**
   - Never use an AC-only fuse rating on a DC battery circuit. Confirm $V_{	ext{fuse,DC}} \ge 32	ext{ V DC}$ and $I_{	ext{breaking,DC}} > I_{	ext{sc,battery}}$.
