/* IntuCode — the project builder.
 *
 * Questions narrow a project down (App › PC › Audio workstation…). At the end there is a kit: the
 * components that kind of project is usually made of, in the order you'd build them. You tick the
 * ones you want, and they are put together into a project, with a project map: ordered steps, each
 * with a plain-language name, a summary of its role in the whole, and an honest depth:
 *
 *   walk      you can write it in sentences now, and run it
 *   hallway   the structure is laid out and the key parts are named; you fill in the ‹blanks›
 *   horizon   explained and pointed at: what it is, what's usually used for it, what to learn first
 *
 * Everything is plain text, like blueprints, so anyone can edit the library or add to it:
 *
 *   question: app                          a question; the first one is "start"
 *   ask: Where will it run?
 *   option: PC | Windows, macOS or Linux | pc                    label | what it means | next question
 *   option: Phone | iPhone or Android | kit phone                …or the kit it leads to
 *   option: Portfolio | Show your work | kit webpage: hero, gallery   …with its own ticked steps
 *
 *   kit: daw                               the components for one kind of project
 *   title: Audio workstation (DAW)
 *   layout: structured                     script | structured | website | arduino
 *   shelf: games                           its kind: where it sits in the Library and in the questions (see SHELVES)
 *   platform: phone                        where it runs: pc, phone, web or board (from the layout if left out)
 *   asks: webpage                          optional: a question of its own, asked before its steps
 *   module: Snake                          optional: kits that are versions of one module are offered together
 *   version: Website · annotated            …each as one version of it
 *   annotated: yes                         its steps' teach: lines become notes (otherwise they're left out)
 *   about: One line shown above the list.
 *   steps: sound!, fader*, eq*, mixer, monitoring      in build order; ! always in, * ticked at first
 *
 *   component: fader                       one part of a project
 *   name: Fader module
 *   depth: walk                            walk | hallway | horizon
 *   summary: Its role in the whole project, in plain words.
 *   usual: What people usually use for it (mostly for horizon steps).
 *   learn: What to learn first.
 *   == tools                               sentences for a folder: settings, tools, main (Python),
 *   teach: what this adds, and why         (in sentences: a note, but only in annotated kits)
 *   define apply fader using samples, …    structure, styling, mechanics (website), or settings,
 *                                          start, loop (Arduino: they go around "when the board
 *                                          starts" and "over and over")
 */
