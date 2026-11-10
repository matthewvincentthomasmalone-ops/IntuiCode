// Three lights, a fading one, a button on an interrupt, and commands typed in the serial monitor.
const byte LEDS[] = {2, 3, 4};
volatile bool pressed = false;
int brightness = 0;
int fadeAmount = 5;

void onPress() {
  pressed = true;
}

void setup() {
  Serial.begin(9600);
  while (!Serial) {
  }
  for (int i = 0; i < 3; i++) {
    pinMode(LEDS[i], OUTPUT);
  }
  attachInterrupt(digitalPinToInterrupt(2), onPress, FALLING);
}

void loop() {
  analogWrite(9, brightness);
  brightness = brightness + fadeAmount;
  if (brightness <= 0 || brightness >= 255) {
    fadeAmount = -fadeAmount;
  }
  if (Serial.available()) {
    String input = Serial.readStringUntil('\n');
    input.trim();
    if (input == "on") {
      digitalWrite(LEDS[0], HIGH);
    }
    Serial.println(input.length());
  }
  if (pressed) {
    pressed = false;
    Serial.println(F("Pressed"));
  }
  delay(30);
}
