// A desk gadget: a knob sets a light, a button switches modes, a servo points, a screen reports.
#include <Servo.h>
#include <LiquidCrystal.h>

#define BUZZER 8
const int KNOB = A0;
const int LIGHT = 9;
const int BUTTON = 2;
const int TRIG = 6;
const int ECHO = 7;

struct Reading {
  int level;
  long distance;
};

Servo arm;
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
int mode = 0;
int buttonState;
int lastButton = HIGH;
unsigned long lastChange = 0;
unsigned long lastReport = 0;
int history[4] = {0, 0, 0, 0};
int slot = 0;
long duration;

long measureDistance() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  duration = pulseIn(ECHO, HIGH);
  return duration * 0.034 / 2;
}

void setAlarm(bool on) {
  digitalWrite(LED_BUILTIN, on ? HIGH : LOW);
}

void setup() {
  pinMode(LIGHT, OUTPUT);
  pinMode(BUTTON, INPUT_PULLUP);
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(9600);
  arm.attach(10);
  lcd.begin(16, 2);
  lcd.print("Starting");
}

void loop() {
  int reading = analogRead(KNOB);
  int level = map(reading, 0, 1023, 0, 255);
  level = constrain(level, 10, 250);
  analogWrite(LIGHT, level);
  int pressed = digitalRead(BUTTON);
  if (pressed != lastButton) {
    lastChange = millis();
  }
  if (millis() - lastChange > 50 && pressed != buttonState) {
    buttonState = pressed;
    if (buttonState == LOW) {
      mode = (mode + 1) % 3;
    }
  }
  lastButton = pressed;
  switch (mode) {
    case 0:
      arm.write(map(reading, 0, 1023, 0, 180));
      break;
    case 1:
    case 2:
      for (int angle = 0; angle <= 180; angle += 30) {
        arm.write(angle);
        delay(15);
      }
      break;
    default:
      setAlarm(true);
  }
  if (millis() - lastReport < 500) {
    return;
  }
  lastReport = millis();
  long cm = measureDistance();
  history[slot] = level;
  slot = (slot + 1) % 4;
  setAlarm(cm < 10);
  if (cm < 10) {
    tone(BUZZER, 880, 100);
  }
  Serial.print("Level: ");
  Serial.print(level);
  Serial.print(" Distance: ");
  Serial.println(cm);
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(level);
  lcd.setCursor(0, 1);
  lcd.print(cm);
  for (int i = 0; i < 4; i++) {
    Serial.print(history[i]);
    Serial.print(" ");
  }
  Serial.println();
}
