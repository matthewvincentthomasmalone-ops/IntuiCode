/* IntuaCode Library — data, files and system, storage and databases. */
(window.IntuiLibraryPacks = window.IntuiLibraryPacks || []).push(

`part: csv-files
title: CSV files
group: data
types: data-analysis, office-automation, automation-script, machine-learning
about: Read a table from a CSV file into rows, and write rows back, with commas and quotes handled properly.
summary: CSV looks simple, but a field can hold a comma or a line break inside quotes, and a quote inside quotes is written twice (""). Splitting on commas gets those wrong, so Python's csv module (or a small parser that follows the rules) is used. Opening the file with newline="" lets the csv module handle line endings itself.
learn: Lists of dictionaries; files; the CSV rules in RFC 4180.
source: RFC 4180, Common Format for CSV Files | https://www.rfc-editor.org/rfc/rfc4180 | quoted fields and doubled quotes
== python table.py
import csv

define read rows using path
    description: The rows of a CSV file as dictionaries, keyed by the header line.
    using open(path, newline="", encoding="utf-8") as f
        give back list(csv.DictReader(f))

define write rows using path, rows
    description: Writes a list of dictionaries to a CSV file, with a header line from the first row's keys.
    using open(path, "w", newline="", encoding="utf-8") as f
        set writer to csv.DictWriter(f, fieldnames=list(rows[0]))
        run writer.writeheader
        run writer.writerows with rows
== js table.js
define parseCsvLine using line
    description: Splits one line of CSV into fields. Quotes may hold commas, and two quotes inside quotes are one quote.
    create list fields
    set field to ""
    set quoted to false
    repeat length of line times counting with i
        constant c is item i of line
        if quoted
            if c is '"' and line[i + 1] is '"'
                set field to field + '"'
                increase i
            otherwise if c is '"'
                set quoted to false
            otherwise
                set field to field + c
        otherwise if c is '"'
            set quoted to true
        otherwise if c is ","
            add field to fields
            set field to ""
        otherwise
            set field to field + c
    add field to fields
    give back fields`,

`part: json-data
title: JSON data
group: data
types: web-app, api-service, chat-bot, browser-extension, game-mod, smart-home
about: Save and load lists and records as JSON, the format web APIs and settings files use.
summary: JSON writes data as text: objects in braces, lists in square brackets, text in double quotes, plus numbers, true, false and null. Python's json module and JavaScript's JSON object turn it into dictionaries and lists and back. Writing with an indent keeps files readable; a damaged file raises an error, so loading is worth guarding.
learn: Dictionaries and lists; text encodings (UTF-8).
source: RFC 8259, The JSON Data Interchange Format | https://www.rfc-editor.org/rfc/rfc8259 | the format's rules
== python data.py
import json
import os

define save json using value, path
    description: Writes a value (dictionaries, lists, text, numbers) to a JSON file, indented, in UTF-8.
    using open(path, "w", encoding="utf-8") as f
        run json.dump with value, f, indent=2, ensure_ascii=False

define load json using path, fallback=None
    description: Reads a JSON file; gives back fallback when it is missing or damaged.
    if not os.path.exists(path)
        give back fallback
    try
        using open(path, encoding="utf-8") as f
            give back json.load(f)
    if it fails with ValueError
        note: json.JSONDecodeError, a damaged file, is a kind of ValueError.
        give back fallback
== js data.js
define toJson using value
    give back JSON.stringify(value, null, 2)
define fromJson using text, fallback
    description: Parses JSON text; gives back fallback when it isn't valid JSON.
    try
        give back JSON.parse(text)
    if it fails
        give back fallback`,

`part: group-count
title: Grouping and counting
group: data
types: data-analysis, office-automation
about: Count how often each value appears, or total a number for each group.
summary: A dictionary keyed by the group holds a running count or total: look the key up (starting from 0 when it's new) and add to it. This is what a spreadsheet pivot table or SQL's GROUP BY does. Python's collections.Counter does the counting in one line once the idea is clear.
learn: Dictionaries; get() with a default.
== python groups.py
define count each using values
    description: How many times each value appears.
    create dictionary counts
    for each v in values
        set item v of counts to counts.get(v, 0) plus 1
    give back counts

define total by using rows, key, amount
    description: Adds up rows[amount] for each different rows[key], e.g. spending per category.
    create dictionary totals
    for each row in rows
        set group to item key of row
        set item group of totals to totals.get(group, 0) plus item amount of row
    give back totals
== js groups.js
define countEach using values
    set counts to {}
    for each v in values
        set item v of counts to (counts[v] ?? 0) + 1
    give back counts`,

`part: dates-times
title: Dates and times
group: data
types: web-app, api-service, blog, chat-bot, data-analysis, office-automation, broadcast, smart-home
about: Store times in a standard form, work out durations, and show dates the way people read them.
summary: Store and send times in UTC as ISO 8601 text (2026-11-04T09:30:00+00:00), which sorts correctly and means the same everywhere; turn them into local time only to show them. Durations come from subtracting two times. Showing dates uses the reader's own format (Intl.DateTimeFormat in a browser).
learn: Time zones and UTC; ISO 8601; why "add a day" isn't always 24 hours (clock changes).
source: ISO 8601 date and time format | https://www.iso.org/iso-8601-date-and-time-format.html | the standard text form for dates and times
== python times.py
python: from datetime import datetime, timedelta, timezone

define now utc
    description: The time now, in UTC, as ISO 8601 text.
    give back datetime.now(timezone.utc).isoformat(timespec="seconds")

define days between using start_text, end_text
    description: Whole days from one ISO 8601 time to another.
    set start to datetime.fromisoformat(start_text)
    set end to datetime.fromisoformat(end_text)
    give back (end minus start).days

define add days using text, days
    give back (datetime.fromisoformat(text) + timedelta(days=days)).isoformat()
== js times.js
define nowUtc
    give back new Date().toISOString()
define daysBetween using startText, endText
    give back Math.floor((Date.parse(endText) - Date.parse(startText)) / 86400000)
define showDate using text
    description: A date in the reader's own format and time zone.
    give back new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(text))`,

`part: search-filter
title: Searching and filtering a list
group: data
types: online-shop, blog, data-analysis, browser-extension
about: Keep the items that match what someone typed, ignoring capitals, as they type.
summary: Filtering makes a new list of only the items that pass a test; the original stays as it is. Searching text is usually done in lower case on both sides (casefold in Python handles more languages than lower), and every word typed has to appear somewhere in the item.
learn: Loops and conditions; lists made from lists.
== python search.py
define search using items, query
    description: The items (text) that contain every word of the query, ignoring capitals.
    set words to query.casefold().split()
    create list found
    for each item in items
        set text to item.casefold()
        if all(w in text for w in words)
            add item to found
    give back found
== html index.html
add a search box called query with hint "Search"
add a list called results
== js search.js
constant ITEMS is ["Gain in decibels", "Pan laws", "Peak meter", "Biquad filters", "Delay line"]
define search using items, text
    constant words is text.toLowerCase().split(" ").filter((w) => w)
    give back items.filter((item) => words.every((w) => item.toLowerCase().includes(w)))
when query is typed in
    clear results
    get the text of query and store in typed
    for each item in search(ITEMS, typed)
        add item to the list results`,

`part: sorting
title: Sorting records
group: data
types: online-shop, blog, data-analysis, office-automation
about: Put records in order by one field, then another: price then name, newest first.
summary: Sorting by a key says which field to compare. To sort by two fields, the key is a pair: the first decides, the second breaks ties. Sorting newest first is the same sort reversed. JavaScript's sort compares as text unless given a comparison, so numbers need one and names use localeCompare.
learn: Functions as inputs (lambda, arrow functions); tuples.
== python sorting.py
define sort by price using products
    description: Cheapest first; products with the same price in name order.
    give back sorted(products, key=lambda p: (p["price"], p["name"].casefold()))

define newest first using posts
    give back sorted(posts, key=lambda p: p["date"], reverse=True)
== js sorting.js
define byPriceThenName using products
    give back [...products].sort((a, b) => a.price - b.price || a.name.localeCompare(b.name))
define newestFirst using posts
    give back [...posts].sort((a, b) => b.date.localeCompare(a.date))`,

`part: line-chart
title: Line chart
group: data
types: data-analysis
about: Draw a line chart of numbers: with matplotlib in Python, or on a drawing area in a page.
summary: A chart maps each value onto the screen: x across by position, y up by value. On a drawing area that is done by hand (screen y grows downwards, so it is flipped), which shows what a charting library does for you. In Python, matplotlib draws and saves the picture.
learn: The Clamp, lerp and map part; axes and scales.
source: matplotlib pyplot tutorial | https://matplotlib.org/stable/tutorials/pyplot.html | plot, labels and savefig
== python chart.py
python: import matplotlib.pyplot as plt

define save chart using values, path, title="Levels"
    description: Saves a line chart of the values as a picture (PNG).
    run plt.figure with figsize=(8, 3)
    run plt.plot with values
    run plt.title with title
    run plt.xlabel with "Sample"
    run plt.ylabel with "Value"
    run plt.tight_layout
    run plt.savefig with path
    run plt.close
== html index.html
add a drawing area called chart 480 by 200
== js chart.js
constant VALUES is [3, 5, 4, 8, 6, 9, 7, 11]
constant highest is Math.max(...VALUES)
fill chart with "white"
repeat VALUES.length - 1 times counting with i
    constant x1 is i * 480 / (VALUES.length - 1)
    constant x2 is (i + 1) * 480 / (VALUES.length - 1)
    constant y1 is 190 - VALUES[i] / highest * 180
    constant y2 is 190 - VALUES[i + 1] / highest * 180
    draw a line from x1, y1 to x2, y2 in "#4f7cff" on chart`,

// ---------------------------------------------------------------- files and system

`part: text-file
title: Reading and writing text files
group: files
types: automation-script, cli-tool, desktop-app, office-automation
about: Read a whole file, read it line by line, write a new one or add to the end.
summary: Opening a file in a "with" block (or a C++ stream that closes when it goes out of scope) makes sure it is closed even after an error. Say the encoding (UTF-8) so accents read back the same on every computer. Writing replaces the file; adding ("a") keeps what was there.
learn: Paths; text encodings; why files must be closed.
== python files.py
define read text using path
    using open(path, encoding="utf-8") as f
        give back f.read()

define write text using path, text
    using open(path, "w", encoding="utf-8") as f
        run f.write with text

define add line using path, line
    description: Adds a line to the end of a file, keeping what was there.
    using open(path, "a", encoding="utf-8") as f
        run f.write with line + "\\n"

define count lines using path
    set total to 0
    using open(path, encoding="utf-8") as f
        for each line in f
            increase total
    give back total
== cpp files.cpp
include fstream
include vector

define read_lines using std::string path giving back std::vector<std::string>
    note: The file closes by itself when "file" goes out of scope.
    create list of text called lines
    c++: std::ifstream file(path);
    set std::string line to ""
    while std::getline(file, line)
        add line to lines
    give back lines

define write_text using std::string path, std::string text giving back bool
    c++: std::ofstream file(path);
    c++: file << text;
    give back file.good()`,

`part: folder-walk
title: Going through every file in a folder
group: files
types: automation-script, cli-tool, audio-tool, office-automation, desktop-app
about: Visit every file under a folder, including sub-folders: to find, total, rename or sort them.
summary: pathlib's rglob visits every file under a folder; each result is a Path with its name, suffix, size and times. Collecting the list first, then acting on it, avoids surprises when the loop renames or moves files in the folder it is reading.
learn: Paths and file names; recursion (folders inside folders).
source: pathlib (Python docs) | https://docs.python.org/3/library/pathlib.html | Path.rglob, stat, suffix
== python folder.py
import pathlib

define files under using folder, ending=""
    description: Every file under a folder (and its sub-folders) whose name ends with ending, e.g. ".wav".
    give back sorted(p for p in pathlib.Path(folder).rglob("*") if p.is_file() and p.name.lower().endswith(ending))

define total size using folder
    description: The size of everything under a folder, in bytes.
    give back sum(p.stat().st_size for p in pathlib.Path(folder).rglob("*") if p.is_file())

define newest file using folder
    set found to the result of files under with folder
    give back max(found, key=lambda p: p.stat().st_mtime, default=None)
== bash list_wavs.sh
#!/usr/bin/env bash
# Lists every .wav file under a folder with its size, safely for names with spaces.
set -euo pipefail
folder="$1"
find "$folder" -type f -iname '*.wav' -print0 |
  while IFS= read -r -d '' file; do
    size=$(wc -c < "$file")
    printf '%10d  %s\\n' "$size" "$file"
  done`,

`part: command-line-args
title: Command-line arguments
group: files
types: cli-tool, automation-script, audio-tool
about: Read options like --gain -6 and file names from the command line, with help text for free.
summary: A command-line tool is told what to do with arguments: positional ones (a file name) and options (--gain -6, --dry-run). argparse in Python (and the flag package in Go) checks them, turns them into the right types and writes the --help text, so the tool explains itself.
learn: Lists of text (sys.argv); types; exit codes (0 means it worked).
source: argparse (Python docs) | https://docs.python.org/3/library/argparse.html | positional arguments, options and --help
== python cli.py
import argparse

define read arguments using argv=None
    description: The tool's arguments, checked: a file, --gain in dB, and --dry-run.
    set parser to argparse.ArgumentParser(description="Change the level of a WAV file.")
    run parser.add_argument with "file", help="the WAV file to change"
    run parser.add_argument with "--gain", type=float, default=0.0, help="the change in dB, like -6"
    run parser.add_argument with "--dry-run", action="store_true", help="say what would happen, change nothing"
    give back parser.parse_args(argv)
== go main.go
package main

import (
	"flag"
	"fmt"
	"os"
)

func main() {
	gain := flag.Float64("gain", 0, "the change in dB, like -6")
	dryRun := flag.Bool("dry-run", false, "say what would happen, change nothing")
	flag.Parse()
	if flag.NArg() != 1 {
		fmt.Fprintln(os.Stderr, "usage: level [--gain dB] [--dry-run] file.wav")
		os.Exit(2)
	}
	fmt.Printf("file %s, gain %.1f dB, dry run %v\\n", flag.Arg(0), *gain, *dryRun)
}`,

`part: settings-file
title: A settings file with defaults
group: files
types: desktop-app, pc-game, phone-app-ios, phone-app-android, phone-app-cross, automation-script, game-mod
about: Keep a program's settings in a JSON file, fill in defaults for anything missing, and save changes safely.
summary: Defaults live in the code; the file only holds what someone changed. Loading merges the two, so a new setting added in a later version gets its default instead of breaking old files. Saving writes to a temporary file and then renames it over the old one, so a crash halfway never leaves a half-written settings file.
learn: Dictionaries and merging; why rename is safer than overwriting.
== python settings.py
import json
import os

set DEFAULTS to {"volume_db": -6.0, "theme": "dark", "recent": []}

define load settings using path
    description: The defaults, with anything saved in the file on top.
    set settings to dict(DEFAULTS)
    if os.path.exists(path)
        try
            using open(path, encoding="utf-8") as f
                run settings.update with json.load(f)
        if it fails with ValueError
            show "The settings file is damaged; using the defaults."
    give back settings

define save settings using settings, path
    description: Writes the settings to a temporary file, then swaps it in, so a crash never leaves half a file.
    set temporary to path + ".tmp"
    using open(temporary, "w", encoding="utf-8") as f
        run json.dump with settings, f, indent=2
    run os.replace with temporary, path
== json settings.json
{
  "volume_db": -6.0,
  "theme": "dark",
  "recent": ["mix-final.wav", "interview.wav"]
}`,

`part: logging
title: Logging
group: files
types: web-app, api-service, chat-bot, broadcast, automation-script, raspberry-pi, smart-home, desktop-app
about: Write what a program does, with a time and a level, to a file you can read when something goes wrong.
summary: A log line says when, how serious (debug, info, warning, error) and what. Python's logging module adds the time and level and can write to a file and the screen at once; the level setting decides how much is kept. Log what happened and the values that matter, never passwords or keys.
learn: Levels; formats; where log files should live.
source: Logging HOWTO (Python docs) | https://docs.python.org/3/howto/logging.html | basicConfig, levels and formats
== python log.py
import logging

define start logging using path="app.log", level=logging.INFO
    description: Writes log lines with the time and level to a file and to the screen.
    run logging.basicConfig with level=level, format="%(asctime)s %(levelname)s %(message)s", handlers=[logging.FileHandler(path, encoding="utf-8"), logging.StreamHandler()]
    give back logging.getLogger("app")
== js log.js
constant LEVELS is { debug: 0, info: 1, warning: 2, error: 3 }
set shownLevel to "info"
define log using level, message
    description: A log line with the time and level, shown in the console when the level is high enough.
    if LEVELS[level] is at least LEVELS[shownLevel]
        show "{new Date().toISOString()} {level.toUpperCase()} {message}"`,

`part: timing
title: Measuring how long something takes
group: files
types: pc-game, broadcast, automation-script, cli-tool, machine-learning, learning-app, raspberry-pi, robotics, video-streaming, audio-tool
about: Time a piece of code, or a step in a program, with a clock that never jumps.
summary: The wall clock can jump (time zones, clock changes, network time corrections), so durations use a monotonic clock that only moves forward: time.perf_counter in Python, performance.now in a browser, std::chrono::steady_clock in C++. Timing several runs and taking the best or the middle one gives a steadier answer than one run.
learn: Monotonic versus wall-clock time; why one measurement isn't enough.
== python timing.py
import time

define time it using task, runs=5
    description: The fastest of several runs of task(), in milliseconds.
    create list durations
    repeat runs times
        set start to time.perf_counter()
        run task
        add (time.perf_counter() minus start) times 1000 to durations
    give back min(durations)
== js timing.js
define timeIt using task, runs
    description: The fastest of several runs of task(), in milliseconds.
    set best to Infinity
    repeat runs times
        constant start is performance.now()
        run task
        set best to Math.min(best, performance.now() - start)
    give back best
== cpp timing.cpp
include chrono

define milliseconds_since using auto start giving back double
    note: steady_clock never jumps, so it is the clock for durations.
    give back std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - start).count()`,

`part: env-vars
title: Environment variables and secrets
group: files
types: web-app, api-service, chat-bot, automation-script, raspberry-pi
about: Read settings and secrets (API keys, passwords) from the environment instead of writing them in the code.
summary: Code is shared and kept in Git; secrets must not be. The environment holds them instead, set by the server, the terminal or a .env file that is listed in .gitignore. Reading gives text, so numbers are converted, and a missing required value stops the program with a clear message rather than failing later.
learn: The environment; .gitignore; why a leaked key must be replaced, not only deleted.
source: The Twelve-Factor App: Config | https://12factor.net/config | keeping configuration in the environment
== python config.py
import os

define setting using name, default=None
    description: A setting from the environment, or the default.
    give back os.environ.get(name, default)

define required setting using name
    description: A setting that must be there, such as an API key; stops with a clear message if it isn't.
    set value to os.environ.get(name)
    if not value
        fail with SystemExit: "Set the environment variable {name} first (it isn't kept in the code)."
    give back value

define port number
    give back int(os.environ.get("PORT", "8000"))
== bash run.sh
#!/usr/bin/env bash
# Reads settings from the environment, with defaults, and refuses to start without the key.
set -euo pipefail
PORT="\${PORT:-8000}"
if [ -z "\${API_KEY:-}" ]; then
  echo "Set API_KEY first (it isn't kept in the code)." >&2
  exit 1
fi
echo "Starting on port $PORT"`,

// ---------------------------------------------------------------- storage and databases

`part: sql-queries
title: SQL tables and queries
group: storage
types: database, data-analysis, online-shop, web-app
about: Create tables with keys, add rows, and ask questions that join tables together.
summary: A table has columns with types and a primary key that identifies each row; a foreign key links a row to a row in another table (an order to its customer). An index makes looking up by a column fast. A join puts linked rows side by side; GROUP BY totals them. This SQL runs as it is in SQLite and, with small changes, in PostgreSQL.
learn: Tables, rows and keys; SELECT, WHERE, JOIN, GROUP BY.
source: SQLite SQL language reference | https://www.sqlite.org/lang.html | CREATE TABLE, foreign keys, indexes and joins
== sql queries.sql
CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  total_pence INTEGER NOT NULL CHECK (total_pence >= 0),
  placed_at TEXT NOT NULL
);

CREATE INDEX orders_by_customer ON orders(customer_id);

INSERT INTO customers (name, email) VALUES ('Sam', 'sam@example.com'), ('Ali', 'ali@example.com');
INSERT INTO orders (customer_id, total_pence, placed_at) VALUES (1, 1250, '2026-11-01T10:00:00Z'), (1, 899, '2026-11-02T12:30:00Z'), (2, 4000, '2026-11-03T09:15:00Z');

-- Each customer with their number of orders and what they spent, biggest spender first.
SELECT customers.name, COUNT(orders.id) AS orders, SUM(orders.total_pence) AS spent_pence
FROM customers
LEFT JOIN orders ON orders.customer_id = customers.id
GROUP BY customers.id
ORDER BY spent_pence DESC;`,

`part: browser-storage
title: Saving in the browser
group: storage
types: web-app, browser-extension, phone-app-cross, database, learning-app
about: Keep a page's data between visits with localStorage, with a fallback when nothing is saved or it is damaged.
summary: localStorage keeps text under a name, in this browser only, until it is cleared. Values are turned into JSON to save and parsed back to load. A version number saved alongside lets a later version of the page recognise old data and upgrade it. It holds a few megabytes; larger data (pictures, recordings) belongs in IndexedDB.
learn: JSON; what happens when someone clears their browser's data.
source: Window.localStorage (MDN) | https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage | setItem, getItem and storage limits
== js storage.js
constant VERSION is 2
define saveData using data
    save { version: VERSION, data: data } in the browser as "my-app"
define loadData using fallback
    description: The saved data, or fallback when there is none, it is damaged, or it is from another version.
    try
        load "my-app" from the browser and store in saved
        if saved and saved.version is VERSION
            give back saved.data
    if it fails
        show "Saved data was damaged; starting fresh."
    give back fallback`,

`part: cache-ttl
title: A cache with expiry
group: storage
types: web-app, api-service, chat-bot, database
about: Remember answers that are slow to get (a web request, a big query) for a while, then fetch them again.
summary: A cache keeps each answer with the time it stops being fresh. Asking first checks the cache: a fresh answer is used at once, an old or missing one is fetched again and stored. The time to live is the trade-off between speed and how up to date the answers are. A monotonic clock is used so changing the computer's clock can't confuse it.
learn: Dictionaries; the Timing part (monotonic clocks).
== python cache.py
import time

set CACHE to {}

define cached using key, fetch, seconds=60
    description: The answer for key from the cache while it is fresh; otherwise fetch() is run and its answer kept for seconds.
    set now to time.monotonic()
    set kept to CACHE.get(key)
    if kept is not nothing and item 0 of kept is more than now
        give back item 1 of kept
    set value to fetch()
    set item key of CACHE to (now + seconds, value)
    give back value
== js cache.js
constant CACHE is new Map()
define cached using key, fetchValue, seconds
    description: The answer for key while it is fresh; otherwise fetchValue() is run and kept for seconds.
    constant now is performance.now()
    constant kept is CACHE.get(key)
    if kept and kept.until is more than now
        give back kept.value
    constant value is fetchValue()
    run CACHE.set with key, { until: now + seconds * 1000, value: value }
    give back value`,

`part: undo-redo
title: Undo and redo
group: storage
types: desktop-app, daw, phone-app-ios, phone-app-android, phone-app-cross, database
about: Step back through changes and forward again, the way every editor does.
summary: Undo keeps two stacks. Each change pushes the state before it onto the undo stack and clears the redo stack; undo moves the current state to redo and takes the last one from undo; redo does the opposite. Saving copies of small states is simplest; big documents save the change itself (a command that knows how to reverse itself) instead.
learn: Stacks (last in, first out); copying versus sharing a list.
== python undo.py
define class History
    description: Undo and redo for any state that can be copied.
    define __init__ using self, state
        set self.state to state
        set self.undo_stack to []
        set self.redo_stack to []

    define change using self, new_state
        run self.undo_stack.append with self.state
        set self.state to new_state
        run self.redo_stack.clear

    define undo using self
        if self.undo_stack
            run self.redo_stack.append with self.state
            set self.state to self.undo_stack.pop()
        give back self.state

    define redo using self
        if self.redo_stack
            run self.undo_stack.append with self.state
            set self.state to self.redo_stack.pop()
        give back self.state
== js undo.js
define createHistory using state
    give back { state: state, undoStack: [], redoStack: [] }
define change using history, newState
    run history.undoStack.push with history.state
    set history.state to newState
    set history.redoStack to []
define undo using history
    if history.undoStack.length is more than 0
        run history.redoStack.push with history.state
        set history.state to history.undoStack.pop()
    give back history.state
define redo using history
    if history.redoStack.length is more than 0
        run history.undoStack.push with history.state
        set history.state to history.redoStack.pop()
    give back history.state`,

);
