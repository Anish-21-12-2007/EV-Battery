# Unresolved Component Identification

No photograph or readable label in the reviewed project identified the installed battery, motor, light, converter, ESP32 carrier board, sensor breakouts, switch, fuse holders, connectors or conductors. This list names the evidence needed before ratings or pin wiring can be finalized.

| Item | Identification/evidence required | Why it matters |
|---|---|---|
| Battery BAT1 | Clear label/model/revision photo; manufacturer charge/discharge sheet; terminal arrangement and charger specification | Maximum and minimum voltage, current, fault current, usable capacity and safe charge/discharge limits |
| Light L1 | Complete lamp/driver make/model, DC input voltage, steady and inrush current, polarity, duty cycle | Determines branch protection, current-sensor range, driver boundary and input-voltage range |
| Motor M1 | Make/model, brushed/brushless, voltage, rated/start/stall current, direction/reversing method and drive controller | Determines sensor placement, fuse curve, switch rating, wire size and suppression |
| Motor controller MDRV | Model/schematic, input range/current, PWM frequency, regenerative behavior and internal suppression | Determines the actual measurement boundary and transient/regen behavior |
| Sensor S_L | IC suffix/module board photos, data sheet, current range, output range, isolation and onboard conditioning | Determines whether GPIO32 interface is safe and whether light current is resolvable |
| Sensor S_M | ACS712 suffix marking and front/back board photos; schematic and terminal ratings | Confirms signal scaling, module ampacity, VCC, output resistors, VCC bypass/FILTER capacitors, creepage and connector limits |
| DC/DC module U_BUCK | Manufacturer/model, inductor/diode/capacitor markings, schematic, thermal rating and input/output limits | IC datasheet alone cannot validate a generic module |
| ESP32 board U_ESP | SoC marking and exact development-board revision; pinout and power-source schematic | Header position, ADC attenuation, input protection and USB/5V backfeed rules |
| OLED | Controller/module maker and exact board revision, connector pin order, VCC tolerance and pullup rail | Prevents 5 V pullups or wrong power/pin mapping |
| DS18B20 probe | Probe manufacturer and wiring diagram, or continuity/ROM/CRC evidence under safe powered test | Wire colors cannot establish VDD/GND/DQ |
| Fuses/holders F1/FL/FM/F2 | Exact part numbers, DC voltage and interrupting ratings, time-current curves and holder temperature rating | Coordinates protection with source fault current and conductors |
| Switch SW1 | Part number, DC break/motor rating and contact/suppression requirements | AC or resistive rating does not prove inductive DC suitability |
| Wiring/connectors | Conductor copper gauge, strand, insulation temperature/voltage, length, routing, bundle/ambient and connector part numbers | Required for voltage-drop, thermal and fault coordination |
| Protection parts | Battery maximum, motor-driver topology, measured or specified transients and protected-device limits | Required to choose reverse polarity, TVS, clamps and inductive suppression |

Do not fill these gaps with generic marketplace descriptions, wire-color conventions or a rendering’s dimensions.
