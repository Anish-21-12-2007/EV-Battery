# Pin Mapping

This is a logical candidate map for the classic ESP32. It does not establish header positions on the unidentified development board.

| Signal | Candidate pin | Classic ESP32 function | Status / condition |
|---|---:|---|---|
| Light current interface output | GPIO32 | ADC1_CH4 | Sensor and interface unidentified; verify board exposes pin |
| Light branch input voltage | GPIO33 | ADC1_CH5 | ADC1 candidate; 68 kΩ / 10 kΩ proposed divider |
| Motor current scaler output | GPIO34 | ADC1_CH6, input-only | Existing handoff uses GPIO34; direct ACS712 scaling is conditional |
| Motor-controller input voltage | GPIO35 | ADC1_CH7, input-only | Existing handoff uses GPIO35; board header not identified |
| OLED SDA, optional | GPIO21 | Digital GPIO/I²C by firmware configuration | Optional; module and pullups must be 3.3 V compatible |
| OLED SCL, optional | GPIO22 | Digital GPIO/I²C by firmware configuration | Optional; module and pullups must be 3.3 V compatible |
| DS18B20 DQ, optional | GPIO4 | Digital GPIO; also ADC2_CH0 | Proposed only. ADC2 function is not used; Wi-Fi can conflict with ADC2 if repurposed |
| OLED and DS18B20 supply | 3V3 candidate | Board 3.3 V output | Current capability and module compatibility need board/module data |

Espressif documents ADC1 channels on GPIO32–GPIO39 for the classic ESP32. GPIO34–GPIO39 are input-only. The physical development board may omit, rename or share pins and may have board-level circuitry. Check the exact board schematic before wiring.

At classic ESP32 11 dB attenuation the suggested measurement range is approximately 150–2450 mV, not an absolute-maximum rating. Configure the actual firmware’s attenuation and calibration API. Do not treat a nominal 3.3 V ADC scale as precise. The voltage channel approaches 0 V below Espressif’s suggested low end; accuracy at very low bus voltage needs separate assessment.
