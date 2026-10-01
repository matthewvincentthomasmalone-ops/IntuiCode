/* IntuiCode kit pack: learning modules, website versions. A course of classic games built step by step, in
 * order: Snake, then Invaders, then Invaders under a night sky, then Jacques & Louis G., a side-scrolling
 * platformer. Each module has two kits that share the same steps: a plain one, and an annotated one whose
 * teach: lines become notes in the sentences, saying what each part adds and why. Every walk step leaves the
 * game playable; each module ends with a "Your turn" step to finish yourself, and a look further ahead.
 * (The Python versions of the same modules are in modules-python.js.) */
(window.IntuiKitPacks = window.IntuiKitPacks || []).push(

// ---------------------------------------------------------------- Module 1 · Snake

`kit: snake-web
title: Snake
layout: website
shelf: modules
platform: web
module: 1 · Snake
version: Website
annotated: no
about: The first module: the classic Snake, built one idea at a time and playable after every step. A grid, a snake that moves by itself, the arrow keys to steer, food that makes it grow, game over and a clean restart, and a best score that's kept.
steps: mweb-snake-board!, mweb-snake-move!, mweb-snake-turn!, mweb-snake-food!, mweb-snake-over!, mweb-snake-score!, mweb-snake-touch*, mweb-snake-speed*, mweb-snake-art, publish`,

`kit: snake-web-notes
title: Snake, annotated
layout: website
shelf: modules
platform: web
module: 1 · Snake
version: Website · annotated
annotated: yes
about: The classic Snake, built one idea at a time and playable after every step, with notes in the sentences on what each part adds and why: the game loop, grids, a list as the snake's body, key presses, timing, game over and restarting cleanly.
steps: mweb-snake-board!, mweb-snake-move!, mweb-snake-turn!, mweb-snake-food!, mweb-snake-over!, mweb-snake-score!, mweb-snake-touch*, mweb-snake-speed*, mweb-snake-art, publish`,

`component: mweb-snake-board
name: The board
depth: walk
summary: The playing field: a drawing area split into a grid of 20 by 20 squares, 20 pixels each, painted afresh about 60 times a second. Snake moves in whole squares, so every position in the game is a column and a row, and a square's pixels are its column and row times 20. Every later step draws on top of this one, in step order.
learn: The drawing area (a canvas) and its x and y; every frame (the game loop); grids: columns, rows and pixels.
== structure
teach: The page holds one drawing area, 400 by 400 pixels, with a line of help underneath. Everything in the game is drawn on the drawing area by Mechanics.
page title is "Snake"
add a main area called stage
    add a drawing area called game 400 by 400
    add a paragraph called help "Arrow keys to steer."
== styling
teach: overflow: hidden stops the arrow keys from scrolling the page while you play.
style the page: background #0e1116, text colour #e8eaf0, font-family: system-ui, space around 0, overflow: hidden
style stage: in a column, align-items: center, justify-content: center, at least 100vh tall, gap 12, space inside 12
teach: The drawing area keeps its own 400 by 400 pixels, but it's shown as big as the screen allows (up to 480 across, and never taller than about half the screen, leaving room for the buttons on a phone).
style game: display: block, width: min(100%, 480px, 50vh), height auto, rounded corners 8, touch-action: none
style help: text colour #9aa3b5, text size 14, space around 0
== mechanics
teach: The board is a grid of squares: 20 across (columns) and 20 down (rows), each 20 pixels wide. Column 0 is on the left and row 0 at the top: on a screen, y counts down from the top, not up from the bottom.
set cell to 20
set cols to 20
set rows to 20

teach: This is the game loop. "every frame" runs about 60 times a second, right before the screen is redrawn. Each frame paints the whole board again, covering whatever was drawn last time; the next steps draw on top of it.
every frame
    fill game with "#151a22"
    teach: Faint lines between the squares, so you can see the grid. Line number c is c times the cell size from the left (or from the top).
    repeat cols plus 1 times counting with c
        draw a line from c times cell, 0 to c times cell, rows times cell in "#1e2530" on game
    repeat rows plus 1 times counting with r
        draw a line from 0, r times cell to cols times cell, r times cell in "#1e2530" on game`,

`component: mweb-snake-move
name: A snake that moves
depth: walk
summary: The snake is a list of squares, head first. Every few frames it takes a step: a new head goes on the front, one square along, and the last square comes off the end, so the body follows the head without each part being moved. For now it heads right and slides off the edge of the board; the next steps add steering, and then walls that count.
learn: Lists (adding to the front, taking from the end); objects with a column and a row; counting frames to time something.
== mechanics
teach: Each square of the snake is a small object holding a column and a row. makeSquare builds one.
define makeSquare using col, row
    give back { col: col, row: row }

teach: The snake is a list of squares, head first. It starts three squares long in the middle of the board.
create list snake
teach: Which way it's heading: dx is its step across (1 is right, -1 is left) and dy its step down (1 is down, -1 is up).
set dx to 1
set dy to 0
teach: How many more steps it should grow for. While this is above 0 the tail stays on, so the snake gets longer. Food adds to it, later.
set grow to 0
teach: playing is the game's state: whether a game is on. It's always on for now; game over will switch it off, and then nothing moves.
set playing to true
teach: Timing. The snake steps once every moveEvery frames, not every frame, or it would cross the board in a third of a second. ticks counts the frames since its last step.
set moveEvery to 8
set ticks to 0

define resetSnake
    set snake to an empty list
    add makeSquare(10, 10) to snake
    add makeSquare(9, 10) to snake
    add makeSquare(8, 10) to snake
    set dx to 1
    set dy to 0
    set grow to 0

run resetSnake

teach: One step: put a new square in front of the head (unshift adds to the front of a list), then take the last square off (pop takes from the end), unless the snake is still growing.
define stepSnake
    set head to first item of snake
    run snake.unshift with makeSquare(head.col plus dx, head.row plus dy)
    if grow is more than 0
        decrease grow
    otherwise
        run snake.pop

every frame
    teach: Count the frames, and take a step every moveEvery of them.
    increase ticks
    if playing and ticks is at least moveEvery
        set ticks to 0
        run stepSnake
    teach: Then draw every square of the body, and the head again in a lighter green so you can tell which end is which. Moving comes before drawing, so you always see where the snake is now.
    for each part in snake
        draw a rectangle at part.col times cell plus 1, part.row times cell plus 1 sized cell minus 2 by cell minus 2 in "#4ade80" on game
    set head to first item of snake
    draw a rectangle at head.col times cell plus 1, head.row times cell plus 1 sized cell minus 2 by cell minus 2 in "#bbf7d0" on game`,

`component: mweb-snake-turn
name: Steering with the arrow keys
depth: walk
summary: The arrow keys turn the snake: each press sets a new direction, which it takes at its next step. A turn straight back into its own neck is ignored. The classic catch: heading right, a quick up-then-left between two steps would turn it round onto itself, so the turn is checked against the square right behind the head, not against the last key.
learn: Key presses (keydown events); why a press (once) is right for steering; comparing two positions.
== mechanics
teach: A turn is a new dx and dy. The square it points to is checked first: if it's the neck (the square right behind the head), the turn is ignored, so the snake can never reverse into itself.
define turn using newDx, newDy
    set head to first item of snake
    set neck to item 1 of snake
    if head.col plus newDx is not neck.col or head.row plus newDy is not neck.row
        set dx to newDx
        set dy to newDy

teach: "when the key … is pressed" runs once each time the key goes down: one press, one turn. Holding a key down is a different idea (Invaders, the next module, uses it).
when the key "left" is pressed
    run turn with -1, 0

when the key "right" is pressed
    run turn with 1, 0

when the key "up" is pressed
    run turn with 0, -1

when the key "down" is pressed
    run turn with 0, 1`,

`component: mweb-snake-food
name: Food and growing
depth: walk
summary: Something to chase. The food sits on a random square that isn't under the snake (if the square it picks is taken, it picks again). When the head reaches it, the score goes up, the snake grows by one square and new food appears somewhere else.
learn: Random whole numbers; a loop that tries again until something fits (while); comparing two positions.
== mechanics
teach: The score: one point for each piece of food.
set score to 0

teach: onSnake says whether a square is under the snake: the same column and the same row as one of its squares. give back ends the tool with an answer.
define onSnake using spot
    for each part in snake
        if part.col is spot.col and part.row is spot.row
            give back true
    give back false

teach: The food is a square too. placeFood picks a random column and row, and picks again while that square is under the snake. Columns count from 0, so the last one is cols minus 1.
set food to makeSquare(15, 10)

define placeFood
    set lastCol to cols minus 1
    set lastRow to rows minus 1
    set food to makeSquare(random number from 0 to lastCol, random number from 0 to lastRow)
    while onSnake(food)
        set food to makeSquare(random number from 0 to lastCol, random number from 0 to lastRow)

every frame
    teach: Eating: the head is on the food's square. The score goes up, the snake grows by one (its tail stays on for one step) and the food moves.
    set head to first item of snake
    if head.col is food.col and head.row is food.row
        increase score
        increase grow
        run placeFood
    draw a circle at food.col times cell plus cell divided by 2, food.row times cell plus cell divided by 2 with radius 7 in "#f87171" on game`,

`component: mweb-snake-over
name: Game over, and a clean restart
depth: walk
summary: The rules that end a game: the head going off the board, or into the snake's own body. Then playing is switched off, so nothing moves, and the board says how to start again. Space (or Enter) starts a new game. Restarting cleanly means putting back every part of the game as it was at the start: the snake, its direction, the food, the score and the timing.
learn: State (a game that's on, or over); checking a position against the edges of a grid; resetting everything a game depends on.
== mechanics
teach: Off the board: a column below 0, or at cols or beyond (the last column is cols minus 1); and the same for rows.
define offBoard using spot
    give back spot.col is less than 0 or spot.col is at least cols or spot.row is less than 0 or spot.row is at least rows

teach: Biting itself: some square of the body, other than the head itself, is on the head's square.
define bitesItself
    set head to first item of snake
    for each part in snake
        if part is not head and part.col is head.col and part.row is head.row
            give back true
    give back false

teach: A new game puts back everything the game depends on. Forget one (say, the score) and the new game starts with the last game's leftovers.
define restart
    run resetSnake
    run placeFood
    set score to 0
    set ticks to 0
    set playing to true

when the key "space" is pressed
    if not playing
        run restart

when the key "enter" is pressed
    if not playing
        run restart

every frame
    teach: The rules are checked every frame, straight after the snake's step, so the game stops the moment something goes wrong.
    if playing and (offBoard(first item of snake) or bitesItself())
        set playing to false
    if not playing
        teach: A dark panel first, so the message can be read even where the snake lies under it.
        draw a rectangle at 100, 156 sized 200 by 104 in "rgba(14, 17, 22, 0.85)" on game
        draw text "Game over" at 136, 190 size 28 in "white" on game
        draw text "Space to play again" at 124, 222 size 18 in "#9aa3b5" on game`,

`component: mweb-snake-score
name: The score, kept
depth: walk
summary: The score on the board, and the best score kept in the browser, so it's still there tomorrow. The best is saved the moment the score passes it, so closing the tab never loses it. It's kept on this device, in this browser: a table of scores shared with friends needs a server.
learn: Drawing text with values in it; localStorage (saving and loading by a name); nothing (null) for a name that was never saved.
== mechanics
teach: The best score is kept in the browser's storage under a name. The first time, nothing has been saved yet, so it starts at 0.
load "snake-best" from the browser and store in best
if best is nothing
    set best to 0

every frame
    teach: Saved as soon as the score passes the best, not only at game over.
    if score is more than best
        set best to score
        save best in the browser as "snake-best"
    teach: Text is drawn last, so it sits on top of everything. {score} in the text is replaced by the score itself.
    draw text "Score {score}" at 10, 24 size 16 in "white" on game
    draw text "Best {best}" at 320, 24 size 16 in "#9aa3b5" on game`,

`component: mweb-snake-touch
name: Touch controls
depth: walk
summary: A phone has no arrow keys, so four buttons under the board do the same job: each runs the same turn as its key. After a game ends, a tap on the board starts the next one. The buttons react on pointerdown, the moment a finger touches, which feels quicker in a game than a click (a click waits for the finger to lift).
learn: Pointer events, which treat a finger and a mouse alike; one tool used from keys and buttons; touch-action, which stops a quick double tap from zooming the page.
== structure
teach: Four buttons in a block under the board, laid out like arrow keys.
    add a block called pad
        add a button called pad-up saying "Up" in group pad-key
        add a button called pad-left saying "Left" in group pad-key
        add a button called pad-down saying "Down" in group pad-key
        add a button called pad-right saying "Right" in group pad-key
== styling
teach: A grid of three columns: Up in the middle of the top row, the other three below it.
style pad: display: grid, grid-template-columns: repeat(3, 76px), gap 8
create group pad-key: font: inherit, space inside 10 0, background #252c38, text colour #e8eaf0, no border, rounded corners 10, touch-action: manipulation, user-select: none
style pad-up: grid-column: 2
style pad-left: grid-column: 1, grid-row: 2
style pad-down: grid-column: 2, grid-row: 2
style pad-right: grid-column: 3, grid-row: 2
== mechanics
teach: Each button runs the same turn as its arrow key, so steering works the same way whichever you use.
when pad-up is tapped
    run turn with 0, -1

when pad-left is tapped
    run turn with -1, 0

when pad-down is tapped
    run turn with 0, 1

when pad-right is tapped
    run turn with 1, 0

teach: A tap on the board after a game ends starts the next one, as Space does on a keyboard, and the board says so.
when game is tapped
    if not playing
        run restart

every frame
    if not playing
        draw text "or tap the board" at 146, 248 size 14 in "#9aa3b5" on game`,

`component: mweb-snake-speed
name: Your turn: faster as it grows
depth: hallway
summary: A change of your own: the snake speeds up as the score goes up, so a long snake is harder to steer. It steps every moveEvery frames; this step works that number out from the score every frame, smaller as the score grows, but never below a fastest pace, or the game would become impossible. The structure is here; you fill in the fastest pace and how quickly it gets there, then play to tune them.
learn: Working a value out from the game's state every frame instead of storing it; Math.floor to round down; Math.max to keep a number above a floor; tuning by playing.
== mechanics
teach: The pace the snake starts at and the fastest it can go, both in frames between steps: fewer frames is faster.
set slowestPace to 8
set fastestPace to ‹the fewest frames between steps, like 3›

every frame
    teach: One frame quicker for every few points. Math.floor rounds down, so the pace changes in whole frames; Math.max stops it going below the fastest.
    set quicker to ‹one frame quicker for every 4 points: Math.floor(score divided by 4)›
    set moveEvery to Math.max(fastestPace, slowestPace minus quicker)`,

`component: mweb-snake-art
name: Art, smooth movement and sound
depth: horizon
summary: The snake is coloured squares, which is how most games begin: get it playing well, then make it beautiful. A drawn snake has a head that faces the way it's going, a body that bends round corners and a tail that tapers, each piece chosen square by square from a small set of pictures (a sprite sheet). Smooth movement draws it part of the way between squares, and short sounds for eating and crashing make it feel alive.
usual: Aseprite or the free Piskel to draw sprites; free art from Kenney.nl and OpenGameArt; the canvas's drawImage to draw part of a sprite sheet; jsfxr for sound effects.
learn: Loading a picture in JavaScript; drawImage with a source rectangle; choosing a body piece from the directions of its neighbours; interpolation (drawing part of the way between two positions).`,

// ---------------------------------------------------------------- Module 2 · Invaders

`kit: invaders-web
title: Invaders
layout: website
shelf: modules
platform: web
module: 2 · Invaders
version: Website
annotated: no
about: The second module: a classic arcade shooter. A cannon that slides and fires, a block of invaders marching side to side and stepping down, shots and hits, the invaders firing back, lives and waves. It builds on Snake with keys held down, lists of moving things, and boxes that overlap.
steps: mweb-inv-stage!, mweb-inv-cannon!, mweb-inv-shots!, mweb-inv-swarm!, mweb-inv-hits!, mweb-inv-waves!, mweb-inv-return-fire!, mweb-inv-touch*, mweb-inv-faster*, mweb-inv-sound, mweb-inv-art`,

`kit: invaders-web-notes
title: Invaders, annotated
layout: website
shelf: modules
platform: web
module: 2 · Invaders
version: Website · annotated
annotated: yes
about: A classic arcade shooter, built step by step, with notes in the sentences on what each part adds and why: keys held down and keys pressed, a swarm kept in one list, boxes that overlap, timing by counting frames, lives, waves and restarting cleanly.
steps: mweb-inv-stage!, mweb-inv-cannon!, mweb-inv-shots!, mweb-inv-swarm!, mweb-inv-hits!, mweb-inv-waves!, mweb-inv-return-fire!, mweb-inv-touch*, mweb-inv-faster*, mweb-inv-sound, mweb-inv-art`,

`component: mweb-inv-stage
name: The stage
depth: walk
summary: The playing field: a drawing area 480 by 400, painted afresh every frame, with the ground near the bottom. It also holds what the whole game shares: playing, which says whether a game is on, and makeBox, which makes every thing in the game (the cannon, the shots, the invaders) a box with a position and a size, so that one test for overlapping boxes can later tell when any two things touch.
learn: The drawing area's x (across) and y (down); the game loop (every frame); objects that bundle named values.
== structure
teach: One drawing area for the whole game, and a line of help under it.
page title is "Invaders"
add a main area called stage
    add a drawing area called game 480 by 400
    add a paragraph called help "Arrows to move, space to fire, Enter to play again."
== styling
style the page: background #05060d, text colour #e5e7f0, font-family: system-ui, space around 0, overflow: hidden
style stage: in a column, align-items: center, justify-content: center, at least 100vh tall, gap 10, space inside 12
teach: Shown as wide as the screen allows, but never so tall that the help line drops off the bottom.
style game: display: block, width: min(100%, 640px, 96vh), height auto, rounded corners 6, touch-action: none
style help: text colour #8b90a5, text size 14, space around 0, text-align: center
== mechanics
teach: The drawing area is 480 pixels across and 400 down. x counts across from the left edge and y counts down from the top, so a bigger y is lower on the screen.
set width to the width of game
set height to the height of game
teach: The ground is a line 30 pixels above the bottom. The cannon stands on it, and invaders that march down to it have won.
set groundY to height minus 30
teach: playing is the game's state: true while a game is on, false once it's over. Everything that moves checks it first, so ending the game stops everything at once.
set playing to true

teach: Every thing in this game is a box: where its top left corner is (x across, y down) and how big it is (w wide, h high). Boxes make it straightforward to test whether two things touch.
define makeBox using x, y, w, h
    give back { x: x, y: y, w: w, h: h }

teach: The game loop. About 60 times a second, every frame paints the whole picture again from the back: first the night, then the ground. Each later step draws its own things on top, in step order.
every frame
    fill game with "#05060d"
    draw a rectangle at 0, groundY sized width by 2 in "#2dd4bf" on game`,

`component: mweb-inv-cannon
name: The cannon
depth: walk
summary: Your cannon slides along the ground while an arrow key is held down, and stops at the edges. Steering in Snake used key presses, once per press; moving here uses keys that are held, checked every frame, so the cannon keeps going for as long as the key stays down.
learn: Keys held down (keydown and keyup, kept in a Set) and keys pressed; Math.min and Math.max to keep a number inside a range.
== mechanics
teach: "keep track of the keys" remembers which keys are down right now. A press happens once; a key that's held stays down over many frames. Snake's steering reacted to presses; a cannon should keep moving while the key is held.
keep track of the keys
teach: The cannon is a box 30 wide and 16 high, standing on the ground in the middle.
set cannon to makeBox(width divided by 2 minus 15, groundY minus 16, 30, 16)
set cannonSpeed to 4

every frame
    teach: Held keys are checked every frame: while "left" is down, the cannon moves 4 pixels left each frame, which is 240 pixels a second.
    if playing and "left" is held
        decrease cannon.x by cannonSpeed
    if playing and "right" is held
        increase cannon.x by cannonSpeed
    teach: Keep it on the screen: no further left than 0, and no further right than the width minus its own width.
    set cannon.x to Math.max(0, Math.min(cannon.x, width minus cannon.w))
    draw a rectangle at cannon.x, cannon.y plus 6 sized cannon.w by cannon.h minus 6 in "#2dd4bf" on game
    draw a rectangle at cannon.x plus 12, cannon.y sized 6 by 6 in "#2dd4bf" on game`,

`component: mweb-inv-shots
name: Firing
depth: walk
summary: Space fires a shot straight up from the cannon. Shots are boxes in a list: every frame each one moves up a little, and shots that have left the top of the screen (or hit something, later) are dropped from the list, so it never fills up. A short reload between shots stops a held key from filling the sky.
learn: Lists of moving things; making a new list of the ones to keep; counting frames down for a delay.
== mechanics
teach: Every shot in the air is a box in this list.
create list shots
teach: reload counts frames down to the next shot allowed: 0 means ready.
set reload to 0

define fire
    if playing and reload is 0
        add makeBox(cannon.x plus 13, cannon.y minus 10, 4, 10) to shots
        set reload to 15

teach: Firing is a key press: one press, one shot.
when the key "space" is pressed
    run fire

every frame
    if reload is more than 0
        decrease reload
    teach: First tidy the list: keep the shots still on the screen and not spent (a shot that hits something is marked spent, in a later step). Taking things out of a list while going through it would skip some, so the ones to keep go into a new list instead.
    create list kept
    for each shot in shots
        if shot.y plus shot.h is more than 0 and not shot.spent
            add shot to kept
    set shots to kept
    teach: Then move each shot up (going up means a smaller y) and draw it.
    for each shot in shots
        decrease shot.y by 8
        draw a rectangle at shot.x, shot.y sized shot.w by shot.h in "#fef08a" on game`,

`component: mweb-inv-swarm
name: The marching invaders
depth: walk
summary: Forty invaders in five rows of eight, kept in one list. They march together: every so many frames the whole block steps sideways, and when any one of them would step past an edge, the whole block steps down instead and turns round. Their legs switch with each step, the oldest kind of animation there is: two pictures taking turns.
learn: Lists of objects; loops inside loops (rows and columns); one test that decides what every item does; timing by counting frames.
== mechanics
teach: The swarm is one list of boxes. Each invader also remembers its row, which decides its colour (and, later, its points).
create list invaders
create list rowColours with "#f472b6", "#c084fc", "#818cf8", "#38bdf8", "#4ade80"
teach: Which way the swarm is marching (1 is right, -1 is left), how far each step goes, and how far it drops at an edge.
set marchDir to 1
set stepAcross to 8
set stepDown to 16
teach: Timing: the swarm steps once every marchEvery frames, and marchTicks counts the frames since its last step. legsOut says which of the two poses they're in.
set marchEvery to 30
set marchTicks to 0
set legsOut to false

define newSwarm using top
    teach: Five rows of eight, 40 pixels apart across and 32 down: a loop inside a loop, rows outside and columns inside.
    set invaders to an empty list
    repeat 5 times counting with r
        repeat 8 times counting with c
            set invader to makeBox(60 plus c times 40, top plus r times 32, 26, 18)
            set invader.row to r
            add invader to invaders
    set marchDir to 1
    set marchTicks to 0

run newSwarm with 50

define march
    teach: First look ahead: would any invader cross an edge with its next step?
    set nextMove to stepAcross times marchDir
    set atEdge to false
    for each invader in invaders
        if invader.x plus nextMove is less than 8 or invader.x plus invader.w plus nextMove is more than width minus 8
            set atEdge to true
    teach: Then every invader moves the same way: down and round at an edge, or one step along.
    if atEdge
        set marchDir to -marchDir
        for each invader in invaders
            increase invader.y by stepDown
    otherwise
        for each invader in invaders
            increase invader.x by nextMove
    set legsOut to not legsOut

every frame
    increase marchTicks
    if playing and marchTicks is at least marchEvery
        set marchTicks to 0
        run march
    for each invader in invaders
        set colour to item invader.row of rowColours
        draw a rectangle at invader.x plus 3, invader.y sized invader.w minus 6 by 12 in colour on game
        draw a rectangle at invader.x, invader.y plus 4 sized invader.w by 6 in colour on game
        draw a rectangle at invader.x plus 7, invader.y plus 3 sized 4 by 4 in "#05060d" on game
        draw a rectangle at invader.x plus 15, invader.y plus 3 sized 4 by 4 in "#05060d" on game
        teach: Legs out or in, switching with every step: two poses taking turns read as walking.
        if legsOut
            draw a rectangle at invader.x, invader.y plus 12 sized 4 by 6 in colour on game
            draw a rectangle at invader.x plus invader.w minus 4, invader.y plus 12 sized 4 by 6 in colour on game
        otherwise
            draw a rectangle at invader.x plus 6, invader.y plus 12 sized 4 by 6 in colour on game
            draw a rectangle at invader.x plus invader.w minus 10, invader.y plus 12 sized 4 by 6 in colour on game`,

`component: mweb-inv-hits
name: Hits and the score
depth: walk
summary: A shot that touches an invader destroys it and scores. Touching is tested the way most 2D games test it: two boxes overlap when each one starts before the other one ends, across and down. Destroyed invaders leave the list, and a short burst shows where they were. Higher rows are worth more.
learn: Overlapping rectangles (axis-aligned bounding boxes); loops inside loops; marking things, then tidying the list afterwards.
== mechanics
set score to 0
teach: Two boxes overlap when a starts before b ends and b starts before a ends, both across (x and w) and down (y and h). If any of the four is false, there's a gap between them.
define overlaps using a, b
    give back a.x is less than b.x plus b.w and b.x is less than a.x plus a.w and a.y is less than b.y plus b.h and b.y is less than a.y plus a.h

teach: Bursts are short-lived flashes where an invader was hit. Each counts its frames down and goes when it reaches 0.
create list bursts

every frame
    teach: Every shot against every invader: a loop inside a loop. A hit marks both, the shot spent and the invader destroyed; the top row is worth 50, the bottom row 10.
    for each shot in shots
        for each invader in invaders
            if not shot.spent and not invader.destroyed and overlaps(shot, invader)
                set shot.spent to true
                set invader.destroyed to true
                increase score by 50 minus invader.row times 10
                set burst to makeBox(invader.x, invader.y, invader.w, invader.h)
                set burst.life to 12
                add burst to bursts
    teach: Then tidy up: keep the invaders that weren't destroyed.
    create list survivors
    for each invader in invaders
        if not invader.destroyed
            add invader to survivors
    set invaders to survivors
    teach: Each burst fades as its life runs down: life divided by 12 goes from 1 (solid) towards 0 (see-through).
    create list fading
    for each burst in bursts
        decrease burst.life
        if burst.life is more than 0
            add burst to fading
            draw a rectangle at burst.x, burst.y plus 7 sized burst.w by 4 in "rgba(254, 240, 138, {burst.life divided by 12})" on game
            draw a rectangle at burst.x plus 11, burst.y sized 4 by burst.h in "rgba(254, 240, 138, {burst.life divided by 12})" on game
    set bursts to fading
    draw text "Score {score}" at 12, 24 size 16 in "white" on game`,

`component: mweb-inv-waves
name: Waves
depth: walk
summary: Clear the whole block and the next wave marches in, starting a little lower each time, so there's less room before it reaches you. The wave number is part of the game's state, shown at the top.
learn: Checking for an empty list; a value that grows with the game (difficulty); Math.min to cap it.
== mechanics
set wave to 1
teach: Each wave starts 12 pixels lower than the last, until the sixth; after that they all start there.
define waveTop
    give back 50 plus Math.min(wave minus 1, 5) times 12

every frame
    teach: An empty list means the wave is cleared, so the next one marches in.
    if playing and length of invaders is 0
        increase wave
        run newSwarm with waveTop()
    draw text "Wave {wave}" at 404, 24 size 16 in "#8b90a5" on game`,

`component: mweb-inv-return-fire
name: Return fire, lives and game over
depth: walk
summary: Now the invaders shoot back. Every frame there's a small chance that one of them, picked at random, drops a bomb. A bomb that touches the cannon costs a life; with no lives left, or once the invaders march down to the cannon, the game is over. Enter starts again, and restarting puts back every part of the game: the cannon, the shots, the bombs, the swarm, the score, the wave and the lives.
learn: Random chances (Math.random); state (a game that's on, or over); restarting cleanly.
== mechanics
set lives to 3
create list bombs
teach: The chance each frame that some invader drops a bomb: 2 in 100. At 60 frames a second, that's about one bomb a second.
set bombChance to 0.02

define endGame
    set playing to false

teach: A new game puts back everything the game depends on, as it was at the start. Leave one out (the bombs, say) and the new game begins with the last one's leftovers.
define restart
    set cannon.x to width divided by 2 minus cannon.w divided by 2
    set shots to an empty list
    set bombs to an empty list
    set score to 0
    set wave to 1
    set lives to 3
    run newSwarm with waveTop()
    set playing to true

when the key "enter" is pressed
    if not playing
        run restart

every frame
    teach: Math.random() gives a number from 0 to 1, so it's below 0.02 two times in a hundred. random item from picks which invader drops the bomb.
    if playing and length of invaders is more than 0 and Math.random() is less than bombChance
        set dropper to random item from invaders
        add makeBox(dropper.x plus dropper.w divided by 2 minus 2, dropper.y plus dropper.h, 4, 10) to bombs
    teach: Bombs fall; one that touches the cannon costs a life and is used up, and ones that reach the ground are gone.
    create list falling
    for each bomb in bombs
        if playing
            increase bomb.y by 3
        set hitCannon to playing and overlaps(bomb, cannon)
        if hitCannon
            decrease lives
            if lives is at most 0
                run endGame
        if not hitCannon and bomb.y is less than groundY
            add bomb to falling
        draw a rectangle at bomb.x, bomb.y sized bomb.w by bomb.h in "#fb7185" on game
    set bombs to falling
    teach: Invaders that march down to the cannon's level have won too.
    for each invader in invaders
        if invader.y plus invader.h is at least cannon.y
            run endGame
    draw text "Lives {lives}" at 12, height minus 9 size 14 in "#8b90a5" on game
    if not playing
        draw a rectangle at 136, 166 sized 208 by 104 in "rgba(5, 6, 13, 0.85)" on game
        draw text "Game over" at 168, 200 size 32 in "white" on game
        draw text "Enter to play again" at 166, 232 size 18 in "#8b90a5" on game`,

`component: mweb-inv-touch
name: Touch controls
depth: walk
summary: On a phone, tap the board where the cannon should go: it slides there at its usual speed and fires as it sets off, so a tap under an invader moves there and shoots. After a game ends, a tap starts the next one. The board may be shown smaller or bigger than its own 480 pixels, so the tap is scaled to the board's pixels first.
learn: Pointer events (a finger and a mouse alike); screen pixels and the drawing area's own pixels (clientWidth and width); moving towards a target a little each frame.
== mechanics
teach: Where the cannon is heading after a tap, or nothing when there's no tap to follow.
set touchTarget to nothing

when game is tapped
    if not playing
        run restart
    otherwise
        teach: tap x is measured in the pixels shown on the screen, and the board's own pixels may be more or fewer. Multiplying by width divided by clientWidth (how wide it's shown) turns one into the other.
        set scale to the width of game divided by game.clientWidth
        set touchTarget to tap x times scale minus cannon.w divided by 2
        set touchTarget to Math.max(0, Math.min(touchTarget, width minus cannon.w))
        run fire

every frame
    teach: The keys win: holding an arrow forgets the tap.
    if "left" is held or "right" is held
        set touchTarget to nothing
    if playing and touchTarget is not nothing
        teach: Move towards the target by at most the cannon's speed, so a tap far away doesn't make it jump.
        set gap to touchTarget minus cannon.x
        set cannon.x to cannon.x plus Math.max(-cannonSpeed, Math.min(cannonSpeed, gap))
        if Math.abs(gap) is at most cannonSpeed
            set touchTarget to nothing
    if not playing
        draw text "or tap the board" at 186, 256 size 14 in "#8b90a5" on game`,

`component: mweb-inv-faster
name: Your turn: faster as they fall
depth: hallway
summary: In the arcade original the invaders sped up as you destroyed them, and it became the most famous thing about the game: the last one races. Here the swarm steps every marchEvery frames; this step works that number out every frame from how many invaders are left, from slow with a full block to fast with the last one. The structure is here; you fill in the fastest pace and how much of the block is left.
learn: Working a value out from the game's state every frame; proportions (a share of the whole, from 0 to 1); Math.round.
== mechanics
teach: A full block is 40 invaders. The pace goes from slowestPace (a full block) to fastestPace (the last one), in frames between steps.
set fullBlock to 40
set slowestPace to 30
set fastestPace to ‹the fewest frames between steps for the last invader, like 2›

every frame
    teach: share is how much of the block is still there: 1 when it's full, nearly 0 at the end. The pace is the fastest plus that share of the difference.
    set share to ‹how much of the block is left: length of invaders divided by fullBlock›
    set marchEvery to Math.round(fastestPace plus (slowestPace minus fastestPace) times share)`,

`component: mweb-inv-sound
name: Sound design
depth: horizon
summary: The arcade original's four-note march, quickening as the invaders fall, is as famous as its pictures: sound tells players things without them having to look. A game's sounds are mostly short effects (a shot, a hit, a lost life) and a few loops, each played from the place where the game changes its state. Browsers only allow sound after a first key press or tap, so a game starts silent and wakes its sound on the first input.
usual: jsfxr or ChipTone to make retro effects; Howler.js to load and play them; the Web Audio API underneath (play a note uses it); free sounds from Freesound and Kenney.nl.
learn: The Web Audio API (oscillators and gain); why browsers wait for a first tap before playing sound; tying a sound to a game event; balancing levels so effects don't drown each other out.`,

`component: mweb-inv-art
name: Sprites and pixel art
depth: horizon
summary: The invaders here are a few rectangles each, with two poses for their legs. Arcade games drew them as tiny pictures (sprites) a few pixels across, with two frames of animation that swapped at every step, as these do. Drawing your own is the quickest way to make the game yours: a sprite sheet holds every picture side by side, and each frame the game draws the right piece of it, scaled up with sharp edges.
usual: Aseprite or the free Piskel for pixel art; Lospec for small colour palettes; the canvas's drawImage with a source rectangle; image-rendering: pixelated (and imageSmoothingEnabled = false) to keep pixels crisp.
learn: Loading a picture (new Image, and waiting for it to load); drawImage with a source rectangle; frames of animation in a sprite sheet; working with a small palette.`,

// ---------------------------------------------------------------- Module 3 · Invaders under a night sky

`kit: nightsky-web
title: Invaders under a night sky
layout: website
shelf: modules
platform: web
module: 3 · Invaders under a night sky
version: Website
annotated: no
about: The third module: the Invaders game again, now under a night sky. A sky that fades from deep blue to violet, stars in two layers that twinkle and drift at different speeds, a glowing moon and a city on the horizon. The lesson is drawing order: the background goes on first, in layers, and the game is drawn on top.
steps: mweb-inv-stage!, mweb-sky-layers!, mweb-inv-cannon!, mweb-inv-shots!, mweb-inv-swarm!, mweb-inv-hits!, mweb-inv-waves!, mweb-inv-return-fire!, mweb-sky-gradient!, mweb-sky-stars!, mweb-sky-moon!, mweb-sky-city!, mweb-inv-touch*, mweb-sky-shooting*, mweb-sky-art, installable`,

`kit: nightsky-web-notes
title: Invaders under a night sky, annotated
layout: website
shelf: modules
platform: web
module: 3 · Invaders under a night sky
version: Website · annotated
annotated: yes
about: The Invaders game under a night sky, with notes in the sentences on what each part adds and why: drawing order and layers, a gradient made of bands, parallax, twinkling with a sine wave, see-through colours for a soft glow, and patterns that look random but stay put.
steps: mweb-inv-stage!, mweb-sky-layers!, mweb-inv-cannon!, mweb-inv-shots!, mweb-inv-swarm!, mweb-inv-hits!, mweb-inv-waves!, mweb-inv-return-fire!, mweb-sky-gradient!, mweb-sky-stars!, mweb-sky-moon!, mweb-sky-city!, mweb-inv-touch*, mweb-sky-shooting*, mweb-sky-art, installable`,

`component: mweb-sky-layers
name: Layers: room for a background
depth: walk
summary: Every frame is painted in step order, each step's picture on top of the one before, like layers of paint. A background has to go on first: straight after the stage clears the screen, before the cannon and the invaders. This step keeps a list of background layers and draws them right there, in list order. The sky steps come after the game in the plan, but they add their drawing to this list, so they end up behind it.
learn: Drawing order (painting from back to front, the painter's algorithm); tools kept in a list and run in order.
== mechanics
teach: backLayers holds the tools that draw the background, from the back forwards. It's empty until the sky steps add to it.
create list backLayers

teach: This step's every frame comes straight after the stage's and before any step that draws the game, so whatever it draws ends up behind the game. Each layer is a tool (a function), and run layer draws it.
every frame
    for each layer in backLayers
        run layer`,

`component: mweb-sky-gradient
name: A sky that fades
depth: walk
summary: The sky fades from deep navy at the top to violet near the horizon. The canvas has no sentence for gradients, and doesn't need one: 24 thin bands, each a little further from the top colour towards the bottom colour, look smooth from any distance. The colours are worked out once at the start; every frame only paints them. It's the first background layer, so everything else is painted over it.
learn: Interpolation (mixing two numbers by a fraction from 0 to 1); colours as red, green and blue numbers (rgb); working something out once instead of every frame.
== mechanics
teach: Each band's colour is mixed from the top colour and the bottom colour. t goes from 0 at the top band to 1 at the bottom one, and each part (red, green, blue) moves that far from its top value to its bottom value: top plus (bottom minus top) times t. Mixing by a fraction like this is called interpolation, or lerp.
create list skyBands
set bands to 24
repeat bands times counting with k
    set t to k divided by (bands minus 1)
    set redPart to Math.round(4 plus (46 minus 4) times t)
    set greenPart to Math.round(6 plus (24 minus 6) times t)
    set bluePart to Math.round(22 plus (72 minus 22) times t)
    add "rgb({redPart}, {greenPart}, {bluePart})" to skyBands

teach: The colours never change, so they were mixed once, above. Every frame only paints the bands, from the top down to the ground line, each a pixel taller than its share so no gaps show between them.
define drawSky
    set bandHeight to (groundY minus 1) divided by bands
    repeat bands times counting with k
        draw a rectangle at 0, k times bandHeight sized width by bandHeight plus 1 in item k of skyBands on game

teach: Added first, so it's the backmost layer.
add drawSky to backLayers`,

`component: mweb-sky-stars
name: Stars in two layers
depth: walk
summary: Stars in two layers: many small, faint ones far away, and fewer, bigger, brighter ones nearer. Both drift slowly sideways, the near layer five times faster than the far one, and that difference in speed is what makes the sky look deep (parallax). Each star twinkles on its own rhythm: its brightness follows a sine wave, started at a different point for every star.
learn: Parallax (nearer things seem to move faster); Math.sin for smooth back-and-forth values; see-through colours with rgba.
== mechanics
teach: A star is where it is, how big it is, and where it starts in its twinkle (its phase).
define makeStar using x, y, size, phase
    give back { x: x, y: y, size: size, phase: phase }

teach: Two lists, two layers: 70 small far stars and 24 bigger near ones, scattered over the sky above the city.
create list farStars
create list nearStars
set starsLowest to groundY minus 90
repeat 70 times
    add makeStar(random number from 0 to width, random number from 0 to starsLowest, 1, Math.random() times 6.3) to farStars
repeat 24 times
    add makeStar(random number from 0 to width, random number from 0 to starsLowest, 2, Math.random() times 6.3) to nearStars
teach: twinkle counts frames, so the twinkling keeps time.
set twinkle to 0

define drawStarLayer using stars, drift, bright
    for each star in stars
        teach: Each layer drifts left at its own speed. A star that leaves the left edge comes back in on the right, so the sky never empties.
        decrease star.x by drift
        if star.x is less than 0
            increase star.x by width
        teach: Math.sin swings smoothly between -1 and 1, so each star's brightness rises and falls around bright. The phase starts every star at a different point, so they don't pulse together.
        set glow to bright plus 0.3 times Math.sin(twinkle times 0.05 plus star.phase)
        draw a rectangle at star.x, star.y sized star.size by star.size in "rgba(255, 255, 255, {glow})" on game

define drawStars
    increase twinkle
    teach: Parallax: the far layer drifts at a fifth of the near layer's speed, and that difference is what reads as distance.
    run drawStarLayer with farStars, 0.04, 0.45
    run drawStarLayer with nearStars, 0.2, 0.65

teach: Added after the sky, so the stars are painted over it.
add drawStars to backLayers`,

`component: mweb-sky-moon
name: The moon and its glow
depth: walk
summary: A moon high on the right, with a soft glow round it. The glow is three very see-through circles, largest first: where they overlap the light adds up, so it's brightest near the moon and fades away from it. The moon's layer comes after the stars', so it hides the stars behind it, as a real moon would.
learn: See-through colours (rgba's last number, from 0 to 1); building a soft effect from several faint shapes; drawing order inside one layer.
== mechanics
set moonX to width minus 90
set moonY to 70

define drawMoon
    teach: The glow first: big, faint circles, each smaller one adding a little more light towards the middle.
    draw a circle at moonX, moonY with radius 64 in "rgba(255, 240, 200, 0.04)" on game
    draw a circle at moonX, moonY with radius 44 in "rgba(255, 240, 200, 0.06)" on game
    draw a circle at moonX, moonY with radius 30 in "rgba(255, 240, 200, 0.1)" on game
    teach: Then the moon itself, and three slightly darker patches drawn on top of it for its seas.
    draw a circle at moonX, moonY with radius 22 in "#f4eedb" on game
    draw a circle at moonX minus 7, moonY minus 5 with radius 5 in "#ddd5bb" on game
    draw a circle at moonX plus 8, moonY plus 6 with radius 4 in "#ddd5bb" on game
    draw a circle at moonX minus 2, moonY plus 10 with radius 3 in "#ddd5bb" on game

add drawMoon to backLayers`,

`component: mweb-sky-city
name: A city on the horizon
depth: walk
summary: A row of dark buildings along the ground, far off, with a few lit windows, and the faint orange glow a city throws up into the haze above it. It's the last background layer, so it's the nearest, and it's kept dark and quiet so the game in front stays clear. The windows follow a pattern rather than random numbers, so they stay the same from frame to frame instead of flickering.
learn: A list of numbers as a picture (building heights); loops inside loops (rows and columns of windows); mod for a pattern that looks scattered but never changes.
== mechanics
teach: The skyline is a list of heights, one building every 40 pixels: the picture is written as numbers. Twelve buildings of 40 fill the 480 pixels.
create list skyline with 46, 70, 38, 58, 84, 50, 34, 64, 44, 76, 40, 56
set buildingWidth to 40

define drawCity
    teach: The glow over the city: four see-through bands above the rooftops, fainter the higher they go.
    repeat 4 times counting with k
        draw a rectangle at 0, groundY minus 52 minus k times 22 sized width by 22 in "rgba(255, 150, 80, {0.07 minus k times 0.015})" on game
    repeat length of skyline times counting with n
        teach: Each building stands on the ground: its top is the ground's y minus its height.
        set tall to item n of skyline
        set buildingX to n times buildingWidth
        draw a rectangle at buildingX, groundY minus tall sized buildingWidth minus 2 by tall in "#0b0d1a" on game
        teach: Windows in rows of three. (n plus row plus col) mod 4 is 0 for about one window in four: a pattern that looks scattered, but is the same every frame, so the lights stay on instead of flickering.
        repeat Math.floor(tall divided by 14) times counting with row
            repeat 3 times counting with col
                if (n plus row plus col) mod 4 is 0
                    draw a rectangle at buildingX plus 6 plus col times 11, groundY minus tall plus 6 plus row times 14 sized 4 by 5 in "rgba(253, 224, 140, 0.55)" on game

teach: Added last, so the city is the nearest layer of the background, in front of the sky, the stars and the moon, and still behind the game.
add drawCity to backLayers`,

`component: mweb-sky-shooting
name: Your turn: a shooting star
depth: hallway
summary: Now and then a shooting star streaks across the sky and fades. It's one more background layer, so it passes behind the game. Each one is a box with a life that counts down; every frame there's a small chance a new one starts. The structure is here; you fill in how often they come, how fast they fall and how they fade.
learn: Random chances each frame; things with a limited life; drawing a streak as a line pointing back along the way it moves.
== mechanics
teach: The shooting stars in the sky right now. They start somewhere along the top of the left half.
create list meteors
set halfWidth to width divided by 2

define drawMeteors
    teach: A small chance each frame that a new one starts. Math.random() is below 0.005 about once every 200 frames: every three seconds or so.
    if ‹a small chance each frame: Math.random() is less than 0.005›
        set meteor to makeBox(random number from 0 to halfWidth, random number from 10 to 80, 2, 2)
        set meteor.life to 40
        add meteor to meteors
    create list still
    for each meteor in meteors
        teach: Each frame it moves 7 across and a little down, and its life counts down. Its brightness comes from its life, so it fades as it goes.
        increase meteor.x by 7
        increase meteor.y by ‹how far it falls each frame, like 3›
        decrease meteor.life
        set fade to ‹how bright it is: brighter the more life it has left, meteor.life divided by 40›
        teach: The streak is a line from the head back along its path: 7 across and 3 down each frame, so the tail is 5 frames behind.
        draw a line from meteor.x, meteor.y to meteor.x minus 35, meteor.y minus 15 in "rgba(255, 255, 255, {fade})" on game
        if meteor.life is more than 0
            add meteor to still
    set meteors to still

add drawMeteors to backLayers`,

`component: mweb-sky-art
name: Painted backgrounds and light
depth: horizon
summary: The sky here is made of shapes worked out in code, which keeps it small and lets it move. Many games paint their backgrounds instead: several pictures, one per layer (far mountains, nearer hills, trees), each scrolled at its own speed. Light is the other half: real gradients, glows that add their light to what's below them, and a background drawn once onto a hidden canvas and copied each frame, so a rich sky costs almost nothing.
usual: Krita or Aseprite to paint layers; free parallax backgrounds on itch.io and OpenGameArt; the canvas's createLinearGradient and createRadialGradient; globalCompositeOperation "lighter" for glows; an offscreen canvas to keep a finished background.
learn: Canvas gradients; blend modes (globalCompositeOperation); drawing one canvas onto another with drawImage; how parallax layers are scrolled at different speeds.`,

// ---------------------------------------------------------------- Module 4 · Jacques & Louis G.

`kit: brothers-web
title: Jacques & Louis G.
layout: website
shelf: modules
platform: web
module: 4 · Jacques & Louis G.
version: Website
annotated: no
about: The fourth module: a side-scrolling platformer. The power is out on the street, and two electrician brothers set off to fix it: Jacques jumps higher, Louis G. runs faster, and you swap between them. A level written as rows of text, gravity and jumping, a camera that follows, sparks to collect, loose wires and power surges, and a fuse box at the end that turns the street's lights back on.
steps: mweb-bros-street!, mweb-bros-map!, mweb-bros-hero!, mweb-bros-controls!, mweb-bros-camera!, mweb-bros-swap!, mweb-bros-sparks!, mweb-bros-wires!, mweb-bros-surges!, mweb-bros-fusebox!, mweb-bros-touch*, mweb-bros-double*, mweb-bros-levels, mweb-bros-art`,

`kit: brothers-web-notes
title: Jacques & Louis G., annotated
layout: website
shelf: modules
platform: web
module: 4 · Jacques & Louis G.
version: Website · annotated
annotated: yes
about: A side-scrolling platformer with two electrician brothers, built step by step, with notes in the sentences on what each part adds and why: a level as text, tiles, gravity as speed changing every frame, landing, a camera as an offset, characters as data, enemies that patrol and a goal that changes the whole street.
steps: mweb-bros-street!, mweb-bros-map!, mweb-bros-hero!, mweb-bros-controls!, mweb-bros-camera!, mweb-bros-swap!, mweb-bros-sparks!, mweb-bros-wires!, mweb-bros-surges!, mweb-bros-fusebox!, mweb-bros-touch*, mweb-bros-double*, mweb-bros-levels, mweb-bros-art`,

`component: mweb-bros-street
name: The street in the dark
depth: walk
summary: The stage: a drawing area 480 by 288, and behind the level a row of houses with street lamps, all dark, because the power is out. The street scrolls at half the speed of the level, so it looks further away (parallax). It holds what the whole game shares: the tile size, powerOn (off until the fuse box is reached), and camX, how far the view has scrolled.
learn: The drawing area's x and y; tools that draw one thing at a place you give them; state that changes how things are drawn.
== structure
teach: One drawing area for the game, 480 by 288 (20 tiles across and 12 down, 24 pixels each), and a line of help.
page title is "Jacques & Louis G."
add a main area called stage
    add a drawing area called game 480 by 288
    add a paragraph called help "Arrow keys to run and jump, S to swap brothers."
== styling
style the page: background #0d0b1a, text colour #ece9f8, font-family: system-ui, space around 0, overflow: hidden
style stage: in a column, align-items: center, justify-content: center, at least 100vh tall, gap 10, space inside 12
teach: As wide as the screen allows, but no taller than about 60% of the screen's height, leaving room for the buttons on a phone held sideways.
style game: display: block, width: min(100%, 960px, 100vh), height auto, rounded corners 6, touch-action: none
style help: text colour #a8a2c4, text size 14, space around 0, text-align: center
== mechanics
teach: x counts across from the left, y down from the top. The level is built from square tiles 24 pixels wide: the screen shows 20 across and 12 down.
set width to the width of game
set height to the height of game
set tile to 24
teach: The power is out, so the street is dark. Reaching the fuse box at the end of the level switches it on.
set powerOn to false
teach: camX is how far the view has scrolled along the level, in pixels. Things in the level are drawn shifted left by camX. It stays 0 until the camera step moves it.
set camX to 0
teach: The street is drawn standing on the ground line, two tiles above the bottom.
set streetLevel to height minus 48
create list houseHeights with 120, 96, 136, 104, 128, 92, 116

teach: drawHouse draws one house at an x you give it, and drawLamp the street lamp beside it. Every window and lamp asks powerOn which colour to be, so switching that one value lights the whole street.
define drawHouse using x, tall
    set top to streetLevel minus tall
    draw a rectangle at x, top sized 92 by tall in "#2a2340" on game
    draw a rectangle at x minus 4, top minus 8 sized 100 by 8 in "#1d1830" on game
    set windowColour to "#1f1a33"
    if powerOn
        set windowColour to "#fcd34d"
    repeat 2 times counting with row
        repeat 2 times counting with col
            draw a rectangle at x plus 14 plus col times 40, top plus 16 plus row times 36 sized 24 by 20 in windowColour on game

define drawLamp using x
    draw a rectangle at x plus 100, streetLevel minus 72 sized 4 by 72 in "#3b3552" on game
    set lampColour to "#3f3a56"
    if powerOn
        set lampColour to "#fef3c7"
        draw a circle at x plus 102, streetLevel minus 70 with radius 26 in "rgba(253, 214, 120, 0.2)" on game
    draw a rectangle at x plus 94, streetLevel minus 76 sized 16 by 6 in lampColour on game

every frame
    fill game with "#141026"
    teach: The street is far behind the level, so it scrolls at half the camera's speed: camX times 0.5. Nearer things pass faster; that difference is parallax.
    set streetX to camX times 0.5
    teach: Only the houses on the screen are drawn. All the houses go first and then all the lamps, so no house is painted over the glow of the lamp beside it.
    repeat 24 times counting with k
        set x to k times 110 minus streetX
        if x is more than -110 and x is less than width
            set n to k mod length of houseHeights
            run drawHouse with x, item n of houseHeights
    repeat 24 times counting with k
        set x to k times 110 minus streetX
        if x is more than -110 and x is less than width
            run drawLamp with x`,

`component: mweb-bros-map
name: The level, written as text
depth: walk
summary: The level is a list of lines of text, one per row of tiles, top row first: # is brick, = a girder, * a spark, ^ a loose wire, s a power surge, F the fuse box and P where the brothers start. Reading a tile is picking a character out of a line, so changing the level means editing the lines. This step reads the map (what's at a column and row, and where every letter is) and draws the bricks and girders that are on the screen.
learn: Strings as lists of characters; a grid stored as a list of rows; turning pixels into columns and rows (divide and round down); drawing only what's on screen.
== mechanics
teach: The level, one line per row of tiles, 100 tiles long. Every line is the same length. Try changing a line and play it.
create list level
add "...................................................................................................." to level
add "...................................................................................................." to level
add "...................................................................................................." to level
add "...................................................................................................." to level
add "..............................................................................**...................." to level
add "............................................**...............................====..................." to level
add "...................**.......................##...................**................................." to level
add "..................====......................##............*.....====.......#........................" to level
add "..............##...................***......##............................##........................" to level
add "..P..*.*.*.^..##.........s..............^...##....s.**...............s...###.......^....s.**...F...." to level
add "##############################...#######################.....#######################################" to level
add "##############################...#######################.....#######################################" to level
set rows to length of level
set cols to length of first item of level
set levelWidth to cols times tile

teach: tileAt gives the character at a column and row. Past either end of the level there's a wall, so nobody walks off it; above and below there's open air, so a pit is a fall.
define tileAt using col, row
    if col is less than 0 or col is at least cols
        give back "#"
    if row is less than 0 or row is at least rows
        give back "."
    set line to item row of level
    give back item col of line

teach: solidAt turns a point in pixels into a column and a row (divide by the tile size, round down) and says whether that tile holds you up. Only bricks and girders do; everything else in the map you pass through.
define solidAt using x, y
    set ch to tileAt(Math.floor(x divided by tile), Math.floor(y divided by tile))
    give back ch is "#" or ch is "="

teach: findAll lists every place a letter appears in the map, as columns and rows. Later steps use it to find the start, the sparks, the wires, the surges and the fuse box.
define findAll using letter
    create list found
    repeat rows times counting with row
        repeat cols times counting with col
            if tileAt(col, row) is letter
                add { col: col, row: row } to found
    give back found

every frame
    teach: Only the columns on the screen are drawn: from the one at the left edge of the view (camX divided by tile, rounded down) to one past the right edge, 21 in all. A level can be as long as you like without slowing down.
    set firstCol to Math.floor(camX divided by tile)
    repeat 21 times counting with k
        set col to firstCol plus k
        set x to col times tile minus camX
        repeat rows times counting with row
            set ch to tileAt(col, row)
            set y to row times tile
            if ch is "#"
                draw a rectangle at x, y sized tile by tile in "#7a3524" on game
                draw a rectangle at x, y plus 11 sized tile by 2 in "#4c1d14" on game
                draw a rectangle at x plus 11, y sized 2 by 11 in "#4c1d14" on game
                draw a rectangle at x, y sized tile by 2 in "#9a4a35" on game
            if ch is "="
                draw a rectangle at x, y sized tile by 10 in "#64748b" on game
                draw a rectangle at x plus 4, y plus 3 sized 4 by 4 in "#334155" on game
                draw a rectangle at x plus 16, y plus 3 sized 4 by 4 in "#334155" on game`,

`component: mweb-bros-hero
name: Gravity and landing
depth: walk
summary: Jacques, as a box with a speed across (vx) and a speed down (vy). Gravity is speed changing every frame: each frame vy grows a little, and then vy moves him, so a fall gets faster and faster. Moving is done one direction at a time: across, then down. After each, if he's gone into a solid tile he's pushed back out to its edge; pushed up out of a floor while falling means he has landed. Falling into a pit sends him back to the start, blinking.
learn: Speed and gravity (velocity: speed with a direction); collisions with a grid of tiles, one axis at a time; Math.floor and Math.min.
== mechanics
teach: Every thing in this game is a box, as in Invaders: x and y for its top left corner, w and h for its size.
define makeBox using x, y, w, h
    give back { x: x, y: y, w: w, h: h }

teach: Where the brothers start: the P in the map.
set start to first item of findAll("P")
teach: The hero is a box 16 wide and 22 high, a little smaller than a tile. vx and vy are his speed across and down, in pixels per frame; a negative vy is going up.
set hero to makeBox(0, 0, 16, 22)
set hero.vx to 0
set hero.vy to 0
set hero.onGround to false
set hero.facing to 1
set hero.flash to 0
teach: Gravity adds 0.5 to the speed down every frame, up to a fastest fall of 10 pixels a frame.
set gravity to 0.5
set maxFall to 10
teach: The colours of his work jacket and hard hat (the swap step changes them).
set jacketColour to "#1e3a8a"
set hatColour to "#facc15"

define placeHero
    set hero.x to start.col times tile plus 4
    set hero.y to start.row times tile plus tile minus hero.h
    set hero.vx to 0
    set hero.vy to 0

run placeHero

teach: A fall into a pit (and, later, a zap) sends him back to the start, blinking for a second.
define sendBack
    run placeHero
    set hero.flash to 60

teach: Across: move by vx, then check the two corners on the side he's moving towards (head and feet). If either is inside a solid tile, push him back out to the edge of that tile.
define moveAcross
    increase hero.x by hero.vx
    set rightEdge to hero.x plus hero.w minus 0.01
    set feet to hero.y plus hero.h minus 0.01
    if hero.vx is more than 0 and (solidAt(rightEdge, hero.y) or solidAt(rightEdge, feet))
        set hero.x to Math.floor(rightEdge divided by tile) times tile minus hero.w
    if hero.vx is less than 0 and (solidAt(hero.x, hero.y) or solidAt(hero.x, feet))
        set hero.x to (Math.floor(hero.x divided by tile) plus 1) times tile

teach: Down: the same idea. Falling into a solid tile is landing: put his feet on its top, stop the fall, and remember he's on the ground. Rising into one bumps his head and ends the rise.
define moveDown
    increase hero.y by hero.vy
    set hero.onGround to false
    set rightEdge to hero.x plus hero.w minus 0.01
    set feet to hero.y plus hero.h minus 0.01
    if hero.vy is more than 0 and (solidAt(hero.x, feet) or solidAt(rightEdge, feet))
        set hero.y to Math.floor(feet divided by tile) times tile minus hero.h
        set hero.vy to 0
        set hero.onGround to true
    if hero.vy is less than 0 and (solidAt(hero.x, hero.y) or solidAt(rightEdge, hero.y))
        set hero.y to (Math.floor(hero.y divided by tile) plus 1) times tile
        set hero.vy to 0

every frame
    teach: Physics first. Gravity changes the speed; then the speed changes the position, across and then down, so a wall and a floor are never mixed up. Standing still, he sinks half a pixel into the floor each frame and is put back on top, which is how he knows he's standing.
    set hero.vy to Math.min(hero.vy plus gravity, maxFall)
    run moveAcross
    run moveDown
    teach: Below the bottom of the level means he fell into a pit.
    if hero.y is more than rows times tile
        run sendBack
    if hero.flash is more than 0
        decrease hero.flash
    teach: Then draw, shifted left by camX. While he's flashing he's drawn on only some frames, which looks like blinking.
    if hero.flash mod 8 is less than 5
        set drawX to hero.x minus camX
        draw a rectangle at drawX, hero.y plus 6 sized hero.w by 12 in jacketColour on game
        draw a rectangle at drawX, hero.y plus 14 sized hero.w by 2 in "#a16207" on game
        draw a rectangle at drawX plus 2, hero.y plus 18 sized 5 by 4 in "#334155" on game
        draw a rectangle at drawX plus 9, hero.y plus 18 sized 5 by 4 in "#334155" on game
        draw a rectangle at drawX plus 3, hero.y plus 3 sized 10 by 6 in "#f2c6a0" on game
        draw a rectangle at drawX plus 7 plus hero.facing times 3, hero.y plus 5 sized 2 by 2 in "#1f2937" on game
        draw a rectangle at drawX plus 1, hero.y sized 14 by 4 in hatColour on game`,

`component: mweb-bros-controls
name: Running and jumping
depth: walk
summary: The arrow keys run, and up or space jumps. Running uses keys that are held: every frame the speed across is set from the keys, so letting go stops him. Jumping uses a press: it sets a big upward speed, once, and only from the ground, and gravity does the rest, slowing the rise, turning it round and bringing him down.
learn: Keys held (running) and keys pressed (jumping); why a jump is one push upwards and gravity makes the arc; checking state (on the ground) before acting.
== mechanics
keep track of the keys
teach: How fast he runs (pixels per frame) and how hard he jumps (the upward speed a jump starts with).
set runSpeed to 2.4
set jumpPower to 10.5

teach: A jump is one push upwards: vy becomes negative, and gravity, adding 0.5 every frame, slows the rise, stops it at the top and brings him down. Only from the ground, or he could climb the sky.
define jump
    if hero.onGround
        set hero.vy to -jumpPower
        set hero.onGround to false

when the key "up" is pressed
    run jump

when the key "space" is pressed
    run jump

every frame
    teach: Running is held keys, checked every frame: no key, no speed, so he stops when you let go. facing remembers which way he looks.
    set hero.vx to 0
    if "left" is held
        set hero.vx to -runSpeed
        set hero.facing to -1
    if "right" is held
        set hero.vx to runSpeed
        set hero.facing to 1`,

`component: mweb-bros-camera
name: A camera that follows
depth: walk
summary: The level is 2,400 pixels long and the screen 480, so the view has to follow the hero. The camera is only a number, camX: everything in the level is drawn shifted left by it, so raising camX slides the world left and the view seems to move right. It aims to keep the hero a third of the way across the screen, never shows past either end of the level, and glides towards its aim rather than jumping.
learn: A camera as an offset (world position minus camX is screen position); keeping a number inside a range; easing (moving part of the way each frame).
== mechanics
every frame
    teach: Where the camera should be: with the middle of the hero a third of the way across the screen.
    set aim to hero.x plus hero.w divided by 2 minus width divided by 3
    teach: Never past either end of the level: no less than 0, no more than the level's width minus the screen's.
    set aim to Math.max(0, Math.min(aim, levelWidth minus width))
    teach: Glide: move a fifth of the way to the aim each frame, so it moves fast when it's far off and gently close by. It's kept to whole pixels so the tiles stay crisp, and the last few pixels are taken in one go.
    set camX to Math.round(camX plus (aim minus camX) times 0.2)
    if Math.abs(aim minus camX) is less than 3
        set camX to Math.round(aim)`,

`component: mweb-bros-swap
name: Two brothers
depth: walk
summary: Jacques jumps higher; Louis G. runs faster. Each brother is a small object holding his name, his colours, how fast he runs and how hard he jumps, and swapping copies the other one's numbers into runSpeed and jumpPower, the values the running and jumping already use. So the level can ask for both: a wall only Jacques can jump, a gap only Louis G. can clear. S swaps.
learn: Characters as data (objects in a list); one set of rules working for both by changing a few numbers; switching between two with 1 minus the current one.
== mechanics
teach: A brother is a name, the colours of his jacket and hat, how fast he runs and how hard he jumps.
define makeBrother using name, jacket, hat, runs, jumps
    give back { name: name, jacket: jacket, hat: hat, runs: runs, jumps: jumps }

create list brothers
add makeBrother("Jacques", "#1e3a8a", "#facc15", 2.4, 10.5) to brothers
add makeBrother("Louis G.", "#c2410c", "#f1f5f9", 3.8, 8.5) to brothers
set current to 0

teach: Becoming a brother copies his numbers into the values the rules already use. Nothing else in the game needs to know who you are.
define becomeBrother using n
    set current to n
    set chosen to item n of brothers
    set runSpeed to chosen.runs
    set jumpPower to chosen.jumps
    set jacketColour to chosen.jacket
    set hatColour to chosen.hat

teach: 1 minus 0 is 1 and 1 minus 1 is 0, so this goes back and forth between the two.
define swap
    run becomeBrother with 1 minus current

run becomeBrother with 0

when the key "s" is pressed
    run swap

every frame
    set active to item current of brothers
    draw text active.name at 12, 22 size 16 in active.hat on game
    draw text "S to swap" at 12, 40 size 12 in "#a8a2c4" on game`,

`component: mweb-bros-sparks
name: Sparks to collect
depth: walk
summary: Sparks float where the map has a *, some along the way and some where only one brother can reach. Touching one collects it: the test is the same overlapping boxes as in Invaders. Collected sparks are marked rather than taken out of the list, so the count of all of them stays for the score, and a new game can put them all back.
learn: Overlapping boxes again; marking items instead of removing them; Math.sin for a gentle bob.
== mechanics
set sparkCount to 0
create list sparks
teach: Two boxes overlap when each starts before the other ends, across and down, as in Invaders.
define overlaps using a, b
    give back a.x is less than b.x plus b.w and b.x is less than a.x plus a.w and a.y is less than b.y plus b.h and b.y is less than a.y plus a.h

teach: A spark is a small box in the middle of its tile. resetSparks makes one for every * in the map, none taken yet.
define resetSparks
    set sparks to an empty list
    for each spot in findAll("*")
        set spark to makeBox(spot.col times tile plus 6, spot.row times tile plus 6, 12, 12)
        set spark.taken to false
        add spark to sparks

run resetSparks
set sparkClock to 0

every frame
    increase sparkClock
    for each spark in sparks
        if not spark.taken and overlaps(hero, spark)
            set spark.taken to true
            increase sparkCount
        if not spark.taken
            teach: Each spark bobs up and down a little with Math.sin, each one out of step with its neighbours.
            set bob to Math.sin(sparkClock times 0.1 plus spark.x) times 2
            set sparkX to spark.x minus camX plus 6
            set sparkY to spark.y plus 6 plus bob
            draw a circle at sparkX, sparkY with radius 8 in "rgba(125, 211, 252, 0.25)" on game
            draw a circle at sparkX, sparkY with radius 4 in "#e0f2fe" on game
    draw text "Sparks {sparkCount} of {length of sparks}" at width minus 128, 22 size 16 in "#e0f2fe" on game`,

`component: mweb-bros-wires
name: Loose wires
depth: walk
summary: The first hazard: loose wires crackling on the ground wherever the map has a ^. They stay put, so the answer is to jump over them; touching one sends you back to the start. Each wire is a low box along the bottom of its tile, so the test is overlapping boxes once more, and only touching the wire itself counts, not the air above it.
learn: Hazards as boxes; hit boxes that fit the danger, not the whole tile; a little randomness to make something look alive.
== mechanics
teach: A wire is a low box, 20 wide and 10 high, lying along the bottom of its tile. The box is what you touch, so it's only as big as the wire.
create list wires
for each spot in findAll("^")
    add makeBox(spot.col times tile plus 2, spot.row times tile plus 14, 20, 10) to wires

every frame
    for each wire in wires
        if overlaps(hero, wire)
            run sendBack
        teach: The wire is three lines in a zigzag. A random flash on about a third of the frames makes it crackle.
        set wireX to wire.x minus camX
        draw a line from wireX, wire.y plus 10 to wireX plus 6, wire.y plus 2 in "#facc15" on game
        draw a line from wireX plus 6, wire.y plus 2 to wireX plus 13, wire.y plus 9 in "#facc15" on game
        draw a line from wireX plus 13, wire.y plus 9 to wireX plus 20, wire.y plus 1 in "#facc15" on game
        if Math.random() is less than 0.3
            draw a circle at wireX plus 6, wire.y plus 2 with radius 3 in "#fef9c3" on game`,

`component: mweb-bros-surges
name: Power surges
depth: walk
summary: The second hazard moves: power surges, crackling balls that patrol back and forth wherever the map has an s. Each one looks one step ahead and turns round at a wall or at the edge of its floor, so it never falls. Landing on top of one (falling, with your feet above it a moment ago) shorts it out and bounces you up; touching it any other way sends you back to the start.
learn: Simple enemy behaviour (patrol, look ahead, turn); telling a stomp from a bump by where you were last frame; removing things from play.
== mechanics
teach: A surge is a box with a direction: -1 is left, 1 is right.
create list surges

define resetSurges
    set surges to an empty list
    for each spot in findAll("s")
        set surge to makeBox(spot.col times tile plus 3, spot.row times tile plus 6, 18, 18)
        set surge.dir to -1
        set surge.gone to false
        add surge to surges

run resetSurges

every frame
    create list live
    for each surge in surges
        teach: Look one pixel ahead, on the side it's heading: a wall there, or no floor under it, means turn round. Otherwise take a step.
        set aheadX to surge.x minus 1
        if surge.dir is more than 0
            set aheadX to surge.x plus surge.w plus 1
        if solidAt(aheadX, surge.y plus 9) or not solidAt(aheadX, surge.y plus surge.h plus 4)
            set surge.dir to -surge.dir
        otherwise
            increase surge.x by surge.dir times 0.8
        teach: A stomp is a touch while falling, with the feet above the surge's top a moment ago (where they were before this frame's fall: now minus vy). Anything else is a zap.
        if overlaps(hero, surge)
            if hero.vy is more than 0 and hero.y plus hero.h minus hero.vy is at most surge.y plus 6
                set surge.gone to true
                set hero.vy to -6
            otherwise
                run sendBack
        if not surge.gone
            add surge to live
            set surgeX to surge.x minus camX plus 9
            set surgeY to surge.y plus 9
            draw a circle at surgeX, surgeY with radius 12 in "rgba(167, 139, 250, 0.25)" on game
            draw a circle at surgeX, surgeY with radius 7 in "#c4b5fd" on game
            draw a line from surgeX minus 10, surgeY to surgeX plus 10, surgeY plus random number from -5 to 5 in "#ede9fe" on game
    teach: Shorted-out surges leave the list: only live ones are kept.
    set surges to live`,

`component: mweb-bros-fusebox
name: The fuse box: power back on
depth: walk
summary: The goal, at the far end of the level where the map has an F. Touching the fuse box switches powerOn on, and because the street step has been asking powerOn every frame which colour each window and lamp should be, the whole street lights up behind the brothers at once. Enter (or a tap) plays again, and a new game puts back everything the level changed: the sparks, the surges, the power and where the brothers stand.
learn: A goal that changes the game's state; one value that many things read; restarting cleanly.
== mechanics
teach: The fuse box stands on the ground where the F is, a little taller than a tile.
set fuseSpot to first item of findAll("F")
set fuse to makeBox(fuseSpot.col times tile, fuseSpot.row times tile minus 8, 24, 32)

teach: A new game puts back everything that playing changed.
define restartLevel
    set powerOn to false
    run resetSparks
    set sparkCount to 0
    run resetSurges
    run placeHero
    set camX to 0

when the key "enter" is pressed
    if powerOn
        run restartLevel

every frame
    teach: Touching the fuse box turns the power on. One value changes; everything that reads it changes with it.
    if not powerOn and overlaps(hero, fuse)
        set powerOn to true
    set fuseX to fuse.x minus camX
    draw a rectangle at fuseX, fuse.y sized fuse.w by fuse.h in "#475569" on game
    draw a rectangle at fuseX plus 3, fuse.y plus 3 sized fuse.w minus 6 by fuse.h minus 6 in "#64748b" on game
    teach: The lever: down and red while the power is off, up and green once it's on.
    if powerOn
        draw a rectangle at fuseX plus 10, fuse.y plus 6 sized 4 by 10 in "#4ade80" on game
        teach: A dark panel behind the message keeps it readable over the lit windows.
        draw a rectangle at 90, 78 sized 300 by 86 in "rgba(13, 11, 26, 0.8)" on game
        draw text "Power restored" at 150, 110 size 28 in "#fde68a" on game
        draw text "Sparks {sparkCount} of {length of sparks}. Enter to play again." at 104, 136 size 14 in "#f5f3ff" on game
    otherwise
        draw a rectangle at fuseX plus 10, fuse.y plus 16 sized 4 by 10 in "#ef4444" on game`,

`component: mweb-bros-touch
name: Touch controls
depth: walk
summary: Four buttons under the game for a phone: Left and Right are held to run, Jump jumps and Swap swaps. Holding a button needs to know when the finger lifts, and there's no sentence for that yet, so two lines here are JavaScript: they listen for "pointerup" (and "pointercancel", when the phone takes the touch away) anywhere on the page, and stop running. Once the power is back, a tap on the game plays again.
learn: Pointer events (down, and up or cancel); a held button as a value that's set on touch and cleared on release; touch-action and user-select for buttons that are held.
== structure
teach: Four buttons in a row under the game.
    add a block called pad
        add a button called pad-left saying "Left" in group pad-key
        add a button called pad-right saying "Right" in group pad-key
        add a button called pad-swap saying "Swap" in group pad-key
        add a button called pad-jump saying "Jump" in group pad-key
== styling
style pad: display: grid, grid-template-columns: repeat(4, 1fr), gap 8, width: min(100%, 480px)
teach: touch-action: none and user-select: none stop a long press from scrolling the page or selecting the button's text.
create group pad-key: font: inherit, space inside 16 0, background #2a2340, text colour #ece9f8, no border, rounded corners 10, touch-action: none, user-select: none
== mechanics
teach: Which way a held button is running: -1 for left, 1 for right, 0 for neither.
set touchRun to 0

when pad-left is tapped
    set touchRun to -1

when pad-right is tapped
    set touchRun to 1

when pad-jump is tapped
    run jump

when pad-swap is tapped
    run swap

note: A finger lifting (or the phone taking the touch away) has no sentence yet, so this line and the last are JavaScript: anywhere on the page, it stops the running.
js: for (const type of ["pointerup", "pointercancel"]) document.addEventListener(type, () => {
    set touchRun to 0
js: });

when game is tapped
    if powerOn
        run restartLevel

every frame
    teach: While a button is held, it sets the speed the same way the arrow keys do.
    if touchRun is not 0
        set hero.vx to touchRun times runSpeed
        set hero.facing to touchRun
    if powerOn
        draw text "or tap the game" at 196, 156 size 12 in "#a8a2c4" on game`,

`component: mweb-bros-double
name: Your turn: a double jump
depth: hallway
summary: A change of your own: a second jump in mid-air. It needs care with timing: the first press both jumps and leaves the ground, so a press only counts as a double jump if he was already in the air before it, which this step remembers at the end of every frame. Landing gives the extra jump back. You fill in how many air jumps, the test, and how strong the second jump is; then try the wide pit as Jacques.
learn: Remembering last frame's state to tell two events apart; a counter that's refilled on landing; tuning by feel.
== mechanics
teach: How many jumps he gets in the air, and whether he was in the air at the end of the last frame.
set airJumpsMax to ‹how many jumps in mid-air, like 1›
set airJumps to airJumpsMax
set wasInAir to false

define airJump
    teach: Only if he was already in the air before this press, and has an air jump left.
    if ‹in the air since last frame, with a jump left: wasInAir and airJumps is more than 0›
        set hero.vy to ‹a little weaker than a full jump: -jumpPower times 0.85›
        decrease airJumps

when the key "up" is pressed
    run airJump

when the key "space" is pressed
    run airJump

every frame
    teach: On the ground, the air jumps come back. Last of all, remember whether he's in the air, for the next press.
    if hero.onGround
        set airJumps to airJumpsMax
    set wasInAir to not hero.onGround`,

`component: mweb-bros-levels
name: More levels, and a level editor
depth: horizon
summary: One level written as text rows is how many famous platformers began, and the format scales: more letters for more kinds of tile, one list of lines per level, and a level number that picks which list to load. Past a few levels, a level editor helps: you paint tiles and place things with the mouse and it saves the map as a file the game reads, so making levels becomes design rather than typing. Good levels teach one idea at a time, as this one does with the wall and the pit.
usual: Tiled or LDtk, free editors that save maps as JSON; Phaser, a JavaScript game framework that reads Tiled maps; Godot, if the game outgrows the browser.
learn: Loading a JSON file with fetch; a level number and a list of levels; checkpoints; how level designers introduce one idea at a time (the design of World 1-1 in classic platformers is often studied).`,

`component: mweb-bros-art
name: Sprites, animation and sound
depth: horizon
summary: The brothers are rectangles with hats, which is how platformers start: get the running and jumping to feel right, then give them their looks. Each brother becomes a sprite sheet with frames for standing, running and jumping, picked each frame from what he's doing and how fast. Tiles get a tile set, and sound does as much as art: a jump, a spark collected, a zap, and the hum of the street coming back on.
usual: Aseprite or the free Piskel to draw sprites and tiles; Kenney.nl and OpenGameArt for free tile sets; jsfxr for sound effects; Howler.js to play them.
learn: Sprite sheets and drawImage with a source rectangle; choosing an animation from the game's state (on the ground, moving, rising, falling); flipping a sprite to face left; short sound effects tied to events.`,

);
