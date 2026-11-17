// What the JavaScript writer's Mechanics words mean, on a stand-in page (tests/helpers/page.mjs). An example is a
// website: its Structure (page), and Mechanics, which is "set result to <say>" for a value or its lines, after its
// given lines (as exact JavaScript). It's run, the page loads, then `then` runs (clicks, typing, the clock moving
// on), and it's checked against what the words say, worked out by hand.
//   say      a value, in words            lines    Mechanics sentences
//   page     Structure sentences          given    JavaScript lines that set up names
//   means    the value `say` means, as JavaScript (worked out on a page of its own, from the given lines only)
//   then     what happens after the page loads: await page.click("save"), page.type(…), page.tick(ms), page.key(…)…
//   holds    a check, as JavaScript: the page's names, and `page` (text(id), el(id), shown, requests, notes,
//            went, clipboard, logged, el(id).pen.calls)
//   replies  what fetch gets back, by address    answers  what confirm and prompt get, in order
//   raises   the error the words stop with
// Index entries with no example are in NOT_RUN_JS, with why.

const SHOP = 'add a button called save saying "Save"\nadd a paragraph called total saying "0"';
const GAME = 'add a drawing area called game 480 by 270';

export const JS_VALUES = [
  { say: '2 plus 2 is 4', means: 'true' },
  { say: 'n is not 4', given: 'const n = 5;', means: 'true' },
  { say: 'n is not 5', given: 'const n = 5;', means: 'false' },
  { say: '"5" is 5', means: 'false' },   // (=== : text is never a number)
  { say: 'yes and no', means: 'false' },
  { say: 'yes and yes', means: 'true' },
  { say: 'no or yes', means: 'true' },
  { say: 'no or no', means: 'false' },
  { say: 'not no', means: 'true' },
  { say: '7 minus 2 times 3', means: '1' },
  { say: '7 divided by 2', means: '3.5' },
  { say: '7 mod 3', means: '1' },
  { say: 'n is at least 5', given: 'const n = 5;', means: 'true' },
  { say: 'n is at least 5', given: 'const n = 6;', means: 'true' },
  { say: 'n is at least 5', given: 'const n = 4;', means: 'false' },
  { say: 'n is more than 5', given: 'const n = 5;', means: 'false' },
  { say: 'n is at most 4', given: 'const n = 5;', means: 'false' },
  { say: 'n is at most 5', given: 'const n = 5;', means: 'true' },
  { say: 'n is less than 6', given: 'const n = 5;', means: 'true' },
  { say: 'n is less than 5', given: 'const n = 5;', means: 'false' },
  { say: 'length of xs', given: 'const xs = [4, 5, 6];', means: '3' },
  { say: 'length of "abc"', means: '3' },
  { say: 'item 0 of xs', given: 'const xs = [4, 5, 6];', means: '4' },
  { say: 'the first item of xs', given: 'const xs = [4, 5, 6];', means: '4' },
  { say: 'the last item of xs', given: 'const xs = [4, 5, 6];', means: '6' },
  { say: '"Hi {name}"', given: 'const name = "Ann";', means: '"Hi Ann"' },
  { say: 'the result of f with 2, 3', given: 'const f = (a, b) => a * 10 + b;', means: '23' },
  { say: '1 if yes otherwise 2', means: '1' },
  { say: '1 if no otherwise 2', means: '2' },
  { say: 'an empty list', means: '[]' },
  { say: 'x is nothing', given: 'const x = undefined;', means: 'true' },
  { say: 'x is nothing', given: 'const x = 0;', means: 'false' },
  { say: 'x is null', given: 'const x = undefined;', means: 'false' },
  { say: 'x is not nothing', given: 'const x = 0;', means: 'true' },
  { say: 'x is not nothing', given: 'const x = undefined;', means: 'false' },
  { say: 'a list of x times 2 for each x in xs', given: 'const xs = [1, 2, 3];', means: '[2, 4, 6]' },
  { say: 'a list of x for each x in xs if x is more than 1', given: 'const xs = [1, 2, 3];', means: '[2, 3]' },
  { say: 'the first x in xs where x is 2', given: 'const xs = [1, 2, 3, 2];', means: '2' },
  { say: 'the first x in xs where x is 9', given: 'const xs = [1, 2, 3];', means: 'undefined' },
  { say: 'x is more than 0 for every x in xs', given: 'const xs = [1, 2, 3];', means: 'true' },
  { say: 'x is more than 1 for every x in xs', given: 'const xs = [1, 2, 3];', means: 'false' },
  { say: 'x is more than 0 for every x in xs', given: 'const xs = [0, 1];', means: 'false' },
  { say: 'x is 2 for any x in xs', given: 'const xs = [1, 2, 3];', means: 'true' },
  { say: 'x is 9 for any x in xs', given: 'const xs = [1, 2, 3];', means: 'false' },
  { say: 'xs joined by ", "', given: 'const xs = [1, 2, 3];', means: '"1, 2, 3"' },
  { say: 'name trimmed', given: 'const name = "  Ann  ";', means: '"Ann"' },
  { say: 'line split at ","', given: 'const line = "a,b";', means: '["a", "b"]' },
  { say: 'price to 2 decimal places', given: 'const price = 3.14159;', means: '"3.14"' },
  { say: 'n rounded', given: 'const n = 2.5;', means: '3' },
  { say: 'n rounded down', given: 'const n = -2.5;', means: '-3' },
  { say: 'n rounded up', given: 'const n = 2.1;', means: '3' },
  { say: 'text read as JSON', given: 'const text = \'{"a": 1}\';', means: '({ a: 1 })' },
  { say: 'data as JSON text', given: 'const data = [1, 2];', means: '"[1,2]"' },
  { say: 'n as number', given: 'const n = "42";', means: '42' },
  { say: 'n as text', given: 'const n = 5;', means: '"5"' },
  { say: 't in capitals', given: 'const t = "hi";', means: '"HI"' },
  { say: 't in lowercase', given: 'const t = "Hi";', means: '"hi"' },
  { say: 't contains "an"', given: 'const t = "banana";', means: 'true' },
  { say: 'n is in xs', given: 'const n = 2;\nconst xs = [1, 2];', means: 'true' },
  { say: 'n is not in xs', given: 'const n = 2;\nconst xs = [1, 2];', means: 'false' },
  { say: 'xs is empty', given: 'const xs = [];', means: 'true' },
  { say: 'xs is not empty', given: 'const xs = [];', means: 'false' },
  { say: 'xs is not empty', given: 'const xs = [1];', means: 'true' },
  { say: '(xs) is empty', given: 'const xs = [1];', means: 'false' },
  { say: '(xs) is empty', given: 'const xs = [];', means: 'true' },
  { say: 'the largest number in xs', given: 'const xs = [3, 9, 2];', means: '9' },
  { say: 'the smallest number in xs', given: 'const xs = [3, 9, 2];', means: '2' },
  { say: 'x, or y if that is nothing', given: 'const x = null;\nconst y = 7;', means: '7' },
  { say: 'x, or y if that is nothing', given: 'const x = 0;\nconst y = 7;', means: '0' },
  { say: 'ua matches /win/i', given: 'const ua = "Windows";', means: 'true' },
  { say: '1,000', means: '1000' },
  { say: '$5', means: '5' },
  { say: '50%', means: '0.5' },
  { say: '15% of total', given: 'const total = 200;', means: '30' },
  { say: 'the page title', page: 'page title is "Shop"', means: '"Shop"' },
];

