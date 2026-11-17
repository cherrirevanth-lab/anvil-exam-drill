# exam-drill

Spend the remaining hours on the questions that carry the marks.

## Why

Revision defaults to whatever is easiest to open, not what is worth the most. This scheduler ranks questions by `marks × priority × (1 + 0.5 × (1 - mastery))`, so a weak high-mark question outranks a mastered low-mark one. The PRNG is seeded, so a drill is reproducible: same bank, same seed, same order — which makes sessions reviewable and tests deterministic.

## Quickstart

```sh
node --test test/        # 14 tests, no dependencies
node src/cli.mjs         # drills a small bank, answers, summarises
node verify.mjs          # tests + CLI smoke, writes evidence.json
```

```js
import { createDrill, loadBank } from './src/index.mjs';

const bank = loadBank({
  questions: [
    { id: 'q1', question: 'Define idempotence.', answer: '...', topic: 'http', marks: 5, priority: 5 },
    { id: 'q2', question: 'Name three status codes.', answer: '...', topic: 'http', marks: 2, priority: 2 },
  ],
});

const drill = createDrill({ bank, seed: 42 });
drill.session(2);                 // ranked, unique within the session
drill.answer('q1', 2);            // quality 0–5
drill.summary();                  // predictedScore, weakTopics, mastered, seen
```

Final CLI line: `DRILL ok=true`.

## Question model

```js
{ id, question, answer, topic, marks: 1..20, priority: 1..5 }
```

`loadBank` accepts an object or JSON string. It rejects: no `questions` array, empty bank, missing id/text/answer/topic, duplicate ids, non-integer or out-of-range marks/priority. Questions are frozen.

## Ranking

```
score = marks × priority × (1 + 0.5 × (1 - mastery)) + random()
```

- `mastery` starts at `0.3` for every question.
- The seeded `mulberry32` jitter breaks ties reproducibly.
- Once presented, a question returns only while `mastery < 0.4`; mastered questions leave the pool.

## API

| Method | Behaviour |
|---|---|
| `next()` | Highest-ranked question available; may repeat a weak one |
| `session(limit)` | Up to `limit` distinct questions, never repeating within the session |
| `answer(id, quality)` | Running-average mastery over attempts; appends to history; returns `{id, mastery, attempts}` |
| `summary()` | `predictedScore`, `totalMarks`, `seen`, `mastered` (≥ 0.8), `weakTopics` sorted ascending |
| `exportState()` / `importState(state)` | Snapshot schema v1: seed, startedAt, presented ids, per-question stats |

## Invariants (tested)

1. Same bank + seed ⇒ same first question and same session order.
2. `session(n)` never repeats a question within the session.
3. A higher-scoring question is chosen over a lower-scoring one, all else equal.
4. `answer` moves mastery toward `quality / 5` and never outside `[0,1]`.
5. Unknown ids and out-of-range quality throw.
6. A mastered question is not offered again.
7. Export/import round-trips presented ids and per-question stats.
8. Invalid banks are rejected with the specific field named.

## Limits

- The score is a prioritisation heuristic, not a predicted grade.
- Mastery is a running average, not a fitted model (contrast `10-mastery-scheduler`).
- No spaced repetition: due dates are out of scope here.
- Ties are broken by seeded jitter plus id; not a global optimum.

## Permissions

No network, no dependencies, no writes, no secrets. CI requests `contents: read`. See `permission-manifest.json`.

## License

MIT © 2026 Revan
