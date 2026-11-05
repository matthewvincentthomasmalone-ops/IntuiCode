/* IntuaCode Library — Coding integration: ready-made code that lets two languages work together in one
 * project. Every part gives both sides; the file names show how they fit (which file loads, calls or
 * builds which). */
(window.IntuiLibraryPacks = window.IntuiLibraryPacks || []).push(

`part: py-js-http
title: Python and JavaScript over HTTP
group: integration
types: web-app, api-service
about: A Flask server in Python answers JSON; the page's JavaScript fetches it and sends changes back.
summary: The browser and the server are separate programs that talk in HTTP requests with JSON in them. Flask serves the page from its static folder and has two routes, GET to read the level and POST to change it; the page's script fetches the first when it loads and sends the second when the fader moves. The server checks and clamps what it receives, because anything from a browser can be changed.
learn: The A web route that answers JSON part; fetch and await; the browser's developer tools (Network tab).
source: Flask quickstart | https://flask.palletsprojects.com/en/stable/quickstart/ | routes, static files and jsonify
source: Fetch API (MDN) | https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API | fetch, JSON bodies and await
== python app.py
python: from flask import Flask, jsonify, request

make a new Flask with __name__, static_folder="static", static_url_path="" and store in app
set level_db to -6.0

when app gets GET at "/"
define home
    give back app.send_static_file("index.html")

when app gets GET at "/api/level"
define read level
    give back jsonify({"level_db": level_db})

when app gets POST at "/api/level"
define change level
    use the shared level_db
    set data to request.get_json(silent=True) or {}
    set level_db to max(-60.0, min(6.0, float(data.get("level_db", level_db))))
    give back jsonify({"level_db": level_db})

if this file is run directly
    run app.run with port=5000, debug=True
== html static/index.html
add a slider called fader from -60 to 6
add a paragraph called readout "…"
== js static/script.js
when the page has loaded
    fetch from "/api/level" and store in reply
    set fader.value to reply.level_db
    set the text of readout to "{reply.level_db} dB"
when fader is changed
    send { level_db: Number(fader.value) } to "/api/level" and store the reply in reply
    set the text of readout to "{reply.level_db} dB"`,

`part: py-js-websocket
title: Python and JavaScript over a WebSocket
group: integration
types: web-app, chat-bot, broadcast, video-streaming
about: A Python server and browser pages that send each other messages the moment something happens.
summary: HTTP is question and answer; a WebSocket stays open so either side can send at any time, which suits chat, live meters and control panels. The Python server (the websockets library, on asyncio) keeps a set of connected browsers and passes each message on to the others; the page opens the socket, listens for messages and sends its own as JSON.
learn: async and await in Python; events in the browser; the Python and JavaScript over HTTP part.
source: websockets (Python library) | https://websockets.readthedocs.io/en/stable/ | serve, async iteration over messages, send
source: WebSocket (MDN) | https://developer.mozilla.org/en-US/docs/Web/API/WebSocket | the browser side: open, message events, send
== python server.py
import asyncio
import websockets

set clients to set()

define async handle using connection
    description: Each browser that connects: its messages go to every other browser.
    run clients.add with connection
    try
        repeat forever
            set message to wait for connection.recv()
            for each other in list(clients)
                if other is not connection
                    wait for other.send(message)
    if it fails with websockets.ConnectionClosed
        note: The browser went away: nothing to do but forget it.
        do nothing
    in any case
        run clients.discard with connection

define async main
    async using websockets.serve(handle, "localhost", 8765)
        wait for asyncio.Future()

if this file is run directly
    run asyncio.run with main()
== html index.html
add a text box called draft with hint "Say something"
add a button called send saying "Send"
add a list called messages
== js script.js
constant socket is new WebSocket("ws://localhost:8765")
define received using event
    constant data is JSON.parse(event.data)
    add data.text to the list messages
run socket.addEventListener with "message", received
when send is clicked
    get the text of draft and store in typed
    run socket.send with JSON.stringify({ text: typed })
    add typed to the list messages`,

`part: py-c-ctypes
title: Python calling C++ with ctypes
group: integration
types: audio-tool, machine-learning, daw, data-analysis
about: Build fast C++ into a shared library with a C interface, and call it from Python with nothing to install.
summary: Python can load a shared library (.dll, .so or .dylib) with ctypes, which comes with Python, and call its functions, as long as they have a plain C interface: extern "C" turns off C++'s name mangling, and on Windows dllexport makes the function visible. Python must be told each function's argument and result types, and passes a block of floats it made itself, so the C++ changes Python's samples in place without copying.
learn: Shared libraries; C types (float, int, pointers); compiling with -shared.
source: ctypes (Python docs) | https://docs.python.org/3/library/ctypes.html | CDLL, argtypes, restype and arrays of c_float
== cpp gain.cpp
include cmath
above main: extern "C" {
above main: #if defined(_MSC_VER)
above main: __declspec(dllexport) void apply_gain(float* samples, int count, float db);
above main: __declspec(dllexport) float peak_db(const float* samples, int count);
above main: #endif

define apply_gain using float* samples, int count, float db giving back nothing
    note: extern "C" keeps the plain C names Python looks for. Visual Studio's compiler also needs __declspec(dllexport) to make them visible outside the .dll; g++ and clang make them visible anyway.
    set float g to std::pow(10.0f, db / 20.0f)
    repeat count times counting with i
        set samples[i] to samples[i] * g

define peak_db using const float* samples, int count giving back float
    set float loudest to 0.000001f
    repeat count times counting with i
        set loudest to std::fmax(loudest, std::fabs(samples[i]))
    give back 20.0f * std::log10(loudest)

above main: }
== bash build.sh
#!/usr/bin/env bash
# Builds gain.cpp into the shared library gain.py loads.
set -euo pipefail
system="$(uname -s)"
if [ "$system" = "Darwin" ]; then
  g++ -O2 -std=c++20 -shared -fPIC gain.cpp -o libgain.dylib
elif [ "$system" = "Linux" ]; then
  g++ -O2 -std=c++20 -shared -fPIC gain.cpp -o libgain.so
else
  # Windows, in Git Bash or MSYS2 with MinGW's g++
  g++ -O2 -std=c++20 -shared gain.cpp -o gain.dll
fi
== python gain.py
import ctypes
import os
import sys

set file_name to "gain.dll" if sys.platform is "win32" otherwise ("libgain.dylib" if sys.platform is "darwin" otherwise "libgain.so")
set lib to ctypes.CDLL(os.path.join(os.path.dirname(os.path.abspath(__file__)), file_name))
set lib.apply_gain.argtypes to [ctypes.POINTER(ctypes.c_float), ctypes.c_int, ctypes.c_float]
set lib.apply_gain.restype to None
set lib.peak_db.argtypes to [ctypes.POINTER(ctypes.c_float), ctypes.c_int]
set lib.peak_db.restype to ctypes.c_float

define apply gain using samples, db
    description: Runs the C++ apply_gain on a list of samples; gives back the changed samples.
    set buffer to (ctypes.c_float * len(samples))(*samples)
    run lib.apply_gain with buffer, len(samples), db
    give back list(buffer)

define peak db using samples
    set buffer to (ctypes.c_float * len(samples))(*samples)
    give back lib.peak_db(buffer, len(samples))`,

`part: py-cpp-pybind11
title: Python calling C++ with pybind11
group: integration
types: machine-learning, audio-tool, data-analysis
about: Turn C++ functions into a Python module that takes and gives back ordinary Python lists.
summary: pybind11 writes the glue between Python and C++: a few lines in PYBIND11_MODULE list the functions, and it converts Python lists to std::vector and back, numbers to float, and C++ exceptions to Python ones. The result is a module Python imports like any other. Unlike ctypes it has to be compiled against Python's headers, but no types are declared by hand on the Python side.
learn: Compiling a Python extension; the Python calling C++ with ctypes part, for comparison.
source: pybind11 First steps | https://pybind11.readthedocs.io/en/stable/basics.html | PYBIND11_MODULE, m.def and the build command
== cpp module.cpp
include pybind11/pybind11.h
include pybind11/stl.h
include vector
include cmath

define apply_gain using std::vector<float> samples, float db giving back std::vector<float>
    set float g to std::pow(10.0f, db / 20.0f)
    repeat static_cast<int>(samples.size()) times counting with i
        set samples[i] to samples[i] * g
    give back samples

above main: PYBIND11_MODULE(fastgain, m) {
above main:     m.doc() = "Gain in C++, called from Python.";
above main:     m.def("apply_gain", &apply_gain, "Changes samples by db decibels.");
above main: }
== bash build.sh
#!/usr/bin/env bash
# Builds module.cpp into the fastgain module (needs: pip install pybind11).
set -euo pipefail
c++ -O3 -Wall -shared -std=c++20 -fPIC $(python3 -m pybind11 --includes) module.cpp -o fastgain$(python3-config --extension-suffix)
== python use.py
import fastgain

set quieter to fastgain.apply_gain([0.5, 1.0, -0.25], -6.0)
show quieter`,

`part: cpp-js-wasm
title: C++ in a web page with WebAssembly
group: integration
types: browser-game, audio-tool, web-app, graphics-3d
about: Compile C++ with Emscripten into WebAssembly, and call it from the page's JavaScript.
summary: Emscripten compiles C++ to WebAssembly, which browsers run at close to native speed, plus a JavaScript file that loads it. Functions inside extern "C" and named in the build's EXPORTED_FUNCTIONS can be called from JavaScript, with an underscore in front. They share one block of memory: JavaScript asks for space with _malloc, copies the samples into HEAPF32, calls the function with the address, copies the result out and frees the space.
learn: Memory as one long array of bytes; addresses (pointers); the Python calling C++ with ctypes part (the same C interface).
source: Emscripten, Interacting with code | https://emscripten.org/docs/porting/connecting_cpp_and_javascript/Interacting-with-code.html | EXPORTED_FUNCTIONS, MODULARIZE, _malloc and HEAPF32
== cpp dsp.cpp
include cmath
above main: extern "C" {

define apply_gain using float* samples, int count, float db giving back nothing
    note: extern "C" keeps the plain name; build.sh's EXPORTED_FUNCTIONS keeps it in the WebAssembly and lets JavaScript call it as _apply_gain.
    set float g to std::pow(10.0f, db / 20.0f)
    repeat count times counting with i
        set samples[i] to samples[i] * g

above main: }
== bash build.sh
#!/usr/bin/env bash
# Builds dsp.cpp into dsp.js and dsp.wasm, which index.html loads.
set -euo pipefail
emcc dsp.cpp -O3 -sMODULARIZE -sEXPORT_NAME=createDsp -sEXPORTED_FUNCTIONS=_apply_gain,_malloc,_free -sEXPORTED_RUNTIME_METHODS=HEAPF32 -o dsp.js
== html index.html
head: <script src="dsp.js"></script>
add a button called run saying "Run the C++"
add a paragraph called result ""
== js script.js
set dsp to nothing
when run is clicked
    note: The WebAssembly is loaded once, the first time it is needed.
    if dsp is nothing
        wait for createDsp() and store in dsp
    constant samples is new Float32Array([0.5, 1, -0.25])
    constant address is dsp._malloc(samples.length * 4)
    run dsp.HEAPF32.set with samples, address / 4
    run dsp._apply_gain with address, samples.length, -6
    constant changed is dsp.HEAPF32.slice(address / 4, address / 4 + samples.length)
    run dsp._free with address
    set the text of result to Array.from(changed).join(", ")`,

`part: py-arduino-serial
title: Python and an Arduino over USB serial
group: integration
types: arduino-gadget, raspberry-pi, robotics
about: A Python program on the computer sends commands to a board and reads its readings, over the USB cable.
summary: The board's Serial and the computer's serial port are two ends of one line of text. Both sides agree on a speed (115200 here) and a simple protocol: one command or reading per line, ended by a newline. The sketch reads a whole line before acting and reports a reading once a second; pyserial opens the port, waits for the board to restart (opening the port resets most Arduinos), writes commands and reads lines.
learn: Serial ports and speeds; text protocols; the Doing several things at once part (reporting without delay).
source: pySerial short introduction | https://pyserial.readthedocs.io/en/latest/shortintro.html | Serial, write, readline and timeouts
source: Arduino Serial reference | https://docs.arduino.cc/language-reference/en/functions/communication/serial/ | begin, available, readStringUntil
== arduino board.ino
constant LED is 13
set unsigned long reported_at to 0

when the board starts
    make pin LED an output
    start the serial monitor at 115200

over and over
    if Serial.available() is more than 0
        set String line to Serial.readStringUntil('\\n')
        run line.trim
        if line is "LED 1"
            turn pin LED on
        otherwise if line is "LED 0"
            turn pin LED off
    if millis() - reported_at is at least 1000
        set reported_at to millis()
        show "level " followed by analogRead(A0)
== python host.py
import serial
import time

define talk to board using port="COM3"
    description: Turns the board's light on, shows three readings, and turns it off. On Linux the port is like /dev/ttyACM0, on a Mac /dev/cu.usbmodem….
    using serial.Serial(port, 115200, timeout=2) as board
        note: Opening the port restarts most boards: give it two seconds.
        run time.sleep with 2
        run board.write with b"LED 1\\n"
        repeat 3 times
            set line to board.readline().decode("utf-8", errors="replace").strip()
            if line
                show line
        run board.write with b"LED 0\\n"`,

`part: js-arduino-webserial
title: A web page and an Arduino (Web Serial)
group: integration
types: arduino-gadget, webpage
about: A page in Chrome or Edge connects to a board over USB and talks to it, with no program to install.
summary: The Web Serial API lets a page open a serial port, but only after a click and the person choosing the port, so a page can't reach devices on its own. The page writes commands as text and reads the board's lines as they arrive, joining pieces until a newline comes. The sketch is the same as the Python and Arduino part, so either side can be swapped. Web Serial works in Chromium browsers (Chrome, Edge, Opera), not in Firefox or Safari.
learn: The Python and an Arduino part; streams and waiting for data; why browsers ask permission.
source: Web Serial API (MDN) | https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API | requestPort, open, readable and writable streams
== arduino board.ino
constant LED is 13
set unsigned long reported_at to 0

when the board starts
    make pin LED an output
    start the serial monitor at 115200

over and over
    if Serial.available() is more than 0
        set String line to Serial.readStringUntil('\\n')
        run line.trim
        if line is "LED 1"
            turn pin LED on
        otherwise if line is "LED 0"
            turn pin LED off
    if millis() - reported_at is at least 1000
        set reported_at to millis()
        show "level " followed by analogRead(A0)
== html index.html
add a button called connect saying "Connect to the board"
add a button called on saying "Light on"
add a button called off saying "Light off"
add a paragraph called status "Not connected"
== js script.js
set port to nothing
set writer to nothing
define readLines
    description: Shows each line the board sends, as it arrives.
    constant reader is port.readable.pipeThrough(new TextDecoderStream()).getReader()
    set buffered to ""
    while true
        wait for reader.read() and store in chunk
        if chunk.done
            stop the loop
        set buffered to buffered + chunk.value
        constant lines is buffered.split("\\n")
        set buffered to lines.pop()
        for each line in lines
            set the text of status to line.trim()
when connect is clicked
    wait for navigator.serial.requestPort() and store in chosen
    wait for chosen.open({ baudRate: 115200 })
    set port to chosen
    set writer to port.writable.getWriter()
    run readLines
when on is clicked
    wait for writer.write(new TextEncoder().encode("LED 1\\n"))
when off is clicked
    wait for writer.write(new TextEncoder().encode("LED 0\\n"))`,

`part: node-py-stdio
title: Node.js and Python through standard input and output
group: integration
types: automation-script, desktop-app, machine-learning, chat-bot
about: A Node.js program starts Python as a helper and sends it requests as lines of JSON; Python answers the same way.
summary: The simplest link between two programs on one computer is a pipe: the parent starts the child and writes to its standard input, and reads its standard output. One JSON object per line keeps messages apart; an id on each request lets answers be matched up even when several are waiting. Python must flush each answer so it's sent at once, and anything that isn't an answer (logs, errors) goes to standard error so it never mixes in.
learn: Processes, standard input and output; promises; JSON.
source: Node.js child_process | https://nodejs.org/api/child_process.html | spawn and its stdio pipes
== python worker.py
import json
import sys

define handle using request
    description: One request (a dictionary) gives one reply.
    if request.get("op") is "gain"
        set g to 10 ** (item "db" of request divided by 20)
        give back {"id": request.get("id"), "result": [x * g for x in request["samples"]]}
    give back {"id": request.get("id"), "error": "unknown op"}

if this file is run directly
    for each line in sys.stdin
        set reply to the result of handle with json.loads(line)
        run print with json.dumps(reply), flush=True
== js main.js
js: const childProcess = require("node:child_process");
js: const readline = require("node:readline");
js: const python = process.platform === "win32" ? "python" : "python3";
constant worker is childProcess.spawn(python, ["worker.py"], { stdio: ["pipe", "pipe", "inherit"] })
constant waiting is new Map()
set nextId to 1
define ask using request
    description: Sends one request to Python; gives back a promise of its reply.
    constant id is nextId
    increase nextId
    run worker.stdin.write with JSON.stringify({ ...request, id: id }) + "\\n"
    give back new Promise((resolve) => waiting.set(id, resolve))
define answered using line
    constant reply is JSON.parse(line)
    constant resolve is waiting.get(reply.id)
    run waiting.delete with reply.id
    run resolve with reply
constant lines is readline.createInterface({ input: worker.stdout })
run lines.on with "line", answered
define main
    wait for ask({ op: "gain", db: -6, samples: [0.5, 1] }) and store in reply
    show reply.result
    run worker.stdin.end
run main`,

`part: csharp-cpp-pinvoke
title: C# calling C++ (P/Invoke)
group: integration
types: desktop-app, pc-game
about: A C# app (WPF, Avalonia, Unity) calls a function in a C++ library built for speed.
summary: .NET's P/Invoke calls functions in native libraries. The C++ side has a C interface (extern "C", exported); the C# side declares the same function with DllImport and matching types: float is float, int is int, and a float[] arrives as a pointer to its first element. "gain" finds gain.dll on Windows, libgain.so on Linux and libgain.dylib on macOS. Newer .NET can use LibraryImport, which generates the same call at build time.
learn: The Python calling C++ with ctypes part (the same C++ file); C# attributes; copying versus pinning arrays.
source: Platform Invoke (P/Invoke), Microsoft Learn | https://learn.microsoft.com/en-us/dotnet/standard/native-interop/pinvoke | DllImport and LibraryImport declarations
== cpp gain.cpp
include cmath
above main: extern "C" {
above main: #if defined(_MSC_VER)
above main: __declspec(dllexport) void apply_gain(float* samples, int count, float db);
above main: #endif

define apply_gain using float* samples, int count, float db giving back nothing
    note: extern "C" keeps the plain C name C# looks for. Visual Studio's compiler also needs __declspec(dllexport) to make it visible outside the .dll; g++ and clang make it visible anyway.
    set float g to std::pow(10.0f, db / 20.0f)
    repeat count times counting with i
        set samples[i] to samples[i] * g

above main: }
== csharp Program.cs
using System;
using System.Runtime.InteropServices;

public static class NativeGain
{
    // The C++ function in gain.dll (Windows), libgain.so (Linux) or libgain.dylib (macOS).
    [DllImport("gain", CallingConvention = CallingConvention.Cdecl)]
    private static extern void apply_gain([In, Out] float[] samples, int count, float db);

    public static void Main()
    {
        float[] samples = { 0.5f, 1.0f, -0.25f };
        apply_gain(samples, samples.Length, -6.0f);
        Console.WriteLine(string.Join(", ", samples));
    }
}`,

`part: rust-py-pyo3
title: Python calling Rust (PyO3)
group: integration
types: machine-learning, data-analysis, audio-tool, cli-tool
about: Write a fast function in Rust and import it in Python as an ordinary module.
summary: PyO3 turns Rust functions into a Python module: #[pyfunction] marks a function, #[pymodule] gathers them, and Python lists, numbers and text convert to Vec, f32 and String on the way in and out. maturin builds it (maturin develop installs it into the current virtual environment), so import rustgain then works like any other module. Rust's checks catch whole kinds of memory mistakes at compile time.
learn: Cargo and crates; Rust's Vec and iterators; virtual environments in Python.
source: PyO3 user guide | https://pyo3.rs/ | #[pyfunction], #[pymodule] and building with maturin
== rust src/lib.rs
use pyo3::prelude::*;

#[pymodule]
mod rustgain {
    use pyo3::prelude::*;

    /// Changes samples by db decibels.
    #[pyfunction]
    fn apply_gain(samples: Vec<f32>, db: f32) -> Vec<f32> {
        let gain = 10f32.powf(db / 20.0);
        samples.into_iter().map(|s| s * gain).collect()
    }
}
== toml Cargo.toml
[package]
name = "rustgain"
version = "0.1.0"
edition = "2021"

[lib]
name = "rustgain"
crate-type = ["cdylib"]

[dependencies]
pyo3 = "0.30"
== python use.py
import rustgain

set quieter to rustgain.apply_gain([0.5, 1.0, -0.25], -6.0)
show quieter`,

`part: rust-c-ffi
title: Rust and C (FFI)
group: integration
types: desktop-app, cli-tool, audio-plugin
about: Export a Rust function with a C interface and call it from a C program, the way most languages can reach Rust.
summary: extern "C" gives a Rust function C's calling convention and #[no_mangle] keeps its name, so C (and anything that can call C: Python, C#, Swift, Go) can call it. The header gain.h tells C what the function looks like. Rust can't check a raw pointer from C, so the function is unsafe and says what the caller must promise; inside, the pointer becomes a slice and ordinary safe Rust takes over.
learn: Pointers and lengths; what unsafe means in Rust; static and dynamic libraries.
source: The Rustonomicon, FFI | https://doc.rust-lang.org/nomicon/ffi.html | extern "C", no_mangle and calling Rust from C
== rust src/lib.rs
/// Changes \`count\` samples at \`samples\` by \`db\` decibels. Called from C.
///
/// # Safety
/// \`samples\` must point to \`count\` floats that nothing else is using during the call.
#[no_mangle]
pub unsafe extern "C" fn apply_gain(samples: *mut f32, count: usize, db: f32) {
    if samples.is_null() {
        return;
    }
    let gain = 10f32.powf(db / 20.0);
    let buffer = std::slice::from_raw_parts_mut(samples, count);
    for s in buffer.iter_mut() {
        *s *= gain;
    }
}
== toml Cargo.toml
[package]
name = "gain"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "staticlib"]
== c gain.h
#ifndef GAIN_H
#define GAIN_H

#include <stddef.h>

/* Written in Rust (src/lib.rs): changes count samples by db decibels. */
void apply_gain(float *samples, size_t count, float db);

#endif
== c main.c
#include <stdio.h>
#include "gain.h"

int main(void) {
    float samples[] = {0.5f, 1.0f, -0.25f};
    apply_gain(samples, 3, -6.0f);
    for (int i = 0; i < 3; i++) {
        printf("%f\\n", samples[i]);
    }
    return 0;
}`,

`part: swift-c
title: Swift calling C
group: integration
types: phone-app-ios, desktop-app
about: Use a C library from Swift: the module map (or an Xcode bridging header) makes its functions callable directly.
summary: Swift imports C headers itself: a module map names the header and the library, and import Gain then makes its functions available, with C types turned into Swift ones (float becomes Float, a float pointer becomes UnsafeMutablePointer<Float>). withUnsafeMutableBufferPointer lends the array's memory to C for the length of the call only. In an Xcode app, a bridging header that includes gain.h does the same job.
learn: Swift arrays and pointers; headers; the Rust and C part (the same C interface works for Rust).
source: Swift, Mixing Swift and C++ (C interoperability) | https://www.swift.org/documentation/cxx-interop/ | importing C headers through a module map
== c gain.h
#ifndef GAIN_H
#define GAIN_H

/* Changes count samples by db decibels, in place. */
void apply_gain(float *samples, int count, float db);

#endif
== c gain.c
#include <math.h>
#include "gain.h"

void apply_gain(float *samples, int count, float db) {
    float g = powf(10.0f, db / 20.0f);
    for (int i = 0; i < count; i++) {
        samples[i] *= g;
    }
}
== text module.modulemap
module Gain {
    header "gain.h"
    link "gain"
    export *
}
== swift main.swift
import Gain

var samples: [Float] = [0.5, 1.0, -0.25]
samples.withUnsafeMutableBufferPointer { buffer in
    apply_gain(buffer.baseAddress, Int32(buffer.count), -6.0)
}
print(samples)`,

`part: kotlin-cpp-jni
title: Kotlin (or Java) calling C++ (JNI)
group: integration
types: phone-app-android, phone-game
about: An Android app calls C++ for audio or image work through the Java Native Interface.
summary: Kotlin declares the function as external and loads the library; C++ provides a function with the long name JNI looks for: Java_, the package, the class and the method, with dots as underscores. JNI hands arrays over as handles, so the C++ asks for the floats, works on them and releases them, which copies the changes back. Here the work itself is an ordinary C++ tool written in sentences; only the glue is exact code. On Android, the NDK and CMake build the library.
learn: Packages and class names; the Android NDK; why JNI calls cost more than ordinary calls (do a whole block per call).
source: JNI tips (Android Developers) | https://developer.android.com/ndk/guides/jni-tips | native method names, arrays and releasing them
== kotlin NativeGain.kt
package com.example.audio

object NativeGain {
    init {
        System.loadLibrary("nativegain")
    }

    /** Changes the samples in place by db decibels, in C++. */
    external fun applyGain(samples: FloatArray, db: Float)
}
== cpp native_gain.cpp
include jni.h
include cmath

define apply_gain using float* samples, int count, float db giving back nothing
    set float g to std::pow(10.0f, db / 20.0f)
    repeat count times counting with i
        set samples[i] to samples[i] * g

above main: // The name JNI looks for: Java_, then the package and class with _ for dots, then the method. JNIEXPORT and JNICALL in jni.h come to the visibility attribute below on Android.
above main: extern "C" __attribute__((visibility("default"))) void
above main: Java_com_example_audio_NativeGain_applyGain(JNIEnv* env, jobject, jfloatArray samples, jfloat db) {
above main:     jsize count = env->GetArrayLength(samples);
above main:     jfloat* data = env->GetFloatArrayElements(samples, nullptr);
above main:     apply_gain(data, count, db);
above main:     env->ReleaseFloatArrayElements(samples, data, 0);
above main: }`,

`part: lua-in-cpp
title: Lua scripts inside a C++ program
group: integration
types: game-mod, daw, pc-game
about: Let users (or level designers) change behaviour with Lua scripts, while the program itself stays C++.
summary: Lua is small and made to be embedded: a C++ program creates a Lua state, loads a script and calls its functions through a stack (push the arguments, call, read the result off the top). Games and DAWs (Ardour among them) use this so behaviour can change without rebuilding the program. Errors in the script come back as messages instead of crashing the host.
learn: The Lua language; stacks; the difference between the host program and its scripts.
source: Lua 5.4 Reference Manual, the C API | https://www.lua.org/manual/5.4/manual.html | luaL_newstate, luaL_dofile, lua_getglobal, lua_pcall and the stack
== cpp host.cpp
include lua.hpp

note: Runs script.lua, then calls its tool "process" with 0.5 and shows what it gives back.
c++: lua_State* lua = luaL_newstate();
c++: const int ok = LUA_OK;
c++: luaL_openlibs(lua);
if luaL_dofile(lua, "script.lua") is not ok
    show "Lua error: " followed by lua_tostring(lua, -1)
otherwise
    c++: lua_getglobal(lua, "process");
    c++: lua_pushnumber(lua, 0.5);
    if lua_pcall(lua, 1, 1, 0) is ok
        show "process(0.5) = " followed by lua_tonumber(lua, -1)
    otherwise
        show "Lua error: " followed by lua_tostring(lua, -1)
c++: lua_close(lua);
== lua script.lua
-- Called from C++ (host.cpp): a sample in, the sample soft-clipped out.
function process(x)
  local drive = 2.0
  local y = x * drive
  if y > 1 then
    y = 1
  elseif y < -1 then
    y = -1
  end
  return 1.5 * (y - y ^ 3 / 3)
end`,

`part: osc-messages
title: OSC between apps
group: integration
types: daw, music-tool, broadcast, video-streaming
about: Send and receive Open Sound Control messages: how DAWs, mixers, lighting and control surfaces talk over a network.
summary: An OSC message is a UDP packet holding an address like /mixer/fader/1, a list of type tags (f for a 32-bit decimal, i for a whole number, s for text) and the values, big-endian, each part padded to a multiple of four bytes. Many DAWs and control apps accept OSC; their manuals list the addresses. These two files build and read messages with nothing but Python's own modules, so the format is visible; the python-osc library does the same with more checks.
learn: The Sending and receiving UDP messages part; bytes and big-endian numbers; padding.
source: OpenSoundControl Specification 1.0 | https://opensoundcontrol.stanford.edu/spec-1_0.html | OSC-strings, type tags and big-endian int32 and float32
== python send.py
import socket
import struct

define osc text using text
    description: Text the OSC way: UTF-8, a zero byte, then zeros up to a multiple of 4 bytes.
    set data to text.encode("utf-8") + b"\\0"
    give back data + b"\\0" * (-len(data) % 4)

define osc message using address, values
    description: An OSC message: the address, the type tags, then each value (decimal, whole number or text).
    set tags to ","
    set body to b""
    for each v in values
        if isinstance(v, float)
            add "f" to tags
            add struct.pack(">f", v) to body
        otherwise if isinstance(v, int)
            add "i" to tags
            add struct.pack(">i", v) to body
        otherwise
            add "s" to tags
            set piece to the result of osc text with str(v)
            add piece to body
    give back osc text(address) + osc text(tags) + body

define send osc using address, values, host="127.0.0.1", port=9000
    description: Sends one OSC message over UDP, e.g. send osc with "/mixer/fader/1", [0.75].
    using socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sender
        run sender.sendto with osc message(address, values), (host, port)
== python listen.py
import socket
import struct

define read text using data, at
    description: The OSC text starting at position at, and where the next part starts.
    set end to data.index(b"\\0", at)
    give back data[at:end].decode("utf-8"), (end + 4) // 4 * 4

define parse osc using data
    description: The address and the values of one OSC message.
    set first to the result of read text with data, 0
    set second to the result of read text with data, item 1 of first
    set tags to item 0 of second
    set at to item 1 of second
    create list values
    for each tag in tags[1:]
        if tag is "f"
            add struct.unpack(">f", data[at:at + 4])[0] to values
            increase at by 4
        otherwise if tag is "i"
            add struct.unpack(">i", data[at:at + 4])[0] to values
            increase at by 4
        otherwise if tag is "s"
            set piece to the result of read text with data, at
            add item 0 of piece to values
            set at to item 1 of piece
    give back item 0 of first, values

define listen osc using port=9000
    description: Shows every OSC message that arrives on a port, until the program is stopped.
    using socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as listener
        run listener.bind with ("0.0.0.0", port)
        repeat forever
            set packet to listener.recvfrom(1024)
            set message to the result of parse osc with item 0 of packet
            show message`,

`part: midi-between-apps
title: MIDI between apps
group: integration
types: music-tool, daw
about: Send notes from a Python script into a DAW or synth, and read a keyboard's notes in a web page.
summary: Programs on one computer exchange MIDI through ports: a hardware interface's, or a virtual cable (the IAC Driver on macOS, a loopback driver such as loopMIDI on Windows, ALSA's virtual ports on Linux). mido opens an output port by name and sends messages; in Chrome and Edge, a page asks for MIDI access with a click and gets every input's messages as three bytes.
learn: The MIDI messages part (what the bytes mean); ports and virtual cables.
source: Mido documentation | https://mido.readthedocs.io/en/stable/ | get_output_names, open_output and Message
source: Web MIDI API (MDN) | https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API | requestMIDIAccess and midimessage events
== python send_note.py
import mido
import time

define send test note using port_name=None
    description: Plays middle C for half a second on a MIDI output (the first one, unless a name is given).
    set name to port_name or item 0 of mido.get_output_names()
    using mido.open_output(name) as port
        run port.send with mido.Message("note_on", note=60, velocity=100)
        run time.sleep with 0.5
        run port.send with mido.Message("note_off", note=60)
== html index.html
add a button called listen saying "Listen to MIDI"
add a paragraph called said "Press a key on a MIDI keyboard."
== js midi.js
define showMessage using event
    constant status is event.data[0] & 0xF0
    if status is 0x90 and event.data[2] is more than 0
        set the text of said to "Note on {event.data[1]}, velocity {event.data[2]}"
when listen is clicked
    wait for navigator.requestMIDIAccess() and store in access
    for each input in access.inputs.values()
        set input.onmidimessage to showMessage`,

`part: python-sqlite
title: Python and SQLite
group: integration
types: database, web-app, data-analysis, desktop-app
about: Keep a program's data in a SQLite file: the tables in SQL, the reading and writing in Python.
summary: The tables are described in schema.sql, kept with the code; Python runs it when the database opens, and IF NOT EXISTS makes that safe every time. Values always go in through ? placeholders, never joined into the SQL. A with block around a change commits it, or rolls it back if anything fails. sqlite3 comes with Python, and the database is one file.
learn: The SQL tables and queries part; the SQL parameters part; transactions.
source: sqlite3 (Python docs) | https://docs.python.org/3/library/sqlite3.html | connect, executescript, placeholders, row_factory and the connection as a transaction
== sql schema.sql
CREATE TABLE IF NOT EXISTS takes (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  seconds REAL NOT NULL CHECK (seconds > 0),
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS takes_by_title ON takes(title);
== python db.py
import sqlite3
import pathlib

define open database using path="takes.db"
    description: Opens (or creates) the database and makes sure its tables exist, from schema.sql next to this file.
    set db to sqlite3.connect(path)
    set db.row_factory to sqlite3.Row
    run db.executescript with (pathlib.Path(__file__).parent / "schema.sql").read_text(encoding="utf-8")
    give back db

define add take using db, title, seconds
    description: Adds a recording; gives back its id. The with block commits it, or undoes it on an error.
    using db
        set cursor to db.execute("INSERT INTO takes (title, seconds) VALUES (?, ?)", (title, seconds))
    give back cursor.lastrowid

define takes called using db, title
    give back [dict(row) for row in db.execute("SELECT id, title, seconds FROM takes WHERE title = ? ORDER BY id", (title,))]`,

`part: shared-settings
title: One settings file, two languages
group: integration
types: desktop-app, automation-script, smart-home
about: A JSON settings file that a Python program and a web page (or Node.js) both read, with the same defaults.
summary: When two parts of a project in different languages need the same settings, keep them in one JSON file rather than in each program. Both sides read it, fill in the same defaults for anything missing, and use the same key names (snake_case, so they read naturally in Python and JavaScript alike). The page fetches it from the server; the Python program reads it from disk.
learn: The JSON data and A settings file with defaults parts.
== json settings.json
{
  "sample_rate": 48000,
  "meter_fall_db_per_second": 20,
  "theme": "dark"
}
== python settings.py
import json

set DEFAULTS to {"sample_rate": 48000, "meter_fall_db_per_second": 20, "theme": "light"}

define load settings using path="settings.json"
    description: The shared settings, with the defaults for anything the file doesn't say.
    set settings to dict(DEFAULTS)
    using open(path, encoding="utf-8") as f
        run settings.update with json.load(f)
    give back settings
== js settings.js
constant DEFAULTS is { sample_rate: 48000, meter_fall_db_per_second: 20, theme: "light" }
define loadSettings
    description: The shared settings from the server, with the same defaults as settings.py.
    fetch from "settings.json" and store in saved
    give back { ...DEFAULTS, ...saved }`,

);
