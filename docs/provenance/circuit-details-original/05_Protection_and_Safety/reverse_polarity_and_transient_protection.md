# Reverse-Polarity and Transient Protection

No reverse-polarity device or rated transient suppressor is selected or present in the reviewed schematic.

The assumed 18 V DC divider ceiling is only a calculation input. It is not the battery’s maximum charge voltage, source transient, clamp level or GPIO absolute-maximum rating. A divider alone can still expose an ADC to a fault through a shorted resistor, wrong connection or powered sensor while the MCU is off.

Before a build is released, identify the battery and charger, characterize the DC bus and motor/controller switching environment, and obtain the input limits of every protected component. Then choose a reverse-polarity strategy, fuse coordination, transient suppressor/clamp and analog input protection with adequate voltage, energy, pulse, thermal and failure ratings. Verify that the clamp cannot force excess current through a GPIO or sensor rail.

Power sequencing matters: do not let an energized analog sensor drive an unpowered ESP32. Use a defined power-up/down sequence or a qualified interface that prevents injection current; do not rely on firmware to protect an unpowered pin.

No tested transient waveform, source impedance or clamp result exists. Do not infer protection from a 100 nF filter capacitor, the ACS712 IC isolation rating, or an LM2596 module listing.
