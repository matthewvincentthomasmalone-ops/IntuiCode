/* IntuaCode Library — kinds of project. Each "learn from" project was checked on its own repository or site
 * for the licence given (2026-11). GPL, LGPL and AGPL projects are listed to read and learn from: their code
 * can't be copied into IntuaCode (Apache-2.0) or into code under another licence. See README.md. */
(window.IntuiLibraryPacks = window.IntuiLibraryPacks || []).push(

// ---------------------------------------------------------------- Websites and online

`type: webpage
title: Web page
heading: Websites and online
platforms: web
about: A site people read in a browser: a portfolio, a landing page, a club or a small business.
language: HTML | What is on the page: headings, text, pictures, links, forms
language: CSS | How it looks: colours, spacing, layout, and changes for phones | Bootstrap, Tailwind CSS
language: JavaScript | What it does: menus that open, forms that check themselves, small animations
learn from: HTML5 Boilerplate | HTML | MIT | https://github.com/h5bp/html5-boilerplate | A well-commented starting page: the head, meta tags and sensible defaults
learn from: Bootstrap | CSS | MIT | https://github.com/twbs/bootstrap | How a grid, buttons and forms are styled to work on every screen size
parts: theme-toggle, responsive-nav, dialog, tabs, form-check, toast, css-shapes, colour-codes, easing, safe-text, web-audio-graph
templates: webpage, link-page`,

`type: web-app
title: Web app with a back end
heading: Websites and online
platforms: web
about: A site people sign in to and use: the page in the browser talks to a server that keeps the data.
language: JavaScript | The page: what happens on clicks, fetching data from the server, updating the page | React, Vue, Svelte
language: HTML | The page's structure
language: CSS | The page's look
language: Python | The server: routes that answer requests, checking input, talking to the database | Flask, FastAPI, Django
language: SQL | The data: tables and the questions asked of them | SQLite, PostgreSQL
language: TypeScript | JavaScript with types, common in larger front and back ends | Node.js, Express
learn from: Flask | Python | BSD-3-Clause | https://github.com/pallets/flask | A small web framework whose source is readable: routes, requests, responses
learn from: Django | Python | BSD-3-Clause | https://github.com/django/django | A complete framework: accounts, an admin site, the database layer, security defaults
learn from: Express | JavaScript | MIT | https://github.com/expressjs/express | The usual Node.js server: routes and middleware in a few files
learn from: FastAPI | Python | MIT | https://github.com/fastapi/fastapi | Typed request checking and automatic API documentation
parts: py-js-http, py-js-websocket, json-route, form-check, fetch-retry, password-hash, random-token, signed-messages, safe-text, sql-parameters, python-sqlite, browser-storage, cache-ttl, rate-limit, toast, dialog, logging, env-vars
templates: saas, message-wall, weather-now`,

`type: online-shop
title: Online shop
heading: Websites and online
platforms: web
about: Products, a basket, checkout and orders: a web app where mistakes cost money, so security matters most.
language: Python | The shop's server: products, baskets, orders, stock | Django, Saleor
language: PHP | Many shops run on PHP platforms | WooCommerce on WordPress
language: Ruby | Shops built with Rails | Solidus
language: JavaScript | The storefront: basket updates, product galleries, the payment provider's checkout form | Stripe.js
language: SQL | Products, customers and orders in tables | PostgreSQL
learn from: Saleor | Python | BSD-3-Clause | https://github.com/saleor/saleor | A shop with a GraphQL API: products, checkout, payments, orders
learn from: Solidus | Ruby | BSD-3-Clause | https://github.com/solidusio/solidus | A Rails shop: how orders move from basket to shipped
parts: sql-parameters, password-hash, random-token, signed-messages, safe-text, form-check, json-route, py-js-http, python-sqlite, sql-queries, search-filter, sorting, toast, dialog, logging
templates: saas`,

`type: blog
title: Blog or content site
heading: Websites and online
platforms: web
about: Articles, pages and a list of posts, often written in Markdown and turned into HTML.
language: Markdown | The posts themselves
language: HTML | The templates each post is poured into
language: CSS | The look of the site
language: Go | Hugo turns Markdown into a site very fast | Hugo
language: Ruby | Jekyll does the same, and GitHub Pages runs it | Jekyll
language: PHP | WordPress, the most used blogging platform | WordPress
learn from: Hugo | Go | Apache-2.0 | https://github.com/gohugoio/hugo | A static site generator: templates, content folders, taxonomies
learn from: Jekyll | Ruby | MIT | https://github.com/jekyll/jekyll | The simplest static blog structure: front matter, layouts, posts
learn from: Ghost | TypeScript | MIT | https://github.com/TryGhost/Ghost | A publishing platform with an editor, members and newsletters
learn from: WordPress | PHP | GPL-2.0-or-later | https://github.com/WordPress/WordPress | Themes, plug-ins and hooks at a very large scale
parts: responsive-nav, theme-toggle, dates-times, search-filter, sorting, safe-text, css-shapes, json-data
templates: webpage`,

`type: browser-extension
title: Browser extension
heading: Websites and online
platforms: web
about: An add-on for Chrome, Edge or Firefox that changes pages or adds a button to the toolbar.
language: JavaScript | The background script, the content scripts that run in pages, and the pop-up
language: JSON | manifest.json: the extension's name, permissions and files (Manifest V3)
language: HTML | The pop-up and options pages
language: CSS | Styles for the pop-up and anything added to pages
language: TypeScript | Larger extensions are often written in TypeScript
learn from: Chrome extension samples | JavaScript | Apache-2.0 | https://github.com/GoogleChrome/chrome-extensions-samples | Small working examples of each extension API
learn from: Dark Reader | TypeScript | MIT | https://github.com/darkreader/darkreader | Changing every page's colours from a content script
learn from: uBlock Origin | JavaScript | GPL-3.0 | https://github.com/gorhill/uBlock | Filtering network requests efficiently
parts: browser-storage, keyboard-shortcuts, safe-text, theme-toggle, fetch-retry, search-filter, colour-codes`,

`type: api-service
title: APIs and services
heading: Websites and online
platforms: web
about: A program on a server that other programs call over HTTP: it answers in JSON and keeps the data.
language: Python | Routes, checking input, background jobs | FastAPI, Flask, Django REST framework
language: JavaScript | Node.js servers | Express, Fastify
language: Go | Fast, small servers that deploy as a single file | net/http, Gin
language: Rust | Servers where speed and safety matter | Axum, Actix Web
language: Java | Large company services | Spring Boot
language: SQL | The data behind the service | PostgreSQL
language: YAML | Deployment settings and API descriptions | OpenAPI, Docker Compose
learn from: FastAPI | Python | MIT | https://github.com/fastapi/fastapi | Request checking from type hints, and documentation made from the code
learn from: Gin | Go | MIT | https://github.com/gin-gonic/gin | Routing and middleware in Go
learn from: Axum | Rust | MIT | https://github.com/tokio-rs/axum | Handlers as plain async functions
learn from: Spring Boot | Java | Apache-2.0 | https://github.com/spring-projects/spring-boot | Configuration, dependency injection, production checks
parts: json-route, rate-limit, signed-messages, password-hash, random-token, sql-parameters, python-sqlite, cache-ttl, logging, env-vars, json-data, fetch-retry, dates-times
templates: saas`,

`type: chat-bot
title: Chat bot
heading: Websites and online
platforms: pc, web
about: A bot that answers commands in Discord, Slack or Telegram, running on a computer or a server.
language: Python | The bot's commands and replies | discord.py, Slack Bolt for Python
language: JavaScript | The same in Node.js | discord.js, Bolt for JavaScript
language: JSON | Settings, and the messages the chat service sends
learn from: discord.py | Python | MIT | https://github.com/Rapptz/discord.py | Commands, events and the async loop of a Discord bot
learn from: discord.js | TypeScript | Apache-2.0 | https://github.com/discordjs/discord.js | The same in Node.js, with slash commands
learn from: Bolt for JavaScript | TypeScript | MIT | https://github.com/slackapi/bolt-js | Slack's own framework for apps and bots
parts: rate-limit, signed-messages, env-vars, json-data, logging, cache-ttl, dates-times, fetch-retry, random-token`,

`type: smart-contract
title: Smart contracts
heading: Websites and online
platforms: web
about: Programs stored on a blockchain such as Ethereum; once deployed they can't be changed, so they are tested heavily first.
language: Solidity | The contracts themselves | OpenZeppelin Contracts
language: JavaScript | Tests, deployment scripts and the web page that talks to the contract | Hardhat, ethers.js, viem
language: TypeScript | The same, with types | Hardhat
language: Rust | Contracts on Solana, and the Foundry tools | Anchor, Foundry
learn from: OpenZeppelin Contracts | Solidity | MIT | https://github.com/OpenZeppelin/openzeppelin-contracts | Audited building blocks: tokens, access control, upgrades
learn from: Foundry | Rust | MIT OR Apache-2.0 | https://github.com/foundry-rs/foundry | Testing contracts in Solidity itself, fast
learn from: Uniswap v2 core | Solidity | GPL-3.0 | https://github.com/Uniswap/v2-core | A small, famous exchange contract
parts: signed-messages, random-token, json-data, fetch-retry`,

// ---------------------------------------------------------------- Phone and desktop apps

`type: phone-app-ios
title: iPhone and iPad app
heading: Phone and desktop apps
platforms: phone
about: An app for Apple's phones and tablets, built with Xcode on a Mac and published through the App Store.
language: Swift | The whole app: screens, data and logic | SwiftUI, UIKit, SwiftData
language: Objective-C | Older apps and libraries, still met in big projects
language: C | Libraries shared with other platforms, called from Swift
learn from: Wikipedia for iOS | Swift | MIT | https://github.com/wikimedia/wikipedia-ios | A large, well-run app: reading, search, saved articles
learn from: NetNewsWire | Swift | MIT | https://github.com/Ranchero-Software/NetNewsWire | A feed reader for iPhone and Mac sharing code
learn from: Ice Cubes | Swift | AGPL-3.0 | https://github.com/Dimillian/IceCubesApp | A modern SwiftUI app for Mastodon
parts: swift-c, theme-toggle, settings-file, json-data, dates-times, fetch-retry, undo-redo, password-hash, random-token
templates: phone, focus-garden`,

`type: phone-app-android
title: Android app
heading: Phone and desktop apps
platforms: phone
about: An app for Android phones and tablets, built with Android Studio and published on Google Play.
language: Kotlin | The app itself: screens, data and logic | Jetpack Compose, Room, Coroutines
language: Java | Older apps and many libraries
language: C++ | Fast code (audio, games, image work) through the NDK and JNI | Android NDK, Oboe
learn from: Now in Android | Kotlin | Apache-2.0 | https://github.com/android/nowinandroid | Google's sample of how a modern Android app is arranged
learn from: Thunderbird for Android | Kotlin | Apache-2.0 | https://github.com/thunderbird/thunderbird-android | A mail app: accounts, sync, notifications
learn from: AntennaPod | Java | GPL-3.0 | https://github.com/AntennaPod/AntennaPod | A podcast player: downloads, playback in the background
parts: kotlin-cpp-jni, theme-toggle, settings-file, json-data, dates-times, fetch-retry, undo-redo, password-hash
templates: phone, envelope-budget`,

`type: phone-app-cross
title: Cross-platform phone app
heading: Phone and desktop apps
platforms: phone
about: One code base that builds an iPhone app and an Android app, often a web or desktop version too.
language: Dart | Flutter apps: the screens and logic for every platform | Flutter
language: JavaScript | React Native apps | React Native, Expo
language: TypeScript | The same, with types | React Native, Expo
language: C# | .NET MAUI apps | .NET MAUI
language: Kotlin | Kotlin Multiplatform shares logic between Android and iOS | Kotlin Multiplatform
learn from: Flutter samples | Dart | BSD-3-Clause | https://github.com/flutter/samples | Official small apps for each Flutter feature
learn from: Expo | TypeScript | MIT | https://github.com/expo/expo | The tools and libraries most React Native apps start from
learn from: Bluesky social app | TypeScript | MIT | https://github.com/bluesky-social/social-app | A large React Native app on iOS, Android and the web
learn from: Immich | Dart | AGPL-3.0 | https://github.com/immich-app/immich | A photo backup app whose phone app is Flutter
parts: theme-toggle, settings-file, json-data, dates-times, fetch-retry, browser-storage, undo-redo, toast
templates: phone, streaks`,

`type: desktop-app
title: Desktop app
heading: Phone and desktop apps
platforms: pc
about: A program with windows for Windows, macOS or Linux: an editor, a tool, a manager for files or media.
language: C# | Windows apps, and cross-platform ones | WPF, WinUI, Avalonia
language: C++ | Fast apps and ones close to the hardware | Qt, wxWidgets, Dear ImGui
language: Rust | The app's core in Tauri apps | Tauri
language: JavaScript | The window of Electron and Tauri apps is a web page | Electron, Tauri
language: Python | Tools with simple windows | Tkinter, PySide (Qt)
language: Swift | Mac apps | SwiftUI, AppKit
learn from: Tauri | Rust | Apache-2.0 OR MIT | https://github.com/tauri-apps/tauri | Small desktop apps with a web page for a window (IntuaCode's desktop app uses it)
learn from: Visual Studio Code | TypeScript | MIT | https://github.com/microsoft/vscode | A very large Electron app: extensions, settings, commands
learn from: Avalonia | C# | MIT | https://github.com/AvaloniaUI/Avalonia | One C# interface for Windows, macOS and Linux
learn from: Notepad++ | C++ | GPL-3.0 | https://github.com/notepad-plus-plus/notepad-plus-plus | A Windows editor in plain C++ and Win32
parts: csharp-cpp-pinvoke, settings-file, undo-redo, keyboard-shortcuts, theme-toggle, text-file, folder-walk, logging, dialog, tabs, file-picker, shared-settings
templates: window`,

`type: learning-app
title: Learning and quiz apps
heading: Phone and desktop apps
platforms: web, phone, pc
about: Flashcards, quizzes, typing practice and courses that adapt to what someone already knows.
language: JavaScript | Quizzes in a page: questions, scoring, progress | React
language: HTML | The questions and answers on the page
language: CSS | Layout and feedback colours
language: Python | Generating questions, spaced repetition, the server for accounts and progress | Flask, Django
language: Kotlin | Android apps
language: Swift | iPhone apps
learn from: Anki | Rust | AGPL-3.0-or-later | https://github.com/ankitects/anki | Spaced-repetition flashcards: scheduling and syncing
learn from: Oppia | Python | Apache-2.0 | https://github.com/oppia/oppia | Interactive lessons that give feedback on answers
learn from: Moodle | PHP | GPL-3.0 | https://github.com/moodle/moodle | A full course system: quizzes, grades, plug-ins
parts: progress-bar, weighted-random, statistics, browser-storage, toast, keyboard-shortcuts, timing, dates-times, json-data, note-names, scales-chords, metronome
templates: flashcards, typing-test, word-of-the-day`,

// ---------------------------------------------------------------- Games and graphics

`type: browser-game
title: Browser game
heading: Games and graphics
platforms: web
about: A game that runs in a web page, on a computer or a phone, drawn on a canvas.
language: JavaScript | The game loop, input, physics and drawing | Phaser, PixiJS, Three.js
language: HTML | The page and its drawing area (canvas)
language: CSS | Menus and anything around the game
language: TypeScript | Bigger games, for the checks types give | Phaser, Excalibur
learn from: Phaser | JavaScript | MIT | https://github.com/phaserjs/phaser | A complete 2D game framework: scenes, sprites, physics, sound
learn from: PixiJS | TypeScript | MIT | https://github.com/pixijs/pixijs | Fast 2D drawing with WebGL
learn from: 2048 | JavaScript | MIT | https://github.com/gabrielecirulli/2048 | A small, famous game in plain JavaScript
parts: game-loop, box-collision, circle-collision, gravity-jump, sprite-animation, tile-map, camera-follow, game-states, high-score, weighted-random, easing, vectors-2d, clamp-lerp-map, angles, polygon-points, keyboard-shortcuts
templates: snake-web, invaders-web, brothers-web, memory-pairs, colour-merge`,

`type: phone-game
title: Phone game
heading: Games and graphics
platforms: phone
about: A game for iPhone and Android, often one-thumb or touch-first, built with a game engine.
language: C# | Unity's scripting language | Unity
language: C++ | Engines and fast game code | Godot, Unreal Engine, Cocos2d-x
language: Lua | Game logic in LÖVE, Defold and Solar2D | LÖVE, Defold
language: Java | Android games with libGDX | libGDX
language: JavaScript | Web-based games wrapped as apps | Phaser, Capacitor
learn from: Godot | C++ | MIT | https://github.com/godotengine/godot | A whole engine: its own GDScript language, scenes, physics, exports to phones
learn from: libGDX | Java | Apache-2.0 | https://github.com/libgdx/libgdx | A Java framework for desktop, Android and iOS games
learn from: LÖVE | C++ | Zlib | https://github.com/love2d/love | A small engine programmed in Lua
learn from: Shattered Pixel Dungeon | Java | GPL-3.0 | https://github.com/00-Evan/shattered-pixel-dungeon | A full Android game: levels, saving, touch controls
parts: game-loop, box-collision, circle-collision, gravity-jump, sprite-animation, camera-follow, game-states, high-score, weighted-random, easing, vectors-2d, angles
templates: rooftop-runner, paper-plane`,

`type: pc-game
title: PC game
heading: Games and graphics
platforms: pc
about: A game for Windows, macOS or Linux, from a small 2D game to a 3D one.
language: C++ | Engines and games where speed matters | Unreal Engine, Godot, raylib, SDL
language: C# | Unity games and Godot's C# option | Unity, Godot, MonoGame
language: Python | Small 2D games and prototypes | pygame
language: Lua | Game logic and mods | LÖVE
language: Rust | Games in Rust | Bevy
learn from: Godot | C++ | MIT | https://github.com/godotengine/godot | How a complete engine is laid out
learn from: raylib | C | Zlib | https://github.com/raysan5/raylib | A simple library for games in C, with many examples
learn from: SuperTuxKart | C++ | GPL-3.0 | https://github.com/supertuxkart/stk-code | A complete 3D racing game
learn from: OpenTTD | C++ | GPL-2.0 | https://github.com/OpenTTD/OpenTTD | A big simulation game, its saving and its network play
parts: game-loop, box-collision, circle-collision, gravity-jump, sprite-animation, tile-map, camera-follow, game-states, high-score, weighted-random, easing, vectors-2d, rotate-point, settings-file, timing
templates: snake-py, invaders-py, brothers-py`,

`type: game-mod
title: Game mods and scripting
heading: Games and graphics
platforms: pc
about: Changing or adding to an existing game through its scripting language or a mod loader.
language: Lua | Roblox (Luau), World of Warcraft add-ons, Luanti and many other games use it for scripts
language: Java | Minecraft Java Edition mods | Fabric, NeoForge
language: C# | Mods for Unity games | BepInEx, Harmony
language: Python | Blender add-ons and some game tools
language: JSON | Data packs, item and recipe definitions
learn from: Fabric API | Java | Apache-2.0 | https://github.com/FabricMC/fabric-api | The hooks Minecraft mods build on
learn from: Harmony | C# | MIT | https://github.com/pardeike/Harmony | Changing a .NET game's methods while it runs
learn from: BepInEx | C# | LGPL-2.1 | https://github.com/BepInEx/BepInEx | Loading plug-ins into Unity games
learn from: Luanti | C++ | LGPL-2.1-or-later | https://github.com/luanti-org/luanti | A voxel game engine whose games are written in Lua
parts: lua-in-cpp, json-data, weighted-random, vectors-2d, game-states, settings-file`,

`type: graphics-3d
title: 3D and graphics
heading: Games and graphics
platforms: pc, web
about: Drawing with the graphics card: 3D scenes, visualisations, shaders and tools for artists.
language: C++ | Renderers with OpenGL, Vulkan, Direct3D or Metal | Dear ImGui, GLFW
language: JavaScript | 3D in the browser with WebGL and WebGPU | three.js, Babylon.js
language: Rust | Renderers and engines | wgpu, Bevy
language: Python | Blender add-ons and scripted scenes | Blender's bpy
learn from: three.js | JavaScript | MIT | https://github.com/mrdoob/three.js | Scenes, cameras, lights and materials in the browser
learn from: Bevy | Rust | MIT OR Apache-2.0 | https://github.com/bevyengine/bevy | A data-driven engine in Rust
learn from: wgpu | Rust | MIT OR Apache-2.0 | https://github.com/gfx-rs/wgpu | One graphics API over Vulkan, Metal, Direct3D and WebGPU
learn from: Dear ImGui | C++ | MIT | https://github.com/ocornut/imgui | Quick tool windows drawn every frame
parts: vectors-2d, rotate-point, angles, polygon-points, colour-codes, clamp-lerp-map, easing, game-loop, camera-follow
templates: pixel-painter, nightsky-web`,

// ---------------------------------------------------------------- Audio, music and video

`type: daw
title: Audio tools and DAWs
heading: Audio, music and video
platforms: pc
about: A digital audio workstation: tracks, a mixer, plug-ins, recording and editing on a timeline.
language: C++ | The audio engine, the mixer and plug-in hosting: real-time audio needs speed and no pauses | JUCE, Tracktion Engine, PortAudio, RtAudio
language: C | Low-level audio input and output, and plug-in standards | ALSA, JACK, PipeWire, CLAP
language: Lua | Scripting inside the DAW (Ardour runs Lua scripts) | Lua 5.4
language: Python | Batch processing, analysis and prototypes of effects | NumPy, SciPy, soundfile
language: Rust | Newer engines and plug-ins | cpal, nih-plug
learn from: Ardour | C++ | GPL-2.0-or-later | https://github.com/Ardour/ardour | A full DAW: tracks, buses, automation, plug-in hosting, transport and Lua scripting (read only: GPL code can't be copied here)
learn from: Audacity | C++ | GPL-3.0 | https://github.com/audacity/audacity | An editor: effects that work on a selection, undo history, file import and export
learn from: LMMS | C++ | GPL-2.0 | https://github.com/LMMS/lmms | Pattern-based music making: a piano roll, instruments, a mixer
parts: gain-db, pan-law, mix-bus, peak-meter, rms-meter, loudness-meter, biquad, smoother, compressor, limiter, gate, delay-line, crossfade, waveshaper, denormals, dc-blocker, ring-buffer, realtime-processor, wav-file, tempo-grid, metronome, midi-messages, undo-redo, lua-in-cpp, osc-messages, midi-between-apps
templates: daw, beat-grid`,

`type: audio-plugin
title: Audio plug-ins (VST3, AU, CLAP)
heading: Audio, music and video
platforms: pc
about: An effect or instrument that runs inside a DAW: the host calls it for every block of audio.
language: C++ | Nearly all plug-ins: the formats' SDKs are C or C++ | JUCE, iPlug2, DPF, VST 3 SDK, CLAP SDK
language: Rust | Plug-ins in Rust | nih-plug
language: C | The CLAP format itself is a C interface | CLAP SDK
learn from: CLAP | C | MIT | https://github.com/free-audio/clap | The open plug-in format: its headers say how hosts and plug-ins talk
learn from: VST 3 SDK | C++ | MIT | https://github.com/steinbergmedia/vst3sdk | Steinberg's SDK and example plug-ins
learn from: nih-plug | Rust | ISC | https://github.com/robbert-vdh/nih-plug | Plug-ins in Rust, exported as VST3 and CLAP
learn from: Airwindows | C++ | MIT | https://github.com/airwindows/airwindows | Hundreds of small effects, each a short, readable process loop
learn from: Surge XT | C++ | GPL-3.0 | https://github.com/surge-synthesizer/surge | A big synthesiser: oscillators, filters, modulation (read only)
learn from: JUCE | C++ | AGPL-3.0 | https://github.com/juce-framework/JUCE | The most used plug-in framework (also sold under a commercial licence)
parts: realtime-processor, gain-db, pan-law, smoother, biquad, compressor, limiter, gate, delay-line, waveshaper, denormals, dc-blocker, ring-buffer, peak-meter, adsr, oscillator, midi-note-frequency, tempo-grid
templates: daw`,

`type: audio-tool
title: Audio utilities
heading: Audio, music and video
platforms: pc
about: Converters, analysers, batch processors and recorders: tools that work on audio files or streams.
language: Python | Batch jobs and analysis: loudness, spectra, conversions | NumPy, SciPy, soundfile, librosa
language: C | Reading and writing audio formats | libsndfile, FFmpeg
language: C++ | Fast processing and real-time tools | JUCE, PortAudio
language: Rust | Decoders and fast command-line tools | Symphonia, cpal
language: JavaScript | Tools in the browser with Web Audio | Web Audio API
learn from: librosa | Python | ISC | https://github.com/librosa/librosa | Audio and music analysis: spectra, tempo, pitch
learn from: libsndfile | C | LGPL-2.1 | https://github.com/libsndfile/libsndfile | Reading and writing WAV, AIFF, FLAC and more
learn from: FFmpeg | C | LGPL-2.1-or-later | https://github.com/FFmpeg/FFmpeg | Decoding, encoding and filtering almost any audio or video
learn from: Pedalboard | C++ | GPL-3.0 | https://github.com/spotify/pedalboard | Audio effects for Python, with a C++ core
parts: wav-file, gain-db, peak-meter, rms-meter, loudness-meter, biquad, dc-blocker, crossfade, mix-bus, web-audio-graph, folder-walk, command-line-args, timing
templates: daw`,

`type: music-tool
title: Music and MIDI tools
heading: Audio, music and video
platforms: pc, web
about: Sequencers, synths, notation, practice tools and controllers: software that deals in notes as well as sound.
language: C++ | Synths and sequencers | JUCE, RtMidi
language: Python | Generating and analysing music, MIDI scripts | mido, music21, python-rtmidi
language: JavaScript | Music in the browser | Tone.js, Web MIDI API
language: Arduino | MIDI controllers and instruments built from buttons, knobs and sensors | MIDIUSB
learn from: MuseScore | C++ | GPL-3.0 | https://github.com/musescore/MuseScore | Notation: how a score is stored, laid out and played back
learn from: Sonic Pi | Ruby | MIT | https://github.com/sonic-pi-net/sonic-pi | Live coding music; its main source is MIT
learn from: Tone.js | TypeScript | MIT | https://github.com/Tonejs/Tone.js | Synths, effects and a transport for Web Audio
learn from: mido | Python | MIT | https://github.com/mido/mido | MIDI messages, ports and files in Python
parts: midi-note-frequency, note-names, scales-chords, tempo-grid, metronome, adsr, oscillator, midi-messages, midi-between-apps, osc-messages, web-audio-graph, delay-line, smoother
templates: beat-grid, melody-snake`,

`type: video-streaming
title: Video and streaming tools
heading: Audio, music and video
platforms: pc, web
about: Recording, mixing and sending live video and audio: streaming software, players, servers and overlays.
language: C | Encoding, decoding and OBS plug-ins | FFmpeg, OBS Studio API
language: C++ | Video mixing and processing | GStreamer, OpenCV
language: Python | Automation, overlays, batch transcoding | PyAV, OpenCV
language: JavaScript | Players and browser overlays; WebRTC for live calls | hls.js, WebRTC
language: Go | Media servers | MediaMTX, Pion
learn from: OBS Studio | C | GPL-2.0 | https://github.com/obsproject/obs-studio | Scenes, sources, audio mixing and streaming over RTMP and SRT
learn from: hls.js | TypeScript | Apache-2.0 | https://github.com/video-dev/hls.js | Playing HLS live streams in a browser
learn from: MediaMTX | Go | MIT | https://github.com/bluenviron/mediamtx | A media server for SRT, RTSP, RTMP, HLS and WebRTC
learn from: GStreamer | C | LGPL-2.1 | https://github.com/GStreamer/gstreamer | Pipelines of media elements
parts: gain-db, peak-meter, loudness-meter, compressor, limiter, crossfade, timing, udp-messages, py-js-websocket
templates: photo-booth`,

`type: broadcast
title: Broadcast and radio tools
heading: Audio, music and video
platforms: pc, web
about: Playout, automation, metering, monitoring and control for radio and TV, more and more over IP networks. AES67 (audio) and SMPTE ST 2110 (video, audio and data) are the open standards; Dante (Audinate) and Livewire+ (Telos Alliance) are widely used audio-over-IP systems that can also send and receive AES67; NDI (Vizrt) carries video over ordinary networks.
language: C++ | Real-time audio and the IP media standards: AES67 and SMPTE ST 2110 (RTP streams timed by PTP), NMOS for finding and connecting devices, Ember+ for control | nmos-cpp, Ember+ SDK, GStreamer, JUCE
language: C | Low-level networking and Linux audio: RTP, PTP (IEEE 1588), ALSA and PipeWire | linuxptp, PipeWire
language: Python | Automation and monitoring: silence and level alarms, logging, scheduling, device control over REST, Ember+ or OSC | asyncio, NumPy
language: JavaScript | Browser control panels and status pages that talk to devices over WebSockets and REST
language: OCaml | Liquidsoap, a stream and playout system, is written in it (its scripts are Liquidsoap's own language) | Liquidsoap
learn from: Liquidsoap | OCaml | GPL-2.0 | https://github.com/savonet/liquidsoap | Scripted playout and streaming: playlists, fallbacks, crossfades, outputs
learn from: AzuraCast | PHP | AGPL-3.0 | https://github.com/AzuraCast/AzuraCast | A web radio station: scheduling, AutoDJ, listener statistics
learn from: Icecast | C | GPL-2.0 | https://github.com/xiph/Icecast-Server | An audio streaming server
learn from: Ember+ | C++ | BSL-1.0 | https://github.com/Lawo/ember-plus | Lawo's open control protocol for broadcast devices, with libraries
learn from: nmos-cpp | C++ | Apache-2.0 | https://github.com/sony/nmos-cpp | AMWA NMOS registration, discovery and connection for ST 2110 systems
learn from: AES67 Linux daemon | C++ | GPL-3.0 | https://github.com/bondagit/aes67-linux-daemon | Sending and receiving AES67 streams on Linux, with PTP
learn from: SRT | C++ | MPL-2.0 | https://github.com/Haivision/srt | Secure Reliable Transport: contribution video and audio over the internet
parts: gain-db, pan-law, mix-bus, peak-meter, rms-meter, loudness-meter, biquad, compressor, limiter, gate, crossfade, dc-blocker, ring-buffer, wav-file, udp-messages, osc-messages, mqtt, logging, timing, dates-times, delay-line, smoother, realtime-processor
templates: daw`,

// ---------------------------------------------------------------- Data and automation

`type: data-analysis
title: Data analysis and charts
heading: Data and automation
platforms: pc, web
about: Loading tables of data, cleaning them, working out numbers and drawing charts.
language: Python | Loading, cleaning, calculating and plotting; notebooks to explore | pandas, NumPy, matplotlib, Jupyter
language: SQL | Asking questions of data in a database | SQLite, PostgreSQL, DuckDB
language: JavaScript | Interactive charts in a page | D3, Chart.js
language: CSV (a table) | The data itself, as it is often shared
learn from: pandas | Python | BSD-3-Clause | https://github.com/pandas-dev/pandas | Tables in Python: reading, grouping, joining
learn from: matplotlib | Python | Matplotlib licence (PSF-based) | https://github.com/matplotlib/matplotlib | The standard plotting library
learn from: D3 | JavaScript | ISC | https://github.com/d3/d3 | Charts drawn from data, piece by piece
learn from: Chart.js | JavaScript | MIT | https://github.com/chartjs/Chart.js | Ready-made charts for a page
learn from: Jupyter Notebook | Python | BSD-3-Clause | https://github.com/jupyter/notebook | Notebooks mixing code, results and notes
parts: csv-files, json-data, statistics, moving-average, group-count, dates-times, search-filter, sorting, line-chart, sql-queries, python-sqlite, clamp-lerp-map`,

`type: machine-learning
title: Machine learning
heading: Data and automation
platforms: pc, web
about: Programs that learn from examples: sorting things into kinds, predicting numbers, recognising images, sounds or text.
language: Python | Preparing data, training and testing models | scikit-learn, PyTorch, Hugging Face Transformers
language: C++ | Running trained models fast, on a computer or a device | ONNX Runtime, llama.cpp
language: JavaScript | Running models in the browser | ONNX Runtime Web, TensorFlow.js
language: SQL | Pulling training data from databases
learn from: scikit-learn | Python | BSD-3-Clause | https://github.com/scikit-learn/scikit-learn | Classic machine learning with a consistent interface
learn from: PyTorch | Python | BSD-3-Clause | https://github.com/pytorch/pytorch | Neural networks and training
learn from: nanoGPT | Python | MIT | https://github.com/karpathy/nanoGPT | A small language model you can read in an afternoon
learn from: llama.cpp | C++ | MIT | https://github.com/ggml-org/llama.cpp | Running language models fast on ordinary computers
parts: statistics, csv-files, json-data, moving-average, weighted-random, timing, py-cpp-pybind11, py-c-ctypes, clamp-lerp-map`,

`type: database
title: Databases and storage
heading: Data and automation
platforms: pc, web
about: Keeping data safe and findable: designing tables, asking questions, and the code around them.
language: SQL | Tables, indexes and queries | SQLite, PostgreSQL, MySQL, DuckDB
language: Python | Scripts and servers that read and write the data | sqlite3, SQLAlchemy
language: JavaScript | Node.js servers and the browser's own storage | Prisma, IndexedDB
language: Go | Database servers and tools
language: C | SQLite itself, and most database engines
learn from: SQLite | C | Public domain | https://www.sqlite.org | The most used database: one file, no server
learn from: PostgreSQL | C | PostgreSQL | https://www.postgresql.org | A full database server
learn from: DuckDB | C++ | MIT | https://github.com/duckdb/duckdb | A fast database for analysis, in one file
learn from: SQLAlchemy | Python | MIT | https://github.com/sqlalchemy/sqlalchemy | Talking to databases from Python
learn from: Valkey | C | BSD-3-Clause | https://github.com/valkey-io/valkey | An in-memory key-value store (a fork of Redis)
parts: sql-queries, python-sqlite, sql-parameters, cache-ttl, browser-storage, json-data, csv-files, undo-redo
templates: saas`,

`type: automation-script
title: Automation scripts
heading: Data and automation
platforms: pc
about: Small programs that do chores: renaming and sorting files, backups, reports, checking websites, moving data between apps.
language: Python | The usual choice: files, web requests, spreadsheets, schedules | pathlib, requests, schedule
language: Shell (Bash) | Chaining commands on Linux and macOS, cron jobs
language: JavaScript | Node.js scripts, and Google Apps Script for Google's apps
learn from: Ansible | Python | GPL-3.0 | https://github.com/ansible/ansible | Automating servers from plain YAML descriptions
learn from: Node-RED | JavaScript | Apache-2.0 | https://github.com/node-red/node-red | Wiring automations together in a browser
learn from: Huginn | Ruby | MIT | https://github.com/huginn/huginn | Agents that watch websites and act on what they find
parts: folder-walk, text-file, command-line-args, env-vars, logging, timing, csv-files, json-data, dates-times, fetch-retry, settings-file, node-py-stdio, shared-settings
templates: download-sorter, terminal`,

`type: office-automation
title: Office automation
heading: Data and automation
platforms: pc
about: Filling in spreadsheets, making documents and reports, and sorting email, without doing it by hand.
language: Python | Spreadsheets, Word documents, PDFs and email | openpyxl, python-docx, XlsxWriter, pandas
language: JavaScript | Google Apps Script for Sheets, Docs and Gmail
language: TypeScript | Office Scripts for Excel on the web
language: C# | Office add-ins and the Open XML SDK | Open XML SDK
learn from: python-docx | Python | MIT | https://github.com/python-openxml/python-docx | Making and editing Word documents
learn from: XlsxWriter | Python | BSD-2-Clause | https://github.com/jmcnamara/XlsxWriter | Writing Excel files with formats and charts
learn from: Open XML SDK | C# | MIT | https://github.com/dotnet/Open-XML-SDK | Word, Excel and PowerPoint files from .NET
parts: csv-files, dates-times, group-count, sorting, statistics, text-file, folder-walk, json-data
templates: terminal`,

`type: cli-tool
title: Command-line tools
heading: Data and automation
platforms: pc
about: Programs run by typing in a terminal: quick, scriptable, and able to feed their output to other tools.
language: Python | Quick tools with arguments, colour and progress | argparse, Click, Rich
language: Go | Single-file programs that start instantly | cobra
language: Rust | Fast tools | clap
language: Shell (Bash) | Wrapping other commands together
language: C | Classic Unix tools
learn from: ripgrep | Rust | MIT OR Unlicense | https://github.com/BurntSushi/ripgrep | A very fast search tool, with careful command-line design
learn from: fzf | Go | MIT | https://github.com/junegunn/fzf | A fuzzy finder that works with any list
learn from: HTTPie | Python | BSD-3-Clause | https://github.com/httpie/cli | A friendly HTTP client
learn from: bat | Rust | MIT OR Apache-2.0 | https://github.com/sharkdp/bat | cat with colours and line numbers
parts: command-line-args, folder-walk, text-file, env-vars, logging, timing, json-data, csv-files, progress-bar
templates: terminal, password-maker`,

// ---------------------------------------------------------------- Hardware and devices

`type: arduino-gadget
title: Arduino gadgets
heading: Hardware and devices
platforms: board
about: Small devices on an Arduino or ESP32 board: lights, buttons, sensors, motors and sound.
language: Arduino | The sketch on the board: setup and loop | Arduino core, FastLED, Servo
language: C++ | Arduino is C++, and bigger projects use it directly | PlatformIO, ESP-IDF
language: Python | Programs on the computer that talk to the board over USB | pyserial
language: JavaScript | A web page that talks to the board with Web Serial
learn from: Arduino AVR core | C | LGPL-2.1-or-later | https://github.com/arduino/ArduinoCore-avr | What pinMode, digitalWrite and millis really do
learn from: FastLED | C++ | MIT | https://github.com/FastLED/FastLED | Driving strips of colour LEDs
learn from: Marlin | C++ | GPL-3.0 | https://github.com/MarlinFirmware/Marlin | 3D-printer firmware: motors, heaters, safety checks
learn from: grbl | C | GPL-3.0-or-later | https://github.com/gnea/grbl | Motion control for CNC machines on an Arduino Uno
parts: button-debounce, without-delay, pwm-fade, servo, distance-sensor, thermistor, moving-average, clamp-lerp-map, midi-note-frequency, metronome, midi-messages, oscillator, py-arduino-serial, js-arduino-webserial
templates: gadget`,

`type: raspberry-pi
title: Raspberry Pi projects
heading: Hardware and devices
platforms: board, pc
about: A small Linux computer with pins: home servers, cameras, displays, and gadgets that need more than an Arduino.
language: Python | Pins, cameras and sensors | gpiozero, picamera2
language: Shell (Bash) | Setting up services and scheduled jobs
language: C | Fast access to hardware
language: JavaScript | Dashboards and Node-RED flows | Node-RED
learn from: gpiozero | Python | BSD-3-Clause | https://github.com/gpiozero/gpiozero | Buttons, LEDs and sensors as simple objects
learn from: Picamera2 | Python | BSD-2-Clause | https://github.com/raspberrypi/picamera2 | The camera library
learn from: MagicMirror² | JavaScript | MIT | https://github.com/MagicMirrorOrg/MagicMirror | A modular information display
learn from: Pi-hole | Shell (Bash) | EUPL-1.2 | https://github.com/pi-hole/pi-hole | A network-wide ad blocker
parts: button-debounce, pwm-fade, servo, distance-sensor, thermistor, mqtt, udp-messages, logging, timing, env-vars, py-arduino-serial, moving-average`,

`type: robotics
title: Robotics
heading: Hardware and devices
platforms: board, pc
about: Robots and drones: sensors in, decisions, motors out, many times a second.
language: C++ | Control loops and drivers that must keep time | ROS 2 (rclcpp), PX4
language: Python | Higher-level behaviour, tools and tests | ROS 2 (rclpy), NumPy
language: Arduino | Motor and sensor boards | Servo, AccelStepper
learn from: ROS 2 rclpy | Python | Apache-2.0 | https://github.com/ros2/rclpy | Nodes, topics and services in Python
learn from: ROS 2 rclcpp | C++ | Apache-2.0 | https://github.com/ros2/rclcpp | The same in C++
learn from: PX4 Autopilot | C++ | BSD-3-Clause | https://github.com/PX4/PX4-Autopilot | Flight control for drones
learn from: ArduPilot | C++ | GPL-3.0 | https://github.com/ArduPilot/ardupilot | Autopilot for planes, copters, rovers and boats
parts: servo, distance-sensor, moving-average, clamp-lerp-map, vectors-2d, rotate-point, angles, game-states, timing, without-delay, udp-messages, py-arduino-serial
templates: gadget`,

`type: smart-home
title: Smart home
heading: Hardware and devices
platforms: board, pc, web
about: Sensors, switches and lights around the house, tied together by a hub and automations.
language: Python | Home Assistant and its integrations | Home Assistant
language: YAML | Automations and device settings in Home Assistant and ESPHome | ESPHome
language: C++ | Firmware for ESP32 and ESP8266 devices | ESPHome, Tasmota, Arduino
language: JavaScript | Flows and dashboards | Node-RED, Zigbee2MQTT
learn from: Home Assistant | Python | Apache-2.0 | https://github.com/home-assistant/core | The hub: integrations, automations, the state of every device
learn from: ESPHome | C++ | MIT (Python) and GPL-3.0 (C++) | https://github.com/esphome/esphome | Device firmware made from YAML descriptions
learn from: Tasmota | C | GPL-3.0 | https://github.com/arendst/Tasmota | Firmware for many ESP-based plugs and switches
learn from: Zigbee2MQTT | TypeScript | GPL-3.0 | https://github.com/Koenkk/zigbee2mqtt | Zigbee devices on MQTT
learn from: Mosquitto | C | EPL-2.0 OR BSD-3-Clause | https://github.com/eclipse-mosquitto/mosquitto | A small MQTT broker
parts: mqtt, thermistor, button-debounce, without-delay, json-data, dates-times, logging, rate-limit, shared-settings
templates: gadget`,

);