// randomness: every value in the range comes up, and nothing outside it (Math.random is seeded on the page)
const DRAWS = 'const tries = Array.from({ length: 300 }, (_, i) => i);\nconst seen = new Set();';
export const JS_STATEMENTS = [
  { lines: 'for each i in tries\n    set k to random number from 1 to 6\n    js: seen.add(k);', given: DRAWS, holds: 'seen.size === 6 && [...seen].every(v => Number.isInteger(v) && v >= 1 && v <= 6)' },
  { lines: 'for each i in tries\n    set k to a random whole number below 6\n    js: seen.add(k);', given: DRAWS, holds: 'seen.size === 6 && [...seen].every(v => Number.isInteger(v) && v >= 0 && v <= 5)' },
  { lines: 'for each i in tries\n    set k to a random number below 1\n    js: seen.add(k);', given: DRAWS, holds: 'seen.size === 300 && [...seen].every(v => typeof v === "number" && v >= 0 && v < 1)' },
  // Values and logic
  { lines: 'set n to 5', holds: 'n === 5' },
  { lines: 'set n to 5\nmultiply n by 3', holds: 'n === 15' },
  { lines: 'set n to 5\nincrease n by 2', holds: 'n === 7' },
  { lines: 'set n to 5\nadd 1 to n', holds: 'n === 6' },
  { lines: 'set xs to an empty list\nadd 4 to xs', holds: 'xs.length === 1 && xs[0] === 4' },
  { lines: 'set size to "big" if n is more than 3 otherwise "small"', given: 'const n = 5;', holds: 'size === "big"' },
  { lines: 'set size to "big" if n is more than 3 otherwise "small"', given: 'const n = 3;', holds: 'size === "small"' },
  { lines: 'set d to a new Date', holds: 'd instanceof Date' },
  { lines: 'set item 1 of xs to 9', given: 'const xs = [1, 2, 3];', holds: 'xs[1] === 9 && xs.length === 3' },
  { lines: 'set r to the result of f with 2 and 3', given: 'const f = (a, b) => a * 10 + b;', holds: 'r === 23' },
  // (a name set inside a block lives only there, in JavaScript: so it's set before)
  { lines: 'set size to ""\nset n to 5\nif n is more than 3\n    set size to "big"\notherwise\n    set size to "small"', holds: 'size === "big"' },
  { lines: 'set size to ""\nset n to 3\nif n is more than 3\n    set size to "big"\notherwise\n    set size to "small"', holds: 'size === "small"' },
  { lines: 'set total price to 5\nset result to total price plus 1', holds: 'totalPrice === 5 && result === 6' },
  { lines: 'set high-score to 9\nset result to high-score', holds: 'highScore === 9 && result === 9' },
  { lines: 'set total to 0\nfor each n in xs\n    increase total by n', given: 'const xs = [1, 2, 3];', holds: 'total === 6' },
  { lines: 'set total to 0\ndo this for each n in xs\n    increase total by n', given: 'const xs = [1, 2, 3];', holds: 'total === 6' },
  { lines: 'set n to 0\ndo this, then repeat while n is less than 3\n    increase n by 1', holds: 'n === 3' },
  { lines: 'set n to 9\ndo this, then repeat while n is less than 3\n    increase n by 1', holds: 'n === 10' },   // (it runs once first)
  { lines: 'set said to ""\ndepending on n\n    when it is 1\n        set said to "one"\n    when it is 2\n        set said to "two"', given: 'const n = 2;', holds: 'said === "two"' },
  { lines: 'define double using n\n    give back n times 2\nset r to the result of double with 21', holds: 'r === 42' },
  { lines: 'constant double is a tool using n giving back n times 2\nset r to the result of double with 21', holds: 'r === 42' },
  { lines: 'set doubled to a list of x times 2 for each x in xs', given: 'const xs = [1, 2, 3];', holds: 'JSON.stringify(doubled) === "[2,4,6]"' },
  { lines: 'set found to the first x in xs where x is more than 1', given: 'const xs = [1, 2, 3];', holds: 'found === 2' },
  { lines: 'set ok to x is more than 0 for every x in xs', given: 'const xs = [1, 2, 3];', holds: 'ok === true' },
  { lines: 'set ok to x is more than 0 for every x in xs', given: 'const xs = [0, 1];', holds: 'ok === false' },
  { lines: 'set line to xs joined by "-"', given: 'const xs = [1, 2, 3];', holds: 'line === "1-2-3"' },
  { lines: 'set shown to price to 2 decimal places', given: 'const price = 2.5;', holds: 'shown === "2.50"' },
  { lines: 'set data to text read as JSON', given: 'const text = "[1, 2]";', holds: 'JSON.stringify(data) === "[1,2]"' },
  { lines: 'sort xs from smallest to biggest', given: 'const xs = [10, 9, 1];', holds: 'JSON.stringify(xs) === "[1,9,10]"' },   // (numbers, not text: 10 after 9)
  { lines: 'define class Store\n    when a new Store is made with key\n        set this.key to key\nset s to a new Store with "k"', holds: 's.key === "k"' },
  { lines: 'run this now, keeping its names private\n    set secret to 1\n    js: window.seenInside = secret;', holds: 'window.seenInside === 1 && typeof secret === "undefined"' },
  { lines: 'set log to an empty list\ntry\n    fail with "Not found"\nif it fails\n    add "caught" to log', holds: 'log.length === 1 && log[0] === "caught"' },
  { lines: 'fail with "Not found"', raises: 'Not found' },
  { lines: 'set log to an empty list\ndefine slow\n    js: await null;\n    add "done" to log\nrun slow without waiting\nadd "after" to log', holds: 'log.join() === "after,done"' },
  // Events
  { page: SHOP, lines: 'set n to 0\nwhen save is clicked\n    increase n by 2\n    set the text of total to n', then: 'await page.click("save"); await page.click("save");', holds: 'n === 4 && page.text("total") === "4"' },
  { page: SHOP, lines: 'set n to 0\nwhen save is double-clicked\n    increase n by 1', then: 'await page.click("save"); await page.dblclick("save");', holds: 'n === 1' },
  { page: SHOP, lines: 'when save is clicked, with the event as e\n    set the text of total to e.type', then: 'await page.click("save");', holds: 'page.text("total") === "click"' },
  { page: 'add a form called signup\n    add a text box called email with hint "Email"\n    add a button called go saying "Go"', lines: 'set sent to 0\nwhen signup is sent\n    increase sent by 1', then: 'await page.send("signup");', holds: 'sent === 1' },
  { page: SHOP, lines: 'set n to 0\nwhen the page has loaded\n    set the text of total to "ready"', holds: 'page.text("total") === "ready"' },
  { page: SHOP, lines: 'constant order is an empty list\nwhen the window has loaded\n    set the text of total to "ready"\n    add "loaded" to order\nadd "script" to order', holds: 'page.text("total") === "ready" && order.join() === "script,loaded"' },   // (after the script has run, not as it runs)
  { page: 'add a text box called name with hint "Name"\nadd a paragraph called said saying ""', lines: 'when a key is pressed in name, with the event as e\n    set the text of said to e.key', then: 'await page.key("Enter", "name");', holds: 'page.text("said") === "Enter"' },
  { lines: 'set n to 0\nevery 2 seconds\n    increase n by 1', then: 'await page.tick(6000);', holds: 'n === 3' },
  { lines: 'set n to 0\nevery 1 second as ticker\n    increase n by 1\n    if n is 2\n        js: clearInterval(ticker);', then: 'await page.tick(5000);', holds: 'n === 2' },
  { page: SHOP, lines: 'constant box is the element matching "#total"', holds: 'box === document.getElementById("total")' },
  { page: SHOP, lines: 'constant total is the element called "total"', holds: 'total === document.getElementById("total")' },
  // The page
  { page: SHOP, lines: 'set the text of total to 5', holds: 'page.text("total") === "5"' },
  { page: 'add a text box called name with hint "Name"\n' + SHOP, lines: 'when save is clicked\n    get the text of name and store in value\n    set the text of total to value', then: 'await page.type("name", "Ann"); await page.click("save");', holds: 'page.text("total") === "Ann"' },
  { page: 'add a text box called name with hint "Name"\n' + SHOP, lines: 'when save is clicked\n    set the text of total to text of name', then: 'await page.type("name", "Bo"); await page.click("save");', holds: 'page.text("total") === "Bo"' },
  { page: 'add a text box called name with hint "Name"\n' + SHOP, lines: 'constant box is the element called "name"\nset v to ""\nwhen save is clicked\n    set v to value of box', then: 'await page.type("name", "Cy"); await page.click("save");', holds: 'v === "Cy"' },
  { page: 'add a list called items', lines: 'add "milk" to the list items\nadd "eggs" to the list items', holds: 'page.el("items").children.length === 2 && page.el("items").children[1].tagName === "LI" && page.text("items") === "milkeggs"' },
  { page: SHOP, lines: 'hide total', holds: 'page.el("total").hidden === true' },
  { page: SHOP, lines: 'put total in group done', holds: 'page.el("total").classList.contains("done")' },
  { page: SHOP, lines: 'set the groups of total to "card done"', holds: 'page.el("total").className === "card done"' },
  { page: 'add a box called card in group done\n' + SHOP, lines: 'set a to card is in group done\nset b to card is in group late', holds: 'a === true && b === false' },
  { page: 'add a checkbox called box saying "Agree"\n' + SHOP, lines: 'set agreed to no\nwhen save is clicked\n    set agreed to box is ticked', then: 'page.el("box").checked = true; await page.click("save");', holds: 'agreed === true' },
  { page: 'add a file picker called picker for pictures\n' + SHOP, lines: 'set f to nothing\nwhen save is clicked\n    set f to the file in picker', then: 'await page.choose("picker", "a.png"); await page.click("save");', holds: 'f && f.name === "a.png"' },
  { page: 'add a list called items', lines: 'make a new button saying "Remove" in items and store in b', holds: 'b.tagName === "BUTTON" && b.textContent === "Remove" && b.parentNode === page.el("items")' },
  { page: 'add a list called items', lines: 'constant item is a new "li" element\nput item at the end of items', holds: 'item.tagName === "LI" && page.el("items").lastChild === item' },
  { page: SHOP, lines: 'set the HTML of total to "<b>5</b>"', holds: 'page.el("total").innerHTML === "<b>5</b>" && page.text("total") === "5"' },
  { lines: 'set the page title to "Basket"', holds: 'document.title === "Basket"' },
  { page: SHOP, lines: 'remove total from the page', holds: 'document.getElementById("total") === null' },
  { lines: 'show message "Saved"', holds: 'page.shown.length === 1 && page.shown[0] === "Saved"' },
  { lines: 'go to "/next.html"', holds: 'page.went[0] === "/next.html"' },
  // The server and the browser's memory
  { page: SHOP, lines: 'when the page has loaded\n    fetch from "/api/items" and store in items\n    set the text of total to length of items', replies: { '/api/items': [1, 2, 3] }, holds: 'page.text("total") === "3"' },
  { page: SHOP, lines: 'when the page has loaded\n    constant reply is the reply from "/api/items"\n    constant items is the JSON read from reply\n    set the text of total to item 0 of items', replies: { '/api/items': ['tea'] }, holds: 'page.text("total") === "tea"' },
  { lines: 'when the page has loaded\n    send 5 to "/api/items"', holds: 'page.requests.length === 1 && page.requests[0].method === "POST" && page.requests[0].body === "5"' },
  { lines: 'save 5 in the browser as "k"\nconstant saved is the text saved in the browser as "k"', holds: 'saved === "5"' },
  { lines: 'when the page has loaded\n    wait for navigator.clipboard.writeText with "hi"', holds: 'page.clipboard[0] === "hi"' },
  { lines: 'when the page has loaded\n    wait for navigator.clipboard.writeText("yo")', holds: 'page.clipboard[0] === "yo"' },
  // Games and drawing
  { page: GAME, lines: 'clear game', holds: 'page.el("game").pen.calls.some(c => c.call === "clearRect" && c.args.join() === "0,0,480,270")' },
  { page: GAME, lines: 'fill game with "skyblue"', holds: 'page.el("game").pen.calls.some(c => c.call === "fillRect" && c.fillStyle === "skyblue" && c.args.join() === "0,0,480,270")' },
  { page: GAME, lines: 'draw a rectangle at 10, 20 sized 40 by 30 in "tomato" on game', holds: 'page.el("game").pen.calls.some(c => c.call === "fillRect" && c.fillStyle === "tomato" && c.args.join() === "10,20,40,30")' },
  { page: GAME, lines: 'draw a circle at 50, 60 with radius 10 in "gold" on game', holds: 'page.el("game").pen.calls.some(c => c.call === "arc" && c.args.slice(0, 3).join() === "50,60,10" && c.args[3] === 0 && c.args[4] === 2 * Math.PI) && page.el("game").pen.calls.some(c => c.call === "fill" && c.fillStyle === "gold")' },
  { page: GAME, lines: 'set score to 3\ndraw text "Score: {score}" at 10, 24 in "white" on game', holds: 'page.el("game").pen.calls.some(c => c.call === "fillText" && c.args.join() === "Score: 3,10,24" && c.fillStyle === "white")' },
  { page: GAME, lines: 'draw a line from 0, 0 to 100, 50 in "white" on game', holds: 'page.el("game").pen.calls.map(c => c.call + "(" + c.args.join() + ")").join(" ").includes("moveTo(0,0) lineTo(100,50)") && page.el("game").pen.calls.some(c => c.call === "stroke" && c.strokeStyle === "white")' },
  { page: GAME, lines: 'load the picture "images/ship.png" as ship\nwhen the page has loaded\n    draw ship at 5, 6 on game', holds: 'page.loaded[0] === "images/ship.png" && page.el("game").pen.calls.some(c => c.call === "drawImage" && c.args[0] === ship && c.args[1] === 5 && c.args[2] === 6)' },
  { page: GAME, lines: 'set frames to 0\nevery frame\n    increase frames by 1', then: 'await page.frame(3);', holds: 'frames === 3' },
  { page: GAME, lines: 'keep track of the keys\nset x to 0\nevery frame\n    if "left" is held\n        decrease x by 1', then: 'await page.key("ArrowLeft"); await page.frame(2); await page.keyUp("ArrowLeft"); await page.frame(2);', holds: 'x === -2' },
  { page: GAME, lines: 'set jumps to 0\nwhen the key "space" is pressed\n    increase jumps by 1', then: 'await page.key(" "); await page.key("a"); await page.key(" ");', holds: 'jumps === 2' },
  { page: GAME, lines: 'set taps to 0\nwhen the screen is tapped\n    increase taps by 1', then: 'await page.pointer("pointerdown", "game", 3, 4);', holds: 'taps === 1' },
  { page: GAME, lines: 'set ups to 0\nwhen game is released\n    increase ups by 1', then: 'await page.pointer("pointerup", "game", 3, 4);', holds: 'ups === 1' },
  { page: GAME, lines: 'set at to 0\nwhen the pointer moves over game\n    set at to tap x', then: 'await page.pointer("pointermove", "game", 42, 7);', holds: 'at === 42' },
  { lines: 'play a note of 440 for 0.2 seconds', holds: 'page.notes.length === 1 && page.notes[0].frequency === 440 && Math.abs(page.notes[0].to - page.notes[0].from - 0.2) < 0.01' },   // (a browser's sound clock keeps running between start and stop, so within 10 ms)
];

