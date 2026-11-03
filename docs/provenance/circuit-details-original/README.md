# Circuit_Details — Independent Engineering Audit Package

**Prepared:** 2026-11-02  
**Scope:** source-backed audit of the existing ECS battery-monitoring material and a conditional two-load Light+Motor measurement proposal.  
**Disposition:** documentary engineering review only. No physical hardware was energized or measured, no physical proof is claimed, and no existing project files or website code were modified.

## Read this first

The existing project contains a conditional **single upstream ACS712, motor and electronics 12 V reference**. It has one current channel and does not contain a separate light branch. The proposed Light+Motor drawing in this folder is an independent concept for measuring two branches. It adds one current sensor per branch and one voltage channel per branch. It is not an approved revision to the existing handoff and cannot be built from the available information.

The 12 V component list and the illustrative 96 V EV simulator are separate systems. Do not connect the 12 V monitor, ESP32, ACS712 or LM2596 proposal to the simulator’s 96 V pack. The LM2596 regulator IC is specified up to 40 V input, and the proposed dividers and sensors are low-voltage only.

## Classification labels

- **Confirmed correct** means a stated equation, arithmetic result, or source fact is supported within the stated limits.
- **Incorrect** identifies a contradiction or technical error and gives its correction.
- **Requires additional information** identifies a decision that needs missing component or scenario data.
- **Unverified** means available evidence does not establish the claim; it must not be assumed.
- **Design assumption** is a deliberately chosen illustrative input, not a sourced fact.
- **Verified by manufacturer source**, **confirmed by independent source**, **calculated and cross-checked**, and **found in existing project file** identify the evidence type. None means physically tested.

## Package map

- [Independent audit report](INDEPENDENT_AUDIT_REPORT.md): findings, evidence, corrected calculations, and exact existing sections that need revision.
- [System overview](01_System_Overview/system_architecture.md) and [power/signal flow](01_System_Overview/signal_and_power_flow.md).
- [Component list](02_Component_Details/component_list.csv), specifications, source links, and unresolved identifications.
- [Conditional two-load schematic](03_Circuit_Design/2D_circuit_schematic.svg) with rendered [PNG](03_Circuit_Design/2D_circuit_schematic.png), [wiring schedule](03_Circuit_Design/wiring_connections.csv), and pin/polarity notes.
- Measurement equations, examples, calibration requirements and limitations.
- Protection requirements and open decisions.
- Calculation script and its captured output in 06_Validation. They are documentary calculations, not a simulation or test report.
- Source register and reference notes in 07_References.

## Highest-priority audit conclusions

1. The current 68 kΩ / 10 kΩ voltage-divider and 27 kΩ / 20 kΩ current-scaler arithmetic is correct for the stated 18 V DC design assumption, exact resistor values/tolerances, classic ESP32 ADC characterization range and direct ACS712 output assumption. It does not provide surge, fault, reverse-polarity or unpowered-MCU protection.
2. The older 120 kΩ / 22 kΩ voltage divider reaches 2.789 V nominal at 18 V, above the cited classic ESP32 11 dB suggested accuracy range of 2.45 V. The older 15 kΩ / 20 kΩ current scaler reaches 2.560 V at nominal +30 A.
3. A single upstream current sensor measures an aggregate path, not separate Light and Motor currents. Individual branch power requires a current channel per branch plus a voltage measurement at the same branch input boundary.
4. Fuse, switch, wire, connector, battery, motor, lamp, driver, breakout boards, transient protection and physical ESP32 pin mapping remain unresolved.
5. The repository has one illustrative EV, one aggregate auxiliary-load slider and a fixed 180 W auxiliary load. It does not contain a five-device simulation, a range estimator, an electricity tariff or an EV fuel-cost calculation.
6. The 96 V simulation’s full-throttle draw at its speed cap does not balance modeled road load; its outputs are illustrative and cannot support a range claim.

## Evidence and limits

Manufacturer datasheets establish only the named IC/module facts they actually specify. A datasheet for an IC does not identify a generic breakout board. A product listing does not establish that a matching battery is installed. Equations and code inspection do not prove physical connections or calibration. The planned validation steps are not reported as performed.

See [audit report](INDEPENDENT_AUDIT_REPORT.md) and [source register](07_References/source_register.md) before using any circuit value.
