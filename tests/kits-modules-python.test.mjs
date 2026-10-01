// The Python learning modules (lang/kits/modules-python.js), played: each game is built from its kit, then run with a
// stand-in tkinter module (a fake Tk that keeps its key bindings and its after() timers, and a fake Canvas that records
// every shape, its tags and the drawing order), so no window opens. The checks send keys, run ticks, and look at
// what the game remembers and what it drew. The annotated kits carry their teach: notes as comments; the plain ones don't.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { PYTHON, loadEngine, loadBuilder, kitAnswers } from './helpers/engine.mjs';

const { L } = loadEngine();
const B = loadBuilder();
const lib = B.library;
const ANSWERS = kitAnswers();
const HAS_PYTHON = (() => { try { return spawnSync(PYTHON, ['--version'], { encoding: 'utf8' }).status === 0; } catch (_) { return false; } })();
const NO_PYTHON = !HAS_PYTHON && 'Python 3 is not installed';

const MODULES = [
  { plain: 'snake-py', notes: 'snake-py-notes', module: '1 · Snake' },
  { plain: 'invaders-py', notes: 'invaders-py-notes', module: '2 · Invaders' },
  { plain: 'nightsky-py', notes: 'nightsky-py-notes', module: '3 · Invaders under a night sky' },
  { plain: 'brothers-py', notes: 'brothers-py-notes', module: '4 · Jacques & Louis G.' },
];

/* ------------------------------------------------------------------ */
/* A stand-in tkinter                                                   */
/* ------------------------------------------------------------------ */

