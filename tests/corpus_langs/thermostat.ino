// Greenhouse thermostat: turns a heater relay on below a set temperature.
const int SENSOR_PIN = A0;
const int RELAY_PIN = 7;
const int LED_PIN = 13;
const float TARGET = 18.0;
const float MARGIN = 0.5;

bool heating = false;
unsigned long lastRead = 0;

float readTemperature() {
  int raw = analogRead(SENSOR_PIN);
  float volts = raw * 5.0 / 1023.0;
  return (volts - 0.5) * 100.0;
}

void setHeater(bool on) {
  heating = on;
  digitalWrite(RELAY_PIN, on ? HIGH : LOW);
  digitalWrite(LED_PIN, on ? HIGH : LOW);
}

void setup() {
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
  setHeater(false);
}

void loop() {
  if (millis() - lastRead < 2000) {
    return;
  }
  lastRead = millis();
  float t = readTemperature();
  Serial.print("Temperature: ");
  Serial.println(t);
  if (!heating && t < TARGET - MARGIN) {
    setHeater(true);
  } else if (heating && t > TARGET + MARGIN) {
    setHeater(false);
  }
}
