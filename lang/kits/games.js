/* IntuCode kit pack: games. A rooftop platformer, a top-down garden, a one-thumb paper plane, a snake that
 * plays a tune, a colour-mixing sliding puzzle, a word of the day, vocabulary pairs, a lighthouse mystery
 * in the terminal and a pixel-art editor: each with its own twist, built step by step. */
(window.IntuiKitPacks = window.IntuiKitPacks || []).push(

// ---------------------------------------------------------------- Rooftop Runner

`kit: rooftop-runner
title: Rooftop Runner
layout: website
shelf: games
platform: web
about: A side-scrolling platformer at dusk: the city scrolls by itself, its skyline in layers that move at different speeds, and you jump from roof to roof collecting lights. Jump physics that feel good (gravity, short hops, coyote time) is the step you fill in.
steps: runner-city!, runner-roofs!, runner-player!, runner-jump*, runner-lights*, runner-art, runner-engine, runner-itch*`,

`component: runner-city
name: The city at dusk
depth: walk
summary: The stage everything else is drawn on: a drawing area, a dusk sky, and two rows of far-off buildings sliding past at different speeds. The far row moves at a fifth of the speed, the near row at half: nearer things pass faster, which is what makes a flat picture look deep (parallax). Every frame starts here by painting over the last one, so later steps draw on top, in step order.
learn: The drawing area (a canvas) and its x and y; every frame (requestAnimationFrame); lists; why drawing order matters.
== structure
page title is "Rooftop Runner"
add a main area called stage
    add a drawing area called game 480 by 270
    add a paragraph called help "Space or the up arrow to jump. Left and right to hold back or push on."
== styling
style the page: background #120e1f, text colour #e9e3f5, font-family: system-ui, space around 0, overflow: hidden
style stage: in a column, align-items: center, justify-content: center, at least 100vh tall, gap 12, space inside 12
style game: display: block, width 100%, at most 960 wide, height auto, rounded corners 8
style help: text colour #b9add6, text size 14, space around 0
== mechanics
note: The drawing area's size in its own pixels: 480 across, 270 down. x goes right from the left edge, y goes down from the top.
set width to the width of game
set height to the height of game
note: How fast the city goes by, in pixels each frame. It creeps up as you run.
set speed to 3
note: Lights collected so far (the Lights step counts them).
set score to 0
note: Two rows of far-off buildings, as heights, and how far each row has slid.
create list farRow with 70, 110, 85, 130, 95, 120, 75, 105, 90, 115, 80
create list nearRow with 45, 80, 60, 95, 50, 85, 65, 55, 90, 70, 60
set farShift to 0
set nearShift to 0

define drawRow using row, shift, colour
    note: Each building is 46 pixels wide with a 2 pixel gap, placed from the left, minus how far the row has slid.
    repeat length of row times counting with i
        set tall to item i of row
        draw a rectangle at i times 48 minus shift, height minus tall sized 46 by tall in colour on game

every frame
    note: The sky: deep violet above, a warm band low down, and the sun going down.
    fill game with "#2b1d4e"
    draw a rectangle at 0, height times 0.5 sized width by height times 0.5 in "#6b2f5f" on game
    draw a circle at width times 0.72, height times 0.62 with radius 30 in "#f6a65a" on game
    note: Slide each row. When a whole building has gone off the left, its height moves to the end of the row, so the row never runs out.
    increase farShift by speed times 0.2
    if farShift is at least 48
        decrease farShift by 48
        run farRow.push with farRow.shift()
    increase nearShift by speed times 0.5
    if nearShift is at least 48
        decrease nearShift by 48
        run nearRow.push with nearRow.shift()
    run drawRow with farRow, farShift, "#3d2b63"
    run drawRow with nearRow, nearShift, "#2a1f45"`,

`component: runner-roofs
name: Rooftops to run on
depth: walk
summary: The ground of the game: a line of roofs at different heights with gaps between them, all sliding left at the city's speed. Each roof is a small object (where it starts, how wide, how high its top is). When one goes off the left it's taken away and a new one is added after the last, with a random gap and height, so the run never ends and is never the same twice.
learn: Objects (named values bundled together); lists of objects; random numbers; taking from the front of a list and adding to the end.
== mechanics
note: Each roof is a small object: where it starts across (x), how wide it is (w) and how high its top is (top).
create list roofs

define makeRoof using x, w, top
    give back { x: x, w: w, top: top }

define addRoof
    note: The next roof starts after the last one, with a gap to jump.
    set prev to last item of roofs
    set gap to random number from 40 to 100
    set w to random number from 90 to 220
    set top to random number from 150 to 220
    add makeRoof(prev.x plus prev.w plus gap, w, top) to roofs

define resetRoofs
    set roofs to an empty list
    note: A long first roof to land on.
    add makeRoof(0, 320, 200) to roofs
    repeat 4 times
        run addRoof

run resetRoofs

every frame
    increase speed by 0.001
    for each roof in roofs
        set roof.x to roof.x minus speed
        draw a rectangle at roof.x, roof.top sized roof.w by height minus roof.top in "#15101f" on game
        draw a rectangle at roof.x, roof.top sized roof.w by 4 in "#d98bb5" on game
    note: A roof that has gone off the left is taken away, and a new one added on the right.
    set oldest to first item of roofs
    if oldest.x plus oldest.w is less than 0
        run roofs.shift
        run addRoof`,

`component: runner-player
name: The runner
depth: walk
summary: You. Every frame gravity adds a little downward speed, the speed moves the runner, and then the game checks for a roof underneath: if the feet were above a roof's top last frame and are at or below it now, they land on it. Jumping sets a big upward speed, only from a roof. Falling between roofs, or running into the side of a taller one, starts the run again. The order matters: move first, then check, then draw.
learn: Speed and gravity (velocity: speed with a direction); checking where things were last frame; keys pressed once and keys held down.
== mechanics
keep track of the keys
note: The runner: across (px), down to the top of the head (py), its size, and its speed up or down (vy: below 0 is rising).
set px to 90
set py to 120
set pw to 18
set ph to 28
set vy to 0
set onRoof to false
note: Gravity adds a little downward speed every frame; a jump sets a big upward one.
set gravity to 0.5
set jumpPower to 10

define restart
    run resetRoofs
    set py to 120
    set vy to 0
    set speed to 3
    set score to 0

define jump
    if onRoof
        set vy to -jumpPower
        set onRoof to false

when the key "space" is pressed
    run jump

when the key "up" is pressed
    run jump

every frame
    note: Move first: remember where the feet were, then fall.
    set oldFeet to py plus ph
    increase vy by gravity
    increase py by vy
    if "left" is held and px is more than 20
        decrease px by 2
    if "right" is held and px is less than width times 0.6
        increase px by 2
    note: Then check. Landing: the feet were above a roof's top last frame and are at or below it now.
    set onRoof to false
    for each roof in roofs
        set over to px plus pw is more than roof.x and px is less than roof.x plus roof.w
        if over and vy is at least 0 and oldFeet is at most roof.top and py plus ph is at least roof.top
            set py to roof.top minus ph
            set vy to 0
            set onRoof to true
        otherwise if over and py plus ph is more than roof.top plus 12
            note: Ran into the side of a taller roof.
            run restart
            stop the loop
    if py is more than height
        run restart
    note: Then draw: a body and an eye, looking ahead.
    draw a rectangle at px, py sized pw by ph in "#ffd9a8" on game
    draw a rectangle at px plus 10, py plus 6 sized 5 by 5 in "#2b1d4e" on game`,

`component: runner-jump
name: Jump physics that feel right
depth: hallway
summary: The difference between a jump that feels floaty and one that feels good is a few small rules every platformer uses. Gravity a little stronger on the way down; letting go of the key early for a short hop; and coyote time: for a few frames after running off a ledge you can still jump, like a cartoon coyote who hasn't looked down yet. The structure is here; you fill in the numbers and the coyote rule, then tune them by playing.
learn: Frames as a measure of time; tuning by feel (change one number, play, repeat); the forgiving jump tricks in games like Celeste, which their makers have written about.
== mechanics
note: How many frames the runner has been off a roof.
set airFrames to 0
note: When the jump key is let go early, a rise faster than this is slowed to it: a short hop.
set shortHop to ‹the rising speed a short hop keeps, like -4›

define coyoteJump
    note: Coyote time: for a moment after running off a ledge (falling, not rising from a jump), a jump still works.
    if not onRoof and vy is at least 0 and ‹off a roof for only a few frames: airFrames is at most 6›
        set vy to -jumpPower

when the key "space" is pressed
    run coyoteJump

when the key "up" is pressed
    run coyoteJump

every frame
    if onRoof
        set airFrames to 0
    otherwise
        increase airFrames
    note: Heavier on the way down: a jump rises, hangs, then drops quickly, which feels in control.
    if vy is more than 0
        increase vy by ‹a little extra gravity on the way down, like 0.3›
    note: Let go early for a short hop: still rising fast, and neither jump key held.
    if vy is less than shortHop and not "space" is held and not "up" is held
        set vy to shortHop`,

`component: runner-lights
name: Lights to collect
depth: walk
summary: Something to reach for: lights float above the roofs and slide past with the city. Touch one and it counts, then goes round to the right again at a new height, so there are always more coming. Touching is a distance check: if the light is within a few pixels of the runner across and down, it's caught. The count is drawn last, on top of everything.
learn: Distance in x and y (Math.abs, the size of a number without its sign); reusing objects instead of making new ones; drawing text.
== mechanics
note: Each light floats over the roofs: across (x) and down (y).
create list lights

define makeLight using x, y
    give back { x: x, y: y }

repeat 3 times counting with n
    add makeLight(width plus n times 180, 100) to lights

every frame
    for each light in lights
        set light.x to light.x minus speed
        set dx to Math.abs(light.x minus (px plus pw divided by 2))
        set dy to Math.abs(light.y minus (py plus ph divided by 2))
        set caught to dx is less than 16 and dy is less than 22
        if caught
            increase score
        if caught or light.x is less than -10
            note: Caught, or missed off the left: round to the right again, at a new height.
            set light.x to light.x plus 540
            set light.y to random number from 60 to 150
        draw a circle at light.x, light.y with radius 12 in "rgba(255, 214, 120, 0.3)" on game
        draw a circle at light.x, light.y with radius 6 in "#ffe7a3" on game
    draw text "Lights: {score}" at 12, 26 size 16 in "white" on game`,

`component: runner-art
name: Sprites and animation
depth: horizon
summary: The runner is a rectangle for now, which is how most games start: get it feeling right first, then make it pretty. Real game art is drawn as sprites, small pictures, often several frames of a run cycle side by side in one image (a sprite sheet). Each frame the game draws the right picture from the sheet, changing it every few frames so the legs move.
usual: Aseprite or the free Piskel to draw sprites; free art from Kenney.nl, OpenGameArt and itch.io; the canvas's drawImage to draw part of a sprite sheet.
learn: Loading a picture in JavaScript; drawImage with a source rectangle; counting frames to step through an animation; pixel art at small sizes (image-rendering: pixelated keeps it crisp).`,

`component: runner-engine
name: Levels and a game engine
depth: horizon
summary: Endless random roofs are one kind of platformer. Hand-made levels are the other: you draw them in a level editor as a grid of tiles, and the game loads them. Past a certain size (many levels, enemies, sound, menus) a game engine saves a lot of work: it brings tile maps, collisions, cameras and physics, so your sentences become the game's rules instead of its plumbing.
usual: Phaser (JavaScript, for the browser); Godot (free, with its own GDScript, and exports to the web); Tiled, the free map editor both can read.
learn: Tile maps (a level as a grid of numbers); loading a level file (JSON); a camera that follows the player; how an engine's update and draw loop compares to every frame here.`,

`component: runner-itch
name: Sharing it on itch.io
depth: horizon
summary: itch.io is where small and first games go to be played. A browser game like this one is uploaded as a zip of its files (index.html, style.css, script.js and any pictures), and people play it right on its page, on a computer or a phone, with nothing to install. It's free, you can set a price or let people pay what they want, and game jams there are a good way to finish things.
usual: itch.io (an HTML game: zip the files, upload, tick "played in the browser"); Newgrounds; GitHub Pages or Netlify for a page of your own.
learn: Zipping the files with index.html at the top; the embed size (480 by 270 here, or bigger); screenshots or a short GIF for the page; game jams (Ludum Dare, GMTK, and many on itch.io).`,

// ---------------------------------------------------------------- Garden Keeper

`kit: garden-keeper
title: Garden Keeper
layout: website
shelf: games
platform: web
about: A top-down game on a grid, seen from above: walk a gardener tile by tile, water the plants before they wilt, and keep away from the slugs that wander about. How the slugs wander, and what happens when they reach you, is the step you fill in.
steps: garden-lawn!, garden-plants!, garden-gardener!, garden-slugs*, garden-levels, garden-smooth, publish*`,

`component: garden-lawn
name: The garden grid
depth: walk
summary: A top-down game is a map seen from above, and this one is a grid: 12 tiles across, 8 down, 40 pixels each. Everything stands on a tile, by column and row, so a position is two whole numbers and moving is one tile at a time; a tile's pixels are its column and row times 40. This step draws the lawn, keeps the score (seconds the garden survives) and says when the game is over. R starts again.
learn: Grids: columns and rows, and turning them into pixels; loops inside loops; every second (setInterval) next to every frame.
== structure
page title is "Garden Keeper"
add a main area called stage
    add a drawing area called game 480 by 320
    add a block called bar
        add a paragraph called clock "0 seconds"
        add a paragraph called status "Arrow keys to walk. Space waters the plants next to you."
== styling
style the page: background #1f2a1c, text colour #eef3e8, font-family: system-ui, space around 0, overflow: hidden
style stage: in a column, align-items: center, justify-content: center, at least 100vh tall, gap 10, space inside 12
style game: display: block, width 100%, at most 720 wide, height auto, rounded corners 10
style bar: in a row, spread out, gap 16, width 100%, at most 720 wide
style clock: bold, font-variant-numeric: tabular-nums, space around 0
style status: text colour #b8c9ad, text size 14, space around 0
== mechanics
note: The garden is a grid of square tiles: 12 across, 8 down, 40 pixels each. Column 0 is on the left, row 0 at the top.
set tile to 40
set cols to 12
set rows to 8
note: Is the game on? And how many seconds the garden has been kept going: the score.
set playing to true
set seconds to 0

define gameOver using reason
    set playing to false
    set the text of status to "{reason} You kept the garden going for {seconds} seconds. Press R to start again."

every 1 second
    if playing
        increase seconds
        set the text of clock to "{seconds} seconds"

note: R starts a new game. Each step that has something to set up listens for R itself.
when the key "r" is pressed
    set seconds to 0
    set playing to true
    set the text of clock to "0 seconds"
    set the text of status to "Arrow keys to walk. Space waters the plants next to you."

every frame
    note: The lawn: a checkerboard of two greens, tile by tile. A tile's pixels are its column and row times the tile size.
    repeat rows times counting with r
        repeat cols times counting with c
            set shade to "#8cbf6a"
            if (c plus r) mod 2 is 0
                set shade to "#83b562"
            draw a rectangle at c times tile, r times tile sized tile by tile in shade on game`,

`component: garden-plants
name: Plants that need water
depth: walk
summary: What you're looking after. Each plant stands on a tile and has water from 100 down to 0; every second each one dries out a little, and one that reaches 0 has wilted, which ends the game. They start with different amounts, so they don't all need you at once. The colour and the blue bar under each plant show how thirsty it is, so the player can plan a route.
learn: Lists of objects; timers that change the game while it's drawn every frame; showing a number as a colour or a bar.
== mechanics
note: Each plant stands on a tile and has water, from 100 (freshly watered) down to 0 (wilted).
create list plants

define makePlant using col, row, water
    give back { col: col, row: row, water: water }

define plantGarden
    set plants to an empty list
    for each spot in [[2, 1], [6, 2], [9, 1], [3, 5], [7, 6], [10, 4]]
        add makePlant(item 0 of spot, item 1 of spot, random number from 60 to 100) to plants

run plantGarden

when the key "r" is pressed
    run plantGarden

note: Every second each plant dries out a little. One that reaches 0 has wilted, and the game is over.
every 1 second
    if playing
        for each plant in plants
            decrease plant.water by 3
            if plant.water is at most 0
                set plant.water to 0
                run gameOver with "A plant wilted."

every frame
    for each plant in plants
        set x to plant.col times tile
        set y to plant.row times tile
        note: Green while it has water, yellowing below half, brown when nearly gone.
        set leaf to "#2d6a4f"
        if plant.water is less than 50
            set leaf to "#a3a13a"
        if plant.water is less than 20
            set leaf to "#8d6e4f"
        draw a rectangle at x plus 18, y plus 18 sized 4 by 14 in "#40513b" on game
        draw a circle at x plus 20, y plus 16 with radius 10 in leaf on game
        note: How much water is left, as a blue bar under the plant: 28 pixels when full.
        set bar to 28 times plant.water divided by 100
        draw a rectangle at x plus 6, y plus 34 sized 28 by 4 in "#33402d" on game
        draw a rectangle at x plus 6, y plus 34 sized bar by 4 in "#4cc9f0" on game`,

`component: garden-gardener
name: The gardener
depth: walk
summary: You, seen from above. Each arrow key moves the gardener one tile, but never off the garden: the new tile is worked out first and only taken if it's inside. Space waters every plant next to the gardener, diagonals included, which is a neat test: a plant is next to you when it's at most one column and at most one row away. Because the gardener is drawn after the plants, you're always on top.
learn: Moving on a grid; checking a move before making it; Math.abs, the distance between two numbers whichever is bigger.
== mechanics
note: The gardener's tile: column and row.
set col to 0
set row to 0

define walk using dc, dr
    note: Work out the new tile first, and only move if it's still in the garden.
    set newCol to col plus dc
    set newRow to row plus dr
    if playing and newCol is at least 0 and newCol is less than cols and newRow is at least 0 and newRow is less than rows
        set col to newCol
        set row to newRow

when the key "left" is pressed
    run walk with -1, 0

when the key "right" is pressed
    run walk with 1, 0

when the key "up" is pressed
    run walk with 0, -1

when the key "down" is pressed
    run walk with 0, 1

note: Space waters every plant next to the gardener, diagonals too: at most one column and one row away.
when the key "space" is pressed
    if playing
        for each plant in plants
            if Math.abs(plant.col minus col) is at most 1 and Math.abs(plant.row minus row) is at most 1
                set plant.water to 100

when the key "r" is pressed
    set col to 0
    set row to 0

every frame
    set x to col times tile
    set y to row times tile
    draw a circle at x plus 20, y plus 25 with radius 12 in "#3d5a80" on game
    draw a circle at x plus 20, y plus 13 with radius 8 in "#f2cc8f" on game
    draw a rectangle at x plus 9, y plus 4 sized 22 by 5 in "#e9c46a" on game`,

`component: garden-slugs
name: Slugs that wander
depth: hallway
summary: The trouble in the garden. Twice a second each slug picks a way at random (or stays put) and moves one tile if the new tile is inside the garden. A slug that reaches the gardener ends the game; one sitting on a plant nibbles it, so it dries out faster. Wandering at random is the simplest kind of game behaviour, and surprisingly lively. The structure is here; you write the three tests: inside the garden, on your tile, on a plant's tile.
learn: Random choices; comparing two positions (same column and same row); how game characters decide what to do (their behaviour, or AI).
== mechanics
note: Each slug stands on a tile, like everything else in the garden.
create list slugs

define makeSlug using col, row
    give back { col: col, row: row }

define placeSlugs
    set slugs to an empty list
    add makeSlug(11, 7) to slugs
    add makeSlug(11, 0) to slugs
    add makeSlug(5, 7) to slugs

run placeSlugs

when the key "r" is pressed
    run placeSlugs

note: Twice a second every slug picks a way to go: 0 right, 1 left, 2 down, 3 up, or 4 to stay put.
every 0.5 seconds
    if playing
        for each slug in slugs
            set way to random number from 0 to 4
            set newCol to slug.col
            set newRow to slug.row
            if way is 0
                increase newCol
            otherwise if way is 1
                decrease newCol
            otherwise if way is 2
                increase newRow
            otherwise if way is 3
                decrease newRow
            note: A slug only moves if the new tile is still in the garden.
            if ‹the new tile is inside the garden: newCol is at least 0 and newCol is less than cols and newRow is at least 0 and newRow is less than rows›
                set slug.col to newCol
                set slug.row to newRow

every frame
    for each slug in slugs
        if playing and ‹the slug is on the gardener's tile: slug.col is col and slug.row is row›
            run gameOver with "A slug got to you."
        note: A slug on a plant's tile nibbles it, so it dries out faster.
        for each plant in plants
            if ‹the slug and the plant are on the same tile: slug.col is plant.col and slug.row is plant.row›
                decrease plant.water by 0.05
        set x to slug.col times tile
        set y to slug.row times tile
        draw a circle at x plus 15, y plus 26 with radius 8 in "#a47148" on game
        draw a circle at x plus 25, y plus 24 with radius 7 in "#b5835a" on game
        draw a rectangle at x plus 28, y plus 13 sized 2 by 8 in "#5c3d2e" on game`,

`component: garden-levels
name: Levels you draw
depth: horizon
summary: The plants and slugs are placed by a list of spots. A level editor lets you draw that instead: paint the garden as a grid of tiles (grass, path, pond, fence), place the plants and slugs, and save it as a file the game loads. Levels can then get harder one by one: more plants, faster drying, cleverer slugs, walls to walk round.
usual: Tiled, the free map editor (it saves maps as JSON); a list of lists for the grid in your own code; LDtk, another editor made for 2D games.
learn: A grid as a list of rows (a 2D array); loading a JSON file with fetch; walls and tiles you can't walk on; difficulty that rises gently.`,

`component: garden-smooth
name: Smooth steps and tile art
depth: horizon
summary: The gardener jumps from tile to tile. Most grid games still move on the grid but draw the walk in between, sliding a few pixels each frame until they arrive. Tile art (grass, flowers, a gardener facing each way) usually comes as a tile set: one picture with every tile in a grid, drawn piece by piece.
usual: Tile sets from Kenney.nl, OpenGameArt or itch.io; Aseprite or Piskel to draw your own; the canvas's drawImage to draw one tile from a set.
learn: Moving smoothly between two points (interpolation, or lerp); sprites for each direction; drawImage with a source rectangle.`,

// ---------------------------------------------------------------- Paper Plane

`kit: paper-plane
title: Paper Plane
layout: website
shelf: games
platform: phone
about: A one-thumb phone game: tap to lift a paper plane through gaps in the clouds. The twist is the wind, which changes every few seconds and pushes the plane up or down; drifting streaks show which way it's turning before you feel it. Your best score is kept on the phone.
steps: plane-sky!, plane-flight!, plane-gaps!, plane-wind*, plane-best*, installable*, plane-juice, app-stores`,

`component: plane-sky
name: The sky
depth: walk
summary: The stage, shaped like a phone held upright: 360 by 640, scaled to fit the screen. It paints the sky and slow clouds every frame, and holds what the whole game shares: whether a flight is on, the score, and newFlight, which starts one. Each later step adds its own setup tool to the list setups, and newFlight runs them all, so a new flight resets every part without this step knowing what the parts are.
learn: A drawing area sized for a phone; touch-action, which stops the browser scrolling or zooming when you tap; tools (functions) kept in a list.
== structure
page title is "Paper Plane"
add a main area called stage
    add a drawing area called game 360 by 640
== styling
style the page: background #0b2545, space around 0, overflow: hidden, font-family: system-ui
style stage: in a column, align-items: center, justify-content: center, at least 100vh tall
style game: display: block, max-width: 100vw, max-height: 100vh, touch-action: none
== mechanics
note: The drawing area: 360 across and 640 down, a phone held upright.
set width to the width of game
set height to the height of game
note: Is a flight going on? And the score: gaps flown through.
set playing to false
set score to 0
note: Each step adds the tool that sets its part up for a new flight; newFlight runs them all.
create list setups

define newFlight
    for each setup in setups
        run setup
    set score to 0
    set playing to true

define crash
    set playing to false

note: Clouds far away, drifting slowly: across, down and how big.
define makeCloud using x, y, size
    give back { x: x, y: y, size: size }

create list clouds with makeCloud(40, 120, 30), makeCloud(250, 260, 40), makeCloud(150, 470, 26)

every frame
    fill game with "#9ad1f5"
    for each cloud in clouds
        set cloud.x to cloud.x minus 0.3
        if cloud.x is less than -80
            set cloud.x to width plus 80
        draw a circle at cloud.x, cloud.y with radius cloud.size in "#c6e6fb" on game
        draw a circle at cloud.x plus cloud.size, cloud.y plus 8 with radius cloud.size times 0.8 in "#c6e6fb" on game`,

`component: plane-flight
name: The plane
depth: walk
summary: The plane stays still across the screen while the world moves past it; it only goes up and down. Every frame gravity adds a little downward speed, and a tap sets a sharp upward one: that's the whole control, which is why one thumb is enough. Leaving the top or bottom of the screen is a crash. The plane is four lines whose nose tips with its speed, so you can see it climbing or diving.
learn: Speed and gravity; one input that means different things (start, then lift); drawing a shape from lines.
== mechanics
note: The plane: across (planeX, fixed: the world moves past it), down (planeY), and its speed up or down (vy: below 0 is rising).
set planeX to 100
set planeY to 300
set vy to 0
note: Gravity pulls a little every frame; a tap lifts.
set gravity to 0.3
set lift to 6.5

define resetPlane
    set planeY to 300
    set vy to 0

add resetPlane to setups

note: One tap does everything: starts a flight, or lifts the plane. Space does the same on a computer.
define flap
    if not playing
        run newFlight
    set vy to -lift

when the screen is tapped
    run flap

when the key "space" is pressed
    run flap

every frame
    if playing
        increase vy by gravity
        increase planeY by vy
        note: The top and bottom of the screen are the edges of the world.
        if planeY is less than 0 or planeY is more than height
            run crash
    note: A paper plane in four lines, its nose tipped up while it rises and down while it falls.
    set tip to vy times 1.5
    set noseX to planeX plus 22
    set noseY to planeY plus tip
    set tailX to planeX minus 18
    draw a line from noseX, noseY to tailX, planeY minus 12 minus tip in "white" on game
    draw a line from tailX, planeY minus 12 minus tip to planeX minus 6, planeY plus 2 in "white" on game
    draw a line from planeX minus 6, planeY plus 2 to noseX, noseY in "white" on game
    draw a line from planeX minus 6, planeY plus 2 to tailX, planeY plus 8 minus tip in "#d0dbe5" on game`,

`component: plane-gaps
name: Gaps in the clouds
depth: walk
summary: Walls of cloud slide in from the right, each with a gap at a random height. Flying past one is a point; touching one is a crash. The test for touching has two parts: the plane is level with the wall (across), and it's not inside the gap (down). Walls that leave on the left come back after the last one with a new gap, so three walls are enough for a flight that never ends.
learn: Rectangles overlapping (collision); counting something once (a passed flag); reusing objects that leave the screen.
== mechanics
note: Each wall is a column of cloud with a gap to fly through: across (x), where the gap starts (gapTop), and whether it's been passed.
create list walls
set gapSize to 180
set wallWidth to 60
set spacing to 230

define makeWall using x
    note: The gap starts somewhere from 120 pixels down to 120 pixels above the bottom, so the next one is always within reach.
    set lowest to height minus gapSize minus 120
    set wall to { x: x }
    set wall.gapTop to random number from 120 to lowest
    set wall.passed to false
    give back wall

define resetWalls
    set walls to an empty list
    repeat 3 times counting with n
        add makeWall(width plus 120 plus n times spacing) to walls

add resetWalls to setups
run resetWalls

every frame
    for each wall in walls
        if playing
            set wall.x to wall.x minus 2.5
        set gapBottom to wall.gapTop plus gapSize
        note: Past the wall: a point, once per wall.
        if playing and not wall.passed and wall.x plus wallWidth is less than planeX
            set wall.passed to true
            increase score
        note: A crash: the plane is level with the wall across, and not inside the gap.
        set level to planeX plus 20 is more than wall.x and planeX minus 18 is less than wall.x plus wallWidth
        if playing and level and (planeY minus 10 is less than wall.gapTop or planeY plus 10 is more than gapBottom)
            run crash
        draw a rectangle at wall.x, 0 sized wallWidth by wall.gapTop in "#f1f5f9" on game
        draw a rectangle at wall.x, gapBottom sized wallWidth by height minus gapBottom in "#f1f5f9" on game
    note: A wall gone off the left comes back after the last one, with a new gap.
    set oldest to first item of walls
    if oldest.x is less than -wallWidth
        run walls.shift
        set newest to last item of walls
        add makeWall(newest.x plus spacing) to walls
    draw text "{score}" at width / 2 minus 12, 70 size 44 in "white" on game
    if not playing
        draw text "Tap to fly" at width / 2 minus 72, height / 2 size 32 in "#0b2545" on game`,

`component: plane-wind
name: The changing wind
depth: hallway
summary: The twist. Every few seconds the wind picks a new strength, pushing the plane up or down a little each frame, so the same tap does more or less than it did. It doesn't jump: it moves a small part of the way towards its new strength every frame, so changes feel like weather. The streaks follow the new wind straight away, a second or two before the plane feels it: a warning you learn to read. You fill in the new wind, the catching up and the drift.
learn: Smoothing a change by moving part of the way each frame (easing, or lerp); showing a game's hidden state so it's fair; random numbers below zero.
== mechanics
note: The wind: how hard it pushes the plane each frame (below 0 lifts, above 0 pushes down). It blows towards target, which changes every few seconds.
set wind to 0
set target to 0
note: Streaks across the sky show where the wind is heading.
create list streaks

define makeStreak using x, y
    give back { x: x, y: y }

repeat 14 times
    add makeStreak(random number from 0 to width, random number from 0 to height) to streaks

every 4 seconds
    set target to ‹a new wind: random number from -3 to 3, divided by 40›

every frame
    note: The wind moves a small part of the way to its target every frame, so it changes gradually.
    increase wind by ‹a small part of the way to the target: (target minus wind) times 0.02›
    if playing
        increase vy by wind
    for each streak in streaks
        set streak.x to streak.x minus 6
        set streak.y to streak.y plus ‹how far a streak drifts up or down each frame: target times 60›
        note: A streak that leaves one side comes back on the other.
        if streak.x is less than -30
            set streak.x to width plus random number from 0 to 60
        if streak.y is less than 0
            increase streak.y by height
        if streak.y is more than height
            decrease streak.y by height
        draw a line from streak.x, streak.y to streak.x plus 24, streak.y minus target times 240 in "rgba(255, 255, 255, 0.6)" on game`,

`component: plane-best
name: Best score, kept on the phone
depth: walk
summary: A score is more fun with something to beat. The best is saved in the browser's own storage (localStorage) under a name, so it's still there tomorrow, even with no internet. When the score passes it, it's saved again at once, so a crash or a closed tab never loses it. It's only on this phone, in this browser: a leaderboard shared with friends needs a server.
learn: localStorage: saving and loading by a name; nothing (null) for a name that was never saved; why storage on one device stays on that device.
== mechanics
note: The best score is kept in the browser, so it's still there next time.
load "paper-plane-best" from the browser and store in best
if best is nothing
    set best to 0

every frame
    if score is more than best
        set best to score
        save best in the browser as "paper-plane-best"
    draw text "Best {best}" at 16, 34 size 18 in "#0b2545" on game`,

`component: plane-juice
name: Sound and game feel
depth: horizon
summary: Game makers call it juice: the small touches that make a simple game feel alive. A soft whoosh on each tap, a chime for every gap, paper bits and a little shake on a crash, a buzz from the phone. None of it changes the rules, and players notice at once when it's missing. Add one touch at a time and keep the ones that feel right.
usual: jsfxr or ChipTone to make sound effects; Howler.js to play them; the Web Audio API underneath (play a note uses it); navigator.vibrate for a buzz on Android.
learn: The talk "Juice it or lose it" (Martin Jonasson and Petri Purho); particles (lists of short-lived dots); easing; why phones only play sound after a first tap.`,

// ---------------------------------------------------------------- Melody Snake

`kit: melody-snake
title: Melody Snake
layout: website
shelf: games
platform: web
about: Snake, with a tune in it: steer the snake to the fruit, grow longer, and don't hit the walls or yourself. Each fruit you eat plays the next note of a melody, so playing well plays the music. Turning note numbers into pitches is the step you fill in.
steps: snake-board!, snake-body!, snake-fruit!, snake-melody*, snake-music, snake-scores, publish`,

`component: snake-board
name: The board
depth: walk
summary: The playing field: a grid of 20 by 20 cells, 20 pixels each, with a strip underneath for the tune. Snake moves in whole cells, so every position is a column and a row. This step also holds what the game shares: whether a game is on, the score, and newGame, which runs every step's own setup tool from the list setups, so a new game resets the snake and the fruit without this step knowing about either.
learn: Grids; drawing lines; tools (functions) kept in a list and run one after another.
== structure
page title is "Melody Snake"
add a main area called stage
    add a drawing area called game 400 by 440
    add a paragraph called help "Arrow keys to steer. Each fruit plays the next note of the tune."
== styling
style the page: background #0b0e16, text colour #e6e9f2, font-family: system-ui, space around 0, overflow: hidden
style stage: in a column, align-items: center, justify-content: center, at least 100vh tall, gap 10, space inside 12
style game: display: block, width 100%, at most 520 wide, height auto, rounded corners 10
style help: text colour #9aa3b8, text size 14, space around 0
== mechanics
note: The board is a grid: 20 cells across and 20 down, 20 pixels each. Below it, a strip for the tune.
set cell to 20
set cols to 20
set rows to 20
set playing to false
set score to 0
note: Each step adds the tool that sets its part up for a new game; newGame runs them all.
create list setups

define newGame
    for each setup in setups
        run setup
    set score to 0
    set playing to true

define gameOver
    set playing to false

every frame
    fill game with "#10141f"
    note: Faint lines between the cells, so you can see the grid the snake moves on.
    repeat cols plus 1 times counting with c
        draw a line from c times cell, 0 to c times cell, rows times cell in "#1b2233" on game
    repeat rows plus 1 times counting with r
        draw a line from 0, r times cell to cols times cell, r times cell in "#1b2233" on game`,

`component: snake-body
name: The snake
depth: walk
summary: The snake is a list of cells, head first. Ten times a second it moves: a new head goes on the front, one cell along, and the tail comes off the end (unless it's growing), so the body follows the head without each part being moved. Running off the board or into itself ends the game. A classic catch: a turn is checked against the way the snake last moved, not the last key, or two quick presses could turn it back into its own neck.
learn: Lists as a queue (add to the front, take from the end); timers; checking a move before making it.
== mechanics
note: The snake is a list of cells, head first. Each cell is an object with a column and a row.
create list snake
note: Which way it goes each step: one cell across (dx) and down (dy). movedDx and movedDy are the way it actually went last.
set dx to 1
set dy to 0
set movedDx to 1
set movedDy to 0
note: How many more steps it grows for (eating adds to this).
set grow to 0

define makeCell using col, row
    give back { col: col, row: row }

define onSnake using spot
    for each part in snake
        if part.col is spot.col and part.row is spot.row
            give back true
    give back false

define resetSnake
    set snake to an empty list
    add makeCell(8, 10) to snake
    add makeCell(7, 10) to snake
    add makeCell(6, 10) to snake
    set dx to 1
    set dy to 0
    set movedDx to 1
    set movedDy to 0
    set grow to 0

add resetSnake to setups
run resetSnake

define turn using newDx, newDy
    if not playing
        run newGame
    note: Never straight back into its own neck: the opposite of the way it last moved is ignored.
    if newDx is not -movedDx or newDy is not -movedDy
        set dx to newDx
        set dy to newDy

when the key "left" is pressed
    run turn with -1, 0

when the key "right" is pressed
    run turn with 1, 0

when the key "up" is pressed
    run turn with 0, -1

when the key "down" is pressed
    run turn with 0, 1

note: Ten steps a second: the tail comes off (unless growing), then the new head goes on, if it's on the board and not on the snake.
every 0.1 seconds
    if playing
        set head to first item of snake
        set next to makeCell(head.col plus dx, head.row plus dy)
        set movedDx to dx
        set movedDy to dy
        if grow is more than 0
            decrease grow
        otherwise
            run snake.pop
        set offBoard to next.col is less than 0 or next.col is at least cols or next.row is less than 0 or next.row is at least rows
        if offBoard or onSnake(next)
            run gameOver
        otherwise
            run snake.unshift with next

every frame
    for each part in snake
        draw a rectangle at part.col times cell plus 2, part.row times cell plus 2 sized cell minus 4 by cell minus 4 in "#5fd38d" on game
    set head to first item of snake
    draw a rectangle at head.col times cell plus 1, head.row times cell plus 1 sized cell minus 2 by cell minus 2 in "#b8f5cc" on game`,

`component: snake-fruit
name: Fruit and the score
depth: walk
summary: Something to chase. The fruit sits on a random cell that isn't under the snake (if the cell it picks is taken, it picks again). When the head reaches it, the score goes up, the snake grows by two cells, and a new fruit appears. The check runs every frame, so it never misses the moment the head arrives.
learn: Random positions; a loop that tries again until something fits (while); comparing two positions.
== mechanics
note: The fruit's cell.
set fruit to makeCell(14, 10)

define placeFruit
    note: A random cell, picked again while it's under the snake. Columns and rows count from 0, so the last is one less than how many there are.
    set lastCol to cols minus 1
    set lastRow to rows minus 1
    set fruit to makeCell(random number from 0 to lastCol, random number from 0 to lastRow)
    while onSnake(fruit)
        set fruit to makeCell(random number from 0 to lastCol, random number from 0 to lastRow)

add placeFruit to setups

every frame
    set head to first item of snake
    if playing and head.col is fruit.col and head.row is fruit.row
        increase score
        increase grow by 2
        run placeFruit
    draw a circle at fruit.col times cell plus 10, fruit.row times cell plus 10 with radius 7 in "#ff6b6b" on game
    draw text "{score}" at 10, 24 size 18 in "white" on game
    if not playing
        draw text "Press an arrow key to start" at 80, 190 size 20 in "white" on game`,

`component: snake-melody
name: A melody, one fruit at a time
depth: hallway
summary: The twist: the tune is a list of note numbers, and each fruit plays the next one, so a good game plays the whole melody. Note numbers are how keyboards and MIDI count notes (60 is middle C, one up is the next key, black keys included); a pitch in hertz doubles every 12 notes, which is why the formula has a power of 2 in it. You fill in the formula and going back to the start after the last note.
learn: Notes as numbers (MIDI); the 2 to the power of n over 12 rule (equal temperament); the remainder (mod) to go round a list; the Web Audio API.
== mechanics
note: The tune, as note numbers: 60 is middle C, and each one up is the next key on a piano, black keys included. This is the start of Ode to Joy, by Beethoven.
create list tune with 64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62
note: The next place in the tune, and the score the melody last heard.
set place to 0
set heard to 0

define frequency using noteNumber
    note: A note's pitch in hertz: 440 is the A above middle C (note 69), and the pitch doubles every 12 notes up.
    give back 440 times Math.pow(2, ‹how many octaves away from note 69: (noteNumber minus 69) divided by 12›)

every frame
    note: The score went up, so a fruit was eaten: play the next note.
    if score is more than heard
        set heard to score
        play a note of frequency(item place of tune) for 0.3 seconds
        set place to ‹the next place, back to the start after the last note: (place plus 1) mod length of tune›
    note: A new game set the score back to 0: start the tune again.
    if score is less than heard
        set heard to score
        set place to 0
    note: The tune along the bottom: a dot per note, higher notes higher up, and the next one to play in gold.
    repeat length of tune times counting with k
        set pitch to item k of tune
        set dotY to 432 minus (pitch minus 58) times 3
        set shade to "#3b4a6b"
        if k is place
            set shade to "#ffd166"
        draw a circle at 32 plus k times 24, dotY with radius 5 in shade on game`,

`component: snake-music
name: Instruments instead of beeps
depth: horizon
summary: Each note here is a plain tone switched on and off, which sounds like a beep and can click at the ends. Instruments shape every note: it swells in and fades out (an envelope), mixes several tones, or plays a recording of a real instrument at the right pitch. With that, the tune can have chords, a bass line, or come from any song as a MIDI file.
usual: Tone.js (synths, envelopes and sampled instruments for the browser); soundfont-player; MIDI files read with @tonejs/midi.
learn: Envelopes (attack, decay, sustain, release); gain nodes in the Web Audio API; reading a MIDI file; timing music to the game.`,

`component: snake-scores
name: A high-score table online
depth: horizon
summary: The score is gone when the page closes. A table everyone shares needs a server: the game sends the score when a game ends, the server keeps it in a database, and the page asks for the top ten. The honest difficulty is cheating: anyone can send any number, so serious games check scores on the server or replay the moves.
usual: A small server of your own (the Online service kit builds one in Python); hosted databases like Supabase or Firebase; ready-made leaderboard services.
learn: Sending data to a server (fetch with POST); databases; why the server must never trust what a page sends.`,

// ---------------------------------------------------------------- Colour Merge

`kit: colour-merge
title: Colour Merge
layout: website
shelf: games
platform: phone
about: A sliding-tile puzzle in the spirit of 2048, where tiles are coloured lights: swipe (or use the arrow keys) and every tile slides as far as it can. Two tiles that share no light mix, the way a screen mixes red, green and blue: red and green make yellow, and all three make white, which clears itself away. The mixing rule is the step you fill in.
steps: merge-board!, merge-slide!, merge-mix*, merge-swipe*, merge-motion, installable*, app-stores`,

`component: merge-board
name: The board of lights
depth: walk
summary: A 4 by 4 board of cells, each empty or holding a colour. Colours are numbers made of lights, the way a screen makes them: red is 4, green 2, blue 1, and a mix is their sum, so yellow is 6 and white 7. That's why one list of paints, looked up by number, can draw any tile. Each tile also shows a letter, so the game works for people who see colours differently. New tiles are always a single light.
learn: Numbers that stand for things (a colour as a sum of lights); a list used as a lookup table; a grid stored as one list, row after row (cell k is in row k divided by 4, rounded down, and column k mod 4).
== structure
page title is "Colour Merge"
add a main area called stage
    add a drawing area called game 360 by 440
    add a button called again saying "New game"
== styling
style the page: background #14151f, text colour #f1f1f6, font-family: system-ui, space around 0
style stage: in a column, align-items: center, justify-content: center, at least 100vh tall, gap 14
style game: display: block, max-width: 100vw, height auto, touch-action: none, rounded corners 12
style again: font: inherit, space inside 12 28, background #2f3247, text colour #f1f1f6, no border, rounded corners 999, hand cursor
== mechanics
note: The board: 4 by 4 cells, 90 pixels each, under an 80 pixel strip for the score.
set size to 4
set cellSize to 90
set boardTop to 80
set score to 0
note: Each colour is a sum of lights: red 4, green 2, blue 1. So 6 is yellow (red and green), 7 is white (all three), and 0 is an empty cell. Paints and letters are looked up by that number.
create list paints with "#2a2d3e", "#3a86ff", "#38b000", "#00b4d8", "#e63946", "#c77dff", "#ffd60a", "#ffffff"
create list letters with "", "B", "G", "C", "R", "M", "Y", "W"
create list primaries with 1, 2, 4
note: The 16 cells, row by row: each is an object holding its colour.
create list cells

define makeCell using colour
    give back { colour: colour }

define spawn
    note: A new red, green or blue tile in a random empty cell.
    create list free
    for each cell in cells
        if cell.colour is 0
            add cell to free
    if length of free is more than 0
        set chosen to random item from free
        set chosen.colour to random item from primaries

define resetBoard
    set cells to an empty list
    repeat 16 times
        add makeCell(0) to cells
    set score to 0
    run spawn
    run spawn

run resetBoard

when again is clicked
    run resetBoard

every frame
    fill game with "#1d1f2b"
    draw text "Score {score}" at 16, 52 size 28 in "white" on game
    repeat 16 times counting with k
        set cell to item k of cells
        set x to (k mod size) times cellSize
        set y to boardTop plus Math.floor(k / size) times cellSize
        draw a rectangle at x plus 4, y plus 4 sized cellSize minus 8 by cellSize minus 8 in item cell.colour of paints on game
        draw text item cell.colour of letters at x plus 36, y plus 56 size 28 in "#14151f" on game`,

`component: merge-slide
name: Sliding the tiles
depth: walk
summary: The arrow keys slide every tile as far as it can go. The trick that keeps this short is to treat each row or column as a line of four cells, listed from the side the tiles slide towards: take the colours out (leaving gaps behind), put them back from the front, and the slide is done, in any direction. A new tile appears only if something actually moved, which is what makes the puzzle a puzzle.
learn: Breaking a 2D problem into 1D lines; one tool for four directions; a hook (mixRule) a later step can fill in.
== mechanics
note: The Mix step puts its rule here. Until then, tiles only slide.
set mixRule to nothing

define lineOf using direction, n
    note: The cells of row or column n, listed from the side the tiles slide towards.
    create list line
    repeat size times counting with i
        set back to size minus 1 minus i
        if direction is "left"
            add n times size plus i to line
        otherwise if direction is "right"
            add n times size plus back to line
        otherwise if direction is "up"
            add i times size plus n to line
        otherwise
            add back times size plus n to line
    give back line

define slideLine using line
    note: Take the colours out of the line, in order, gaps left out.
    create list values
    for each k in line
        set cell to item k of cells
        if cell.colour is not 0
            add cell.colour to values
    if mixRule is not nothing
        run mixRule with values and store in values
    note: Put them back from the front of the line; the rest are empty. Say whether anything changed.
    set changed to false
    repeat size times counting with i
        set k to item i of line
        set cell to item k of cells
        set colour to 0
        if i is less than length of values
            set colour to item i of values
        if cell.colour is not colour
            set changed to true
            set cell.colour to colour
    give back changed

define move using direction
    set moved to false
    repeat size times counting with n
        if slideLine(lineOf(direction, n))
            set moved to true
    if moved
        run spawn

when the key "left" is pressed
    run move with "left"

when the key "right" is pressed
    run move with "right"

when the key "up" is pressed
    run move with "up"

when the key "down" is pressed
    run move with "down"`,

`component: merge-mix
name: The mixing rule
depth: hallway
summary: The heart of the puzzle. Going along a line, two neighbours mix if they share no light: red and green make yellow, but yellow and red both have red, so they stay apart. A mixed tile scores its number; white (every light at once) clears itself away for a bonus, which is how the board makes room. Each tile mixes at most once per slide. The structure is here; you write when two colours can mix and what they make.
learn: Bits: a number as a set of yes-or-no lights, and & (and) to find the ones two numbers share; additive colour (how screens mix light, unlike paint).
== mechanics
note: Two colours share a light when it's in both. & keeps only the lights both numbers have: 6 & 4 is 4 (both have red), 4 & 2 is 0 (nothing shared).
define canMix using a, b
    give back ‹they share no light: (a & b) is 0›

define mixLine using values
    note: Along the line from the front: a pair that can mix becomes one tile, and both are used up.
    create list out
    set i to 0
    while i is less than length of values
        set a to item i of values
        set after to i plus 1
        set b to item after of values
        if b is not nothing and canMix(a, b)
            set mixed to ‹the lights of both together: a plus b›
            increase score by mixed
            note: White, every light at once, clears itself away: the cell is left empty, and worth a bonus.
            if mixed is 7
                increase score by 20
            otherwise
                add mixed to out
            increase i by 2
        otherwise
            add a to out
            increase i by 1
    give back out

set mixRule to mixLine`,

`component: merge-swipe
name: Swipes on a phone
depth: walk
summary: On a phone people swipe. A swipe is two moments: where the finger went down, and where it lifted. The difference across (dx) and down (dy) says which way it went: whichever is bigger wins, and it has to be long enough (30 pixels) to count, so a tap does nothing. It works with a mouse too. The finger lifting has no sentence yet, so two lines here are JavaScript.
learn: Pointer events (down and up), which treat fingers and mice alike; comparing sizes with Math.abs; touch-action, which stops the page scrolling under a swipe.
== mechanics
note: Where a finger (or the mouse) went down on the board.
set startX to 0
set startY to 0

when game is tapped
    set startX to tap x
    set startY to tap y

note: The finger lifting decides the swipe. There's no sentence for that yet, so this line and the last are JavaScript: they listen for "pointerup" on the board.
js: document.getElementById("game").addEventListener("pointerup", (event) => {
    set dx to tap x minus startX
    set dy to tap y minus startY
    note: Long enough to be a swipe, then whichever way it went further.
    if Math.abs(dx) is more than Math.abs(dy) and Math.abs(dx) is more than 30
        if dx is more than 0
            run move with "right"
        otherwise
            run move with "left"
    otherwise if Math.abs(dy) is more than 30
        if dy is more than 0
            run move with "down"
        otherwise
            run move with "up"
js: });`,

`component: merge-motion
name: Tiles that glide
depth: horizon
summary: Here tiles jump to where they end up. Puzzle games feel much better when tiles glide there over a tenth of a second, and a mixed tile pops a little. That means remembering where each tile came from and drawing it part of the way along each frame (an animation, or tween), while the rules have already moved on. Telling the player that no move is left is the other next step: try all four slides on a copy of the board.
usual: Your own tween in every frame, with an easing curve; GSAP or anime.js on a web page; game engines' tween tools (Phaser's tweens, Godot's Tween).
learn: Easing curves (fast then slow); keeping what's drawn separate from the game's state; copying a list so trying a move doesn't change the real board.`,

// ---------------------------------------------------------------- Word of the Day

`kit: word-of-the-day
title: Word of the Day
layout: website
shelf: games
platform: web
about: A five-letter word to guess in six tries, in the style of Wordle: each guess comes back coloured, green for the right letter in the right place, yellow for a letter that's in the word somewhere else. There's one word a day, picked from the date, so everyone gets the same one. Working out the colours, double letters included, is the step you fill in.
steps: wordle-board!, wordle-daily!, wordle-typing!, wordle-colours*, wordle-streak*, wordle-dictionary, wordle-keyboard, publish`,

`component: wordle-board
name: The board
depth: walk
summary: Six rows of five squares, drawn every frame from two things: the list of guesses so far, and the word being typed. The board never remembers what it drew; it's worked out again from the data each time, so typing, deleting and guessing only change the data. Letters come from text one at a time (item 2 of "PLANT" is "A": positions count from 0).
learn: Drawing from data; text as a list of letters; small tools (functions) that work out where things go.
== structure
page title is "Word of the Day"
add a main area called stage
    add a big heading "Word of the Day"
    add a drawing area called game 336 by 440
    add a paragraph called message "Type a five-letter word and press Enter."
== styling
style the page: background #121213, text colour #f2f2f2, font-family: system-ui, space around 0
style stage: in a column, align-items: center, gap 12, space inside 24 12
style big headings: text size 28, space around 0, letter-spacing: 1px
style game: display: block, max-width: 100%, height auto
style message: min-height: 1.5em, space around 0, text colour #c8c8c8
== mechanics
note: The board: 6 rows of 5 squares, 56 pixels each with 8 between.
set square to 56
set gap to 8
note: The guesses so far (words in capitals), the word being typed, and whether the game is over.
create list guesses
set typed to ""
set finished to false

define squareX using col
    give back 12 plus col times (square plus gap)

define squareY using row
    give back 12 plus row times (square plus gap)

define drawLetter using letter, col, row, fill
    draw a rectangle at squareX(col), squareY(row) sized square by square in fill on game
    draw text letter at squareX(col) plus 18, squareY(row) plus 38 size 28 in "white" on game

every frame
    fill game with "#121213"
    repeat 6 times counting with row
        repeat 5 times counting with col
            note: A guessed row shows its word, the next row what's being typed (charAt gives "" past the end), and the rest are empty.
            set letter to ""
            set fill to "#2a2a2c"
            if row is less than length of guesses
                set word to item row of guesses
                set letter to item col of word
                set fill to "#3a3a3c"
            otherwise if row is length of guesses
                set letter to typed.charAt(col)
            run drawLetter with letter, col, row, fill`,

`component: wordle-daily
name: One word a day
depth: walk
summary: Everyone gets the same word on the same day, with no server: the page counts the days since 1 January 1970 by your own calendar, and that number, divided by how many words there are, leaves a remainder that picks today's word. Tomorrow the number is one bigger, so the next word comes up. Add more words to the list (five letters, in capitals) and it takes longer to come round again.
learn: Dates in JavaScript (new Date, Date.UTC); counting days; the remainder (mod) to go round a list.
== mechanics
note: The answers, one for each day. Add more five-letter words in capitals.
create list words with "CRANE", "PLANT", "BREAD", "CHAIR", "LIGHT", "RIVER", "STONE", "OCEAN", "MUSIC", "GRAPE", "HOUSE", "TRAIN", "CLOUD", "SMILE", "BRUSH", "PAINT", "FLAME", "GLOVE", "HEART", "LEMON", "MANGO", "NIGHT", "PIANO", "QUIET", "ROBIN", "SUGAR", "TIGER", "VOICE", "WATER", "ZEBRA", "APPLE", "BEACH", "DANCE", "EAGLE", "FIELD", "HONEY", "JELLY", "LLAMA", "MOUSE", "NOVEL", "OLIVE", "PEACH", "QUEEN", "RADIO", "SHEEP", "TOAST", "WHEAT", "YEAST", "SPOON", "FROST"
note: Today, as a day number: days since 1 January 1970, by the date on your own calendar. Everyone opening the page on the same date gets the same word.
set now to new Date()
set day to Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000)
set pick to day mod length of words
set answer to item pick of words`,

`component: wordle-typing
name: Typing a guess
depth: walk
summary: Letters typed on the keyboard fill the current row, Backspace takes one off, and Enter sends the guess when it has five letters. The guess goes on the list of guesses, and that's all it takes for the board to show it. Then the game checks for the end: the right word wins, and a sixth wrong guess shows the answer. Only single letters A to Z are taken, so Shift, arrows and the rest are ignored.
learn: Key events (event.key: "a", "Enter", "Backspace"); building text a letter at a time; slice, which cuts text.
== mechanics
define submit
    if length of typed is less than 5
        set the text of message to "Not enough letters."
        give back
    add typed to guesses
    if typed is answer
        set finished to true
        set the text of message to "Got it in {length of guesses}. A new word tomorrow."
    otherwise if length of guesses is 6
        set finished to true
        set the text of message to "The word was {answer}. A new one tomorrow."
    otherwise
        set the text of message to ""
    set typed to ""

set alphabet to "abcdefghijklmnopqrstuvwxyz"

when a key is pressed
    if finished
        give back
    set pressed to event.key
    set letter to pressed in lowercase
    if pressed is "Enter"
        run submit
    otherwise if pressed is "Backspace"
        set typed to typed.slice(0, -1)
    otherwise if length of pressed is 1 and letter is in alphabet and length of typed is less than 5
        set typed to typed plus (pressed in capitals)`,

`component: wordle-colours
name: The colours: right, near and no
depth: hallway
summary: The heart of the game. Each letter of a guess is green if it's in the right place, yellow if it's in the word somewhere else, grey if not. The catch is double letters: guess PAPER for APPLE and both Ps can't be yellow. So first set aside the answer's letters that weren't matched in place (spare); a yellow uses one up. This step paints over the guessed rows in colour. You write the two tests.
learn: Going through two words letter by letter; a list as a pool you take from (splice removes one item); why the order of checks matters.
== mechanics
note: How each letter of a guess did: "right" (right letter, right place), "near" (in the word, somewhere else) or "no".
define judge using guess
    note: First the answer's letters that weren't guessed in their place. Only these can make a letter "near", each one once: that's what gets double letters right.
    create list spare
    repeat 5 times counting with i
        if item i of guess is not item i of answer
            add item i of answer to spare
    create list marks
    repeat 5 times counting with i
        set letter to item i of guess
        if ‹the letter is in the right place: letter is item i of answer›
            add "right" to marks
        otherwise if ‹the letter is somewhere else, and not used up yet: letter is in spare›
            add "near" to marks
            note: Used up: take one of that letter out of spare.
            run spare.splice with spare.indexOf(letter), 1
        otherwise
            add "no" to marks
    give back marks

define markColour using mark
    if mark is "right"
        give back "#538d4e"
    if mark is "near"
        give back "#b59f3b"
    give back "#3a3a3c"

every frame
    note: Paint over the rows already guessed, in their colours.
    repeat length of guesses times counting with row
        set word to item row of guesses
        set marks to judge(word)
        repeat 5 times counting with col
            run drawLetter with item col of word, col, row, markColour(item col of marks)`,

`component: wordle-streak
name: Today's game and a streak
depth: walk
summary: One word a day only works if a refresh doesn't hand you a fresh start. Today's guesses are saved in the browser with the day number; when the page opens on the same day they come back, and on a new day they're ignored. Solving it adds to your streak if you also solved yesterday's, or starts it again at 1. Everything stays in this browser.
learn: Saving an object (localStorage keeps it as JSON text); checking that saved data is still current; days in a row.
== mechanics
note: Today's game, if it was saved today.
load "word-of-the-day" from the browser and store in saved
if saved is not nothing and saved.day is day
    set guesses to saved.guesses
    set finished to saved.finished
    set the text of message to "Welcome back: today's game so far."
note: The streak: days in a row solved, and the day of the last win.
load "word-streak" from the browser and store in streak
if streak is nothing
    set streak to 0
load "word-last-win" from the browser and store in lastWin
if lastWin is nothing
    set lastWin to 0
set savedCount to length of guesses

every frame
    note: A new guess: save today's game. A win: count the streak.
    if length of guesses is not savedCount
        set savedCount to length of guesses
        save { day: day, guesses: guesses, finished: finished } in the browser as "word-of-the-day"
        if finished and last item of guesses is answer
            if lastWin is day minus 1
                increase streak
            otherwise
                set streak to 1
            set lastWin to day
            save streak in the browser as "word-streak"
            save lastWin in the browser as "word-last-win"
    draw text "Streak: {streak}" at 12, 420 size 18 in "#c8c8c8" on game`,

`component: wordle-dictionary
name: Only real words as guesses
depth: horizon
summary: Right now any five letters count as a guess, so AEIOU is a cheap way to test the vowels. Word games only accept real words: a much longer list of allowed guesses (thousands of words) next to the short list of answers. Looking a word up in a list that long is quick if the list is a Set. Choosing the answers well (common words, nothing unkind) is a job of its own.
usual: Open word lists such as ENABLE or SCOWL, filtered to five letters; a Set in JavaScript for quick lookups; a separate words file loaded with fetch.
learn: Sets and why they're fast to search; loading a text file with fetch and splitting it into lines; shaking the screen row instead of accepting a wrong word.`,

`component: wordle-keyboard
name: An on-screen keyboard
depth: horizon
summary: On a phone there's no keyboard until a text box is tapped, so word games draw their own: three rows of letter keys, Enter and delete. Each key is also a scoreboard: it takes the best colour its letter has earned so far, so you can see at a glance which letters are used up. It's built from the same data as the board: the guesses and their marks.
usual: Buttons made by the page in a loop, or keys drawn on the drawing area and found from where a tap lands; CSS grid or flexbox for the rows.
learn: Making buttons from a list in JavaScript (createElement); keeping the best result per letter in a dictionary (an object); big enough keys for thumbs.`,

// ---------------------------------------------------------------- Memory Pairs

`kit: memory-pairs
title: Memory Pairs
layout: website
shelf: games
platform: phone
about: The card game of turning two over and finding pairs, made for learning words: each pair is a word and its translation (English and Spanish here, any language you like), so remembering where the cards are means remembering what the words mean. The pairs you mix up are kept and dealt first next time; that's the step you fill in.
steps: pairs-table!, pairs-flip!, pairs-tricky*, pairs-voice, pairs-decks, installable*`,

`component: pairs-table
name: The cards on the table
depth: walk
summary: The vocabulary is a list of pairs, a word and its translation. Each game shuffles it fairly, takes six pairs and makes two cards from each, one per language, with the same pair number: that number, not the words, is how the game knows two cards belong together, so any language works. Twelve cards are shuffled again and laid out in 3 columns and 4 rows, face down.
learn: Lists of pairs; a fair shuffle (take cards out at random, one at a time); laying out a grid from one list (card k is in column k mod 3, and row k divided by 3, rounded down).
== structure
page title is "Memory Pairs"
add a main area called stage
    add a drawing area called game 360 by 540
    add a button called again saying "New game"
== styling
style the page: background #f4efe6, text colour #3d405b, font-family: system-ui, space around 0
style stage: in a column, align-items: center, gap 12, space inside 12
style game: display: block, max-width: 100%, height auto, touch-action: manipulation
style again: font: inherit, text size 18, space inside 12 28, background #3d405b, text colour white, no border, rounded corners 999, hand cursor
== mechanics
note: The words to learn: each pair is a word and its translation, here English then Spanish. Change them for any language, or any two things that belong together.
create list vocabulary with ["dog", "perro"], ["cat", "gato"], ["house", "casa"], ["water", "agua"], ["bread", "pan"], ["book", "libro"], ["sun", "sol"], ["moon", "luna"], ["tree", "árbol"], ["apple", "manzana"], ["friend", "amigo"], ["school", "escuela"]
note: Six pairs a game: 12 cards, each 105 by 100 pixels.
set pairsPerGame to 6
set cardW to 105
set cardH to 100
note: The pairs dealt this game (pair n is item n), the cards, and the moves made.
create list dealt
create list cards
set moves to 0
note: A later step can put a tool here that changes the order pairs are dealt in.
set chooseOrder to nothing

define makeCard using text, pair
    set card to { text: text, pair: pair }
    set card.up to false
    set card.done to false
    give back card

define shuffle using things
    note: A fair shuffle: take things out at random, one at a time, onto a new pile.
    set pool to things.slice()
    create list pile
    while length of pool is more than 0
        set k to Math.floor(Math.random() times length of pool)
        add item k of pool to pile
        run pool.splice with k, 1
    give back pile

define deal
    set dealt to shuffle(vocabulary)
    if chooseOrder is not nothing
        run chooseOrder with dealt and store in dealt
    set dealt to dealt.slice(0, pairsPerGame)
    create list fresh
    repeat pairsPerGame times counting with n
        set pair to item n of dealt
        add makeCard(item 0 of pair, n) to fresh
        add makeCard(item 1 of pair, n) to fresh
    set cards to shuffle(fresh)
    set moves to 0

run deal

when again is clicked
    run deal

define cardX using k
    give back 15 plus (k mod 3) times 115

define cardY using k
    give back 50 plus Math.floor(k / 3) times 110

every frame
    fill game with "#f4efe6"
    draw text "Moves: {moves}" at 16, 32 size 18 in "#3d405b" on game
    repeat length of cards times counting with k
        set card to item k of cards
        set x to cardX(k)
        set y to cardY(k)
        if card.done
            draw a rectangle at x, y sized cardW by cardH in "#dcefe3" on game
            draw text card.text at x plus 10, y plus 56 size 20 in "#5b7f6b" on game
        otherwise if card.up
            draw a rectangle at x, y sized cardW by cardH in "#ffffff" on game
            draw text card.text at x plus 10, y plus 56 size 20 in "#3d405b" on game
        otherwise
            draw a rectangle at x, y sized cardW by cardH in "#81b29a" on game
            draw a rectangle at x plus 8, y plus 8 sized cardW minus 16 by cardH minus 16 in "#6a9c84" on game`,

`component: pairs-flip
name: Turning cards over
depth: walk
summary: A tap turns a card face up; the second tap of a turn counts a move. Then the game waits a moment so you can read both, and either keeps them (same pair number: a match, shown at the bottom as the word and its meaning) or turns them back. While it waits, taps are ignored, or a fast player could turn a third card. The drawing area may be shown smaller than it is on a phone, so taps are scaled to its own pixels first.
learn: Finding what was tapped (is the point inside the card?); after a few seconds (setTimeout); a flag that blocks input while waiting; every, which checks a whole list.
== mechanics
note: The cards turned up this turn (at most two), and whether the game is waiting before turning them back.
create list turned
set waiting to false
set lastPair to ""
note: Tools a later step adds here run after every turn of two cards.
create list afterTurn

define settle
    note: New game may have been pressed while waiting: then there's nothing to settle.
    if length of turned is less than 2
        give back
    set first to item 0 of turned
    set second to item 1 of turned
    if first.pair is second.pair
        set first.done to true
        set second.done to true
        set words to item first.pair of dealt
        set lastPair to "{item 1 of words} means {item 0 of words}"
    for each tool in afterTurn
        run tool with first, second
    set first.up to false
    set second.up to false
    set turned to an empty list
    set waiting to false
    note: every asks a question of each card in the list: are they all done?
    set allDone to cards.every(card => card.done)
    if allDone
        set lastPair to "All six pairs in {moves} moves."

define flip using card
    if waiting or card.up or card.done
        give back
    set card.up to true
    add card to turned
    if length of turned is 2
        increase moves
        set waiting to true
        after 0.9 seconds
            run settle

when game is tapped
    note: The drawing area may be shown smaller than it is (on a narrow phone), so scale the tap to its own pixels.
    set scale to the width of game divided by game.clientWidth
    set x to tap x times scale
    set y to tap y times scale
    repeat length of cards times counting with k
        set cx to cardX(k)
        set cy to cardY(k)
        if x is at least cx and x is less than cx plus cardW and y is at least cy and y is less than cy plus cardH
            run flip with item k of cards

when again is clicked
    set turned to an empty list
    set waiting to false
    set lastPair to ""

every frame
    draw text lastPair at 16, 520 size 20 in "#3d405b" on game`,

`component: pairs-tricky
name: Words you miss come back
depth: hallway
summary: What turns the game into practice. When two cards don't match, both of their words go on a list of tricky words, saved in the browser; when you match a pair, it comes off. The next game deals the tricky pairs first, so the words you get wrong are the ones you see again, which is the idea behind flashcard apps. The structure is here; you write the two tests: is this pair tricky, and was this turn a match.
learn: Remembering mistakes; changing the order of a list without losing anything (two lists joined with concat); the idea of spaced repetition.
== mechanics
note: The tricky words, by their English side, kept in the browser between games.
load "pairs-tricky" from the browser and store in tricky
if tricky is nothing
    set tricky to an empty list

define trickyFirst using pairs
    note: The tricky pairs go to the front; the rest keep their shuffled order after them.
    create list front
    create list rest
    for each pair in pairs
        if ‹this pair is a tricky one: item 0 of pair is in tricky›
            add pair to front
        otherwise
            add pair to rest
    give back front.concat(rest)

define practise using first, second
    for each card in [first, second]
        set words to item card.pair of dealt
        set english to item 0 of words
        if ‹you got this turn right: first.pair is second.pair›
            if english is in tricky
                run tricky.splice with tricky.indexOf(english), 1
        otherwise if not (english is in tricky)
            add english to tricky
    save tricky in the browser as "pairs-tricky"

set chooseOrder to trickyFirst
add practise to afterTurn
note: Deal again, now that the tricky words are known.
run deal

every frame
    draw text "To practise: {length of tricky}" at 200, 32 size 18 in "#c0594a" on game`,

`component: pairs-voice
name: Hearing the words
depth: horizon
summary: Learning a word means knowing how it sounds, too. Browsers can read text aloud in many languages with the Web Speech API: when a card turns up, say its word in its own language. Voices vary by device and some languages have none, so a game for serious learning often uses recordings by native speakers instead.
usual: speechSynthesis and SpeechSynthesisUtterance in the browser (set lang to "es-ES" for Spanish); recordings from Forvo or your own; the audio element to play them.
learn: The Web Speech API and choosing a voice by language; audio files on a page; why the first sound on a phone needs a tap.`,

`component: pairs-decks
name: Decks and spaced repetition
depth: horizon
summary: One list of twelve words runs out quickly. Learning apps keep decks (food, travel, verbs), let people make their own, and schedule each word: one you know well comes back in days, one you miss comes back in minutes. That scheduling, spaced repetition, is the best-known way to remember a lot of words, and the tricky list is its simplest form.
usual: The Leitner box system (cards move up a box when right, back to the first when wrong); the SM-2 algorithm used by Anki; decks as JSON files.
learn: Dates and intervals; storing a deck with a box or a due date per card; importing a deck from a file.`,

// ---------------------------------------------------------------- The Lighthouse

`kit: lighthouse
title: The Lighthouse
layout: structured
shelf: games
platform: pc
about: A text adventure in the terminal, in Python: it's dusk on Gull Rock, the lighthouse is dark, the keeper is missing and a ship is due. Walk between rooms by typing north or up, pick things up, read the clues and light the lamp. The rooms are a dictionary of dictionaries; the puzzle that ends the story is the step you fill in.
steps: light-rooms!, light-parser!, light-items!, light-mystery*, light-save, light-worlds, package`,

`component: light-rooms
name: Rooms in a dictionary
depth: walk
summary: The world. Each room is a dictionary (its name, what it's like, its exits), and all the rooms live in one dictionary by a short name, like "cottage". Exits are a dictionary too: a direction and the room it leads to, so the map is data, and adding a room means adding an entry. Another dictionary says where each thing is: a room's short name, or "you" once you carry it. Where you are lives in player.
learn: Dictionaries, and dictionaries inside dictionaries; a map as data; list comprehensions (a list made in one line).
== settings
note: The rooms, by short name. Each is a dictionary: its name, what it's like, and its exits (a direction, and the room that way).
create dictionary rooms
set item "jetty" of rooms to {"name": "The jetty", "text": "Dusk. Waves slap at the wooden jetty below the lighthouse on Gull Rock. Its great lamp should be turning by now, but the tower is dark. A path climbs north to the keeper's cottage; the boathouse is east.", "exits": {"north": "cottage", "east": "boathouse"}}
set item "boathouse" of rooms to {"name": "The boathouse", "text": "Nets, oars and a smell of paraffin. The hook where the keeper's rowing boat should hang is empty, and the slipway is still wet. The jetty is west.", "exits": {"west": "jetty"}}
set item "cottage" of rooms to {"name": "The keeper's cottage", "text": "A cold stove, a table with an open logbook, a bread tin on the shelf. A heavy door to the north leads into the tower; the jetty is south.", "exits": {"south": "jetty", "north": "tower"}}
set item "tower" of rooms to {"name": "The foot of the tower", "text": "Cold stone, and a spiral stair going up into the dark. The cottage is south.", "exits": {"south": "cottage", "up": "lamp"}}
set item "lamp" of rooms to {"name": "The lamp room", "text": "The great lamp sits dark inside its lens. Through the glass the sea is black, but far out on the rocks a tiny light blinks: on, off, on. The stair goes down.", "exits": {"down": "tower"}}
note: Where each thing is: a room's short name, or "you" once you carry it.
create dictionary place
set item "logbook" of place to "cottage"
set item "matches" of place to "cottage"
set item "oil can" of place to "boathouse"
note: You: which room you're in, and whether the story is over.
create dictionary player
set item "room" of player to "jetty"
set item "finished" of player to no
note: Rooms behind a locked door.
create list locked with "tower"
== tools
define things at using where
    description: The things in a room (or "you": the things you carry).
    give back [thing for thing in place if place[thing] == where]

define look using rest
    description: Says where you are: the room, the things in it, and the ways out.
    set room to rooms[player["room"]]
    run things at with player["room"] and store in here
    show ""
    show room["name"]
    show room["text"]
    if here
        python: print("You can see: " + ", ".join(here) + ".")
    python: print("Ways out: " + ", ".join(room["exits"]) + ".")

define go using rest
    description: Goes one way, if there's an exit that way and it isn't locked.
    set room to rooms[player["room"]]
    if rest is not in room["exits"]
        show "You can't go that way."
        give back
    set destination to room["exits"][rest]
    if destination is in locked
        show "The door is locked."
        give back
    set item "room" of player to destination
    run look with ""
== main
show "THE LIGHTHOUSE"
show "Type help if you're stuck."
run look with ""`,

`component: light-parser
name: Understanding what's typed
depth: walk
summary: The part that reads what you type. It takes the first word as the verb and the rest as what it's about, so "take oil can" is the verb take and "oil can"; a direction alone ("north", or its first letter, "n") means go. Verbs live in a dictionary next to the tool each one runs, so every later step adds its own verbs with one line. Then it asks again, until you type quit or the story ends.
learn: split, which cuts text into words; a dictionary of tools (in Python a tool is a value like any other); a loop that runs until told to stop.
== settings
note: Every word a command can start with (the verb), and the tool it runs. Each step adds its own.
create dictionary verbs
note: Directions can be typed alone, or as their first letter.
set shortcuts to {"n": "north", "s": "south", "e": "east", "w": "west", "u": "up", "d": "down"}
create list directions with "north", "south", "east", "west", "up", "down"
== tools
define help using rest
    description: Lists the words a command can start with.
    python: print("Try: " + ", ".join(sorted(verbs)) + ", a direction such as north or up, or quit.")

set item "look" of verbs to look
set item "go" of verbs to go
set item "help" of verbs to help

define obey using line
    description: Splits what was typed into its first word (the verb) and the rest, and runs the verb's tool.
    set words to line.strip().lower().split(maxsplit=1)
    if not words
        give back
    set verb to words[0]
    set rest to ""
    if length of words is more than 1
        set rest to words[1]
    note: One letter for a direction, and a direction on its own means go that way.
    if verb is in shortcuts
        set verb to shortcuts[verb]
    if rest is in shortcuts
        set rest to shortcuts[rest]
    if verb is in directions
        set rest to verb
        set verb to "go"
    if verb is in verbs
        set action to verbs[verb]
        run action with rest
    otherwise
        show "I don't know how to '{verb}'. Type help for the words I know."
== main
repeat forever
    ask "> " and store in line
    if line.strip().lower() is "quit"
        stop the loop
    run obey with line
    if player["finished"]
        stop the loop
show "Thanks for playing."`,

`component: light-items
name: Things to take and carry
depth: walk
summary: Adventures are about things: the logbook, the matches, the oil can. Taking one changes where it is from the room's name to "you"; dropping it puts the room's name back. That one dictionary answers every question: what's in this room, what am I carrying. Examine shows a thing close up. Short verbs (i, x, get) do the same as long ones, because players type fast.
learn: Changing a value in a dictionary; checking a key exists before reading it ("if … is in …"); several words for the same tool.
== settings
note: What each thing looks like close up.
create dictionary details
set item "logbook" of details to "The keeper's logbook, kept in neat handwriting until the last page, which is a hurried scrawl. Try: read logbook."
set item "matches" of details to "A box of matches, nearly full."
set item "oil can" of details to "A can of lamp oil, heavy and sloshing."
== tools
define take using rest
    description: Picks up a thing that's in this room.
    if rest is in place and place[rest] == player["room"]
        set item rest of place to "you"
        show "Taken: {rest}."
    otherwise if rest is in place and place[rest] == "you"
        show "You already have the {rest}."
    otherwise
        show "There's no {rest} here."

define drop using rest
    description: Puts down a thing you carry, in this room.
    if rest is in place and place[rest] == "you"
        set item rest of place to player["room"]
        show "Dropped: {rest}."
    otherwise
        show "You aren't carrying a {rest}."

define inventory using rest
    description: Lists what you carry.
    run things at with "you" and store in carried
    if carried
        python: print("You're carrying: " + ", ".join(carried) + ".")
    otherwise
        show "You aren't carrying anything."

define examine using rest
    description: Looks closely at a thing here or in your hands.
    if rest is in details and place[rest] is in [player["room"], "you"]
        show details[rest]
    otherwise
        show "You don't see a {rest} here."

set item "take" of verbs to take
set item "get" of verbs to take
set item "drop" of verbs to drop
set item "inventory" of verbs to inventory
set item "i" of verbs to inventory
set item "examine" of verbs to examine
set item "x" of verbs to examine`,

`component: light-mystery
name: The mystery and the lamp
depth: hallway
summary: The story's puzzle: read the logbook for where the keeper went and where the spare key is, open the bread tin, unlock the tower, fill the lamp with oil and light it. Everything that has happened is kept in where things are (the key comes out of the tin, the oil is used), so the story needs no other memory, and saving it means writing that down. The verbs and words are here; you write the three tests that decide when each step of the puzzle works.
learn: Conditions with and; a story as a chain of states; giving players several ways to say the same thing (use matches, light lamp).
== settings
note: The spare key starts in the bread tin, which isn't a room, so it can't be seen until the tin is opened.
set item "key" of place to "tin"
set item "key" of details to "A big iron key, cold and heavy."
== tools
define read using rest
    description: Reads the logbook, if it's here or in your hands.
    if rest is "logbook" and place["logbook"] is in [player["room"], "you"]
        show "The last entry, in a hurried hand:"
        show "  Storm coming. Rowing out to the Mackerel Rocks to fetch the Pengellys' dinghy before it breaks loose."
        show "  Back by dusk to light the lamp. Spare key where the gulls can't get at it."
    otherwise
        show "There's nothing like that here to read."

define open thing using rest
    description: Opens the bread tin in the cottage.
    if rest is in ["tin", "bread tin"] and player["room"] == "cottage"
        if place["key"] == "tin"
            set item "key" of place to "cottage"
            show "Under a heel of stale bread: a big iron key. Where the gulls can't get at it."
        otherwise
            show "Only crumbs now."
    otherwise
        show "You can't open that."

define ending
    show ""
    show "The wick catches. Light floods the lens, and the great beam swings out over the sea."
    show "It sweeps the Mackerel Rocks: an upturned dinghy, and someone waving a lantern. The keeper."
    show "Out in the dark a ship's horn answers. By midnight the lifeboat has her ashore, soaked, cross and grateful."
    show "THE END"
    set item "finished" of player to yes

define use using rest
    description: Uses something you carry. The story moves on when the right thing is used in the right place.
    if rest is not in place or place[rest] != "you"
        show "You aren't carrying a {rest}."
    otherwise if rest is "key"
        if ‹you're by the tower door and it's still locked: player["room"] == "cottage" and "tower" is in locked›
            remove "tower" from locked
            show "The key turns with a groan, and the tower door swings open."
        otherwise
            show "There's nothing to unlock here."
    otherwise if rest is "oil can"
        if ‹you're beside the lamp: player["room"] == "lamp"›
            set item "oil can" of place to "used"
            show "You fill the lamp and set the empty can aside. It smells of paraffin."
        otherwise
            show "There's nothing to fill here."
    otherwise if rest is "matches"
        if ‹the lamp has its oil and you're beside it: place["oil can"] == "used" and player["room"] == "lamp"›
            run ending
        otherwise if player["room"] == "lamp"
            show "The wick is dry. The lamp needs oil first."
        otherwise
            show "You strike a match. It flares, and dies."
    otherwise
        show "Nothing happens."

define unlock using rest
    run use with "key"

define fill using rest
    run use with "oil can"

define light using rest
    run use with "matches"

set item "read" of verbs to read
set item "open" of verbs to open thing
set item "use" of verbs to use
set item "unlock" of verbs to unlock
set item "fill" of verbs to fill
set item "light" of verbs to light`,

`component: light-save
name: Saving the game
depth: walk
summary: Everything about a game in progress is in three places: player (where you are), place (where everything is) and locked. Saving writes those three into one JSON file next to the program; loading reads it back. Loading changes the shared dictionaries and list in place (update, clear, extend) rather than making new ones, because every part of the program holds on to the same ones.
learn: JSON files; dictionaries and lists that several files share; why changing in place differs from making a new one.
== settings
note: Where the game is saved, next to the program.
set save file to "lighthouse-save.json"
== tools
define save game using rest
    description: Writes where you are, where everything is and what's locked to the save file.
    python: import json
    open the file save file for writing as f
        run json.dump with {"player": player, "place": place, "locked": locked}, f
    show "Saved."

define load game using rest
    description: Puts everything back as it was saved, if there's a save file.
    python: import json, os
    if not os.path.exists(save file)
        show "There's no saved game yet."
        give back
    open the file save file as f
        set saved to json.load(f)
    note: Change the shared dictionaries and list in place, so every part of the program sees it.
    run player.update with saved["player"]
    run place.update with saved["place"]
    run locked.clear
    run locked.extend with saved["locked"]
    show "Loaded."
    run look with ""

set item "save" of verbs to save game
set item "load" of verbs to load game`,

`component: light-worlds
name: Bigger worlds
depth: horizon
summary: Five rooms in a dictionary are a good start; a long adventure needs more help. Interactive fiction has its own tools: some let you write the whole game in something close to English prose, others are built around choices instead of typed commands. They handle the parts that grow hard by hand: understanding many ways of saying things, people to talk to, saving, and publishing for the web.
usual: Inform 7 (games written in English-like sentences); Twine (choice-based stories, played in a browser); Ink by Inkle (branching dialogue, used in big games); Evennia for adventures many people play at once.
learn: Keeping rooms and text in data files (JSON or YAML) rather than code; a parser that knows "the", "it" and two-word nouns; the Interactive Fiction Database and its yearly competition (IFComp).`,

// ---------------------------------------------------------------- Pixel Painter

`kit: pixel-painter
title: Pixel Painter
layout: website
shelf: creative
platform: web
about: A pixel-art editor in the browser: a 16 by 16 grid you paint by clicking or dragging, a palette and a colour picker, your picture kept in the browser, and a button that saves it as a PNG file. Drawing the picture into an image file is the step you fill in.
steps: pixel-grid!, pixel-brush!, pixel-palette*, pixel-keep*, pixel-export*, pixel-frames, pixel-tools, publish`,

`component: pixel-grid
name: The grid
depth: walk
summary: A pixel-art picture is a grid of squares, each one colour or empty. Here it's 16 by 16, kept as one list of 256 squares, row after row (square k is in column k mod 16, and row k divided by 16, rounded down), and drawn 20 pixels to a square. Empty squares show a faint checkerboard, the usual sign for see-through. The picture is drawn again from the list every frame, so painting only has to change the list.
learn: A grid kept as one list; drawing from data every frame; why see-through is shown as a checkerboard.
== structure
page title is "Pixel Painter"
add a main area called studio
    add a big heading "Pixel Painter"
    add a drawing area called art 320 by 368
    add a block called toolbar
        add a button called clear-all saying "Clear"
== styling
style the page: background #f6f4f0, text colour #1d1d1f, font-family: system-ui, space around 0
style studio: in a column, align-items: center, gap 14, space inside 24 12
style big headings: text size 28, space around 0
style art: display: block, width 100%, at most 480 wide, height auto, touch-action: none, cursor: crosshair, image-rendering: pixelated, box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15)
style toolbar: in a row, flex-wrap: wrap, gap 12
style clear-all: font: inherit, space inside 10 20, background white, border 1 #c9c5bd, rounded corners 999, hand cursor
== mechanics
note: The picture: 16 by 16 squares, 20 pixels each on screen. Each square is an object holding its colour, or "" when it's empty (see-through).
set gridSize to 16
set cell to 20
create list squares

define makeSquare using colour
    give back { colour: colour }

repeat gridSize times gridSize times
    add makeSquare("") to squares

when clear-all is clicked
    for each square in squares
        set square.colour to ""

every frame
    clear art
    repeat length of squares times counting with k
        set square to item k of squares
        set col to k mod gridSize
        set row to Math.floor(k / gridSize)
        note: An empty square shows the checkerboard: white, or light grey on every other square.
        set shade to square.colour
        if shade is empty text
            set shade to "#ffffff"
            if (col plus row) mod 2 is 0
                set shade to "#e8e6e1"
        draw a rectangle at col times cell, row times cell sized cell by cell in shade on art`,

`component: pixel-brush
name: Painting by clicking and dragging
depth: walk
summary: Press on a square to paint it; keep the button (or your finger) down and drag to paint every square you pass. A point becomes a square by dividing by the square size and rounding down. The drawing area may be shown bigger or smaller than its real size, so the point is scaled to its own pixels first: forget that and the paint lands in the wrong place. Moving and lifting have no sentences yet, so a few lines here are JavaScript.
learn: Pointer events (down, move, up) for mouse and touch alike; screen pixels and the drawing area's own pixels (clientWidth and width); Math.floor.
== mechanics
note: The colour the brush paints with ("" rubs out), and whether a drag is going on.
set brush to "#1d3557"
set painting to false

define paintAt using x, y
    note: Scale the point to the drawing area's own pixels, then find its column and row.
    set scale to the width of art divided by art.clientWidth
    set col to Math.floor(x times scale / cell)
    set row to Math.floor(y times scale / cell)
    if col is at least 0 and col is less than gridSize and row is at least 0 and row is less than gridSize
        set k to row times gridSize plus col
        set square to item k of squares
        set square.colour to brush

when art is tapped
    set painting to true
    run paintAt with tap x, tap y

note: Dragging paints every square the pointer passes. There are no sentences yet for the pointer moving or lifting, so these are JavaScript lines around sentences: they listen for "pointermove" and "pointerup".
js: document.getElementById("art").addEventListener("pointermove", (event) => {
    if painting
        run paintAt with tap x, tap y
js: });
js: document.addEventListener("pointerup", () => {
    set painting to false
js: });`,

`component: pixel-palette
name: A palette and a colour picker
depth: walk
summary: Ten colours in a row under the picture, the last one a rubber (it paints "", empty); tap one to paint with it, and the chosen one is underlined. A small set of colours is how pixel art usually works, and it keeps a picture looking together. For any other colour there's the browser's own colour picker, a colour box whose text is the colour code it shows.
learn: Choosing from a row by position (x divided by the width of one swatch); the colour box (an input of type colour) and its value, a code like #e63946.
== structure
        add a colour box called picker
== mechanics
note: Ten colours in a row under the picture; the last, "", rubs out.
create list palette with "#1d3557", "#457b9d", "#a8dadc", "#f1faee", "#e63946", "#f4a261", "#e9c46a", "#2a9d8f", "#264653", ""
set paletteTop to 328
set swatch to 32

when art is tapped
    set scale to the width of art divided by art.clientWidth
    set x to tap x times scale
    set y to tap y times scale
    if y is at least paletteTop
        set n to Math.floor(x / swatch)
        if n is less than length of palette
            set brush to item n of palette

when picker is changed
    set brush to the text of picker

every frame
    repeat length of palette times counting with n
        set colour to item n of palette
        set x to n times swatch
        set shade to colour
        if colour is empty text
            set shade to "#ffffff"
        draw a rectangle at x plus 2, paletteTop sized 28 by 28 in shade on art
        if colour is empty text
            draw a line from x plus 4, paletteTop plus 26 to x plus 28, paletteTop plus 2 in "#e63946" on art
        if colour is brush
            draw a rectangle at x plus 2, paletteTop plus 32 sized 28 by 4 in "#1d1d1f" on art`,

`component: pixel-keep
name: Kept in the browser
depth: walk
summary: Close the tab and the picture is still there. Every two seconds the colours of all 256 squares are saved in the browser as one list; when the page opens, a saved list of the right length is painted back in. Saving a list of colours, not the squares themselves, keeps the saved data small and plain: it's the picture and nothing else.
learn: localStorage; map, which makes a new list from an old one (each square to its colour); checking saved data before trusting it.
== mechanics
note: A picture saved earlier, as a list of 256 colours.
load "pixel-painter" from the browser and store in saved
if saved is not nothing and length of saved is length of squares
    repeat length of squares times counting with k
        set square to item k of squares
        set square.colour to item k of saved

every 2 seconds
    save squares.map(square => square.colour) in the browser as "pixel-painter"`,

`component: pixel-export
name: Saving as a PNG
depth: hallway
summary: A picture people can share is a file. The squares are drawn again on a hidden drawing area, each as a block of pixels with no checkerboard, so empty squares stay see-through; toDataURL turns that drawing into a PNG file (as text), and a link marked download saves it under a name. Pixel art is usually exported bigger than it's drawn, with every square a block of 8 or 16 pixels. You fill in the size and which squares to draw.
learn: Image files and PNG see-through; toDataURL; a download link; scaling pixel art up by whole numbers so it stays sharp.
== structure
        add a link called download to "#" saying "Save as PNG"
        add a drawing area called exporter 128 by 128
== styling
style exporter: hidden
style download: space inside 10 20, background #1d3557, text colour white, rounded corners 999, no underline
== mechanics
note: How many image pixels across each square becomes in the file.
set scaleUp to ‹how many image pixels each square becomes, like 8›

when download is clicked
    note: Setting a drawing area's size also wipes it clean.
    set sheet to exporter
    set sheet.width to gridSize times scaleUp
    set sheet.height to gridSize times scaleUp
    repeat length of squares times counting with k
        set square to item k of squares
        if ‹the square has a colour: square.colour is not empty text›
            set col to k mod gridSize
            set row to Math.floor(k / gridSize)
            draw a rectangle at col times scaleUp, row times scaleUp sized scaleUp by scaleUp in square.colour on exporter
    note: The link now holds the picture as a PNG file, and download names the file it's saved as.
    set link to download
    set link.href to exporter.toDataURL("image/png")
    set link.download to "pixel-art.png"`,

`component: pixel-frames
name: Animation frames
depth: horizon
summary: Pixel art often moves: a character's walk is four to eight small pictures shown one after another. An animation editor keeps a list of frames (each a grid like this one), shows the one before faintly underneath (onion skin) so the next can be drawn to match, and plays them in a loop. Exported side by side, the frames make a sprite sheet a game can use.
usual: Aseprite (the best-known pixel-art and animation editor); Piskel (free, in the browser); a list of grids in your own code, played with every frame.
learn: A list of grids; drawing one frame faintly behind another (globalAlpha); timing frames; sprite sheets.`,

`component: pixel-tools
name: Fill, undo and mirror
depth: horizon
summary: The tools that make an editor pleasant. Fill paints a whole area of one colour, by spreading from the square you tap to its neighbours of the same colour (a flood fill). Undo keeps copies of the picture before each change and goes back one. Mirror paints the matching square on the other side too, for faces and symmetrical sprites.
usual: A flood fill with a list of squares still to visit; an undo stack (a list of earlier pictures); keyboard shortcuts like Ctrl+Z.
learn: Flood fill (neighbours, and a list of squares to visit); copying a list so the copy doesn't change with it; stacks.`,

);
