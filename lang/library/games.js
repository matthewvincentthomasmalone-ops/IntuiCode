/* IntuaCode Library — game parts, and maths and numbers. */
(window.IntuiLibraryPacks = window.IntuiLibraryPacks || []).push(

`part: game-loop
title: Game loop with a fixed time step
group: games
types: browser-game, phone-game, pc-game, graphics-3d
about: Update the game in equal small steps however fast or slow the screen redraws, then draw.
summary: Screens redraw at 60, 120 or 144 times a second, and a slow frame can take longer. If movement is worked out once per frame, the game runs at a different speed on every machine. The usual answer is an accumulator: add the real time that passed, then run the update in fixed steps (1/60 s here) while there is enough time saved up, and draw once. A cap on the time added stops a long pause (a hidden tab) from running hundreds of steps at once.
learn: The difference between frames and game time; while loops.
source: Glenn Fiedler, Fix Your Timestep! | https://gafferongames.com/post/fix_your_timestep/ | the accumulator with a fixed update step and a cap on the frame time
== html index.html
add a drawing area called game 480 by 270
== js loop.js
constant STEP is 1 / 60
set x to 0
set last to performance.now() / 1000
set saved to 0
define update using dt
    set x to (x + 120 * dt) % 480
define draw
    fill game with "#101820"
    draw a circle at x, 135 with radius 12 in "gold" on game
every frame
    constant now is performance.now() / 1000
    set saved to saved + Math.min(now - last, 0.25)
    set last to now
    while saved is at least STEP
        run update with STEP
        set saved to saved - STEP
    run draw
== python loop.py
import time

define run game using update, draw, seconds, step=1 / 60
    description: Calls update(step) in fixed steps and draw() once per pass, for a number of seconds.
    set last to time.perf_counter()
    set saved to 0.0
    set started to last
    while last minus started is less than seconds
        set now to time.perf_counter()
        set saved to saved plus min(now minus last, 0.25)
        set last to now
        while saved is at least step
            run update with step
            set saved to saved minus step
        run draw
        run time.sleep with 0.001
== cpp loop.cpp
include chrono
include algorithm

define update using double dt giving back nothing
    note: Move everything by dt seconds here.

define draw giving back nothing
    note: Draw everything here.

define run_game using double seconds giving back nothing
    note: update is called in fixed steps of 1/60 s, draw once per pass.
    set double step to 1.0 / 60.0
    set double saved to 0.0
    set auto start to std::chrono::steady_clock::now()
    set auto last to start
    while std::chrono::duration<double>(last - start).count() is less than seconds
        set auto now to std::chrono::steady_clock::now()
        set saved to saved + std::min(std::chrono::duration<double>(now - last).count(), 0.25)
        set last to now
        while saved is at least step
            run update with step
            set saved to saved - step
        run draw`,

`part: box-collision
title: Box collision
group: games
types: browser-game, phone-game, pc-game
about: Do two rectangles overlap? The test behind most 2D game collisions.
summary: Two boxes (x, y, width, height) overlap when each one starts before the other ends, across and down: a.x < b.x + b.width and b.x < a.x + a.width, and the same for y. Using < rather than <= means boxes that only touch don't count. It's called AABB (axis-aligned bounding box) because the boxes aren't rotated.
learn: And (both must be true); drawing the four cases on paper.
== python collide.py
define boxes overlap using ax, ay, aw, ah, bx, by, bw, bh
    description: Do two boxes overlap? Box a is at (ax, ay) and aw by ah in size; box b likewise.
    give back ax < bx + bw and bx < ax + aw and ay < by + bh and by < ay + ah
== js collide.js
define boxesOverlap using a, b
    description: Do two boxes overlap? Each is { x, y, w, h }.
    give back a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
== cpp collide.cpp
define class Box
    field x: double = 0.0
    field y: double = 0.0
    field w: double = 0.0
    field h: double = 0.0

define overlap using Box a, Box b giving back bool
    note: Each box must end after the other one starts, across and down.
    give back b.x + b.w > a.x && a.x + a.w > b.x && b.y + b.h > a.y && a.y + a.h > b.y`,

`part: circle-collision
title: Circle collision
group: games
types: browser-game, phone-game, pc-game
about: Do two circles touch? Compare the distance between centres with the sum of the radii.
summary: Two circles overlap when the distance between their centres is less than their two radii added together. Comparing squares (dx² + dy² < (r1 + r2)²) gives the same answer without a square root, which is slower.
learn: Pythagoras; why comparing squares works for positive numbers.
== python circles.py
define circles overlap using x1, y1, r1, x2, y2, r2
    set dx to x2 minus x1
    set dy to y2 minus y1
    give back dx squared plus dy squared is less than (r1 plus r2) squared
== js circles.js
define circlesOverlap using x1, y1, r1, x2, y2, r2
    constant dx is x2 - x1
    constant dy is y2 - y1
    give back dx * dx + dy * dy < (r1 + r2) * (r1 + r2)
== cpp circles.cpp
define circles_overlap using double x1, double y1, double r1, double x2, double y2, double r2 giving back bool
    set double dx to x2 - x1
    set double dy to y2 - y1
    give back dx * dx + dy * dy < (r1 + r2) * (r1 + r2)`,

`part: gravity-jump
title: Gravity and jumping
group: games
types: browser-game, phone-game, pc-game
about: A body that falls, lands on the ground and can jump only while standing.
summary: Each step, gravity adds to the downward speed and the speed moves the body: speed += gravity × dt, then y += speed × dt. Landing stops it at the ground and resets the speed; a jump sets an upward speed, allowed only when standing. Screen y grows downwards, so up is negative.
learn: Speed and acceleration; the Game loop part (a fixed dt keeps jumps the same height everywhere).
== python physics.py
set GRAVITY to 1800
set JUMP_SPEED to -650

define step body using body, dt, ground_y
    description: Moves a body (a dictionary with "y", "speed" and "standing") one step.
    set item "speed" of body to item "speed" of body plus GRAVITY times dt
    set item "y" of body to item "y" of body plus item "speed" of body times dt
    if item "y" of body is at least ground_y
        set item "y" of body to ground_y
        set item "speed" of body to 0
        set item "standing" of body to yes
    otherwise
        set item "standing" of body to no

define jump using body
    if item "standing" of body
        set item "speed" of body to JUMP_SPEED
        set item "standing" of body to no
== js physics.js
constant GRAVITY is 1800
constant JUMP_SPEED is -650
define stepBody using body, dt, groundY
    description: Moves a body ({ y, speed, standing }) one step.
    set body.speed to body.speed + GRAVITY * dt
    set body.y to body.y + body.speed * dt
    if body.y is at least groundY
        set body.y to groundY
        set body.speed to 0
        set body.standing to true
    otherwise
        set body.standing to false
define jump using body
    if body.standing
        set body.speed to JUMP_SPEED
        set body.standing to false`,

`part: sprite-animation
title: Sprite animation
group: games
types: browser-game, phone-game, pc-game
about: Play frames from a sprite sheet (one picture with every frame side by side) at a steady speed.
summary: A sprite sheet keeps every frame of an animation in one picture, each the same width. Which frame to show comes from time, not from counting redraws: frame = floor(time × frames per second) mod number of frames, so it plays at the same speed on every screen. The part of the sheet to draw starts at frame × width.
learn: Remainders (mod); drawing part of a picture.
== html index.html
add a drawing area called game 320 by 180
== js sprite.js
load the picture "images/runner.png" as sheet
constant FRAME_W is 32
constant FRAME_H is 32
constant FRAMES is 8
constant FPS is 12
every frame
    constant frame is Math.floor(performance.now() / 1000 * FPS) % FRAMES
    constant pen is game.getContext("2d")
    clear game
    run pen.drawImage with sheet, frame * FRAME_W, 0, FRAME_W, FRAME_H, 144, 74, FRAME_W, FRAME_H
== python sprite.py
define frame at using seconds, frames, fps
    description: Which frame of an animation to show at a time in seconds.
    give back int(seconds times fps) mod frames

define frame area using frame, width, height
    description: The part of a sprite sheet that holds a frame: (x, y, width, height).
    give back frame * width, 0, width, height`,

`part: tile-map
title: Tile maps
group: games
types: browser-game, pc-game
about: A level drawn from a grid of letters: which tile is at a point, and is it solid?
summary: Many 2D levels are a grid of equal squares, written as rows of characters: # for a wall, . for floor. A position in pixels becomes a tile by dividing by the tile size and rounding down; a tile becomes pixels by multiplying back. Anything outside the map counts as solid, so nothing walks off the edge.
learn: Lists of text; whole-number division.
== python tiles.py
set TILE to 16
set LEVEL to ["#########", "#.......#", "#..##...#", "#.......#", "#########"]

define tile at using x, y
    description: The character at a point in pixels; outside the map is a wall.
    set column to int(x // TILE)
    set row to int(y // TILE)
    if row is less than 0 or row is at least length of LEVEL or column is less than 0 or column is at least length of item 0 of LEVEL
        give back "#"
    give back LEVEL[row][column]

define is solid using x, y
    set found to the result of tile at with x, y
    give back found is "#"
== js tiles.js
constant TILE is 16
constant LEVEL is ["#########", "#.......#", "#..##...#", "#.......#", "#########"]
define tileAt using x, y
    description: The character at a point in pixels; outside the map is a wall.
    constant column is Math.floor(x / TILE)
    constant row is Math.floor(y / TILE)
    if row < 0 || row >= LEVEL.length || column < 0 || column >= LEVEL[0].length
        give back "#"
    give back LEVEL[row][column]
define isSolid using x, y
    give back tileAt(x, y) === "#"`,

`part: camera-follow
title: A camera that follows the player
group: games
types: browser-game, phone-game, pc-game, graphics-3d
about: Scroll the view after the player smoothly, without showing past the edges of the world.
summary: The camera is a position subtracted from everything drawn. Each frame it moves a share of the way towards where it should be (a lerp), which makes it glide rather than jerk, and it is clamped so the view never shows beyond the world. A share that depends on dt (1 - 0.001^dt here) keeps the smoothing the same at any frame rate.
learn: The Clamp, lerp and map part; drawing everything shifted by the camera.
== python camera.py
define follow using camera_x, target_x, dt, view_width, world_width
    description: The camera's next x: closer to the target, never past the world's edges.
    set wanted to target_x minus view_width divided by 2
    set camera_x to camera_x plus (wanted minus camera_x) times (1 minus 0.001 ** dt)
    give back max(0, min(camera_x, world_width minus view_width))
== js camera.js
define follow using cameraX, targetX, dt, viewWidth, worldWidth
    description: The camera's next x: closer to the target, never past the world's edges.
    constant wanted is targetX - viewWidth / 2
    constant moved is cameraX + (wanted - cameraX) * (1 - Math.pow(0.001, dt))
    give back Math.max(0, Math.min(moved, worldWidth - viewWidth))`,

`part: game-states
title: Game states
group: games
types: browser-game, phone-game, pc-game, robotics, game-mod
about: Menu, playing, paused, game over: one state at a time, and a table of which moves between them are allowed.
summary: A game (or a robot) is easier to follow when it is always in exactly one named state and only certain events move it on: start from the menu, pause and resume while playing, lose and go to game over. Writing the moves as a table makes the rules visible and stops impossible ones, like pausing on the menu.
learn: Dictionaries; the idea of a state machine.
== python states.py
set MOVES to {("menu", "start"): "playing", ("playing", "pause"): "paused", ("paused", "resume"): "playing", ("playing", "lose"): "game over", ("game over", "restart"): "menu"}

define next state using state, event
    description: The state after an event, or the same state when the event doesn't apply.
    give back MOVES.get((state, event), state)
== js states.js
constant MOVES is { "menu start": "playing", "playing pause": "paused", "paused resume": "playing", "playing lose": "game over", "game over restart": "menu" }
define nextState using state, event
    description: The state after an event, or the same state when the event doesn't apply.
    give back MOVES[state + " " + event] ?? state
== cpp states.cpp
include map
include utility

define next_state using std::string state, std::string event giving back std::string
    note: The allowed moves, made once (static) and shared by every call.
    c++: static const std::map<std::pair<std::string,std::string>,std::string> moves = {
    c++:     {{"menu", "start"}, "playing"}, {{"playing", "pause"}, "paused"}, {{"paused", "resume"}, "playing"},
    c++:     {{"playing", "lose"}, "game over"}, {{"game over", "restart"}, "menu"}};
    set auto found to moves.find({state, event})
    give back found == moves.end() ? state : found->second`,

`part: high-score
title: Saving a high score
group: games
types: browser-game, phone-game, pc-game, learning-app
about: Keep the best score between visits: in the browser's storage on a page, in a small file for a program.
summary: A high score has to survive closing the game, so it is saved somewhere lasting: localStorage in a browser, a JSON file next to a program. Reading it allows for there being nothing saved yet (the first game) or a damaged file.
learn: The browser's storage; files and JSON; what to do when nothing has been saved yet.
== js score.js
define bestScore
    load "best" from the browser and store in best
    give back best ?? 0
define recordScore using score
    description: Saves the score when it beats the best; gives back the best.
    if score is more than bestScore()
        save score in the browser as "best"
    give back bestScore()
== python score.py
import json
import os

define best score using path="scores.json"
    description: The best score saved, or 0 when there's none yet (or the file is damaged).
    if not os.path.exists(path)
        give back 0
    try
        open the file path as f
            give back json.load(f).get("best", 0)
    if it fails with ValueError
        give back 0

define record score using score, path="scores.json"
    description: Saves the score when it beats the best; gives back the best.
    set best to the result of best score with path
    if score is more than best
        open the file path for writing as f
            run json.dump with {"best": score}, f
        give back score
    give back best`,

`part: weighted-random
title: Weighted random choice
group: games
types: browser-game, phone-game, pc-game, learning-app, machine-learning, game-mod
about: Pick at random where some things are more likely than others: loot, enemy types, the next quiz question.
summary: Give each choice a weight; add them up; take a random number between 0 and the total, and walk through the choices subtracting weights until it runs out. A choice with weight 3 comes up three times as often as one with weight 1. Python's random.choices does this; the walk is shown so it can be written in any language.
learn: Random numbers; running totals.
== python weighted.py
define pick weighted using choices, weights
    description: One of the choices, picked with the given weights.
    set r to random.random() times sum(weights)
    count i from 0 to length of choices minus 1
        set r to r minus item i of weights
        if r is less than 0
            give back item i of choices
    give back last item of choices
== js weighted.js
define pickWeighted using choices, weights
    set r to Math.random() * weights.reduce((a, b) => a + b, 0)
    repeat length of choices times counting with i
        set r to r - item i of weights
        if r is less than 0
            give back item i of choices
    give back choices[choices.length - 1]`,

`part: easing
title: Easing and tweening
group: games
types: browser-game, phone-game, pc-game, webpage, graphics-3d
about: Make movement start and stop gently instead of at a constant speed.
summary: A tween moves a value from a start to an end over a time. Feeding the fraction of time passed (0 to 1) through an easing curve changes its feel: ease-in starts slowly, ease-out ends slowly, smoothstep does both. In CSS the same curves are transition timing functions.
learn: Functions from 0..1 to 0..1; the Clamp, lerp and map part.
source: CSS Easing Functions Level 1 (W3C) | https://www.w3.org/TR/css-easing-1/ | the named easing curves used by transitions
== python easing.py
define ease in using t
    give back t squared

define ease out using t
    give back 1 minus (1 minus t) squared

define smoothstep using t
    give back t times t times (3 minus 2 times t)

define tween using start, end, t, curve=smoothstep
    description: The value a fraction t of the way from start to end, shaped by an easing curve.
    set t to max(0.0, min(1.0, t))
    give back start plus (end minus start) times curve(t)
== js easing.js
define smoothstep using t
    give back t * t * (3 - 2 * t)
define tween using start, end, t
    constant clamped is Math.max(0, Math.min(1, t))
    give back start + (end - start) * smoothstep(clamped)
== css style.css
create group slides-in: transition: transform 0.4s ease-out, opacity 0.4s ease-out
create group springy: transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)`,

// ---------------------------------------------------------------- maths and numbers

`part: clamp-lerp-map
title: Clamp, lerp and map
group: maths
types: browser-game, graphics-3d, arduino-gadget, robotics, data-analysis, machine-learning
about: Keep a number inside limits, blend between two numbers, and turn one range into another (a sensor reading into degrees).
summary: Clamp keeps a value between a low and a high limit. Lerp (linear interpolation) goes a fraction t of the way from a to b. Map turns a value from one range into another, as Arduino's map() does: a reading of 0 to 1023 into 0 to 180 degrees. Arduino's map works in whole numbers and doesn't clamp, so a reading outside the first range gives one outside the second.
learn: Fractions and proportion; the difference between whole-number and decimal division.
source: Arduino map() | https://docs.arduino.cc/language-reference/en/functions/math/map/ | map's formula, its whole-number maths and that it doesn't clamp
== python ranges.py
define clamp using x, low, high
    give back max(low, min(high, x))

define lerp using a, b, t
    give back a plus (b minus a) times t

define map range using x, in_low, in_high, out_low, out_high
    description: x from one range turned into the same place in another range (not clamped).
    give back out_low plus (x minus in_low) times (out_high minus out_low) divided by (in_high minus in_low)
== js ranges.js
define clamp using x, low, high
    give back Math.max(low, Math.min(high, x))
define lerp using a, b, t
    give back a + (b - a) * t
define mapRange using x, inLow, inHigh, outLow, outHigh
    give back outLow + (x - inLow) * (outHigh - outLow) / (inHigh - inLow)
== cpp ranges.cpp
include algorithm

define lerp using double a, double b, double t giving back double
    give back a + (b - a) * t

define map_range using double x, double in_low, double in_high, double out_low, double out_high giving back double
    give back out_low + (x - in_low) * (out_high - out_low) / (in_high - in_low)

define clamp_value using double x, double low, double high giving back double
    give back std::clamp(x, low, high)
== arduino ranges.ino
constant KNOB is A0
constant LED is 9

when the board starts
    make pin LED an output

over and over
    read analog pin KNOB and store in reading
    set level to map(reading, 0, 1023, 0, 255)
    set level to constrain(level, 0, 255)
    set the brightness of pin LED to level
    wait 10 milliseconds`,

`part: vectors-2d
title: 2D vectors
group: maths
types: browser-game, phone-game, pc-game, graphics-3d, robotics, game-mod
about: Positions and directions as (x, y): adding, length, normalising, and the dot product.
summary: A vector is an x and a y. Adding moves a position by a velocity; the length is √(x² + y²) (Pythagoras); normalising divides by the length to give a direction of length 1 (so diagonal movement isn't faster); the dot product says how much two directions point the same way (1 same, 0 at right angles, -1 opposite, for unit vectors).
learn: Pythagoras; division by zero (a zero vector has no direction).
== python vectors.py
define vector length using x, y
    give back math.hypot(x, y)

define normalised using x, y
    description: The same direction with length 1; (0, 0) stays (0, 0).
    set size to math.hypot(x, y)
    if size is 0
        give back 0.0, 0.0
    give back x / size, y / size

define dot using ax, ay, bx, by
    give back ax times bx plus ay times by
== js vectors.js
define normalised using x, y
    constant size is Math.hypot(x, y)
    if size is 0
        give back [0, 0]
    give back [x / size, y / size]
define dot using ax, ay, bx, by
    give back ax * bx + ay * by
== cpp vectors.cpp
include cmath

define class Vec2
    field x: double = 0.0
    field y: double = 0.0
    define length giving back double
        give back std::hypot(x, y)
    define normalised giving back Vec2
        set double size to std::hypot(x, y)
        if size is 0.0
            give back Vec2{0.0, 0.0}
        give back Vec2{x / size, y / size}`,

`part: moving-average
title: Moving average
group: maths
types: data-analysis, arduino-gadget, raspberry-pi, robotics, machine-learning
about: Smooth a jumpy stream of readings: the average of the last few, or a running (exponential) average.
summary: Sensor readings and measurements jitter. A simple moving average keeps the last n values and averages them; keeping a running total means each new value costs one add and one subtract. An exponential average needs no history at all: average += k × (value - average), with k between 0 and 1 (smaller is smoother, but slower to follow).
learn: Running totals; lists used as a circle; the trade-off between smooth and quick.
== python smoothing.py
define moving average using values, n
    description: The average of each value and the n - 1 before it (fewer at the start).
    create list out
    set total to 0.0
    count i from 0 to length of values minus 1
        set total to total plus item i of values
        if i is at least n
            set total to total minus item (i minus n) of values
        add total divided by min(i plus 1, n) to out
    give back out

define exponential average using values, k
    description: A running average; k from 0 to 1 (smaller is smoother).
    set average to first item of values
    create list out
    for each v in values
        set average to average plus k times (v minus average)
        add average to out
    give back out
== js smoothing.js
define exponentialAverage using values, k
    set average to values[0]
    create list out
    for each v in values
        set average to average + k * (v - average)
        add average to out
    give back out
== cpp smoothing.cpp
include array

define class MovingAverage
    note: A fixed array: no memory is made after start-up, so it suits audio and boards alike.
    field values: std::array<double, 16> = {}
    field total: double = 0.0
    field next: int = 0
    field filled: int = 0
    define add using double v giving back double
        set self.total to total - values[next] + v
        set values[next] to v
        set self.next to (next + 1) % 16
        if filled is less than 16
            increase filled
        give back total / filled
== arduino smoothing.ino
constant SENSOR is A0
constant COUNT is 10
create list of numbers called readings with 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
set slot to 0
set total to 0

when the board starts
    start the serial monitor at 9600

over and over
    read analog pin SENSOR and store in reading
    set total to total - readings[slot] + reading
    set readings[slot] to reading
    set slot to (slot + 1) % COUNT
    show total / COUNT
    wait 50 milliseconds`,

`part: statistics
title: Mean, median and spread
group: maths
types: data-analysis, machine-learning, learning-app
about: Summarise a list of numbers: the average, the middle value, and how spread out they are.
summary: The mean adds everything and divides by how many; the median is the middle value once sorted, which one huge outlier can't drag about; the standard deviation says how far values typically are from the mean. Python's statistics module has all three; the steps are written out here so they can be followed.
learn: Sorting; averages; squares and square roots.
source: Python statistics module | https://docs.python.org/3/library/statistics.html | sample standard deviation divides by n - 1
== python stats.py
define mean using values
    give back sum of values divided by length of values

define median using values
    set ordered to sorted values
    set middle to length of ordered // 2
    if length of ordered is even
        give back (item (middle minus 1) of ordered plus item middle of ordered) divided by 2
    give back item middle of ordered

define standard deviation using values
    description: The sample standard deviation (dividing by n - 1, as statistics.stdev does).
    set m to the result of mean with values
    give back square root of (sum((v - m) ** 2 for v in values) divided by (length of values minus 1))
== js stats.js
define mean using values
    give back values.reduce((a, b) => a + b, 0) / values.length
define median using values
    constant ordered is [...values].sort((a, b) => a - b)
    constant middle is Math.floor(ordered.length / 2)
    if ordered.length % 2 === 0
        give back (ordered[middle - 1] + ordered[middle]) / 2
    give back ordered[middle]`,

`part: angles
title: Angles and directions
group: maths
types: browser-game, phone-game, graphics-3d, robotics
about: Degrees and radians, the angle from one point to another, and the shortest way to turn.
summary: Code's sine and cosine work in radians (a full turn is 2π); people think in degrees (360). atan2(dy, dx) gives the angle from one point to another in every quarter, unlike atan. Turning towards an angle should go the short way, so the difference is wrapped into -180 to 180 degrees.
learn: Radians; atan2; remainders with negative numbers.
== python angles.py
define angle to using x1, y1, x2, y2
    description: The direction from the first point to the second, in degrees (0 is to the right).
    give back math.degrees(math.atan2(y2 minus y1, x2 minus x1))

define turn by using from_degrees, to_degrees
    description: The shortest turn from one angle to another, from -180 to 180 degrees.
    give back (to_degrees minus from_degrees plus 180) mod 360 minus 180
== js angles.js
define angleTo using x1, y1, x2, y2
    give back Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI
define turnBy using fromDegrees, toDegrees
    constant d is ((toDegrees - fromDegrees + 180) % 360 + 360) % 360
    give back d - 180`,

);