const FAKE_TKINTER = String.raw`"""A stand-in for tkinter, for the tests: nothing opens. Tk keeps its key bindings and its after() timers
(run them with run(n)); Canvas keeps every item with its kind, coordinates, options and tags, in drawing order."""
import itertools

_ids = itertools.count(1)
END = "end"


class Event:
    def __init__(self, **kw):
        self.__dict__.update(kw)


class Tk:
    current = None

    def __init__(self, *a, **kw):
        Tk.current = self
        self.bindings, self.timers, self.clock, self.looping, self._title = {}, [], 0, False, ""
        self._seq = itertools.count()

    def title(self, text=None):
        if text is not None:
            self._title = text
        return self._title

    def resizable(self, *a, **kw): pass
    def geometry(self, *a, **kw): pass
    def configure(self, **kw): pass
    config = configure
    def focus_set(self): pass
    def destroy(self): pass

    def bind(self, sequence, fn, add=None):
        self.bindings[sequence] = self.bindings.get(sequence, []) + [fn] if add else [fn]

    def after(self, ms, fn, *args):
        n = next(self._seq)
        self.timers.append((self.clock + int(ms), n, fn, args))
        return "after#%d" % n

    def after_cancel(self, ident):
        self.timers = [t for t in self.timers if "after#%d" % t[1] != ident]

    def mainloop(self):
        self.looping = True

    # --- for the tests ---
    def run(self, n=1):
        """Runs the next n timers, earliest first, moving the clock on to each."""
        for _ in range(n):
            if not self.timers:
                return
            t = min(self.timers, key=lambda t: (t[0], t[1]))
            self.timers.remove(t)
            self.clock = t[0]
            t[2](*t[3])

    def _fire(self, sequences, key):
        ev = Event(keysym=key, char=key if len(key) == 1 else "", widget=self)
        for s in sequences:
            for fn in list(self.bindings.get(s, [])):
                fn(ev)

    # As in Tk, a key with a binding of its own ("<Left>") goes only to that one, not to "<KeyPress>" as well.
    def press(self, key):
        own = [s for s in ("<%s>" % key, "<KeyPress-%s>" % key) if s in self.bindings]
        self._fire(own or ["<KeyPress>", "<Key>"], key)

    def release(self, key):
        own = [s for s in ("<KeyRelease-%s>" % key,) if s in self.bindings]
        self._fire(own or ["<KeyRelease>"], key)

    def tap(self, key):
        self.press(key)
        self.release(key)


class Canvas:
    def __init__(self, master=None, **kw):
        self.options, self.items, self.order = dict(kw), {}, []

    def pack(self, *a, **kw): pass
    def grid(self, *a, **kw): pass
    def focus_set(self): pass
    def bind(self, *a, **kw): pass

    def configure(self, **kw):
        self.options.update(kw)
    config = configure

    def _make(self, kind, coords, kw):
        if len(coords) == 1 and isinstance(coords[0], (list, tuple)):
            coords = coords[0]
        tags = kw.pop("tags", ())
        tags = tags.split() if isinstance(tags, str) else list(tags)
        i = next(_ids)
        self.items[i] = {"kind": kind, "coords": [float(c) for c in coords], "options": kw, "tags": tags}
        self.order.append(i)
        return i

    def create_rectangle(self, *c, **kw): return self._make("rectangle", c, kw)
    def create_oval(self, *c, **kw): return self._make("oval", c, kw)
    def create_line(self, *c, **kw): return self._make("line", c, kw)
    def create_polygon(self, *c, **kw): return self._make("polygon", c, kw)
    def create_text(self, *c, **kw): return self._make("text", c, kw)
    def create_arc(self, *c, **kw): return self._make("arc", c, kw)

    def find_withtag(self, tag):
        if tag == "all":
            return tuple(self.order)
        if isinstance(tag, int):
            return (tag,) if tag in self.items else ()
        return tuple(i for i in self.order if tag in self.items[i]["tags"])
    find_all = lambda self: tuple(self.order)

    def delete(self, *tags):
        for tag in tags:
            for i in self.find_withtag(tag):
                del self.items[i]
                self.order.remove(i)

    def coords(self, tag, *c):
        found = self.find_withtag(tag)
        if not found:
            return []
        if c:
            if len(c) == 1 and isinstance(c[0], (list, tuple)):
                c = c[0]
            self.items[found[0]]["coords"] = [float(v) for v in c]
        return list(self.items[found[0]]["coords"])

    def move(self, tag, dx, dy):
        for i in self.find_withtag(tag):
            cs = self.items[i]["coords"]
            self.items[i]["coords"] = [v + (dx if k % 2 == 0 else dy) for k, v in enumerate(cs)]

    def itemconfigure(self, tag, **kw):
        for i in self.find_withtag(tag):
            self.items[i]["options"].update(kw)
    itemconfig = itemconfigure

    def itemcget(self, tag, option):
        found = self.find_withtag(tag)
        return self.items[found[0]]["options"].get(option, "") if found else ""

    def gettags(self, item):
        return tuple(self.items[item]["tags"]) if item in self.items else ()

    def type(self, item):
        return self.items[item]["kind"] if item in self.items else None

    def bbox(self, tag):
        cs = [c for i in self.find_withtag(tag) for c in [self.items[i]["coords"]]]
        if not cs:
            return None
        xs = [v for c in cs for v in c[0::2]]
        ys = [v for c in cs for v in c[1::2]]
        return (min(xs), min(ys), max(xs), max(ys))

    def _restack(self, tag, ref, above):
        moving = [i for i in self.order if i in self.find_withtag(tag)]
        rest = [i for i in self.order if i not in moving]
        if ref is None:
            self.order = rest + moving if above else moving + rest
            return
        anchor = [k for k, i in enumerate(rest) if i in self.find_withtag(ref)]
        if not anchor:
            self.order = rest + moving if above else moving + rest
            return
        at = anchor[-1] + 1 if above else anchor[0]
        self.order = rest[:at] + moving + rest[at:]

    def tag_raise(self, tag, above=None): self._restack(tag, above, True)
    def tag_lower(self, tag, below=None): self._restack(tag, below, False)
    lift = tag_raise
    lower = tag_lower

    # --- for the tests ---
    def tagged(self, tag):
        return [self.items[i] for i in self.find_withtag(tag)]

    def texts(self):
        return [self.items[i]["options"].get("text", "") for i in self.order if self.items[i]["kind"] == "text"]

    def first(self, tag):
        """Where the first item with this tag sits in the drawing order (0 is drawn first, at the back)."""
        found = self.find_withtag(tag)
        return self.order.index(found[0]) if found else -1

    def last(self, tag):
        found = self.find_withtag(tag)
        return self.order.index(found[-1]) if found else -1
`;

/* What every check starts with: the game built and started (mainloop returns at once), and its parts at hand. */
const PREAMBLE = `import random, sys
random.seed(7)
import tkinter as tk
import main
import tools
window, canvas = tk.Tk.current, tools.canvas
assert window.looping, "mainloop was called, last"
def check(ok, what):
    if not ok:
        raise AssertionError(what)
`;

/* ------------------------------------------------------------------ */
/* Building and running                                                 */
/* ------------------------------------------------------------------ */

