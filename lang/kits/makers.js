/* IntuCode kit pack: learning, creative, social and tool apps (flashcards, typing, music, photos, a message wall, weather, passwords, files, the kitchen, countdowns). */
(window.IntuiKitPacks = window.IntuiKitPacks || []).push(

// ---------------------------------------------------------------- Leitner Flashcards

`kit: flashcards
title: Leitner Flashcards
layout: website
shelf: learning
platform: web
about: Flashcards that learn what you know. Cards live in five boxes: a right answer moves a card up a box, a wrong one sends it back to box 1, and higher boxes come round less often, so your practice goes where it's needed (the Leitner system). The deck is kept in the browser.
steps: cards-page!, cards-deck!, cards-boxes*, cards-add*, cards-progress, cards-smarter, publish`,

`component: cards-page
name: The card on the page
depth: walk
summary: The page everything else fills in: a title, a card in the middle with a question side (the front) and an answer side (the back), and two buttons under it. It has no behaviour yet; the deck step makes the buttons work. The colours are shared names (paper, ink, accent), so one line here recolours the whole app.
learn: Headings, paragraphs and buttons; shared colours (CSS variables); a layout centred in one column.
== structure
page title is "Flashcards"
add a header called top
    add a big heading "Flashcards"
    add a paragraph called status "Loading the deck…"
add a main area called flashcard
    add a paragraph called front ""
    add a paragraph called back ""
add a block called controls
    add a button called flip saying "Show answer"
    add a button called next-card saying "Next card"
== styling
shared colour paper is #f6f3ee
shared colour ink is #22252b
shared colour muted is #6a6f7a
shared colour accent is #3b5bdb
shared colour card is #ffffff
shared colour line is #e2ded6
style the page: font-family: system-ui, background the colour paper, text colour the colour ink, at most 560 wide, centred, space inside 24 16, line-height: 1.5
style big headings: text size 28, space around 0
style status: text colour the colour muted, space around 4 0 0
style flashcard: background the colour card, border 1 the colour line, rounded corners 16, soft shadow, space inside 32 24, at least 220 tall, in a column, justify-content: center, centre the text, space around 20 0
style front: text size 30, bold, space around 0
style back: text size 22, text colour the colour accent, space around 16 0 0
style controls: in a row, gap 12, flex-wrap: wrap
create group action: flex: 1, font: inherit, text size 17, space inside 14 18, rounded corners 12, border 1 the colour line, background the colour card, text colour the colour ink, hand cursor
flip belongs to group action
next-card belongs to group action`,

`component: cards-deck
name: The deck
depth: walk
summary: The deck is a list of cards, each a small record: its front, its back, the box it's in, and how many rounds it rests. This step shows one card, reveals its answer, goes round the deck, and saves it all in the browser. Going round already skips a resting card (taking one off its rest), so the boxes step only has to decide how long each card rests.
learn: Lists of records (objects); localStorage; going round a list with mod (%), so the last card leads back to the first.
== mechanics
note: A few cards to start with. Each card: its front, its back, its box (1 to 5) and the rounds it rests.
create list cards with { "front": "hola", "back": "hello", "box": 1, "rest": 0 }, { "front": "gracias", "back": "thank you", "box": 1, "rest": 0 }, { "front": "perro", "back": "dog", "box": 1, "rest": 0 }, { "front": "libro", "back": "book", "box": 1, "rest": 0 }
note: The deck saved last time, if there is one, takes the place of the sample cards.
load "cards" from the browser and store in saved
if saved is not nothing
    set cards to saved
set place to 0
set current to first item of cards

define showCard
    if current is nothing
        set the text of status to "No cards yet."
        give back
    set the text of front to current.front
    set the text of back to current.back
    hide back
    set the text of status to "{length of cards} cards · this one is in box {current.box}"

define nextCard
    note: Go round the deck from the card after this one. A resting card sits this round out, with one round less to go; the first card that isn't resting is next.
    repeat length of cards times
        set place to (place plus 1) mod length of cards
        set card to item place of cards
        if card.rest is more than 0
            decrease card.rest
        otherwise
            set current to card
            run showCard
            give back
    note: Every card is resting: show the next one anyway.
    set current to item place of cards
    run showCard

define saveDeck
    save cards in the browser as "cards"

when flip is clicked
    reveal back

when next-card is clicked
    run nextCard
    run saveDeck

run showCard`,

`component: cards-boxes
name: The boxes: right answers rest longer
depth: hallway
summary: The heart of the Leitner system. "I knew it" moves the card up a box, "Not yet" sends it back to box 1, and the higher the box, the longer the card rests before it comes round again: box 1 every round, box 2 every second round, box 3 every fourth. Cards you know fade into the background and hard ones keep coming back. The buttons are built; you write where the card goes and how long it rests.
learn: Conditions (if, otherwise); Math.min, to cap a number; powers of 2 (2 ** n in JavaScript).
blank: ‹one box up, stopping at the last box› | a calculation | \`current.box\` is the box the card is in now, and \`lastBox\` is the highest. \`Math.min(a, b)\` gives the smaller of two numbers, so it can keep one box up from going past \`lastBox\`. | Math.min(current.box + 1, lastBox)
blank: ‹the first box› | a number | The boxes are numbered from 1 to \`lastBox\`, and a new card starts in the first. | 1
blank: ‹rounds to rest in this box› | a calculation | Box 1 rests 0 rounds, box 2 rests 1, box 3 rests 3 and box 4 rests 7: each is one less than a power of 2. In JavaScript \`2 ** n\` is 2 to the power of \`n\`, and here \`n\` is one less than \`current.box\`. | 2 ** (current.box - 1) - 1
== structure
add a block called grading
    add a button called knew saying "I knew it"
    add a button called missed saying "Not yet"
== styling
style grading: in a row, gap 12, space around 12 0 0
create group grade: flex: 1, font: inherit, text size 17, bold, space inside 14 18, rounded corners 12, no border, text colour white, hand cursor
knew belongs to group grade
missed belongs to group grade
style knew: background #2b8a3e
style missed: background #c92a2a
== mechanics
note: The highest box. Cards there rest longest.
constant lastBox is 5

define grade using right
    note: 1. Right: up one box, never past the last. Wrong: back to the first box.
    if right
        set current.box to ‹one box up, stopping at the last box›
    otherwise
        set current.box to ‹the first box›
    note: 2. How many rounds it sits out: none in box 1, 1 in box 2, 3 in box 3, 7 in box 4…
    set current.rest to ‹rounds to rest in this box›
    run nextCard
    run saveDeck

when knew is clicked
    run grade with yes

when missed is clicked
    run grade with no`,

`component: cards-add
name: Adding your own cards
depth: walk
summary: A small form under the card for writing your own: a front, a back, and Add. A new card starts in box 1 with no rest, so it comes round soon, and the deck is saved straight away. Both sides must be filled in; the status line says so if one is missing.
learn: Forms and the "sent" event; reading text boxes; adding a record to a list.
== structure
add a form called new-card
    add a heading "Add a card"
    add a label "Front (the question)" for front-box
    add a text box called front-box with hint "perro"
    add a label "Back (the answer)" for back-box
    add a text box called back-box with hint "dog"
    add a button called add-card saying "Add to the deck"
== styling
style new-card: in a column, gap 6, space around 28 0 0, border-top: 1px solid var(--line), space inside 16 0 0
style text boxes: font: inherit, space inside 10, border 1 the colour line, rounded corners 8, background the colour card, text colour the colour ink
add-card belongs to group action
== mechanics
when new-card is sent
    get the text of front-box and store in question
    get the text of back-box and store in answer
    if question is empty text or answer is empty text
        set the text of status to "Write both sides of the card."
    otherwise
        add { "front": question, "back": answer, "box": 1, "rest": 0 } to cards
        save cards in the browser as "cards"
        clear front-box
        clear back-box
        set the text of status to "Added. The deck has {length of cards} cards."`,

`component: cards-progress
name: How the boxes are filling
depth: walk
summary: A line under the card counting the cards in each box, so you can watch them climb from box 1 to box 5. It recounts once a second, so it stays right whichever step changed a card. A deck you know well has most of its cards in the high boxes.
learn: Counting into a list (one count per box); every … seconds (setInterval).
== structure
add a section called boxes
    add a heading "Your boxes"
    add a paragraph called box-counts ""
== styling
style boxes: space around 28 0 0
style box-counts: font-variant-numeric: tabular-nums, text colour the colour muted
== mechanics
define countBoxes
    create list counts with 0, 0, 0, 0, 0
    for each card in cards
        increase counts[card.box - 1]
    set summary to ""
    repeat 5 times counting with b
        set summary to summary plus "Box {b plus 1}: {item b of counts}    "
    set the text of box-counts to summary

run countBoxes
every 1 seconds
    run countBoxes`,

`component: cards-smarter
name: Smarter scheduling
depth: horizon
summary: Five boxes are a good start. Serious flashcard apps work out, for each card, the day it should come back: shortly before you'd forget it, with the gap growing each time you remember. They keep a date and an "ease" per card, and adjust both after every answer, often from how hard it felt as well as right or wrong.
usual: SM-2 (from SuperMemo, long used by Anki); FSRS, Anki's newer scheduler; dates kept with each card in localStorage or a database.
learn: Dates in JavaScript (Date, and days as milliseconds); the SM-2 formula; spaced repetition and the forgetting curve.`,

// ---------------------------------------------------------------- Typing Test

`kit: typing-test
title: Typing Test
layout: website
shelf: learning
platform: web
about: Type a passage as quickly and accurately as you can: the clock starts with your first key, and at the end you get your words per minute and how many letters were right. Your best speed is kept in the browser.
steps: typing-page!, typing-clock!, typing-score*, typing-passages*, typing-live, typing-weak-keys, publish`,

`component: typing-page
name: The passage and the box
depth: walk
summary: The page the test happens on: the passage to copy, in a clear serif font, a big box to type into, a line for the result, and a Start again button. The passage is the paragraph called passage, so the clock and the score read it from the page; change its words here and they follow.
learn: Paragraphs and a big text box (a textarea); fonts and line spacing for reading.
== structure
page title is "Typing test"
add a main area called app
    add a big heading "Typing test"
    add a paragraph "Type the passage below as quickly and accurately as you can." in group hint
    add a paragraph called passage "The quick brown fox jumps over the lazy dog, then naps in the warm afternoon sun."
    add a big text box called typed with hint "Start typing here…"
    add a paragraph called result "The clock starts with your first key."
    add a button called again saying "Start again"
== styling
shared colour paper is #f4f1ea
shared colour ink is #1f2328
shared colour muted is #6b7280
shared colour accent is #0f766e
shared colour line is #d9d4c7
style the page: font-family: system-ui, background the colour paper, text colour the colour ink, space around 0
style app: at most 680 wide, centred, space inside 32 16, in a column, gap 14
style big headings: text size 30, space around 0
create group hint: text colour the colour muted, space around 0
style passage: font-family: Georgia, text size 22, line-height: 1.6, background white, border 1 the colour line, rounded corners 12, space inside 18 20, space around 0
style text boxes: font: inherit, text size 20, min-height: 120px, space inside 14, border 2 the colour line, rounded corners 12, background white, text colour the colour ink, resize: vertical
style result: text size 20, bold, text colour the colour accent, space around 0
style again: align-self: flex-start, font: inherit, space inside 12 22, rounded corners 999, no border, background the colour accent, text colour white, hand cursor`,

`component: typing-clock
name: The clock
depth: walk
summary: The clock starts at your first key, not when the page opens, so reading the passage first is free. Every key press works out the seconds so far from Date.now() (the time in milliseconds), and once you've typed as many letters as the passage has, the test is done. It marks that moment in finishedNow, which the score step watches. Start again resets everything.
learn: Date.now() and milliseconds; the "typed in" event (input), which fires on every change to a box; yes/no values (flags).
== mechanics
note: The passage, read from the page.
set passageText to the text of passage
set started to 0
set seconds to 0
set done to no
set finishedNow to no

when typed is typed in
    set finishedNow to no
    if done
        give back
    note: The clock starts with the first key.
    if started is 0
        set started to Date.now()
    get the text of typed and store in sofar
    set seconds to (Date.now() minus started) divided by 1000
    if length of sofar is at least length of passageText
        set done to yes
        set finishedNow to yes
        set the text of result to "Done in {seconds.toFixed(1)} seconds."

note: A live clock while you type.
every 1 seconds
    if started is more than 0 and not done
        set the text of result to "{Math.floor((Date.now() minus started) divided by 1000)} seconds…"

when again is clicked
    set started to 0
    set done to no
    clear typed
    set the text of result to "The clock starts with your first key."`,

`component: typing-score
name: Speed, accuracy and your best
depth: hallway
summary: The result. Typists count a "word" as five characters, spaces included, so long and short words even out: words per minute is the characters typed, divided by 5, divided by the minutes taken. Accuracy is the letters typed right as a percentage of the passage. A new best is kept in the browser, but only if at least 90% was right, so a fast mess doesn't count. You write the two formulas.
learn: Percentages; Math.round; two listeners on one event, which run in the order they were added.
blank: ‹words per minute, from the letters typed› | a calculation | A word counts as 5 characters, and \`length of sofar\` is how many characters were typed. Divide the words by \`minutes\`, the time taken. | length of sofar divided by 5 divided by minutes
blank: ‹the share typed right, as a percentage› | a calculation | \`right\` is how many letters were typed right, and \`length of passageText\` is how many letters the passage has. A share is the part divided by the whole; times 100 makes it a percentage. | right divided by length of passageText times 100
== structure
add a paragraph called best "No best yet."
== styling
style best: text colour the colour muted, space around 0
== mechanics
note: Your best speed so far, kept in the browser.
set bestWpm to 0
load "best-wpm" from the browser and store in savedBest
if savedBest is not nothing
    set bestWpm to savedBest
    set the text of best to "Your best: {bestWpm} words per minute"

note: This listener was added after the clock's, so it runs after it: when the passage is finished, seconds already holds the time.
when typed is typed in
    if finishedNow
        get the text of typed and store in sofar
        note: 1. Count the letters typed right: the same letter in the same place as in the passage.
        set right to 0
        repeat length of passageText times counting with i
            if item i of sofar is item i of passageText
                increase right
        note: 2. Speed and accuracy.
        set minutes to seconds divided by 60
        set wpm to Math.round(‹words per minute, from the letters typed›)
        set accuracy to Math.round(‹the share typed right, as a percentage›)
        set the text of result to "{wpm} words per minute, {accuracy}% right, in {Math.round(seconds)} seconds."
        note: 3. A new best counts only if it was mostly right.
        if wpm is more than bestWpm and accuracy is at least 90
            set bestWpm to wpm
            save bestWpm in the browser as "best-wpm"
            set the text of best to "New best: {bestWpm} words per minute"`,

`component: typing-passages
name: A different passage each time
depth: walk
summary: Typing the same sentence again and again soon tests your memory rather than your typing. This step keeps a list of passages and picks one at random when the page opens and on every Start again. Add your own to the list: quotes, song lines, or the words you find hard. Its Start again listener runs after the clock's, so the box is already empty.
learn: Lists of text; picking a random item; changing what the page shows from Mechanics.
== mechanics
create list passages with "The quick brown fox jumps over the lazy dog, then naps in the warm afternoon sun.", "Pack my box with five dozen liquor jugs before the market closes tonight.", "A journey of a thousand miles begins with a single step, and then another one.", "Bright yellow kites danced above the quiet harbour as the tide came in."

define newPassage
    set passageText to random item from passages
    set the text of passage to passageText

run newPassage

when again is clicked
    run newPassage`,

`component: typing-live
name: Mistakes as you type
depth: walk
summary: Waiting until the end to find a mistake is too late. This step checks every letter as it's typed and turns the box red while anything is wrong, with a count under it, so you can fix a slip straight away. It changes the box by putting it in a group (a CSS class) and taking it out again, which is how most pages switch a look on and off.
learn: Comparing text letter by letter; putting an element in a group, and taking it out (classList).
== structure
add a paragraph called slips ""
== styling
style slips: text colour the colour muted, space around 0
create group wrong: border-color: #c92a2a, background #fff5f5
== mechanics
when typed is typed in
    get the text of typed and store in sofar
    set wrongs to 0
    repeat length of sofar times counting with i
        if item i of sofar is not item i of passageText
            increase wrongs
    if wrongs is more than 0
        put typed in group wrong
    otherwise
        take typed out of group wrong
    set the text of slips to "{wrongs} wrong so far"

when again is clicked
    take typed out of group wrong
    set the text of slips to ""`,

`component: typing-weak-keys
name: Practice for your weak keys
depth: horizon
summary: Good typing trainers notice which letters you miss and how long each key takes you, then make practice text full of the hard ones, adding new letters only once the old ones are steady. It's the same comparison this test already makes, kept per key over many runs.
usual: Per-key counts kept in an object and saved in localStorage; practice words made from a word list; trainers like keybr.com and Monkeytype show how it looks.
learn: Objects as counters (a count for each letter); sorting by a count; making text from a list of words.`,

// ---------------------------------------------------------------- Password Maker

`kit: password-maker
title: Password Maker
layout: website
shelf: tools
platform: web
about: Passphrases made of random words, like maple-otter-quill-ribbon-tiger-cloud: memorable, and hard to guess. Picked with the browser's secure random numbers, with a strength meter that shows how many guesses it would take, and options for separators, capitals and a number.
steps: pass-page!, pass-words!, pass-strength*, pass-options*, pass-copy, pass-wordlist, pass-breaches`,

`component: pass-page
name: The page
depth: walk
summary: One card in the middle: the passphrase in large monospaced letters (every character the same width, so nothing hides), how many words to use, and a button to make another. It has no behaviour yet: the words step fills it in.
learn: Drop-downs (select); monospaced fonts; long words that wrap (overflow-wrap).
== structure
page title is "Passphrase maker"
add a main area called app
    add a big heading "Passphrase maker"
    add a paragraph "A few random words: memorable, and hard to guess." in group hint
    add a paragraph called phrase "…"
    add a block called controls
        add a drop-down called word-count with "3 words", "4 words", "5 words", "6 words", "7 words", "8 words"
        add a button called again saying "Make another"
== styling
shared colour paper is #eef1f5
shared colour ink is #1b2330
shared colour muted is #5f6b7c
shared colour accent is #5b4bdb
shared colour card is #ffffff
shared colour line is #d5dbe4
style the page: font-family: system-ui, background the colour paper, text colour the colour ink, space around 0
style app: at most 620 wide, centred, space inside 40 16, in a column, gap 16
style big headings: text size 30, space around 0
create group hint: text colour the colour muted, space around 0
style phrase: font-family: monospace, text size 26, bold, background the colour card, border 1 the colour line, rounded corners 14, space inside 22 18, centre the text, overflow-wrap: anywhere, space around 0
style controls: in a row, gap 12, flex-wrap: wrap
style word-count: font: inherit, space inside 10 12, rounded corners 10, border 1 the colour line, background the colour card, text colour the colour ink
style again: font: inherit, bold, space inside 12 22, rounded corners 999, no border, background the colour accent, text colour white, hand cursor`,

`component: pass-words
name: Picking the words
depth: walk
summary: The maker itself: a list of 128 words, and a tool that picks some at random and joins them. The gotcha is the randomness. Math.random is fine for games but can be predicted, so passwords use crypto.getRandomValues, the browser's secure random numbers. Separators, capitals and a number are settings here too (the options step adds buttons for them). The passphrase is made in the browser and never sent anywhere.
learn: Secure and ordinary random numbers; joining a list into text (join); settings kept in variables that other steps can change.
== mechanics
note: The words to choose from: 128 of them, so each word is one of 128 equally likely choices.
create list words with "apple", "anchor", "arrow", "autumn", "badge", "bamboo", "banjo", "barrel", "beacon", "berry", "bicycle", "blanket", "bottle", "breeze", "bridge", "bucket", "butter", "cabin", "cactus", "camera", "candle", "canyon", "carpet", "castle", "cherry", "chimney", "circus", "cloud", "clover", "comet", "copper", "cotton", "crayon", "cricket", "crystal", "daisy", "desert", "dolphin", "dragon", "drum", "eagle", "echo", "ember", "engine", "falcon", "feather", "fiddle", "forest", "fossil", "garden", "ginger", "glacier", "globe", "granite", "guitar", "hammer", "harbour", "hazel", "helmet", "honey", "igloo", "island", "ivory", "jacket", "jelly", "jigsaw", "jungle", "kettle", "kitten", "ladder", "lantern", "lemon", "lizard", "magnet", "mango", "maple", "marble", "meadow", "mirror", "mitten", "monkey", "mountain", "nectar", "needle", "oasis", "ocean", "olive", "orbit", "otter", "paddle", "panda", "parrot", "pebble", "pepper", "piano", "pillow", "planet", "pocket", "pumpkin", "puzzle", "quartz", "quill", "rabbit", "raven", "ribbon", "river", "rocket", "saddle", "salmon", "shadow", "silver", "sparrow", "spider", "sponge", "ticket", "tiger", "timber", "tomato", "tunnel", "turtle", "velvet", "violin", "walnut", "willow", "window", "wizard", "yogurt", "zebra"
note: The settings: how many words, what goes between them, capitals, and a number on the end.
set wordCount to 6
set separator to "-"
set capitals to no
set addNumber to no
set passphrase to ""
set the text of word-count to "6 words"

define pickIndex using size
    note: A secure random whole number from 0 up to (not including) size. crypto.getRandomValues gives numbers nobody can predict.
    set numbers to window.crypto.getRandomValues(new Uint32Array(1))
    give back (first item of numbers) mod size

define makePassphrase
    create list chosen
    repeat wordCount times
        run pickIndex with length of words and store in place
        set word to item place of words
        if capitals
            set word to (first item of word in capitals) plus word.slice(1)
        add word to chosen
    if addNumber
        add pickIndex(100) to chosen
    set passphrase to chosen.join(separator)
    set the text of phrase to passphrase

run makePassphrase

when again is clicked
    run makePassphrase

when word-count is changed
    get the text of word-count and store in picked
    set wordCount to parseInt(picked)
    run makePassphrase`,

`component: pass-strength
name: The strength meter
depth: hallway
summary: How strong is it? Each word is one of 128, so every word multiplies the guesses an attacker needs by 128. Security people count this in bits: 7 bits a word here, since 2 to the power 7 is 128. The meter fills and changes colour with the bits, and shows the number of possible passphrases. You write the bits and where "strong" starts. The honest catch: with a list this short, only long passphrases get there.
learn: Logarithms (Math.log2: how many times 2 multiplies to make a number); bits of entropy; changing an element's style from Mechanics.
blank: ‹the bits in the whole passphrase› | a calculation | Each word adds the log2 of the list's length in bits: \`Math.log2\` of \`length of words\`, which is 7 for 128 words. Multiply that by \`wordCount\`, the number of words. | wordCount times Math.log2(length of words)
blank: ‹the bits where strong starts› | a number | A number of bits above the 40 where fair starts. Each word here adds 7 bits, so 6 words give 42 and 8 words give 56. | 55
== structure
add a block called meter
    add a block called meter-fill
add a paragraph called strength ""
== styling
style meter: height 10, background the colour line, rounded corners 999, overflow: hidden
style meter-fill: height 100%, width 0%, background #c92a2a, smooth changes
style strength: text colour the colour muted, space around 0, overflow-wrap: anywhere
== mechanics
define rateStrength
    note: 1. Bits: each word adds log2 of the list's length (7 for 128 words). The capitals and the number aren't counted, so this errs on the safe side.
    set bits to Math.round(‹the bits in the whole passphrase›)
    set label to "Weak"
    set colour to "#c92a2a"
    note: 2. Where strong starts, and fair below it.
    if bits is at least ‹the bits where strong starts›
        set label to "Strong"
        set colour to "#2b8a3e"
    otherwise if bits is at least 40
        set label to "Fair"
        set colour to "#e8590c"
    set fill to meter-fill
    set fill.style.width to "{Math.min(bits, 80) divided by 80 times 100}%"
    set fill.style.background to colour
    note: 2n ** … is a BigInt, a whole number of any size: ordinary numbers lose their last digits past about 9 million billion.
    set the text of strength to "{label}: {bits} bits, one of {(2n ** BigInt(bits)).toLocaleString()} possible passphrases."

run rateStrength

when word-count is changed
    run rateStrength`,

`component: pass-options
name: Separators, capitals and a number
depth: walk
summary: Some sites insist on capitals or a number, and some refuse spaces. These controls change the settings the words step keeps (separator, capitals, addNumber) and make a new passphrase straight away. Capitals and a number satisfy the rules but add little strength: the length is what counts.
learn: Drop-downs and their value; the "changed" event; one step changing settings another step uses.
== structure
add a block called options
    add a label "Between words" for separator-choice
    add a drop-down called separator-choice with "-", ".", "space", "none"
    add a drop-down called capitals-choice with "lower case", "Capitals"
    add a drop-down called number-choice with "no number", "a number on the end"
== styling
style options: in a row, gap 14, flex-wrap: wrap, text colour the colour muted
create group choice: font: inherit, space inside 6 8, rounded corners 8, border 1 the colour line, background the colour card, text colour the colour ink
separator-choice belongs to group choice
capitals-choice belongs to group choice
number-choice belongs to group choice
== mechanics
when separator-choice is changed
    get the text of separator-choice and store in picked
    if picked is "space"
        set separator to " "
    otherwise if picked is "none"
        set separator to ""
    otherwise
        set separator to picked
    run makePassphrase

when capitals-choice is changed
    set capitals to the text of capitals-choice is "Capitals"
    run makePassphrase

when number-choice is changed
    set addNumber to the text of number-choice is "a number on the end"
    run makePassphrase`,

`component: pass-copy
name: Copy to the clipboard
depth: walk
summary: A Copy button, so the passphrase goes straight into a sign-up form. The clipboard needs the page's permission: a page opened from a web address gets it, but some previews block it, so the message says when to copy by hand instead. Clear your clipboard afterwards, or the next paste could show it somewhere it shouldn't be.
learn: The clipboard API (navigator.clipboard); promises, which finish later and can fail.
== structure
add a button called copy saying "Copy"
add a paragraph called copied ""
== styling
style copy: align-self: flex-start, font: inherit, space inside 10 20, rounded corners 999, border 1 the colour line, background the colour card, text colour the colour ink, hand cursor
style copied: text colour the colour muted, space around 0
== mechanics
when copy is clicked
    set message to copied
    note: Copying finishes later and can be refused. No sentence handles that yet, so this line is JavaScript: then(when it works, when it doesn't).
    js: navigator.clipboard.writeText(passphrase).then(() => { message.textContent = "Copied."; }, () => { message.textContent = "The clipboard is blocked here: select the passphrase and copy it."; });`,

`component: pass-wordlist
name: A real word list
depth: horizon
summary: 128 words give 7 bits a word. The EFF's long list has 7,776 words (made for rolling five dice), about 12.9 bits a word, so five of its words beat nine of these. A list that long goes in a file of its own, loaded when the page opens, and should avoid words that are hard to spell or look alike.
usual: The EFF diceware word lists (long, and two short ones); a words.txt next to the page, read with fetch and split into lines.
learn: Reading a text file with fetch; splitting text into a list (split); logarithms, to compare lists.`,

`component: pass-breaches
name: Checking leaked passwords
depth: horizon
summary: Billions of real passwords have leaked, and attackers try them first. A checker can ask whether a password is among them without sending it: it hashes the password and sends only the first five characters of the hash, then looks for the rest in the answer (k-anonymity). For passwords people type themselves, a smarter strength estimate also spots names, dates and keyboard patterns.
usual: Have I Been Pwned's Pwned Passwords range API; crypto.subtle.digest for the SHA-1 hash; zxcvbn, Dropbox's strength estimator.
learn: Hashing; k-anonymity; async fetch and promises.`,

// ---------------------------------------------------------------- Countdown

`kit: countdown
title: Countdown
layout: website
shelf: tools
platform: phone
about: Days and hours to the things you're looking forward to: add an event and a date, and each one counts down, saved in the browser. A bar under each shows how far along the wait you are since you added it. Made for a phone's screen.
steps: countdown-page!, countdown-events!, countdown-bar*, countdown-remove*, countdown-soon, installable, notifications`,

`component: countdown-page
name: The page, phone first
depth: walk
summary: The page for a narrow screen: one column, text sized for phones, and boxes and buttons at least 48 pixels tall, the size of a fingertip. At the top, a headline for the next event; then a form for a name and a date, and the list the events go in. The events step makes it work.
learn: Designing for thumbs; date boxes (input type="date"); lists styled as cards.
== structure
page title is "Countdown"
add a header called top
    add a big heading "Countdown"
    add a paragraph called headline "Add something to look forward to."
add a form called new-event
    add a label "What's coming?" for name-box
    add a text box called name-box with hint "Holiday in Lisbon"
    add a label "When?" for date-box
    add a date box called date-box
    add a button called add-event saying "Add"
add a paragraph called message ""
add a list called event-list
== styling
shared colour paper is #fff8f0
shared colour ink is #2b2118
shared colour muted is #7a6a5c
shared colour accent is #d9480f
shared colour card is #ffffff
shared colour line is #f0e2d2
style the page: font-family: system-ui, background the colour paper, text colour the colour ink, at most 480 wide, centred, space inside 20 16, line-height: 1.5
style top: space around 0 0 16
style big headings: text size 32, space around 0
style headline: text size 20, text colour the colour accent, bold, space around 4 0 0
style new-event: in a column, gap 8, background the colour card, border 1 the colour line, rounded corners 16, space inside 16
style labels: bold, text size 15
style text boxes: font: inherit, text size 18, min-height: 48px, space inside 8 12, border 1 the colour line, rounded corners 10, background white, text colour the colour ink
style add-event: font: inherit, text size 18, bold, min-height: 52px, rounded corners 12, no border, background the colour accent, text colour white, hand cursor
style message: text colour the colour muted
style event-list: list-style: none, space inside 0, in a column, gap 12
style list items: background the colour card, border 1 the colour line, rounded corners 14, space inside 14 16, text size 18`,

`component: countdown-events
name: Events that count down
depth: walk
summary: Each event is a record: its name, when it is, and when you added it, with times kept the way JavaScript keeps them, as milliseconds. The list is sorted by date, saved in the browser, and redrawn every minute. Each row is built in Mechanics, and other steps add to it through extras, a list of tools run for every row (the bar and the Remove button work that way). The date counts from midnight at the start of that day.
learn: Dates and milliseconds (Date.now, getTime); sorting with a compare tool; making elements in Mechanics (createElement); tools kept in a list.
== mechanics
note: Each event: its name, when it is and when it was added, in milliseconds.
create list events
load "events" from the browser and store in saved
if saved is not nothing
    set events to saved
note: Tools other steps add: each is run for every event's row, so it can add to it.
create list extras
set eventList to event-list

define timeLeft using entry
    set ms to entry.when minus Date.now()
    if ms is at most 0
        give back "it's here"
    set days to Math.floor(ms divided by 86400000)
    set hours to Math.floor((ms mod 86400000) divided by 3600000)
    give back "{days} days, {hours} hours to go"

define showEvents
    clear event-list
    set the text of message to ""
    if length of events is 0
        set the text of message to "No events yet: add one above."
    set upcoming to events.find(e => e.when is more than Date.now())
    if upcoming is not nothing
        set the text of headline to "{upcoming.name}: {timeLeft(upcoming)}"
    otherwise
        set the text of headline to "Add something to look forward to."
    for each entry in events
        set row to document.createElement("li")
        set row.textContent to "{entry.name}: {timeLeft(entry)}"
        for each extra in extras
            run extra with entry, row
        run eventList.append with row

when new-event is sent
    get the text of name-box and store in name
    get the text of date-box and store in picked
    if name is empty text or picked is empty text
        set the text of message to "Give the event a name and a date."
    otherwise
        add { "name": name, "when": new Date(picked plus "T00:00").getTime(), "added": Date.now() } to events
        run events.sort with (a, b) => a.when minus b.when
        save events in the browser as "events"
        clear name-box
        run showEvents

note: Drawn once every step has added its extras (when the page has loaded), then every minute.
when the page has loaded
    run showEvents

every 60 seconds
    run showEvents`,

`component: countdown-bar
name: How far along the wait
depth: hallway
summary: The twist: a bar under each event that fills from the day you added it to the day itself, so a long wait visibly gets shorter. The share gone so far is the time since you added it divided by the whole wait, from 0 (newly added) to 1 (the day). The bar is made in Mechanics as two blocks, a track and a fill whose width is that share. You write the share.
learn: Fractions and percentages; Math.min and Math.max, to keep a number between 0 and 1; setting a width from Mechanics.
blank: ‹the share of the wait gone, from 0 to 1› | a calculation | \`entry.added\` is when the event was added, \`entry.when\` is the day itself, and \`Date.now()\` is now, all in milliseconds. Divide the time since it was added by the whole wait, from adding it to the day, with each subtraction in brackets. | (Date.now() minus entry.added) divided by (entry.when minus entry.added)
== styling
create group track: height 10, background the colour line, rounded corners 999, overflow: hidden, space around 10 0 0
create group fill: height 100%, background the colour accent, rounded corners 999
== mechanics
define drawBar using entry, row
    note: 1. The share of the wait gone: from when it was added to now, out of from when it was added to the day.
    set share to ‹the share of the wait gone, from 0 to 1›
    note: 2. Kept between 0 and 1, so a day already past shows a full bar.
    if entry.when is at most entry.added
        set share to 1
    set share to Math.min(Math.max(share, 0), 1)
    set track to document.createElement("div")
    set fill to document.createElement("div")
    set track.className to "track"
    set fill.className to "fill"
    set fill.style.width to "{Math.round(share times 100)}%"
    run track.append with fill
    run row.append with track

add drawBar to extras`,

`component: countdown-remove
name: Removing an event
depth: walk
summary: Once a day has come and gone, or plans change, its event should go. This step adds a Remove button to every row, through extras, and removing keeps every event except that one (filter), then saves and redraws. The button is made in Mechanics, so its click is set there too (onclick) rather than with "when … is clicked", which needs a name from Structure.
learn: filter, which keeps the items that pass a test; buttons made in Mechanics, and onclick.
== styling
create group remove: font: inherit, text size 15, min-height: 40px, space around 10 0 0, space inside 0 14, rounded corners 999, border 1 the colour line, background transparent, text colour the colour muted, hand cursor
== mechanics
define removeButton using entry, row
    set button to document.createElement("button")
    set button.textContent to "Remove"
    set button.className to "remove"
    set button.onclick to () => removeEvent(entry)
    run row.append with button

define removeEvent using entry
    set events to events.filter(e => e is not entry)
    save events in the browser as "events"
    run showEvents

add removeButton to extras`,

`component: countdown-soon
name: Highlighting what's close
depth: walk
summary: Events less than a week away get an accent stripe down their left edge, so the near ones stand out in a long list. It's another tool in extras: it looks at each event and adds a group (a CSS class) to its row when the day is close. Change the 7 to suit you.
learn: Adding a class from Mechanics (classList.add); a week in milliseconds.
== styling
create group soon: border-left: 6px solid var(--accent)
== mechanics
define markSoon using entry, row
    if entry.when minus Date.now() is less than 7 times 86400000
        run row.classList.add with "soon"

add markSoon to extras`,

// ---------------------------------------------------------------- Kitchen Converter

`kit: kitchen-converter
title: Kitchen Converter
layout: website
shelf: tools
platform: phone
about: The conversions recipes need, on your phone in the kitchen: cups to grams for each ingredient (a cup of flour and a cup of sugar weigh very differently), oven temperatures in °C and °F, spoons and millilitres, and scaling a recipe for more people.
steps: kitchen-page!, kitchen-grams*, kitchen-temperature*, kitchen-spoons*, kitchen-scale, installable, kitchen-more`,

`component: kitchen-page
name: The page, phone first
depth: walk
summary: A page made for a phone propped up on the worktop: one column, big text, and number boxes 52 pixels tall that bring up the number keypad. Each converter after this is a panel of its own (the group panel), with its answer in large accent-coloured text (the group result), so they all look alike.
learn: Designing for a phone; number boxes and the keypad they open; groups (CSS classes) shared by several parts.
== structure
page title is "Kitchen converter"
add a header called top
    add a big heading "Kitchen converter"
    add a paragraph "Cups to grams, oven temperatures, spoons and servings." in group hint
== styling
shared colour paper is #f7f4ec
shared colour ink is #26231e
shared colour muted is #736b5e
shared colour accent is #2f7d32
shared colour card is #ffffff
shared colour line is #e3dccd
style the page: font-family: system-ui, background the colour paper, text colour the colour ink, at most 480 wide, centred, space inside 20 16, line-height: 1.5
style headings: text size 20, space around 0
style big headings: text size 30, space around 0
create group hint: text colour the colour muted, space around 4 0 20
create group panel: background the colour card, border 1 the colour line, rounded corners 16, space inside 16, space around 0 0 16, in a column, gap 10
style labels: bold, text size 15
style text boxes: font: inherit, text size 20, min-height: 52px, space inside 8 12, border 1 the colour line, rounded corners 12, background white, text colour the colour ink
style select: font: inherit, text size 18, min-height: 52px, space inside 8 12, border 1 the colour line, rounded corners 12, background white, text colour the colour ink
create group result: text size 22, bold, text colour the colour accent, space around 0`,

`component: kitchen-grams
name: Cups to grams, by ingredient
depth: hallway
summary: The twist. A cup measures space, not weight, so a cup of flour (light, full of air) weighs about 125 g while a cup of sugar weighs 200 g and honey 340 g. Each ingredient's weight per cup is its density, kept here in a table; the conversion looks it up and works both ways. You write the two calculations. The cups are US cups (240 ml); a metric cup (250 ml) holds a little more.
learn: Looking a value up by name (item … of …); multiplying and dividing to go both ways; parseFloat and isNaN, for what's typed.
blank: ‹the weight of that many cups, in grams› | a calculation | \`amount\` is the number of cups typed in, and \`perCup\` is what one cup of this ingredient weighs, in grams. Each cup adds another \`perCup\` grams. | amount times perCup
blank: ‹that many grams, in cups› | a calculation | \`amount\` is now the grams typed in, and \`perCup\` is the grams in one cup. The cups are how many times \`perCup\` fits into \`amount\`. | amount divided by perCup
== structure
add a section called weigh in group panel
    add a heading "Cups and grams"
    add a label "How much" for amount-box
    add a number box called amount-box with hint "1"
    add a drop-down called direction with "cups to grams", "grams to cups"
    add a label "Of what" for ingredient
    add a drop-down called ingredient with "plain flour", "sugar", "brown sugar", "icing sugar", "butter", "rolled oats", "rice", "cocoa powder", "honey", "milk", "water"
    add a paragraph called grams-result "" in group result
== mechanics
note: Grams in one US cup of each: their densities. Measured ones vary a little with how the cup is filled.
set gramsPerCup to { "plain flour": 125, "sugar": 200, "brown sugar": 220, "icing sugar": 120, "butter": 227, "rolled oats": 90, "rice": 190, "cocoa powder": 85, "honey": 340, "milk": 245, "water": 240 }

define convertGrams
    get the text of amount-box and store in typed
    get the text of ingredient and store in name
    set amount to parseFloat(typed)
    if isNaN(amount)
        set the text of grams-result to "Type an amount."
        give back
    set perCup to item name of gramsPerCup
    if the text of direction is "cups to grams"
        set grams to ‹the weight of that many cups, in grams›
        set the text of grams-result to "{amount} cups of {name} weigh about {Math.round(grams)} g"
    otherwise
        set cups to ‹that many grams, in cups›
        set the text of grams-result to "{amount} g of {name} is about {cups.toFixed(2)} cups"

when amount-box is typed in
    run convertGrams
when direction is changed
    run convertGrams
when ingredient is changed
    run convertGrams
run convertGrams`,

`component: kitchen-temperature
name: Oven temperatures
depth: walk
summary: Recipes from the US give oven temperatures in Fahrenheit, most others in Celsius. To go from °C to °F, multiply by 9/5 and add 32; to go back, take away 32 and multiply by 5/9 (the 32 is because water freezes at 32 °F). The answer is rounded, because no oven dial is finer than a degree. Fan ovens usually run about 20 °C hotter than the recipe says.
learn: Formulas with brackets (what's worked out first); Math.round.
== structure
add a section called oven in group panel
    add a heading "Oven temperature"
    add a number box called degrees with hint "180"
    add a drop-down called scale with "°C to °F", "°F to °C"
    add a paragraph called temperature-result "" in group result
== mechanics
define convertTemperature
    set value to parseFloat(the text of degrees)
    if isNaN(value)
        set the text of temperature-result to "Type a temperature."
        give back
    if the text of scale is "°C to °F"
        set the text of temperature-result to "{value} °C is {Math.round(value times 9 divided by 5 plus 32)} °F"
    otherwise
        set the text of temperature-result to "{value} °F is {Math.round((value minus 32) times 5 divided by 9)} °C"

when degrees is typed in
    run convertTemperature
when scale is changed
    run convertTemperature
run convertTemperature`,

`component: kitchen-spoons
name: Spoons, cups and millilitres
depth: walk
summary: Small amounts come in spoons: a teaspoon is 5 ml, a tablespoon 15 ml (three teaspoons), and a US cup 240 ml. This converter turns any of them into millilitres first, then into all the others, so one table of sizes covers every pair. Tablespoons differ slightly by country (Australia's is 20 ml), so change the table to suit your recipes.
learn: Converting through one shared unit; a small table of values (an object); rounding to two decimal places.
== structure
add a section called spoons in group panel
    add a heading "Spoons and cups"
    add a number box called spoon-amount with hint "2"
    add a drop-down called spoon-unit with "tablespoons", "teaspoons", "cups", "millilitres"
    add a paragraph called spoons-result "" in group result
== mechanics
note: Millilitres in each unit.
set mlIn to { "teaspoons": 5, "tablespoons": 15, "cups": 240, "millilitres": 1 }

define convertSpoons
    set amount to parseFloat(the text of spoon-amount)
    get the text of spoon-unit and store in unit
    if isNaN(amount)
        set the text of spoons-result to "Type an amount."
        give back
    set ml to amount times (item unit of mlIn)
    set tsp to Math.round(ml divided by 5 times 100) divided by 100
    set tbsp to Math.round(ml divided by 15 times 100) divided by 100
    set cups to Math.round(ml divided by 240 times 100) divided by 100
    set the text of spoons-result to "{Math.round(ml)} ml · {tsp} tsp · {tbsp} tbsp · {cups} cups"

when spoon-amount is typed in
    run convertSpoons
when spoon-unit is changed
    run convertSpoons
run convertSpoons`,

`component: kitchen-scale
name: Scaling a recipe
depth: walk
summary: A recipe for 4 when you're cooking for 6: every amount is multiplied by the same number, 6 ÷ 4 = 1.5. This step works that number out and shows an example. Most things scale like this; baking times, raising agents and seasoning often don't, so go a little under and taste.
learn: Ratios; checking for nonsense before dividing (nothing typed, or zero people).
== structure
add a section called servings in group panel
    add a heading "Scale a recipe"
    add a label "The recipe serves" for serves
    add a number box called serves with hint "4"
    add a label "You're cooking for" for cooking-for
    add a number box called cooking-for with hint "6"
    add a paragraph called scale-result "" in group result
== mechanics
define scaleRecipe
    set recipePeople to parseFloat(the text of serves)
    set yourPeople to parseFloat(the text of cooking-for)
    if isNaN(recipePeople) or isNaN(yourPeople) or recipePeople is at most 0
        set the text of scale-result to "Type both numbers of people."
        give back
    set factor to Math.round(yourPeople divided by recipePeople times 100) divided by 100
    set the text of scale-result to "Multiply every amount by {factor}: 200 g becomes {Math.round(200 times factor)} g."

when serves is typed in
    run scaleRecipe
when cooking-for is typed in
    run scaleRecipe
run scaleRecipe`,

`component: kitchen-more
name: More ingredients, more exactly
depth: horizon
summary: Eleven ingredients is a start. A full converter knows hundreds, with weights for different ways of measuring (packed or spooned, chopped or whole), and can read a whole recipe and convert every line at once. That means a bigger table, kept in a file of its own, and reading amounts and units out of text.
usual: Published weight charts (King Arthur Baking's ingredient weight chart); USDA FoodData Central, whose portions give grams per cup; a JSON file of ingredients next to the page, loaded with fetch.
learn: JSON files and fetch; searching a list as you type; reading numbers and units out of text with regular expressions.`,

// ---------------------------------------------------------------- Link Page

`kit: link-page
title: Link Page
layout: website
shelf: social
platform: phone
about: A link-in-bio page: your name, a line about you, and big buttons to everything you want people to find. It counts the taps on each link (in this browser) and has a light and dark switch. Made for phones, because that's where most people tap a bio link.
steps: links-page!, links-list!, links-taps*, links-theme*, links-qr, analytics, publish`,

`component: links-page
name: The profile
depth: walk
summary: The top of the page: a round badge with your initials (made with a colour gradient, so it needs no picture file), your name, one line about you, and an empty navigation bar where the links go. Everything sits in one column sized for a phone, and the colours are shared names so the theme switch can change them all at once.
learn: Round shapes (rounded corners of 50%); colour gradients; shared colours (CSS variables).
== structure
page title is "Your Name · links"
add a header called profile
    add a paragraph called avatar "YN"
    add a big heading "Your Name"
    add a paragraph called bio "Maker of small things. Find me here:"
add a navigation bar called link-list
== styling
shared colour paper is #fdf7f2
shared colour ink is #241c2c
shared colour muted is #6f6478
shared colour accent is #845ef7
shared colour card is #ffffff
shared colour line is #eadff2
style the page: font-family: system-ui, background the colour paper, text colour the colour ink, at most 460 wide, centred, space inside 32 16, line-height: 1.5, smooth changes
style profile: in a column, align-items: center, centre the text, gap 6
style avatar: width 96, height 96, round, background: linear-gradient(135deg, #f06595, #845ef7), text colour white, text size 34, bold, display: grid, place-items: center, space around 0
style big headings: text size 26, space around 6 0 0
style bio: text colour the colour muted, space around 0
style link-list: in a column, gap 12, space around 24 0
create group link-button: in a row, spread out, gap 10, min-height: 56px, space inside 0 20, rounded corners 16, background the colour card, border 1 the colour line, text colour the colour ink, no underline, bold, text size 17, soft shadow, smooth changes
when group link-button is hovered: border-color: var(--accent)`,

`component: links-list
name: The links
depth: walk
summary: The links are data: a list of records, each with what the button says and where it goes, and the buttons are made from it in Mechanics. Adding a link is one more line in the list. Links open in a new tab (target _blank, with rel noopener so the other site can't reach back into this page). The sandboxed preview may not open them; they work once the page is published. Other steps add to each button through extras.
learn: Making links in Mechanics (createElement, href); target and rel; data in one place, drawn by a loop.
== mechanics
note: Your links: what each button says and where it goes.
create list links with { "label": "My shop", "url": "https://example.com/shop" }, { "label": "Latest video", "url": "https://example.com/video" }, { "label": "Newsletter", "url": "https://example.com/newsletter" }, { "label": "Email me", "url": "mailto:you@example.com" }
note: Tools other steps add: each is run for every button, so it can add to it.
create list extras
set linkList to link-list

define showLinks
    clear link-list
    for each link in links
        set button to document.createElement("a")
        set button.href to link.url
        set button.textContent to link.label
        set button.className to "link-button"
        set button.target to "_blank"
        set button.rel to "noopener"
        for each extra in extras
            run extra with link, button
        run linkList.append with button

note: Drawn once every step has added its extras.
when the page has loaded
    run showLinks`,

`component: links-taps
name: Counting taps
depth: hallway
summary: Which links do people use? Each tap is counted in the browser, under the link's address, and each button shows its count and its share of all taps. The honest limit: these are the taps in this browser only, yours. Counting every visitor's taps needs a server or an analytics service (a horizon step). You write the counting and the share.
learn: Keys made from text ("taps-" plus the address); percentages; onclick for elements made in Mechanics.
blank: ‹this link's share of the taps, in percent› | a calculation | \`tapsFor(link)\` counts this link's taps, and \`totalTaps()\` counts every link's taps together. A share is the part divided by the whole; times 100 makes it a percentage. | tapsFor(link) divided by totalTaps() times 100
blank: ‹the link's new count of taps› | a calculation | \`tapsFor(link)\` is how many taps the link had before this one, and this tap adds one more. | tapsFor(link) plus 1
== styling
create group taps: margin-left: auto, text size 13, text colour the colour muted, font-weight: normal, font-variant-numeric: tabular-nums
== mechanics
define tapsFor using link
    load "taps-{link.url}" from the browser and store in count
    if count is nothing
        give back 0
    give back count

define totalTaps
    set total to 0
    for each link in links
        increase total by tapsFor(link)
    give back total

define addTapCount using link, button
    set badge to document.createElement("span")
    set badge.className to "taps"
    set share to 0
    if totalTaps() is more than 0
        set share to Math.round(‹this link's share of the taps, in percent›)
    set badge.textContent to "{tapsFor(link)} · {share}%"
    run button.append with badge
    set button.onclick to () => recordTap(link)

define recordTap using link
    set count to ‹the link's new count of taps›
    save count in the browser as "taps-{link.url}"
    run showLinks

add addTapCount to extras`,

`component: links-theme
name: Light and dark switch
depth: walk
summary: A button in the corner switches between light and dark. Dark mode is a group (a CSS class) on the whole page that gives the shared colours darker values, so everything changes at once. The first time, it follows the phone's own setting; after that, your choice is remembered in the browser.
learn: Classes on the page itself (document.documentElement); CSS variables changed by a class; prefers-color-scheme, read with matchMedia.
== structure
add a button called theme-switch saying "☾ Dark"
== styling
style theme-switch: position: fixed, top: 12px, right: 12px, font: inherit, min-height: 44px, space inside 0 16, rounded corners 999, border 1 the colour line, background the colour card, text colour the colour ink, hand cursor
create group dark: --paper: #17141c, --ink: #f2edf7, --muted: #b3a9bd, --card: #231f2a, --line: #3a3343
== mechanics
set root to document.documentElement
load "theme" from the browser and store in savedTheme
if savedTheme is nothing
    set savedTheme to "light"
    if window.matchMedia("(prefers-color-scheme: dark)").matches
        set savedTheme to "dark"

define applyTheme using theme
    if theme is "dark"
        run root.classList.add with "dark"
        set the text of theme-switch to "☀ Light"
    otherwise
        run root.classList.remove with "dark"
        set the text of theme-switch to "☾ Dark"
    save theme in the browser as "theme"

when theme-switch is clicked
    if root.classList.contains("dark")
        run applyTheme with "light"
    otherwise
        run applyTheme with "dark"

run applyTheme with savedTheme`,

`component: links-qr
name: A QR code for the page
depth: horizon
summary: For posters, stickers and business cards, a QR code takes a phone camera straight to the page. A QR code holds only the address, so the page has to be online first (Putting it online), and the code still works when the links on the page change.
usual: A QR library such as qrcode or QRCode.js, added with a script tag; many hosts and phone cameras can make one for you; an address of your own, so the code never needs reprinting.
learn: What a QR code stores; adding a library to a page (a head: line in Structure); drawing on a canvas.`,

// ---------------------------------------------------------------- Photo Booth Filters

`kit: photo-booth
title: Photo Booth Filters
layout: website
shelf: creative
platform: web
about: A gallery where every photo can wear a look (warm, mono or faded) made with CSS filters, chosen photo by photo and remembered by the browser. Drawn scenes stand in for photos, so it works with no picture files, and you can try a photo of your own from your device.
steps: booth-page!, booth-scenes!, booth-filters*, booth-remember*, booth-upload*, booth-download, publish`,

`component: booth-page
name: The gallery
depth: walk
summary: A grid of cards, three across on a wide screen and one on a phone, each with a picture and a drop-down of looks. The pictures are drawing areas (canvases) that the next step paints, so nothing depends on files. Every picture is in the group photo and every drop-down in the group filter-choice: that's how the filters step finds them, in order, however many there are.
learn: Grids that adapt (auto-fit); drawing areas (canvas); groups as a way for Mechanics to find things.
== structure
page title is "Photo booth"
add a header called top
    add a big heading "Photo booth"
    add a paragraph "Give each photo a look: warm, mono or faded." in group hint
add a main area called gallery
    add a card
        add a drawing area called photo-1 600 by 450 in group photo
        add a drop-down called filter-1 with "none", "warm", "mono", "faded" in group filter-choice
    add a card
        add a drawing area called photo-2 600 by 450 in group photo
        add a drop-down called filter-2 with "none", "warm", "mono", "faded" in group filter-choice
    add a card
        add a drawing area called photo-3 600 by 450 in group photo
        add a drop-down called filter-3 with "none", "warm", "mono", "faded" in group filter-choice
== styling
shared colour paper is #f3f0ea
shared colour ink is #23211f
shared colour muted is #6e6860
shared colour card is #ffffff
shared colour line is #e1dbd0
style the page: font-family: system-ui, background the colour paper, text colour the colour ink, space around 0, space inside 24 16
style top: at most 1000 wide, centred, space around 0 auto 16
style big headings: text size 30, space around 0
create group hint: text colour the colour muted, space around 4 0 0
style gallery: at most 1000 wide, centred, display: grid, grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)), gap 18
create group card: background the colour card, border 1 the colour line, rounded corners 14, space inside 10, in a column, gap 10, soft shadow
create group photo: width 100%, height auto, aspect-ratio: 4 / 3, object-fit: cover, display: block, rounded corners 10, smooth changes
create group filter-choice: font: inherit, space inside 8 10, rounded corners 8, border 1 the colour line, background the colour card, text colour the colour ink`,

`component: booth-scenes
name: Scenes to start with
depth: walk
summary: Three drawn scenes stand in for photos: a sunset, a summer day and a moonlit sea, each a sky gradient, a sun or moon and a curve of land, painted on the drawing areas with the canvas's own tools. Filters work on them exactly as on photos. Change the colours in the last three lines to paint your own.
learn: The canvas 2D context: gradients, fillRect, arc, and paths with curves.
== mechanics
define drawScene using id, skyTop, skyBottom, sun, land
    set canvas to document.getElementById(id)
    set pen to canvas.getContext("2d")
    set sky to pen.createLinearGradient(0, 0, 0, 450)
    run sky.addColorStop with 0, skyTop
    run sky.addColorStop with 1, skyBottom
    set pen.fillStyle to sky
    run pen.fillRect with 0, 0, 600, 450
    set pen.fillStyle to sun
    run pen.beginPath
    run pen.arc with 420, 170, 56, 0, Math.PI times 2
    run pen.fill
    set pen.fillStyle to land
    run pen.beginPath
    run pen.moveTo with 0, 330
    run pen.quadraticCurveTo with 220, 240, 600, 320
    run pen.lineTo with 600, 450
    run pen.lineTo with 0, 450
    run pen.fill

run drawScene with "photo-1", "#ff8a5b", "#ffd6a0", "#fff1c1", "#5b3a29"
run drawScene with "photo-2", "#6ec6ea", "#e3f6ff", "#ffe066", "#3a7d44"
run drawScene with "photo-3", "#0b1d3a", "#3a6ea5", "#f4f1de", "#1d3557"`,

`component: booth-filters
name: The looks
depth: hallway
summary: Each look is a CSS filter: a recipe of adjustments the browser applies as it draws, such as sepia(0.3), grayscale(1), contrast(1.2), brightness(1.1) or saturate(0.5), separated by spaces. The photo itself never changes; only how it's shown. Choosing a look puts the photo in that group, replacing the last one. You write the three recipes: try values, and watch the preview.
learn: CSS filters (sepia, grayscale, contrast, brightness, saturate); classes swapped from Mechanics; querySelectorAll, to find every element in a group.
blank: ‹filters for a warm look› | a CSS value | A little \`sepia\` tints it towards brown, and \`saturate\` above 1 makes the colours stronger. Each filter takes its amount in brackets, with a space between filters. | sepia(0.35) saturate(1.4)
blank: ‹filters for black and white› | a CSS value | \`grayscale\` takes the colour out (1 is all of it), and \`contrast\` a little above 1 keeps it from looking flat. Put a space between the two. | grayscale(1) contrast(1.15)
blank: ‹filters for a faded look› | a CSS value | \`contrast\` and \`saturate\` below 1 soften and dull the picture, and \`brightness\` a little above 1 lightens it. Put a space between each. | contrast(0.8) saturate(0.6) brightness(1.1)
== styling
create group warm: filter: ‹filters for a warm look›
create group mono: filter: ‹filters for black and white›
create group faded: filter: ‹filters for a faded look›
== mechanics
define applyFilter using photo, look
    set photo.className to "photo"
    if look is not "none"
        run photo.classList.add with look

note: The photos and the drop-downs, in page order: the first drop-down belongs to the first photo, and so on.
when the page has loaded
    set photos to document.querySelectorAll(".photo")
    set choosers to document.querySelectorAll(".filter-choice")
    repeat length of photos times counting with n
        set photo to item n of photos
        set chooser to item n of choosers
        set chooser.onchange to () => applyFilter(photo, chooser.value)`,

`component: booth-remember
name: Remembering the looks
depth: walk
summary: The looks you choose are kept in the browser, one for each photo in order, and put back when the page opens. Putting a look back means setting its drop-down and telling it that it changed (dispatchEvent), so whatever listens to the drop-downs, like the filters step, reacts as if you'd chosen it yourself.
learn: Lists saved in localStorage; dispatchEvent, to set off an event from Mechanics; addEventListener for elements found with querySelectorAll.
== mechanics
define saveLooks
    create list looks
    for each chooser in document.querySelectorAll(".filter-choice")
        add chooser.value to looks
    save looks in the browser as "looks"

when the page has loaded
    set choosers to document.querySelectorAll(".filter-choice")
    load "looks" from the browser and store in looks
    if looks is not nothing
        repeat Math.min(length of looks, length of choosers) times counting with n
            set chooser to item n of choosers
            set chooser.value to item n of looks
            run chooser.dispatchEvent with new Event("change")
    for each chooser in choosers
        run chooser.addEventListener with "change", saveLooks`,

`component: booth-upload
name: Try your own photo
depth: walk
summary: A file picker for a photo from this device: it's shown in a card of its own, with its own looks, and never leaves the device (an object URL points at the file where it is). To show your photos to visitors instead, put the files next to the page when it's published and add them with "add a picture of … in group photo"; the preview can't reach files next to the page.
learn: File pickers (input type="file"); object URLs; showing and hiding parts of the page.
== structure
add a section called own
    add a heading "Try your own photo"
    add a paragraph "Pick a photo from this device. It stays on your device." in group hint
    note: There's no sentence for a file picker yet, so this line is HTML.
    html: <input type="file" id="photo-file" accept="image/*">
    add a card called own-card
        add a picture called own-photo of "" described as "The photo you picked" in group photo
        add a drop-down called own-filter with "none", "warm", "mono", "faded" in group filter-choice
== styling
style own: at most 1000 wide, centred, space around 24 auto 0, in a column, gap 10
style own-card: at most 320 wide
== mechanics
hide own-card
set picker to document.getElementById("photo-file")
set ownPhoto to own-photo

define showPicked
    set file to first item of picker.files
    if file is nothing
        give back
    set ownPhoto.src to window.URL.createObjectURL(file)
    reveal own-card

set picker.onchange to () => showPicked()`,

`component: booth-download
name: Saving the filtered photo
depth: horizon
summary: CSS filters change how a photo looks on the page, not the file. To save the filtered version, the photo is drawn onto a canvas with the same recipe (a canvas has a filter setting that takes the same words), then the canvas is turned into a file and offered as a download, or shared straight from a phone.
usual: The canvas 2D context's filter property and drawImage; canvas.toBlob; a link with the download attribute; the Web Share API on phones.
learn: Drawing images on a canvas; blobs and object URLs; download links.`,

// ---------------------------------------------------------------- Beat Grid

`kit: beat-grid
title: Beat Grid
layout: website
shelf: creative
platform: web
about: A 16-step drum machine in the browser: a kick, a snare and a hi-hat, each with a row of squares to switch on. The sounds are made from nothing with the Web Audio API, the tempo is yours to set, and the pattern is saved in the browser.
steps: beat-page!, beat-sounds!, beat-grid!, beat-clock*, beat-save*, beat-samples, beat-export`,

`component: beat-page
name: The machine
depth: walk
summary: The machine's face, dark like studio gear: a Play button, a tempo box in beats per minute (BPM), and an empty block for the grid, which the grid step fills with 16 squares for each drum. Every fourth square is outlined a little brighter, so the four beats of a bar stand out.
learn: CSS grids with a fixed first column (grid-template-columns); number boxes; a dark palette.
== structure
page title is "Beat grid"
add a main area called machine
    add a big heading "Beat grid"
    add a block called transport
        add a button called play saying "▶ Play"
        add a label "Tempo (BPM)" for tempo
        add a number box called tempo with hint "100"
    add a block called grid
    add a paragraph "Click a square to switch a beat on or off." in group hint
== styling
shared colour paper is #16181d
shared colour ink is #e8e6e3
shared colour muted is #8a8f98
shared colour accent is #ff6b35
shared colour pad is #262a33
shared colour line is #343a46
style the page: font-family: system-ui, background the colour paper, text colour the colour ink, space around 0
style machine: at most 900 wide, centred, space inside 28 16, in a column, gap 16
style big headings: text size 28, space around 0, letter-spacing: 0.04em
style transport: in a row, gap 12, flex-wrap: wrap
style play: font: inherit, bold, space inside 10 22, rounded corners 999, no border, background the colour accent, text colour #16181d, hand cursor
style tempo: font: inherit, width 80, space inside 8, rounded corners 8, border 1 the colour line, background the colour pad, text colour the colour ink
style grid: display: grid, grid-template-columns: 64px repeat(16, 1fr), gap 4
create group hint: text colour the colour muted, space around 0
create group row-name: text size 13, text colour the colour muted, align-self: center
create group cell: aspect-ratio: 1, rounded corners 6, border 1 the colour line, background the colour pad, hand cursor, space inside 0
create group beat-start: border-color: var(--muted)
create group on: background the colour accent, border-color: var(--accent)
create group playing: outline: 2px solid var(--ink)
on screens narrower than 600:
    style grid: grid-template-columns: 44px repeat(16, 1fr), gap 2`,

`component: beat-sounds
name: Drum sounds from nothing
depth: walk
summary: The drums are made, not recorded: the Web Audio API builds sounds from oscillators (pure tones) and noise. A kick is a low tone falling quickly in pitch; a snare and a hi-hat are short bursts of noise, the hat filtered so only the hiss is left. Each sound is booked for an exact moment on the audio clock. Browsers keep sound paused until someone clicks, so Play and the grid wake it.
learn: AudioContext, oscillators, gain (volume) and filters; ramps (exponentialRampToValueAtTime); the audio clock (currentTime).
== mechanics
set audio to new AudioContext()

note: No sentence makes sound yet, so this tool is JavaScript (js: lines). It plays one drum at the moment "at" on the audio clock.
define playDrum using name, at
    js: const out = audio.createGain();
    js: out.connect(audio.destination);
    js: if (name === "kick") {
    js:   const tone = audio.createOscillator();
    js:   tone.frequency.setValueAtTime(150, at);
    js:   tone.frequency.exponentialRampToValueAtTime(40, at + 0.15);
    js:   out.gain.setValueAtTime(1, at);
    js:   out.gain.exponentialRampToValueAtTime(0.001, at + 0.3);
    js:   tone.connect(out);
    js:   tone.start(at);
    js:   tone.stop(at + 0.3);
    js:   return;
    js: }
    js: const seconds = name === "hat" ? 0.05 : 0.18;
    js: const noise = audio.createBufferSource();
    js: noise.buffer = audio.createBuffer(1, Math.round(audio.sampleRate * seconds), audio.sampleRate);
    js: const samples = noise.buffer.getChannelData(0);
    js: for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    js: const hiss = audio.createBiquadFilter();
    js: hiss.type = "highpass";
    js: hiss.frequency.value = name === "hat" ? 7000 : 1500;
    js: out.gain.setValueAtTime(name === "hat" ? 0.35 : 0.8, at);
    js: out.gain.exponentialRampToValueAtTime(0.001, at + seconds);
    js: noise.connect(hiss);
    js: hiss.connect(out);
    js: noise.start(at);`,

`component: beat-grid
name: The grid
depth: walk
summary: Sixteen squares for each drum, made in Mechanics: one button per step, in a CSS grid. A square that's on is in the group on, so the look and the pattern are the same thing: switching the group switches the beat, and the clock reads the groups to know what to play. A square plays its drum as you switch it on. A simple beat is switched on to start with.
learn: Loops inside loops (rows and steps); making buttons in Mechanics; classList.toggle and contains.
== mechanics
create list drums with "kick", "snare", "hat"
note: Every square, row by row: the square for drum row r, step s is item r × 16 + s.
create list cells
set gridArea to grid
set the text of tempo to "100"

define toggle using cell, drum
    run cell.classList.toggle with "on"
    if cell.classList.contains("on")
        run audio.resume
        run playDrum with drum, audio.currentTime

repeat length of drums times counting with row
    set label to document.createElement("span")
    set label.textContent to item row of drums
    set label.className to "row-name"
    run gridArea.append with label
    repeat 16 times counting with col
        set cell to document.createElement("button")
        set cell.className to "cell"
        set cell.title to "{item row of drums}, step {col plus 1}"
        if col mod 4 is 0
            run cell.classList.add with "beat-start"
        set cell.onclick to () => toggle(cell, item row of drums)
        run gridArea.append with cell
        add cell to cells

note: A beat to start with: kick on 1 and 9, snare on 5 and 13, hi-hat on every other step.
for each n in [0, 8, 20, 28, 32, 34, 36, 38, 40, 42, 44, 46]
    set starter to item n of cells
    run starter.classList.add with "on"`,

`component: beat-clock
name: The clock: playing in time
depth: hallway
summary: The heart of a drum machine is its timing. A timer in JavaScript can run late when the page is busy, so music doesn't wait for it: 40 times a second, the page books every step due in the next tenth of a second on the audio clock, which is exact. A step is a sixteenth note, a quarter of a beat, and a beat lasts 60 ÷ BPM seconds. You write the step's length and the move to the next step.
learn: Beats, BPM and sixteenth notes; scheduling ahead ("A Tale of Two Clocks" explains it); mod, to loop back to the first step.
blank: ‹one step's length, in seconds› | a calculation | A minute has 60 seconds, so one beat lasts 60 divided by \`bpm\` seconds. A step is a sixteenth note, a quarter of a beat. | 60 divided by bpm divided by 4
blank: ‹the next step, back to 0 after 15› | a calculation | The steps are numbered 0 to 15, and \`position\` is the one that was booked last. \`mod\` gives what's left after dividing, so the step after \`position\`, worked out in brackets and then taken mod 16, comes round to 0 after 15. | (position plus 1) mod 16
== mechanics
set playing to no
set position to 0
set nextTime to 0

define stepSeconds
    set bpm to parseFloat(the text of tempo)
    if isNaN(bpm) or bpm is less than 40
        set bpm to 100
    note: 1. One step: a sixteenth note, a quarter of a beat.
    give back ‹one step's length, in seconds›

define showPlayhead using at
    for each cell in cells
        run cell.classList.remove with "playing"
    repeat length of drums times counting with row
        set cell to cells[row times 16 plus at]
        run cell.classList.add with "playing"

when play is clicked
    run audio.resume
    if playing
        set playing to no
        set the text of play to "▶ Play"
        for each cell in cells
            run cell.classList.remove with "playing"
    otherwise
        set playing to yes
        set position to 0
        set nextTime to audio.currentTime plus 0.05
        set the text of play to "■ Stop"

note: Every 25 milliseconds: book each step that falls in the next 0.1 seconds.
every 0.025 seconds
    if playing
        while nextTime is less than audio.currentTime plus 0.1
            repeat length of drums times counting with row
                set cell to cells[row times 16 plus position]
                if cell.classList.contains("on")
                    run playDrum with item row of drums, nextTime
            run showPlayhead with position
            increase nextTime by stepSeconds()
            note: 2. On to the next step; after the 16th, back to the first.
            set position to ‹the next step, back to 0 after 15›`,

`component: beat-save
name: Saving the pattern
depth: walk
summary: The pattern (on or off for every square) and the tempo are saved in the browser whenever they change, and put back when the page opens. A click on a square bubbles up to the grid around it, so one listener on the grid hears them all, after the square has switched. Clear switches every square off.
learn: Event bubbling (a click travels up to the elements around it); lists of yes/no values; classList.toggle with a second input.
== structure
add a button called clear-grid saying "Clear"
== styling
style clear-grid: display: block, font: inherit, space inside 8 18, rounded corners 999, border 1 the colour line, background transparent, text colour the colour ink, hand cursor, space around 0 auto 24
== mechanics
define savePattern
    create list steps
    for each cell in cells
        add cell.classList.contains("on") to steps
    save steps in the browser as "pattern"
    save the text of tempo in the browser as "tempo"

load "pattern" from the browser and store in savedPattern
if savedPattern is not nothing
    repeat Math.min(length of savedPattern, length of cells) times counting with n
        set cell to item n of cells
        run cell.classList.toggle with "on", item n of savedPattern
load "tempo" from the browser and store in savedTempo
if savedTempo is not nothing
    set the text of tempo to savedTempo

when grid is clicked
    run savePattern
when tempo is changed
    run savePattern
when clear-grid is clicked
    for each cell in cells
        run cell.classList.remove with "on"
    run savePattern`,

`component: beat-samples
name: Real drum sounds
depth: horizon
summary: Made-up drums are a start; most drum machines play samples, short recordings of real drums. Each file is loaded once, decoded into an audio buffer, then played as often as needed with the same booking as now. The files go next to the page when it's published (the preview can't reach files next to the page), and their licence must let you use them.
usual: Free sample packs (freesound.org, with the licence checked); fetch, arrayBuffer and decodeAudioData; AudioBufferSourceNode; Tone.js, whose Sampler and Transport do much of this for you.
learn: Audio buffers; loading files with fetch; licences (CC0, CC BY).`,

`component: beat-export
name: Saving the beat as sound
depth: horizon
summary: To use the beat elsewhere, it has to become a file. An offline audio context plays the pattern faster than real time into a buffer, which is then written out as a WAV file; or the live sound is recorded as it plays. For a DAW, the pattern itself can be saved as MIDI, notes rather than sound, so the drums can be changed there.
usual: OfflineAudioContext and a small WAV encoder; MediaRecorder with a MediaStreamDestination; MIDI files with a library such as midi-writer-js.
learn: Sample rates and the WAV format; blobs and download links; MIDI notes and timing.`,

// ---------------------------------------------------------------- Mood Playlist

`kit: mood-playlist
title: Mood Playlist
layout: website
shelf: creative
platform: web
about: A music player for your own audio files, each tagged with a mood: choose calm, happy, focus or energetic and it plays only those, one after another, shuffled if you like. Songs can be listed in Mechanics (the files go next to the page when it's published) or picked from your device.
steps: playlist-page!, playlist-songs!, playlist-device*, playlist-moods*, playlist-shuffle*, playlist-library, publish`,

`component: playlist-page
name: The player
depth: walk
summary: The player's face: what's playing and its mood, Play and Next buttons, and the list of songs. It has no behaviour yet; the songs step makes it work. The palette is a dusk purple, and the buttons are big enough to press without looking.
learn: Laying out a small app panel; buttons in a row; lists.
== structure
page title is "Mood playlist"
add a main area called deck
    add a big heading "Mood playlist"
    add a section called now
        add a paragraph called now-title "Nothing playing"
        add a paragraph called now-mood ""
    add a block called controls
        add a button called play-pause saying "Play"
        add a button called next-song saying "Next"
    add a list called song-list
== styling
shared colour paper is #1d1830
shared colour ink is #f1ecff
shared colour muted is #a99fc7
shared colour accent is #ffb86b
shared colour card is #2a2344
shared colour line is #3d3460
style the page: font-family: system-ui, background the colour paper, text colour the colour ink, space around 0
style deck: at most 560 wide, centred, space inside 28 16, in a column, gap 16
style big headings: text size 28, space around 0
style now: background the colour card, border 1 the colour line, rounded corners 16, space inside 18
style now-title: text size 22, bold, space around 0
style now-mood: text colour the colour muted, space around 4 0 0
style controls: in a row, gap 10, flex-wrap: wrap
create group big-button: font: inherit, bold, min-height: 48px, space inside 0 22, rounded corners 999, no border, background the colour accent, text colour #1d1830, hand cursor
play-pause belongs to group big-button
next-song belongs to group big-button
style song-list: space inside 0, list-style: none, in a column, gap 6
style list items: background the colour card, rounded corners 10, space inside 10 14, text colour the colour muted`,

`component: playlist-songs
name: Songs and playing them
depth: walk
summary: Each song is a record: its audio file, a title and a mood. The list starts empty, so the page says so: add a line for each song in Mechanics (the files go next to the page when it's published; the preview can't reach files next to the page). One audio player plays the queue in order and moves on when a song ends. If a file can't be found, the page says so instead of going quiet.
learn: Audio from Mechanics (new Audio(), play, pause, ended); promises that can fail (catch); a queue and a position in it.
== mechanics
note: Your songs. Add a line for each, like: add { "file": "rain.mp3", "title": "Rain", "mood": "calm" } to songs
create list songs
note: The queue: what plays, in order. At first it's the song list itself.
set queue to songs
set place to 0
set player to new Audio()

define showSongs
    clear song-list
    for each song in songs
        add "{song.title} · {song.mood}" to the list song-list
    if length of songs is 0
        set the text of now-title to "No songs yet"
        set the text of now-mood to "Add a line for each song in Mechanics."
    otherwise if not player.src
        set the text of now-title to "Ready to play"
        set the text of now-mood to "{length of songs} songs"

define startPlaying
    note: Playing can fail (a missing file, say). onerror explains; catch sets the failed attempt aside.
    set attempt to player.play()
    run attempt.catch with () => nothing
    set the text of play-pause to "Pause"

define playAt using n
    if length of queue is 0
        set the text of now-title to "Nothing to play"
        give back
    set place to n mod length of queue
    set song to item place of queue
    set player.src to song.file
    set the text of now-title to song.title
    set the text of now-mood to song.mood
    run startPlaying

when play-pause is clicked
    if length of queue is 0
        set the text of now-title to "Nothing to play"
    otherwise if not player.src
        run playAt with 0
    otherwise if player.paused
        run startPlaying
    otherwise
        run player.pause
        set the text of play-pause to "Play"

when next-song is clicked
    run playAt with place plus 1

set player.onended to () => playAt(place plus 1)
set player.onerror to () => showProblem()

define showProblem
    set the text of now-mood to "Can't play this file. Is it next to the page? The preview can't reach files there: open the published page."
    set the text of play-pause to "Play"

run showSongs`,

`component: playlist-device
name: Songs from this device
depth: walk
summary: A file picker for audio on this computer or phone, so the player works in the preview with no files next to the page. Each picked file is played from where it is (an object URL points at it) and never uploaded, and gets the mood chosen beside the picker. The honest limit: picked files are forgotten when the page closes, because a page can't keep a file without asking again.
learn: File pickers that take several files (multiple); object URLs; a file's name, tidied with replace.
== structure
add a section called add-songs
    add a heading "Add songs from this device"
    add a paragraph "They play from where they are and aren't uploaded anywhere." in group hint
    add a label "Mood for these songs" for new-mood
    add a drop-down called new-mood with "calm", "happy", "focus", "energetic"
    note: There's no sentence for a file picker yet, so this line is HTML.
    html: <input type="file" id="song-files" accept="audio/*" multiple>
== styling
style add-songs: at most 560 wide, centred, space inside 0 16 28, in a column, gap 8
create group hint: text colour the colour muted, space around 0
style new-mood: font: inherit, space inside 8, rounded corners 8, border 1 the colour line, background the colour card, text colour the colour ink, align-self: flex-start
== mechanics
set songPicker to document.getElementById("song-files")

define addPicked
    for each file in songPicker.files
        add { "file": window.URL.createObjectURL(file), "title": file.name.replace(/\\.[^.]+$/, ""), "mood": the text of new-mood } to songs
    run showSongs

set songPicker.onchange to () => addPicked()`,

`component: playlist-moods
name: Playing a mood
depth: hallway
summary: The point of the player: choose a mood and the queue becomes only the songs tagged with it, starting from the first. "every mood" plays them all. The drop-down and the loop are here; you write the test each song must pass to join the queue. A mood with no songs yet says so instead of playing silence.
learn: Filtering a list with a condition; or, to combine two tests; replacing the queue.
blank: ‹the song fits the chosen mood› | a test (true or false) | \`mood\` is the mood chosen in the drop-down, and \`song.mood\` is this song's. A song fits when the two are the same, or when \`mood\` is "every mood"; \`or\` joins two tests. | mood is "every mood" or song.mood is mood
== structure
add a block called mood-picker
    add a label "Play a mood" for mood-choice
    add a drop-down called mood-choice with "every mood", "calm", "happy", "focus", "energetic"
== styling
style mood-picker: at most 560 wide, centred, space inside 0 16 16, in a row, gap 10
style mood-choice: font: inherit, space inside 8, rounded corners 8, border 1 the colour line, background the colour card, text colour the colour ink
== mechanics
when mood-choice is changed
    get the text of mood-choice and store in mood
    create list matching
    for each song in songs
        if ‹the song fits the chosen mood›
            add song to matching
    set queue to matching
    if length of queue is 0
        run player.pause
        set the text of now-title to "No {mood} songs yet"
        set the text of now-mood to ""
    otherwise
        run playAt with 0`,

`component: playlist-shuffle
name: Shuffle
depth: walk
summary: Shuffle mixes the queue and starts from the top. A fair shuffle takes a random song out of the ones left, again and again, until none are left, so every order is equally likely. (Sorting by a random number, a common shortcut, isn't fair: some orders come up more than others.)
learn: Random whole numbers; splice, to take an item out of a list; why some shortcuts are biased.
== structure
add a button called shuffle saying "Shuffle"
== styling
style shuffle: display: block, font: inherit, min-height: 44px, space inside 0 20, rounded corners 999, border 1 the colour line, background transparent, text colour the colour ink, hand cursor, space around 0 auto 24
== mechanics
when shuffle is clicked
    set rest to queue.slice()
    create list mixed
    while length of rest is more than 0
        set last to length of rest minus 1
        set pick to random number from 0 to last
        add item pick of rest to mixed
        run rest.splice with pick, 1
    set queue to mixed
    run playAt with 0`,

`component: playlist-library
name: A real music library
depth: horizon
summary: A real player knows your music without a line of code per song: it reads each file's tags (title, artist, album, cover), remembers which folder they're in, and keeps your moods and play counts in a small database. Published as a site, the files go next to the page (and must be yours to share); as an app, it can read a music folder directly.
usual: Tags read with a library such as music-metadata; IndexedDB to remember the library; the File System Access API (in Chromium browsers) to reopen a folder; Howler.js for playback across browsers.
learn: Audio file formats and tags (ID3); IndexedDB; asking permission to read a folder.`,

// ---------------------------------------------------------------- Weather Now

`kit: weather-now
title: Weather Now
layout: website
shelf: tools
platform: phone
about: Type a town and see its weather now and for the next days, from Open-Meteo (free, with no key to sign up for), and get told what to wear: a coat, a light layer, an umbrella. Made for a phone, and it remembers your town.
steps: weather-page!, weather-now!, weather-wear*, weather-week*, weather-remember*, installable, weather-more`,

`component: weather-page
name: The page, phone first
depth: walk
summary: One column for a phone: a box for the town and a Show button, a status line that says what's happening, and today's weather in big type. The weather step fills it in. The form's button sends the form, so pressing Enter on a phone's keyboard works too.
learn: Forms on phones (Enter sends them); large type for the one number that matters.
== structure
page title is "Weather now"
add a main area called app
    add a big heading "Weather now"
    add a form called search
        add a text box called city-box with hint "Town or city, like Lisbon"
        add a button called go saying "Show"
    add a paragraph called status "Type a town or city."
    add a section called today
        add a paragraph called place-name ""
        add a paragraph called temperature ""
        add a paragraph called conditions ""
== styling
shared colour paper is #eef5fb
shared colour ink is #13283b
shared colour muted is #5a6f82
shared colour accent is #1c7ed6
shared colour card is #ffffff
shared colour line is #d3e3f1
style the page: font-family: system-ui, background the colour paper, text colour the colour ink, at most 480 wide, centred, space inside 20 16, line-height: 1.45
style big headings: text size 30, space around 0 0 12
style search: in a row, gap 8
style text boxes: flex: 1, font: inherit, text size 18, min-height: 50px, space inside 0 12, border 1 the colour line, rounded corners 12, background white, text colour the colour ink
style go: font: inherit, bold, text size 18, min-height: 50px, space inside 0 20, rounded corners 12, no border, background the colour accent, text colour white, hand cursor
style status: text colour the colour muted
style sections: background the colour card, border 1 the colour line, rounded corners 16, space inside 16, space around 0 0 14
style place-name: bold, text size 18, space around 0
style temperature: text size 64, bold, line-height: 1.1, space around 4 0, font-variant-numeric: tabular-nums
style conditions: text colour the colour muted, space around 0`,

`component: weather-now
name: The weather, from Open-Meteo
depth: walk
summary: Two requests: the geocoding API turns the town's name into a latitude and longitude, then the forecast API gives the weather there, as JSON. Weather comes as codes (61 is light rain), turned into words here. Open-Meteo is free for non-commercial use, with no key. The honest catch: some previews block requests to other sites, so if nothing arrives, open the page from a real web address (Putting it online).
learn: fetch and JSON; building an address with encodeURIComponent; waiting for one answer before asking the next (await); catch, for when the network fails.
== mechanics
note: What the weather codes mean (the WMO codes Open-Meteo uses), for the usual ones.
set codeWords to { "0": "Clear sky", "1": "Mainly clear", "2": "Partly cloudy", "3": "Overcast", "45": "Fog", "48": "Freezing fog", "51": "Light drizzle", "53": "Drizzle", "55": "Heavy drizzle", "61": "Light rain", "63": "Rain", "65": "Heavy rain", "71": "Light snow", "73": "Snow", "75": "Heavy snow", "80": "Showers", "81": "Heavy showers", "82": "Violent showers", "95": "Thunderstorm" }
note: Tools other steps add: each is run with the forecast once it arrives.
create list extras

define describe using code
    set words to item code of codeWords
    if words is nothing
        give back "Weather code {code}"
    give back words

define lookUp using city
    set the text of status to "Looking up {city}…"
    fetch from "https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name={encodeURIComponent(city)}" and store in found
    if found.results is nothing
        set the text of status to "Couldn't find {city}. Check the spelling, or try a bigger town nearby."
        give back
    set place to first item of found.results
    fetch from "https://api.open-meteo.com/v1/forecast?latitude={place.latitude}&longitude={place.longitude}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto" and store in forecast
    set current to forecast.current
    set the text of place-name to "{place.name}, {place.country}"
    set the text of temperature to "{Math.round(current.temperature_2m)}°C"
    set the text of conditions to "{describe(current.weather_code)} · feels like {Math.round(current.apparent_temperature)}°C · wind {Math.round(current.wind_speed_10m)} km/h"
    set the text of status to ""
    for each extra in extras
        run extra with forecast

define showOffline
    set the text of status to "Couldn't reach the weather service. Check the connection; some previews block other sites, so try the page from its web address."

when search is sent
    get the text of city-box and store in city
    if city is empty text
        set the text of status to "Type a town or city."
    otherwise
        set attempt to lookUp(city)
        run attempt.catch with () => showOffline()`,

`component: weather-wear
name: What to wear
depth: hallway
summary: The twist: the forecast turned into advice. It goes by the "feels like" temperature, which counts the chill of wind and damp, then adds an umbrella if rain is likely and something windproof if it's gusty. The layers are written; you write when it counts as cold and when rain counts as likely. Change the advice to suit you: everyone feels the cold differently.
learn: if, otherwise if and otherwise, checked top to bottom; building a sentence from a list (join).
blank: ‹it feels cold› | a test (true or false) | \`feels\` is the "feels like" temperature, in °C. Compare it with a temperature colder than the 12 °C the next line uses for a jacket; about 5 °C is where a coat starts for most people. | feels is less than 5
blank: ‹rain is likely today› | a test (true or false) | \`rainChance\` is the day's highest chance of rain, as a percentage from 0 to 100. Check that it's at least the chance where you'd take an umbrella, such as an even chance. | rainChance is at least 50
== structure
add a section called wear
    add a heading "What to wear"
    add a paragraph called wear-advice ""
== styling
style wear: border-left: 6px solid var(--accent)
style wear-advice: text size 18, space around 6 0 0
== mechanics
define adviseClothes using forecast
    set feels to forecast.current.apparent_temperature
    set rainChance to first item of forecast.daily.precipitation_probability_max
    set wind to forecast.current.wind_speed_10m
    create list advice
    note: 1. Layers, by how warm it feels.
    if ‹it feels cold›
        add "a warm coat, a hat and gloves" to advice
    otherwise if feels is less than 12
        add "a jacket or a jumper" to advice
    otherwise if feels is less than 20
        add "a light layer you can take off" to advice
    otherwise
        add "something light, it's warm" to advice
    note: 2. Rain and wind.
    if ‹rain is likely today›
        add "an umbrella or a waterproof" to advice
    if wind is at least 40
        add "something windproof (and maybe not an umbrella)" to advice
    set joined to advice.join("; ")
    set the text of wear-advice to "Today: {joined}."

add adviseClothes to extras`,

`component: weather-week
name: The next days
depth: walk
summary: The forecast for the coming week, a line a day: the day's name, the weather in words and the lowest and highest temperatures. The days arrive as dates like 2026-10-01; each is read at midday, local time, before its name is taken, because a date alone counts as midnight UTC, which west of London is still the day before.
learn: Lists that line up by position (time, codes, temperatures); dates and toLocaleDateString; time zones.
== structure
add a section called week
    add a heading "The next days"
    add a list called days
== styling
style days: list-style: none, space inside 0, space around 8 0 0, in a column, gap 6
style list items: font-variant-numeric: tabular-nums
== mechanics
define showWeek using forecast
    clear days
    set daily to forecast.daily
    repeat length of daily.time times counting with d
        set day to new Date(item d of daily.time plus "T12:00").toLocaleDateString(undefined, { "weekday": "long" })
        add "{day}: {describe(item d of daily.weather_code)}, {Math.round(item d of daily.temperature_2m_min)}° to {Math.round(item d of daily.temperature_2m_max)}°" to the list days

add showWeek to extras`,

`component: weather-remember
name: Remembering your town
depth: walk
summary: The town you last looked up is kept in the browser, and its weather is fetched as soon as the page opens, so on a phone it's one tap from the home screen to today's weather. It listens to the same form as the weather step, and keeps only what was typed, never where you are.
learn: Saving a setting; doing something when the page has loaded; two listeners on one form.
== mechanics
load "city" from the browser and store in lastCity

when search is sent
    get the text of city-box and store in typed
    if typed is not empty text
        save typed in the browser as "city"

when the page has loaded
    if lastCity is not nothing
        set the text of city-box to lastCity
        set attempt to lookUp(lastCity)
        run attempt.catch with () => showOffline()`,

`component: weather-more
name: Hourly charts, maps and warnings
depth: horizon
summary: Weather apps go further: an hour-by-hour chart for today, rain radar on a map, "use my location", and warnings when storms are on the way. Each is more data from the same kind of service, drawn well, and a public app should keep copies of answers for a few minutes (a cache) rather than asking again on every visit.
usual: Open-Meteo's hourly data; Chart.js for charts; Leaflet with a radar layer (RainViewer) for maps; the Geolocation API for "use my location"; national weather services for official warnings.
learn: Drawing charts; maps and tiles; asking permission for location; caching, and each API's terms of use.`,

// ---------------------------------------------------------------- Download Sorter

`kit: download-sorter
title: Download Sorter
layout: structured
shelf: tools
platform: pc
about: A tidy Downloads folder: pictures into Images, PDFs into Documents, installers into Installers. It always shows what it would do first and moves nothing until you say yes, and it writes every move to a log, so a sort can be undone. Plain Python: nothing to install.
steps: sorter-settings!, sorter-plan!, sorter-move*, sorter-undo*, sorter-watch, package`,

`component: sorter-settings
name: What goes where
depth: walk
summary: The settings: the folder to sort (your Downloads folder, found from your home folder, so it works on Windows, macOS and Linux), which subfolder each kind of file goes in, by the ending of its name, and the name of the log. To sort another folder, or to add a kind, change a line here: nothing else needs to know.
learn: Paths with pathlib (Path.home(), and / to join parts); dictionaries as lookup tables; file extensions.
== settings
python: from pathlib import Path
note: The folder to sort. Put another path here to sort that instead.
set folder to Path.home() / "Downloads"
note: Which subfolder each kind of file goes in, by the ending of its name. Add your own.
set kinds to {".jpg": "Images", ".jpeg": "Images", ".png": "Images", ".gif": "Images", ".webp": "Images", ".pdf": "Documents", ".docx": "Documents", ".txt": "Documents", ".xlsx": "Spreadsheets", ".csv": "Spreadsheets", ".mp3": "Music", ".wav": "Music", ".mp4": "Videos", ".mov": "Videos", ".zip": "Archives", ".exe": "Installers", ".msi": "Installers", ".dmg": "Installers"}
note: Every move is written here, inside the sorted folder, so it can be undone.
set log name to "sorted-log.csv"`,

`component: sorter-plan
name: The plan (a dry run)
depth: walk
summary: Before anything moves, the sorter works out a plan: every file in the folder and the subfolder it would go to, shown as a list with a count for each kind. Nothing is touched. This is a dry run, and every tool that moves or deletes files should have one. Subfolders, hidden files, the log and downloads still in progress (.crdownload, .part) are left alone.
learn: Listing a folder (iterdir); a file's name and ending (name, suffix); lists of pairs; dry runs.
== tools
define pick subfolder using path
    description: The subfolder a file belongs in, from the ending of its name, or Other.
    set ending to path.suffix in lowercase
    give back kinds.get(ending, "Other")

define plan moves
    description: Every file in the folder, with the subfolder it would go to, as pairs. Nothing is moved.
    create list moves
    for each path in sorted(folder.iterdir())
        note: Only finished files: subfolders, hidden files, the log and downloads in progress stay put.
        if not path.is_file() or path.name.startswith(".") or path.name == log name
            skip to next
        if path.suffix in [".crdownload", ".part", ".tmp"]
            skip to next
        run pick subfolder with path and store in kind
        add (path, kind) to moves
    give back moves
== main
if not folder.is_dir()
    show "There's no folder at {folder}. Change the folder in Settings."
    stop the program
run plan moves and store in moves
if not moves
    show "Nothing to sort in {folder}."
otherwise
    show "{folder}: {length of moves} files to sort. Nothing has moved yet; this is the plan:"
    for each path, kind in moves
        show "  {path.name}  →  {kind}"
    create dictionary counts
    for each path, kind in moves
        set item kind of counts to counts.get(kind, 0) + 1
    for each kind, count in counts.items()
        show "  {count} into {kind}"`,

`component: sorter-move
name: Moving, with a log
depth: hallway
summary: The real thing, after you type yes. Each file moves into its subfolder (made if needed), and before it moves, the move is written to the log: where it was and where it went, one line each, in CSV that any spreadsheet opens. Two gotchas: a file with the same name may already be there (it gets a free name, like photo (2).jpg, never overwriting), and the log line must come first, so a crash can't lose a move. You write those two parts.
learn: shutil.move; CSV files (csv.writer); checking a path exists; why the log is written before the move.
blank: ‹the name is already taken› | a test (true or false) | \`candidate\` is a path, and a path's \`exists()\` tells you whether something is already there. | candidate.exists()
blank: ‹where it was and where it's going, as text› | a list | \`path\` is where the file is now and \`target\` is where it's going, and \`str()\` turns a path into text. Put the two in that order, with a comma between: undo reads them back the same way. | str(path), str(target)
== tools
python: import csv, shutil

define free name using target
    description: The target itself if nothing has that name yet, or photo (2).jpg, photo (3).jpg… until a name is free.
    set number to 2
    set candidate to target
    while ‹the name is already taken›
        set candidate to target.with_name("{target.stem} ({number}){target.suffix}")
        increase number
    give back candidate

define move files using moves
    description: Moves each file into its subfolder, logging each move first.
    set logfile to folder / log name
    using open(logfile, "a", newline="", encoding="utf-8") as f
        set writer to csv.writer(f)
        for each path, kind in moves
            set destination to folder / kind
            run destination.mkdir with exist_ok=True
            run free name with destination / path.name and store in target
            note: The log first, then the move.
            run writer.writerow with [‹where it was and where it's going, as text›]
            run f.flush
            run shutil.move with path, target
            show "Moved {path.name} → {kind}/{target.name}"
== main
if moves
    ask "Move these {length of moves} files? Type yes to go ahead: " and store in answer
    if answer.strip() in lowercase is "yes"
        run move files with moves
        show "Done. Every move is in {log name}, so it can be undone."
    otherwise
        show "Nothing moved."`,

`component: sorter-undo
name: Undo
depth: walk
summary: Undo reads the log and moves each file back, newest first (everything sorted since the last undo), then deletes the log. It's careful: a file is only put back if it's still where the sort left it and nothing new has taken its old place, so undoing can never overwrite anything. The subfolders the sort made are left, empty or not.
learn: Reading CSV (csv.reader); going through a list backwards (reversed); checking before changing anything.
== tools
python: import csv, shutil

define undo last sort
    description: Moves every file in the log back where it was, newest first, then deletes the log.
    set logfile to folder / log name
    using open(logfile, newline="", encoding="utf-8") as f
        set rows to list(csv.reader(f))
    for each source, target in reversed(rows)
        if Path(target).exists() and not Path(source).exists()
            run shutil.move with target, source
            show "Put back {Path(source).name}"
        otherwise
            show "Left {Path(target).name}: it has moved since, or something new is in its old place."
    run logfile.unlink
== main
if (folder / log name).exists()
    ask "Put back everything sorted since the last undo? Type undo to do it, or press Enter to keep it sorted: " and store in choice
    if choice.strip() in lowercase is "undo"
        run undo last sort
        show "Undone."`,

`component: sorter-watch
name: Sorting by itself
depth: horizon
summary: The next step is a sorter that runs without being asked: watching the folder and sorting each download as it finishes, or running every evening on a schedule. Waiting matters: a file still downloading must be left until it's complete, and moving things without asking makes the dry run and the log even more important.
usual: The watchdog package, for file system events; Task Scheduler on Windows, cron on Linux and launchd on macOS, for a schedule; a log file read in the morning.
learn: File system events; running a program on a schedule; telling a finished download from one in progress.`,

// ---------------------------------------------------------------- Message Wall

`kit: message-wall
title: Message Wall
layout: structured
shelf: social
platform: web
about: A wall of short messages anyone with the address can read and add to, like notes on a noticeboard. A small Python web server (Flask) keeps them in a database and serves the page, which checks for new messages every few seconds. The twist: messages fade as they age and are gone after a day.
steps: wall-store!, wall-server!, wall-fade*, wall-flood*, wall-live, wall-moderation, hosting`,

`component: wall-store
name: The messages and the database
depth: walk
summary: The wall's memory: an SQLite database (one file, no setup) with a messages table, and the tools that add a message and read the latest. Each message keeps the time it was posted, and the reading tool works out its age, which the fade step uses. Checks turn away empty and overlong messages. Two lists, message filters and post checks, let later steps add rules without changing this one.
learn: SQLite tables and ? placeholders (never paste text into SQL); time.time(), seconds since 1970; tools kept in lists.
== settings
note: The database file, next to the program. Delete it to start again.
set database file to "wall.db"
note: The longest message, in characters: a wall is for short notes.
set longest message to 280
== tools
python: import sqlite3, time

define open database
    description: Opens the database file (SQLite makes it the first time), with rows that work like dictionaries.
    set db to sqlite3.connect(database file)
    set db.row_factory to sqlite3.Row
    give back db

define set up database
    description: Makes the messages table, if it isn't there yet.
    run open database and store in db
    using db
        run db.execute with "CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, name TEXT NOT NULL, text TEXT NOT NULL, created REAL NOT NULL)"

define add message using name, text
    description: Saves one message, with the time it was posted.
    run open database and store in db
    using db
        run db.execute with "INSERT INTO messages (name, text, created) VALUES (?, ?, ?)", (name, text, time.time())

define latest messages
    description: The latest 100 messages, newest first, each with its age in seconds.
    run open database and store in db
    set rows to db.execute("SELECT id, name, text, created FROM messages ORDER BY id DESC LIMIT 100").fetchall()
    set now to time.time()
    give back [dict(row, age=now - row["created"]) for row in rows]

define check message using name, text
    description: What's wrong with a message, or nothing if it's fine.
    if not isinstance(text, str) or not text.strip()
        give back "A message can't be empty."
    if length of text is more than longest message
        give back "A message can be at most {longest message} characters."
    if not isinstance(name, str) or length of name is more than 40
        give back "A name can be at most 40 characters."
    give back nothing

note: Rules other steps add. A message filter gets the messages and gives back the ones to show; a post check gets the name, the text and the sender's address, and gives back a problem, or nothing.
create list message filters
create list post checks
== main
run set up database
run latest messages and store in messages
show "The wall is ready: {length of messages} messages in {database file}."`,

`component: wall-server
name: The server and the page
depth: walk
summary: Flask answers three addresses: / sends the page, GET /api/messages the messages as JSON, and POST /api/messages adds one after the checks. The page asks for new messages every 3 seconds: simple, and fine for a small wall. A Python program has no Structure, Styling or Mechanics folders, so the page is one piece of text. Install Flask once ($ pip install flask), press Run and open http://127.0.0.1:5000.
learn: Routes, GET and POST; JSON both ways; polling (asking again and again); textContent, so a message can't turn into HTML on someone else's screen.
== tools
python: from flask import Flask, jsonify, request
note: The web server. Each "when app gets …" below is a route: an address it answers.
set app to Flask(__name__)

note: The page people see. There's no sentence for a whole web page inside a Python program, so it's written directly (python: lines).
python: PAGE = """<!doctype html>
python: <html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
python: <title>Message wall</title>
python: <style>
python: body { font-family: system-ui; background: #fff7ec; color: #2b2118; max-width: 560px; margin: 0 auto; padding: 24px 16px; }
python: form { display: flex; flex-direction: column; gap: 8px; }
python: input, textarea { font: inherit; padding: 10px; border: 1px solid #ead9c3; border-radius: 10px; }
python: button { font: inherit; font-weight: bold; padding: 12px; border: 0; border-radius: 999px; background: #e8590c; color: white; cursor: pointer; }
python: .note { background: #fff3a8; padding: 12px 14px; margin: 12px 0; border-radius: 4px; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12); transition: opacity 1s; overflow-wrap: anywhere; }
python: .note small { display: block; color: #7a6a5c; margin-top: 6px; }
python: </style></head><body>
python: <h1>Message wall</h1>
python: <form id="post"><input id="name" placeholder="Your name" maxlength="40"><textarea id="text" placeholder="Say something (up to 280 characters)" maxlength="280"></textarea><button>Post</button><p id="say"></p></form>
python: <div id="wall"></div>
python: <script>
python: const wall = document.getElementById("wall"), say = document.getElementById("say"), nameBox = document.getElementById("name");
python: nameBox.value = localStorage.getItem("wall-name") || "";
python: function ago(s) { if (s < 60) return "just now"; if (s < 3600) return Math.floor(s / 60) + " min ago"; return Math.floor(s / 3600) + " h ago"; }
python: async function refresh() {
python:   try {
python:     const messages = await (await fetch("/api/messages")).json();
python:     wall.replaceChildren(...messages.map(m => {
python:       const note = document.createElement("div"), by = document.createElement("small");
python:       note.className = "note";
python:       note.textContent = m.text;
python:       by.textContent = m.name + " · " + ago(m.age);
python:       note.append(by);
python:       if (m.fade !== undefined) note.style.opacity = m.fade;
python:       return note;
python:     }));
python:   } catch (e) { say.textContent = "Can't reach the wall right now."; }
python: }
python: document.getElementById("post").addEventListener("submit", async (e) => {
python:   e.preventDefault();
python:   localStorage.setItem("wall-name", nameBox.value);
python:   const reply = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nameBox.value, text: document.getElementById("text").value }) });
python:   const answer = await reply.json();
python:   if (!reply.ok) { say.textContent = answer.error; return; }
python:   document.getElementById("text").value = "";
python:   say.textContent = "Posted.";
python:   refresh();
python: });
python: refresh();
python: setInterval(refresh, 3000);
python: </script></body></html>"""

when app gets GET at "/"
define front page
    description: The wall itself, for browsers.
    give back PAGE

when app gets GET at "/api/messages"
define list messages
    description: The messages to show, as JSON, after every filter other steps added.
    run latest messages and store in messages
    for each keep in message filters
        set messages to keep(messages)
    give back jsonify(messages)

when app gets POST at "/api/messages"
define post message
    description: Adds a message sent as JSON, like {"name": "Sam", "text": "Hello"}, if it passes every check.
    set data to request.get_json(silent=True) or {}
    set name to data.get("name") or "Someone"
    set text to data.get("text")
    run check message with name, text and store in problem
    for each test in post checks
        if not problem
            set problem to test(name, text, request.remote_addr)
    if problem
        give back jsonify(error=problem), 400
    run add message with name.strip() or "Someone", text.strip()
    give back jsonify(ok=True), 201
== main
note: Start the server last: it keeps running, answering requests, until you press Stop.
if this file is run directly
    show "The wall is at http://127.0.0.1:5000"
    run app.run with port=5000`,

`component: wall-fade
name: Fading after a day
depth: hallway
summary: The twist: nothing on this wall lasts. A message is shown at full strength when new and fades as its day runs out (the page sets its opacity, from 1 down to 0.2), then it's gone, from the page and from the database. It's a message filter, so the server step needs no change. You write which messages stay and how faded each one is.
learn: Ages and time limits in seconds; scaling a number to the range 0 to 1; max, to set a floor; deleting rows with SQL.
blank: ‹the message is younger than a day› | a test (true or false) | \`message["age"]\` is how old the message is, in seconds, and \`one day\` is a day in seconds. Compare the two. | message["age"] is less than one day
blank: ‹the share of its day still left› | a calculation | \`message["age"]\` divided by \`one day\` is the share of its day gone: 0 when it's new, 1 when it's a day old. What's left is 1 minus that. | 1 minus message["age"] divided by one day
== settings
note: How long a message stays, in seconds: one day.
set one day to 24 * 60 * 60
== tools
define fade old messages using messages
    description: Keeps the messages younger than a day, each with how faded it is: 1 when new, never below 0.2.
    run forget old messages
    create list kept
    for each message in messages
        note: 1. Only messages younger than a day stay.
        if ‹the message is younger than a day›
            note: 2. How much of its day is left, from 1 down to 0, with a floor of 0.2 so it stays readable.
            set item "fade" of message to max(0.2, ‹the share of its day still left›)
            add message to kept
    give back kept

define forget old messages
    description: Deletes messages older than a day from the database.
    run open database and store in db
    using db
        run db.execute with "DELETE FROM messages WHERE created < ?", (time.time() - one day,)

add fade old messages to message filters`,

`component: wall-flood
name: Slowing down floods
depth: walk
summary: Anything open to the internet gets flooded sooner or later, by a script or by someone holding Enter. This check asks each address (the sender's IP address) to wait 10 seconds between messages. It's a post check, so the server step runs it without changing. The times are kept only while the server runs, which is enough for this: a restart forgets them.
learn: Rate limiting; IP addresses (request.remote_addr); a dictionary as a short-term memory.
== settings
note: How long someone waits between messages, in seconds.
set wait between posts to 10
== tools
note: When each address last posted, while the server runs.
create dictionary last post

define slow down using name, text, address
    description: Asks someone to wait if they posted from the same address a moment ago.
    set now to time.time()
    set before to last post.get(address, 0)
    if now - before is less than wait between posts
        give back "Slow down: one message every {wait between posts} seconds."
    set item address of last post to now
    give back nothing

add slow down to post checks`,

`component: wall-live
name: Instant updates
depth: horizon
summary: Asking every 3 seconds is simple, but each visitor's page asks even when nothing is new, and a message can take 3 seconds to appear. Live apps keep a connection open instead, so the server sends each message the moment it arrives, to everyone at once.
usual: Server-Sent Events (EventSource in the page, a streaming route in Flask); WebSockets with Flask-SocketIO; hosted services such as Pusher or Ably.
learn: Long-lived connections; why polling costs more as more people join; reconnecting after a dropped connection.`,

`component: wall-moderation
name: Keeping the wall kind
depth: horizon
summary: A wall anyone can post on will get unkind posts and spam. The page already shows text safely (as text, never as HTML) and slows floods; a public wall also needs a way to report a message, someone to review reports, and perhaps a check before anything shows. Depending on the country, running one can bring legal duties too.
usual: A report button and an admin page (the Online service kit has one); word lists; moderation APIs such as Google's Perspective; sign-in, so people stand behind what they post.
learn: Cross-site scripting (XSS) and escaping; privacy and what you store about people; designing for misuse.`,
);
