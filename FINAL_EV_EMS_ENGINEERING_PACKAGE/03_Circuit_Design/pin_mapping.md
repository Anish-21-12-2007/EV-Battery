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


## Upgraded Electrical & Absolute Maximum Pin Ratings ([ESP32-WROOM-32 Datasheet, `S15`](https://documentation.espressif.com/esp32-wroom-32_datasheet_en.html))

| Parameter | Symbol | Min | Typical | Max | Engineering Consequence |
| :--- | :--- | ---: | ---: | ---: | :--- |
| Logic Supply Voltage | $V_{	ext{DD3P3}}$ | `3.0 V` | `3.3 V` | `3.6 V` | Must never receive unverified `5 V` directly on `3V3` pin or $	ext{I}^2	ext{C}$ pullups |
| Powered GPIO Input Voltage | $V_{	ext{IN (powered)}}$ | `−0.3 V` | — | $V_{	ext{DD}} + 0.3	ext{ V}$ (`3.6 V`) | `18 V` voltage divider hits `3.6 V` at `27.60 V` (worst 1% corner) |
| **Unpowered GPIO Input Voltage ($V_{	ext{DD}} = 0	ext{ V}$)** | $V_{	ext{IN (unpowered)}}$ | `−0.3 V` | — | **`0.3 V`** | **Critical Sequencing Rule:** Do not energize battery dividers (`1.54–2.31 V`) or `5 V` `ACS712` (`1.064 V` at `0 A`) while `ESP32` `3.3 V` rail is off |
| `ADC1` 11 dB Accurate Window | $V_{	ext{ADC1 (11dB)}}$ | `0.150 V` | — | `2.450 V` | Calibrate using Espressif eFuse two-point / curve-fitting API; residual error `~±60 mV` (`S17`) |
