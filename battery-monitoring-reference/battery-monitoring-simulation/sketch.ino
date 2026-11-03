#include <Wire.h>

// Logic-only Wokwi test. Sliders synthesize ADC-node values; they are NOT an
// ACS712 breakout, resistor divider, battery, relay, buck module, or motor.
constexpr int PIN_CURRENT_NODE = 34;
constexpr int PIN_BATTERY_NODE = 35;
constexpr int PIN_SDA = 21;
constexpr int PIN_SCL = 22;
constexpr uint8_t OLED_ADDRESS = 0x3C;
constexpr float ADC_REFERENCE_V = 3.3f; // approximate display-only conversion
constexpr float ADC_COUNTS = 4095.0f;
constexpr float BATTERY_DIVIDER_RATIO = 22.0f / (120.0f + 22.0f);
constexpr float ACS_ATTENUATION_RATIO = 20.0f / (15.0f + 20.0f);
constexpr float ACS_ZERO_V = 2.5f;
constexpr float ACS_SENSITIVITY_V_PER_A = 0.066f;
uint8_t frame[1024];

void command(uint8_t value) {
  Wire.beginTransmission(OLED_ADDRESS);
  Wire.write(0x00);
  Wire.write(value);
  Wire.endTransmission();
}

void initDisplay() {
  const uint8_t init[] = {0xAE,0xD5,0x80,0xA8,0x3F,0xD3,0x00,0x40,0x8D,0x14,
                          0x20,0x02,0xA1,0xC8,0xDA,0x12,0x81,0x7F,0xD9,0xF1,
                          0xDB,0x40,0xA4,0xA6,0xAF};
  for (uint8_t b : init) command(b);
}

void pixel(int x, int y, bool on=true) {
  if (x < 0 || x >= 128 || y < 0 || y >= 64) return;
  const int i = (y / 8) * 128 + x;
  const uint8_t mask = 1u << (y & 7);
  if (on) frame[i] |= mask; else frame[i] &= ~mask;
}

void letterE(int x, int y) {
  const uint8_t columns[5] = {0x7F,0x49,0x49,0x49,0x41};
  for (int c=0;c<5;c++) for (int r=0;r<7;r++) if (columns[c] & (1u<<r)) pixel(x+c,y+r);
}
void letterC(int x, int y) {
  const uint8_t columns[5] = {0x3E,0x41,0x41,0x41,0x22};
  for (int c=0;c<5;c++) for (int r=0;r<7;r++) if (columns[c] & (1u<<r)) pixel(x+c,y+r);
}
void letterS(int x, int y) {
  const uint8_t columns[5] = {0x46,0x49,0x49,0x49,0x31};
  for (int c=0;c<5;c++) for (int r=0;r<7;r++) if (columns[c] & (1u<<r)) pixel(x+c,y+r);
}

void renderBars(int currentRaw, int batteryRaw) {
  memset(frame, 0, sizeof(frame));
  // “ECS” identifies the test; bars show only that synthetic slider samples change.
  letterE(5, 4); letterC(13, 4); letterS(21, 4);
  for (int x=0;x<52;x++) { pixel(x,0); pixel(x,13); }
  for (int y=0;y<10;y++) { pixel(0,y); pixel(51,y); }
  const int vWidth = map(batteryRaw, 0, 4095, 0, 96);
  const int iWidth = map(currentRaw, 0, 4095, 0, 96);
  // Two labeled rows are intentionally represented by different vertical positions;
  // all numerical values are available in the serial output.
  for (int x=0;x<100;x++) { pixel(8+x,24); pixel(8+x,35); pixel(8+x,44); pixel(8+x,55); }
  for (int x=0;x<vWidth;x++) for (int y=26;y<34;y++) pixel(10+x,y);
  for (int x=0;x<iWidth;x++) for (int y=46;y<54;y++) pixel(10+x,y);
  for (int page=0;page<8;page++) {
    command(0xB0 + page); command(0x00); command(0x10);
    for (int start=0;start<128;start+=16) {
      Wire.beginTransmission(OLED_ADDRESS);
      Wire.write(0x40);
      for (int k=0;k<16;k++) Wire.write(frame[page*128+start+k]);
      Wire.endTransmission();
    }
  }
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  analogSetPinAttenuation(PIN_CURRENT_NODE, ADC_11db);
  analogSetPinAttenuation(PIN_BATTERY_NODE, ADC_11db);
  Wire.begin(PIN_SDA, PIN_SCL);
  initDisplay();
  Serial.println("BOOT: SSD1306 raw I2C init sent to 0x3C; synthetic ADC1 sliders active");
}

void loop() {
  const int currentRaw = analogRead(PIN_CURRENT_NODE);
  const int batteryRaw = analogRead(PIN_BATTERY_NODE);
  const float currentNodeV = currentRaw * ADC_REFERENCE_V / ADC_COUNTS;
  const float batteryNodeV = batteryRaw * ADC_REFERENCE_V / ADC_COUNTS;
  const float batteryV = batteryNodeV / BATTERY_DIVIDER_RATIO;
  const float sensorOutV = currentNodeV / ACS_ATTENUATION_RATIO;
  const float currentA = (sensorOutV - ACS_ZERO_V) / ACS_SENSITIVITY_V_PER_A;
  renderBars(currentRaw, batteryRaw);
  Serial.print("synthetic nodes: VBATnode="); Serial.print(batteryNodeV,3);
  Serial.print(" V, IOUTnode="); Serial.print(currentNodeV,3);
  Serial.print(" V; illustrative math only: battery="); Serial.print(batteryV,2);
  Serial.print(" V, current="); Serial.print(currentA,2); Serial.println(" A");
  delay(500);
}
