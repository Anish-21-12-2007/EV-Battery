# Circuit research and validation report

**Prepared:** 2026-10-12  
**Result:** A conservative, traceable *proposed* low-voltage measurement architecture and calculation package are complete. This is **not a verified build-ready circuit**: the exact ESP32 board, sensor breakout PCB, OLED breakout, relay module, motor and wiring ratings are not physically available/identified. Do not energize the conditional rows in the connection CSV without those checks.

## Scope and observed project state

The existing project contained the website, Blender generator, test export and stylized assembly, but no wiring diagram, PCB part numbers, motor rating or physical circuit layout. The website README explicitly states the model wires are illustrative and the sensors are not connected. No website or Blender files were changed. The electrical package is new under `battery-monitoring-reference/`.

The Amptek product page lists an Amptek 12 V 7.6 Ah model and links a PDF in Google Drive, but that PDF's content was not retrievable from the public page in this session. Thus only the model name, nominal voltage and capacity are attributed to Amptek; no charge-voltage/current limit, terminal, discharge-current, or fuse rating is inferred for that specific battery. A separate Yuasa NP7-12 technical sheet reports 13.65 V float and 14.5 V cyclic charge for a *different battery*; it is used only to demonstrate why “12 V nominal” is not a valid divider maximum, not as an Amptek specification.

## Source review

- Espressif ESP32-DevKitC V4 guide: documented classic ESP32 header includes input-only GPIO34/35 as ADC1 channels; GPIO21/22 headers; and it warns the board power methods are mutually exclusive. This is a reference variant only; the friend's actual board remains unknown.
- Espressif ESP32-WROOM-32 datasheet: GPIO34/35 are input-only IO34/IO35 mapped to ADC1_CH6/CH7. The digital input-high characteristic is specified up to VDD+0.3 V (3.6 V at a 3.3 V rail); the absolute maximum supply rating is a stress limit, not a recommended analog level. Keep analog nodes below 3.3 V with margin and in the selected ADC attenuation range. ADC transfer function/calibration is chip/board dependent.
- Allegro ACS712 datasheet: 30 A variant optimized range ±30 A, typical sensitivity 66 mV/A (63–69 mV/A), 5 V supply, zero-current output approximately VCC/2. The IC data does not validate the module PCB, connector or wires.
- TI LM2596 datasheet: regulator IC family has 4.5–40 V input and up to 3 A under specified design/thermal conditions; 3 A is not a guarantee for an unidentified assembled buck module. TI recommends selecting components for voltage/current/thermal conditions. Set the actual module and meter-check before attaching electronics.
- Solomon Systech SSD1306 documentation identifies the display driver, but the common small I2C breakout's regulator, pullups, I2C address and header order are module-specific. Wokwi's documented SSD1306 model defaults to 0x3C; real address is not assumed.
- Songle SRD-05VDC-SL-C relay datasheet lists the bare relay variant and 28 VDC/10 A contact rating under its specified rating conditions. This does not establish a module's driver, input polarity, terminal mapping, or suitability for inductive motor inrush. Relay not placed in motor path.
- Wokwi official part docs: ESP32 and SSD1306 logic simulation parts exist; Wokwi warns its potentiometer/analog modeling is basic. Thus a simulator can test only software/I²C/display logic, not real ACS712 analog accuracy or motor power stage.
- Amptek India product table: model is listed as 12 V / 7.6 Ah with manufacturer-hosted PDF link, but the linked PDF was inaccessible, limiting exact-battery claims.

Source URLs:

