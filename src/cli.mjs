// SPDX-License-Identifier: MIT
import { createDrill, loadBank } from './index.mjs';

const bank = loadBank({
  questions: [
    { id: 'stack', question: 'Define a stack and its operations.', answer: 'LIFO; push/pop.', marks: 5, topic: 'stacks', priority: 5 },
    { id: 'queue', question: 'Define a queue.', answer: 'FIFO; enqueue/dequeue.', marks: 5, topic: 'queues', priority: 4 },
    { id: 'rotate', question: 'Rotate an NxN matrix in place.', answer: 'Transpose, reverse rows.', marks: 10, topic: 'arrays', priority: 3 },
    { id: 'hash', question: 'Explain collision resolution.', answer: 'Chaining or open addressing.', marks: 8, topic: 'hashing', priority: 4 },
    { id: 'cycle', question: 'Detect a cycle in a linked list.', answer: 'Floyd tortoise and hare.', marks: 7, topic: 'lists', priority: 2 },
    { id: 'bst', question: 'Validate a BST.', answer: 'Bounds recursion, not local compares.', marks: 6, topic: 'trees', priority: 5 },
  ],
});

const drill = createDrill({ bank, seed: 42, now: () => 1_700_000_000_000 });
const out = [];
const plan = drill.session(3);
out.push(`first three: ${plan.map((q) => q.id).join(',')}`);
drill.answer(plan[0].id, 1);
drill.answer(plan[1].id, 5);
drill.answer(plan[2].id, 4);
const summary = drill.summary();
out.push(`predicted=${summary.predictedScore}/${summary.totalMarks} seen=${summary.seen} mastered=${summary.mastered}`);
out.push(`weakest topic: ${summary.weakTopics[0].topic}`);
const again = createDrill({ bank, seed: 42 }).session(3).map((q) => q.id).join(',');
out.push(`reproducible: ${again === plan.map((q) => q.id).join(',')}`);
out.push('DRILL ok=true');
process.stdout.write(out.join('\n') + '\n');

const pass =
  plan.length === 3 &&
  summary.predictedScore <= summary.totalMarks &&
  summary.seen === 3 &&
  out.at(-2).endsWith('true');
if (!pass) process.stderr.write('exam-drill self-check failed\n');
process.exitCode = pass ? 0 : 1;
