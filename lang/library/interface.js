/* IntuCode Library — interface parts (things on screen) and shapes and colour. */
(window.IntuiLibraryPacks = window.IntuiLibraryPacks || []).push(

`part: theme-toggle
title: Light and dark theme
group: interface
about: A button that switches between light and dark colours, starting from the device's own setting and remembering the choice.
summary: The colours are shared colours (CSS variables) set once for the light theme and again for a "dark" group on the page. The button puts the page in or out of that group and saves the choice in the browser. With no saved choice, the page follows the device's setting (prefers-color-scheme).
learn: CSS variables; classes (groups); the browser's storage.
source: prefers-color-scheme (MDN) | https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme | following the device's light or dark setting
== html index.html
add a button called theme saying "Dark theme"
add a big heading "Hello"
add a paragraph "The colours follow your device until you choose."
== css style.css
shared colour page is #ffffff
shared colour ink is #1b1f24
style body: background the colour page, text colour the colour ink, smooth changes
style body.dark: --page: #15181d, --ink: #e8ecf1
== js theme.js
load "theme" from the browser and store in saved
if saved is nothing
    set saved to window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
define applyTheme using name
    run document.body.classList.toggle with "dark", name === "dark"
    set the text of theme to name === "dark" ? "Light theme" : "Dark theme"
run applyTheme with saved
when theme is clicked
    set saved to saved === "dark" ? "light" : "dark"
    run applyTheme with saved
    save saved in the browser as "theme"`,

`part: dialog
title: Pop-up dialog
group: interface
about: A box that asks a question over the page, with the page behind it dimmed and unusable until it is answered.
summary: The dialog element is built into browsers: showModal() opens it over everything else, keeps keyboard focus inside it, and closes it with the Escape key. That saves the work (and the accessibility mistakes) of building one from blocks.
learn: The dialog element; events; focus and the Escape key.
source: The dialog element (MDN) | https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog | showModal, close and the ::backdrop
== html index.html
add a button called remove saying "Delete my notes"
add a paragraph called outcome ""
add a pop-up called confirmation
    add a heading "Delete everything?"
    add a paragraph "This can't be undone."
    add a button called cancel saying "Keep my notes"
    add a button called sure saying "Delete"
== css style.css
style confirmation: rounded corners 12, no border, space inside 24, big shadow
style dialog::backdrop: background #000000 50% see-through
== js dialog.js
when remove is clicked
    run confirmation.showModal
when cancel is clicked
    run confirmation.close
when sure is clicked
    run confirmation.close
    set the text of outcome to "Deleted."`,

`part: tabs
title: Tabs
group: interface
about: Several panels in one place, with a row of tabs to choose which one shows.
summary: Each tab is a button and each panel a section; choosing a tab shows its panel and hides the rest, and marks the tab as the current one so it can be styled. Buttons (not links) keep tabs usable with the keyboard.
learn: Hiding and showing elements; groups (classes); going through several elements in a loop.
== html index.html
add a navigation bar called tab-row
    add a button called tab-sound saying "Sound" in group tab
    add a button called tab-video saying "Video" in group tab
add a section called sound in group panel
    add a paragraph "Sound settings"
add a section called video in group panel
    add a paragraph "Video settings"
== css style.css
style tab-row: in a row, gap 4
create group tab: no border, space inside 8 16, background #e6e9ee, looks clickable
style .tab.current: background #4f7cff, text colour white
== js tabs.js
define showTab using name
    for each panel in document.querySelectorAll(".panel")
        set panel.hidden to panel.id !== name
    for each button in document.querySelectorAll(".tab")
        run button.classList.toggle with "current", button.id === "tab-" + name
when tab-sound is clicked
    run showTab with "sound"
when tab-video is clicked
    run showTab with "video"
run showTab with "sound"`,

`part: form-check
title: Checking a form
group: interface
types: web-app, online-shop
about: Check what someone typed before sending it, and say plainly what needs fixing; check it again on the server.
summary: The page checks first so people get an answer at once, but anything from a browser can be faked, so the server checks again before trusting it. Messages say what to do ("Add an @ to the email address"), next to the box they're about. The form's own submit event is used, so pressing Enter works too.
learn: Forms and the submit event; text methods (includes, length); why the server must check again.
== html index.html
add a form called signup
    add a label "Email" for email
    add an email box called email
    add a label "Password" for password
    add a password box called password
    add a paragraph called problems ""
    add a button called join saying "Join"
== js form.js
when signup is sent
    get the text of email and store in address
    get the text of password and store in secret
    create list wrong
    if not address.includes("@")
        add "Add an @ to the email address." to wrong
    if length of secret is less than 12
        add "Use at least 12 characters for the password." to wrong
    set the text of problems to wrong.join(" ")
    if length of wrong is 0
        send { email: address, password: secret } to "/api/signup"
== python check.py
import re

define signup problems using email, password
    description: What is wrong with a sign-up, as a list of sentences; empty when it can be accepted. Run it on the server even when the page checked first.
    create list problems
    if not re.fullmatch(r"[^@\\s]+@[^@\\s]+\\.[^@\\s]+", email)
        add "Add a whole email address, like sam@example.com." to problems
    if length of password is less than 12
        add "Use at least 12 characters for the password." to problems
    give back problems`,

`part: toast
title: Little messages (toasts)
group: interface
about: A short message that appears in a corner for a few seconds, like "Saved", then fades.
summary: A toast says something worked without stopping anyone. It is one block on the page whose text is changed and which is put in a "shown" group; CSS fades it in, and a timer takes it out of the group after three seconds. role="status" lets screen readers announce it.
learn: Timers ("after 3 seconds"); CSS transitions.
== html index.html
add a button called save saying "Save"
add a block called toast
== css style.css
style toast: background #1b1f24, text colour white, space inside 12 16, rounded corners 8, position: fixed, bottom: 16px, right: 16px, opacity: 0, transition: opacity 0.3s
style #toast.shown: opacity: 1
== js toast.js
run toast.setAttribute with "role", "status"
define showToast using message
    set the text of toast to message
    put toast in group shown
    after 3 seconds
        take toast out of group shown
when save is clicked
    run showToast with "Saved"`,

`part: responsive-nav
title: Navigation that folds on phones
group: interface
about: A row of links on wide screens that becomes a menu button on narrow ones.
summary: On a computer the links sit in a row; under 600 pixels wide they are hidden behind a menu button that opens and closes them. aria-expanded tells screen readers whether the menu is open.
learn: Media queries ("on screens narrower than"); toggling a group; aria attributes.
== html index.html
add a header called top
    add a button called menu saying "Menu"
    add a navigation bar called navlinks
        add a link to "#home" saying "Home"
        add a link to "#work" saying "Work"
        add a link to "#contact" saying "Contact"
== css style.css
style top: in a row, spread out, space inside 12
style navlinks: in a row, gap 16
style menu: hidden
on screens narrower than 600:
    style menu: display: block
    style navlinks: hidden
    style #navlinks.open: in a column, gap 8
== js menu.js
when menu is clicked
    switch group open on navlinks
    run menu.setAttribute with "aria-expanded", String(navlinks.classList.contains("open"))`,

`part: keyboard-shortcuts
title: Keyboard shortcuts
group: interface
types: desktop-app, browser-extension, web-app
about: Ctrl+S to save, Escape to close, and keys that work the same on Windows and Mac.
summary: One keydown listener on the page checks the key and the modifier: Ctrl on Windows and Linux, Cmd (metaKey) on a Mac. preventDefault stops the browser's own action (Ctrl+S would save the page). Shortcuts are skipped while someone is typing in a box, unless they're meant to work there.
learn: Keyboard events: key, ctrlKey, metaKey, shiftKey.
source: KeyboardEvent (MDN) | https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent | key, ctrlKey and metaKey
== html index.html
add a paragraph called said "Press Ctrl+S (Cmd+S on a Mac), or Escape."
== js shortcuts.js
when a key is pressed
    constant typing is event.target.matches("input, textarea")
    constant command is event.ctrlKey || event.metaKey
    if command and event.key is "s"
        run event.preventDefault
        set the text of said to "Saved."
    otherwise if event.key is "Escape" and not typing
        set the text of said to "Closed."`,

`part: progress-bar
title: Progress bar
group: interface
types: cli-tool, learning-app
about: Show how far through a long job, or a quiz, someone is.
summary: A progress bar is a block whose inner part is set to a percentage of its width; the percentage is also written as text and on the role="progressbar" attributes so it can be read out. In a terminal, the same idea is a line of characters redrawn in place with a carriage return.
learn: Percentages; changing a style from code; the carriage return.
== html index.html
add a block called bar
    add a block called fill
add a paragraph called percent "0%"
add a button called step saying "Next"
== css style.css
style bar: background #e6e9ee, rounded corners 6, height 12
style fill: background #4f7cff, rounded corners 6, height 12, width 0, smooth changes
== js progress.js
set done to 0
run bar.setAttribute with "role", "progressbar"
define showProgress using fraction
    constant shown is Math.round(Math.min(Math.max(fraction, 0), 1) * 100)
    set fill.style.width to shown + "%"
    set the text of percent to "{shown}%"
    run bar.setAttribute with "aria-valuenow", String(shown)
when step is clicked
    set done to Math.min(done + 1, 10)
    run showProgress with done / 10
== python progress.py
define progress line using done, total, width=30
    description: A text progress bar like [#####-----] 50%.
    set filled to int(width times done divided by max(total, 1))
    give back "[" + "#" * filled + "-" * (width - filled) + "] {round(100 * done / max(total, 1))}%"

define show progress using done, total
    description: Redraws the bar on the same line of the terminal (the carriage return goes back to the start).
    run print with "\\r" + progress line(done, total), end=""`,

`part: file-picker
title: Opening a file in a page
group: interface
types: desktop-app, audio-tool, data-analysis
about: Let someone pick a file and read it in the browser, without uploading it anywhere.
summary: A file picker opens the device's own file chooser. The file stays on the device: the page reads it with text() (or arrayBuffer() for sounds and pictures), which finishes later, so the handler waits for it. Nothing is sent to a server unless the page sends it.
learn: File inputs; waiting for something that finishes later (await).
source: Using files from web applications (MDN) | https://developer.mozilla.org/en-US/docs/Web/API/File_API/Using_files_from_web_applications | reading a picked file in the page
== html index.html
add a file picker called picker for text files
add a paragraph called details "No file yet."
add a paragraph called preview ""
== js pick.js
when picker is changed
    set picked to file in picker
    set the text of details to "{picked.name}: {picked.size} bytes"
    wait for picked.text() and store in content
    set the text of preview to content.slice(0, 500)`,

// ---------------------------------------------------------------- shapes and colour

`part: colour-codes
title: Colour codes
group: graphics
types: webpage, graphics-3d, browser-extension
about: Turn #RRGGBB into red, green and blue numbers and back, and into hue, saturation and lightness.
summary: A hex colour is three numbers from 0 to 255 written in base 16: #4f7cff is red 79, green 124, blue 255. HSL describes the same colour as a hue (an angle round the colour wheel), saturation and lightness, which is easier for making lighter, darker or matching shades.
learn: Base 16 (hexadecimal); the colour wheel.
source: CSS Color Module Level 4 (W3C) | https://www.w3.org/TR/css-color-4/ | hex notation and the HSL model
== python colour.py
import colorsys

define hex to rgb using code
    description: Turns a code like #4f7cff into red, green and blue: (79, 124, 255).
    set digits to code.lstrip("#")
    give back int(digits[0:2], 16), int(digits[2:4], 16), int(digits[4:6], 16)

define rgb to hex using red, green, blue
    description: Turns red, green and blue into a code: (79, 124, 255) gives #4f7cff.
    give back "#{red:02x}{green:02x}{blue:02x}"

define rgb to hsl using red, green, blue
    description: Hue in degrees, saturation and lightness from 0 to 100. Python's colorsys calls it HLS and gives lightness second.
    set hls to colorsys.rgb_to_hls(red / 255, green / 255, blue / 255)
    give back round(item 0 of hls times 360), round(item 2 of hls times 100), round(item 1 of hls times 100)
== js colour.js
define hexToRgb using code
    description: Turns a code like #4f7cff into [79, 124, 255].
    constant digits is code.replace("#", "")
    give back [parseInt(digits.slice(0, 2), 16), parseInt(digits.slice(2, 4), 16), parseInt(digits.slice(4, 6), 16)]
define rgbToHex using red, green, blue
    description: Turns 79, 124, 255 into the code #4f7cff.
    give back "#" + [red, green, blue].map((n) => n.toString(16).padStart(2, "0")).join("")`,

`part: polygon-points
title: Polygons and stars
group: graphics
types: browser-game, graphics-3d
about: The corner points of a regular polygon or a star, ready to draw.
summary: The corners of a regular polygon sit evenly round a circle: corner k is at angle k × 360° / n, and x = centre + radius × cos(angle), y = centre + radius × sin(angle). A star alternates between an outer and an inner radius. Starting at -90° puts the first point at the top, because screen y grows downwards.
learn: Sine and cosine; angles in radians (π radians = 180°).
== python shapes.py
define polygon points using sides, cx, cy, radius
    description: The corners of a regular polygon, the first one at the top.
    create list points
    count k from 0 to sides minus 1
        set angle to -math.pi divided by 2 plus k times 2 times math.pi divided by sides
        add (cx + radius * math.cos(angle), cy + radius * math.sin(angle)) to points
    give back points

define star points using tips, cx, cy, outer, inner
    description: The points of a star: outer and inner corners in turn.
    create list points
    count k from 0 to tips times 2 minus 1
        set angle to -math.pi divided by 2 plus k times math.pi divided by tips
        set r to outer if k mod 2 is 0 otherwise inner
        add (cx + r * math.cos(angle), cy + r * math.sin(angle)) to points
    give back points
== html index.html
add a drawing area called sky 300 by 300
== js shapes.js
define starPoints using tips, cx, cy, outer, inner
    create list points
    repeat tips * 2 times counting with k
        constant angle is -Math.PI / 2 + k * Math.PI / tips
        constant r is k % 2 === 0 ? outer : inner
        add [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] to points
    give back points
constant star is starPoints(5, 150, 150, 120, 50)
repeat length of star times counting with k
    constant next is (k + 1) % star.length
    constant start is item k of star
    constant end is item next of star
    draw a line from start[0], start[1] to end[0], end[1] in "gold" on sky`,

`part: rotate-point
title: Rotating a point
group: graphics
types: graphics-3d, pc-game, robotics
about: Turn a point round a centre by an angle: the maths behind spinning sprites, steering and dials.
summary: To rotate a point by an angle round a centre, move the centre to the origin, rotate (x' = x cos a - y sin a, y' = x sin a + y cos a), and move back. On screens y points down, so a positive angle turns clockwise as you look at it.
learn: Sine and cosine; radians; why order matters (move, rotate, move back).
== python rotate.py
define rotate point using x, y, cx, cy, degrees
    description: (x, y) turned round (cx, cy) by degrees.
    set a to math.radians(degrees)
    set dx to x minus cx
    set dy to y minus cy
    give back cx + dx * math.cos(a) - dy * math.sin(a), cy + dx * math.sin(a) + dy * math.cos(a)
== js rotate.js
define rotatePoint using x, y, cx, cy, degrees
    constant a is degrees * Math.PI / 180
    constant dx is x - cx
    constant dy is y - cy
    give back [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)]
== cpp rotate.cpp
include cmath
include numbers

define rotate_point using double& x, double& y, double cx, double cy, double degrees giving back nothing
    set double a to degrees * std::numbers::pi / 180.0
    set double dx to x - cx
    set double dy to y - cy
    set x to cx + dx * std::cos(a) - dy * std::sin(a)
    set y to cy + dx * std::sin(a) + dy * std::cos(a)`,

`part: css-shapes
title: Rounded corners, circles, shadows and gradients
group: graphics
types: webpage, blog
about: The shapes most pages are made of, in CSS alone: cards, round pictures, pill buttons and gradient banners.
summary: Most shapes on a page are boxes with their corners rounded: a little for a card, half the height for a pill, 50% for a circle. Shadows lift a card off the page; a gradient blends two colours across a banner. None of them need pictures, so they stay sharp at any size.
learn: The box model; border-radius; linear-gradient.
source: CSS Backgrounds and Borders (MDN) | https://developer.mozilla.org/en-US/docs/Web/CSS/border-radius | border-radius values and how 50% makes a circle
== html index.html
add a section called banner
    add a big heading "Shapes"
add a card called note
    add a paragraph "A card: rounded corners and a soft shadow."
add a picture called face of "images/face.jpg" described as "A smiling face"
add a button called pill saying "A pill button"
== css style.css
style banner: background-image: linear-gradient(135deg, #4f7cff, #9b5cff), text colour white, space inside 32, rounded corners 16
style note: rounded corners 12, soft shadow, space inside 16, at most 360 wide
style face: width 96, height 96, round, object-fit: cover
style pill: rounded corners 999, space inside 8 20, no border, background #1b1f24, text colour white`,

);