1. [Espressif ESP32-DevKitC V4 User Guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html)
2. [Espressif ESP32-WROOM-32 Datasheet](https://documentation.espressif.com/esp32-wroom-32_datasheet_en.html)
3. [Espressif ESP32 Series Datasheet](https://documentation.espressif.com/esp32_datasheet_en.html)
4. [Allegro ACS712 Datasheet](https://www.allegromicro.com/~/media/Files/Datasheets/ACS712-Datasheet.ashx)
5. [Texas Instruments LM2596 Datasheet](https://www.ti.com/lit/ds/symlink/lm2596.pdf)
6. [Solomon Systech SSD1306 product listing](https://www.solomon-systech.com/product-search)
7. [Songle SRD-05VDC-SL-C datasheet copy](https://naylampmechatronics.com/img/cms/000263/SRD-05VDC-SL-C-Datasheet.pdf)
8. [Amptek 12 V 7.6 Ah product listing](https://amptek.aukark.co.in/electric-toy-ride-ons/)
9. [Yuasa NP7-12 technical sheet (different battery; illustrative only)](https://www.yuasa.co.uk/yuasa/datasheet/index/sku/np7-12/)
10. [Wokwi SSD1306 part reference](https://docs.wokwi.com/parts/board-ssd1306)
11. [Wokwi potentiometer limitations/reference](https://docs.wokwi.com/parts/wokwi-potentiometer)

## Proposed architecture and connection checks

Fuse close to battery positive → DC-rated rocker switch → switched positive bus. One branch goes to the motor through ACS712 primary `IP+`/`IP−` in series; motor return goes directly to the battery-negative/star return. A separate fused/switched branch feeds LM2596 `IN+`/`IN−`. Logic returns share a low-current common reference only for the assumed non-isolated system. The relay is explicitly omitted from the motor path pending exact module and motor ratings.

For classic ESP32 DevKitC-like boards, GPIO34 (ADC1_CH6) is a defensible current-signal candidate and GPIO35 (ADC1_CH7) a battery-voltage candidate; both are input-only. GPIO21/22 are the documented board headers and common I²C selection. GPIO25 is an uncommitted possible relay logic pin only; not wired.

### Calculations

**Battery measurement divider:** choose 120 kΩ top and 22 kΩ bottom, both 1%. Ratio `22/(120+22)=0.15493`. At the assumed 18.0 V measurement ceiling, nominal ADC node = `18×0.15493 = 2.789 V`. Worst ratio at 1% extremes (top 118.8 kΩ, bottom 22.22 kΩ) = 0.1578, or about 2.84 V at 18 V. At 14.5 V: nominal ≈2.25 V. 100 nF from ADC node to signal GND is optional filtering. The 18 V ceiling is an engineering design assumption, **not** a verified Amptek maximum. Recalculate if expected transient/charge voltage exceeds it. GPIO35 analog input still needs ADC attenuation calibration and practical protection review.

**ACS712 current signal scaling:** for 15 kΩ series and 20 kΩ shunt, ratio `20/(15+20)=0.57143`. Nominal 30 A module signal around 0.52–4.48 V at 5 V supply (based on 2.5 V zero plus/minus 30×0.066 V) becomes about 0.30–2.56 V at GPIO34; sensitivity at ADC node is about `66×0.571 = 37.7 mV/A`. Worst-case module supply/output and breakout must be verified; this is why an attenuation network remains in the proposal. Add 100 nF only after checking transient response and ADC sampling/calibration needs.

**Fuse/current/switch/wire:** cannot be calculated without motor nameplate current, measured startup/stall current, wire length/gauge/insulation, connectors, holder, rocker DC rating, battery short-circuit behavior and installation. Do not automatically install the listed 30 A fuse. Select to protect the weakest conductor and load within manufacturer guidance and ensure DC interrupt rating is suitable.

## Simulation and test status

Wokwi's ESP32/SSD1306 editor was used to build and run a partial logic simulation from the local `battery-monitoring-simulation/` source. An initial library-based build failed because the Adafruit header was unavailable; no library was installed. It was replaced by dependency-free raw I²C firmware and compiled successfully. With the two potentiometer controls set to 500/1023 and 700/1023, serial output showed ADC node values about 1.613 V and 2.258 V and the illustrative transfer math produced 4.88 A and 14.57 V. Changing the first slider from full scale to 500 changed its derived reading. A later firmware edit selected page addressing; that run still rendered only a short white strip on the OLED instead of the intended full bitmap/bars, so full display behavior remains unverified. Wokwi's docs state potentiometer analog behavior is basic. It does not represent the real ACS712 breakout, resistor tolerances, battery behavior, fuse/switch, buck converter, relay, motor current/inrush, thermal performance or electrical safety. These numbers are synthetic, not real readings. No physical hardware was powered or tested.

## Open issues / required physical evidence

1. ESP32 front/back photos, exact board name/revision, pin labels and its external-power/USB instructions.
2. ACS module both-side photos, chip suffix (ELC-30A), terminal labels, board trace/terminal rating and onboard output conditioning.
3. OLED both-side photos/model, supply range, I²C address and pull-up rail.
4. Relay photo showing exact module/bare part, relay can marking, terminal labels, input logic and driver/isolation diagram/datasheet.
5. Motor nameplate voltage/current and measured startup/stall current using a safe instrument/setup.
6. Amptek battery's actual label/terminal type and accessible manufacturer battery sheet/charging limits; fuse holder and rocker DC ratings; wire gauge/length/insulation.

Until those exist, leave relay wires open, do not connect the motor, do not energize a 30 A path, and do not regard this package as a safety certification. No physical hardware was powered or tested. No website integration or 3D-model regeneration was performed.

