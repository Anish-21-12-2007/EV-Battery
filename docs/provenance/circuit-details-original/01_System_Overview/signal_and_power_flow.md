# Power and Signal Flow

## Power paths

- F1 is proposed in the positive lead as close as practical to BAT+; its rating remains TBD.
- SW1 is a proposed master switch after F1; its DC and motor-load interruption rating remains TBD.
- The positive bus branches through FL to the Light sensor/load, FM to the Motor sensor/controller input, and F2 to the electronics converter. Each branch fuse protects its downstream conductors only when correctly selected and located at the branch source.
- Light and motor returns run separately to the battery-negative star. The converter input return runs to the battery-negative point. Logic ground and sensor references share a defined quiet junction only if the exact converter is non-isolated/common-ground and the board interface permits this.
- The converter output is not pre-approved as 5 V. Adjust and meter the actual board under its specified input and load. Board power-source rules (including USB/VIN interaction) must be checked from its identity.

## Analog channels

- S_L current output → a not-yet-selected signal interface → classic ESP32 ADC1 candidate GPIO32.
- Light input positive → R_LH 68 kΩ → V_L node → GPIO33. R_LL 10 kΩ and C_L 100 nF return from V_L to logic ground.
- Candidate S_M ACS712 direct OUT → R_MH 27 kΩ → I_M node → GPIO34. R_ML 20 kΩ and C_M 100 nF return from I_M to logic ground. This scaling is conditional on a verified 5 V ACS712 IC output and no hidden module conditioning.
- Motor controller input positive → R_VH 68 kΩ → V_M node → GPIO35. R_VL 10 kΩ and C_V 100 nF return from V_M to logic ground.
- The classic ESP32 GPIO32–GPIO35 mappings are ADC1 channels, but the physical development-board headers are unknown. The actual board pinout must be checked.

The 68 kΩ / 10 kΩ voltage network is proposed per branch for an assumed maximum 18 V DC sense voltage. It is not a battery charge specification or transient limit. The 27 kΩ / 20 kΩ network is only a scaling example for the ACS712 candidate. The 100 nF capacitors are measurement filters, not overcurrent protection.
