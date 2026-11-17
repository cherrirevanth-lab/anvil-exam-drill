// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { createDrill, loadBank, mulberry32 } from '../src/index.mjs';

const questions = [
  { id: 'q1', question: 'Define a stack.', answer: 'LIFO.', marks: 5, topic: 'stacks', priority: 5 },
  { id: 'q2', question: 'Define a queue.', answer: 'FIFO.', marks: 5, topic: 'queues', priority: 2 },
  { id: 'q3', question: 'Rotate a matrix.', answer: 'Transpose then reverse rows.', marks: 10, topic: 'arrays', priority: 3 },
  { id: 'q4', question: 'Explain hashing.', answer: 'Key to bucket.', marks: 3, topic: 'hashing', priority: 4 },
  { id: 'q5', question: 'Detect a cycle.', answer: 'Floyd.', marks: 8, topic: 'lists', priority: 1 },
];
const bank = loadBank({ questions });

test('a valid bank loads and is frozen', () => {
  assert.equal(bank.length, 5);
  assert.ok(Object.isFrozen(bank));
  assert.ok(Object.isFrozen(bank[0]));
  assert.equal(loadBank(JSON.stringify({ questions })).length, 5);
});

test('duplicate ids, bad marks and missing text are refused', () => {
  assert.throws(() => loadBank({ questions: [...questions, questions[0]] }), /duplicate/);
  assert.throws(() => loadBank({ questions: [{ ...questions[0], marks: 21 }] }), RangeError);
  assert.throws(() => loadBank({ questions: [{ ...questions[0], marks: 0 }] }), RangeError);
  assert.throws(() => loadBank({ questions: [{ ...questions[0], question: '' }] }), TypeError);
  assert.throws(() => loadBank({ questions: [] }), RangeError);
});

test('marks at exactly 20 are allowed', () => {
  assert.equal(loadBank({ questions: [{ ...questions[0], marks: 20 }] }).length, 1);
});

test('the same seed produces the same order', () => {
  const a = createDrill({ bank, seed: 7 });
  const b = createDrill({ bank, seed: 7 });
  assert.deepEqual(a.session(5).map((q) => q.id), b.session(5).map((q) => q.id));
});

test('a different seed can produce a different order when scores tie', () => {
  const flat = loadBank({
    questions: [1, 2, 3, 4].map((n) => ({
      id: 'e' + n, question: 'Equal ' + n, answer: 'x', marks: 5, topic: 't', priority: 3,
    })),
  });
  const a = createDrill({ bank: flat, seed: 1 }).session(4).map((q) => q.id);
  const b = createDrill({ bank: flat, seed: 99 }).session(4).map((q) => q.id);
  assert.notDeepEqual(a, b);
});

test('a session never repeats an id', () => {
  const ids = createDrill({ bank, seed: 3 }).session(5).map((q) => q.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, 5);
});

test('an exhausted session returns fewer items, then null', () => {
  const drill = createDrill({ bank, seed: 1 });
  assert.equal(drill.session(10).length, 5);
  const fresh = createDrill({ bank, seed: 1 });
  fresh.session(5);
  for (const q of bank) fresh.answer(q.id, 5);
  assert.equal(fresh.next(), null);
});

test('quality 5 raises mastery and quality 0 lowers it', () => {
  const drill = createDrill({ bank, seed: 1 });
  const before = drill.summary().predictedScore;
  const up = drill.answer('q1', 5);
  assert.ok(up.mastery > 0.3);
  const down = drill.answer('q2', 0);
  assert.ok(down.mastery < 0.3);
  assert.ok(drill.summary().predictedScore < before + 5);
});

test('a failed question comes back before mastered ones', () => {
  const pair = loadBank({
    questions: [
      { id: 'weak', question: 'Weak.', answer: 'x', marks: 5, topic: 't', priority: 3 },
      { id: 'other', question: 'Other.', answer: 'x', marks: 5, topic: 't', priority: 3 },
    ],
  });
  const drill = createDrill({ bank: pair, seed: 1 });
  const first = drill.next();
  drill.answer(first.id, 0);
  assert.equal(drill.next().id, first.id);
});

test('higher priority wins when marks are equal', () => {
  const pair = loadBank({
    questions: [
      { id: 'low', question: 'Low.', answer: 'x', marks: 5, topic: 't', priority: 1 },
      { id: 'high', question: 'High.', answer: 'x', marks: 5, topic: 't', priority: 5 },
    ],
  });
  assert.equal(createDrill({ bank: pair, seed: 1 }).next().id, 'high');
});

test('the summary is bounded and names weak topics first', () => {
  const drill = createDrill({ bank, seed: 1 });
  drill.answer('q1', 1);
  drill.answer('q3', 5);
  const summary = drill.summary();
  assert.ok(summary.predictedScore <= summary.totalMarks);
  assert.ok(summary.predictedScore >= 0);
  assert.ok(summary.weakTopics.length >= 2);
  assert.ok(summary.weakTopics[0].average <= summary.weakTopics[1].average);
  assert.equal(summary.totalMarks, 31);
});

test('export and import preserve history and mastery', () => {
  const drill = createDrill({ bank, seed: 1 });
  drill.next();
  drill.answer('q4', 2);
  const state = JSON.parse(JSON.stringify(drill.exportState()));
  const restored = createDrill({ bank, seed: 1 });
  restored.importState(state);
  assert.deepEqual(restored.summary(), drill.summary());
});

test('the PRNG is deterministic and in [0,1)', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 20; i += 1) {
    const value = a();
    assert.equal(value, b());
    assert.ok(value >= 0 && value < 1);
  }
});

test('an unknown answer id and invalid quality are refused', () => {
  const drill = createDrill({ bank, seed: 1 });
  assert.throws(() => drill.answer('nope', 3), /unknown/);
  assert.throws(() => drill.answer('q1', 6), RangeError);
  assert.throws(() => drill.answer('q1', -1), RangeError);
});
