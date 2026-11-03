# Complete Circuit Explanation — Conditional Two-Load Proposal

**Scope:** low-voltage educational proposal for a complete DC Light input and Motor-controller input. It is not a final construction drawing or an as-built circuit.

## Positive power path

Battery positive passes through F1 and SW1 to the positive distribution bus. F1 belongs close to the source terminal so an unfused battery lead is minimized. The bus splits into:
- Light: FL → S_L primary path IP+ to IP− → L1 complete 12 V DC input.
- Motor: FM → S_M primary path IP+ to IP− → MDRV DC input. The motor itself is downstream of its controller.
- Electronics: F2 → unidentified DC/DC converter input → ESP32 and sensor interfaces.

FL/FM/F2 values are TBD. Place branch protection at the bus takeoff and coordinate it with the source, branch conductor, sensor/module, switch/driver, connector and fault current. The diagram does not select any current rating.

The proposed ACS712-30A candidate is in the motor branch only. It is not the existing project's upstream total-current sensor. It may be unsuitable if motor continuous/start current exceeds its usable limits, the module is unrated, or if regenerative/bidirectional current needs a different interface. The Light sensor and its interface are not selected.

## Return and reference

Each load/controller return goes by its own conductor to the battery-negative star. The converter input negative returns to the battery. Logic ground is a named measurement reference. Join converter output negative, ESP32 ground and sensor signal grounds only after confirming the converter is non-isolated/common-ground and the exact boards support this topology. Route high-current motor return separately so its voltage drop does not become an ADC ground error.

The one-ended 68 kΩ / 10 kΩ dividers reference logic ground. If load return drop is significant, those dividers read load positive relative to BAT−/logic reference, not differential voltage across the load terminals. Use a qualified differential front end or include the reference/drop error in calibration.

## Analog front end

Each voltage divider is 68 kΩ 1% from the branch input-positive tap to the ADC node, with 10 kΩ 1% and 100 nF from the node to logic ground. The same pair is shown once per load. Its assumed DC ceiling is 18 V. The calculation does not cover transients or a resistor fault.

The motor-current scaling example is 27 kΩ 1% from direct ACS712 OUT to GPIO34 node, and 20 kΩ 1% plus 100 nF from that node to logic ground. It is only valid if the identified sensor produces a direct 0–5.5 V output and has no onboard scaling. The Light current path uses an explicitly unknown conditioner until S_L is identified; no arbitrary resistor values are assigned.

GPIO32/33/34/35 are classic ESP32 ADC1 candidates. They are input-only ADC pins. The actual dev-board header labels, ADC attenuation, ESP32 variant and calibrated millivolt conversion remain to be checked.

## Connections intentionally absent

No TVS, reverse-polarity device, motor clamp diode, relay contacts, charger, battery-management system, USB cable, or specific lamp/motor driver is drawn as installed. Their topology and ratings cannot be selected from the available project files. A diode across a simple unidirectional brushed motor may be appropriate only after motor/driver topology is known; it can conflict with a reversing H-bridge. The existing relay is unwired.
