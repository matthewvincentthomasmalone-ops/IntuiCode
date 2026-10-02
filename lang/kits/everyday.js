/* IntuCode kit pack: everyday apps (productivity, money, health). To-dos that fade, tagged notes, a focus
 * timer that grows a garden, a day planner, an envelope budget, a trip-cost splitter, a subscription checker,
 * a habit streak grid, an interval timer and a breathing guide. */
(window.IntuiKitPacks = window.IntuiKitPacks || []).push(

// ---------------------------------------------------------------- Fading To-dos

`kit: fading-todos
title: Fading To-dos
layout: website
shelf: productivity
platform: web
about: A to-do list with a memory for neglect: tasks you leave alone slowly fade, so the ones you keep putting off stand out from the ones you're getting through. Kept in the browser; the same list on every device is a horizon step.
steps: todo-page!, todo-add!, todo-save*, todo-fade*, todo-clear*, todo-sync, publish`,

`component: todo-page
name: The page
depth: walk
summary: What's on the page and how it looks: a heading, a box to type a task into, and the list the tasks appear in. Later steps reach these parts by their names (new-task, task-box, todos), so if you rename one here, rename it in Mechanics too. The colours are shared names, so changing one line recolours the whole list.
learn: Forms, text boxes and lists in HTML; shared colours (CSS variables); a centred column with a maximum width.
== structure
page title is "To-dos"
add a main area called app
    add a big heading "To-dos"
    add a form called new-task
        add a label "New task" for task-box
        add a text box called task-box with hint "What needs doing?"
        add a button called add-task saying "Add"
    add a list called todos
    add a paragraph called all-clear "Nothing to do. Add a task above."
== styling
shared colour paper is #f7f5f0
shared colour ink is #22252b
shared colour muted is #737885
shared colour accent is #3d6b5a
shared colour card is #ffffff
shared colour line is #e3dfd6
style the page: font-family: system-ui, background the colour paper, text colour the colour ink, space around 0
style app: at most 560 wide, centred, space inside 40 16
style new-task: in a row, flex-wrap: wrap, gap 8
style labels: width 100%, text size 14, text colour the colour muted
style task-box: flex: 1, font: inherit, space inside 12, border 1 the colour line, rounded corners 10, background the colour card, text colour the colour ink
style add-task: font: inherit, space inside 12 20, background the colour accent, text colour white, no border, rounded corners 10, bold, hand cursor
style todos: list-style: none, space inside 0, space around 24 0 0
style list items: space inside 14 16, space around 0 0 8, background the colour card, border 1 the colour line, rounded corners 10, hand cursor, transition: opacity 0.6s
note: Ticked tasks are put in this group by Mechanics.
create group done: text-decoration: line-through, text colour the colour muted
style all-clear: text colour the colour muted, centre the text`,

`component: todo-add
name: Adding and ticking off tasks
depth: walk
summary: The heart of the list. Each task is a small record (its text, whether it's done, when it was added and when it was last touched), and all of them live in one list, tasks. draw empties the list on the page and builds it again from tasks, so the page always matches the data. Type a task and press Enter to add it; click a task to tick it off, and again to untick it. Later steps join in by adding a tool to afterDraw, which runs after every redraw.
learn: Lists of records (objects); drawing the page from data; Date.now(), the time as a number of milliseconds; tools (functions) kept in a list.
== mechanics
note: Every task: its text, whether it's done, and when it was added and last touched (in milliseconds, from Date.now()).
create list tasks
note: Tools that later steps add here run after every redraw.
create list afterDraw

define draw
    clear todos
    for each task in tasks
        add task.text to the list todos
        set row to the last item of todos.children
        if task.done
            run row.classList.add with "done"
        note: Clicking a task ticks it, or unticks it. () => makes a small tool on the spot, for this one task.
        set row.onclick to () => tick(task)
    if tasks is empty
        reveal all-clear
    otherwise
        hide all-clear
    for each extra in afterDraw
        run extra

define tick using task
    set task.done to not task.done
    set task.touched to Date.now()
    run draw

when new-task is sent
    get the text of task-box and store in text
    set text to text.trim()
    if text is not empty text
        add {"text": text, "done": false, "added": Date.now(), "touched": Date.now()} to tasks
        clear task-box
        run draw

run draw`,

`component: todo-save
name: Remembered in the browser
depth: walk
summary: Without this step the list is gone when the page closes. Every browser keeps a little storage for each site (localStorage): this step loads the saved tasks when the page opens, and saves them again after every redraw. It belongs to this browser on this device, so your phone keeps a different list (making them match is a horizon step), and clearing the browser's site data wipes it.
learn: localStorage; JSON, the text that lists and records are saved as; why saving after every change is simpler than remembering when to save.
== mechanics
load "fading-todos" from the browser and store in saved
if saved is not nothing
    set tasks to saved

define remember
    save tasks in the browser as "fading-todos"

add remember to afterDraw
run draw`,

`component: todo-fade
name: Fading what's left alone
depth: hallway
summary: The twist. A task fades a little for every day nobody touches it (ticking or unticking counts), down to a faint ghost after FADE_DAYS, so the tasks you keep avoiding stand out at a glance. It works from the time saved with each task, so it needs the browser step to fade across days; to watch it happen today, set FADE_DAYS to 0.002 (about three minutes). You write the fading itself: how strong a task looks after so many days.
learn: Times as numbers (milliseconds since 1970); Math.max, to keep a value from going below a floor; opacity in CSS.
blank: ‹how strong the task looks, from 0.2 to 1› | a calculation | Full strength is 1, and after \`FADE_DAYS\` days it has all faded, so take away the share \`days\` is of \`FADE_DAYS\`. \`Math.max\` gives back the bigger of two numbers, so giving it 0.2 as well keeps the result from going below 0.2. | Math.max(0.2, 1 minus days divided by FADE_DAYS)
== mechanics
note: After how many days untouched a task is as faint as it gets.
constant FADE_DAYS is 7
constant DAY is 24 times 60 times 60 times 1000

define fade
    repeat length of tasks times counting with i
        set task to item i of tasks
        set row to item i of todos.children
        if task.done
            skip to next
        set days to (Date.now() minus task.touched) divided by DAY
        note: 1 is full strength. Never go below 0.2, so even the oldest task can still be read.
        set strength to ‹how strong the task looks, from 0.2 to 1›
        set row.style.opacity to strength
        set row.title to "Days untouched: {Math.floor(days)}"

add fade to afterDraw
run draw
note: Keep fading while the page stays open.
every 60 seconds
    run fade`,

`component: todo-clear
name: Clearing ticked tasks
depth: walk
summary: Ticked tasks stay on the list, crossed out, so you can enjoy them for a while; this button sweeps them away for good. filter makes a new list of only the tasks that pass a test (here: not done), and the list then redraws, and saves if the browser step is in.
learn: filter, and small tools written in one line (task => not task.done); why making a new list is safer than removing items from a list while going through it.
== structure
add a button called clear-done saying "Clear ticked tasks"
== styling
style clear-done: display: block, centred, font: inherit, space inside 10 18, background transparent, text colour the colour muted, border 1 the colour line, rounded corners 999, hand cursor
== mechanics
when clear-done is clicked
    set tasks to tasks.filter(task => not task.done)
    run draw`,

`component: todo-sync
name: The same list on every device
depth: horizon
summary: The browser's storage belongs to one browser on one device. To see the same tasks on your phone and your computer, the list has to live on a server as well, behind an account so it's yours alone, with both copies kept in step, including when one device was offline and both changed the same task.
usual: A ready-made backend such as Supabase or Firebase (a database, accounts and live updates in one); your own server and database (the Online service path builds one); IndexedDB for bigger storage that works offline.
learn: Accounts and logins; fetch, to send and load data; what to do when two devices disagree (the latest change wins is the simple answer).`,

// ---------------------------------------------------------------- Tag Notes

`kit: tag-notes
title: Tag Notes
layout: website
shelf: productivity
platform: web
about: Quick notes with #tags written into the text: the tags gather into a row of buttons, and clicking one shows only the notes that carry it. Kept in the browser; your notes on every device is a horizon step.
steps: notes-page!, notes-add!, notes-save*, notes-tags*, notes-edit*, notes-sync, publish`,

`component: notes-page
name: The page
depth: walk
summary: What's on the page and how it looks: a box to write a note in, an empty row for tag buttons, and the board the notes appear on, newest first. The tag row stays empty (and takes no space) until the Tags step fills it. Notes keep their line breaks, thanks to white-space: pre-wrap, so a note can be a short list.
learn: Big text boxes (textarea); lists styled as a row of buttons or a column of cards; white-space in CSS.
== structure
page title is "Notes"
add a main area called app
    add a big heading "Notes"
    add a form called new-note
        add a label "New note (add #tags, like #work or #idea)" for note-box
        add a big text box called note-box with hint "Book the dentist #errands"
        add a button called add-note saying "Save note"
    note: The Tags step fills this list with a button for every #tag.
    add a list called filters
    add a list called board
    add a paragraph called no-notes "No notes yet."
== styling
shared colour paper is #f6f4ef
shared colour ink is #23262d
shared colour muted is #727784
shared colour accent is #8a4b2a
shared colour card is #ffffff
shared colour line is #e2ddd3
style the page: font-family: system-ui, background the colour paper, text colour the colour ink, space around 0
style app: at most 640 wide, centred, space inside 40 16
style new-note: in a column, gap 8
style labels: text size 14, text colour the colour muted
style note-box: font: inherit, min-height: 90px, resize: vertical, space inside 12, border 1 the colour line, rounded corners 10, background the colour card, text colour the colour ink
style add-note: align-self: flex-end, font: inherit, space inside 10 20, background the colour accent, text colour white, no border, rounded corners 10, bold, hand cursor
style filters: list-style: none, in a row, flex-wrap: wrap, gap 8, space inside 0, space around 20 0 0
note: The tag buttons, and the one being shown.
style #filters li: space inside 6 12, rounded corners 999, border 1 the colour line, background the colour card, text size 14, hand cursor
style #filters .chosen: background the colour accent, border-color: var(--accent), text colour white
style board: list-style: none, space inside 0, space around 20 0 0
style #board li: space inside 14 16, space around 0 0 10, background the colour card, border 1 the colour line, rounded corners 10, white-space: pre-wrap
style no-notes: text colour the colour muted, centre the text`,

`component: notes-add
name: Writing notes
depth: walk
summary: Each note is a small record (its text and when it was written), and all of them live in one list, notes, newest first. draw empties the board and builds it again from that list, so the page always matches the data; later steps join in by adding a tool to afterDraw. The Enter key makes a new line in a big text box, so a note is saved with the button.
learn: Lists of records (objects); unshift, which puts an item at the front of a list; drawing the page from data.
== mechanics
note: Every note: its text, and when it was written (milliseconds, from Date.now()).
create list notes
note: Tools that later steps add here run after every redraw.
create list afterDraw

define draw
    clear board
    for each note in notes
        add note.text to the list board
    if notes is empty
        reveal no-notes
    otherwise
        hide no-notes
    for each extra in afterDraw
        run extra

when new-note is sent
    get the text of note-box and store in text
    set text to text.trim()
    if text is not empty text
        note: unshift puts the new note at the front, so the newest is at the top.
        run notes.unshift with {"text": text, "made": Date.now()}
        clear note-box
        run draw

run draw`,

`component: notes-save
name: Remembered in the browser
depth: walk
summary: Without this step the notes are gone when the page closes. The browser keeps a little storage for each site (localStorage): this step loads the saved notes when the page opens and saves them after every redraw. It belongs to this browser on this device, and clearing the browser's site data wipes it, so for notes that matter, a server (a horizon step) is the real home.
learn: localStorage; JSON, the text that lists and records are saved as.
== mechanics
load "tag-notes" from the browser and store in saved
if saved is not nothing
    set notes to saved

define remember
    save notes in the browser as "tag-notes"

add remember to afterDraw
run draw`,

`component: notes-tags
name: Tags and filtering
depth: hallway
summary: The twist. Every #word in a note is a tag: they're collected from all the notes into a row of buttons, sorted, with no repeats, and clicking one shows only the notes that carry it (clicking it again shows them all). Tags are compared in lowercase, so #Work and #work are one tag. You fill in the two key parts: finding the #words in a note, and deciding whether a note belongs in the view.
learn: Regular expressions, in brief (/#[\\w-]+/g means a # followed by letters, digits, _ or -, all of them); includes; showing and hiding instead of rebuilding.
blank: ‹every #word in the text, as a list› | a list | \`text.match\` with the pattern \`/#[\\w-]+/g\` finds them all, but gives back nothing when there are none. \`or\` gives the value after it when the one before is nothing, and \`empty list\` is a list with nothing in it. | text.match(/#[\\w-]+/g) or empty list
blank: ‹this note belongs in the view› | a test (true or false) | Every note belongs when no tag is chosen, which is when \`chosen\` is nothing. Otherwise it belongs when its tags, from \`tagsIn(note.text)\`, contain \`chosen\`. Either is enough, so join the two tests with \`or\`. | chosen is nothing or tagsIn(note.text) contains chosen
== mechanics
note: The tag being shown, or nothing to show every note.
set chosen to nothing

define tagsIn using text
    note: 1. Every #word in the text. match gives back nothing when there are none, so or gives an empty list instead.
    set found to ‹every #word in the text, as a list›
    give back found.map(tag => tag in lowercase)

define showTags
    clear filters
    create list seen
    for each note in notes
        for each tag in tagsIn(note.text)
            if not (seen contains tag)
                add tag to seen
    run seen.sort
    for each tag in seen
        add tag to the list filters
        set chip to the last item of filters.children
        if tag is chosen
            run chip.classList.add with "chosen"
        set chip.onclick to () => choose(tag)

define choose using tag
    if tag is chosen
        set chosen to nothing
    otherwise
        set chosen to tag
    run draw

define showMatching
    repeat length of notes times counting with i
        set note to item i of notes
        set row to item i of board.children
        note: 2. Does this note belong in the view?
        set fits to ‹this note belongs in the view›
        set row.hidden to not fits

add showTags to afterDraw
add showMatching to afterDraw
run draw`,

`component: notes-edit
name: Changing and deleting notes
depth: walk
summary: Click a note to change it: a small box asks for the new text, starting from the old. Empty it to delete the note; Cancel leaves it as it was. Deleting uses filter, which keeps every note except this one. It's the browser's own question box (prompt), which is plain but works everywhere; a real app would edit in place.
learn: prompt, and the nothing it gives back on Cancel; filter; telling an empty answer from no answer.
== mechanics
define offerEdits
    repeat length of notes times counting with i
        set note to item i of notes
        set row to item i of board.children
        set row.onclick to () => edit(note)

define edit using note
    ask "Change the note (empty it to delete it):", note.text and store in changed
    note: Cancel gives back nothing: then nothing changes.
    if changed is nothing
        give back
    set changed to changed.trim()
    if changed is empty text
        set notes to notes.filter(other => other is not note)
    otherwise
        set note.text to changed
    run draw

add offerEdits to afterDraw
run draw`,

`component: notes-sync
name: Your notes on every device
depth: horizon
summary: The browser's storage is one browser on one device, and it can be wiped. Notes worth keeping live on a server, behind an account, and are copied down to each device, with search across all of them once there are hundreds.
usual: A ready-made backend such as Supabase or Firebase (a database, accounts and live updates); your own server (the Online service path builds one, and it happens to be a notes service); IndexedDB for large offline storage.
learn: Accounts and logins; fetch, to send and load notes; full-text search; keeping two copies in step.`,

// ---------------------------------------------------------------- Focus Garden

`kit: focus-garden
title: Focus Garden
layout: website
shelf: productivity
platform: phone
about: A 25-minute focus timer (the Pomodoro technique) where every finished session grows a plant one stage, from seed to tree, and grown trees fill a garden row. Made for a phone: one column, big buttons. A reminder that reaches a locked phone is a horizon step.
steps: focus-page!, focus-timer!, focus-garden*, focus-chime*, focus-history, notifications, installable`,

`component: focus-page
name: The timer screen
depth: walk
summary: One screen, made for a phone: a line saying what's happening, the time left in big numbers, and two buttons wide enough for a thumb. tabular-nums gives every digit the same width, so the time doesn't wobble as it counts down. The shared colours get darker values in dark mode, so the whole screen follows the phone's setting.
learn: Designing for thumbs (buttons at least 44 pixels tall); flex, to share a row between buttons; dark mode with shared colours.
== structure
page title is "Focus Garden"
add a main area called app
    add a paragraph called status "Ready when you are."
    add a paragraph called clock "25:00"
    add a block called controls
        add a button called start saying "Start"
        add a button called reset saying "Reset"
== styling
shared colour paper is #f3f6f0
shared colour ink is #1f2a1f
shared colour muted is #66735f
shared colour accent is #4f7a3a
shared colour card is #ffffff
style the page: font-family: system-ui, background the colour paper, text colour the colour ink, space around 0
style app: at most 480 wide, centred, space inside 32 16 40, centre the text
style status: text colour the colour muted, text size 18, space around 0
style clock: text size 88, bold, font-variant-numeric: tabular-nums, line-height: 1, space around 12 0 28
style controls: in a row, gap 12
style buttons: font: inherit, text size 20, at least 56 tall, rounded corners 16, hand cursor
style start: flex: 2, background the colour accent, text colour white, no border, bold
style reset: flex: 1, background transparent, text colour the colour ink, border 1 the colour muted
in dark mode:
    style the page: --paper: #131a12, --ink: #e6efe0, --muted: #9aab90, --accent: #6f9f52, --card: #1d261b`,

`component: focus-timer
name: The 25-minute timer
depth: walk
summary: Start, pause, carry on and reset, counting down from 25 minutes. The gotcha: browsers slow timers down in tabs you aren't looking at, and phones pause them when the screen locks, so counting seconds one by one drifts. Instead the timer remembers when the session will end (endsAt) and, every second, works out what's left from the clock. When a session finishes, the tools in whenFinished run: later steps add theirs there.
learn: Date.now() and working with times as numbers; every (setInterval); Math.ceil and Math.floor; keeping state in a few named values.
== mechanics
note: How long one focus session lasts, in minutes. Try 0.1 (six seconds) to see one finish.
constant FOCUS_MINUTES is 25
note: While a session runs, endsAt is when it ends (in milliseconds). While it's paused, endsAt is nothing and leftMs keeps what's left.
set endsAt to nothing
set leftMs to FOCUS_MINUTES times 60000
note: Tools that later steps add here run when a session finishes.
create list whenFinished

define clockText using ms
    set totalSeconds to Math.ceil(ms divided by 1000)
    set minutes to Math.floor(totalSeconds divided by 60)
    set seconds to totalSeconds mod 60
    if seconds is less than 10
        set seconds to "0{seconds}"
    give back "{minutes}:{seconds}"

define refresh
    set the text of clock to clockText(leftMs)
    if endsAt is not nothing
        set the text of start to "Pause"
    otherwise if leftMs is less than FOCUS_MINUTES times 60000
        set the text of start to "Carry on"
    otherwise
        set the text of start to "Start"

when start is clicked
    if endsAt is nothing
        set endsAt to Date.now() plus leftMs
        set the text of status to "Focusing. The rest can wait."
    otherwise
        set leftMs to endsAt minus Date.now()
        set endsAt to nothing
        set the text of status to "Paused."
    run refresh

when reset is clicked
    set endsAt to nothing
    set leftMs to FOCUS_MINUTES times 60000
    set the text of status to "Ready when you are."
    run refresh

note: Every second, work out what's left from the clock, rather than counting seconds.
every 1 seconds
    if endsAt is not nothing
        set leftMs to endsAt minus Date.now()
        if leftMs is at most 0
            set endsAt to nothing
            set leftMs to FOCUS_MINUTES times 60000
            set the text of status to "Session done. Take a five-minute break."
            for each extra in whenFinished
                run extra
        run refresh

run refresh`,

`component: focus-garden
name: The garden that grows
depth: hallway
summary: The twist, and the reason to finish a session. The number of finished sessions is kept in the browser, and the plant shows the stage it has reached: seed, sprout, seedling, young plant, tree. One more session after the tree moves it into the garden row and plants a new seed. You fill in the two calculations that turn a count of sessions into a stage and a number of trees: the remainder (mod) and whole-number division.
learn: mod, the remainder after dividing, for things that go round in a cycle; Math.floor for whole-number division; repeat, to make text like 🌳🌳🌳.
blank: ‹which stage the plant is at, from 0› | a calculation | The stages go round in a cycle, one per finished session, and \`length of STAGES\` is how many there are. \`mod\` gives the remainder after dividing \`sessions\` by that, which counts 0, 1, 2, 3, 4 and back to 0. | sessions mod length of STAGES
blank: ‹how many trees have grown› | a calculation | One tree grows for every full set of stages, so divide \`sessions\` by \`length of STAGES\`. \`Math.floor\` rounds down, so a set that's only partly done doesn't count. | Math.floor(sessions divided by length of STAGES)
== structure
add a section called garden
    add a paragraph called plant "🌰"
    add a paragraph called plant-name "A seed"
    add a paragraph called grown ""
== styling
style garden: space around 8 auto 0, at most 480 wide, space inside 24 16, background the colour card, rounded corners 20, centre the text, box-sizing: border-box
style plant: text size 96, line-height: 1.1, space around 0
style plant-name: text colour the colour muted, space around 8 0 0
style grown: text size 28, letter-spacing: 4px, min-height: 1.2em, space around 12 0 0
== mechanics
note: The stages a plant grows through, one per finished session. Add stages or change the pictures: the rest follows the length of this list.
constant STAGES is ["🌰", "🌱", "🌿", "🪴", "🌳"]
constant STAGE_NAMES is ["A seed", "A sprout", "A seedling", "A young plant", "A tree"]
set sessions to 0
load "focus-garden-sessions" from the browser and store in savedSessions
if savedSessions is not nothing
    set sessions to savedSessions

define showGarden
    note: 1. Which stage the plant is at. After the last stage it starts again from a seed.
    set stage to ‹which stage the plant is at, from 0›
    note: 2. How many trees have grown all the way: one for every full set of stages.
    set trees to ‹how many trees have grown›
    set the text of plant to item stage of STAGES
    set the text of plant-name to "{item stage of STAGE_NAMES} · {sessions} sessions so far"
    set the text of grown to "🌳".repeat(trees)

define grow
    increase sessions
    save sessions in the browser as "focus-garden-sessions"
    run showGarden

add grow to whenFinished
run showGarden`,

`component: focus-chime
name: A chime when it's done
depth: walk
summary: A short rising chime, and a buzz on phones that can, when a session ends, so you don't have to watch the clock. Browsers only allow a page to make sound after a tap, so the sound is switched on by the Start button. No sentence plays a sound yet, so the chime is built, sentence by sentence, from the Web Audio API's parts: an oscillator makes a tone, a gain sets its volume and fades it out.
learn: The Web Audio API (AudioContext, oscillators, gain); why browsers block sound until a tap; vibrate, which Android phones allow and iPhones don't.
== mechanics
set audio to nothing
when start is clicked
    if audio is nothing
        set audio to new AudioContext()

define tone using pitch, delay
    set startAt to audio.currentTime plus delay
    set osc to audio.createOscillator()
    set volume to audio.createGain()
    set osc.frequency.value to pitch
    run volume.gain.setValueAtTime with 0.25, startAt
    run volume.gain.exponentialRampToValueAtTime with 0.001, startAt plus 0.8
    run osc.connect with volume
    run volume.connect with audio.destination
    run osc.start with startAt
    run osc.stop with startAt plus 0.8

define chime
    if audio is not nothing
        run tone with 660, 0
        run tone with 880, 0.25
        run tone with 1320, 0.5
    if window.navigator.vibrate
        run window.navigator.vibrate with [200, 100, 200]

add chime to whenFinished`,

`component: focus-history
name: A record of your focus
depth: horizon
summary: The garden counts sessions; a history keeps each one with its date, so the app can show a week as a bar chart, your best day, and how many sessions a day is realistic for you. That means saving a list of sessions rather than a count, and drawing a chart from it.
usual: Chart.js, or a small bar chart drawn yourself on a canvas or with CSS; IndexedDB or a server once the history grows.
learn: Lists of dated records; grouping by day; drawing on a canvas or with a chart library.`,

// ---------------------------------------------------------------- Day Planner

`kit: day-planner
title: Day Planner
layout: website
shelf: productivity
platform: web
about: Plan one day in half-hour blocks, from morning to evening: click a block to write what goes in it, and the block you're in right now is highlighted as the day moves on. Kept in the browser, with a fresh plan each day; your real calendar is a horizon step.
steps: planner-page!, planner-slots!, planner-save*, planner-now*, planner-clear, planner-calendar, publish`,

`component: planner-page
name: The page
depth: walk
summary: A heading, today's date and one long list: the day. Each block is a row with its time on the left and what's planned beside it. The time isn't part of the row's text: Mechanics stores it on the row (data-time) and the Styling shows it with ::before and attr(), so the text is only what you planned. The groups now and past are for the highlight step.
learn: Lists as rows; ::before and content: attr(…), which show text from the page's data; flex rows.
== structure
page title is "Day Planner"
add a main area called app
    add a big heading "Today"
    add a paragraph called date-line ""
    add a list called day
== styling
shared colour paper is #f7f7f4
shared colour ink is #1e2430
shared colour muted is #7a808c
shared colour accent is #2f6db5
shared colour soft is #e3edf9
shared colour card is #ffffff
shared colour line is #e4e4de
style the page: font-family: system-ui, background the colour paper, text colour the colour ink, space around 0
style app: at most 640 wide, centred, space inside 32 16
style big headings: space around 0
style date-line: text colour the colour muted, space around 4 0 24
style day: list-style: none, space inside 0, space around 0, background the colour card, border 1 the colour line, rounded corners 12, overflow: hidden
style list items: in a row, gap 16, at least 44 tall, space inside 0 16, border-bottom: 1px solid var(--line), hand cursor
note: The time at the start of every row, from its data-time. A style sentence can't name ::before yet (its colons end the name), so this line is CSS.
css: li::before { content: attr(data-time); min-width: 48px; color: var(--muted); font-variant-numeric: tabular-nums; }
when list items is hovered: background the colour soft
create group now: background the colour soft, box-shadow: inset 4px 0 0 var(--accent), bold
create group past: text colour the colour muted`,

`component: planner-slots
name: The half-hour blocks
depth: walk
summary: The day as data: a list of when each block starts, in minutes after midnight (420 is 7:00), and plans, a record of what's planned by time, like {"07:30": "Gym"}. draw builds a row for every block; click one to type what goes in it, or empty it to clear it. Minutes after midnight add up and compare like any other number, and clockTime turns them into 07:30 for people. Later steps join in through afterDraw.
learn: Records (objects) as lookup tables; while loops; padStart, to write 7 as 07; prompt.
== mechanics
note: The day runs from START_HOUR to END_HOUR, in blocks of SLOT_MINUTES.
constant START_HOUR is 7
constant END_HOUR is 22
constant SLOT_MINUTES is 30
note: When each block starts, in minutes after midnight.
create list starts
set minute to START_HOUR times 60
while minute is less than END_HOUR times 60
    add minute to starts
    increase minute by SLOT_MINUTES
note: What's planned, by the time it starts.
set plans to {}
note: Tools that later steps add here run after every redraw.
create list afterDraw

define clockTime using minutes
    set hours to Math.floor(minutes divided by 60)
    set mins to minutes mod 60
    note: padStart puts a 0 in front of a single digit: 7 becomes 07.
    give back "{String(hours).padStart(2, '0')}:{String(mins).padStart(2, '0')}"

define draw
    clear day
    for each start in starts
        set time to clockTime(start)
        add plans[time] or empty text to the list day
        set slot to the last item of day.children
        set slot.dataset.time to time
        set slot.onclick to () => plan(time)
    for each extra in afterDraw
        run extra

define plan using time
    ask "What's planned at {time}? (Empty it to clear the block.)", plans[time] or empty text and store in answer
    note: Cancel gives back nothing: then nothing changes.
    if answer is not nothing
        note: There's no sentence yet for changing one entry of a record ("set item … of … to …" is Python only), so this line is JavaScript.
        js: plans[time] = answer.trim();
        run draw

set the text of date-line to new Date().toLocaleDateString(undefined, {"weekday": "long", "day": "numeric", "month": "long"})
run draw`,

`component: planner-save
name: A saved plan for each day
depth: walk
summary: Plans are kept in the browser under today's date, like planner-2026-10-1, so tomorrow starts with an empty day while today's plan is still there if you come back to it. The gotcha in making that name: getMonth counts from 0 (January is 0), so it needs plus 1. Old days stay in the browser's storage; they're tiny, but a real app would tidy them away.
learn: localStorage keys made from data; getFullYear, getMonth and getDate; why months count from 0 in JavaScript.
== mechanics
set today to new Date()
set dayName to "planner-{today.getFullYear()}-{today.getMonth() plus 1}-{today.getDate()}"
load dayName from the browser and store in savedPlan
if savedPlan is not nothing
    set plans to savedPlan

define remember
    save plans in the browser as dayName

add remember to afterDraw
run draw`,

`component: planner-now
name: Highlighting now
depth: hallway
summary: The twist that makes it a planner rather than a list: the block you're in is highlighted, the ones already over are greyed, and the page scrolls to now when it opens. A minute timer moves the highlight on through the day. You write the two tests, in minutes after midnight: is this block happening now (it has started and hasn't ended), and is it over?
learn: Comparing times as numbers; getHours and getMinutes; classList.toggle with a true-or-false, which adds or removes a group.
blank: ‹this block is happening now› | a test (true or false) | Everything is in minutes after midnight. The block has started when \`start\` is no later than \`minutesNow\`, and it hasn't ended while \`minutesNow\` is still before its end, \`start plus SLOT_MINUTES\`. Both have to be true, so join them with \`and\`. | start is at most minutesNow and minutesNow is less than start plus SLOT_MINUTES
blank: ‹this block is over› | a test (true or false) | The block ends at \`start plus SLOT_MINUTES\`, in minutes after midnight. It's over once that end is no later than \`minutesNow\`. | start plus SLOT_MINUTES is at most minutesNow
== mechanics
set scrolled to false

define markNow
    set now to new Date()
    set minutesNow to now.getHours() times 60 plus now.getMinutes()
    repeat length of starts times counting with i
        set start to item i of starts
        set slot to item i of day.children
        note: 1. Happening now: it has started, and it hasn't reached its end (start plus SLOT_MINUTES).
        set isNow to ‹this block is happening now›
        note: 2. Over: its end has passed.
        set isPast to ‹this block is over›
        run slot.classList.toggle with "now", isNow
        run slot.classList.toggle with "past", isPast
        if isNow and not scrolled
            run slot.scrollIntoView with {"block": "center"}
            set scrolled to true

add markNow to afterDraw
run draw
note: Check again every minute, so the highlight moves on through the day.
every 60 seconds
    run markNow`,

`component: planner-clear
name: Clearing the day
depth: walk
summary: A button that empties every block at once, for when the day changes completely. It asks first with confirm, the browser's own OK-or-Cancel box, because there's no undo; with the save step in, the empty plan is saved straight away.
learn: confirm; giving people a way back (or at least a warning) before anything is lost.
== structure
add a button called clear-day saying "Clear the day"
== styling
style clear-day: display: block, space around 16 auto, font: inherit, space inside 10 18, background transparent, text colour the colour muted, border 1 the colour line, rounded corners 999, hand cursor
== mechanics
when clear-day is clicked
    if confirm("Clear every block of today's plan?")
        set plans to {}
        run draw`,

`component: planner-calendar
name: Your real calendar
depth: horizon
summary: Most people's days already live in a calendar (Google, Outlook, Apple). A planner that shows those meetings in its blocks, or adds its blocks to the calendar, needs permission to the calendar through the provider's sign-in, a server to keep the keys, and care with time zones.
usual: The Google Calendar API, Microsoft Graph (Outlook) or CalDAV (Apple iCloud, Fastmail); .ics files, which every calendar can import, for a one-way start.
learn: OAuth (signing in with Google or Microsoft and granting access); the iCalendar format; time zones and daylight saving.`,

// ---------------------------------------------------------------- Envelope Budget

`kit: envelope-budget
title: Envelope Budget
layout: website
shelf: money
platform: phone
about: The envelope method on a phone: the month's money is split into envelopes (rent, food, fun…), every spend comes out of one, and each envelope shows what's left in it. A new month fills them again. Kept on the phone; linking a bank account is a horizon step.
steps: envelope-page!, envelope-list!, envelope-spend!, envelope-save!, envelope-month*, envelope-charts, envelope-bank, installable`,

`component: envelope-page
name: The screen
depth: walk
summary: One phone screen: the month, the total left in big numbers, the envelopes as cards you tap to choose, and underneath, the box for what you spent. Each card is filled with colour in proportion to what's left in it, with background-size set by Mechanics, so an emptying envelope is visible at a glance. The groups chosen and over mark the envelope in use and any that's overspent.
learn: Cards made from list items; a colour bar from a background gradient and background-size; ::after with attr(); big tap targets.
== structure
page title is "Envelopes"
add a main area called app
    add a paragraph called month-name ""
    add a paragraph called total-left "£0.00"
    add a paragraph "left this month" in group caption
    add a list called cards
    add a form called spend-form
        add a label "How much did you spend?" for amount-box
        add a number box called amount-box with hint "4.50"
        add a button called spend saying "Spend"
    add a paragraph called message "Tap an envelope, then type what you spent."
== styling
shared colour paper is #f5f3ee
shared colour ink is #1f2328
shared colour muted is #6f7480
shared colour accent is #2f6f4f
shared colour fill is #d9ebe0
shared colour card is #ffffff
shared colour line is #e1ddd4
shared colour danger is #b3261e
style the page: font-family: system-ui, background the colour paper, text colour the colour ink, space around 0
style app: at most 480 wide, centred, space inside 24 16 40
style month-name: text colour the colour muted, space around 0
style total-left: text size 48, bold, font-variant-numeric: tabular-nums, space around 4 0 0
style group caption: text colour the colour muted, space around 0 0 20
style cards: list-style: none, space inside 0, space around 0, in a column, gap 10
note: Each envelope is a card. The fill shows what's left: Mechanics sets its width with background-size.
style #cards li: in a row, spread out, at least 56 tall, space inside 0 16, rounded corners 14, border 2 the colour line, background the colour card, background-image: linear-gradient(var(--fill), var(--fill)), background-repeat: no-repeat, background-size: 100% 100%, hand cursor, font-weight: 600
note: What's left, on the right of each card, from its data-left. A style sentence can't name ::after yet, so this line is CSS.
css: #cards li::after { content: attr(data-left); font-weight: 400; font-variant-numeric: tabular-nums; }
style #cards .chosen: border-color: var(--accent)
style #cards .over: text colour the colour danger
style spend-form: in a row, flex-wrap: wrap, gap 8, space around 24 0 0
style labels: width 100%, text colour the colour muted
style amount-box: flex: 1, min-width: 0, font: inherit, text size 22, space inside 12, border 1 the colour line, rounded corners 12, background the colour card, text colour the colour ink
style spend: font: inherit, text size 20, space inside 12 24, background the colour accent, text colour white, no border, rounded corners 12, bold, hand cursor
style message: text colour the colour muted, min-height: 1.5em
in dark mode:
    style the page: --paper: #121417, --ink: #e8e6e1, --muted: #9aa0ab, --accent: #5fb38a, --fill: #20372b, --card: #1b1e22, --line: #2c3036, --danger: #f2827a`,

`component: envelope-list
name: The envelopes
depth: walk
summary: The envelopes are a list of records: a name, the month's budget and what's been spent so far; what's left is always worked out (budget minus spent) rather than stored, so it can never disagree with them. draw shows each one with what's left, adds up the total, and remembers which envelope is chosen by its position in the list. Change the names and amounts to yours: MONEY is the currency sign.
learn: Lists of records; working a value out instead of storing it; toFixed, for money with two decimals; the position of an item in a list.
== mechanics
constant MONEY is "£"
note: Your envelopes: a name and how much goes in each month. Change them to yours.
create list envelopes
define addEnvelope using name, budget
    add {"name": name, "budget": budget, "spent": 0} to envelopes
run addEnvelope with "Rent", 750
run addEnvelope with "Food", 300
run addEnvelope with "Transport", 90
run addEnvelope with "Fun", 80
run addEnvelope with "Savings", 150
note: The envelope that spending comes out of: its position in the list.
set chosen to 0
note: Tools that later steps add here run after every redraw.
create list afterDraw

define money using amount
    if amount is less than 0
        give back "−{MONEY}{(0 minus amount).toFixed(2)}"
    give back "{MONEY}{amount.toFixed(2)}"

define draw
    clear cards
    set total to 0
    repeat length of envelopes times counting with i
        set envelope to item i of envelopes
        set left to envelope.budget minus envelope.spent
        increase total by left
        add envelope.name to the list cards
        set card to the last item of cards.children
        set card.dataset.left to "{money(left)} left"
        note: The fill: what's left as a share of the budget, as a width.
        set card.style.backgroundSize to "{Math.max(0, left divided by envelope.budget) times 100}% 100%"
        run card.classList.toggle with "chosen", i is chosen
        run card.classList.toggle with "over", left is less than 0
        set card.onclick to () => choose(i)
    set the text of total-left to money(total)
    for each extra in afterDraw
        run extra

define choose using position
    set chosen to position
    set envelope to item chosen of envelopes
    set the text of message to "Spending from {envelope.name}."
    run draw

set the text of month-name to new Date().toLocaleDateString(undefined, {"month": "long", "year": "numeric"})
run draw`,

`component: envelope-spend
name: Spending from an envelope
depth: walk
summary: Type what you spent and press Spend: it comes out of the chosen envelope, and the message says what's left, or how far over it has gone (an envelope can go below zero; hiding that would only hide the problem). A number box only accepts whole numbers unless it's given a step, and there's no sentence for that yet, so Mechanics sets step to "any" to allow pennies. not (amount is more than 0) also catches an empty or mistyped box.
learn: Reading numbers from a box; checking before changing anything; why a test written as not (… more than 0) catches more than one written as … at most 0.
== mechanics
note: A number box takes whole numbers only, unless it has a step: "any" allows pennies.
set amountBox to amount-box
set amountBox.step to "any"

when spend-form is sent
    get the text of amount-box and store in typed
    set amount to typed as number
    set envelope to item chosen of envelopes
    if not (amount is more than 0)
        set the text of message to "Type how much you spent, like 4.50."
    otherwise
        increase envelope.spent by amount
        clear amount-box
        set left to envelope.budget minus envelope.spent
        if left is less than 0
            set the text of message to "{money(amount)} from {envelope.name}, which is now {money(0 minus left)} over."
        otherwise
            set the text of message to "{money(amount)} from {envelope.name}: {money(left)} left."
        run draw`,

`component: envelope-save
name: Kept on the phone
depth: walk
summary: A budget that forgets is no use, so this step is always in: the envelopes are loaded from the browser's storage when the app opens and saved after every change. Once they're saved, they come from storage rather than from the list in The envelopes, so changing a budget there only shows after clearing the site's data (or saving under a name other than "envelopes").
learn: localStorage and JSON; where data comes from once it's been saved; clearing a site's data in the browser's settings.
== mechanics
load "envelopes" from the browser and store in saved
if saved is not nothing
    set envelopes to saved

define remember
    save envelopes in the browser as "envelopes"

add remember to afterDraw
run draw`,

`component: envelope-month
name: A new month
depth: hallway
summary: The envelope method runs by the month, so when a new month begins, the envelopes fill up again. The app keeps the month it was last used in ("2026-10"); when that isn't this month, every envelope starts again. You decide how: from nothing spent, or carrying over what was left (an envelope with £20 left starts the month with £20 extra, and one that went over starts short), which is one subtraction.
learn: Dates as text you can compare; doing something once when a value changes; carrying a balance over.
blank: ‹a new month has begun› | a test (true or false) | \`lastMonth\` is the month saved last time, or nothing the very first time. A new month has begun when there is a last month and it's different from \`thisMonth\`; join the two tests with \`and\`. | lastMonth is not nothing and lastMonth is not thisMonth
blank: ‹what it starts the month having spent› | a calculation | To start fresh, it has spent 0. To carry over what was left, take \`envelope.budget\` away from \`envelope.spent\`: an envelope with money left starts below zero, and one that went over starts above. | envelope.spent minus envelope.budget
== mechanics
set today to new Date()
note: This month as text, like 2026-10. getMonth counts from 0, so it needs plus 1.
set thisMonth to "{today.getFullYear()}-{today.getMonth() plus 1}"
load "envelopes-month" from the browser and store in lastMonth
note: 1. Has a new month begun since the envelopes were last used? (The very first time, there's no last month.)
if ‹a new month has begun›
    for each envelope in envelopes
        note: 2. What the envelope starts the month having spent. Carrying over what was left means starting below zero: spent minus budget.
        set envelope.spent to ‹what it starts the month having spent›
    set the text of message to "A new month: the envelopes are full again."
save thisMonth in the browser as "envelopes-month"
run draw`,

`component: envelope-charts
name: Where the money went
depth: horizon
summary: Envelopes show this month; a chart shows the pattern: food creeping up, fun always over. That needs every spend kept with its date and envelope, rather than only a running total, and a chart drawn from them, month by month.
usual: Chart.js or a small chart of your own on a canvas; a list of dated spends in IndexedDB or on a server.
learn: Keeping transactions rather than totals; grouping by month; bar and line charts.`,

`component: envelope-bank
name: Linking a bank account
depth: horizon
summary: Typing every spend is the honest way to start, and many people prefer it. Linking a bank brings spending in by itself, through regulated services (open banking in the UK and Europe) that ask the bank for permission on the person's behalf. It always needs a server, because the service's keys must never be in a page, and the app should never see a bank password.
usual: Open banking services such as TrueLayer, GoCardless Bank Account Data or Yapily (UK and Europe), Plaid (US and Canada); importing the CSV file most banks let you download.
learn: Open banking and consent; OAuth; servers and keeping keys secret; sorting transactions into envelopes.`,

// ---------------------------------------------------------------- Fair Split

`kit: fair-split
title: Fair Split
layout: website
shelf: money
platform: phone
about: For a trip or a shared house: add who's in, log each expense and who paid it, and the app works out where everyone stands and the fewest payments that settle it all. Kept on the phone; one trip shared between everyone's phones is a horizon step.
steps: split-page!, split-people!, split-expenses!, split-balances*, split-settle*, split-save*, split-share, split-currency`,

`component: split-page
name: The screen
depth: walk
summary: One phone screen, top to bottom: the people (as name buttons you tap to say who paid), a form for an expense, and the list of expenses. Boxes and buttons are big, with large text, so a thumb can fill them in. The later steps add their own sections underneath: where everyone stands, and who pays whom.
learn: Forms and labels; buttons as a wrapping row of chips; sections for the parts of a screen.
== structure
page title is "Fair Split"
add a main area called app
    add a big heading "Fair Split"
    add a heading "Who's in"
    add a form called person-form
        add a text box called person-box with hint "A name, like Sam"
        add a button called add-person saying "Add"
    add a list called crew
    add a heading "Expenses"
    add a paragraph called payer-hint "Add the people first."
    add a form called expense-form
        add a text box called what-box with hint "What for, like Dinner"
        add a number box called cost-box with hint "How much, like 42.50"
        add a button called add-expense saying "Add expense"
    add a list called spends
== styling
shared colour paper is #f6f5f1
shared colour ink is #1f2329
shared colour muted is #6e7380
shared colour accent is #5b4bb7
shared colour card is #ffffff
shared colour line is #e2dfd8
shared colour good is #2f7a4f
shared colour bad is #b3261e
style the page: font-family: system-ui, background the colour paper, text colour the colour ink, space around 0
style app: at most 480 wide, centred, space inside 24 16 0
style sections: at most 480 wide, centred, space inside 0 16, box-sizing: border-box
style headings: space around 24 0 8
style forms: in a row, flex-wrap: wrap, gap 8
style text boxes: flex: 1, min-width: 0, font: inherit, text size 18, space inside 12, border 1 the colour line, rounded corners 12, background the colour card, text colour the colour ink
style buttons: font: inherit, text size 18, at least 48 tall, space inside 0 18, rounded corners 12, hand cursor
style add-person: background the colour accent, text colour white, no border, bold
style add-expense: width 100%, background the colour accent, text colour white, no border, bold
style crew: list-style: none, space inside 0, in a row, flex-wrap: wrap, gap 8
note: The people are buttons to tap; the one who paid is marked.
style #crew li: space inside 10 16, rounded corners 999, border 1 the colour line, background the colour card, hand cursor
style #crew .payer: background the colour accent, border-color: var(--accent), text colour white
style payer-hint: text colour the colour muted, space around 0 0 8
style spends: list-style: none, space inside 0
style #spends li: space inside 12 0, border-bottom: 1px solid var(--line), hand cursor
in dark mode:
    style the page: --paper: #131317, --ink: #e8e7ee, --muted: #9c9fae, --accent: #8f81f0, --card: #1d1d24, --line: #2e2e38, --good: #6fd09a, --bad: #f2827a`,

`component: split-people
name: Who's in
depth: walk
summary: The people sharing the costs: a list of names, each shown as a button. Tap a name to make them the payer of the next expense; the first person added starts as the payer. A name can only be added once, because names are how expenses say who paid. Later steps join in by adding a tool to afterDraw, which runs after every redraw.
learn: Lists of text; contains, to check for repeats; one value (payer) that the whole screen follows.
== mechanics
create list people
note: The person who paid the next expense, or nothing before anyone is added.
set payer to nothing
note: Tools that later steps add here run after every redraw.
create list afterDraw

define draw
    clear crew
    for each person in people
        add person to the list crew
        set chip to the last item of crew.children
        run chip.classList.toggle with "payer", person is payer
        set chip.onclick to () => choosePayer(person)
    if payer is not nothing
        set the text of payer-hint to "Paid by {payer}. Tap another name to change it."
    for each extra in afterDraw
        run extra

define choosePayer using person
    set payer to person
    run draw

when person-form is sent
    get the text of person-box and store in name
    set name to name.trim()
    if name is not empty text and not (people contains name)
        add name to people
        clear person-box
        if payer is nothing
            set payer to name
        run draw

run draw`,

`component: split-expenses
name: Expenses
depth: walk
summary: Each expense is a record: what it was for, how much, and who paid. balancesOf is the maths everything else stands on: everyone shares every expense equally, so each person's balance is what they paid minus their share of everything; above zero they're owed money, below zero they owe it. Tap an expense to remove it (it asks first). Amounts need a step of "any" to allow pennies, which only Mechanics can set for now.
learn: Lists of records; adding up in a loop; positions in two lists that line up (people and balances); filter.
== mechanics
constant MONEY is "£"
note: A number box takes whole numbers only, unless it has a step: "any" allows pennies.
set costBox to cost-box
set costBox.step to "any"
note: Every expense: what it was for, how much, and who paid.
create list expenses

define balancesOf
    note: One balance for each person, in the same order as people: what they paid, minus their share of everything.
    create list balances
    for each person in people
        add 0 to balances
    for each spend in expenses
        set share to spend.amount divided by length of people
        repeat length of people times counting with i
            decrease item i of balances by share
        set who to people.indexOf(spend.paidBy)
        increase item who of balances by spend.amount
    give back balances

define showExpenses
    clear spends
    for each spend in expenses
        add "{spend.what}: {MONEY}{spend.amount.toFixed(2)}, paid by {spend.paidBy}" to the list spends
        set row to the last item of spends.children
        set row.onclick to () => removeExpense(spend)

define removeExpense using spend
    if confirm("Remove {spend.what}?")
        set expenses to expenses.filter(other => other is not spend)
        run draw

when expense-form is sent
    get the text of what-box and store in what
    get the text of cost-box and store in typed
    set amount to typed as number
    if payer is nothing
        set the text of payer-hint to "Add the people first, then tap who paid."
    otherwise if what.trim() is empty text or not (amount is more than 0)
        set the text of payer-hint to "Say what it was for, and how much."
    otherwise
        add {"what": what.trim(), "amount": amount, "paidBy": payer} to expenses
        clear what-box
        clear cost-box
        run draw

add showExpenses to afterDraw
run draw`,

`component: split-balances
name: Where everyone stands
depth: walk
summary: A line for each person: owed money, owes money, or square. It uses balancesOf from the Expenses step and only shows the result. Money in decimals is never quite exact (0.1 plus 0.2 isn't exactly 0.3 to a computer), so anything within half a penny of zero counts as square.
learn: Two lists that line up by position; toFixed for money; why decimal numbers need a tolerance.
== structure
add a section called standing
    add a heading "Where everyone stands"
    add a list called tally
== styling
style tally: list-style: none, space inside 0
style #tally li: space inside 8 0
create group owed: text colour the colour good
create group owes: text colour the colour bad
== mechanics
define showBalances
    clear tally
    run balancesOf and store in balances
    repeat length of people times counting with i
        set person to item i of people
        set balance to item i of balances
        if balance is at least 0.005
            add "{person} is owed {MONEY}{balance.toFixed(2)}" to the list tally
            set row to the last item of tally.children
            run row.classList.add with "owed"
        otherwise if balance is at most -0.005
            add "{person} owes {MONEY}{(0 minus balance).toFixed(2)}" to the list tally
            set row to the last item of tally.children
            run row.classList.add with "owes"
        otherwise
            add "{person} is square" to the list tally

add showBalances to afterDraw
run draw`,

`component: split-settle
name: Settling up in few payments
depth: hallway
summary: The twist: instead of everyone paying everyone back, the app suggests a short list of payments. Each round, whoever owes the most pays whoever is owed the most, as much as one of them needs, so at least one of them is square afterwards: never more payments than people minus one, usually fewer. (The very fewest in every case is a famously hard problem; this greedy way is what most apps use.) You write how much changes hands, and when to stop.
learn: Greedy algorithms; Math.min, Math.max and indexOf; ... (spread), to give a list to Math.min; stopping a loop early.
blank: ‹how much changes hands› | a calculation | The debtor owes \`0 minus item debtor of balances\` (their balance is below zero), and the creditor is owed \`item creditor of balances\`. Only the smaller of the two can change hands, and \`Math.min\` gives back the smallest of the numbers it's given. | Math.min(0 minus item debtor of balances, item creditor of balances)
blank: ‹nothing is left worth paying› | a test (true or false) | Decimals are never quite exact, so a tiny \`amount\` can be left over when everyone is square. Compare it with half a penny, which is 0.005. | amount is less than 0.005
== structure
add a section called settle
    add a heading "To settle up"
    add a list called payments
== styling
style payments: list-style: none, space inside 0
style #payments li: space inside 10 14, space around 0 0 8, background the colour card, border 1 the colour line, rounded corners 12, bold
== mechanics
define settleUp
    clear payments
    run balancesOf and store in balances
    repeat length of people times
        set debtor to balances.indexOf(Math.min(...balances))
        set creditor to balances.indexOf(Math.max(...balances))
        note: 1. The debtor owes minus their balance; the creditor is owed their balance. Only the smaller amount can change hands.
        set amount to ‹how much changes hands›
        note: 2. Everyone is square when there's less than half a penny left to pay (decimals are never quite exact).
        if ‹nothing is left worth paying›
            stop the loop
        add "{item debtor of people} pays {item creditor of people} {MONEY}{amount.toFixed(2)}" to the list payments
        increase item debtor of balances by amount
        decrease item creditor of balances by amount
    if payments.children is empty
        add "Nobody owes anybody anything." to the list payments

add settleUp to afterDraw
run draw`,

`component: split-save
name: Kept on the phone, and a new trip
depth: walk
summary: The people and expenses are saved in the browser's storage after every change, and loaded when the app opens, so closing the page mid-trip loses nothing. Because they're kept, the app needs a way to start over: a New trip button that clears both, after asking. The storage is this phone's alone; everyone seeing the same trip is a horizon step.
learn: localStorage and JSON; confirm before anything is lost; saving two lists under two names.
== structure
add a section called trip
    add a button called new-trip saying "Start a new trip"
== styling
style new-trip: width 100%, space around 24 0 40, background transparent, text colour the colour muted, border 1 the colour line
== mechanics
load "split-people" from the browser and store in savedPeople
load "split-expenses" from the browser and store in savedExpenses
if savedPeople is not nothing
    set people to savedPeople
    set payer to first item of people
if savedExpenses is not nothing
    set expenses to savedExpenses

define remember
    save people in the browser as "split-people"
    save expenses in the browser as "split-expenses"

when new-trip is clicked
    if confirm("Start a new trip? Everyone and every expense will be cleared.")
        set people to empty list
        set expenses to empty list
        set payer to nothing
        set the text of payer-hint to "Add the people first."
        run draw

add remember to afterDraw
run draw`,

`component: split-share
name: One trip on everyone's phone
depth: horizon
summary: Right now the trip lives on one phone. For everyone to add their own expenses and see the same balances, the trip lives on a server, with a link to join it, and every phone keeps up with the changes, including ones made while offline.
usual: A ready-made backend such as Supabase or Firebase (a database and live updates); your own server (the Online service path builds one); a share link with a long random code in it.
learn: Data that several people change; links with secret codes; live updates; what happens when two phones change the same thing.`,

`component: split-currency
name: Several currencies
depth: horizon
summary: Trips abroad mix currencies: a hotel in euros, a train in pounds. Each expense then keeps its own currency and amount, and the balances are worked out in one currency at the exchange rate of the day it was spent, rounded to pennies only at the end.
usual: A free exchange-rate service such as Frankfurter (European Central Bank rates); Intl.NumberFormat, to show amounts in each currency's own style.
learn: Storing a currency with every amount; exchange rates that change daily; rounding money; Intl.NumberFormat.`,

// ---------------------------------------------------------------- Subscription Check

`kit: subscription-check
title: Subscription Check
layout: structured
shelf: money
platform: pc
about: A program you type into that keeps an eye on your subscriptions: what each costs, the monthly and yearly totals, and which renew in the next seven days, so nothing quietly takes money you'd forgotten about. Saved in a file next to the program; plain Python, nothing to install.
steps: subs-data!, subs-menu!, subs-add*, subs-list*, subs-totals*, subs-soon*, subs-cancel, subs-reminders`,

`component: subs-data
name: The subscriptions and their file
depth: walk
summary: Every subscription is a small dictionary: a name, a price, how often it's paid ("month" or "year"), the date it next renews and the day of the month it's due. JSON has no dates, so dates are kept as text written year-month-day, which also sorts in date order. At the start, dates that have passed move on to the next renewal; the day is kept apart because a month after 31 January is 28 February, and the month after that is 31 March again.
learn: Dictionaries; JSON files; the datetime module (date, timedelta, fromisoformat); calendar.monthrange, for how many days a month has.
== settings
note: Where the subscriptions are kept, next to the program.
set data file to "subscriptions.json"
note: The subscriptions while the program runs, each a small dictionary.
create list subscriptions
== tools
define make subscription using name, price, every, renews
    description: One subscription: a small dictionary. renews is a date written as text, like "2026-10-31".
    python: from datetime import date
    create dictionary sub
    set item "name" of sub to name
    set item "price" of sub to price
    set item "every" of sub to every
    set item "renews" of sub to renews
    note: The day of the month it's due, kept for months that are too short for it.
    set item "day" of sub to date.fromisoformat(renews).day
    give back sub

define save subscriptions
    description: Writes every subscription to the data file, as JSON.
    python: import json
    open the file data file for writing as f
        run json.dump with subscriptions, f, indent=2

define next renewal using renews, every, day
    description: The renewal after this one: a year or a month later, on its day of the month, or that month's last day if it's shorter.
    python: import calendar
    python: from datetime import date
    if every is "year"
        set year to renews.year + 1
        set month to renews.month
    otherwise
        note: After December (12) comes January of the next year: // and % do the carrying.
        set year to renews.year + renews.month // 12
        set month to renews.month % 12 + 1
    note: monthrange gives back the weekday the month starts on and how many days it has.
    set last day to calendar.monthrange(year, month)[1]
    give back date(year, month, min(day, last day))

define update renewal dates
    description: Moves every renewal date that has passed on to the next one, so every date in the list is still to come.
    python: from datetime import date
    set today to date.today()
    for each sub in subscriptions
        set renews to date.fromisoformat(sub["renews"])
        while renews is less than today
            run next renewal with renews, sub["every"], sub["day"] and store in renews
        set item "renews" of sub to str(renews)

define load subscriptions
    description: Reads the saved subscriptions; the first time, it starts with three examples to try things on.
    python: import json, os
    python: from datetime import date, timedelta
    if os.path.exists(data file)
        open the file data file as f
            set saved to json.load(f)
        for each sub in saved
            add sub to subscriptions
    otherwise
        set today to date.today()
        run make subscription with "Music", 10.99, "month", str(today + timedelta(days=3)) and store in example
        add example to subscriptions
        run make subscription with "Cloud storage", 99.0, "year", str(today + timedelta(days=40)) and store in example
        add example to subscriptions
        run make subscription with "Films", 7.99, "month", str(today + timedelta(days=12)) and store in example
        add example to subscriptions
    run update renewal dates`,

`component: subs-menu
name: The menu
depth: walk
summary: The front desk: it loads the subscriptions, then asks "> " again and again and runs the command typed. Commands live in a dictionary, the word to type next to the tool it runs, so each later step only has to add itself to appear here. Everything is saved after every command, and again on quit, so the moved-on dates are kept too.
learn: Loops that run until told to stop; dictionaries as lookup tables; tools (functions) as values.
== settings
note: Every command people can type, and the tool it runs. Each later step adds its own.
create dictionary commands
== tools
define show help
    description: Lists the commands that can be typed.
    show "Commands:"
    for each word in commands
        show "  {word}"
    show "  help"
    show "  quit"
== main
run load subscriptions
show "Subscriptions: {length of subscriptions}. Type help to see the commands."
repeat forever
    ask "> " and store in choice
    set choice to choice.strip() in lowercase
    if choice is "quit"
        stop the loop
    otherwise if choice is "help"
        run show help
    otherwise if choice is in commands
        set chosen tool to item choice of commands
        run chosen tool
        run save subscriptions
    otherwise if choice
        show "There's no command '{choice}'. Type help to see them."
run save subscriptions
show "Bye."`,

`component: subs-add
name: Adding a subscription
depth: walk
summary: Type add, then the name, the price, month or year, and the next renewal date. Each answer is checked and asked again until it makes sense: a price must be a number above 0, and a date is written year-month-day. If you only know when it started, type that: a date that has passed moves on to the next renewal by itself.
learn: try and "if it fails" (catching errors); loops that ask until the answer is right; date.fromisoformat.
== tools
define ask price
    description: Asks until the answer is a price: a number above 0, like 4.99.
    repeat forever
        set answer to input("Price: ").strip()
        try
            set price to answer as decimal
        if it fails with ValueError
            show "That isn't a price. Try something like 4.99."
            skip to next
        if price is more than 0
            give back price
        show "A price is more than 0."

define ask how often
    description: Asks until the answer is month or year (m and y work too).
    repeat forever
        set answer to input("Paid every month or year? ").strip() in lowercase
        if answer is in ["month", "m", "monthly"]
            give back "month"
        if answer is in ["year", "y", "yearly"]
            give back "year"
        show "Please type month or year."

define ask date
    description: Asks until the answer is a date written year-month-day.
    python: from datetime import date
    repeat forever
        set answer to input("Next renewal, or when it started (like 2026-10-31): ").strip()
        try
            give back str(date.fromisoformat(answer))
        if it fails with ValueError
            show "Please write the date as year-month-day, like 2026-10-31."

define add subscription
    description: Asks about a new subscription and adds it to the list.
    repeat forever
        set name to input("Name: ").strip()
        if name
            stop the loop
        show "Please type a name."
    run ask price and store in price
    run ask how often and store in every
    run ask date and store in renews
    run make subscription with name, price, every, renews and store in sub
    add sub to subscriptions
    run update renewal dates
    show "Added {name}: {price:.2f} a {every}, renewing {sub['renews']}."

set item "add" of commands to add subscription`,

`component: subs-list
name: Listing them
depth: walk
summary: The list command shows every subscription in lined-up columns, soonest renewal first. sorted makes a sorted copy, with key saying what to sort by; dates written year-month-day sort correctly even as text, which is one reason that's the way to write them. In an f-string, {name:<20} pads text to 20 characters and {price:>8.2f} lines numbers up on the right with two decimals.
learn: sorted with a key; lambda, a tool in one line; f-string format codes; enumerate.
== tools
define list subscriptions
    description: Shows every subscription, soonest renewal first, in lined-up columns.
    if not subscriptions
        show "No subscriptions yet. Type add to add one."
        give back
    for each n, sub in enumerate(sorted(subscriptions, key=lambda sub: sub["renews"]), start=1)
        show "{n:>3}. {sub['name']:<20} {sub['price']:>8.2f} a {sub['every']:<5}  renews {sub['renews']}"

set item "list" of commands to list subscriptions`,

`component: subs-totals
name: Monthly and yearly totals
depth: hallway
summary: What it all costs. Monthly and yearly subscriptions can only be added up once they're in the same unit, so a yearly one counts as a twelfth of its price each month; the year is then twelve months of that. It also names the one that costs the most each month, often the one worth questioning. You fill in the two conversions.
learn: Converting to one unit before adding; increase … by; keeping track of the biggest so far.
blank: ‹its yearly price, as a cost per month› | a calculation | A yearly price is shared over the 12 months of the year. The price is \`sub["price"]\`. | sub["price"] divided by 12
blank: ‹what they all cost in a year› | a calculation | \`monthly\` is what they all cost in an average month, and a year is twelve of those. | monthly times 12
== tools
define show totals
    description: What all the subscriptions cost each month and each year, and which costs the most.
    if not subscriptions
        show "No subscriptions yet."
        give back
    set monthly to 0
    set biggest to nothing
    set biggest cost to 0
    for each sub in subscriptions
        note: 1. What this one costs in an average month.
        if sub["every"] is "year"
            set cost to ‹its yearly price, as a cost per month›
        otherwise
            set cost to sub["price"]
        increase monthly by cost
        if cost is more than biggest cost
            set biggest to sub
            set biggest cost to cost
    note: 2. A year is twelve average months.
    set yearly to ‹what they all cost in a year›
    show "Each month: {monthly:.2f}"
    show "Each year:  {yearly:.2f}"
    show "Costs the most: {biggest['name']} ({biggest cost:.2f} a month)"

set item "totals" of commands to show totals`,

`component: subs-soon
name: Renewing this week
depth: hallway
summary: The command that earns the program its place: everything that renews in the next seven days, soonest first, with the total about to be taken. Taking one date from another gives a length of time, and its .days says how many whole days that is; every date has already moved on past today, so it's never negative. You write the number of days, and the test for "within the week".
learn: Date arithmetic (date minus date); timedelta and .days; a setting (soon days) that changes the program in one place.
blank: ‹days from today until it renews› | a calculation | Taking one date from another gives a length of time, and its \`.days\` is how many whole days that is. The two dates are \`today\` and \`renews\`, the later one first; put the subtraction in brackets so \`.days\` belongs to all of it. | (renews minus today).days
blank: ‹it renews soon› | a test (true or false) | \`days\` is how many days until it renews, and the setting \`soon days\` is how many days ahead count as soon, the last of them included. | days is at most soon days
== settings
note: How many days ahead counts as soon.
set soon days to 7
== tools
define show soon
    description: The subscriptions that renew in the next few days, soonest first, and what they'll take.
    python: from datetime import date
    set today to date.today()
    set total to 0
    set found to 0
    for each sub in sorted(subscriptions, key=lambda sub: sub["renews"])
        set renews to date.fromisoformat(sub["renews"])
        note: 1. How many days until it renews: one date minus another, in days.
        set days to ‹days from today until it renews›
        note: 2. Soon means within the next soon days.
        if ‹it renews soon›
            if days is 0
                set due to "today"
            otherwise if days is 1
                set due to "tomorrow"
            otherwise
                set due to "in {days} days"
            show "  {sub['name']:<20} {sub['price']:>8.2f}  {due}"
            increase total by sub["price"]
            increase found
    if found is 0
        show "Nothing renews in the next {soon days} days."
    otherwise
        show "Due in the next {soon days} days: {total:.2f}"

set item "soon" of commands to show soon`,

`component: subs-cancel
name: Removing one you've cancelled
depth: walk
summary: Cancelled something? Type cancel to see the list numbered and remove one by its number (or press Enter to keep them all). People count from 1 and Python from 0, so number 1 is at position 0: the "- 1" is where that's handled. It only takes it off this list: cancelling with the company is still up to you, and the program says so.
learn: pop, which takes an item out by position; chained comparisons like 1 <= number <= highest; a way out (Enter) for every question.
== tools
define cancel subscription
    description: Shows the subscriptions, numbered, and removes the one chosen.
    if not subscriptions
        show "There's nothing to remove."
        give back
    for each n, sub in enumerate(subscriptions, start=1)
        show "{n:>3}. {sub['name']}"
    repeat forever
        set answer to input("Number to remove (Enter to keep them all): ").strip()
        if not answer
            give back
        if answer.isdigit() and 1 <= int(answer) <= length of subscriptions
            stop the loop
        show "Please type a number from 1 to {length of subscriptions}."
    set gone to subscriptions.pop(int(answer) - 1)
    show "Removed {gone['name']}. Remember to cancel it with the company too."

set item "cancel" of commands to cancel subscription`,

`component: subs-reminders
name: Reminders before a renewal
depth: horizon
summary: The program only helps when you remember to run it. Reminders turn that around: the computer runs it every morning by itself, in a quiet mode that only checks what's due soon, and sends a notification or an email when something is about to renew.
usual: Windows Task Scheduler, cron (Linux) or launchd (macOS) to run it daily; argparse for a --check mode; plyer or win11toast for desktop notifications; smtplib for email; ntfy.sh for a notification on your phone.
learn: Running programs on a schedule; command-line arguments; sending a notification or an email from Python.`,

// ---------------------------------------------------------------- Streaks

`kit: streaks
title: Streaks
layout: website
shelf: health
platform: phone
about: One habit, four weeks at a glance: tap a day to mark it done, and the app counts your current streak of days in a row. Made for a phone; a daily reminder is a horizon step.
steps: streak-page!, streak-grid!, streak-save*, streak-count*, streak-name*, notifications, installable`,

`component: streak-page
name: The screen
depth: walk
summary: The habit's name, a line for the streak, and a grid of four weeks, Monday to Sunday, under a row of day letters. Both lists are grids of 7 columns, so the letters line up with the days. aspect-ratio: 1 keeps every day square at any phone width. The groups marked, today and later style the days Mechanics puts in them.
learn: CSS grids (grid-template-columns); aspect-ratio; outline, a border that doesn't change the size.
== structure
page title is "Streaks"
add a main area called app
    add a big heading "Read for 20 minutes" called habit
    add a paragraph called streak-line "No streak yet."
    add a list called weekdays
        add a list item "M"
        add a list item "T"
        add a list item "W"
        add a list item "T"
        add a list item "F"
        add a list item "S"
        add a list item "S"
    add a list called grid
    add a paragraph "Tap a day to mark it done; tap it again to unmark it." in group hint
== styling
shared colour paper is #f6f4f0
shared colour ink is #22201c
shared colour muted is #7b766d
shared colour accent is #d4561f
shared colour card is #ffffff
shared colour line is #e6e0d6
style the page: font-family: system-ui, background the colour paper, text colour the colour ink, space around 0
style app: at most 480 wide, centred, space inside 28 16 40
style habit: text size 28, space around 0
style streak-line: text size 20, bold, text colour the colour accent, space around 8 0 20
style weekdays: list-style: none, space inside 0, space around 0 0 6, in a grid of 7 columns, gap 8, text colour the colour muted, text size 13, centre the text
style grid: list-style: none, space inside 0, space around 0, in a grid of 7 columns, gap 8
style #grid li: aspect-ratio: 1, in a row, justify-content: center, rounded corners 12, background the colour card, border 1 the colour line, hand cursor, font-variant-numeric: tabular-nums
style #grid .marked: background the colour accent, border-color: var(--accent), text colour white, bold
style #grid .today: outline: 3px solid var(--ink), outline-offset: 2px
style #grid .later: 60% see-through, pointer-events: none
style group hint: text colour the colour muted, text size 14, centre the text
in dark mode:
    style the page: --paper: #15130f, --ink: #ece8e1, --muted: #a39d92, --accent: #f07a3f, --card: #201d18, --line: #34302a`,

`component: streak-grid
name: The four-week grid
depth: walk
summary: The days marked done are a list of dates written as text, like 2026-10-1. draw builds 28 squares: the Monday three weeks before this week's, up to this Sunday, with days still to come faded and untappable. Tapping a day adds it to the list or takes it out. The gotcha: dates come from the phone's own clock and time zone, not toISOString, which gives the date in UTC (Greenwich time) and can be a day out late in the evening.
learn: Date: getDay, getDate and building a date from parts (new Date(year, month, day) works out the month for you); filter; contains.
== mechanics
note: The days marked done, as text.
create list marked
note: Tools that later steps add here run after every redraw.
create list afterDraw

note: A day as text. getMonth counts from 0 (January is 0), hence the plus 1.
define keyFor using date
    give back "{date.getFullYear()}-{date.getMonth() plus 1}-{date.getDate()}"

note: The day n days ago (0 is today, -1 tomorrow). Date sorts out the month and year when the day goes below 1.
define daysAgo using n
    set today to new Date()
    give back new Date(today.getFullYear(), today.getMonth(), today.getDate() minus n)

define draw
    clear grid
    note: getDay counts from Sunday (0); this makes it days since Monday.
    set sinceMonday to (new Date().getDay() plus 6) mod 7
    repeat 28 times counting with k
        set ago to 21 plus sinceMonday minus k
        set day to daysAgo(ago)
        set key to keyFor(day)
        add day.getDate() to the list grid
        set cell to the last item of grid.children
        run cell.classList.toggle with "marked", marked contains key
        run cell.classList.toggle with "today", ago is 0
        if ago is less than 0
            run cell.classList.add with "later"
        otherwise
            set cell.onclick to () => toggleDay(key)
    for each extra in afterDraw
        run extra

define toggleDay using key
    if marked contains key
        set marked to marked.filter(other => other is not key)
    otherwise
        add key to marked
    run draw

run draw`,

`component: streak-save
name: Remembered on the phone
depth: walk
summary: The marked days are saved in the browser's storage after every tap and loaded when the app opens, so the grid is still there tomorrow. Dates are saved as text because that's what JSON can hold. It's this phone's browser only: a different browser, or clearing the site's data, starts afresh.
learn: localStorage and JSON; why dates are kept as text.
== mechanics
load "streak-days" from the browser and store in saved
if saved is not nothing
    set marked to saved

define remember
    save marked in the browser as "streak-days"

add remember to afterDraw
run draw`,

`component: streak-count
name: The current streak
depth: hallway
summary: The number that keeps people going: how many days in a row, up to today, are marked. It counts backwards from today until it meets a day that isn't marked. The kind rule that matters: today only counts once it's marked, and until then the streak carries on from yesterday, so it doesn't drop to 0 every morning. You write that rule, and the test that keeps the count going.
learn: Counting backwards with a while loop; a loop that stops at the first gap; being kind in the rules of an app.
blank: ‹today isn't marked yet› | a test (true or false) | \`markedDaysAgo(n)\` says whether the day \`n\` days ago is marked, and today is 0 days ago. \`not\` in front of a test turns true into false and false into true. | not markedDaysAgo(0)
blank: ‹the day being counted is marked› | a test (true or false) | \`back\` is how many days ago the day being counted is, and \`markedDaysAgo\` says whether the day that many days ago is marked. | markedDaysAgo(back)
== mechanics
define markedDaysAgo using n
    set key to keyFor(daysAgo(n))
    give back marked contains key

define streakNow
    set back to 0
    note: 1. Today isn't marked yet? Then start counting from yesterday.
    if ‹today isn't marked yet›
        set back to 1
    set streak to 0
    note: 2. Keep counting while the day back days ago is marked.
    while ‹the day being counted is marked›
        increase streak
        increase back
    give back streak

define showStreak
    run streakNow and store in streak
    if streak is 0
        set the text of streak-line to "No streak yet. Mark today to start one."
    otherwise if streak is 1
        set the text of streak-line to "🔥 1 day"
    otherwise
        set the text of streak-line to "🔥 {streak} days in a row"

add showStreak to afterDraw
run draw`,

`component: streak-name
name: Naming the habit
depth: walk
summary: Tap the heading to change the habit to your own (walk, stretch, no sugar…): the browser's question box asks for the new name, starting from the old one, and it's kept in the browser. An empty answer or Cancel leaves it as it was. The pencil after the heading, from ::after, hints that it can be tapped.
learn: Making a heading tappable (and showing that it is); prompt with a starting value; saving a single piece of text.
== styling
style habit: hand cursor
note: A pencil after the name. A style sentence can't name ::after yet, so this line is CSS.
css: #habit::after { content: " ✎"; color: var(--muted); font-size: 20px; }
== mechanics
load "streak-habit" from the browser and store in habitName
if habitName is not nothing
    set the text of habit to habitName

when habit is clicked
    ask "What's the habit?", the text of habit and store in answer
    if answer is not nothing and answer.trim() is not empty text
        set the text of habit to answer.trim()
        save answer.trim() in the browser as "streak-habit"`,

// ---------------------------------------------------------------- Interval Coach

`kit: interval-coach
title: Interval Coach
layout: website
shelf: health
platform: phone
about: A workout timer for intervals: work hard, rest, repeat for a set number of rounds, with a beep at every change so your eyes can stay off the screen. Made for a phone; your own interval lengths, three pips before each change and keeping the screen awake are steps of their own.
steps: interval-page!, interval-timer!, interval-pips*, interval-setup*, interval-awake*, interval-watch, installable`,

`component: interval-page
name: The workout screen
depth: walk
summary: A whole phone screen that can be read from across a room: what to do now (work or rest) and the time left in very big numbers, the round, and two buttons. The screen's colour is the main signal: Mechanics puts it in the group working or resting, and transition fades between them. at least 100vh makes it fill the phone's height.
learn: Big, glanceable layouts; vh, a share of the screen's height; transition between colours.
== structure
page title is "Interval Coach"
add a main area called app
    add a paragraph called phase-name "Ready"
    add a paragraph called clock "0:40"
    add a paragraph called round-line ""
    add a block called controls
        add a button called go saying "Start"
        add a button called reset saying "Reset"
== styling
shared colour paper is #f4f5f7
shared colour ink is #16181d
shared colour work is #e4572e
shared colour rest is #2a9d8f
style the page: font-family: system-ui, background the colour paper, text colour the colour ink, space around 0
style app: at most 480 wide, centred, at least 100vh tall, box-sizing: border-box, in a column, justify-content: center, space inside 24 16, centre the text, transition: all 0.4s
create group working: background the colour work, text colour white
create group resting: background the colour rest, text colour white
style phase-name: text size 34, bold, capitals, letter-spacing: 2px, space around 0
style clock: text size 120, bold, font-variant-numeric: tabular-nums, line-height: 1, space around 8 0
style round-line: text size 20, space around 0 0 32
style controls: in a row, gap 12
style buttons: font: inherit, text size 22, at least 64 tall, rounded corners 18, hand cursor, border: 2px solid currentColor, background transparent, color: inherit
style go: flex: 2, bold
style reset: flex: 1
in dark mode:
    style the page: --paper: #0f1115, --ink: #eceef2`,

`component: interval-timer
name: Work, rest, repeat
depth: walk
summary: The timer and its rules: work, then rest, round after round, and after the last round's work, done (no rest at the end). Like any timer that has to be right, it remembers when this part ends and works out what's left from the clock, four times a second, so a slow phone can't make it drift. Every change beeps: a high note for work, a low one for rest. Browsers only allow sound after a tap, so Start switches it on.
learn: Keeping state in a few values (phase, round, endsAt); the Web Audio API (an oscillator and a gain), written as sentences; why timers use the clock rather than counting.
== mechanics
note: The workout: seconds of work, seconds of rest, and how many rounds. The Setup step lets people change them.
set workSeconds to 40
set restSeconds to 20
set rounds to 8
note: Where the workout is: phase is "ready", "work", "rest" or "done"; endsAt is when this part ends, or nothing while paused.
set phase to "ready"
set round to 0
set endsAt to nothing
set leftMs to workSeconds times 1000
note: Tools that later steps add here run on every tick (four times a second).
create list onTick

note: The sound. No sentence plays a sound yet, so it's built from the Web Audio API's parts: an oscillator makes a tone, a gain sets its volume and fades it out.
set audio to nothing
define beep using pitch, seconds
    if audio is nothing
        give back
    set tone to audio.createOscillator()
    set volume to audio.createGain()
    set tone.frequency.value to pitch
    run volume.gain.setValueAtTime with 0.3, audio.currentTime
    run volume.gain.exponentialRampToValueAtTime with 0.001, audio.currentTime plus seconds
    run tone.connect with volume
    run volume.connect with audio.destination
    run tone.start
    run tone.stop with audio.currentTime plus seconds

define refresh
    set secondsLeft to Math.ceil(leftMs divided by 1000)
    set the text of clock to "{Math.floor(secondsLeft divided by 60)}:{String(secondsLeft mod 60).padStart(2, '0')}"
    if phase is "work"
        set the text of phase-name to "Work"
        put app in group working
        take app out of group resting
    otherwise if phase is "rest"
        set the text of phase-name to "Rest"
        put app in group resting
        take app out of group working
    otherwise
        take app out of group working
        take app out of group resting
    if phase is "ready"
        set the text of round-line to "{rounds} rounds: {workSeconds} s work, {restSeconds} s rest"
    otherwise
        set the text of round-line to "Round {round} of {rounds}"

define startPhase using next
    set phase to next
    if phase is "work"
        set leftMs to workSeconds times 1000
        set endsAt to Date.now() plus leftMs
        run beep with 880, 0.4
    otherwise if phase is "rest"
        set leftMs to restSeconds times 1000
        set endsAt to Date.now() plus leftMs
        run beep with 440, 0.6
    otherwise
        set leftMs to 0
        set endsAt to nothing
        set the text of phase-name to "Done. Well worked."
        set the text of go to "Start again"
        run beep with 660, 1.2
    run refresh

define nextPhase
    if phase is "work" and round is at least rounds
        run startPhase with "done"
    otherwise if phase is "work"
        run startPhase with "rest"
    otherwise
        increase round
        run startPhase with "work"

when go is clicked
    if audio is nothing
        set audio to new AudioContext()
    if phase is "ready" or phase is "done"
        set round to 1
        run startPhase with "work"
        set the text of go to "Pause"
    otherwise if endsAt is nothing
        set endsAt to Date.now() plus leftMs
        set the text of go to "Pause"
    otherwise
        set leftMs to endsAt minus Date.now()
        set endsAt to nothing
        set the text of go to "Carry on"

when reset is clicked
    set phase to "ready"
    set round to 0
    set endsAt to nothing
    set leftMs to workSeconds times 1000
    set the text of phase-name to "Ready"
    set the text of go to "Start"
    run refresh

note: Four times a second: what's left, from the clock, and on to the next part at 0.
every 0.25 seconds
    if endsAt is not nothing
        set leftMs to endsAt minus Date.now()
        for each extra in onTick
            run extra
        if leftMs is at most 0
            run nextPhase
        run refresh

run refresh`,

`component: interval-pips
name: Three pips before each change
depth: hallway
summary: Short, high pips at 3, 2 and 1 seconds before every change, the way gym timers do it, so you're ready to go. The catch is that the timer checks four times a second, so a test like "3 seconds or less left" would pip a dozen times. The fix is remembering which second was pipped last and only pipping on a new one. You write that test.
learn: Doing something once per change rather than once per check; remembering the last value; Math.ceil.
blank: ‹one of the last three seconds, not yet pipped› | a test (true or false) | \`secondsLeft\` has to be from 1 to 3, and different from \`lastPip\`, the second pipped last. That's three tests, each comparing \`secondsLeft\` with something, joined with \`and\`. | secondsLeft is at least 1 and secondsLeft is at most 3 and secondsLeft is not lastPip
== mechanics
note: The second that was last pipped, so each second gets one pip.
set lastPip to nothing

define pip
    set secondsLeft to Math.ceil(leftMs divided by 1000)
    note: Pip when 1, 2 or 3 seconds are left, and this second hasn't been pipped yet.
    if ‹one of the last three seconds, not yet pipped›
        set lastPip to secondsLeft
        run beep with 1320, 0.08

add pip to onTick`,

`component: interval-setup
name: Your own intervals
depth: walk
summary: Three number boxes for the seconds of work, the seconds of rest and the number of rounds, remembered in the browser. A change counts once the box is left (the changed event), and takes effect from the next part of the workout. What's typed is checked: an empty or mistyped box falls back to the usual value, and nothing goes below 1, so a slip can't make a timer of zero seconds.
learn: Number boxes and the changed event; or, to fall back to a default; Math.max and Math.round to keep a number sensible.
== structure
add a section called setup-panel
    add a heading "Your intervals"
    add a label "Work (seconds)" for work-box
    add a number box called work-box with hint "40"
    add a label "Rest (seconds)" for rest-box
    add a number box called rest-box with hint "20"
    add a label "Rounds" for rounds-box
    add a number box called rounds-box with hint "8"
== styling
style setup-panel: at most 480 wide, centred, space inside 24 16 40, box-sizing: border-box, in a column, gap 6
style inputs: font: inherit, text size 20, space inside 10, border 1 #c8ccd4, rounded corners 12, space around 0 0 10
== mechanics
load "interval-setup" from the browser and store in saved
if saved is not nothing
    set workSeconds to saved.work
    set restSeconds to saved.rest
    set rounds to saved.rounds
    set leftMs to workSeconds times 1000
set the text of work-box to workSeconds
set the text of rest-box to restSeconds
set the text of rounds-box to rounds

define applySetup
    get the text of work-box and store in work
    get the text of rest-box and store in rest
    get the text of rounds-box and store in howMany
    set workSeconds to Math.max(1, Math.round((work as number) or 40))
    set restSeconds to Math.max(1, Math.round((rest as number) or 20))
    set rounds to Math.max(1, Math.round((howMany as number) or 8))
    save {"work": workSeconds, "rest": restSeconds, "rounds": rounds} in the browser as "interval-setup"
    if phase is "ready"
        set leftMs to workSeconds times 1000
    run refresh

when work-box is changed
    run applySetup
when rest-box is changed
    run applySetup
when rounds-box is changed
    run applySetup

run refresh`,

`component: interval-awake
name: Keeping the screen on
depth: walk
summary: Phones dim and lock when nobody touches them, and a locked phone pauses the page, timer and all: mid-workout, that's the last thing you want. A wake lock asks the phone to keep the screen on. Not every browser has one, so it's only asked for where it exists, and the phone may still say no (on low battery, say), which .catch quietly accepts. The lock ends by itself when you switch away from the page.
learn: Wake locks; checking a feature exists before using it; promises and .catch, in brief.
== mechanics
when go is clicked
    if window.navigator.wakeLock
        set lock to window.navigator.wakeLock.request("screen").catch(() => nothing)`,

`component: interval-watch
name: On your wrist
depth: horizon
summary: Interval training is where watches shine: a buzz on the wrist at each change, and your heart rate beside the timer. A web page can't run on a watch, so this means a watch app of its own, or a phone app that talks to a heart-rate strap.
usual: watchOS with SwiftUI and HealthKit; Wear OS with Kotlin and Health Services; Garmin's Connect IQ; Web Bluetooth (Chrome on Android) for heart-rate straps from a web page.
learn: A native toolkit (see the Phone app path); health data and its permissions; Bluetooth heart-rate devices.`,

// ---------------------------------------------------------------- Box Breathing

`kit: box-breathing
title: Box Breathing
layout: website
shelf: health
platform: phone
about: A calm breathing guide: breathe in for four, hold for four, out for four, hold for four, while a circle grows, holds, shrinks and holds with you, and the words say what to do. Made for a phone; a session that ends gently, and a buzz you can follow with your eyes closed, are steps of their own.
steps: breath-page!, breath-guide!, breath-session*, breath-buzz*, breath-health, installable`,

`component: breath-page
name: The circle
depth: walk
summary: A quiet screen: a circle in the middle, a word under it, and one button. The circle is drawn at full size and shrunk with transform: scale(0.5); the group full scales it back up, and transition makes that change take 4 seconds, exactly one side of the box. Keep the 4s here and SIDE in Mechanics the same, or the circle finishes early or gets cut short. scale grows it from its centre, without moving anything else.
learn: transform and scale; transition, which animates a change between two styles; centring with flex.
== structure
page title is "Box Breathing"
add a main area called app
    add a block called circle in group ring
        add a paragraph called count ""
    add a paragraph called word "Press start, and breathe with the circle."
    add a button called start saying "Start"
== styling
shared colour paper is #eef3f6
shared colour ink is #1b2a33
shared colour muted is #61737e
shared colour soft is #b9d4e3
shared colour accent is #2d6a8a
style the page: font-family: system-ui, background the colour paper, text colour the colour ink, space around 0
style app: at most 480 wide, centred, at least 100vh tall, box-sizing: border-box, in a column, justify-content: center, gap 32, space inside 24 16, centre the text
note: Half size until the group full scales it up, over 4 seconds: the same as SIDE in Mechanics.
create group ring: width 260, height 260, round, background the colour soft, in a row, justify-content: center, align-self: center, transform: scale(0.5), transition: transform 4s ease-in-out
create group full: transform: scale(1)
style count: text size 56, bold, space around 0, font-variant-numeric: tabular-nums
style word: text size 26, min-height: 2.6em, space around 0
style start: align-self: center, font: inherit, text size 20, at least 56 tall, space inside 0 40, rounded corners 999, background the colour accent, text colour white, no border, hand cursor
in dark mode:
    style the page: --paper: #0e1519, --ink: #dde8ee, --muted: #8fa3ae, --soft: #2b4a5c, --accent: #5aa3c7`,

`component: breath-guide
name: The guide
depth: walk
summary: The rhythm. tick is the whole seconds since Start, worked out from the clock four times a second so it keeps time with the circle's animation, and everything follows from it: the side of the box (tick divided by SIDE, rounded down, round and round with mod 4), the word, and the seconds left. Breathing in, the circle joins the group full and grows; breathing out, it leaves it. Later steps add tools to onSide.
learn: Working things out from one count instead of keeping many values; mod for cycles; adding and removing a group to start a CSS animation.
== mechanics
note: Seconds for each side of the box. The circle's transition in Styling (4s) should match.
constant SIDE is 4
constant WORDS is ["Breathe in", "Hold", "Breathe out", "Hold"]
note: When Start was pressed (nothing while stopped), and the whole seconds since then.
set startedAt to nothing
set tick to 0
note: Tools that later steps add here run at the start of every side.
create list onSide

define showSide
    note: 0 is breathing in, 1 holding, 2 breathing out, 3 holding; then round again.
    set side to Math.floor(tick divided by SIDE) mod 4
    set the text of word to item side of WORDS
    set the text of count to SIDE minus tick mod SIDE
    if side is 0
        put circle in group full
    if side is 2
        take circle out of group full

define startSide
    run showSide
    for each extra in onSide
        run extra

define stop
    set startedAt to nothing
    take circle out of group full
    set the text of count to empty text
    set the text of start to "Start"

when start is clicked
    if startedAt is not nothing
        run stop
        set the text of word to "Press start, and breathe with the circle."
    otherwise
        set startedAt to Date.now()
        set tick to 0
        set the text of start to "Stop"
        run startSide

note: Four times a second, count the whole seconds since Start from the clock; act when a new second begins.
every 0.25 seconds
    if startedAt is not nothing
        set seconds to Math.floor((Date.now() minus startedAt) divided by 1000)
        if seconds is not tick
            set tick to seconds
            if tick mod SIDE is 0
                run startSide
            otherwise
                run showSide`,

`component: breath-session
name: A session that ends gently
depth: hallway
summary: Choose 1, 2 or 5 minutes (or no limit), and the guide stops by itself with a word of how it went. The gentle part is where it stops: never halfway through a breath, only when a whole box has finished, at the start of the next breath in, so a 1-minute session runs to the end of its fourth box. You write the test for that moment, and the number of boxes breathed.
learn: Drop-downs and parseInt; combining two conditions with and; whole-number division for counting cycles.
blank: ‹time's up and a whole box is complete› | a test (true or false) | \`tick\` counts whole seconds, so time's up once it has reached \`minutes times 60\`. One box takes \`4 times SIDE\` seconds, and a box is complete when \`tick\` divides by that with nothing left over (\`mod\` gives what's left). Join the two tests with \`and\`. | tick is at least minutes times 60 and tick mod (4 times SIDE) is 0
blank: ‹how many whole boxes were breathed› | a calculation | One box takes \`4 times SIDE\` seconds, and \`tick\` is the seconds so far. This runs at the moment a box ends, so the division comes out whole. | tick divided by (4 times SIDE)
== structure
add a section called session
    add a label "Session" for session-length
    add a drop-down called session-length with "1 minute", "2 minutes", "5 minutes", "No limit"
== styling
style session: at most 480 wide, centred, space inside 0 16 40, box-sizing: border-box, in a row, justify-content: center, gap 12
style session-length: font: inherit, text size 18, space inside 8 12, rounded corners 10, border 1 the colour muted, background transparent, text colour the colour ink
== mechanics
define checkSession
    get the text of session-length and store in choice
    note: parseInt reads the number at the start of "2 minutes"; "No limit" has none, so it never ends.
    set minutes to parseInt(choice)
    if Number.isNaN(minutes)
        give back
    note: 1. Time's up, and a whole box (4 sides) is complete.
    if ‹time's up and a whole box is complete›
        note: 2. How many whole boxes that was.
        set boxes to ‹how many whole boxes were breathed›
        run stop
        set the text of word to "Well done: {boxes} boxes in {minutes} min."

add checkSession to onSide`,

`component: breath-buzz
name: A buzz to follow with your eyes closed
depth: walk
summary: Breathing exercises work best with your eyes closed, so the phone buzzes at the start of every side: one long buzz to breathe in, two short ones to hold, a longer one to breathe out. vibrate takes a length in milliseconds, or a list of buzz, pause, buzz. Only some phones allow it (Android ones, mostly; iPhones don't let web pages vibrate), so it only buzzes where vibrate exists.
learn: vibrate and its patterns; checking a feature exists before using it; lists of lists.
== mechanics
note: A buzz for each side, in milliseconds: one length, or buzz, pause, buzz.
constant BUZZES is [250, [60, 80, 60], 500, [60, 80, 60]]

define buzz
    set side to Math.floor(tick divided by SIDE) mod 4
    if window.navigator.vibrate
        run window.navigator.vibrate with item side of BUZZES

add buzz to onSide`,

`component: breath-health
name: Mindful minutes in your health app
depth: horizon
summary: Phones keep a health record (Apple Health, Health Connect on Android), with a place for mindful minutes. Saving each finished session there means it counts alongside sleep and steps. Only a native app may write to it, with the person's permission, so this needs one of the phone toolkits.
usual: HealthKit's mindful sessions (Swift, on iPhone); Health Connect's mindfulness records (Kotlin, on Android); plugins for Flutter or React Native that reach both.
learn: A native toolkit (see the Phone app path); asking for health permissions; why health data is kept so carefully.`,

);
