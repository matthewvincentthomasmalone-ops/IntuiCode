/* IntuCode Library — hardware parts: boards, pins and sensors. */
(window.IntuiLibraryPacks = window.IntuiLibraryPacks || []).push(

`part: button-debounce
title: Reading a button without bounce
group: hardware
types: arduino-gadget, raspberry-pi, smart-home
about: Count one press as one press, even though the metal contacts bounce for a few milliseconds.
summary: A button's contacts bounce when pressed, so the pin flickers between on and off for a few milliseconds and one press can look like ten. Debouncing accepts a new state only once the reading has stayed the same for a while (30 ms here). The pull-up input reads HIGH until the button connects the pin to ground, so pressed is LOW. On a Raspberry Pi, gpiozero's Button does this with bounce_time.
learn: Pull-up resistors; millis(); the difference between "is pressed" and "has been pressed since the last look".
source: Arduino Debounce example | https://docs.arduino.cc/built-in-examples/digital/Debounce/ | waiting for the reading to settle before accepting it
== arduino debounce.ino
constant BUTTON is 2
constant LED is 13
constant whole number SETTLE_MS is 30
set unsigned long changed_at to 0
set last_reading to HIGH
set stable to HIGH
set light_on to false

when the board starts
    make pin BUTTON an input with pull-up
    make pin LED an output

over and over
    read pin BUTTON and store in reading
    if reading is not last_reading
        set changed_at to millis()
    if millis() - changed_at is more than SETTLE_MS and reading is not stable
        set stable to reading
        if stable is LOW
            set light_on to not light_on
            if light_on
                turn pin LED on
            otherwise
                turn pin LED off
    set last_reading to reading
== python button.py
import gpiozero
import signal

make a new gpiozero.Button with 2, bounce_time=0.03 and store in button
make a new gpiozero.LED with 17 and store in light

define pressed
    run light.toggle

set button.when_pressed to pressed
note: Wait here for presses until the program is stopped.
run signal.pause`,

`part: without-delay
title: Doing several things at once on a board
group: hardware
types: arduino-gadget, robotics, smart-home
about: Blink two lights at different speeds and still read a button, by checking the time instead of waiting.
summary: delay() stops the whole sketch, so nothing else can happen while it waits. Instead, each job remembers when it last ran and runs again once enough time has passed since then (millis() minus the last time). The loop goes round thousands of times a second and every job gets its turn. Subtracting times like this keeps working when millis() wraps round after about 49 days.
learn: millis(); unsigned numbers and why subtraction survives the wrap.
source: Arduino BlinkWithoutDelay example | https://docs.arduino.cc/built-in-examples/digital/BlinkWithoutDelay/ | timing with millis() instead of delay()
== arduino two_blinks.ino
constant RED is 12
constant GREEN is 13
set unsigned long red_at to 0
set unsigned long green_at to 0
set red_on to false
set green_on to false

when the board starts
    make pin RED an output
    make pin GREEN an output

over and over
    set unsigned long now to millis()
    if now - red_at is at least 250
        set red_at to now
        set red_on to not red_on
        if red_on
            turn pin RED on
        otherwise
            turn pin RED off
    if now - green_at is at least 1000
        set green_at to now
        set green_on to not green_on
        if green_on
            turn pin GREEN on
        otherwise
            turn pin GREEN off`,

`part: pwm-fade
title: Fading an LED (PWM)
group: hardware
types: arduino-gadget, raspberry-pi
about: Smoothly brighten and dim an LED, with a curve so the fade looks even to the eye.
summary: A board can't output half a volt on a digital pin, but PWM switches it on and off very fast and the share of time it is on (0 to 255 here) sets the brightness. The eye sees brightness roughly logarithmically, so a straight fade looks like it jumps at the bottom and stalls at the top; squaring the level first (a gamma curve) makes it look even.
learn: PWM and the pins marked ~; why perceived brightness isn't linear.
== arduino fade.ino
constant LED is 9

when the board starts
    make pin LED an output

over and over
    note: step / 255.0 * step squares the level as a decimal: step * step would overflow a whole number on an Uno, where they stop at 32767.
    count step from 0 to 255
        set the brightness of pin LED to step / 255.0 * step
        wait 4 milliseconds
    count step from 255 to 0
        set the brightness of pin LED to step / 255.0 * step
        wait 4 milliseconds
== python fade.py
import gpiozero
import signal

make a new gpiozero.PWMLED with 18 and store in led
note: pulse() fades in and out in the background, forever.
run led.pulse with fade_in_time=1, fade_out_time=1
run signal.pause`,

`part: servo
title: Moving a servo
group: hardware
types: arduino-gadget, raspberry-pi, robotics
about: Turn a hobby servo to an angle from a knob, a sensor or code.
summary: A hobby servo turns to an angle set by the length of a pulse sent 50 times a second, about 1 ms for one end and 2 ms for the other; the Servo library does the timing. Power servos from their own supply rather than the board's 5 V pin, which can't give the current a moving servo draws, and join the grounds.
learn: The Clamp, lerp and map part (map a knob onto an angle); power supplies and ground.
source: Arduino Servo library | https://docs.arduino.cc/libraries/servo/ | attach and write
== arduino servo.ino
include Servo.h
constant KNOB is A0
constant SERVO_PIN is 9
c++: Servo arm;

when the board starts
    run arm.attach with SERVO_PIN

over and over
    read analog pin KNOB and store in reading
    run arm.write with map(reading, 0, 1023, 0, 180)
    wait 15 milliseconds
== python servo.py
import gpiozero

make a new gpiozero.AngularServo with 17, min_angle=-90, max_angle=90 and store in arm
for each angle in [-90, 0, 90, 0]
    set arm.angle to angle
    wait 1 second`,

`part: distance-sensor
title: Distance sensor (ultrasonic)
group: hardware
types: arduino-gadget, raspberry-pi, robotics
about: Measure the distance to something with an HC-SR04 ultrasonic sensor.
summary: The sensor sends a burst of ultrasound when its trigger pin gets a 10 µs pulse, then holds its echo pin high until the echo returns. Sound travels about 0.0343 cm per microsecond at room temperature, there and back, so distance = time × 0.0343 / 2. A time-out stops the sketch waiting forever when nothing is in range. Many HC-SR04 boards need 5 V; on a Raspberry Pi the echo must be divided down to 3.3 V.
learn: pulseIn and microseconds; the speed of sound; voltage levels.
source: Arduino pulseIn() | https://docs.arduino.cc/language-reference/en/functions/advanced-io/pulseIn/ | timing a pulse in microseconds, with a time-out
== arduino distance.ino
constant TRIG is 7
constant ECHO is 8

when the board starts
    make pin TRIG an output
    make pin ECHO an input
    start the serial monitor at 9600

over and over
    turn pin TRIG off
    c++: delayMicroseconds(2);
    turn pin TRIG on
    c++: delayMicroseconds(10);
    turn pin TRIG off
    set unsigned long echo_time to pulseIn(ECHO, HIGH, 30000)
    if echo_time is 0
        show "Nothing in range"
    otherwise
        show echo_time * 0.0343 / 2 followed by " cm"
    wait 100 milliseconds
== python distance.py
import gpiozero

make a new gpiozero.DistanceSensor with echo=24, trigger=23, max_distance=2 and store in sensor
repeat forever
    show "{sensor.distance * 100:.1f} cm"
    wait 0.2 seconds`,

`part: thermistor
title: Temperature from a thermistor
group: hardware
types: arduino-gadget, raspberry-pi, smart-home
about: Turn an analog reading from a thermistor and a resistor into degrees Celsius.
summary: A thermistor's resistance falls as it warms. Wired with a fixed resistor as a voltage divider, the analog reading gives its resistance; the Beta equation then gives the temperature: 1/T = 1/T0 + ln(R/R0)/B, with T in kelvin, R0 its resistance at 25 °C (T0 = 298.15 K) and B from its data sheet (3950 is common for 10 kΩ parts). The Raspberry Pi has no analog inputs, so it reads through an ADC chip such as the MCP3008.
learn: Voltage dividers; logarithms; kelvin and Celsius.
source: Thermistor, B or β parameter equation | https://en.wikipedia.org/wiki/Thermistor | 1/T = 1/T0 + (1/B)·ln(R/R0)
== arduino thermistor.ino
constant SENSOR is A0
constant decimal FIXED is 10000.0
constant decimal R0 is 10000.0
constant decimal BETA is 3950.0

define celsius_from using whole number reading giving back decimal
    note: The thermistor is between the pin and ground, the fixed resistor between 5 V and the pin.
    set decimal resistance to FIXED * reading / (1023.0 - reading)
    set decimal kelvin to 1.0 / (1.0 / 298.15 + log(resistance / R0) / BETA)
    give back kelvin - 273.15

when the board starts
    start the serial monitor at 9600

over and over
    read analog pin SENSOR and store in reading
    show celsius_from(reading) followed by " C"
    wait 1 second
== python thermistor.py
define celsius from using fraction, fixed=10000.0, r0=10000.0, beta=3950.0
    description: Degrees Celsius from a reading of 0 to 1 (an MCP3008's value): thermistor to ground, fixed resistor to the supply.
    set resistance to fixed times fraction divided by (1 minus fraction)
    set kelvin to 1 divided by (1 divided by 298.15 plus math.log(resistance divided by r0) divided by beta)
    give back kelvin minus 273.15`,

);