/* A kit's project: "all" its steps (blanks answered), "walk" (its walk steps), or a list of step ids. */
function kitProject(kitId, which = 'all', library = lib) {
  const kit = library.kits[kitId];
  const ids = which === 'all' ? kit.steps.map(s => s.id) : which === 'walk' ? kit.steps.filter(s => library.components[s.id].depth === 'walk').map(s => s.id) : which;
  const { project } = B.build(library, kitId, ids, 'game', []);
  for (const s of project.sections) for (const [k, v] of Object.entries(ANSWERS)) s.text = s.text.split(k).join(v);
  return project;
}
function pythonOf(project) {
  const res = L.compileProject(project).results;
  return Object.fromEntries(project.sections.map(s => [s.file, res[s.id].text]));
}
/* Runs a game's Python with the stand-in tkinter, then the checks (Python, after the preamble). */
function play(project, checks) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'intuicode-module-'));
  try {
    for (const [file, text] of Object.entries(pythonOf(project))) writeFileSync(path.join(dir, file + '.py'), text);
    writeFileSync(path.join(dir, 'tkinter.py'), FAKE_TKINTER);
    writeFileSync(path.join(dir, 'check.py'), PREAMBLE + checks);
    const r = spawnSync(PYTHON, ['check.py'], { cwd: dir, encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONDONTWRITEBYTECODE: '1' } });
    assert.equal(r.status, 0, (r.stderr || '') + (r.stdout || ''));
    return r.stdout.replace(/\r\n/g, '\n');
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const playKit = (kitId, which, checks) => play(kitProject(kitId, which), checks);

/* ------------------------------------------------------------------ */
/* Every module: plain and annotated, and playable at every stage      */
/* ------------------------------------------------------------------ */

