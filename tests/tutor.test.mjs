// The tutor: every habit the reader can find has a card, and "Your turn" answers are checked exactly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT, PYTHON, compareMany, loadWebReader, loadEngine } from './helpers/engine.mjs';
const plainList = (x) => JSON.parse(JSON.stringify(x));

const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(readFileSync(path.join(ROOT, 'lang/tutor.js'), 'utf8'), ctx, { filename: 'lang/tutor.js' });
const T = ctx.IntuiTutor;

const styleOf = (sources) => JSON.parse(execFileSync(PYTHON, [path.join(ROOT, 'lang/python_reader.py'), 'style-json'], { input: JSON.stringify(sources) }).toString());

// A file that uses every habit the tutor knows.
const EVERYTHING = `"""A module that introduces itself."""
import os
import numpy as np
from random import randint

LIMIT = 10


class Account:
    """A bank account."""

    def __init__(self, owner):
        self.owner = owner
        self._history = []

    @property
    def summary(self) -> str:
        return f"{self.owner}"


def add_items(items=None, *extra, **named):
    global LIMIT
    total = 0
    for item in items:
        total += 1
    for i in range(3):
        if i is None or i in items:
            break
    for i, x in enumerate(items):
        pass
    while total > 0:
        total -= 1
    with open("notes.txt") as f:
        pass
    try:
        age = int(input("Age? "))
    except:
        name = input("Name? ")
    doubled = [x * 2 for x in items]
    prices = {"apple": 3}
    items.append(4)
    key = lambda p: p
    print(total)
    return total


async def fetch():
    return await other()


if __name__ == "__main__":
    add_items([])
`;

test('every habit the reader can find has a card, with a title, a short note and a why', () => {
  const [res] = styleOf([EVERYTHING]);
  assert.equal(res.ok, true, res.error);
  const found = new Set(res.points.map(p => p.card));
  const cards = Object.keys(T.CARDS.python);
  assert.deepEqual([...found].filter(c => !cards.includes(c)), [], 'habits with no card');
  assert.deepEqual(cards.filter(c => !found.has(c)), [], 'cards the reader never finds in the sample');
  for (const [id, c] of Object.entries(T.CARDS.python)) {
    for (const part of ['title', 'say', 'more']) assert.ok(typeof c[part] === 'string' && c[part].length > 10, `${id}.${part}`);
  }
});

