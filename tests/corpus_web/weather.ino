// A weather station: a temperature sensor, a light sensor, a fan, a screen and the serial monitor.
#include <LiquidCrystal.h>

const int TEMP_PIN = A0;
const int LIGHT_PIN = A1;
const int FAN = 6;
const int SAMPLES = 5;

LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
float readings[SAMPLES];
int slot = 0;
unsigned long lastReport = 0;
String status = "ok";

// The sensor gives 10 mV per degree, with 0.5 V at 0 degrees.
float readTemperature() {
  int raw = analogRead(TEMP_PIN);
  float volts = raw * 5.0 / 1023;
  return (volts - 0.5) * 100;
}

float average() {
  float total = 0;
  for (int i = 0; i < SAMPLES; i++) {
    total += readings[i];
  }
  return total / SAMPLES;
}

void setup() {
  Serial.begin(9600);
  pinMode(FAN, OUTPUT);
  lcd.begin(16, 2);
  lcd.print(F("Weather"));
  Serial.println(F("Weather station ready"));
}

void loop() {
  float t = readTemperature();
  readings[slot] = t;
  slot = (slot + 1) % SAMPLES;
  int light = analogRead(LIGHT_PIN);
  int percent = map(light, 0, 1023, 0, 100);
  float avg = average();

  if (avg > 28) {
    digitalWrite(FAN, HIGH);
    status = "hot";
  } else {
    digitalWrite(FAN, LOW);
    status = "ok";
  }

  if (millis() - lastReport >= 2000) {
    lastReport = millis();
    Serial.println("Temp: " + String(t));
    Serial.println(String("Average: ") + avg + " C");
    Serial.println(String(percent) + "% light");
    Serial.println("Status: " + status);
    Serial.print("Exact: ");
    Serial.println(t, 2);
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("T: " + String(t));
    lcd.setCursor(0, 1);
    lcd.print(String(percent) + "% " + status);
  }

  if (Serial.available() > 0) {
    char c = Serial.read();
    if (c == 'r') {
      slot = 0;
      Serial.println(F("Cleared"));
    }
  }
  delay(100);
}
