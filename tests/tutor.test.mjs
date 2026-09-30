// The tutor: every habit the reader can find has a card, and "Your turn" answers are checked exactly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT, PYTHON, compareMany } from './helpers/engine.mjs';

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
});