test('Your turn: an answer is right when Python reads it the same way, however it is spaced', () => {
  const cases = [
    // [expected (what the sentence became), answer, right?]
    ['guesses_left = max_guesses', 'guesses_left=max_guesses', true],
    ['print(f"Hi {name}")', "print(f'Hi {name}')", true],
    ['while guesses_left > 0:', 'while guesses_left>0:', true],
    ['if guess == secret:', 'if guess == secret :', true],
    ['else:', 'else:', true],
    ['return total', 'return  total', true],
    ['break', 'break', true],
    ['data = await fetch()', 'data = await fetch()', true],
    ['guesses_left -= 1', 'guesses_left = guesses_left - 1', false],   // the same result, said differently: Python reads it differently
    ['while guesses_left > 0:', 'while guesses_left >= 0:', false],
    ['print(total)', 'print(Total)', false],
  ];
  const results = compareMany(cases.map(([expected, answer]) => [T.probe(expected), T.probe(answer)]));
  cases.forEach(([expected, answer, right], i) => assert.equal(results[i].same, right, `${expected}  vs  ${answer}: ${JSON.stringify(results[i])}`));
  const broken = compareMany([[T.probe('x = 1'), T.probe('x = (1')]])[0];
  assert.equal(broken.same, false);
  assert.match(broken.error, /can't be read/);
});

test('an exercise is the one line a sentence became (imports and notes aside)', () => {
  assert.equal(T.exerciseLine(['    total += 1']), 'total += 1');
  assert.equal(T.exerciseLine(['import random', 'r = random.randint(1, 6)']), 'r = random.randint(1, 6)');
  assert.equal(T.exerciseLine(['a = 1', 'b = 2']), null);
  assert.equal(T.exerciseLine(['# a note', '']), null);
  assert.equal(T.exerciseLine(['#include <cmath>', '    double r = std::sqrt(x);']), 'double r = std::sqrt(x);');
  assert.equal(T.exerciseLine(['// a note', '}']), null);
});

/* ---------- The sentences: how to talk to the program ---------- */
test('sentence habits: found on real lines of each kind of project, and every one has a card', () => {
  const { L, WEB, CPP } = loadEngine();
  const ctx = (pack) => ({ pack, opens: pack === 'web' ? WEB.OPENS_BLOCK : pack === 'python' ? L.OPENS_BLOCK : CPP.OPENS_BLOCK, filler: L.FILLER.lead });
  const cases = [
    ['python', 'while guesses left is more than 0', ['compare', 'repeat', 'block']],
    ['python', 'ask for a number "Your guess: " and store in guess', ['store', 'text']],
    ['python', 'show "Hi {name}"', ['fill']],
    ['python', 'then set high score to 0', ['filler', 'naming']],
    ['python', 'otherwise', ['otherwise', 'block']],
    ['python', 'for each name in names', ['each', 'block']],
    ['python', 'define greet using name', ['define', 'block']],
    ['python', 'run greet with "Sam" and store in reply', ['run', 'store', 'text']],
    ['python', 'set gain to ‹a number›', ['slot', 'naming']],
    ['python', 'note: why this is here', ['note']],
    ['python', 'python: x = [i for i in range(3)]', ['raw']],
    ['web', 'add a button called save saying "Save" in group card', ['called', 'group', 'text']],
    ['web', 'style save: background navy, text colour white', ['styles']],
    ['web', 'when save is clicked', ['event', 'block']],
    ['web', 'on screens narrower than 600:', ['screens', 'block']],
    ['arduino', 'when the board starts', ['board', 'block']],
    ['arduino', 'make pin LED an output', ['pins']],
    ['arduino', 'set unsigned long last to 0', ['kinds', 'naming']],
  ];
  const seen = new Set();
  for (const [pack, line, want] of cases) {
    const got = plainList(T.sayPoints(line, ctx(pack)));
    assert.deepEqual(got.slice().sort(), want.slice().sort(), `${pack}: ${line}`);
    got.forEach(c => seen.add(c));
  }
  const cards = Object.keys(T.CARDS.say);
  assert.deepEqual(cards.filter(c => !seen.has(c)), [], 'every sentence card is found on some line');
  for (const [id, c] of Object.entries(T.CARDS.say)) for (const part of ['title', 'say', 'more']) assert.ok(typeof c[part] === 'string' && c[part].length > (part === 'title' ? 3 : 10), `say.${id}.${part}`);
});

/* ---------- C++ and Arduino ---------- */
const W = await loadWebReader();
await W.loadLangs(['cpp']);

// C++ that uses every habit the tutor knows, sketch habits included.
const CPP_EVERYTHING = `#include <iostream>
#include <string>
#include <vector>
using namespace std;

const int BUTTON = 2;
unsigned long lastBlink = 0;

template <typename T>
T twice(T x) { return x * 2; }

class Account {
public:
    std::string owner;
    Account(const std::string& owner, double b) : balance(b) {
        this->owner = owner;
    }
    void deposit(double amount) {
        balance += amount;
    }
private:
    double balance = 0;
};

double area(double w, double h) {
    return w * h;
}

void setup() {
    pinMode(BUTTON, INPUT_PULLUP);
    Serial.begin(9600);
    tone(8, 440, 200);
}

void loop() {
    if (digitalRead(BUTTON) == LOW && millis() - lastBlink >= 500) {
        digitalWrite(13, HIGH);
        analogWrite(9, map(analogRead(A0), 0, 1023, 0, 255));
        Serial.println(String("Blinks: ") + lastBlink);
        delay(10);
    }
}

int main() {
    Account account("Sam", 50);
    account.deposit(25);
    std::vector<int> scores = {1, 2};
    auto doubled = [](int a) { return a * 2; };
    int* p = new int(3);
    int guess;
    std::cin >> guess;
    for (int i = 0; i < 3; i++) { if (i == 1) break; }
    for (const auto& s : scores) { std::cout << s << std::endl; }
    while (guess > 0) { guess--; }
    return 0;
}
`;

test('C++: every habit the tutor can find has a card, and every card is found', () => {
  const res = T.cppStylePoints(W.parse, CPP_EVERYTHING);
  assert.equal(res.ok, true, res.error);
  const found = new Set(res.points.map(p => p.card));
  const cards = Object.keys(T.CARDS.cpp);
  assert.deepEqual([...found].filter(c => !cards.includes(c)), [], 'habits with no card');
  assert.deepEqual(cards.filter(c => !found.has(c)), [], 'cards never found in the sample');
  for (const [id, c] of Object.entries(T.CARDS.cpp)) {
    for (const part of ['title', 'say', 'more']) assert.ok(typeof c[part] === 'string' && c[part].length > 10, `${id}.${part}`);
  }
  // each habit points at its own line, in reading order
  const at = (card) => res.points.find(p => p.card === card).line;
  assert.equal(at('include'), 1);
  assert.equal(at('constructor'), 15);
  assert.equal(at('setup-loop'), 29);
  assert.equal(at('pullup'), 30);
  const lines = res.points.map(p => p.line);
  assert.ok(lines.every((l, i) => !i || lines[i - 1] <= l), 'in reading order');
  assert.equal(res.points.find(p => p.card === 'include').end, 1);
});

test('C++ Your turn: right when C++ reads the same tokens, however it is spaced', () => {
  const cases = [
    ['int guesses = 0;', 'int guesses=0;', true],
    ['guesses += 1;', 'guesses+=1 ;', true],
    ['if (guess == secret) {', 'if(guess==secret){', true],
    ['} else if (guess < secret) {', '}else if (guess<secret) {', true],
    ['std::cout << "Higher" << std::endl;', 'std::cout<<"Higher"<<std::endl;', true],
    ['double area(double w, double h) {', 'double area(double w,double h){', true],
    ['const int BUTTON = 2;', 'const int BUTTON = 2; // the button', true],
    ['digitalWrite(LED, HIGH);', 'digitalWrite(LED, HIGH);', true],
    ['std::cout << "Higher" << std::endl;', 'std::cout << "higher" << std::endl;', false],   // the text itself differs
    ['guesses += 1;', 'guesses = guesses + 1;', false],                                     // the same result, said differently
    ['guesses += 1;', 'guesses++;', false],
    ['int guesses = 0;', 'auto guesses = 0;', false],
  ];
  for (const [expected, answer, right] of cases) {
    const r = T.cppCompare(W.parse, expected, answer);
    assert.equal(r.same, right, `${expected}  vs  ${answer}: ${JSON.stringify(r)}`);
  }
  const broken = T.cppCompare(W.parse, 'int x = 1;', 'int x = 1');
  assert.equal(broken.same, false);
  assert.match(broken.error, /can't read/);
});

test('C++: a whole program is the same when its tokens are, comments and spacing aside', () => {
  assert.equal(T.cppSameProgram(W.parse, 'int main() {\n    return 0;\n}\n', 'int main(){ return 0; } // done'), true);
  assert.equal(T.cppSameProgram(W.parse, 'int main() { return 0; }', 'int main() { return 1; }'), false);
});
