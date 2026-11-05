// Predictive Mode (lang/predict.js): the rest of a sentence from sentences written before, as a terminal predicts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './helpers/engine.mjs';

const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(readFileSync(path.join(ROOT, 'lang/predict.js'), 'utf8'), ctx, { filename: 'lang/predict.js' });
const P = ctx.IntuiPredict;
const plain = (x) => JSON.parse(JSON.stringify(x));

test('Predict: sentences written before that start with what is typed, most recent first, each once', () => {
  const lines = ['set speed to 5', '    set score to 0', 'show score', 'Set speed to 5', 'set speed to 10'];
  assert.deepEqual(plain(P.history('set s', lines)), ['set speed to 5', 'set score to 0', 'set speed to 10']);
  assert.deepEqual(plain(P.history('set sp', lines, 1)), ['set speed to 5']);
  assert.deepEqual(plain(P.history('SHOW', lines)), ['show score']);
});

test('Predict: what is typed already, notes, code lines and unfilled blanks are never offered', () => {
  const lines = ['show score', 'note: show the score', 'python: show = 1', 'show ‹value›', 'sh'];
  assert.deepEqual(plain(P.history('show score', lines)), []);
  assert.deepEqual(plain(P.history('show', lines)), ['show score']);
  assert.deepEqual(plain(P.history('', lines)), []);
  assert.deepEqual(plain(P.history('note', lines)), []);
  assert.deepEqual(plain(P.history('python', lines)), []);
});

test('Predict: the rest of a prediction carries on from what is typed, spaces and case included', () => {
  assert.equal(P.rest('set ', 'set speed to 5'), 'speed to 5');
  assert.equal(P.rest('Set sp', 'set speed to 5'), 'eed to 5');
  assert.equal(P.rest('set', 'set ‹name› to ‹value›'), ' ‹name› to ‹value›');
  assert.equal(P.rest('show', 'set speed to 5'), '');
  assert.equal(P.rest('set speed to 5', 'set speed to 5'), '');
  assert.equal(P.rest('', 'set speed to 5'), '');
});

test('Predict: the next word of a prediction, a blank counting as one word', () => {
  assert.equal(P.nextWord('speed to 5'), 'speed');
  assert.equal(P.nextWord(' to 5'), ' to');
  assert.equal(P.nextWord(' ‹name› to ‹value›'), ' ‹name›');
  assert.equal(P.nextWord('5'), '5');
});

test('Predict: lines entered are remembered at the front, once, and only whole sentences', () => {
  let h = [];
  h = P.remember(h, 'set speed to 5');
  h = P.remember(h, '    show speed');
  h = P.remember(h, 'Set speed to 5');
  h = P.remember(h, 'note: just a note');
  h = P.remember(h, '');
  assert.deepEqual(plain(h), ['Set speed to 5', 'show speed']);
  assert.equal(P.remember(['a b c', 'd e f', 'g h i'], 'j k l', 2).length, 2);
});