(function () {
  'use strict';

  const DEPTHS = {
    walk: { label: 'Walk', means: 'You can write it in sentences now, and run it.' },
    hallway: { label: 'Hallway', means: 'The structure is laid out and the key parts are named: you fill in the ‹blanks›, with the notes to guide you.' },
    horizon: { label: 'Horizon', means: 'Explained and pointed at: what it is, what\'s usually used for it, and what to learn first. Not something to write in sentences yet.' },
  };

  /* The Library's shelves, by kind of project. The builder's questions are made from them: "What are you
   * making?" lists the shelves, and each shelf's question lists its kits, so a kit (yours too) appears in
   * planning as soon as it says which shelf it sits on. Kits and blueprints also say where they run. */
  const SHELVES = [
    { id: 'modules', title: 'Learning modules', ask: 'Which module?', about: 'Classic games built step by step, in order: Snake, then Invaders, then a night sky, then a side-scrolling platformer. The annotated versions say what each part adds, and why.' },
    { id: 'games', title: 'Games', ask: 'Which game?', about: 'Things to play: platformers, top-down adventures, puzzles, word games, one-thumb phone games.' },
    { id: 'productivity', title: 'Productivity', ask: 'Which kind of productivity app?', about: 'To-dos, notes, planners and timers: tools for getting things done.' },
    { id: 'money', title: 'Money', ask: 'Which money app?', about: 'Budgets, shared bills and subscriptions.' },
    { id: 'health', title: 'Health & habits', ask: 'Which health or habit app?', about: 'Habits, workouts, breathing and water.' },
    { id: 'learning', title: 'Learning', ask: 'What should it teach?', about: 'Flashcards, typing, quizzes: practice that adapts.' },
    { id: 'creative', title: 'Creative & media', ask: 'Which creative app?', about: 'Drawing, music, sound and photos.' },
    { id: 'social', title: 'Social & sharing', ask: 'Which social app?', about: 'Message walls, link pages: things people share.' },
    { id: 'tools', title: 'Tools & utilities', ask: 'Which tool?', about: 'Weather, passwords, converters, files: small things that save time.' },
    { id: 'web', title: 'Websites', ask: 'Which kind of website?', about: 'Pages people visit in a browser.' },
    { id: 'service', title: 'Online services', ask: 'Which online service?', about: 'Something people sign up for and use online: a server, data, accounts.' },
    { id: 'gadget', title: 'Gadgets', ask: 'Which gadget?', about: 'Devices on a board like an Arduino or an ESP32: lights, buttons, sensors, sound.' },
    { id: 'lessons', title: 'One idea at a time', about: 'Small programs that each show one way of thinking: lists, classes.' },
    { id: 'start', title: 'Starting points', about: 'Empty projects, laid out and ready for your own sentences.' },
  ].map(sh => ({ ...sh, path: sh.ask ? [sh.title] : null }));
  /* Where a project runs. */
  const PLATFORMS = { pc: 'PC', phone: 'Phone', web: 'Web', board: 'Board' };

  const CORE = [
`question: webpage
ask: What is the site for?
option: Showing my work | A portfolio: pictures of what you make, a little about you, and a way to get in touch | kit webpage: header, hero, about, gallery, contact, footer, mobile, publish
option: A business or a club | Who you are, what you offer, how people reach you, and how they find you | kit webpage: header, hero, about, gallery, contact, footer, mobile, publish, analytics, seo
option: Just me | A simple personal page: a welcome, a few words and a way to reach you | kit webpage: hero, about, contact, footer, mobile, theme, publish
option: Something else | Start from the usual parts and choose | kit webpage`,

// ---------------------------------------------------------------- Audio workstation (DAW)

`kit: daw
title: Audio workstation (DAW)
layout: structured
shelf: creative
platform: pc
about: A small sound studio in Python: make or load a sound, shape it with faders and EQ, meter it, mix tracks and play the result. The parts a big DAW builds in real time are here as horizon steps.
steps: sound!, fader*, eq*, mixer, meters*, transport!, monitoring, recording, plugins, timeline`,

`component: sound
name: Sound in and out
depth: walk
summary: Every audio program starts here. A sound, to a computer, is a long list of numbers (samples), each saying where the speaker should be at that moment, 44,100 of them a second. This step makes a test tone (or reads a WAV file you put next to the program) and can save samples back to a WAV file any player can open. Every other step works on that same list.
learn: What a sample and a sample rate are; lists; reading and writing files.
== settings
note: How many samples make one second of sound (CD quality).
set sample rate to 44100
== tools
define sine tone using frequency, seconds
    description: A test sound to work with: a sine wave, as samples between -1 and 1.
    python: import math
    python: count = int(sample_rate * seconds)
    python: return [0.5 * math.sin(2 * math.pi * frequency * n / sample_rate) for n in range(count)]

define load sound using path
    description: Reads a 16-bit mono WAV file into samples between -1 and 1.
    python: import array, wave
    using wave.open(path, "rb") as f
        python: pcm = array.array("h", f.readframes(f.getnframes()))
    python: return [s / 32768 for s in pcm]

define save sound using samples, path
    description: Writes samples (-1 to 1) to a 16-bit mono WAV file.
    python: import array, wave
    python: pcm = array.array("h", [int(max(-1.0, min(1.0, s)) * 32767) for s in samples])
    using wave.open(path, "wb") as f
        run f.setnchannels with 1
        run f.setsampwidth with 2
        run f.setframerate with sample rate
        run f.writeframes with pcm.tobytes()
== main
note: Start from input.wav if there is one (16-bit mono), or make a two-second test tone.
python: import os
if os.path.exists("input.wav")
    run load sound with "input.wav" and store in sound
otherwise
    run sine tone with 440, 2 and store in sound`,

`component: fader
name: Fader module
depth: walk
summary: A fader sets how loud a sound is: it multiplies every sample by the same number (the gain). DAWs measure it in decibels because that's how we hear: -6 dB is about half as loud, +6 about twice. Each track, and the final mix, has one.
learn: Multiplying a list of numbers; decibels (dB = 20 × log10 of the gain).
== settings
note: The fader's position, in decibels: 0 leaves the sound as it is.
set fader decibels to -6
== tools
define apply fader using samples, decibels
    description: Makes a sound louder or quieter by a number of decibels.
    python: gain = 10 ** (decibels / 20)
    create list faded
    for each s in samples
        add s * gain to faded
    give back faded
== main
run apply fader with sound, fader decibels and store in sound`,

`component: eq
name: EQ: shaping the tone
depth: hallway
summary: An EQ turns some frequencies up or down: here, a low-pass filter that keeps the low end and softens the highs. It's a "biquad", the building block of nearly every EQ: each output sample mixes the current input with the last two inputs and the last two outputs. Those five mixing numbers are its transfer function, H(z) = (b0 + b1·z⁻¹ + b2·z⁻²) / (a0 + a1·z⁻¹ + a2·z⁻²). The structure is here; you fill in the cutoff and two of the numbers.
usual: Real-time EQs run this same maths in C++, often with JUCE's dsp module; in Python, scipy.signal does it for whole arrays at once.
learn: What frequency and cutoff mean; the Audio EQ Cookbook by Robert Bristow-Johnson (the standard formulas for these filters); how a filter remembers past samples.
== settings
note: Frequencies above the cutoff get quieter. Try 1000 (Hz), then 300.
set cutoff to ‹a cutoff frequency in Hz, like 1000›
== tools
define low pass using samples, cutoff
    description: A two-pole low-pass filter (a biquad): lets low frequencies through, turns high ones down.
    python: import math
    note: 1. Where the corner is, as an angle (w0), and how soft it is (alpha, from a Q of 0.707).
    python: w0 = 2 * math.pi * cutoff / sample_rate
    python: alpha = math.sin(w0) / (2 * 0.707)
    note: 2. The transfer function's numbers, from the Audio EQ Cookbook. b: how much of the input goes in; a: how much of the past output feeds back.
    python: b0 = (1 - math.cos(w0)) / 2
    set b1 to ‹b1 is twice b0›
    python: b2 = b0
    python: a0 = 1 + alpha
    set a1 to ‹a1 is -2 times the cosine of w0: in Python, -2 * math.cos(w0)›
    python: a2 = 1 - alpha
    note: 3. The filter: each output mixes this input, the last two inputs and the last two outputs.
    python: x1 = x2 = y1 = y2 = 0.0
    create list filtered
    for each x in samples
        python: y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0
        python: x2, x1 = x1, x
        python: y2, y1 = y1, y
        add y to filtered
    give back filtered
== main
run low pass with sound, cutoff and store in sound`,

`component: mixer
name: Mixer: several tracks into one
depth: hallway
summary: A mixer adds tracks together, sample by sample, each through its own fader, into one sound: the heart of any DAW's mixing desk. Here the second track is the same tone an octave up. The structure is laid out; you write the line that adds each track's sample at its level.
learn: Loops inside loops; lists of lists; why tracks need the same length (shorter ones count as silence).
== tools
define mix tracks using tracks, levels
    description: Adds tracks together, each at its own level in decibels, into one sound.
    python: import math
    python: length = max(len(t) for t in tracks)
    python: gains = [10 ** (db / 20) for db in levels]
    create list mixed
    count i from 0 to length - 1
        set total to 0
        count t from 0 to len(tracks) - 1
            note: A shorter track has run out of samples here: it adds nothing (silence).
            if i is less than len(tracks[t])
                increase total by ‹this track's sample at position i, times its gain: tracks[t][i] * gains[t]›
        add total to mixed
    give back mixed
== main
note: A second track: the same tone an octave up, mixed in 12 dB quieter.
run sine tone with 880, len(sound) / sample rate and store in second
python: sound = mix_tracks([sound, second], [0, -12])`,

`component: meters
name: Level meters
depth: walk
summary: Meters show how loud a sound is, so you can mix with your eyes as well as your ears. The peak is the loudest single moment (keep it below 0 dB or it distorts); the RMS is the average power, closer to how loud we hear it.
learn: Absolute values, squares and square roots; decibels.
== tools
define measure level using samples
    description: Shows the peak and RMS level of a sound, in decibels.
    python: import math
    set peak to 0
    set power to 0
    for each s in samples
        if abs(s) is more than peak
            set peak to abs(s)
        increase power by s * s
    python: rms = math.sqrt(power / max(1, len(samples)))
    python: to_db = lambda v: 20 * math.log10(v) if v > 0 else -120.0
    python: print(f"Peak {to_db(peak):.1f} dB, RMS {to_db(rms):.1f} dB")
== main
run measure level with sound`,

`component: transport
name: Transport: save and play
depth: walk
summary: The transport is a DAW's play and stop buttons. Here it saves the finished sound as output.wav and plays it (straight away on Windows; elsewhere it tells you where the file is).
learn: Files and paths; how a program can do different things on different computers.
== tools
define play sound using path
    description: Plays a WAV file on Windows, or says where to find it elsewhere.
    python: import sys
    if sys.platform == "win32"
        python: import winsound
        run winsound.PlaySound with path, winsound.SND_FILENAME
    otherwise
        show "Open {path} in any player to listen."
== main
run save sound with sound, "output.wav"
show "Saved output.wav: {len(sound)} samples."
run play sound with "output.wav"`,

`component: monitoring
name: Live monitoring
depth: horizon
summary: Monitoring means hearing a sound through your effects as it happens: a microphone in, your EQ and faders, speakers out, with no noticeable delay. The program has to process small blocks of samples (a few milliseconds each) the moment the sound card asks for them, every time, without fail.
usual: PortAudio, through the sounddevice package in Python for experiments; C++ with JUCE for real products, because Python is often too slow to be on time every few milliseconds.
learn: Audio buffers and latency; callbacks (code the sound card calls); why real-time code must never wait for anything.`,

`component: recording
name: Recording
depth: horizon
summary: Recording captures sound from a microphone or an interface into samples, then into a file: the other direction of playback.
usual: sounddevice.rec in Python for simple recordings; a real-time input stream (PortAudio, JUCE) in a DAW.
learn: Input devices and channels; buffers; writing files while sound is still arriving.`,

`component: plugins
name: Plugins (VST3, AU)
depth: horizon
summary: Plugins are effects and instruments that load inside any DAW: your EQ could become one. A plugin is a small program the DAW calls for every block of audio, with its knobs saved in the DAW's project.
usual: C++ with JUCE, which makes VST3, AU and standalone versions from one project; Cycling '74's RNBO if you design in Max.
learn: C++ classes; real-time safety; how a plugin exposes its parameters to the DAW.`,

`component: timeline
name: Timeline and arrangement
depth: horizon
summary: The timeline is where clips sit on tracks over time, and where you cut, move and loop them: the part of a DAW you look at most.
usual: A window toolkit with fast drawing (Qt, JUCE, or a web canvas), and a data model of tracks and clips.
learn: Classes for tracks and clips; drawing on a canvas; turning a mouse position into a time.`,

// ---------------------------------------------------------------- Webpage

`kit: webpage
title: Webpage
layout: website
shelf: web
platform: web
asks: webpage
about: A one-page website, top to bottom: a header with a menu, a big welcome, a few words about you, a gallery, a contact form and a footer, arranged for phones as well as computers. Getting it online, counted and found are horizon steps.
steps: page!, header*, hero*, about*, gallery*, contact*, footer*, mobile*, theme, publish*, analytics, seo`,

`component: page
name: Page basics
depth: walk
summary: The foundation every other part sits on. A website has three layers: Structure (HTML: what's on the page), Styling (CSS: how it looks) and Mechanics (JavaScript: what it does). This step sets the page's title, which shows in the browser tab and in search results, a readable font, and a small palette of shared colours with names like "paper" and "accent". Every later step uses those names instead of colour codes, so changing one line here recolours the whole site.
learn: What HTML, CSS and JavaScript each do; the box model (space inside, a border, space around); colour codes like #c2410c.
== structure
note: The name in the browser tab: yours, or your project's.
page title is "Your Name"
== styling
note: The palette. Later steps use these names, so one change here recolours the whole site.
shared colour paper is #fbfaf7
shared colour ink is #1d1f23
shared colour muted is #5b616e
shared colour accent is #c2410c
shared colour card is #ffffff
shared colour line is #e4e1da
style the page: font-family: system-ui, background the colour paper, text colour the colour ink, space around 0, line-height: 1.6
style html: scroll-behavior: smooth
style sections: at most 960 wide, centred, space inside 64 24
style links: text colour the colour accent
style pictures: at most 100% wide, height auto
note: Links (and buttons) that look like buttons: put them in group button.
create group button: display: inline-block, font: inherit, background the colour accent, text colour the colour paper, space inside 12 24, rounded corners 999, no border, no underline, bold, hand cursor, smooth changes
when group button is hovered: filter: brightness(1.1)`,

`component: header
name: Header and menu
depth: walk
summary: The strip across the top: your name on the left and a menu on the right, staying in view as the page scrolls. Each menu link jumps to a part of the page by its name: "#about" finds the section called about. If you leave a part out of the kit, delete its link here too, or it will lead nowhere.
learn: Links and #names (anchors); lining things up in a row (flexbox); a header that stays in place (sticky).
== structure
add a header
    add a link to "#" saying "Your Name" in group brand
    add a navigation bar
        add a link to "#about" saying "About" in group menu-link
        add a link to "#work" saying "Work" in group menu-link
        add a link to "#contact" saying "Contact" in group menu-link
== styling
note: "header" and "navigation bar" style every one of their kind; this page has one of each.
style header: in a row, spread out, gap 16, space inside 14 24, background the colour paper, border-bottom: 1px solid var(--line), stays in place, z-index: 10
style navigation bar: in a row, gap 20
style group brand: bold, text size 20, text colour the colour ink, no underline
style group menu-link: text colour the colour ink, no underline
when group menu-link is hovered: text colour the colour accent`,

`component: hero
name: Welcome (the hero)
depth: walk
summary: The first thing visitors see, big and bold: who you are or what this is, in one sentence, and one clear thing to do next (here, a button to the contact form; without that step, point it somewhere else). Designers call it the hero. Keep it short: people decide in a few seconds whether to scroll on, and the one big heading on the page also tells search engines what the page is about.
learn: Headings (one big heading per page); a link styled to look like a button.
== structure
add a section called welcome
    add a big heading "Hello, I'm Your Name."
    add a paragraph "I make things. This is where I show them." in group lead
    add a link to "#contact" saying "Get in touch" in group button
== styling
style welcome: at least 60vh tall, in a column, align-items: flex-start, justify-content: center
style big headings: text size 52, line-height: 1.1, space around 0 0 16
create group lead: text size 20, text colour the colour muted, space around 0 0 28`,

`component: about
name: About
depth: walk
summary: A few honest sentences about you or the project: who, what, and what's in it for the visitor. Write it the way you'd say it to someone you just met. Search engines read this text too, so it's also a big part of how people find you.
learn: Headings and paragraphs; writing for the web (the important thing first, short paragraphs).
== structure
add a section called about
    add a heading "About"
    add a paragraph "Two or three sentences: who you are, what you do, and what someone gets from you."
    add a paragraph "A second paragraph for the story behind it, if there is one: how you started, or what you care about."
== styling
style about: text size 18`,

`component: gallery
name: Gallery
depth: walk
summary: A grid of your work, each picture in a card with a short caption: three across on a computer, one on a phone (with the phone step). Every picture has a description, its alt text, which screen readers read aloud to people who can't see it and which shows if the picture can't load. Put your pictures next to the page with these names (work-1.jpg and so on) or change the names to yours; pictures under about 300 KB keep the page quick.
learn: Pictures and alt text; CSS grids; making pictures smaller before they go online.
== structure
add a section called work
    add a heading "Work"
    add a block in group grid
        add a card
            add a picture of "work-1.jpg" described as "Describe what the first picture shows" in group photo
            add a paragraph "First piece: one line about it"
        add a card
            add a picture of "work-2.jpg" described as "Describe the second picture" in group photo
            add a paragraph "Second piece: one line about it"
        add a card
            add a picture of "work-3.jpg" described as "Describe the third picture" in group photo
            add a paragraph "Third piece: one line about it"
== styling
style group grid: in a grid of 3 columns, gap 24
style group card: background the colour card, border 1 the colour line, rounded corners 12, space inside 12, soft shadow
style group photo: width 100%, aspect-ratio: 4 / 3, object-fit: cover, rounded corners 8, background the colour line`,

`component: contact
name: Contact form
depth: hallway
summary: A form for visitors to write to you: their name, their email and a message. Here the page checks that nothing is missing and thanks the person by name. The form is built; you write the check that nothing is missing (the part every form needs) and put their name in the thank-you. The honest limit: a web page on its own can't deliver a message anywhere; that takes a computer that is always on. To receive the messages, connect the form to a form service, or to your own server (the Online service path builds one). Until then, the email link in the footer works with no server at all.
usual: Formspree, Netlify Forms or Basin: they give you an address to send the form to, and email you each message.
learn: Forms, labels and boxes; the "sent" event; why delivering a message needs a server.
== structure
add a section called contact
    add a heading "Contact"
    add a paragraph "Questions, commissions, or hello: write below."
    add a form called message-form
        add a label "Your name" for name-box
        add a text box called name-box with hint "Sam Smith"
        add a label "Your email" for email-box
        add an email box called email-box with hint "sam@example.com"
        add a label "Message" for message-box
        add a big text box called message-box with hint "Write your message"
        add a button called send saying "Send"
    add a paragraph called form-reply ""
== styling
style message-form: in a column, gap 8, at most 520 wide
style labels: bold, text size 14
style text boxes: font: inherit, space inside 10, border 1 the colour line, rounded corners 8, background the colour card, text colour the colour ink
send belongs to group button
style send: align-self: flex-start
== mechanics
note: A page alone can't deliver the message. Until the form is connected to a form service or a server (see this step's summary), nothing is sent anywhere.
when message-form is sent
    get the text of name-box and store in name
    get the text of email-box and store in email
    get the text of message-box and store in message
    if ‹any of the three is missing: name is empty text or email is empty text or …›
        set the text of form-reply to "Please fill in all three boxes."
    otherwise
        set the text of form-reply to "Thank you, {‹the name they typed›}! I'll reply to {email} soon."
        clear message-box`,

`component: footer
name: Footer
depth: walk
summary: The strip at the very bottom, where visitors look for who made this and how to reach them: a copyright line whose year updates itself, and an email link. An email link (mailto:) opens the visitor's own email app, so it works with no server at all.
learn: mailto: links; a first line of JavaScript that changes the page.
== structure
add a footer
    add a paragraph called copyright "© Your Name"
    add a link to "mailto:you@example.com" saying "Email me"
== styling
style footer: in a row, spread out, gap 16, space inside 24, border-top: 1px solid var(--line), text colour the colour muted, text size 14
== mechanics
note: The page fills in this year itself, so the footer never goes out of date.
set the text of copyright to "© {new Date().getFullYear()} Your Name"`,

`component: mobile
name: Phone-friendly layout
depth: walk
summary: Most visits to a small site come from phones. On narrow screens this step stacks the header, shrinks the big heading, turns the gallery into two pictures per row on tablets and one on phones, and tightens the spacing. It styles kinds of things (every section, every header, the group grid) rather than names, so it works with whichever parts you picked. Try it by making the preview narrow, then on your own phone.
learn: Media queries ("on screens narrower than 600:"); designing for small screens first; testing on a real phone.
== styling
on screens narrower than 900:
    style group grid: grid-template-columns: repeat(2, 1fr)
on screens narrower than 600:
    style group grid: grid-template-columns: 1fr
    style header: flex-direction: column, align-items: flex-start, gap 8
    style navigation bar: flex-wrap: wrap, gap 12
    style big headings: text size 36
    style sections: space inside 40 16
    style footer: flex-direction: column, align-items: flex-start, gap 4`,

`component: theme
name: Light and dark
depth: walk
summary: Phones and computers have a light or dark setting, and this step makes the page follow it. In dark mode the shared colours from Page basics get darker values, and because every part of the page uses those colours by name, the whole site changes at once, with no extra work in each step. Check that text stays easy to read in both.
learn: CSS variables (the shared colours); the dark-mode setting (prefers-color-scheme); colour contrast.
== styling
note: Lets the browser draw its own parts (boxes, scroll bars) dark too.
style html: color-scheme: light dark
note: The same colour names as Page basics, with dark values.
in dark mode:
    style the page: --paper: #16181d, --ink: #ebe8e3, --muted: #a5abb6, --accent: #fb923c, --card: #1f2228, --line: #2e323a`,

`component: publish
name: Putting it online
depth: horizon
summary: Right now the page lives on your computer. Publishing copies its files (index.html, style.css, script.js and any pictures) to a server that's always on, so anyone with the address can open it, on any phone or computer. For a page like this, with no server code of its own, hosting is free and takes minutes. A domain of your own (yourname.com) is optional and costs a little each year.
usual: GitHub Pages, Netlify or Cloudflare Pages (free for pages like this); a domain from a registrar such as Namecheap, Porkbun or Cloudflare.
learn: What hosting and a domain are; uploading files, or connecting a Git repository so every change goes online; HTTPS (the padlock), which these hosts switch on for you.`,

`component: analytics
name: Visitor numbers
depth: horizon
summary: Analytics count how many people visit, which pages they read and where they came from, so you can see what's working. Most tools are one line added to the page. The privacy-friendly ones count visits without following people around the web, which in many places also means no cookie banner.
usual: Plausible, GoatCounter, Fathom or Umami (simple and privacy-friendly); Cloudflare Web Analytics (free); Google Analytics (powerful, heavier, and needs consent in Europe).
learn: Page views and referrers (where visitors came from); privacy rules like the GDPR, in brief; adding a script to the page's head (a head: line in Structure).`,

`component: seo
name: Being found in search
depth: horizon
summary: Search engines send people to pages that say clearly what they're about. Much of that is already in this kit: a real page title, one big heading, honest text in About, and a description on every picture. The rest is a short summary for search results, a page that loads fast, and telling Google and Bing that the site exists. Nobody can promise a top place; being clear and useful is what works.
usual: Google Search Console and Bing Webmaster Tools (free, and they show what people searched to find you); a meta description; PageSpeed Insights to check speed.
learn: The title and description in search results; alt text; why speed and phones matter to search engines.`,

// ---------------------------------------------------------------- Terminal tool

`kit: terminal
title: Terminal tool
layout: structured
shelf: tools
platform: pc
about: A program you type into, and a good first project. It keeps a list of records, each a name and an amount (spending, reading, workouts…), saved in a file, with a menu of commands, careful checks on what's typed, and a report. Plain Python: nothing to install.
steps: records!, save-file!, typing-checks!, menu!, add-record*, list-records*, remove-record, report*, package`,

`component: records
name: Records: the list at the heart
depth: walk
summary: Everything this tool does is about one list: the records. Each record is a small dictionary holding a name and an amount, like {"name": "Coffee", "amount": 3.5}. Every other step reads or changes this same list: saving writes it to a file, adding puts a record on the end, the report adds the amounts up. Change what the amount means (pages, minutes, kilometres) and it's a different tool.
learn: Lists and dictionaries; why one shared list keeps a program simple.
== settings
note: The records, while the program runs: a list of small dictionaries.
create list records
== tools
define make record using name, amount
    description: One record: a small dictionary with a name and an amount.
    create dictionary record
    set item "name" of record to name
    set item "amount" of record to amount
    give back record`,

`component: save-file
name: Saving to a file
depth: walk
summary: A program forgets everything when it closes, unless it writes things down. This step keeps the records in records.json, next to the program: they're loaded when the tool starts and saved after every command, so nothing is lost even if the window is closed. JSON is plain text that almost every language can read; open the file in any text editor to see your records.
learn: Reading and writing files; JSON; checking that a file exists before reading it.
== settings
note: Where the records are kept, next to the program.
set data file to "records.json"
== tools
define save records
    description: Writes every record to the data file, as JSON.
    python: import json
    open the file data file for writing as f
        run json.dump with records, f, indent=2

define load records
    description: Adds the records saved in the data file (if there is one yet) to the list.
    python: import json, os
    if os.path.exists(data file)
        open the file data file as f
            set saved to json.load(f)
        for each record in saved
            add record to records`,

`component: typing-checks
name: Checking what's typed
depth: walk
summary: People make typos, press Enter by accident and type "ten" where a number should go. Without checks, one slip stops the whole program with an error. These tools ask again, kindly, until the answer makes sense: some text, an amount that's a number, a choice from a list. Every command uses them, so the whole tool is careful in one place.
learn: try and "if it fails" (catching errors); loops that repeat until the answer is right; strip, which trims stray spaces.
== tools
define get text using question
    description: Asks until something is typed (spaces alone don't count).
    repeat forever
        set answer to input(question).strip()
        note: Empty text counts as false in Python, so "if answer" means "if something was typed".
        if answer
            give back answer
        show "Please type something."

define get amount using question
    description: Asks until the answer is a number that isn't negative, like 12 or 3.50.
    repeat forever
        set answer to input(question).strip()
        try
            set amount to answer as decimal
        if it fails with ValueError
            show "That isn't a number. Try something like 12 or 3.50."
            skip to next
        if amount is at least 0
            give back amount
        show "Amounts can't be negative."

define get number using question, lowest, highest
    description: Asks until the answer is a whole number from lowest to highest.
    repeat forever
        set answer to input(question).strip()
        if answer.isdigit()
            set number to answer as number
            note: Python chains comparisons the way maths does: lowest <= number <= highest.
            if lowest <= number <= highest
                give back number
        show "Please type a number from {lowest} to {highest}."`,

`component: menu
name: The menu
depth: walk
summary: The front desk. It loads the saved records, then asks "> " again and again and runs the command that was typed. Commands live in a dictionary: the word people type, next to the tool it runs. In Python a tool is a value like any other, so it can be stored and looked up, which is why each later step only has to add itself to the dictionary to appear here. After every command it saves; "quit" ends the program.
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
run load records
show "Records loaded: {length of records}. Type help to see the commands."
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
        run save records
    otherwise if choice
        show "There's no command '{choice}'. Type help to see them."
show "Bye!"`,

`component: add-record
name: Adding a record
depth: walk
summary: The first command: type add, then a name and an amount, and a new record goes on the end of the list. It's the pattern every command follows: one small tool that does one job, asking with the checking tools, and one line that puts it in the menu's dictionary under the word people type.
learn: Tools that use other tools; adding to the end of a list.
== tools
define add record
    description: Asks for a name and an amount, and adds the new record to the list.
    run get text with "Name: " and store in name
    run get amount with "Amount: " and store in amount
    run make record with name, amount and store in record
    add record to records
    show "Added {name}: {amount:.2f}"

note: The word to type, and the tool it runs.
set item "add" of commands to add record`,

`component: list-records
name: Showing the records
depth: walk
summary: The list command prints every record as a numbered table with lined-up columns, so you can check what's there and see each record's number. Lining up is a job for f-strings: {name:<20} pads text to 20 characters, and {amount:>10.2f} shows a number with two decimals, lined up on the right. enumerate numbers the records from 1 for people, though Python itself counts positions from 0.
learn: f-strings and their format codes; enumerate.
== tools
define list records
    description: Shows every record, numbered, in lined-up columns.
    note: An empty list counts as false, so "if not records" means "if there are none".
    if not records
        show "No records yet. Type add to make one."
        give back
    for each n, record in enumerate(records, start=1)
        show "{n:>3}. {record['name']:<20} {record['amount']:>10.2f}"

set item "list" of commands to list records`,

`component: remove-record
name: Removing a record
depth: walk
summary: Mistakes happen. This command shows the numbered list, asks which one to remove, and takes it out. People count from 1 but Python counts positions from 0, so record 1 is at position 0: forgetting that is the classic "off by one" bug, and here it's handled in one place (number - 1).
learn: Positions (indexes) starting at 0; pop, which takes an item out and gives it back.
== tools
define remove record
    description: Asks which record to remove, by its number, and removes it.
    if not records
        show "There's nothing to remove."
        give back
    for each n, record in enumerate(records, start=1)
        show "{n:>3}. {record['name']}"
    run get number with "Number to remove: ", 1, length of records and store in number
    set gone to records.pop(number - 1)
    show "Removed {gone['name']}."

set item "remove" of commands to remove record`,

`component: report
name: A simple report
depth: walk
summary: The reward for keeping records: a summary in numbers. How many there are, the total, the average and the biggest. Each is about one line, because Python comes with tools for exactly this: len counts, sum adds up, and max finds the biggest by whatever you tell it to compare.
learn: sum, len and max; making a new list from an old one (a list comprehension); lambda, a tiny tool written in one line.
== tools
define show report
    description: Shows how many records there are, their total, their average and the biggest.
    if not records
        show "No records yet, so nothing to report."
        give back
    set amounts to [record["amount"] for record in records]
    set total to sum of amounts
    set biggest to max(records, key=lambda record: record["amount"])
    show "Records: {length of records}"
    show "Total:   {total:.2f}"
    show "Average: {total / length of records:.2f}"
    show "Biggest: {biggest['name']} ({biggest['amount']:.2f})"

set item "report" of commands to show report`,

`component: package
name: Sharing it with people who don't have Python
depth: horizon
summary: Right now the program runs wherever Python is installed. To hand it to someone without Python, it's bundled with a copy of Python into one program: an .exe on Windows, an app on a Mac. Bundles are bigger than you'd expect (tens of megabytes), have to be built separately on each kind of computer, and unsigned ones get a warning the first time they're opened. Other programmers can instead install it as a package, with one command.
usual: PyInstaller (pyinstaller --onefile main.py, with --windowed for a window app); Briefcase, from BeeWare, for proper installers; pipx and a pyproject.toml file for people who already have Python.
learn: What bundling does; building on Windows, macOS and Linux separately; code signing, and why Windows SmartScreen and macOS warn about unsigned apps.`,

// ---------------------------------------------------------------- Desktop window app

`kit: window
title: Desktop window app
layout: script
shelf: productivity
platform: pc
about: A small desktop app with a real window, made with tkinter, the window toolkit that comes with Python: a list you can add to, remove from and edit, saved to a file, with a menu bar. It's written top to bottom in one file, the way small tkinter apps usually are. Turning it into an app people double-click is a horizon step.
steps: window!, item-list!, entry*, remove-item*, edit-item, open-save*, menubar*, mainloop!, package, bigger-apps`,

`component: window
name: The main window
depth: walk
summary: Every desktop app starts with a window. tkinter makes one in a line; this step gives it a title and a starting size, and a frame with a little space around the edge for the other parts to go in. The parts of a window are called widgets (labels, buttons, boxes, lists), and pack places them one after another. One thing to know from the start: a window app doesn't run top to bottom and stop. It builds its window, then waits for clicks and keys (the last step).
learn: What tkinter is; widgets; pack (and later grid) for placing them.
== main
python: import tkinter as tk
note: Settings in capitals, so they're easy to find and change.
set TITLE to "My list"
set SIZE to "420x480"
set window to tk.Tk()
run window.title with TITLE
run window.geometry with SIZE
run window.minsize with 320, 240
note: Everything else goes in this frame, with 12 pixels of space around it.
set frame to tk.Frame(window, padx=12, pady=12)
run frame.pack with fill="both", expand=True`,

`component: item-list
name: The list
depth: walk
summary: The heart of this app: a list box showing the items, with a scroll bar for when there are more than fit. Every other step works through this one widget: adding inserts into it, removing deletes from it, saving reads everything in it. It keeps the items in order and knows which one is selected.
learn: The Listbox widget (insert, delete, get, curselection); connecting a scroll bar to a list.
== main
set panel to tk.Frame(frame)
run panel.pack with fill="both", expand=True
set listbox to tk.Listbox(panel, height=12, activestyle="none")
set scrollbar to tk.Scrollbar(panel, command=listbox.yview)
run listbox.config with yscrollcommand=scrollbar.set
run scrollbar.pack with side="right", fill="y"
run listbox.pack with side="left", fill="both", expand=True
note: A few items to start with. Delete these two lines for an empty list.
for each item in ["Buy milk", "Call Sam", "Water the plants"]
    run listbox.insert with tk.END, item`,

`component: entry
name: Typing in new items
depth: walk
summary: A box to type in and an Add button, under the list; pressing Enter works too, because people expect it. The add tool shows the pattern of every window app: something happens (a click, a key), tkinter runs your tool, and the tool reads what it needs from the widgets and changes them. Empty text is ignored.
learn: Entry and Button widgets; command= (the tool a button runs); bind (the tool a key runs) and the event it passes in.
== main
set add_row to tk.Frame(frame)
run add_row.pack with fill="x", pady=(8, 0)
set entry to tk.Entry(add_row)
run entry.pack with side="left", fill="x", expand=True

define add item using event=None
    description: Adds what's typed to the list, then empties the box.
    set text to entry.get().strip()
    if text
        run listbox.insert with tk.END, text
        run entry.delete with 0, tk.END

set add_button to tk.Button(add_row, text="Add", command=add item)
run add_button.pack with side="left", padx=(8, 0)
run entry.bind with "<Return>", add item
run entry.focus_set`,

`component: remove-item
name: Removing the selected item
depth: walk
summary: A Remove button deletes whichever item is selected, and so does the Delete key. If nothing is selected, a small message box says so instead of silently doing nothing: people should always know what happened after they click.
learn: Asking a Listbox what's selected (curselection gives positions); message boxes for short notices.
== main
define remove selected using event=None
    description: Removes the selected item, or explains that nothing is selected.
    python: from tkinter import messagebox
    set chosen to listbox.curselection()
    if not chosen
        run messagebox.showinfo with TITLE, "Select an item first, then press Remove."
        give back
    run listbox.delete with first item of chosen

set remove_button to tk.Button(frame, text="Remove selected", command=remove selected)
run remove_button.pack with anchor="e", pady=(8, 0)
run listbox.bind with "<Delete>", remove selected`,

`component: edit-item
name: Editing an item
depth: hallway
summary: Double-click an item to change it: a small dialog asks for the new text, starting from the old. The structure is here; you fill in the two parts that show how a list box thinks: which position was double-clicked, and where the new text goes (the same place, once the old text is deleted).
learn: Events (a double-click is "<Double-Button-1>"); simpledialog for quick questions; delete, then insert at the same position.
== main
define edit selected using event=None
    description: Asks for new text for the chosen item, and puts it in the item's place.
    python: from tkinter import simpledialog
    set chosen to listbox.curselection()
    if not chosen
        give back
    note: 1. curselection gives the chosen positions (only one here): take the first.
    set position to ‹the first item of chosen›
    set answer to simpledialog.askstring(TITLE, "Change the item to:", initialvalue=listbox.get(position), parent=window)
    note: 2. Cancel gives back nothing, and empty text changes nothing either.
    if answer and answer.strip()
        run listbox.delete with position
        run listbox.insert with ‹where it goes: the same position›, answer.strip()

run listbox.bind with "<Double-Button-1>", edit selected`,

`component: open-save
name: Opening and saving
depth: walk
summary: Open… and Save… buttons that use your computer's own file windows to choose where the list is kept. The list is saved as plain text, one item per line, so any text editor can read it; encoding="utf-8" makes sure accents and emoji survive on every computer. If someone presses Cancel, the tool simply stops.
learn: filedialog (the system's open and save windows); reading and writing text files; what an encoding is.
== main
define save list
    description: Asks where to save, then writes every item on its own line.
    python: from tkinter import filedialog
    set path to filedialog.asksaveasfilename(defaultextension=".txt", filetypes=[("Text files", "*.txt")])
    if not path
        give back
    using open(path, "w", encoding="utf-8") as f
        for each item in listbox.get(0, tk.END)
            run print with item, file=f

define open list
    description: Asks for a text file, then shows its lines in the list instead of what was there.
    python: from tkinter import filedialog
    set path to filedialog.askopenfilename(filetypes=[("Text files", "*.txt"), ("All files", "*.*")])
    if not path
        give back
    using open(path, encoding="utf-8") as f
        set lines to f.read().splitlines()
    run listbox.delete with 0, tk.END
    for each line in lines
        if line.strip()
            run listbox.insert with tk.END, line

set files_row to tk.Frame(frame)
run files_row.pack with fill="x", pady=(8, 0)
set open_button to tk.Button(files_row, text="Open…", command=open list)
run open_button.pack with side="left"
set save_button to tk.Button(files_row, text="Save…", command=save list)
run save_button.pack with side="left", padx=(8, 0)`,

`component: menubar
name: A menu bar
depth: walk
summary: The familiar menus along the top of the window (at the top of the screen on a Mac): File, with Quit, and Help, with About. Menus are where people look for everything that isn't a button, so as the app grows its commands can go here too; add_command is all it takes. Ctrl+Q quits from the keyboard.
learn: Menus and cascades (a menu inside the menu bar); keyboard shortcuts with bind; lambda for a one-line tool.
== main
define show about
    description: A small message box saying what this app is.
    python: from tkinter import messagebox
    run messagebox.showinfo with "About", "{TITLE}: a small list app, made with Python and tkinter."

set menubar to tk.Menu(window)
set file_menu to tk.Menu(menubar, tearoff=0)
run file_menu.add_command with label="Quit", accelerator="Ctrl+Q", command=window.destroy
run menubar.add_cascade with label="File", menu=file_menu
set help_menu to tk.Menu(menubar, tearoff=0)
run help_menu.add_command with label="About", command=show about
run menubar.add_cascade with label="Help", menu=help_menu
run window.config with menu=menubar
run window.bind with "<Control-q>", lambda event: window.destroy()`,

`component: mainloop
name: Start: hand over to tkinter
depth: walk
summary: The last line of every tkinter app. mainloop shows the window and hands control to tkinter, which waits for clicks, typing and key presses and runs your tools when they happen, until the window is closed. This is event-driven programming: instead of one list of steps, the program is a set of reactions. It's also why a slow tool freezes the window: while it runs, tkinter can't react to anything else.
learn: Event loops; after(), for things that happen later or again and again; threads for long jobs.
== main
run window.mainloop`,

`component: bigger-apps
name: Bigger apps and a modern look
depth: horizon
summary: tkinter comes with Python and is fine for tools, but it looks plain and big apps outgrow it. Its themed widgets (ttk, also built in) look more at home on each system; for polished, complex apps people move to Qt, which has everything from tables to charts, or build the window with web technology inside a desktop app.
usual: tkinter.ttk or CustomTkinter for a fresher look; PySide6 (Qt for Python) for large apps; Tauri or Electron for web technology in a desktop window (IntuCode's own desktop app is made with Tauri).
learn: grid, for layouts in rows and columns; keeping the data separate from the window, so the same logic could have a different face; classes to organise a bigger app.`,

// ---------------------------------------------------------------- Online service (SaaS)

`kit: saas
title: Online service (SaaS)
layout: structured
shelf: service
platform: web
about: The inside of an online service, here a small notes service: a database that remembers everything, checks on what people send, a web server that answers browsers and apps, and an admin page for you. Accounts, payments, email and hosting are horizon steps: they're where real services rely on trusted libraries and providers rather than home-made code.
steps: database!, input-checks!, server*, admin, accounts, payments, email, hosting*`,

`component: database
name: The database
depth: walk
summary: An online service is mostly a memory: what people create is kept in a database, so it's still there tomorrow, on any device. This one uses SQLite, which comes with Python and keeps the whole database in one file. The tools here are the only part of the program that talks to it (set up the table, add a note, get them all), so the web server just calls them.
learn: Tables, rows and columns; a little SQL (CREATE TABLE, INSERT, SELECT); why the ? placeholders matter: they keep what people type from being run as SQL (an attack called SQL injection).
== settings
note: The database file, next to the program. Delete it to start again.
set database file to "notes.db"
== tools
define open database
    description: Opens the database file (SQLite makes it the first time), with rows that work like dictionaries.
    python: import sqlite3
    set db to sqlite3.connect(database file)
    set db.row_factory to sqlite3.Row
    give back db

define set up database
    description: Makes the notes table, if it isn't there yet.
    run open database and store in db
    note: "using db" saves the changes when the block ends, or undoes them all if something fails.
    using db
        run db.execute with "CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, text TEXT NOT NULL, created TEXT DEFAULT CURRENT_TIMESTAMP)"

define add note using text
    description: Saves one note, and gives back its new id.
    run open database and store in db
    using db
        note: The ? is filled in with the text by SQLite itself, safely: never paste text into SQL.
        set cursor to db.execute("INSERT INTO notes (text) VALUES (?)", (text,))
    give back cursor.lastrowid

define all notes
    description: Every note, newest first, as a list of dictionaries (ready to send as JSON).
    run open database and store in db
    set rows to db.execute("SELECT id, text, created FROM notes ORDER BY id DESC").fetchall()
    give back [dict(row) for row in rows]
== main
run set up database
run all notes and store in notes
show "The database is ready: {length of notes} notes in {database file}."`,

`component: input-checks
name: Checking what people send
depth: walk
summary: Anything can arrive from the internet: an empty note, a novel pasted by accident, or something made on purpose to break your service. So every online service checks what comes in before storing it. This tool gives back a short explanation of what's wrong, or nothing when all is well, so the server can answer "that's not right, and here's why" instead of crashing or saving junk. The self-tests below run at every start and stay silent while the checks work.
learn: Validating input; limits that protect your database; assert (check that), the start of automatic testing.
== settings
note: The longest note allowed, in characters.
set longest note to 1000
== tools
define check note using text
    description: Gives back what's wrong with a note, or nothing if it's fine.
    if not isinstance(text, str)
        give back "A note must be text."
    if not text.strip()
        give back "A note can't be empty."
    if length of text is more than longest note
        give back "A note can be at most {longest note} characters."
    give back nothing
== main
note: Self-tests, written as Python: silent while the checks work, an error the moment one breaks.
python: assert check_note("Buy milk") is None
python: assert check_note("   ") is not None
python: assert check_note("x" * (longest_note + 1)) is not None`,

`component: server
name: Web server and routes
depth: hallway
summary: The web server is what the internet talks to. Each route is an address and a tool: when a browser or an app asks for /api/notes, the server runs the tool under it and sends back what it gives, here as JSON, the format apps and scripts read. It uses Flask, which isn't built into Python: type $ pip install flask in the terminal once. Fill in the three blanks, press Run and open http://127.0.0.1:5000 in your browser. A page for your users can be made on the Webpage path: its Mechanics can "fetch from" these routes.
usual: Flask (small and clear, used here); FastAPI (fast, and checks data for you); Django (everything included: admin, accounts, database tools).
learn: URLs, requests and responses; GET (read) and POST (send); JSON; status codes (200 fine, 201 made, 400 your mistake, 500 ours); installing a package with pip.
== tools
python: from flask import Flask, jsonify, request
note: The web server. Each "when app gets …" below is a route: an address it answers.
set app to Flask(__name__)

when app gets GET at "/"
define front page
    description: What a browser shows at http://127.0.0.1:5000/
    give back ‹a line of HTML in quotes, like "<h1>My notes</h1><p>They're at <a href='/api/notes'>/api/notes</a></p>"›

when app gets GET at "/api/notes"
define list notes
    description: Every note, as JSON.
    run all notes and store in notes
    give back ‹the notes turned into JSON, with Flask's jsonify: jsonify(notes)›

when app gets POST at "/api/notes"
define new note
    description: Saves a note sent as JSON, like {"text": "Buy milk"}, once it passes the checks.
    set data to request.get_json(silent=True) or {}
    set text to data.get("text")
    run check note with text and store in problem
    if problem
        give back jsonify(error=problem), ‹the status code that means "you sent something wrong": 400›
    run add note with text and store in new id
    give back jsonify(id=new id, text=text), 201
== main
note: Start the server last: it keeps running, answering requests, until you press Stop.
if this file is run directly
    run app.run with port=5000`,

`component: admin
name: An admin page
depth: hallway
summary: A page only you can open, to see how the service is doing: how many notes there are, and the latest ones. It's locked with a secret key kept outside the code, in an environment variable, so it never ends up in a file you share or publish. It's a route on the web server, so it needs that step too. Real services put admin pages behind proper logins (the Accounts step), but the idea is the same: check who's asking before showing anything.
usual: Flask-Admin, or Django's built-in admin, for full admin sites; logins from the Accounts step instead of a shared key.
learn: Environment variables (set ADMIN_KEY before starting the server); why secrets never go in code; escaping, so text people send can't turn into HTML or scripts on your page.
== tools
when app gets GET at "/admin"
define admin page
    description: How many notes there are and the latest ten, for whoever gives the right key: /admin?key=…
    python: import hmac, os
    python: from html import escape
    note: The key comes from the environment (set ADMIN_KEY before starting the server), never from the code. No key set: the page stays locked.
    set expected to os.environ.get("ADMIN_KEY", "")
    set given to request.args.get("key", "")
    note: 1. Locked unless the given key matches. compare_digest takes as long however much matches, so the key can't be guessed letter by letter.
    if not expected or not hmac.compare_digest(given.encode(), ‹the key this page expects, as bytes: expected.encode()›)
        give back "Not allowed.", ‹the status code for "forbidden": 403›
    note: 2. The page. escape turns < and > in a note into plain text, so nobody can slip HTML or a script into your admin page.
    run all notes and store in notes
    set items to empty text
    for each note in notes[:10]
        add "<li>{escape(note['text'])}</li>" to items
    give back "<h1>Admin</h1><p>{length of notes} notes so far.</p><ul>{items}</ul>"`,

`component: accounts
name: Sign-up and login
depth: horizon
summary: Accounts let each person see only their own notes. It looks simple (a form and a password), but it's the part attackers aim for: passwords must be stored scrambled (hashed) so a stolen database doesn't reveal them, logins need protection from guessing, and "forgot my password" needs email. This is exactly the place to use a well-tested library or service rather than code of your own.
usual: Flask-Login with a password hasher (werkzeug.security, argon2); Django's built-in accounts; hosted services such as Auth0, Clerk or Supabase Auth, which also offer "sign in with Google".
learn: Password hashing; sessions and cookies; HTTPS; CSRF protection; then a users table, and an owner for each note.`,

`component: payments
name: Payments and plans
depth: horizon
summary: Charging for the service. Never handle card numbers yourself: a payment provider shows its own checkout page, keeps the card details, sends receipts, and tells your server when someone has paid (a webhook), so you can switch their plan on. Test mode lets you try everything with pretend cards first.
usual: Stripe (Checkout, and Billing for subscriptions); Paddle or Lemon Squeezy, which also handle sales tax and VAT for you.
learn: Plans and subscriptions; webhooks (the provider calling your server); test mode; keeping each customer's plan in your database.`,

`component: email
name: Sending email
depth: horizon
summary: Services send email for welcomes, receipts and "reset your password" links. Sending is easy; getting into inboxes rather than spam is the hard part. So services send through an email provider that inboxes trust, and set up their domain to prove the mail really comes from them.
usual: Postmark, Resend, SendGrid, Mailgun or Amazon SES, through their Python libraries or plain SMTP (smtplib comes with Python).
learn: SMTP; SPF, DKIM and DMARC (records that prove mail is yours); sending in the background, so a page doesn't wait for it.`,

`component: hosting
name: Hosting: putting it online
depth: horizon
summary: So far the server runs on your own computer at 127.0.0.1, an address only you can reach. Hosting runs it on a computer that's always on and reachable, with a proper server program in front (Flask's built-in one is for trying things out), HTTPS, your secrets set as environment variables, and a database that's backed up.
usual: Render, Railway, Fly.io or PythonAnywhere (the easiest for Flask); gunicorn to run it; PostgreSQL once you outgrow SQLite; a domain, with HTTPS from the host.
learn: Environment variables; development and production servers; reading logs; backups; what it costs each month.`,

// ---------------------------------------------------------------- Gadget (Arduino)

`kit: gadget
title: Gadget (Arduino)
layout: arduino
shelf: gadget
platform: board
about: A small device on an Arduino board: a heartbeat light, a button, a sensor and a buzzer, all working at once, with messages to your computer. A screen, WiFi, batteries and a case are horizon steps. The pins are for an Arduino Uno, and easy to change.
steps: board!, heartbeat*, button*, sensor*, buzzer, screen, wifi, battery, enclosure`,

`component: board
name: The board and its messages
depth: walk
summary: The sketch's backbone. A board runs two parts: "when the board starts" runs once at power-on, then "over and over" repeats forever, thousands of times a second. The serial monitor is how the board talks back: every "show" line appears on your computer, which is how you see what the gadget is doing (and why it isn't doing what you expected).
learn: setup and loop; the serial monitor and its speed (9600); uploading a sketch.
== start
start the serial monitor at 9600
show "Gadget ready."`,

`component: heartbeat
name: A heartbeat light
depth: walk
summary: The built-in light blinks to show the sketch is alive. The first sketch everyone writes uses "wait 500 milliseconds", but waiting freezes the whole board: no button presses, no sensor readings. So this light checks the clock instead ("time since start", Arduino's millis) and only switches when enough time has passed. Every part of this gadget keeps time that way, which is how they all run at once.
learn: millis and "doing several things at once"; why delay blocks; unsigned long, for times.
== settings
note: How long the light stays on, and off, in milliseconds.
constant BLINK_EVERY is 500
note: Times are kept in an unsigned long: a whole number that's never negative and big enough for 49 days of milliseconds.
set unsigned long lastBlink to 0
set lightOn to false
== start
make pin the built-in light an output
== loop
if time since start minus lastBlink is at least BLINK_EVERY
    set lastBlink to time since start
    set lightOn to not lightOn
    if lightOn
        turn the built-in light on
    otherwise
        turn the built-in light off`,

`component: button
name: A button
depth: hallway
summary: A push button between pin 2 and ground (GND). The board's built-in pull-up keeps the pin HIGH until the button connects it to ground, so pressed reads LOW, the opposite of what you'd guess. The sketch counts presses and reports each one. It reacts to the moment of pressing, not to holding, and ignores the tiny flickers a real button makes as its contacts close (called bounce) by trusting a reading only once it has held still for a moment. The structure is here; you fill in how long that moment is, and what a pressed button reads.
learn: Digital inputs and pull-up resistors; noticing a change (was up, now down); debouncing.
== settings
constant BUTTON is 2
set lastReading to HIGH
set buttonState to HIGH
set unsigned long lastChange to 0
set presses to 0
== start
make pin BUTTON an input with pull-up
== loop
read pin BUTTON and store in buttonReading
note: Any flicker restarts the 50 ms wait; only a reading that holds still counts.
if buttonReading is not lastReading
    set lastChange to time since start
if time since start minus lastChange is more than ‹how long a reading must hold still, in milliseconds: 50 is usual› and buttonReading is not buttonState
    set buttonState to buttonReading
    if buttonState is ‹what a pressed button reads, with the pull-up: HIGH or LOW›
        increase presses
        show "Button pressed: {presses}"
set lastReading to buttonReading`,

`component: sensor
name: Reading a sensor
depth: walk
summary: Many sensors (light, temperature, a knob) turn what they measure into a voltage. An analog pin measures that voltage as a number from 0 to 1023; the sketch turns it into a percentage and reports it four times a second, in the "name:value" form the Arduino IDE's Serial Plotter draws as a live graph. It expects a light sensor (a photoresistor, with a 10 kΩ resistor) or a knob (a potentiometer) on pin A0; with nothing connected, the numbers wander at random.
learn: Analog inputs and voltage dividers; map, to change a range; the Serial Plotter.
== settings
constant SENSOR is A0
constant REPORT_EVERY is 250
set unsigned long lastReport to 0
== loop
if time since start minus lastReport is at least REPORT_EVERY
    set lastReport to time since start
    read analog pin SENSOR and store in level
    set whole number percent to map(level, 0, 1023, 0, 100)
    show "light:{percent}"`,

`component: buzzer
name: A buzzer
depth: walk
summary: A small piezo buzzer on pin 8 (and ground) plays a two-note chime when the board starts, so you hear that the gadget is on. A tone has a pitch in hertz (440 is the note A) and, given a length, carries on by itself, so a beep in "over and over" doesn't freeze the board; here at the start, a short wait between the two notes is fine. To beep when the button is pressed, copy a tone line into the Button step.
learn: tone and frequencies; passive buzzers (need a tone) and active ones (only need power).
== settings
constant BUZZER is 8
== start
play a tone of 660 on pin BUZZER for 120 milliseconds
wait 150 milliseconds
play a tone of 880 on pin BUZZER for 180 milliseconds`,

`component: screen
name: A small screen
depth: horizon
summary: A tiny display shows readings on the gadget itself, with no computer needed. Many small screens talk to the board over just two wires (called I2C) and need a library that knows how to draw text and shapes on them.
usual: 0.96 inch OLED screens (SSD1306) with the Adafruit SSD1306 and GFX libraries, or U8g2; 16x2 character LCDs with a LiquidCrystal I2C library.
learn: Installing libraries ($ arduino-cli lib install); I2C wiring (SDA and SCL); drawing, then refreshing, the screen.`,

`component: wifi
name: WiFi and the internet
depth: horizon
summary: An Uno has no WiFi. Boards with an ESP32 (or an Arduino Uno R4 WiFi, or a Nano ESP32) do, so the gadget can send readings to a phone or a web page, or be controlled from one. The sketch gains a network name and password (kept in a separate file, out of shared code), a connection that can drop and must be retried, and a way to talk: a tiny web server on the board, or messages to a service.
usual: ESP32 boards with the WiFi library; MQTT, a messaging system made for gadgets; ready-made platforms such as Arduino Cloud, Blynk, or ESPHome with Home Assistant.
learn: Choosing a board with WiFi (type "board esp32" in the terminal to upload to one); connecting and reconnecting; HTTP or MQTT.`,

`component: battery
name: Running on batteries
depth: horizon
summary: Unplugged from USB, the gadget needs power of its own. An Uno uses power even while doing nothing, so a small battery lasts hours or days rather than months. Long battery life comes from boards and sketches that sleep between readings, and from getting the voltages right: too little and the board keeps restarting, too much and parts burn out.
usual: A USB power bank (the easiest start, though some switch off when little power is drawn); AA battery packs; LiPo cells with a charger board for small builds; low-power boards such as an ESP32 with deep sleep.
learn: Volts, milliamps and milliamp-hours (how long a battery lasts); sleep modes; voltage regulators.`,

`component: enclosure
name: A case
depth: horizon
summary: A case turns a tangle of wires into a thing you can hand to someone: it protects the board, holds the button and sensor where fingers and light can reach them, and hides the rest. Before that, the wiring usually moves from a breadboard to something soldered, so nothing falls out.
usual: Ready-made project boxes; 3D-printed cases (designed in Tinkercad, Fusion or OpenSCAD, or printed by a service); laser-cut wood or acrylic; perfboard, or a circuit board of your own designed in KiCad and made by a PCB maker.
learn: Soldering; measuring parts and leaving room for cables; basic 3D design.`,

// ---------------------------------------------------------------- Phone app

`kit: phone
title: Phone app
layout: website
shelf: health
platform: phone
about: Phone apps are big projects, so this kit starts with the part you can build today: a phone-friendly web app that works in any phone's browser. The native parts (the toolkit, screens, storage, notifications, the app stores) are horizon steps, each with what people use and what to learn first.
steps: web-app!, publish*, installable, toolkit*, screens, phone-storage, notifications, app-stores*`,

`component: web-app
name: Start with a phone-friendly web app
depth: walk
summary: Before learning Swift or Flutter, build the idea as a web page shaped like an app: one screen, big buttons for thumbs, text sized for phones, and memory in the browser so it keeps its data. This one is a tap counter (for glasses of water, laps, pages…); open it on your phone and see whether the idea works in real life. What you learn here (layout, events, keeping data) carries over to real apps, and the Webpage path goes further.
learn: Designing for thumbs (buttons at least 44 pixels tall); the viewport (added for you); saving in the browser (localStorage).
== structure
page title is "Tally"
add a main area called app
    add a heading "Glasses of water today" called label
    add a paragraph called count "0"
    add a button called plus saying "+1"
    add a block called controls
        add a button called minus saying "−1"
        add a button called reset saying "Start again"
== styling
shared colour paper is #f5f7fb
shared colour ink is #14213d
shared colour accent is #2563eb
style the page: font-family: system-ui, background the colour paper, text colour the colour ink, space around 0
style app: at most 420 wide, centred, at least 100vh tall, in a column, justify-content: center, gap 16, space inside 24, centre the text
style count: text size 96, bold, space around 0, font-variant-numeric: tabular-nums
style plus: space inside 28, text size 32, bold, background the colour accent, text colour white, no border, rounded corners 20, hand cursor
when plus is clicked: transform: scale(0.97)
style controls: in a row, gap 12
create group quiet: flex: 1, font: inherit, space inside 14, text size 18, background transparent, text colour the colour ink, border 1 #c9d1e0, rounded corners 14, hand cursor
minus belongs to group quiet
reset belongs to group quiet
in dark mode:
    style the page: --paper: #0f172a, --ink: #e2e8f0, --accent: #3b82f6
== mechanics
note: The count is kept in the browser, so it's still there after the page is closed.
set taps to 0
load "taps" from the browser and store in saved
if saved is not nothing
    set taps to saved

define update
    set the text of count to taps
    save taps in the browser as "taps"

run update

when plus is clicked
    increase taps
    run update

when minus is clicked
    if taps is more than 0
        decrease taps
        run update

when reset is clicked
    set taps to 0
    run update`,

`component: installable
name: Installable, like an app
depth: horizon
summary: The next step for the web app: two small additions let people install it from the browser, with its own icon on the home screen, opening full screen like any app. A manifest file gives its name, icon and colours; a service worker (a script that runs in the background) lets it open without internet. No app store needed, though iPhones allow web apps fewer features than Android phones do.
usual: A web app manifest and a service worker (Workbox helps with the second); an HTTPS address (see Putting it online); PWABuilder to wrap it for the app stores later.
learn: The manifest; service workers and offline caching; what iPhone and Android each let web apps do.`,

`component: toolkit
name: Choosing how to build it
depth: horizon
summary: Real phone apps are written with a toolkit. Either one set of code for both iPhone and Android (Flutter, React Native), or each phone's own language (Swift for iPhone, Kotlin for Android), which gets new phone features first. Python is rarely used for phone apps (Kivy and BeeWare exist, but few apps are made with them), so choosing a toolkit also means choosing your next language.
usual: Flutter (Dart; one codebase, its own look); React Native with Expo (JavaScript or TypeScript, so it builds on web skills); Swift with SwiftUI (iPhone, needs a Mac); Kotlin with Jetpack Compose (Android).
learn: One language well first: JavaScript if you've made web pages, otherwise Dart or Swift; running an app in a simulator, then on your own phone.`,

`component: screens
name: Screens and moving between them
depth: horizon
summary: An app is a set of screens (a list, a detail, settings) and the ways between them: tabs along the bottom, a back button, swiping. Sketching them on paper first saves weeks, and each toolkit has a standard way of moving between screens that people already know how to use.
usual: go_router in Flutter; Expo Router or React Navigation in React Native; NavigationStack and TabView in SwiftUI; Navigation for Jetpack Compose.
learn: Sketching screens (on paper, then in Figma); state (what each screen knows) and passing information from one screen to the next.`,

`component: phone-storage
name: Storing data on the phone
depth: horizon
summary: Apps keep data on the phone so they work without internet and open instantly: small settings in a simple key-and-value store, bigger things in a database, and, if people use more than one device, a copy on a server kept in sync (the Online service path builds one).
usual: SQLite, underneath almost everything; shared_preferences or Drift in Flutter; AsyncStorage or expo-sqlite in React Native; SwiftData on iPhone; Room and DataStore on Android.
learn: Key-value storage and databases; saving as things change; syncing, and what happens when two devices disagree.`,

`component: notifications
name: Notifications
depth: horizon
summary: Notifications reach people when the app is closed. Local ones are scheduled by the app itself (a daily reminder); push notifications are sent from a server, through Apple's and Google's own services. Phones ask people's permission first, and people switch them off quickly if there are too many.
usual: Firebase Cloud Messaging (Android and iPhone); Apple Push Notification service; Expo Notifications; flutter_local_notifications for reminders.
learn: Local and push notifications; asking permission at the right moment; device tokens, and a server to send from.`,

`component: app-stores
name: The app stores
depth: horizon
summary: To be in the App Store and Google Play, an app needs a developer account, screenshots, a description and a privacy policy, and it must pass a review, which can take a day or more and may ask for changes. Apple's account costs a yearly fee and building for iPhone needs a Mac (or a cloud build service); Google Play's is a one-off fee.
usual: The Apple Developer Program with Xcode, or Expo's EAS Build; the Google Play Console; TestFlight and Play's testing tracks to try it with friends first.
learn: Each store's guidelines; icons and screenshots; a privacy policy; version numbers and updates.`,
  ];

  /* ------------------------------------------------------------------ */
  /* Reading the plain-text format                                        */
  /* ------------------------------------------------------------------ */

  function parseEntry(text) {
    const lines = String(text).replace(/\r\n/g, '\n').split('\n');
    const head = {}, sections = {}, options = [];
    let sec = null;
    for (const line of lines) {
      const s = line.match(/^==\s*(\w+)\s*$/);
      if (s) { sec = s[1]; sections[sec] = []; continue; }
      if (sec) { sections[sec].push(line); continue; }
      const m = line.match(/^(\w+):\s*(.*)$/);
      if (!m) continue;
      if (m[1] === 'option') {
        const [label, means, next] = m[2].split('|').map(x => (x || '').trim());
        const kit = (next || '').match(/^kit\s+([\w-]+)(?:\s*:\s*(.*))?$/);
        options.push({ label, means, next: kit ? null : next, kit: kit ? kit[1] : null, ticked: kit && kit[2] ? kit[2].split(',').map(x => x.trim()).filter(Boolean) : null });
      } else head[m[1]] = m[2].trim();
    }
    for (const k of Object.keys(sections)) {
      while (sections[k].length && !sections[k][sections[k].length - 1].trim()) sections[k].pop();
    }
    return { head, sections, options };
  }

  /* The core library, then the kit packs (lang/kits/*.js, loaded before this file), which add entries with
   * (window.IntuiKitPacks = window.IntuiKitPacks || []).push(...entries). */
  const BUILT_IN = [...CORE, ...((typeof window !== 'undefined' && window.IntuiKitPacks) || [])];

  /* One entry on its own: what it is, its id, a title for lists, and its own problems (what the whole
   * library says about it, like a kit listing a step that doesn't exist yet, comes from parseLibrary). */
  const FOLDERS = ['settings', 'tools', 'main', 'structure', 'styling', 'mechanics', 'start', 'loop'];
  function describeEntry(text) {
    const { head, sections, options } = parseEntry(text);
    const kind = ['question', 'kit', 'component'].find(k => head[k] != null) || null;
    const id = kind ? head[kind] : '';
    const problems = [];
    if (!kind) problems.push('The first line says what this is: "question: …", "kit: …" or "component: …".');
    else if (!/^[\w-]+$/.test(id)) problems.push(`"${id}" can't be an id: use letters, numbers and dashes, like my-step.`);
    if (kind === 'question') {
      if (!head.ask) problems.push('Add "ask:" with the question itself.');
      if (!options.length) problems.push('Add at least one "option: label | what it means | where it leads" (the id of the next question, or "kit" and a kit\'s id).');
      options.forEach((o, i) => { if (!o.label || (!o.next && !o.kit)) problems.push(`Option ${i + 1} needs a label and where it leads, like "option: PC | Windows, macOS or Linux | pc".`); });
    }
    if (kind === 'kit') {
      if (head.layout && !LAYOUT_FILES[head.layout]) problems.push(`"layout: ${head.layout}" isn't one of script, structured, website or arduino.`);
      if (!head.steps) problems.push('Add "steps:" with its components in build order, like "steps: first!, second*, third".');
      if (head.shelf && !SHELVES.some(x => x.id === head.shelf)) problems.push(`"shelf: ${head.shelf}" isn't a shelf of the Library. Use one of: ${SHELVES.map(x => x.id).join(', ')}.`);
      if (head.platform && !PLATFORMS[head.platform]) problems.push(`"platform: ${head.platform}" isn't one of ${Object.keys(PLATFORMS).join(', ')}.`);
      if (head.annotated && !/^(yes|no|true|false)$/i.test(head.annotated)) problems.push('"annotated:" is yes or no.');
      if (head.version && !head.module) problems.push('A kit with "version:" also says which "module:" it\'s a version of.');
    }
    if (kind === 'component') {
      if (!head.name) problems.push('Add "name:" with its plain-language name.');
      if (!DEPTHS[head.depth]) problems.push('Add "depth: walk", "depth: hallway" or "depth: horizon".');
      if (!head.summary) problems.push('Add "summary:" with its role in the whole project, in plain words.');
      for (const s of Object.keys(sections)) if (!FOLDERS.includes(s)) problems.push(`"== ${s}" isn't a folder. Use settings, tools or main (Python), structure, styling or mechanics (website), or settings, start or loop (Arduino).`);
      const blanks = Object.values(sections).some(ls => ls.some(l => /‹[^›]*›/.test(l) && !/^\s*(?:note|comment)\s*:/i.test(l)));
      if (head.depth === 'hallway' && !blanks) problems.push('A hallway step leaves ‹blanks› to fill in: put at least one in its sentences, like "set gain to ‹a number from 0 to 1›".');
      if (head.depth === 'walk' && blanks) problems.push('A walk step is written in full: fill in its ‹blanks›, or make it "depth: hallway".');
    }
    return { kind, id, title: kind === 'question' ? head.ask || id : head.title || head.name || id, problems };
  }

  /* The built-in library with someone's own entries after it: an entry of theirs with the same id replaces the built-in one. */
  const libraryWith = (mine) => parseLibrary([...BUILT_IN, ...(mine || [])]);

  /* The questions the shelves make: "start" lists the shelves that have kits, and each shelf's question
   * ("shelf-games") lists its kits, or the kit's own question first when it has one ("asks: webpage").
   * A question written by hand with the same id wins. Kits on no known shelf get a shelf of their own. */
  function shelfQuestions(lib) {
    const kits = Object.values(lib.kits);
    const shelves = SHELVES.filter(sh => sh.ask).concat([{ id: 'other', title: 'Your other kits', ask: 'Which kit?', about: 'Kits that don\'t say which shelf they sit on.' }]);
    const on = (sh) => kits.filter(k => (sh.id === 'other' ? !SHELVES.some(x => x.id === k.shelf && x.ask) : k.shelf === sh.id));
    const option = (k) => ({ label: k.title, means: `${PLATFORMS[k.platform]} · ${k.about}`, next: k.asks && lib.questions[k.asks] ? k.asks : null, kit: k.asks && lib.questions[k.asks] ? null : k.id, ticked: null });
    const slugOf = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    /* A shelf's choices: its kits, with the versions of one module gathered into one choice and a question of their own. */
    const choices = (list) => {
      const out = [], modules = new Map();
      for (const k of list) {
        if (!k.module) { out.push(option(k)); continue; }
        if (!modules.has(k.module)) { modules.set(k.module, []); out.push({ module: k.module }); }
        modules.get(k.module).push(k);
      }
      return out.map(o => {
        if (!o.module) return o;
        const versions = modules.get(o.module), id = 'module-' + slugOf(o.module);
        if (versions.length === 1) return { ...option(versions[0]), label: o.module };
        if (!lib.questions[id]) lib.questions[id] = { id, ask: `Which version of ${o.module.replace(/^\d+\s*·\s*/, '')}?`, made: true,
          options: versions.map(k => ({ ...option(k), label: k.version || k.title })) };
        return { label: o.module, means: `${versions.length} versions: ${[...new Set(versions.map(k => PLATFORMS[k.platform]))].join(', ')}${versions.some(k => k.annotated) ? ', with notes on what each part adds' : ''}. ${versions[0].about}`, next: id, kit: null, ticked: null };
      });
    };
    // a shelf with one choice needs no question of its own: its answer leads straight to it
    for (const sh of shelves) {
      const id = 'shelf-' + sh.id, list = choices(on(sh));
      if (list.length > 1 && !lib.questions[id]) lib.questions[id] = { id, ask: sh.ask, options: list, made: true };
      else if (list.length === 1) sh.only = list[0];
    }
    if (!lib.questions.start) lib.questions.start = { id: 'start', ask: 'What are you making?', made: true,
      options: shelves.filter(sh => on(sh).length).map(sh => (lib.questions['shelf-' + sh.id]
        ? { label: sh.title, means: sh.about, next: 'shelf-' + sh.id, kit: null, ticked: null }
        : { ...(sh.only || option(on(sh)[0])), label: sh.title, means: sh.about })) };
  }

  /* All entries -> { questions, kits, components, problems }. Problems are listed, not thrown, so one
   * broken entry someone wrote doesn't stop the rest from working. */
  function parseLibrary(entries) {
    const lib = { questions: {}, kits: {}, components: {}, problems: [] };
    for (const text of entries) {
      const { head, sections, options } = parseEntry(text);
      if (head.question) lib.questions[head.question] = { id: head.question, ask: head.ask || '', options };
      else if (head.kit) {
        lib.kits[head.kit] = {
          id: head.kit, title: head.title || head.kit, layout: head.layout || 'structured', about: head.about || '', shelf: head.shelf || '',
          platform: PLATFORMS[head.platform] ? head.platform : ({ website: 'web', arduino: 'board' }[head.layout] || 'pc'), asks: head.asks || '',
          module: head.module || '', version: head.version || '', annotated: /^(yes|true)$/i.test(head.annotated || ''),
          steps: (head.steps || '').split(',').map(x => x.trim()).filter(Boolean).map(x => ({ id: x.replace(/[!*]+$/, ''), always: /!$/.test(x), ticked: /[!*]$/.test(x) })),
        };
      } else if (head.component) {
        lib.components[head.component] = {
          id: head.component, name: head.name || head.component, depth: DEPTHS[head.depth] ? head.depth : 'horizon',
          summary: head.summary || '', usual: head.usual || '', learn: head.learn || '', sections,
        };
      } else lib.problems.push('An entry needs "question:", "kit:" or "component:" on its first line.');
    }
    shelfQuestions(lib);
    for (const k of Object.values(lib.kits)) if (k.asks && !lib.questions[k.asks]) lib.problems.push(`The kit "${k.id}" asks a question "${k.asks}" that doesn't exist.`);
    for (const q of Object.values(lib.questions)) for (const o of q.options) {
      if (o.kit && !lib.kits[o.kit]) lib.problems.push(`The question "${q.id}" leads to a kit "${o.kit}" that doesn't exist.`);
      if (o.next && !lib.questions[o.next]) lib.problems.push(`The question "${q.id}" leads to a question "${o.next}" that doesn't exist.`);
    }
    for (const k of Object.values(lib.kits)) for (const s of k.steps) if (!lib.components[s.id]) lib.problems.push(`The kit "${k.id}" lists a component "${s.id}" that doesn't exist.`);
    return lib;
  }

  /* ------------------------------------------------------------------ */
  /* Putting a project together                                           */
  /* ------------------------------------------------------------------ */

  const LAYOUT_FILES = { script: ['main'], structured: ['settings', 'tools', 'main'], website: ['structure', 'styling', 'mechanics'], arduino: ['sketch'] };
  const KIND = { script: 'python', structured: 'python', website: 'website', arduino: 'arduino' };
  const stepNote = (n, c) => `note: ── Step ${n} · ${c.name} (${DEPTHS[c.depth].label}) ──`;

  /* A kit and the ids of the components chosen -> { project, plan }. Steps keep the kit's order. */
  function build(lib, kitId, chosen, name, path) {
    const kit = lib.kits[kitId];
    const picked = new Set(chosen);
    const steps = kit.steps.filter(s => s.always || picked.has(s.id)).map(s => lib.components[s.id]).filter(Boolean);
    const files = LAYOUT_FILES[kit.layout] || LAYOUT_FILES.structured;
    const text = Object.fromEntries(files.map(f => [f, []]));
    const arduino = { settings: [], start: [], loop: [] };
    const add = (list, lines) => { if (list.length) list.push(''); list.push(...lines); };
    const taught = (lines) => lines.flatMap(l => { const m = l.match(/^(\s*)teach\s*:\s?(.*)$/i); return !m ? [l] : kit.annotated ? [`${m[1]}note: ${m[2]}`] : []; });
    steps.forEach((c, i) => {
      const header = stepNote(i + 1, c);
      c = { ...c, sections: Object.fromEntries(Object.entries(c.sections).map(([f, ls]) => [f, taught(ls)])) };
      if (kit.layout === 'arduino') {
        for (const part of ['settings', 'start', 'loop']) {
          if (!c.sections[part]) continue;
          const indent = part === 'settings' ? '' : '    ';
          add(arduino[part], [indent + header, ...c.sections[part].map(l => (l.trim() ? indent + l : ''))]);
        }
        return;
      }
      for (const f of files) if (c.sections[f]) add(text[f], [header, ...c.sections[f]]);
    });
    if (kit.layout === 'arduino') {
      // An empty part gets a note ("do nothing" is a Python sentence; the Arduino sentences don't have it, and C++ is happy with an empty part)
      text.sketch = [...arduino.settings, ...(arduino.settings.length ? [''] : []), 'when the board starts', ...(arduino.start.length ? arduino.start : ['    note: Nothing to set up yet.']), '', 'over and over', ...(arduino.loop.length ? arduino.loop : ['    note: Nothing to repeat yet.'])];
    }
    const sections = files.map(f => ({ id: f, file: f, text: text[f].join('\n') }));
    const active = kit.layout === 'website' ? 'structure' : sections[sections.length - 1].id;
    const plan = {
      title: kit.title, path: path || [],
      steps: steps.map((c, i) => ({ id: c.id, n: i + 1, name: c.name, depth: c.depth, summary: c.summary, usual: c.usual, learn: c.learn })),
    };
    return { project: { version: 1, lang: 'python', kind: KIND[kit.layout] || 'python', name, sections, active, plan }, plan };
  }

  /* The answers that lead to a kit: [{ label, next, kit, ticked }], the shortest from "start". Where several
   * answers lead to it, the one that keeps the kit's own usual steps is preferred ("Something else" over
   * "Showing my work", which ticks its own). */
  function pathToKit(lib, kitId) {
    const queue = [{ q: 'start', path: [] }], seen = new Set();
    let found = null;
    while (queue.length) {
      const { q, path } = queue.shift();
      if (seen.has(q) || !lib.questions[q]) continue;
      seen.add(q);
      for (const o of lib.questions[q].options) {
        const step = [...path, { label: o.label, next: o.next, kit: o.kit, ticked: o.ticked }];
        if (o.kit === kitId) { if (!o.ticked) return step; found = found || step; }
        if (o.next) queue.push({ q: o.next, path: step });
      }
    }
    return found;
  }
  /* Answers given by their labels (a shelf's path) -> the same chain of options, as far as they go. */
  function followLabels(lib, labels) {
    const out = [];
    let q = 'start';
    for (const label of labels || []) {
      const o = lib.questions[q] && lib.questions[q].options.find(x => x.label === label);
      if (!o) break;
      out.push({ label: o.label, next: o.next, kit: o.kit, ticked: o.ticked });
      if (o.kit || !o.next) break;
      q = o.next;
    }
    return out;
  }

  /* Where a step's sentences start in a section's text (its "── Step n ·" note), or -1. */
  function stepLine(text, step) {
    const re = new RegExp(`^\\s*note:\\s*── Step ${step.n} · `);
    return String(text).split('\n').findIndex(l => re.test(l));
  }

  const library = parseLibrary(BUILT_IN);
  window.IntuiBuilder = { BUILT_IN, DEPTHS, SHELVES, PLATFORMS, parseEntry, parseLibrary, describeEntry, libraryWith, build, stepLine, pathToKit, followLabels, library };
})();
