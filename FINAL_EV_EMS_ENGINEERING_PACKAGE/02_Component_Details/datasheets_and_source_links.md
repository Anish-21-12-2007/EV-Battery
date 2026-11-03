# Datasheets and Source Links

The [source register](../07_References/source_register.md) records publisher, document scope, relevant sections and access date.

## Primary manufacturer sources

- Allegro MicroSystems — [ACS712 datasheet, Rev. 22](https://www.allegromicro.com/-/media/files/datasheets/acs712-datasheet.pdf). Use the suffix-specific tables and typical application; do not apply IC claims automatically to a breakout.
- Espressif — [classic ESP32 ADC guide, ESP-IDF v4.2](https://docs.espressif.com/projects/esp-idf/en/v4.2/esp32/api-reference/peripherals/adc.html), [GPIO/ADC1 channel mapping](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/peripherals/gpio.html), [ESP32-WROOM-32 datasheet](https://documentation.espressif.com/esp32-wroom-32_datasheet_en.html), and [ESP32-DevKitC V4 guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html). The latter board guide is only a reference design; it does not identify the project’s board.
- Texas Instruments — [LM2596 datasheet, Rev. G](https://www.ti.com/lit/ds/symlink/lm2596.pdf).
- Amptek India — [Electric Toy Ride-On battery listing](https://amptek.aukark.co.in/electric-toy-ride-ons/). The page lists the 12 V / 7.6 Ah / 2050 g model. Its linked PDF was not retrievable in this review.
- Analog Devices / Maxim — [DS18B20 datasheet](https://www.analog.com/media/en/technical-documentation/data-sheets/ds18b20.pdf). Relevant only if the proposed probe is actually installed.
- Solomon Systech — [SSD1306 product page](https://www.solomon-systech.com/product/ssd1306). Driver IC only; no OLED breakout pinout is implied.

## Independent engineering and agency references

- Littelfuse — [Fuse Fundamentals](https://www.littelfuse.com/assetdocs/fuse-fundamentals-technical-paper?assetguid=82021200-8d3c-4449-843b-4959181a04af).
- Omron Industrial Automation — [general-purpose relay load and inrush FAQ](https://www.ia.omron.com/support/faq/answer/36/faq02165/). Its generic AC examples do not rate this DC motor or switch.
- U.S. EPA — [gasoline CO₂ calculation factor](https://www.epa.gov/energy/greenhouse-gas-equivalencies-calculator-calculations-and-references).
- U.S. DOE AFDC — [gasoline/E10 heating value methodology](https://afdc.energy.gov/fuels/equivalency-methodology), [all-electric vehicle range factors](https://afdc.energy.gov/vehicles/electric-basics-ev).
- Wokwi — [potentiometer simulation limits](https://docs.wokwi.com/parts/wokwi-potentiometer). This describes its simulator component, not a physical potentiometer.

No distributor listing was treated as an authoritative electrical rating. No third-party clone breakout was assumed.