// The rules the Index doesn't list (counted by rule: see JS_RULES_NOT_RUN), and the rest the Index lists that had none.
const CHECK = 'add a checkbox called box saying "ok"';
JS_STATEMENTS.push(
  // value words
  { lines: 'set result to 0\nwhen the page has loaded\n    set result to wait for answer()', given: 'const answer = () => Promise.resolve(42);', holds: 'result === 42' },
  { page: GAME, say: 'width of game', means: '480' },
  { say: 'item (k plus 1) of xs', given: 'const k = 0; const xs = [9, 6, 7];', means: '6' },
  { say: 'how many items in xs', given: 'const xs = [1, 2, 3];', means: '3' },
  { lines: 'constant xs is [1, 2, 3]\nconstant seen is an empty list\nrepeat 60 times\n    add random item from xs to seen', holds: '[1, 2, 3].every(v => seen.includes(v)) && seen.every(v => [1, 2, 3].includes(v))' },
  { page: CHECK, say: 'box is not ticked', means: 'true' },
  { page: 'add a button called save saying "Save" in group big', say: 'save is not in group big', means: 'false' },
  { page: 'add a button called save saying "Save"', say: 'save is not in group big', means: 'true' },
  { say: 'empty text', means: '""' },
  // statements
  { page: SHOP, lines: 'set k to ""\nwhen a key is pressed\n    set k to event.key', then: 'await page.key("a");', holds: 'k === "a"' },
  { lines: 'use strict rules\njs: window.strict = (function () { return this === undefined; })();', holds: 'strict === true' },
  { page: SHOP, lines: 'set n to 0\nevery 1 second as ticker\n    increase n by 1\nwhen save is clicked\n    stop ticker', then: 'await page.tick(2000); await page.click("save"); await page.tick(3000);', holds: 'n === 2' },
  { page: CHECK, lines: 'tick box', holds: 'page.el("box").checked === true' },
  { page: CHECK, lines: 'tick box\nuntick box', holds: 'page.el("box").checked === false' },
  { page: SHOP, lines: 'clear total', holds: 'page.text("total") === ""' },
  { page: SHOP, lines: 'hide total\nreveal total', holds: 'page.el("total").hidden === false' },
  { page: 'add a button called save saying "Save" in group big', lines: 'take save out of group big', holds: '!page.el("save").classList.contains("big")' },
  { page: 'add a button called save saying "Save" in group big', lines: 'switch group big on save', holds: '!page.el("save").classList.contains("big")' },
  { page: 'add a button called save saying "Save"', lines: 'switch group big on save', holds: 'page.el("save").classList.contains("big")' },
  { page: SHOP, lines: 'scroll to total', holds: 'page.scrolled === page.el("total")' },
  { lines: 'save [1, 2] in the browser as "k"\nload "k" from the browser and store in v', holds: 'Array.isArray(v) && v.join() === "1,2"' },
  { lines: 'constant log is an empty list\ntry\n    add 1 to log\n    fail with "bad"\nif it fails\n    add 2 to log\nin any case\n    add 3 to log', holds: 'log.join() === "1,2,3"' },
  { lines: 'constant log is an empty list\ntry\n    add 1 to log\nif it fails\n    add 2 to log\nin any case\n    add 3 to log', holds: 'log.join() === "1,3"' },
  { lines: 'constant log is an empty list\nset n to 1\ndepending on n\n    when it is 1\n        add "one" to log\n        go on into the next case\n    when it is 2\n        add "two" to log\n    when it is 3\n        add "three" to log', holds: 'log.join() === "one,two"' },
  { lines: 'set n to 8\nset size to ""\nif n is less than 5\n    set size to "small"\notherwise if n is less than 10\n    set size to "medium"\notherwise\n    set size to "big"', holds: 'size === "medium"' },
  { lines: 'set n to 20\nset size to ""\nif n is less than 5\n    set size to "small"\notherwise if n is less than 10\n    set size to "medium"\notherwise\n    set size to "big"', holds: 'size === "big"' },
  { lines: 'set n to 1\nwhile n is less than 10\n    multiply n by 2', holds: 'n === 16' },
  { lines: 'set n to 0\nwhile yes\n    increase n by 1\n    if n is 4\n        stop the loop', holds: 'n === 4' },
  { lines: 'set total to 0\nfor each v in [1, 2, 3, 4]\n    if v is 2\n        skip to next\n    increase total by v', holds: 'total === 8' },
  { lines: 'set count to 0\nrepeat 3 times\n    increase count by 1', holds: 'count === 3' },
  { lines: 'constant xs is [1, 2, 3]\nreverse xs', holds: 'xs.join() === "3,2,1"' },
  { lines: 'make a list called xs with 1, 2', holds: 'xs.join() === "1,2"' },
  { lines: 'ask "Name?" and store in name', answers: ['Ann'], holds: 'name === "Ann" && page.shown[0] === "Name?"' },
  { lines: 'set colour of square to "red"', given: 'const square = { colour: "" };', holds: 'square.colour === "red"' },
  { lines: 'show "hi"', holds: 'page.logged[0] === "hi"' },
  // script.js as a module, when its code needs one: it brings in another file's tools, or waits at the left edge.
  // (A module's names are its own, not the window's, so these check the page.)
  { page: SHOP, lines: 'bring in double from "./maths.js"\nset the text of total to the result of double with 21',
    files: { './maths.js': 'export function double(n) {\n  return n * 2;\n}\n' }, holds: 'page.text("total") === "42" && typeof double === "undefined"' },
  { page: SHOP, lines: 'fetch from "/api/items" and store in items\nset the text of total to length of items', replies: { '/api/items': [1, 2, 3] },
    holds: 'page.text("total") === "3" && page.requests.length === 1' },
  // words that can't be a name are refused, saying why
  { lines: 'set number of lives to 3', refuses: '"number of lives" can\'t be a name' },
  { lines: 'set 2nd place to 5', refuses: 'A name can\'t start with a number' },
);

// Rules with no example, by their words (as WEB.rules names them), and why.
export const JS_RULES_NOT_RUN = {};

// Index entries with no example, keyed by the start of their name (as tools/meaning.mjs prints it), and why.
export const NOT_RUN_JS = {};
