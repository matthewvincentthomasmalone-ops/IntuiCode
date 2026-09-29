// Press the button to toggle the LED; hold it to fade.
const int BUTTON = 2;
const int LED = 9;

int brightness = 0;
bool on = false;

void setup() {
  pinMode(BUTTON, INPUT_PULLUP);
  pinMode(LED, OUTPUT);
  Serial.begin(115200);
  Serial.println("Ready");
}

void loop() {
  if (digitalRead(BUTTON) == LOW) {
    on = !on;
    if (on) {
      brightness = 255;
    } else {
      brightness = 0;
    }
    analogWrite(LED, brightness);
    Serial.print("LED is now ");
    Serial.println(on);
    delay(250);
  }
  if (millis() > 60000) {
    tone(8, 440, 100);
  }
}
