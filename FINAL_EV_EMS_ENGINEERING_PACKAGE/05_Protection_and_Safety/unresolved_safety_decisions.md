# Unresolved Safety Decisions

These gates remain open; the schematic is not a construction approval.

1. Confirm the exact battery chemistry/model, maximum voltage, charge profile and prospective short-circuit current.
2. Identify the complete Light assembly, voltage, inrush, driver and operating duty.
3. Identify the motor and controller, startup/stall current, reversing and regenerative behavior, and any integral suppression.
4. Select F1, FL, FM and F2 from load profiles, conductor protection, time-current/I²t, DC rating and fault-interrupting capacity.
5. Identify and rate every wire, fuse holder, switch, connector and enclosure for voltage, steady/peak current, temperature, strain and environment.
6. Identify both sensor ICs and breakout boards, pinout, current path, current rating, supply, output swing, filter and fault behavior.
7. Identify the buck converter board, verify input/output polarity and output setting, load/transient performance, thermal limits and whether IN−/OUT− are common.
8. Identify the ESP32 carrier board; verify GPIO header positions, ADC characteristics, supply path, USB isolation/backfeed and input protection.
9. Choose reverse-polarity, bus transient, ADC input, motor turn-off, and sensor-powered-off protection from documented voltage/current/energy limits.
10. Decide if the required quantity is branch input energy, actual load-terminal energy, or battery-terminal energy. Select voltage/current sensing boundaries accordingly.
11. Define sample rate, averaging, synchronization, filter bandwidth, signed current, calibration uncertainty and missing-sample behavior.
12. For SOC/range, obtain usable battery capacity and a defined drive/load profile plus validated Wh/km and reserve. For cost, provide tariff and grid-charge-loss basis.

No physical validation is claimed. The planned checks appear in 06_Validation/simulation_and_test_plan.md.
