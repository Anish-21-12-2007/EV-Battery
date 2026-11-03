# Current Measurement

Separate Light and Motor readings require separate transducers. For each channel, place the sensor in series with the corresponding branch input conductor, after its branch fuse and before the measured equipment input. The single ACS712 in the existing handoff is upstream of a common bus; it measures aggregate switched current and cannot distinguish two branches.

For a direct ACS712 output:
V_OUT = V_ZERO + S × I
I = (V_OUT − V_ZERO) / S

For the conditional ACS712-30A example, S = 0.066 V/A typical at 25 °C and V_ZERO is nominally VCC/2. The actual zero, gain, temperature drift, supply variation, noise and module conditioning require calibration. Allegro’s specified suffix table gives 63–69 mV/A for the x30A family at 25 °C; using typical sensitivity for a worked estimate is not an accuracy guarantee.

With 27 kΩ above 20 kΩ, node ratio is k = 20/47 = 0.425532. Nominal zero node is 2.5 × k = 1.0638 V and scaled sensitivity is S_ADC = 0.066 × k = 0.028085 V/A. Invert as I = (V_ADC − V_ZERO × k)/(S × k). The nominal ±30 A output endpoints scale to 0.2213 V and 1.9064 V. A conservative 5.5 V sensor-rail bound with 1% resistor corners gives 2.3674 V at the ADC node; this bounds a rail-level output for the scaler only and does not protect against wiring faults or a powered sensor driving an unpowered ESP32.

The 100 nF capacitor with 27 kΩ || 20 kΩ has a nominal first-order pole around 138.5 Hz. It attenuates rapid variation and does not establish adequate sampling for motor PWM or capture fuse-clearing peaks. The Light sensor’s signal interface stays TBD until its exact sensor is selected.

Do not zero the sensor while electronics current flows through its primary path. Calibrate zero with genuine zero primary current and safe independent signal power, then characterize offset/gain against a suitable reference over the expected range. Do not hide electronics load with an auto-zero/deadband in coulomb integration.
