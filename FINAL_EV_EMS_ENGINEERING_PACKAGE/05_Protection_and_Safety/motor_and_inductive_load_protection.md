# Motor and Inductive-Load Protection

The motor and its controller are not identified. Motor startup and switching can produce currents and voltage transients that affect fuses, relay contacts, switches, ADC wiring and the ESP32 supply. Omron describes motors and lamps as inrush loads; its generic 5–10× AC motor example is not a specification for this DC motor.

The current project’s C3 = 100 nF across a motor is a brush-noise proposal for a suitable brushed motor. It is not an energy clamp for switching off an inductive load.

A diode with cathode at M+ and anode at M− can be a conditional flyback path for a simple unidirectional brushed motor switched on one side. Its current, pulse energy, reverse voltage, temperature, wiring inductance and turn-off behavior must be rated. Do not install this simple polarity across a motor driven bidirectionally by an H-bridge; it may conduct during reverse drive. Use the identified controller’s approved suppression network.

If a relay or rocker switch interrupts the motor current, its DC inductive breaking rating and suppression requirements must match the actual load. Relay coil driver, coil flyback and contacts are separate circuits. The project relay is unwired and has no approved remote-shutdown function.

The filter networks shown have low-pass poles near 138.5 Hz and 182.6 Hz. They are not fast overcurrent protection and may attenuate PWM/startup information. Fuse/device coordination must be independent of software ADC sensing.
