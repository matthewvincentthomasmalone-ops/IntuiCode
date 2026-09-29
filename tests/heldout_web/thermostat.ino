#include <Servo.h>
#define FAN_PIN 5

Servo vent;
const int SENSOR = A0;
float target = 21.5;
int readings[4] = {0, 0, 0, 0};
int idx = 0;
unsigned long lastCheck = 0;

float readCelsius() {
  int raw = analogRead(SENSOR);
  float volts = raw * 5.0 / 1023.0;
  return (volts - 0.5) * 100.0;
}

void setFan(bool on) {
  digitalWrite(FAN_PIN, on ? HIGH : LOW);
}

void setup() {
  Serial.begin(9600);
  pinMode(FAN_PIN, OUTPUT);
  vent.attach(9);
}

void loop() {
  if (millis() - lastCheck < 1000) return;
  lastCheck = millis();
  float t = readCelsius();
  readings[idx] = (int)t;
  idx = (idx + 1) % 4;
  if (t > target + 1) {
    setFan(true);
    vent.write(90);
  } else if (t < target - 1) {
    setFan(false);
    vent.write(0);
  }
  Serial.print("Temp: ");
  Serial.println(t);
}
