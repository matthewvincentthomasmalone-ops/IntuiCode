/* IntuCode — the learning modules, in Python: four classic games in a window of their own, made with tkinter
 * (it comes with Python), built step by step and in order: Snake, Invaders, Invaders under a night sky, and
 * Jacques & Louis G., a side-scrolling platformer. Each module has two kits with the same steps: a plain one,
 * and an annotated one whose teach: lines become notes saying what each part adds, and why.
 *
 * The layout is the same in every module: Settings (the numbers and colours, in capitals), Tools (the window,
 * what the game remembers, and a tool for each job) and Main program (the wiring: keys, the first tick, and
 * mainloop at the very end). Every tick, the game runs each tool in the list tick_jobs, and each step adds its
 * own job, so the game plays at the end of every step without an earlier step being rewritten.
 *
 * tkinter windows open in the desktop app (the Python in the browser has no windows). The website versions of
 * the same modules are in modules-web.js. */
(window.IntuiKitPacks = window.IntuiKitPacks || []).push(

// ---------------------------------------------------------------- shared steps

`component: mpy-start
name: Start: hand over to tkinter
depth: walk
summary: The last line of every tkinter program. mainloop opens the window and hands control to tkinter, which waits for key presses and for the moments the game asked to be woken (window.after), and runs your tools when they come, until the window is closed. Every line before it only set things up. tkinter windows open in IntuCode's desktop app, or with Python on your computer; the Python built into the browser has no windows.
learn: Event-driven programs; why nothing may come after mainloop; why a slow tool freezes the window.
== main
teach: Everything above only set things up. mainloop opens the window and keeps it alive: it waits for keys and for the ticks the game asked for, and runs the tools that answer them, until the window is closed. Nothing below this line would run until then, which is why it comes last.
run window.mainloop`,

`component: mpy-pygame
name: Bigger games: pygame and Arcade
depth: horizon
summary: tkinter is made for windows with buttons, and it does well for a first game, but it draws shapes one by one and has no idea of a game. Game libraries are built for it: they redraw the whole screen sixty times a second, load pictures and sounds, read game controllers and keep time steadily. The ideas from these modules carry straight over: a loop that moves, checks and draws; lists of things; rectangles that overlap; state.
usual: pygame (pygame-ce), the most used, with years of tutorials; Arcade, more modern, with sprites, cameras and physics built in; Pyxel for retro games with a tiny palette; Godot (with GDScript, close to Python) when a game outgrows a library.
learn: A loop with a clock (clock.tick(60)); sprites and sprite groups; delta time, so speed doesn't depend on the computer; the pygame "Rect" and its colliderect.`,

`component: mpy-art-sound
name: Sprites, art and sound
depth: horizon
summary: The games here are made of rectangles and circles, which keeps the code in view. Real games draw pictures (sprites), often several frames of one so a character walks, and play sounds for every hit, jump and pickup, with music under it all. tkinter can show PNG pictures with PhotoImage but has no sound of its own; game libraries do both.
usual: Aseprite or Piskel for pixel art (Piskel is free, in the browser); free art and sounds from Kenney.nl and OpenGameArt; jsfxr or ChipTone for sound effects; pygame.mixer to play them.
learn: Sprite sheets (many frames in one picture); animating by changing frames on a timer; sound effects and music as two separate channels; licences for art you didn't make.`,

// ---------------------------------------------------------------- 1 · Snake

`kit: snake-py
title: Snake
layout: structured
shelf: modules
platform: pc
module: 1 · Snake
version: Python window
annotated: no
about: The first module: Snake, in a window of its own, made with tkinter (it comes with Python). A grid, a snake that moves every tick and turns with the arrow keys, food that makes it grow, the score, and game over with a restart. It plays at the end of every step. tkinter windows open in the desktop app; the Python in the browser has no windows.
steps: mpy-snake-board!, mpy-snake-body!, mpy-snake-keys!, mpy-snake-food!, mpy-snake-over!, mpy-start!, mpy-snake-faster*, mpy-pygame, package`,

`kit: snake-py-notes
title: Snake, annotated
layout: structured
shelf: modules
platform: pc
module: 1 · Snake
version: Python window · annotated
annotated: yes
about: The first module, with notes: Snake in a tkinter window, where every part says what it adds and why, the way a teacher would talk you through it. A grid, a snake that moves every tick and turns with the arrow keys, food that makes it grow, the score, and game over with a restart. tkinter windows open in the desktop app; the Python in the browser has no windows.
steps: mpy-snake-board!, mpy-snake-body!, mpy-snake-keys!, mpy-snake-food!, mpy-snake-over!, mpy-start!, mpy-snake-faster*, mpy-pygame, package`,

`component: mpy-snake-board
name: The window and the grid
depth: walk
summary: Every game needs somewhere to happen. This step opens a window with a canvas in it (a tkinter widget you can draw shapes on) and draws a grid of 20 by 15 squares. Snake moves in whole squares, so every place on the board is a column and a row, and one tool turns a square into pixels and fills it. Every later step draws with it.
learn: tkinter's Tk and Canvas; coordinates (x across, y down from the top-left corner); constants in capitals; a tool that does one job.
== settings
teach: Settings come first, in capitals. Capitals are Python's way of saying "this doesn't change while the program runs", and having them together means one change here changes the whole game.
note: The board: 20 squares across, 15 down, each 24 pixels wide.
set CELL to 24
set COLUMNS to 20
set ROWS to 15
note: Colours, as hex codes: red, green and blue, from 00 (none) to ff (full).
set BACKGROUND to "#14181f"
set GRID_COLOUR to "#1f2633"
set TEXT_COLOUR to "#e8ecf3"
set FONT to ("Helvetica", 14, "bold")
== tools
teach: tkinter comes with Python. Tk() is the window itself; a Canvas is a widget to draw on, sized here to fit the grid exactly.
python: import tkinter as tk
set window to tk.Tk()
run window.title with "Snake"
run window.resizable with no, no
set canvas to tk.Canvas(window, width=COLUMNS * CELL, height=ROWS * CELL, background=BACKGROUND, highlightthickness=0)
run canvas.pack

define draw grid
    description: Faint lines between the squares, so you can see the grid the snake moves on.
    teach: A canvas counts in pixels from its top-left corner: x goes across, and y goes down, not up as in maths. Column 3 starts at x = 3 times CELL.
    count column from 0 to COLUMNS
        run canvas.create_line with column times CELL, 0, column times CELL, ROWS times CELL, fill=GRID_COLOUR, tags="grid"
    count row from 0 to ROWS
        run canvas.create_line with 0, row times CELL, COLUMNS times CELL, row times CELL, fill=GRID_COLOUR, tags="grid"

define draw square using square, colour, tag
    description: Fills one square of the grid, a pixel in from its edges. A square is a pair: (column, row).
    teach: The game thinks in squares; the canvas thinks in pixels. This one tool turns one into the other, so no other part of the game has to.
    set x to square[0] times CELL
    set y to square[1] times CELL
    teach: The tag is a label for everything drawn with it, like "snake", so it can all be deleted at once and drawn again.
    run canvas.create_rectangle with x + 1, y + 1, x + CELL - 1, y + CELL - 1, fill=colour, outline="", tags=tag
== main
teach: The main program wires the parts together. First, the grid.
run draw grid`,

`component: mpy-snake-body
name: The snake, moving every tick
depth: walk
summary: The snake is a list of squares, head first. Every tick it moves: a new head goes on the front, one square the way it's heading, and the tail comes off the end, so the body follows the head without each part being moved. The tick is the game loop: window.after asks tkinter to run it again a moment later, so the window never freezes. For now the snake heads right and slides off the edge; the next steps steer it and end the game there.
learn: Lists as a queue (insert at the front, pop from the end); pairs (tuples); window.after and the game loop; tools kept in a list and run in order.
== settings
note: How long a tick lasts, in milliseconds: smaller is faster.
set START_SPEED to 150
set SNAKE_COLOUR to "#5fd38d"
set HEAD_COLOUR to "#b8f5cc"
teach: Each way the snake can head, as one step across (x) and one step down (y). Up is -1, because y counts down.
set STEPS to {"Left": (-1, 0), "Right": (1, 0), "Up": (0, -1), "Down": (0, 1)}
== tools
teach: What the game remembers lives here, next to the tools that change it. The snake is a list of squares, head first; each square is a pair, (column, row).
create list snake
set heading to "Right"
set last move to "Right"
set speed to START_SPEED
set playing to yes

define reset snake
    description: A short snake in the middle of the board, heading right.
    set middle to ROWS // 2
    set snake to [(5, middle), (4, middle), (3, middle)]
    set heading to "Right"
    set last move to "Right"
    run draw snake

define draw snake
    description: Deletes the old snake and draws it where it is now, the head in a lighter green.
    run canvas.delete with "snake"
    for each square in snake
        run draw square with square, SNAKE_COLOUR, "snake"
    run draw square with first item of snake, HEAD_COLOUR, "snake"

define move snake
    description: Moves the snake one square: a new head in front, and the tail taken off the end.
    teach: Moving means adding a new head in front and dropping the tail, so the snake seems to slide while only two squares change.
    set head to first item of snake
    set step to STEPS[heading]
    set new head to (head[0] + step[0], head[1] + step[1])
    run snake.insert with 0, new head
    run snake.pop
    set last move to heading
    run draw snake

teach: The game loop. Every tick, each job in this list runs, in order. This step adds moving; later steps add eating and crashing, so the loop never needs rewriting. In Python a tool is a value like any other, so it can sit in a list.
create list tick jobs
add move snake to tick jobs

define tick
    description: One turn of the game: every job runs, then tkinter is asked to run tick again after a short wait.
    if playing
        for each job in tick jobs
            run job
    teach: A while loop here would keep tkinter from drawing or hearing keys. Instead, after asks tkinter to run tick again in speed milliseconds, and the window stays alive in between.
    run window.after with speed, tick
== main
run reset snake
teach: The first tick. After that, each tick books the next one itself.
run window.after with speed, tick`,

`component: mpy-snake-keys
name: Turning with the arrow keys
depth: walk
summary: The arrow keys steer. window.bind connects a key to a tool, and tkinter runs the tool with an event that says which key it was. One rule makes Snake fair: no turning straight back into your own neck. It's checked against the way the snake last moved, not the last key pressed, because two quick presses between ticks (up, then left while heading right) would otherwise turn it round on the spot.
learn: Events and bind; event.keysym (the key's name); dictionaries as lookup tables; checking a move against the state rather than the input.
== settings
note: The opposite of each way: the one turn the snake may never make.
set OPPOSITE to {"Left": "Right", "Right": "Left", "Up": "Down", "Down": "Up"}
== tools
define steer using event
    description: Turns the snake the way of the arrow pressed, unless that's straight back.
    teach: tkinter runs this tool when an arrow is pressed, and passes it an event: event.keysym is the key's name, "Left", "Right", "Up" or "Down".
    set way to event.keysym
    teach: The turn only changes where the snake heads next; the tick does the moving. Checking against last move, the way it really went, rather than the last key, stops two quick presses from turning it into its own neck.
    if way is in STEPS and way is not OPPOSITE[last move]
        set heading to way
== main
teach: Each arrow key, connected to the tool that steers.
run window.bind with "<Left>", steer
run window.bind with "<Right>", steer
run window.bind with "<Up>", steer
run window.bind with "<Down>", steer`,

`component: mpy-snake-food
name: Food, growing and the score
depth: walk
summary: Something to chase. The food sits on a random square that isn't under the snake (if the square it picks is taken, it picks again). When the head reaches it, the score goes up, the snake grows by one square and new food appears. Growing is a small trick: the tail square is doubled, so the next move drops one copy and the other stays.
learn: Random numbers; a loop that tries again until something fits (while); comparing two pairs; drawing text on a canvas.
== settings
set FOOD_COLOUR to "#ff6b6b"
== tools
teach: Two more things to remember: where the food is (a square, like the snake's) and the score.
set food to (12, 7)
set score to 0

define place food
    description: Puts the food on a random square that isn't under the snake, and draws it.
    teach: random number from 0 to the last column picks any column (they count from 0). While the square picked is under the snake, it picks again.
    set food to (random number from 0 to (COLUMNS - 1), random number from 0 to (ROWS - 1))
    while food is in snake
        set food to (random number from 0 to (COLUMNS - 1), random number from 0 to (ROWS - 1))
    run canvas.delete with "food"
    run draw square with food, FOOD_COLOUR, "food"

define draw score
    description: The score in the top-left corner.
    run canvas.delete with "score"
    run canvas.create_text with 8, 6, text="Score: {score}", anchor="nw", fill=TEXT_COLOUR, font=FONT, tags="score"

define eat food
    description: If the head is on the food: grow, score, and put new food somewhere else.
    teach: Two pairs are equal when both their numbers are, so this one comparison asks "is the head on the food's square?".
    if first item of snake is food
        teach: To grow, the tail square goes on twice. The next move drops one copy and leaves the other, so the snake is one square longer.
        add last item of snake to snake
        increase score
        run place food
        run draw score

teach: Eating is a job for every tick, after moving.
add eat food to tick jobs
== main
run place food
run draw score`,

`component: mpy-snake-over
name: Game over, and playing again
depth: walk
summary: A game needs an end. Running off the board or into its own body stops the snake: playing becomes no, the tick stops running the jobs, and a message says what to do. Space starts again, and restarting cleanly means putting back everything a game changes (the snake, its heading, the score, the food) and nothing else. playing is the game's state, and every part of the game can ask it.
learn: State (playing or not); conditions with or; slices (snake[1:] is every square but the head); resetting to a clean start.
== tools
define check crash
    description: Ends the game if the head is off the board or on the snake's own body.
    set head to first item of snake
    teach: The board runs from column 0 to COLUMNS - 1 and row 0 to ROWS - 1. Anything outside that is off the board.
    set off board to head[0] is less than 0 or head[0] is at least COLUMNS or head[1] is less than 0 or head[1] is at least ROWS
    teach: snake[1:] is the snake without its head (a slice: from position 1 to the end). If the head is in it, the snake has run into itself.
    if off board or head is in snake[1:]
        teach: The game's state changes from playing to over. The tick keeps running but does nothing, and space can start a new game.
        set playing to no
        run canvas.create_text with COLUMNS * CELL / 2, ROWS * CELL / 2, text="Game over. Press space to play again.", fill=TEXT_COLOUR, font=FONT, tags="message"

add check crash to tick jobs

define restart using event
    description: Starts a new game, if the last one is over.
    teach: Restarting cleanly means putting back everything a game changes, and nothing more: the message goes, the snake and the score start again, and new food appears.
    if not playing
        run canvas.delete with "message"
        run reset snake
        set score to 0
        run draw score
        run place food
        set playing to yes
== main
run window.bind with "<space>", restart`,

`component: mpy-snake-faster
name: Your turn: faster as it grows
depth: hallway
summary: Snake gets harder as the snake gets longer. Here the tick gets shorter for every square it has grown, down to a fastest speed so it stays playable. It's a job like the others, added to the tick list, so nothing else changes. You write how fast it should be, and the check that keeps it from going too fast.
learn: Formulas from the game's state; limits (a floor on a number); length of a list.
== settings
note: The shortest tick allowed, in milliseconds, so the game stays playable.
set FASTEST to 60
== tools
define speed up
    description: Makes the tick shorter as the snake grows: 5 milliseconds for each square past the first three.
    teach: The speed is worked out from the state every tick, rather than changed bit by bit, so it can never drift: a new game, with a short snake, is slow again by itself.
    set speed to ‹the start speed, 5 milliseconds less for each square past the first three: START_SPEED - 5 * (length of snake - 3)›
    teach: A limit keeps the number in range: if it has gone below the fastest, it is set back to the fastest.
    if ‹speed has gone below the limit: speed is less than FASTEST›
        set speed to FASTEST

add speed up to tick jobs`,

// ---------------------------------------------------------------- 2 · Invaders

`kit: invaders-py
title: Invaders
layout: structured
shelf: modules
platform: pc
module: 2 · Invaders
version: Python window
annotated: no
about: The second module: a shooter in the arcade style, in a tkinter window. A cannon that moves and fires, a block of invaders marching side to side and stepping down, shots, hits, the invaders' bombs, lives and waves. It plays at the end of every step. tkinter windows open in the desktop app; the Python in the browser has no windows.
steps: mpy-inv-stage!, mpy-inv-cannon!, mpy-inv-shots!, mpy-inv-swarm!, mpy-inv-hits!, mpy-inv-bombs!, mpy-inv-waves!, mpy-start!, mpy-inv-faster*, mpy-art-sound, package`,

`kit: invaders-py-notes
title: Invaders, annotated
layout: structured
shelf: modules
platform: pc
module: 2 · Invaders
version: Python window · annotated
annotated: yes
about: The second module, with notes: a shooter in the arcade style, in a tkinter window, where every part says what it adds and why. A cannon, a marching block of invaders, shots, hits, bombs, lives and waves. tkinter windows open in the desktop app; the Python in the browser has no windows.
steps: mpy-inv-stage!, mpy-inv-cannon!, mpy-inv-shots!, mpy-inv-swarm!, mpy-inv-hits!, mpy-inv-bombs!, mpy-inv-waves!, mpy-start!, mpy-inv-faster*, mpy-art-sound, package`,

`component: mpy-inv-stage
name: The stage and the game loop
depth: walk
summary: The window, a ground line near the bottom, and the game loop from Snake, a little grown up. Things here move by pixels rather than squares, so the tick is short (30 milliseconds, about 33 a second) to keep them smooth. Next to the list of tick jobs there's a second list, new game jobs: each part adds the tool that sets it up for a new game, so starting again can never forget one.
learn: Pixels and coordinates; the game loop with after; state (playing or not); lists of tools.
== settings
teach: The size of the window, and the ground line the cannon sits on, in pixels. y counts down from the top, so the ground is near HEIGHT.
set WIDTH to 480
set HEIGHT to 520
set GROUND to 480
note: How long a tick lasts, in milliseconds.
set TICK to 30
set BACKGROUND to "#070a12"
set GROUND_COLOUR to "#3ddc84"
set TEXT_COLOUR to "#e8ecf3"
set FONT to ("Courier", 14, "bold")
== tools
python: import tkinter as tk
set window to tk.Tk()
run window.title with "Invaders"
run window.resizable with no, no
set canvas to tk.Canvas(window, width=WIDTH, height=HEIGHT, background=BACKGROUND, highlightthickness=0)
run canvas.pack

teach: The game's state: playing is yes while a game is on. Every part can ask it, and only a game over changes it.
set playing to no
teach: Two lists of tools. Every tick, each tick job runs; for a new game, each new game job runs. Each later step adds its own to both, so neither the loop nor the restart needs rewriting.
create list tick jobs
create list new game jobs

define new game
    description: Sets every part up for a new game, then starts it.
    for each job in new game jobs
        run job
    set playing to yes

define tick
    description: One turn of the game: every job runs, then tkinter runs tick again after TICK milliseconds.
    if playing
        for each job in tick jobs
            run job
    run window.after with TICK, tick
== main
run canvas.create_line with 0, GROUND, WIDTH, GROUND, fill=GROUND_COLOUR, width=2, tags="ground"
teach: All the parts are ready by now (Python ran the Tools file first), so one call sets them up, and the first tick starts the loop.
run new game
run window.after with TICK, tick`,

`component: mpy-inv-cannon
name: The cannon
depth: walk
summary: Your cannon, on the ground: two rectangles, a body and a barrel, drawn around one number, its x (the middle of the cannon). The left and right arrow keys change x, and max and min keep it inside the window. Holding a key down makes the computer repeat it after a short pause, so the cannon moves in steps; the platformer in module 4 tracks keys held down, for smooth running.
learn: Drawing from one position (everything relative to x); keeping a number in range with max and min; key events.
== settings
set CANNON_WIDTH to 36
set CANNON_HEIGHT to 14
note: How far one press of an arrow key moves the cannon, in pixels.
set CANNON_STEP to 12
set CANNON_COLOUR to "#3ddc84"
== tools
teach: The cannon is one number: x, the middle of the cannon. Everything about it is drawn from there.
set cannon x to WIDTH / 2

define draw cannon
    description: The cannon where it is now: a body and a barrel.
    run canvas.delete with "cannon"
    set top to GROUND - 4 - CANNON_HEIGHT
    run canvas.create_rectangle with cannon x - CANNON_WIDTH / 2, top, cannon x + CANNON_WIDTH / 2, GROUND - 4, fill=CANNON_COLOUR, outline="", tags="cannon"
    run canvas.create_rectangle with cannon x - 3, top - 8, cannon x + 3, top, fill=CANNON_COLOUR, outline="", tags="cannon"

define move cannon using event
    description: Moves the cannon one step left or right, and never out of the window.
    if not playing
        give back
    if event.keysym is "Left"
        decrease cannon x by CANNON_STEP
    otherwise if event.keysym is "Right"
        increase cannon x by CANNON_STEP
    teach: min stops it going past the right edge and max past the left: together they keep x in range, with half the cannon's width to spare on each side.
    set cannon x to max(CANNON_WIDTH / 2, min(WIDTH - CANNON_WIDTH / 2, cannon x))
    run draw cannon

define reset cannon
    description: The cannon back in the middle.
    set cannon x to WIDTH / 2
    run draw cannon

teach: The cannon's own tool for a new game goes in the list.
add reset cannon to new game jobs
== main
run window.bind with "<Left>", move cannon
run window.bind with "<Right>", move cannon`,

`component: mpy-inv-shots
name: Firing
depth: walk
summary: Space fires a shot from the cannon's barrel, and every tick it climbs, until it leaves the top of the window. Like the arcade original, only one shot can be in the air at once, which makes every shot count. Each shot is a small dictionary with an x and a y, and the shots live in a list.
learn: Small dictionaries as things in a game (dict(x=…, y=…)); lists of them; removing things by making a new list (a list comprehension).
== settings
note: How far a shot climbs each tick, in pixels.
set SHOT_SPEED to 12
set SHOT_COLOUR to "#ffffff"
== tools
teach: Every shot in the air, each a small dictionary: dict(x=…, y=…) makes one with an x and a y.
create list shots

define fire using event
    description: Fires a shot from the barrel, if none is in the air.
    teach: An empty list counts as no, so "not shots" means no shot is in the air yet.
    if playing and not shots
        add dict(x=cannon x, y=GROUND - 26) to shots

define draw shots
    run canvas.delete with "shot"
    for each shot in shots
        run canvas.create_rectangle with shot["x"] - 2, shot["y"] - 10, shot["x"] + 2, shot["y"], fill=SHOT_COLOUR, outline="", tags="shot"

define move shots
    description: Moves every shot up, and forgets the ones that have left the window.
    for each shot in shots
        decrease shot["y"] by SHOT_SPEED
    teach: Removing things from a list while going through it skips some of them. Instead, this makes a new list of only the shots still on screen (a list comprehension).
    set shots to [shot for shot in shots if shot["y"] is more than 0]
    run draw shots

define reset shots
    run shots.clear
    run draw shots

add move shots to tick jobs
add reset shots to new game jobs
== main
run window.bind with "<space>", fire`,

`component: mpy-inv-swarm
name: The marching invaders
depth: walk
summary: The invaders come as a block of 5 rows by 8, made by two loops, one inside the other. They don't glide: every few ticks the whole block takes one step sideways, and their legs swap between two positions, the simplest animation there is. If any invader would cross an edge, the whole block steps down and turns round instead. That one rule makes the classic march.
learn: Loops inside loops; a grid of things from rows and columns; moving many things together; animation frames.
== settings
set INVADER_ROWS to 5
set INVADER_COLUMNS to 8
set INVADER_WIDTH to 30
set INVADER_HEIGHT to 20
note: The space between invaders, in pixels.
set GAP to 14
note: One step sideways, one step down, and how many ticks between steps.
set MARCH_STEP to 6
set DROP to 16
set MARCH_EVERY to 12
note: A colour for each row, from the top.
set ROW_COLOURS to ["#ff5c8a", "#ff9f5c", "#ffe066", "#7cf29a", "#5cd3ff"]
== tools
teach: The swarm is a list of invaders, each a dictionary with its x, its y and its row. direction is 1 for right and -1 for left, so it can be multiplied by a step.
create list invaders
set direction to 1
set march timer to 0
set march wait to MARCH_EVERY
set frame to 0

define make wave
    description: A fresh block of invaders, top left, heading right.
    run invaders.clear
    teach: Two loops, one inside the other: for each row, every column. Their numbers place each invader: x from the column, y from the row.
    repeat INVADER_ROWS times counting with row
        repeat INVADER_COLUMNS times counting with column
            add dict(x=40 + column * (INVADER_WIDTH + GAP), y=50 + row * (INVADER_HEIGHT + GAP), row=row) to invaders
    set direction to 1
    set march timer to 0
    run draw invaders

define draw invaders
    description: Every invader: a body, two eyes and two legs, which swap places with the frame.
    run canvas.delete with "invader"
    for each invader in invaders
        set x to invader["x"]
        set y to invader["y"]
        set colour to ROW_COLOURS[invader["row"]]
        run canvas.create_rectangle with x + 4, y, x + INVADER_WIDTH - 4, y + INVADER_HEIGHT - 6, fill=colour, outline="", tags="invader"
        run canvas.create_rectangle with x + 9, y + 5, x + 13, y + 9, fill=BACKGROUND, outline="", tags="invader"
        run canvas.create_rectangle with x + INVADER_WIDTH - 13, y + 5, x + INVADER_WIDTH - 9, y + 9, fill=BACKGROUND, outline="", tags="invader"
        teach: Animation is pictures that take turns. frame swaps between 0 and 1 at every step, and the legs move out and in with it.
        set spread to frame times 4
        run canvas.create_rectangle with x + spread, y + INVADER_HEIGHT - 6, x + spread + 5, y + INVADER_HEIGHT, fill=colour, outline="", tags="invader"
        run canvas.create_rectangle with x + INVADER_WIDTH - spread - 5, y + INVADER_HEIGHT - 6, x + INVADER_WIDTH - spread, y + INVADER_HEIGHT, fill=colour, outline="", tags="invader"

define march invaders
    description: Every few ticks, the whole block steps sideways, or down and back at an edge.
    teach: A timer made of a counter: it goes up every tick, and only when it reaches march wait does the block step, and start counting again.
    increase march timer
    if march timer is less than march wait
        give back
    set march timer to 0
    set frame to 1 - frame
    teach: First look, then move: if any invader's next step would cross an edge, the whole block steps down and turns round instead of sideways.
    set at edge to no
    for each invader in invaders
        set next x to invader["x"] + direction * MARCH_STEP
        if next x is less than 8 or next x + INVADER_WIDTH is more than WIDTH - 8
            set at edge to yes
    if at edge
        set direction to -direction
        for each invader in invaders
            increase invader["y"] by DROP
    otherwise
        for each invader in invaders
            increase invader["x"] by direction * MARCH_STEP
    run draw invaders

add march invaders to tick jobs
add make wave to new game jobs`,

`component: mpy-inv-hits
name: Hits and the score
depth: walk
summary: The moment a shot reaches an invader, both disappear and the score goes up: 50 points for the top row, 10 for the bottom. Whether two things touch is asked of their boxes: every thing is drawn in a rectangle (left, top, right, bottom), and two rectangles overlap unless one is entirely to the left, right, above or below the other. Nearly every 2D game checks collisions this way.
learn: Collisions as overlapping rectangles; tools that give back an answer; going through a copy of a list (list(…)) while removing from the real one.
== tools
set score to 0

define overlap using a, b
    description: Whether two rectangles overlap. Each is (left, top, right, bottom).
    teach: Two boxes overlap when each one starts before the other ends, across (left and right) and down (top and bottom). Four comparisons are the whole test.
    give back a[0] is less than b[2] and b[0] is less than a[2] and a[1] is less than b[3] and b[1] is less than a[3]

define shot box using shot
    give back (shot["x"] - 2, shot["y"] - 10, shot["x"] + 2, shot["y"])

define invader box using invader
    give back (invader["x"], invader["y"], invader["x"] + INVADER_WIDTH, invader["y"] + INVADER_HEIGHT)

define draw score
    run canvas.delete with "score"
    run canvas.create_text with 10, 10, text="Score {score}", anchor="nw", fill=TEXT_COLOUR, font=FONT, tags="score"

define check hits
    description: Removes every invader a shot has reached, with the shot, and adds the points.
    teach: list(shots) is a copy, so the tool can go through the copy while removing from the real list without skipping anything.
    for each shot in list(shots)
        for each invader in list(invaders)
            if overlap(shot box(shot), invader box(invader))
                remove shot from shots
                remove invader from invaders
                teach: Higher rows are worth more: row 0, the top, gives 50.
                increase score by (INVADER_ROWS - invader["row"]) * 10
                run draw score
                teach: This shot is used up, so there's no need to look at more invaders for it.
                stop the loop
    run draw shots
    run draw invaders

define reset score
    set score to 0
    run draw score

add check hits to tick jobs
add reset score to new game jobs`,

`component: mpy-inv-bombs
name: Their bombs, your lives, and game over
depth: walk
summary: Now the invaders fight back. Each tick there's a small chance one of them drops a bomb, and only the lowest invader in a column can, so bombs never start inside the block. A bomb that reaches the cannon costs a life; with no lives left, or if the invaders reach the ground, the game is over. Return starts a new game, which runs every new game job, so every part starts again cleanly.
learn: Chance (random numbers below a threshold); finding the lowest of several; game over as a change of state; restarting.
== settings
set BOMB_SPEED to 5
note: The chance, each tick, that a bomb drops: 0.03 is 3 in a hundred.
set BOMB_CHANCE to 0.03
set BOMB_COLOUR to "#ffd166"
set START_LIVES to 3
== tools
create list bombs
set lives to START_LIVES

define draw lives
    run canvas.delete with "lives"
    run canvas.create_text with WIDTH - 10, 10, text="Lives {lives}", anchor="ne", fill=TEXT_COLOUR, font=FONT, tags="lives"

define drop bomb
    description: Now and then, the lowest invader in a random column drops a bomb.
    teach: random decimal gives a number from 0 up to 1, so it is below 0.03 about 3 ticks in a hundred: chance, at a rate you can set.
    if not invaders or random decimal is at least BOMB_CHANCE
        give back
    set shooter to random item from invaders
    teach: Invaders in a column share their x. Of those, the one with the biggest y is the lowest, with nobody in its way.
    for each invader in invaders
        if invader["x"] is shooter["x"] and invader["y"] is more than shooter["y"]
            set shooter to invader
    add dict(x=shooter["x"] + INVADER_WIDTH / 2, y=shooter["y"] + INVADER_HEIGHT) to bombs

define bomb box using bomb
    give back (bomb["x"] - 2, bomb["y"] - 8, bomb["x"] + 2, bomb["y"])

define cannon box
    give back (cannon x - CANNON_WIDTH / 2, GROUND - 4 - CANNON_HEIGHT, cannon x + CANNON_WIDTH / 2, GROUND - 4)

define draw bombs
    run canvas.delete with "bomb"
    for each bomb in bombs
        run canvas.create_rectangle with bomb["x"] - 2, bomb["y"] - 8, bomb["x"] + 2, bomb["y"], fill=BOMB_COLOUR, outline="", tags="bomb"

define move bombs
    description: Bombs fall; one that reaches the ground is gone, one that reaches the cannon costs a life.
    for each bomb in bombs
        increase bomb["y"] by BOMB_SPEED
    set bombs to [bomb for bomb in bombs if bomb["y"] is less than GROUND]
    teach: The same overlap test as the shots, with the cannon's box this time.
    for each bomb in list(bombs)
        if overlap(bomb box(bomb), cannon box())
            remove bomb from bombs
            run lose life
    run draw bombs

define lose life
    decrease lives
    run draw lives
    if lives is at most 0
        run game over

define check landing
    description: If any invader reaches the cannon's height, the invasion has landed.
    for each invader in invaders
        if invader["y"] + INVADER_HEIGHT is at least GROUND - 4 - CANNON_HEIGHT
            run game over
            give back

define game over
    description: Stops the game and says how to play again.
    teach: Game over is a change of state: playing becomes no, the tick stops running the jobs, and everything stays where it was, on screen.
    if not playing
        give back
    set playing to no
    run canvas.create_text with WIDTH / 2, HEIGHT / 2, text="GAME OVER\\nPress Return to play again", justify="center", fill=TEXT_COLOUR, font=FONT, tags="message"

define restart using event
    description: A new game, if this one is over.
    teach: new game runs every part's own reset, from every step, so starting again forgets nothing.
    if not playing
        run canvas.delete with "message"
        run new game

define reset bombs
    run bombs.clear
    run draw bombs
    set lives to START_LIVES
    run draw lives

add drop bomb to tick jobs
add move bombs to tick jobs
add check landing to tick jobs
add reset bombs to new game jobs
== main
run window.bind with "<Return>", restart`,

`component: mpy-inv-waves
name: Waves
depth: walk
summary: Clearing the screen isn't the end: a new wave marches in, a row lower each time (up to four rows lower), so each wave has less room before it lands. The wave number shows at the top. This step adds a job to the tick and one to a new game, and nothing before it changes.
learn: Levels as a number that changes the game; min, to put a ceiling on a number.
== tools
set wave to 1

define draw wave
    run canvas.delete with "wave"
    run canvas.create_text with WIDTH / 2, 10, text="Wave {wave}", anchor="n", fill=TEXT_COLOUR, font=FONT, tags="wave"

define next wave
    description: When every invader is gone, a new wave comes, starting lower each time.
    if not invaders
        increase wave
        run make wave
        teach: min puts a ceiling on the number: each wave starts one step lower, but never more than four.
        set extra to min(wave - 1, 4) * DROP
        for each invader in invaders
            increase invader["y"] by extra
        run draw invaders
        run draw wave

define reset waves
    set wave to 1
    run draw wave

add next wave to tick jobs
add reset waves to new game jobs`,

`component: mpy-inv-faster
name: Your turn: faster as fewer remain
depth: hallway
summary: The arcade original sped up as you cleared the screen (at first by accident: fewer invaders to draw meant the machine drew them faster), and it's what makes the last invader frantic. Here the wait between steps is shared out by how many are left: all 40 wait 13 ticks, the last one only 1. It's a tick job like the others. You write the formula.
learn: A formula from the game's state; whole-number division (//).
== tools
define hurry
    description: The fewer invaders are left, the fewer ticks between their steps.
    teach: The wait is worked out again every tick from how many are left, so a new wave is slow again by itself.
    set march wait to ‹one tick, plus a share of MARCH_EVERY for each one left: 1 + MARCH_EVERY * length of invaders // (INVADER_ROWS * INVADER_COLUMNS)›

add hurry to tick jobs`,

// ---------------------------------------------------------------- 3 · Invaders under a night sky

`kit: nightsky-py
title: Invaders under a night sky
layout: structured
shelf: modules
platform: pc
module: 3 · Invaders under a night sky
version: Python window
annotated: no
about: The third module: the Invaders game from module 2, now under a night sky. A sky that shades from deep blue to violet, stars in two layers that twinkle and drift at different speeds, a moon, and hills along the ground. The lesson is drawing order: the background goes at the back and the game on top, in layers. tkinter windows open in the desktop app; the Python in the browser has no windows.
steps: mpy-inv-stage!, mpy-inv-cannon!, mpy-inv-shots!, mpy-inv-swarm!, mpy-inv-hits!, mpy-inv-bombs!, mpy-inv-waves!, mpy-sky-gradient!, mpy-sky-stars!, mpy-sky-moon!, mpy-start!, mpy-sky-shooting*, mpy-pygame, mpy-art-sound`,

`kit: nightsky-py-notes
title: Invaders under a night sky, annotated
layout: structured
shelf: modules
platform: pc
module: 3 · Invaders under a night sky
version: Python window · annotated
annotated: yes
about: The third module, with notes: the Invaders game under a night sky, where every part says what it adds and why. A shaded sky, twinkling stars in two layers drifting at different speeds, a moon and hills, all kept behind the game with layers. tkinter windows open in the desktop app; the Python in the browser has no windows.
steps: mpy-inv-stage!, mpy-inv-cannon!, mpy-inv-shots!, mpy-inv-swarm!, mpy-inv-hits!, mpy-inv-bombs!, mpy-inv-waves!, mpy-sky-gradient!, mpy-sky-stars!, mpy-sky-moon!, mpy-start!, mpy-sky-shooting*, mpy-pygame, mpy-art-sound`,

`component: mpy-sky-gradient
name: A sky in bands of colour
depth: walk
summary: The first thing to learn about backgrounds is that a canvas is a pile: everything drawn goes on top of what's there. The game's things are already on the canvas when the sky is drawn, so the sky would cover them. tag_lower moves a whole layer (everything with one tag) to the bottom of the pile. The sky itself is a gradient: 24 thin bands, each colour mixed a little further from the top colour to the bottom one.
learn: Drawing order (later is on top); tags as layers; tag_lower; colours as three numbers, and mixing them; hex codes.
== settings
note: The sky's colour at the top and directly above the ground: red, green and blue, from 0 to 255.
set SKY_TOP to (6, 8, 28)
set SKY_BOTTOM to (52, 36, 92)
note: How many bands make the gradient.
set BANDS to 24
== tools
define mix using a, b, amount
    description: A colour part way from a to b (amount 0 is all a, 1 is all b), as a hex code like "#1a2b3c".
    teach: A colour on screen is three numbers: red, green and blue light. Mixing two colours means mixing each number on its own, part way from one to the other.
    set red to round(a[0] + (b[0] - a[0]) * amount)
    set green to round(a[1] + (b[1] - a[1]) * amount)
    set blue to round(a[2] + (b[2] - a[2]) * amount)
    teach: :02x writes a number as two hex digits (0 to ff), the way colour codes need them.
    give back "#{red:02x}{green:02x}{blue:02x}"

define draw sky
    description: The sky from the top of the window to the ground, in bands, darkest at the top.
    teach: A gradient is many thin bands, each a little lighter than the one above. With enough of them the eye sees one smooth sky.
    set band height to GROUND / BANDS
    repeat BANDS times counting with band
        set colour to mix(SKY_TOP, SKY_BOTTOM, band / (BANDS - 1))
        run canvas.create_rectangle with 0, band * band height, WIDTH, (band + 1) * band height + 1, fill=colour, outline="", tags=("sky", "background")
    teach: Drawn last means drawn on top: these bands came after the cannon, the invaders and the ground, and would hide them. tag_lower sends everything tagged "sky" to the bottom of the pile, behind everything else.
    run canvas.tag_lower with "sky"
== main
teach: The game is already on the canvas. The background comes now, and puts itself behind it.
run draw sky`,

`component: mpy-sky-stars
name: Twinkling stars, in two layers
depth: walk
summary: Stars in two layers: 50 far ones, small, dim and slow, and 20 near ones, bigger, brighter and faster, all drifting down and coming back at the top. Things far away seem to move slower than things close by, as from a train window: that's parallax, and two speeds are enough to give a flat sky depth. Now and then a star dims or shines again, which is twinkling. The stars are drawn once and then moved (coords) and recoloured (itemconfig), which keeps their place in the pile; tag_raise puts their layer directly above the sky.
learn: Parallax; moving drawn things with coords; changing them with itemconfig; tag_raise relative to another layer; wrapping round (back to the top).
== settings
note: Far stars: many, small and slow. Near stars: fewer, bigger and faster.
set FAR_STARS to 50
set NEAR_STARS to 20
set FAR_SPEED to 0.2
set NEAR_SPEED to 0.6
set FAR_COLOUR to "#7f8bb5"
set NEAR_COLOUR to "#e6ecff"
set DIM_COLOUR to "#3a4170"
== tools
teach: Every star, each a dictionary: where it is, its size and speed (its layer), its colour, whether it's lit, and dot, the canvas item that shows it.
create list stars

define make star using size, speed, colour
    description: One star at a random place, drawn, and remembered in the list.
    set x to random number from 0 to WIDTH
    set y to random number from 0 to GROUND
    teach: create_oval gives back the new item's number. Keeping it lets the star be moved and recoloured later, instead of drawn again.
    set dot to canvas.create_oval(x, y, x + size, y + size, fill=colour, outline="", tags=("stars", "background"))
    add dict(x=x, y=y, size=size, speed=speed, colour=colour, lit=yes, dot=dot) to stars

define make stars
    description: Both layers of stars, directly above the sky.
    repeat FAR_STARS times
        run make star with 1, FAR_SPEED, FAR_COLOUR
    repeat NEAR_STARS times
        run make star with 2, NEAR_SPEED, NEAR_COLOUR
    teach: tag_raise with a second tag puts a layer directly above that one: the stars go right on top of the sky, still behind everything else.
    run canvas.tag_raise with "stars", "sky"

define drift stars
    description: Every star drifts down at its layer's speed, back to the top at the ground; now and then one twinkles.
    teach: Parallax: the near stars move three times as fast as the far ones, the way near things race past a train window and far ones crawl.
    for each star in stars
        increase star["y"] by star["speed"]
        teach: A star that reaches the ground wraps round to the top, so the sky never runs out.
        if star["y"] is more than GROUND
            decrease star["y"] by GROUND
        run canvas.coords with star["dot"], star["x"], star["y"], star["x"] + star["size"], star["y"] + star["size"]
    teach: Twinkling: about one tick in three, a star picked at random dims, or shines again. itemconfig changes how something already drawn looks, without moving it in the pile.
    if random decimal is less than 0.3
        set twinkle to random item from stars
        set item "lit" of twinkle to not twinkle["lit"]
        if twinkle["lit"]
            run canvas.itemconfig with twinkle["dot"], fill=twinkle["colour"]
        otherwise
            run canvas.itemconfig with twinkle["dot"], fill=DIM_COLOUR

add drift stars to tick jobs
== main
run make stars`,

`component: mpy-sky-moon
name: The moon and the hills
depth: walk
summary: The last layers: a moon with a soft halo, and two ranges of hills along the ground, the far ones paler and the near ones darker. Things further away look paler because of the air between, the oldest trick for depth in painting. The hills are polygons whose outline comes from a sine wave, smoothed into curves. Each layer is raised directly above the one before it, so the pile is: sky, stars, moon, hills, and then the game.
learn: Polygons from a list of points; a sine wave for gentle curves; layers in order; colour for distance.
== settings
set MOON_COLOUR to "#f3efd9"
set HALO_COLOUR to "#2b2d5c"
set CRATER_COLOUR to "#ddd6b8"
set FAR_HILLS to "#241f4a"
set NEAR_HILLS to "#120f29"
== tools
define draw moon
    description: A moon with a soft halo and two craters, high on the right.
    teach: The halo is a bigger circle in a colour between the sky and the moon, drawn first so the moon sits on it.
    run canvas.create_oval with 322, 34, 406, 118, fill=HALO_COLOUR, outline="", tags=("moon", "background")
    run canvas.create_oval with 340, 52, 388, 100, fill=MOON_COLOUR, outline="", tags=("moon", "background")
    run canvas.create_oval with 352, 62, 362, 72, fill=CRATER_COLOUR, outline="", tags=("moon", "background")
    run canvas.create_oval with 368, 78, 376, 86, fill=CRATER_COLOUR, outline="", tags=("moon", "background")
    run canvas.tag_raise with "moon", "stars"

define hill points using base, rise, wavelength, shift
    description: The outline of a range of hills, as x, y numbers for a polygon, closed along the ground.
    teach: math.sin goes smoothly up and down between -1 and 1, so it makes gentle hills. wavelength stretches them, shift slides them sideways, rise sets how tall.
    create list points with 0, GROUND
    count x from 0 to WIDTH by 20
        add x to points
        add base - rise * (1 + math.sin(x / wavelength + shift)) / 2 to points
    add WIDTH to points
    add GROUND to points
    give back points

define draw hills
    description: Two ranges of hills, and the ground below them.
    teach: Far hills are paler and higher up, near hills darker and lower: colour and height together say which is further away.
    run canvas.create_polygon with hill points(GROUND - 30, 80, 55, 0), fill=FAR_HILLS, outline="", smooth=yes, tags=("hills", "background")
    run canvas.create_polygon with hill points(GROUND - 4, 46, 33, 2), fill=NEAR_HILLS, outline="", smooth=yes, tags=("hills", "background")
    run canvas.create_rectangle with 0, GROUND, WIDTH, HEIGHT, fill=NEAR_HILLS, outline="", tags=("hills", "background")
    teach: Each layer goes directly above the one before it. The pile, from the back: sky, stars, moon, hills, and then the game.
    run canvas.tag_raise with "hills", "moon"
== main
run draw moon
run draw hills`,

`component: mpy-sky-shooting
name: Your turn: a shooting star now and then
depth: hallway
summary: Now and then a shooting star streaks across the sky and burns out. It's made during the game, long after the background, so it would land on top of the pile, in front of the invaders, unless it's put in its layer. You choose the layer it goes directly above, and write when it has burnt out.
learn: Things made during the game, and their layer; a thing with a lifetime (a countdown); nothing (None) for "there isn't one".
== settings
note: The chance, each tick, that a shooting star starts.
set SHOOTING_CHANCE to 0.01
== tools
teach: The shooting star in the sky, or nothing when there isn't one.
set shooting to nothing

define shooting star
    description: Sometimes starts a shooting star; moves the one in the sky, and lets it burn out.
    if shooting is nothing
        if random decimal is less than SHOOTING_CHANCE
            set shooting to dict(x=random number from 20 to 240, y=random number from 10 to 140, life=24)
        give back
    increase shooting["x"] by 9
    increase shooting["y"] by 3
    decrease shooting["life"]
    run canvas.delete with "shooting"
    teach: Its life counts down each tick; at the end it's gone, and there's nothing in the sky again.
    if ‹it has burnt out: shooting["life"] is at most 0›
        set shooting to nothing
        give back
    run canvas.create_line with shooting["x"], shooting["y"], shooting["x"] - 36, shooting["y"] - 12, fill="#ffffff", width=2, tags=("shooting", "background")
    teach: Made now, it lands on top of the pile, in front of the game. tag_raise puts it in its place: directly above the stars.
    run canvas.tag_raise with "shooting", ‹the layer it goes directly above: "stars"›

add shooting star to tick jobs`,

// ---------------------------------------------------------------- 4 · Jacques & Louis G.

`kit: brothers-py
title: Jacques & Louis G.
layout: structured
shelf: modules
platform: pc
module: 4 · Jacques & Louis G.
version: Python window
annotated: no
about: The fourth module: a side-scrolling platformer in a tkinter window. The power is out in the street, and two electrician brothers set off to fix it: Jacques jumps higher, Louis G. runs faster, and you switch between them. A level written as rows of text, gravity, jumping and landing, a camera that follows, sparks to collect, loose wires and power surges to avoid, and the fuse box at the end, which turns the street lights on. tkinter windows open in the desktop app; the Python in the browser has no windows.
steps: mpy-bro-stage!, mpy-bro-level!, mpy-bro-hero!, mpy-bro-gravity!, mpy-bro-jump!, mpy-bro-switch!, mpy-bro-camera!, mpy-bro-sparks!, mpy-bro-hazards!, mpy-bro-power!, mpy-start!, mpy-bro-timer*, mpy-levels, mpy-art-sound`,

`kit: brothers-py-notes
title: Jacques & Louis G., annotated
layout: structured
shelf: modules
platform: pc
module: 4 · Jacques & Louis G.
version: Python window · annotated
annotated: yes
about: The fourth module, with notes: a side-scrolling platformer where every part says what it adds and why. Two electrician brothers (Jacques jumps higher, Louis G. runs faster), a level of text rows, gravity, a camera, sparks, hazards, and a fuse box that turns the street lights back on. tkinter windows open in the desktop app; the Python in the browser has no windows.
steps: mpy-bro-stage!, mpy-bro-level!, mpy-bro-hero!, mpy-bro-gravity!, mpy-bro-jump!, mpy-bro-switch!, mpy-bro-camera!, mpy-bro-sparks!, mpy-bro-hazards!, mpy-bro-power!, mpy-start!, mpy-bro-timer*, mpy-levels, mpy-art-sound`,

`component: mpy-bro-stage
name: The street at night, and the game loop
depth: walk
summary: The window, dark because the power is out, and the game loop, now in two halves. Every tick, first everything moves and is checked (the tick jobs), then everything that moves is drawn where it ended up (the draw jobs): update, then draw, the way game engines do it, so nothing is ever drawn half a step behind. New game jobs set every part up for a new game, as in Invaders.
learn: The game loop's two halves (update and draw); lists of tools; state.
== settings
teach: The window shows 20 tiles across and 12 down, each TILE pixels square. The level is wider than the window; a later step makes the view follow the brothers.
set TILE to 32
set WIDTH to 640
set HEIGHT to 384
note: How long a tick lasts, in milliseconds: 40 a second.
set TICK to 25
set NIGHT to "#0b1026"
set TEXT_COLOUR to "#f1f3f8"
set FONT to ("Helvetica", 13, "bold")
== tools
python: import tkinter as tk
set window to tk.Tk()
run window.title with "Jacques & Louis G."
run window.resizable with no, no
set canvas to tk.Canvas(window, width=WIDTH, height=HEIGHT, background=NIGHT, highlightthickness=0)
run canvas.pack

set playing to no
teach: Three lists of tools: what happens each tick, what is drawn each tick (after everything has moved), and how each part starts a new game.
create list tick jobs
create list draw jobs
create list new game jobs

define new game
    description: Sets every part up for a new game, then starts it.
    for each job in new game jobs
        run job
    set playing to yes

define tick
    description: One tick: everything moves and is checked, then everything is drawn, then tkinter runs tick again.
    if playing
        for each job in tick jobs
            run job
        teach: Drawing comes after all the moving, so the picture always shows where things ended up this tick.
        for each job in draw jobs
            run job
    run window.after with TICK, tick
== main
run new game
run window.after with TICK, tick`,

`component: mpy-bro-level
name: A level written as text
depth: walk
summary: The level is a map in text: one row of letters for each row of tiles, top to bottom. # is brick, = a girder, * a spark, ~ a loose wire, Z a power surge, L a street lamp, F the fuse box and S where the brothers start. Change a letter and the level changes; it's how many classic games stored their levels. tile at reads the map at a column and a row, and solid at answers the question the whole game keeps asking: is this point in the world inside a brick or a girder? Everything in the world is drawn at its place minus camera x, which is 0 for now.
learn: Lists of text as a map; turning pixels into columns and rows (// TILE); world positions and screen positions; enumerate.
== settings
note: The map, top to bottom: # brick, = girder, * spark, ~ loose wire, Z power surge, L street lamp, F fuse box, S start.
create list LEVEL
add "................................................................" to LEVEL
add "................................................................" to LEVEL
add "................................................................" to LEVEL
add "................................................................" to LEVEL
add "................................................................" to LEVEL
add "...........................Z.**................................." to LEVEL
add "..........**..........*....====................**..............." to LEVEL
add ".........====.........##..............*.......====.............." to LEVEL
add "......................##..............................#........." to LEVEL
add "..S..*.*L......~~...L.##........L...........L.....Z~..#..*.L.F.." to LEVEL
add "####################################.....#######################" to LEVEL
add "####################################.....#######################" to LEVEL
set ROWS to length of LEVEL
set LEVEL_WIDTH to length of LEVEL[0] * TILE
note: The letters you can stand on.
create list SOLID with "#", "="
set BRICK to "#7a3b2e"
set BRICK_LINE to "#4a1f17"
set GIRDER to "#5c677d"
== tools
teach: The camera: how far the view has scrolled to the right, in pixels. It stays 0 until the camera step makes it follow.
set camera x to 0

define tile at using column, row
    description: The letter of the map at a column and a row. Outside the map: brick at the sides, empty above and below.
    if column is less than 0 or column is at least length of LEVEL[0]
        give back "#"
    if row is less than 0 or row is at least ROWS
        give back "."
    give back LEVEL[row][column]

define solid at using x, y
    description: Whether the point (x, y) in the world is inside a brick or a girder.
    teach: Pixels to tiles: x // TILE is the column the point is in (// divides and drops what's left over), y // TILE the row.
    give back tile at(int(x // TILE), int(y // TILE)) is in SOLID

define places of using letter
    description: Every (column, row) in the map where this letter is.
    create list found
    teach: enumerate gives each row's number along with the row itself, and each letter's column along with the letter.
    for each row, line in enumerate(LEVEL)
        for each column, here in enumerate(line)
            if here is letter
                add (column, row) to found
    give back found

define draw level
    description: Every brick and girder, where the camera sees it, tagged "world".
    teach: Everything that belongs to the world is tagged "world", so the camera can move it all with one line later.
    for each column, row in places of("#")
        set x to column * TILE - camera x
        set y to row * TILE
        run canvas.create_rectangle with x, y, x + TILE, y + TILE, fill=BRICK, outline=BRICK_LINE, tags="world"
    for each column, row in places of("=")
        set x to column * TILE - camera x
        set y to row * TILE
        run canvas.create_rectangle with x, y, x + TILE, y + TILE, fill=GIRDER, outline=BRICK_LINE, tags="world"
        run canvas.create_line with x, y + TILE, x + TILE / 2, y, x + TILE, y + TILE, fill=BRICK_LINE, width=2, tags="world"
== main
run draw level`,

`component: mpy-bro-hero
name: Jacques, and keys held down
depth: walk
summary: Jacques appears at S, in his hard hat, and the arrow keys run him left and right, smoothly, for as long as they're held. tkinter only says when a key goes down and when it comes up, so the game keeps its own set of the keys that are down and asks it every tick. Running into a brick stops him at its edge: he moves, and if he's ended up inside a wall, he's put back against it. He floats in the air for now; gravity comes next.
learn: Key presses and releases (<KeyPress>, <KeyRelease>); a set; moving, then fixing what overlaps; drawing a character from rectangles.
== settings
note: Jacques: his name, how fast he runs and how hard he jumps (pixels a tick), and his colours.
set JACQUES to dict(name="Jacques", run=3, jump=12, hat="#ffd23f", jacket="#2a9d8f")
set HERO_WIDTH to 20
set HERO_HEIGHT to 30
set SKIN to "#f1c27d"
set TROUSERS to "#2b2d42"
== tools
teach: held is a set: a collection with no order and no repeats, quick to ask "is this in it?". It holds the names of the keys that are down right now.
set held to set()
set hero to JACQUES
teach: Where he is in the world: the top-left corner of his box, in pixels. facing is 1 for right and -1 for left.
set player x to 0
set player y to 0
set facing to 1

define key down using event
    description: Remembers that a key is down.
    teach: tkinter says when a key goes down and when it comes up, but not that it is still held. So the game keeps its own set: a key goes in when pressed and comes out when released, and every tick can ask "is Right in the set?".
    run held.add with event.keysym

define key up using event
    description: Forgets a key once it's released.
    run held.discard with event.keysym

define hero box
    description: His box in the world: (left, top, right, bottom).
    give back (player x, player y, player x + HERO_WIDTH, player y + HERO_HEIGHT)

define wall at using edge
    description: Whether a brick is at this x anywhere from his head to his feet.
    give back solid at(edge, player y) or solid at(edge, player y + HERO_HEIGHT / 2) or solid at(edge, player y + HERO_HEIGHT - 1)

define move across
    description: Runs left or right while an arrow is held, and stops at walls.
    set step to 0
    if "Left" is in held
        decrease step by hero["run"]
    if "Right" is in held
        increase step by hero["run"]
    if step is 0
        give back
    set facing to 1 if step is more than 0 otherwise -1
    increase player x by step
    teach: Move first, then fix: if his front edge has ended up inside a wall, he goes back to stand against it. A wall's column times TILE is where its left side is.
    if step is more than 0 and wall at(player x + HERO_WIDTH - 1)
        set player x to (player x + HERO_WIDTH - 1) // TILE * TILE - HERO_WIDTH
    if step is less than 0 and wall at(player x)
        set player x to (player x // TILE + 1) * TILE

define draw hero
    description: The brother where he is: trousers, a work jacket, a head and a hard hat.
    run canvas.delete with "hero"
    teach: On screen, he is at his place in the world minus how far the view has scrolled (camera x).
    set left to player x - camera x
    set top to player y
    run canvas.create_rectangle with left + 4, top + 22, left + HERO_WIDTH - 4, top + HERO_HEIGHT, fill=TROUSERS, outline="", tags="hero"
    run canvas.create_rectangle with left + 2, top + 11, left + HERO_WIDTH - 2, top + 23, fill=hero["jacket"], outline="", tags="hero"
    run canvas.create_oval with left + 5, top + 3, left + HERO_WIDTH - 5, top + 14, fill=SKIN, outline="", tags="hero"
    teach: facing is 1 or -1, so one sum puts his eye on the side he's heading.
    run canvas.create_rectangle with left + 9 + facing * 3, top + 7, left + 11 + facing * 3, top + 9, fill="#1b1b1b", outline="", tags="hero"
    run canvas.create_arc with left + 3, top - 2, left + HERO_WIDTH - 3, top + 12, start=0, extent=180, fill=hero["hat"], outline="", tags="hero"

define reset hero
    description: Back at S on the map, with no keys held.
    set start to first item of places of("S")
    set player x to start[0] * TILE + (TILE - HERO_WIDTH) / 2
    set player y to (start[1] + 1) * TILE - HERO_HEIGHT
    run held.clear

add move across to tick jobs
add draw hero to draw jobs
add reset hero to new game jobs
== main
teach: Every key press and release, whichever key, goes to these two tools.
run window.bind with "<KeyPress>", key down
run window.bind with "<KeyRelease>", key up`,

`component: mpy-bro-gravity
name: Gravity and landing
depth: walk
summary: Gravity isn't a position, it's a change of speed: every tick the speed downwards grows a little, and the position changes by the speed, so a fall starts slow and gets faster, the way real things fall. When there's something solid right under his feet, he has landed: he's put exactly on top of the tile and his speed goes to 0. Going up into a girder bumps his head the same way. on ground says whether he's standing, which the jump needs.
learn: Speed and acceleration (gravity as speed changing every tick); a top speed; landing as fixing an overlap; flags (yes or no).
== settings
note: How much faster he falls each tick, and the fastest he can fall.
set GRAVITY to 0.6
set MAX_FALL to 12
== tools
teach: speed y is how far he moves down each tick (up when it's negative).
set speed y to 0
set on ground to no

define feet on solid
    description: Whether there's a brick or a girder right under either of his feet.
    teach: player y + HERO_HEIGHT is the first row of pixels below him. Looking there, rather than at his own feet, means he counts as standing every tick, not only on the ticks when gravity has pushed him into the floor.
    give back solid at(player x + 2, player y + HERO_HEIGHT) or solid at(player x + HERO_WIDTH - 3, player y + HERO_HEIGHT)

define head in solid
    description: Whether the top of his hard hat is inside a brick or a girder.
    give back solid at(player x + 2, player y) or solid at(player x + HERO_WIDTH - 3, player y)

define fall
    description: Gravity: falling faster every tick, landing on what's solid, bumping into what's above.
    teach: Gravity changes the speed, and the speed changes the position. Adding a little to the speed every tick makes a fall start slowly and get faster, as real falls do.
    increase speed y by GRAVITY
    set speed y to min(speed y, MAX_FALL)
    increase player y by speed y
    set on ground to no
    if speed y is more than 0 and feet on solid()
        teach: Landing: there's something solid under his feet, so he goes to stand exactly on top of that tile, and stops falling.
        set player y to (player y + HERO_HEIGHT) // TILE * TILE - HERO_HEIGHT
        set speed y to 0
        set on ground to yes
    otherwise if speed y is less than 0 and head in solid()
        set player y to (player y // TILE + 1) * TILE
        set speed y to 0

define stop falling
    set speed y to 0

add fall to tick jobs
add stop falling to new game jobs`,

`component: mpy-bro-jump
name: Jumping
depth: walk
summary: A jump is only a speed: the moment he leaves the ground his speed upwards is set high, and gravity does the rest, slowing him, stopping him at the top and bringing him down in a curve. He can only jump from the ground (otherwise he could climb the sky). Up or space jumps; holding it jumps again on landing.
learn: Why a jump makes a curve (a parabola); conditions with and; negative numbers for up.
== tools
define jump
    description: If he's on the ground and Up or space is held, he leaves it with a speed upwards.
    teach: A jump only sets a speed. Up is negative y, so the speed is minus the brother's jump; gravity takes a little off it every tick, and the top of the jump is where it reaches 0.
    if on ground and ("Up" is in held or "space" is in held)
        set speed y to -hero["jump"]
        set on ground to no

add jump to tick jobs`,

`component: mpy-bro-switch
name: Two brothers
depth: walk
summary: Louis G. joins: S switches between the brothers. Jacques jumps higher and Louis G. runs faster, and the level needs both: a wall only Jacques can jump, a gap only Louis G. can clear. Each brother is a dictionary with the same keys (name, run, jump, colours), and every tool reads hero["run"] or hero["jump"], so switching is one line: hero becomes the other dictionary.
learn: Data instead of code (the brothers as dictionaries); one variable pointing at one of several things; binding one key.
== settings
note: Louis G.: he runs faster and jumps lower.
set LOUIS_G to dict(name="Louis G.", run=5, jump=10, hat="#ff8c42", jacket="#3d5a80")
== tools
define draw name
    run canvas.delete with "name"
    run canvas.create_text with 10, 8, text="{hero['name']}  (S to switch)", anchor="nw", fill=TEXT_COLOUR, font=FONT, tags="name"

define switch brother using event
    description: Switches between Jacques and Louis G.
    teach: The two brothers are dictionaries with the same keys. Every tool asks hero for its numbers and colours, so making hero the other dictionary changes how he runs, jumps and looks, with nothing else to change.
    if hero is JACQUES
        set hero to LOUIS_G
    otherwise
        set hero to JACQUES
    run draw name

define reset brother
    set hero to JACQUES
    run draw name

add reset brother to new game jobs
== main
teach: A key with a binding of its own goes to that tool rather than to key down.
run window.bind with "<s>", switch brother
run window.bind with "<S>", switch brother`,

`component: mpy-bro-camera
name: A camera that follows
depth: walk
summary: The level is three times wider than the window, so the view follows the brothers. A camera is an offset: everything is drawn at its place in the world minus camera x, so when the camera moves right, the world slides left. The camera keeps the hero a third of the way across, and stops at the level's ends so nothing outside it shows. The world was drawn once, tagged "world"; canvas.move slides every piece of it in one line, by however far the camera moved.
learn: Cameras as offsets; world and screen positions; keeping a number between two limits; moving many canvas items by tag.
== tools
define follow
    description: Moves the camera so the hero stays a third of the way across, without showing past either end of the level.
    teach: Where the camera should be: the hero's place minus a third of the window, so he has room to see ahead. max and min keep it from showing past the start or the end of the level.
    set target to player x - WIDTH / 3
    set target to max(0, min(target, LEVEL_WIDTH - WIDTH))
    teach: The camera moves right, so the world moves left by the same amount: canvas.move shifts everything tagged "world" at once.
    run canvas.move with "world", camera x - target, 0
    set camera x to target

define reset camera
    description: The camera back at the start of the level.
    run canvas.move with "world", camera x, 0
    set camera x to 0

add follow to tick jobs
add reset camera to new game jobs`,

`component: mpy-bro-sparks
name: Sparks to collect
depth: walk
summary: Sparks hang along the street, some on girders, one over the gap and one on top of the high wall. Touching one collects it: it's taken out of the list and off the canvas, and the count goes up. Touching means the boxes overlap, the same test as in Invaders. A new game puts every spark back, from the map.
learn: Collecting (removing from a list and from the canvas); deleting one canvas item by its number; overlapping boxes again.
== settings
set SPARK_COLOUR to "#7df9ff"
== tools
create list sparks
set collected to 0

define overlap using a, b
    description: Whether two boxes overlap. Each is (left, top, right, bottom).
    give back a[0] is less than b[2] and b[0] is less than a[2] and a[1] is less than b[3] and b[1] is less than a[3]

define draw collected
    run canvas.delete with "collected"
    run canvas.create_text with WIDTH / 2, 8, text="Sparks {collected}", anchor="n", fill=TEXT_COLOUR, font=FONT, tags="collected"

define place sparks
    description: Every spark from the map: drawn in the world, and remembered with its canvas item.
    run canvas.delete with "spark"
    run sparks.clear
    for each column, row in places of("*")
        set x to column * TILE + TILE / 2
        set y to row * TILE + TILE / 2
        set dot to canvas.create_polygon(x - camera x, y - 9, x - camera x + 6, y, x - camera x, y + 9, x - camera x - 6, y, fill=SPARK_COLOUR, outline="", tags=("world", "spark"))
        add dict(x=x, y=y, dot=dot) to sparks
    set collected to 0
    run draw collected

define collect sparks
    description: Collects every spark the hero is touching.
    for each spark in list(sparks)
        if overlap(hero box(), (spark["x"] - 8, spark["y"] - 8, spark["x"] + 8, spark["y"] + 8))
            teach: Collected: out of the list, so it can't be collected twice, and off the canvas, by its item number.
            remove spark from sparks
            run canvas.delete with spark["dot"]
            increase collected
            run draw collected

add collect sparks to tick jobs
add place sparks to new game jobs`,

`component: mpy-bro-hazards
name: Loose wires, power surges, and lives
depth: walk
summary: Three ways to lose a life: touching a loose wire, being caught by a power surge, or falling down the gap and out of the level. A surge patrols back and forth, turning round at a wall or where its floor ends, so it never falls. Losing a life puts the brother back at the start; with no lives left the game is over, and Return starts a new one.
learn: Things that move on their own (a patrol); looking ahead before moving; falling out of the world; lives and game over.
== settings
set START_LIVES to 3
set SURGE_SPEED to 1.5
set SURGE_COLOUR to "#c77dff"
set WIRE_COLOUR to "#ff595e"
== tools
set lives to START_LIVES
create list surges
set wire places to places of("~")

define draw wires
    description: Every loose wire on the map: a red zigzag along the ground.
    for each column, row in wire places
        set x to column * TILE - camera x
        set y to (row + 1) * TILE - 4
        run canvas.create_line with x + 2, y, x + 9, y - 8, x + 16, y, x + 23, y - 8, x + 30, y, fill=WIRE_COLOUR, width=3, tags="world"

define wire box using place
    description: The low box along the ground where a wire's tile can catch you.
    give back (place[0] * TILE + 2, (place[1] + 1) * TILE - 12, (place[0] + 1) * TILE - 2, (place[1] + 1) * TILE)

define make surges
    description: A surge at every Z on the map, heading right.
    run surges.clear
    for each column, row in places of("Z")
        add dict(x=column * TILE + TILE / 2, y=row * TILE + TILE / 2, direction=1) to surges

define move surges
    description: Every surge moves along, turning round at a wall or where its floor ends.
    for each surge in surges
        set ahead to surge["x"] + surge["direction"] * 10
        teach: Look before moving: if the point a little ahead is in a wall, or there's no floor under it, the surge turns round instead.
        if solid at(ahead, surge["y"]) or not solid at(ahead, surge["y"] + TILE)
            set item "direction" of surge to -surge["direction"]
        otherwise
            increase surge["x"] by surge["direction"] * SURGE_SPEED

define surge box using surge
    give back (surge["x"] - 9, surge["y"] - 9, surge["x"] + 9, surge["y"] + 9)

define draw surges
    description: Every surge: a crackling ball that changes size a little every tick.
    run canvas.delete with "surge"
    for each surge in surges
        set x to surge["x"] - camera x
        set y to surge["y"]
        set size to random number from 7 to 10
        run canvas.create_oval with x - size, y - size, x + size, y + size, fill=SURGE_COLOUR, outline="#ffffff", tags="surge"

define draw lives
    run canvas.delete with "lives"
    run canvas.create_text with WIDTH - 10, 8, text="Lives {lives}", anchor="ne", fill=TEXT_COLOUR, font=FONT, tags="lives"

define check hazards
    description: Loses a life for falling out of the level, touching a loose wire or being caught by a surge.
    teach: Below the last row there is nothing to land on: once his top is past the bottom of the level, he has fallen out.
    if player y is more than ROWS * TILE
        run lose life
        give back
    for each place in wire places
        if overlap(hero box(), wire box(place))
            run lose life
            give back
    for each surge in surges
        if overlap(hero box(), surge box(surge))
            run lose life
            give back

define lose life
    description: One life fewer: back to the start, or game over if none are left.
    decrease lives
    run draw lives
    if lives is at most 0
        run game over
    otherwise
        run reset hero
        run reset camera
        set speed y to 0

define game over
    description: Stops the game and says how to play again.
    if not playing
        give back
    set playing to no
    run canvas.create_text with WIDTH / 2, HEIGHT / 2, text="Out of lives. Press Return to try again.", fill=TEXT_COLOUR, font=FONT, tags="message"

define restart using event
    description: A new game, once this one has ended.
    if not playing
        run canvas.delete with "message"
        run new game

define reset lives
    set lives to START_LIVES
    run draw lives

add move surges to tick jobs
add check hazards to tick jobs
add draw surges to draw jobs
add make surges to new game jobs
add reset lives to new game jobs
== main
run draw wires
run window.bind with "<Return>", restart`,

`component: mpy-bro-power
name: The fuse box, and the lights come on
depth: walk
summary: The end of the level, and the point of the story: the fuse box. Reaching it restores the power, and the street lamps along the way light up, each with a warm glow behind it. Winning is a state, like game over: playing becomes no and a message says so. The lamps were drawn once, tagged "lamp", so itemconfig relights them all in one line, and the glows go to the back of the pile with tag_lower, as the sky did in module 3.
learn: Winning as a state; changing many canvas items by tag; tag_lower for things that belong behind.
== settings
set POLE_COLOUR to "#6c757d"
set LAMP_OFF to "#3b3f58"
set LAMP_ON to "#ffd166"
set GLOW to "#3d3423"
set FUSE_COLOUR to "#8d99ae"
== tools
set power on to no
set fuse place to first item of places of("F")

define draw street
    description: The street lamps (dark: the power is out) and the fuse box at the end of the street.
    for each column, row in places of("L")
        set x to column * TILE + TILE / 2 - camera x
        set y to (row + 1) * TILE
        run canvas.create_rectangle with x - 2, y - 56, x + 2, y, fill=POLE_COLOUR, outline="", tags="world"
        run canvas.create_rectangle with x - 2, y - 58, x + 12, y - 55, fill=POLE_COLOUR, outline="", tags="world"
        teach: Each lamp's glass is tagged "lamp" as well as "world", so all of them can be lit at once later.
        run canvas.create_oval with x + 6, y - 56, x + 16, y - 46, fill=LAMP_OFF, outline="", tags=("world", "lamp")
    set x to fuse place[0] * TILE - camera x
    set y to fuse place[1] * TILE
    run canvas.create_rectangle with x + 4, y + 2, x + TILE - 4, y + TILE, fill=FUSE_COLOUR, outline="#2b2d42", width=2, tags="world"
    run canvas.create_line with x + 18, y + 8, x + 12, y + 17, x + 20, y + 17, x + 14, y + 26, fill=LAMP_ON, width=2, tags="world"

define fuse box
    give back (fuse place[0] * TILE, fuse place[1] * TILE, (fuse place[0] + 1) * TILE, (fuse place[1] + 1) * TILE)

define check fuse box
    if overlap(hero box(), fuse box())
        run restore power

define restore power
    description: The power comes back on: every lamp lights, with a glow behind it, and the game is won.
    teach: Winning is a state, like game over: playing becomes no, so everything stops where it is, and Return plays again.
    set power on to yes
    set playing to no
    teach: itemconfig with a tag changes every item that has it: all the lamps light at once.
    run canvas.itemconfig with "lamp", fill=LAMP_ON
    for each column, row in places of("L")
        set x to column * TILE + TILE / 2 + 11 - camera x
        set y to (row + 1) * TILE - 51
        run canvas.create_oval with x - 40, y - 40, x + 40, y + 40, fill=GLOW, outline="", tags=("world", "glow")
    teach: The glows were drawn last, so they're on top of the pile; tag_lower sends them to the back, behind the bricks and the lamps.
    run canvas.tag_lower with "glow"
    run canvas.create_text with WIDTH / 2, HEIGHT / 2, text="Power restored: the street lights are on. Sparks {collected}. Return plays again.", fill=TEXT_COLOUR, font=FONT, tags="message"

define reset power
    set power on to no
    run canvas.itemconfig with "lamp", fill=LAMP_OFF
    run canvas.delete with "glow"

add check fuse box to tick jobs
add reset power to new game jobs
== main
run draw street`,

`component: mpy-bro-timer
name: Your turn: a race against the clock
depth: hallway
summary: A timer turns a walk down the street into a race: 90 seconds to restore the power, counting down at the top of the window, and the game is over when it reaches 0. Ticks are TICK milliseconds long, so a second is a number of ticks; every time that many have gone by, a second comes off. You write how many ticks make a second, and when time is up.
learn: Counting time in ticks; whole-number division; a countdown as state.
== settings
note: Seconds to reach the fuse box.
set TIME_LIMIT to 90
== tools
set time left to TIME_LIMIT
set ticks to 0

define draw time
    run canvas.delete with "time"
    run canvas.create_text with WIDTH - 10, 28, text="Time {time left}", anchor="ne", fill=TEXT_COLOUR, font=FONT, tags="time"

define count down
    description: Counts ticks; every second's worth, a second comes off the clock, and at 0 the game is over.
    increase ticks
    teach: A tick is TICK milliseconds, and a second is 1000 of them, so a second is 1000 // TICK ticks.
    if ticks is at least ‹how many ticks make a second: 1000 // TICK›
        set ticks to 0
        decrease time left
        run draw time
        if ‹time is up: time left is at most 0›
            run game over

define reset time
    set time left to TIME_LIMIT
    set ticks to 0
    run draw time

add count down to tick jobs
add reset time to new game jobs`,

`component: mpy-levels
name: Bigger levels: tile maps and editors
depth: horizon
summary: A level written as text rows is how many classic games began, and it's a good way to learn. Bigger games draw their levels in an editor: tiles painted from a picture of tiles (a tileset), several layers (background, solid ground, things to collect), and objects with settings of their own, like a surge's speed. The game loads the saved file and builds the level from it, the way places of read the text map here.
usual: Tiled (free, saves TMX or JSON files that pygame reads with pytmx, and Arcade reads directly); LDtk, from the makers of Dead Cells; Godot's own TileMap editor.
learn: Tilesets; reading a level from a JSON file; layers in a map; one-way platforms and slopes, the next things platformers need.`,

);
