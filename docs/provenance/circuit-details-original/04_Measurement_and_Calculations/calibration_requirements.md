# Calibration Requirements

No calibration was performed for this audit. These are requirements for a future identified build, not a test record.

## Before calibration

1. Identify exact sensor suffixes, board schematics, ESP32 SoC/board revision, battery, loads, protection devices and analog module ranges.
2. Confirm the converter output polarity, setpoint and ground relationship with the ESP32 disconnected. Confirm that no USB/VIN source can backfeed the board.
3. Measure actual divider resistances and tolerances before assembly; inspect for module-level scaling or capacitors.
4. Define measurement boundaries and current sign, including whether regenerative current is possible.

## Voltage channels

Use a calibrated reference meter or source over the intended branch voltage range, including low values and near the assumed 18 V upper operating point. Record source, reference instrument, ADC raw/calibrated millivolts, calculated input voltage and residual at multiple points. Keep transients and fault tests out of the ESP32 until protection has been designed.

Account for resistor tolerance, meter uncertainty, ADC nonlinearity, ADC calibration, reference variation, sampling noise, ground drop, wire drop and temperature. One calibration point cannot identify gain and offset separately.

## Current channels

At true zero primary current, record VCC, output and ADC node after thermal stabilization. Then apply known positive and negative reference currents across the expected range without exceeding any verified device or module rating. Use a suitable calibrated current reference (rated shunt or instrument) and record temperature. Determine offset and gain per channel. For ACS712, calibrate VZERO at the actual VCC because the output is ratiometric.

Do not use motor-off as zero if controller/electronics remain powered through the sensor. Use independent low-voltage sensor/logic supply for a true zero-current check if the power topology otherwise forces electronics current through the primary.

## Dynamic and energy calibration

Select sample rate and anti-alias filtering from load dynamics and sensor bandwidth. For PWM motor controllers, define whether energy at controller input or motor terminals is required. Capture synchronized voltage/current samples and integrate calibrated P(t). Compare energy accumulation to an independent reference meter over a documented duration. Report uncertainty, dropped samples, signed regenerative energy, start/stop conditions and firmware revision.

## Battery SOC and range

Obtain manufacturer discharge/charge curves or a characterized battery-specific model, test current and temperature, aging assumptions, usable SOC window, coulomb efficiency and a known initial state. A 12 V × 7.6 Ah nominal product is not a calibrated usable-energy denominator. Do not display range until a named duty cycle, validated Wh/km, reserve and usable capacity are defined.