for (const m of MODULES) {
  test(`${m.module}: a plain and an annotated version, asked together, with the same steps`, () => {
    const plain = lib.kits[m.plain], notes = lib.kits[m.notes];
    assert.ok(plain && notes);
    assert.deepEqual([plain.module, notes.module], [m.module, m.module]);
    assert.deepEqual([plain.version, notes.version, plain.annotated, notes.annotated], ['Python window', 'Python window · annotated', false, true]);
    assert.deepEqual([plain.shelf, plain.platform, notes.shelf, notes.platform], ['modules', 'pc', 'modules', 'pc']);
    assert.deepEqual(JSON.parse(JSON.stringify(plain.steps)), JSON.parse(JSON.stringify(notes.steps)));
    const steps = plain.steps.map(s => lib.components[s.id]);
    assert.ok(steps.every(c => c.id === 'package' || c.id.startsWith('mpy-')), 'its own steps start with mpy-');
    const depths = steps.map(c => c.depth);
    assert.equal(depths.filter(d => d === 'hallway').length, 1, 'one hallway step');
    assert.match(steps.find(c => c.depth === 'hallway').name, /^Your turn/);
    assert.ok(depths.lastIndexOf('walk') < depths.indexOf('hallway') && depths.indexOf('hallway') < depths.indexOf('horizon'), 'walk steps, then your turn, then horizon steps');
    const q = Object.values(lib.questions).find(x => x.options.some(o => o.kit === m.plain));
    assert.ok(q.options.some(o => o.kit === m.notes), 'the two versions are offered in one question');
  });

  test(`${m.module}: the annotated build has the teach notes as comments, the plain one has none of them, and both run`, { skip: NO_PYTHON }, () => {
    const teach = [...new Set(lib.kits[m.plain].steps.flatMap(s => Object.values(lib.components[s.id].sections).flat())
      .map(l => (l.match(/^\s*teach:\s?(.*)$/) || [])[1]).filter(Boolean))];
    assert.ok(teach.length >= 10, `plenty of teach lines (${teach.length})`);
    for (const t of teach) assert.doesNotMatch(t, /\b(simply|just|easy|easily)\b|!/i, `teach lines stay helpful: ${t}`);
    const notes = Object.values(pythonOf(kitProject(m.notes))).join('\n');
    const plain = Object.values(pythonOf(kitProject(m.plain))).join('\n');
    for (const t of teach) {
      assert.ok(notes.includes('# ' + t), `annotated: "# ${t}"`);
      assert.ok(!plain.includes(t), `plain: no "${t}"`);
    }
    assert.ok(plain.split('\n').length < notes.split('\n').length);
    for (const kit of [m.plain, m.notes]) playKit(kit, 'all', 'window.run(30)\nfor k in ["Left", "Up", "Right", "Down", "space", "Left"]:\n    window.tap(k)\n    window.run(5)\n');
  });

  test(`${m.module}: the game plays at the end of every step: each walk step built on the ones before it runs`, { skip: NO_PYTHON }, () => {
    const kit = lib.kits[m.plain];
    const walk = kit.steps.filter(s => lib.components[s.id].depth === 'walk' && s.id !== 'mpy-start').map(s => s.id);
    for (let n = 1; n <= walk.length; n++) {
      const stage = B.libraryWith([`kit: stage\ntitle: Stage ${n}\nlayout: structured\nshelf: modules\nabout: The first ${n} steps.\nsteps: ${[...walk.slice(0, n), 'mpy-start'].map(id => id + '!').join(', ')}`]);
      // the first stage may be an empty window; from the second on, something is drawn
      play(kitProject('stage', [], stage), `window.run(40)\nfor k in ["Up", "Left", "space", "Right"]:\n    window.press(k)\n    window.run(10)\n    window.release(k)\ncheck(${n} == 1 or len(canvas.order) > 0, "something is drawn")\n`);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Each game, played                                                    */
/* ------------------------------------------------------------------ */

test('Snake: it moves every tick, turns (never back into its neck), eats and grows, scores, dies at the wall and on itself, and restarts', { skip: NO_PYTHON }, () => {
  const checks = String.raw`
T = tools
check(len(canvas.tagged("grid")) == (T.COLUMNS + 1) + (T.ROWS + 1), "the grid's lines")
check(T.snake == [(5, 7), (4, 7), (3, 7)], "a short snake in the middle")
check(window.timers and window.timers[0][0] == T.START_SPEED, "the first tick is booked")
window.run(1)
check(T.snake[0] == (6, 7) and len(T.snake) == 3, "one square right, same length")
check(len(canvas.tagged("snake")) == 4, "three squares and a brighter head")
x1, y1, x2, y2 = canvas.tagged("snake")[0]["coords"]
check((x1, y1, x2, y2) == (6 * 24 + 1, 7 * 24 + 1, 7 * 24 - 1, 8 * 24 - 1), "square to pixels: x across, y down")
window.tap("Left")
check(T.heading == "Right", "no turning straight back")
window.tap("Up"); window.tap("Left")
check(T.heading == "Up", "two quick presses can't turn it into its neck")
window.run(1)
check(T.snake[0] == (6, 6), "moved up: y gets smaller")
window.tap("Left"); window.run(1)
check(T.snake[0] == (5, 6), "and left")
for n in range(1, 4):
    head = T.snake[0]
    T.food = (head[0] - 1, head[1])
    window.run(1)
    check(T.score == n and len(T.snake) == 3 + n, "ate %d" % n)
    check(T.food not in T.snake, "new food is never under the snake")
check("Score: 3" in canvas.texts(), "the score is drawn")
T.snake[:] = [(19, 5), (18, 5), (17, 5)]
T.heading = T.last_move = "Right"
window.run(1)
check(T.playing is False, "off the board: game over")
check(any("Game over" in t for t in canvas.texts()), "the message")
before = list(T.snake); window.run(3)
check(T.snake == before, "nothing moves while the game is over")
window.tap("space")
check(T.playing and T.score == 0 and len(T.snake) == 3, "space starts again, cleanly")
check(not any("Game over" in t for t in canvas.texts()), "the message is gone")
T.snake[:] = [(5, 5), (5, 6), (6, 6), (6, 5), (6, 4)]
T.heading, T.last_move = "Right", "Up"
window.run(1)
check(T.playing is False, "into itself: game over")
window.tap("space")
T.snake[:] = [(5, 5), (5, 6), (6, 6), (6, 5)]
T.heading, T.last_move = "Right", "Up"
window.run(1)
check(T.playing, "into the square its tail is leaving is fine")
`;
  playKit('snake-py', 'all', checks + String.raw`
T.snake[:] = [(2, 2)] + [(1, 2)] * 9
T.heading = T.last_move = "Down"
window.run(1)
check(T.speed == T.START_SPEED - 5 * 7, "your turn: faster as it grows (%s)" % T.speed)
due = sorted(window.timers)[0][0] - window.clock
check(due == T.speed, "the next tick comes sooner")
T.snake[:] = [(2, 2)] + [(1, 2)] * 40
window.run(1)
check(T.speed == T.FASTEST, "but never faster than the limit")
`);
  playKit('snake-py', 'walk', checks + 'T.snake[:] = [(2, 2)] + [(1, 2)] * 9\nwindow.run(1)\ncheck(T.speed == T.START_SPEED, "walk steps only: the same speed")\n');
});

const INVADERS_PLAY = String.raw`
T = tools
T.BOMB_CHANCE = 0   # no bombs until they're wanted
check(len(T.invaders) == 40 and T.playing, "a block of 5 by 8, and a game on")
check(T.cannon_x == T.WIDTH / 2 and len(canvas.tagged("cannon")) == 2, "the cannon in the middle: a body and a barrel")
window.tap("Right"); window.tap("Right")
check(T.cannon_x == T.WIDTH / 2 + 2 * T.CANNON_STEP, "the arrows move it")
for _ in range(40):
    window.tap("Left")
check(T.cannon_x == T.CANNON_WIDTH / 2, "never out of the window")
window.tap("space"); window.tap("space")
check(len(T.shots) == 1, "one shot in the air at a time")
y0 = T.shots[0]["y"]; window.run(1)
check(T.shots[0]["y"] == y0 - T.SHOT_SPEED and len(canvas.tagged("shot")) == 1, "the shot climbs")
window.run(60)
check(T.shots == [], "a shot that leaves the top is gone")
# the march: sideways every few ticks, with the legs swapping
xs, frame, n = [i["x"] for i in T.invaders], T.frame, 0
while [i["x"] for i in T.invaders] == xs and n < 30:
    window.run(1); n += 1
check(n <= 13, "a step within a few ticks (%d)" % n)
check([i["x"] for i in T.invaders] == [x + T.MARCH_STEP for x in xs], "the whole block steps right together")
check(T.frame == 1 - frame, "the legs swap")
# at the right edge: down and back
shift = T.WIDTH - 8 - T.INVADER_WIDTH - max(i["x"] for i in T.invaders) - 1
for i in T.invaders:
    i["x"] += shift
ys, n = [i["y"] for i in T.invaders], 0
while [i["y"] for i in T.invaders] == ys and n < 30:
    window.run(1); n += 1
check([i["y"] for i in T.invaders] == [y + T.DROP for y in ys] and T.direction == -1, "at the edge it steps down and turns round")
# hits: overlapping boxes
check(T.overlap((0, 0, 10, 10), (5, 5, 15, 15)) and not T.overlap((0, 0, 10, 10), (10, 0, 20, 10)) and not T.overlap((0, 0, 10, 10), (0, 11, 10, 20)), "overlap")
def shoot_under(target):
    T.shots[:] = [dict(x=target["x"] + 15, y=target["y"] + T.INVADER_HEIGHT + T.SHOT_SPEED - 1)]
    window.run(1)
bottom = max(T.invaders, key=lambda i: i["y"])
shoot_under(bottom)
check(len(T.invaders) == 39 and bottom not in T.invaders and T.shots == [], "a hit removes the invader and the shot")
check(T.score == 10 and "Score 10" in canvas.texts(), "10 for the bottom row")
top = min(T.invaders, key=lambda i: i["y"])
shoot_under(top)
check(T.score == 60, "50 for the top row")
`;

const INVADERS_BOMBS = String.raw`
# bombs come from the lowest invader in a column
T.BOMB_CHANCE = 1
T.invaders[:] = [dict(x=100, y=60, row=0), dict(x=100, y=94, row=1), dict(x=200, y=60, row=0)]
for _ in range(30):
    T.bombs.clear(); T.drop_bomb()
    b = T.bombs[0]
    check((b["x"], b["y"]) in [(115, 94 + T.INVADER_HEIGHT), (215, 60 + T.INVADER_HEIGHT)], "from the bottom of a column: %s" % b)
T.BOMB_CHANCE = 0
T.bombs.clear()
window.tap("Return")
check(T.playing and len(T.invaders) == 3, "Return does nothing during a game")
def bomb_the_cannon():
    T.bombs.append(dict(x=T.cannon_x, y=T.GROUND - 4 - T.CANNON_HEIGHT - 2))
    window.run(1)
bomb_the_cannon()
check(T.lives == 2 and "Lives 2" in canvas.texts() and T.bombs == [], "a bomb on the cannon costs a life")
bomb_the_cannon(); bomb_the_cannon()
check(not T.playing and any("GAME OVER" in t for t in canvas.texts()), "no lives left: game over")
xs = [i["x"] for i in T.invaders]; window.run(40)
check([i["x"] for i in T.invaders] == xs, "nothing moves after game over")
window.tap("Return")
check(T.playing and T.lives == 3 and T.score == 0 and len(T.invaders) == 40 and T.cannon_x == T.WIDTH / 2, "Return: a new game, every part reset")
check(not any("GAME OVER" in t for t in canvas.texts()), "the message is gone")
for i in T.invaders:
    i["y"] += T.GROUND - 120
window.run(1)
check(not T.playing, "the invaders reached the ground: game over")
window.tap("Return")
`;

const INVADERS_WAVES = String.raw`
T.invaders.clear()
window.run(1)
check(len(T.invaders) == 40 and T.wave == 2 and "Wave 2" in canvas.texts(), "a cleared screen brings the next wave")
check(min(i["y"] for i in T.invaders) == 50 + T.DROP, "a row lower")
T.lives = 1; T.bombs.append(dict(x=T.cannon_x, y=T.GROUND - 20)); window.run(1)
check(not T.playing, "game over")
window.tap("Return")
check(T.wave == 1 and "Wave 1" in canvas.texts(), "a new game starts at wave 1")
`;

test('Invaders: the cannon moves and fires, the block marches and steps down, shots hit, bombs cost lives, the game ends and restarts, waves follow', { skip: NO_PYTHON }, () => {
  playKit('invaders-py', 'all', INVADERS_PLAY + INVADERS_BOMBS + INVADERS_WAVES + String.raw`
del T.invaders[8:]
window.run(1)
check(T.march_wait == 1 + T.MARCH_EVERY * 8 // 40, "your turn: fewer invaders, shorter waits (%s)" % T.march_wait)
del T.invaders[1:]
window.run(1)
check(T.march_wait == 1, "the last one steps every tick")
`);
  playKit('invaders-py', 'walk', INVADERS_PLAY + 'del T.invaders[8:]\nwindow.run(1)\ncheck(T.march_wait == T.MARCH_EVERY, "walk steps only: the same pace")\n');
});

const SKY_LAYERS = String.raw`
def background_first(when):
    tags = [canvas.items[i]["tags"] for i in canvas.order]
    back = [k for k, t in enumerate(tags) if "background" in t]
    game = [k for k, t in enumerate(tags) if "background" not in t]
    check(back and game and max(back) < min(game), "%s: the whole background is drawn before (behind) the game" % when)
    layers = ["sky", "stars", "moon", "hills"]
    for low, high in zip(layers, layers[1:]):
        check(canvas.last(low) < canvas.first(high), "%s: %s behind %s" % (when, low, high))
    check(canvas.first("ground") > max(back) and canvas.first("cannon") > max(back), "%s: the ground line and the cannon in front" % when)
`;

const NIGHT_SKY = SKY_LAYERS + String.raw`
T = tools
background_first("at the start")
bands = canvas.tagged("sky")
check(len(bands) == T.BANDS, "a band for each step of the gradient")
check(bands[0]["options"]["fill"] == "#06081c" and bands[-1]["options"]["fill"] == "#34245c", "from the top colour to the bottom one")
check(T.mix((0, 0, 0), (255, 255, 255), 0.5) == "#808080", "mixing halfway")
check(len(canvas.tagged("stars")) == T.FAR_STARS + T.NEAR_STARS, "two layers of stars")
check(canvas.tagged("moon") and len(canvas.tagged("hills")) == 3, "the moon, two ranges of hills and the ground")
far = next(s for s in T.stars if s["speed"] == T.FAR_SPEED and s["y"] < 300)
near = next(s for s in T.stars if s["speed"] == T.NEAR_SPEED and s["y"] < 300)
far_y, near_y = far["y"], near["y"]
window.run(50)
check(abs(far["y"] - (far_y + 50 * T.FAR_SPEED)) < 1e-6 and abs(near["y"] - (near_y + 50 * T.NEAR_SPEED)) < 1e-6, "parallax: near stars drift three times as fast")
check(canvas.items[near["dot"]]["coords"][1] == near["y"], "the star is moved where it is")
near["y"] = T.GROUND - 0.1
window.run(1)
check(near["y"] < 1, "a star at the ground wraps round to the top")
dim = [s for s in T.stars if not s["lit"]]
check(dim and all(canvas.items[s["dot"]]["options"]["fill"] == T.DIM_COLOUR for s in dim), "some stars twinkle (dim)")
window.tap("space"); window.run(3)
background_first("after the game has drawn again")
T.shots.clear()
`;

test('Invaders under a night sky: the background is drawn behind the game, in layers; the gradient, parallax stars, twinkling, moon and hills; the game still plays', { skip: NO_PYTHON }, () => {
  playKit('nightsky-py', 'all', INVADERS_PLAY + NIGHT_SKY + String.raw`
T.SHOOTING_CHANCE = 1
window.run(2)
check(T.shooting is not None and canvas.tagged("shooting"), "your turn: a shooting star")
check(canvas.last("stars") < canvas.first("shooting") < canvas.first("moon"), "just above the stars, behind the rest")
background_first("with a shooting star")
T.SHOOTING_CHANCE = 0
window.run(30)
check(T.shooting is None and not canvas.tagged("shooting"), "it burns out")
`);
  playKit('nightsky-py', 'walk', INVADERS_PLAY + NIGHT_SKY + INVADERS_BOMBS + INVADERS_WAVES);
});

const BROTHERS = String.raw`
T = tools
TILE, W, H = T.TILE, T.HERO_WIDTH, T.HERO_HEIGHT
sx, sy = 2 * TILE + (TILE - W) / 2, 10 * TILE - H
def put(x, y):
    T.player_x, T.player_y, T.speed_y = x, y, 0
check(T.playing and T.hero is T.JACQUES, "Jacques starts")
check((T.player_x, T.player_y) == (sx, sy), "at S, feet on the street")
brick = next(i for i in canvas.order if "world" in canvas.items[i]["tags"] and canvas.items[i]["options"].get("fill") == T.BRICK)
brick_x = canvas.items[brick]["coords"][0]
check(len(canvas.tagged("world")) > 100, "the level is drawn from the map")
check(T.tile_at(22, 8) == "#" and T.tile_at(-1, 5) == "#" and T.tile_at(3, 20) == "." and T.solid_at(5, 330) and not T.solid_at(5, 300), "reading the map")
window.run(3)
check(T.on_ground and T.player_y == sy, "standing: gravity pulls, the street holds him up")
# falling: faster every tick, then landing
put(sx, 2 * TILE)
ys = [T.player_y]
for _ in range(6):
    window.run(1); ys.append(T.player_y)
fall = [b - a for a, b in zip(ys, ys[1:])]
check(all(b > a > 0 for a, b in zip(fall, fall[1:])), "falls faster every tick: %s" % fall)
window.run(40)
check(T.on_ground and T.player_y == sy and T.speed_y == 0, "lands on the street")
# keys held down
window.press("Right"); window.run(10)
check(T.player_x == sx + 10 * T.JACQUES["run"] and T.facing == 1 and "Right" in T.held, "runs for as long as Right is held")
window.release("Right"); window.run(5)
check(T.player_x == sx + 30 and "Right" not in T.held, "and stops when it's released")
window.press("Left"); window.run(1); window.release("Left")
check(T.facing == -1, "facing left")
# jumping: Jacques higher, Louis G. faster
def jump_height():
    put(sx, sy); window.run(2)
    window.press("Up"); window.run(1); window.release("Up")
    top = T.player_y
    for _ in range(80):
        window.run(1); top = min(top, T.player_y)
    check(T.on_ground and T.player_y == sy, "back on the ground after the jump")
    return sy - top
jacques = jump_height()
window.tap("s")
check(T.hero is T.LOUIS_G and "Louis G.  (S to switch)" in canvas.texts(), "S switches to Louis G.")
check("s" not in T.held, "a key with its own binding isn't held")
louis = jump_height()
check(jacques > 3 * TILE > louis > 2 * TILE, "Jacques clears three tiles, Louis G. two (%s, %s)" % (jacques, louis))
put(sx, sy); window.press("Right"); window.run(10); window.release("Right")
check(T.player_x == sx + 10 * T.LOUIS_G["run"], "Louis G. runs faster")
# walls, and the high wall only Jacques can climb
def climb():
    put(18 * TILE, sy); window.run(1)
    window.press("Right"); window.run(50)
    against = T.player_x
    window.press("Up")
    on_top = False
    for _ in range(60):
        window.run(1)
        if T.player_y == 7 * TILE - H:   # standing on the wall (holding Up, he jumps again straight away)
            on_top = True
            break
    window.release("Up"); window.release("Right")
    return against, on_top
against, on_top = climb()
check(against == 22 * TILE - W, "the wall stops him at its edge (%s)" % against)
check(not on_top, "Louis G. can't jump the high wall")
window.tap("s")
check(T.hero is T.JACQUES, "back to Jacques")
before = T.collected
against, on_top = climb()
check(on_top, "Jacques can")
check(T.collected == before + 1, "and collects the spark on top")
# the camera follows, and the world slides the other way
check(T.camera_x == T.player_x - T.WIDTH / 3, "the camera keeps him a third of the way across")
check(canvas.items[brick]["coords"][0] == brick_x - T.camera_x, "the world has moved left by the camera")
check(canvas.tagged("hero")[0]["coords"][0] == T.player_x - T.camera_x + 4, "he is drawn at his place minus the camera")
put(62 * TILE, sy); window.run(1)
check(T.camera_x == T.LEVEL_WIDTH - T.WIDTH, "the camera stops at the end of the level")
put(sx, sy); window.run(1)
check(T.camera_x == 0, "and at the start")
# sparks
count = len(T.sparks)
put(5 * TILE + 6, sy); window.run(1)
check(len(T.sparks) == count - 1 and len(canvas.tagged("spark")) == count - 1 and "Sparks %d" % T.collected in canvas.texts(), "a spark is collected")
# surges patrol their girder
surge = next(s for s in T.surges if s["y"] < 200)
turns, last = 0, surge["direction"]
for _ in range(200):
    window.run(1)
    if surge["direction"] != last:
        turns, last = turns + 1, surge["direction"]
    check(27 * TILE <= surge["x"] <= 31 * TILE, "a surge stays on its girder")
check(turns >= 2, "and turns round at the ends")
# hazards
put(15 * TILE + 6, sy); window.run(1)
check(T.lives == 2 and (T.player_x, T.player_y) == (sx, sy), "a loose wire costs a life, and back to the start")
ground = next(s for s in T.surges if s["y"] > 200)
put(ground["x"] - W / 2, sy); window.run(1)
check(T.lives == 1 and T.camera_x == 0, "a surge costs a life")
put(38 * TILE, sy); window.run(60)
check(T.lives == 0 and not T.playing, "down the gap and out of the level: no lives left")
check(any("Out of lives" in t for t in canvas.texts()), "game over")
window.tap("Return")
check(T.playing and T.lives == 3 and T.collected == 0 and len(T.sparks) == len(T.places_of("*")) == 11 and T.hero is T.JACQUES, "Return: a new game, everything back")
check(canvas.items[brick]["coords"][0] == brick_x, "the world back where it started")
# the fuse box
put(61 * TILE + 6, sy); window.run(1)
check(T.power_on and not T.playing, "the fuse box restores the power")
lamps = canvas.tagged("lamp")
check(len(lamps) == 5 and all(l["options"]["fill"] == T.LAMP_ON for l in lamps), "every street lamp lights")
world = [k for k, i in enumerate(canvas.order) if "world" in canvas.items[i]["tags"] and "glow" not in canvas.items[i]["tags"]]
check(canvas.tagged("glow") and canvas.last("glow") < min(world), "the glows sit at the back")
check(any("Power restored" in t for t in canvas.texts()), "and says so")
window.tap("Return")
check(T.playing and not T.power_on and not canvas.tagged("glow") and all(l["options"]["fill"] == T.LAMP_OFF for l in canvas.tagged("lamp")), "a new game: the street is dark again")
`;

test('Jacques & Louis G.: they fall and land, run while keys are held, jump (one higher, one faster), the camera scrolls, sparks are collected, hazards cost lives, and the fuse box lights the street', { skip: NO_PYTHON }, () => {
  playKit('brothers-py', 'all', BROTHERS + String.raw`
check(T.time_left == T.TIME_LIMIT, "your turn: the clock starts full")
window.run(1000 // T.TICK)
check(T.time_left == T.TIME_LIMIT - 1 and "Time %d" % (T.TIME_LIMIT - 1) in canvas.texts(), "a second comes off every 1000 // TICK ticks")
T.time_left = 1
window.run(1000 // T.TICK)
check(not T.playing, "out of time: game over")
`);
  playKit('brothers-py', 'walk', BROTHERS + 'check(not hasattr(T, "time_left"), "walk steps only: no clock")\n');
});
