// Blink an LED and report the light level.
const int LED_PIN = 13;
const int SENSOR_PIN = A0;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int light = analogRead(SENSOR_PIN);
  Serial.println(light);
  if (light < 300) {
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, LOW);
  }
  delay(5000);
}
