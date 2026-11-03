# Reference Material and Evidence Notes

## Manufacturer facts used

The ACS712 datasheet specifies an IC family with suffix-specific operating range/sensitivity, a 5 V supply, analog output proportional to sensed current and polarity from IP+ to IP−. For the x30A version the nominal 66 mV/A slope used in arithmetic is typical, not a module accuracy guarantee. Allegro explicitly excludes automotive applications. A breakout may change the signal through resistors, capacitors, supply wiring and PCB layout; identify that board before using the 27 kΩ / 20 kΩ scaler.

Espressif’s classic ESP32 ADC reference is chip/software specific. The 11 dB suggested range of 150–2450 mV describes a region for accurate readings and must not be misread as an input absolute-maximum value. ADC calibration and exact chip/board identification remain necessary. GPIO34/35 are input-only channels; logical pin names do not confirm header locations.

TI’s 4.5–40 V and 3 A values belong to the LM2596 regulator IC under specified electrical, layout and thermal conditions. A generic adjustable module can have different input/output, heat, ripple, component and terminal limits.

## Independent protection and load guidance

Littelfuse explains why fuse selection needs a time-current characteristic, interrupting capacity, voltage rating and knowledge of fault energy/current; a nominal branch current is not enough. Omron’s relay FAQ describes motor and lamp inrush, but its generic examples do not rate this unknown DC motor, switch or relay.

## Battery and EV caveats

Amptek’s manufacturer table supports the listed 12 V / 7.6 Ah / 2050 g model row. A matching physical battery is not confirmed, and the detail PDF did not expose a readable charge/discharge curve or cutoffs during review. Thus 91.2 Wh is the product of nominal label values, not a verified usable-energy quantity.

DOE AFDC describes range variation with driving conditions. The project’s EV data are illustrative code inputs rather than measured vehicle or pack values. The 96 V / 150 Ah product is nominal arithmetic only; a battery curve, cell count, BMS limits and validated duty cycle are missing.

## Fuel comparison caveats

EPA’s 8.887 kg CO₂/US gallon is a gasoline consumption factor used in a US federal methodology. Converting it to 2.3477 kg/L is straightforward, but the value does not describe all blends or lifecycle emissions. DOE AFDC’s E10 lower-heating-value range converts to about 8.680–8.988 kWh/L; do not compare chemical fuel energy directly to battery energy without stating conversion efficiencies and a fuel-energy basis.

## Simulation caveats

Wokwi’s documented potentiometer behavior is not a real divider transfer or component tolerance model. Existing project sliders synthesize ADC-node readings; they do not validate the battery, fuse, motor, sensor, converter or wiring. This audit did not run the Wokwi project or physically test the package.
