# SPEC — exam-drill

## Purpose

A reproducible, marks-aware question selector with attempt tracking and a weak-topic summary.

## API

### `mulberry32(seed) → () => number`

Classic 32-bit seeded PRNG returning floats in `[0,1)`. Exported so tests and callers can reproduce jitter exactly.

### `loadBank(input) → readonly Question[]`

`input` may be a JSON string or an object with `questions`.

Validation (throws on the first violation):

| Check | Error |
|---|---|
| `questions` is an array | `TypeError` |
| non-empty | `RangeError` |
| each question is an object | `TypeError` |
| `id` non-empty string, unique | `TypeError` / `Error` |
| `question` non-empty | `TypeError` |
| `answer` non-empty | `TypeError` |
| `topic` non-empty | `TypeError` |
| `marks` integer 1–20 | `RangeError` |
| `priority` integer 1–5 | `RangeError` |

Returned questions are individually frozen.

### `createDrill({ bank, seed = 1, now = Date.now })`

`bank` may be a loaded array or raw input; raw input goes through `loadBank`.

State:

- `stats`: per id `{attempts: 0, mastery: 0.3, lastQuality: null, history: []}`
- `presented`: ids offered at least once
- `sessionSeen`: ids offered in the current drill object (used by `session`)

#### `next() → QuestionView | null`

Pool = never-presented questions, plus presented questions with `mastery < 0.4`. Rank by `scoreOf`, then id. `null` when the pool is empty.

`scoreOf = marks × priority × (1 + 0.5(1 - mastery)) + random()`.

`QuestionView` is `{id, question, marks, topic, priority}` — the answer is never returned.

#### `session(limit = 10) → QuestionView[]`

`limit` must be a positive integer. Repeatedly calls `pick({unique: true})` until `limit` or exhaustion. Stops early rather than repeating.

#### `answer(id, quality) → {id, mastery, attempts}`

- `quality` integer 0–5, else `RangeError`; unknown id throws.
- `mastery = clamp01((mastery × attempts + quality/5) / (attempts + 1))`.
- Increments `attempts`, sets `lastQuality`, appends `{quality, at: now()}`.

#### `summary() → { predictedScore, totalMarks, seen, mastered, weakTopics }`

- `predictedScore = round(Σ marks × mastery)`.
- `mastered` counts mastery ≥ 0.8.
- `weakTopics` = per-topic average of `lastQuality ?? mastery × 5`, sorted ascending by average then topic, formatted to 2 decimals.

#### `exportState()` / `importState(state)`

Schema v1: `{seed, startedAt, presented[], stats[{id, attempts, mastery, lastQuality, history[]}]}`. Import ignores ids not in the bank. Malformed state throws `TypeError`.

## Invariants

1. **Reproducibility:** identical bank, seed and call sequence ⇒ identical output.
2. **Uniqueness:** `session` never repeats within one session.
3. **Marks-awareness:** score increases with marks, priority and decreasing mastery.
4. **Answer confidentiality:** `next`/`session` views exclude `answer`.
5. **Bounded mastery:** always in `[0,1]`.
6. **Pool discipline:** mastery ≥ 0.4 removes a question from future selection.
7. **State integrity:** export/import preserves presented ids and stats.

## Known limits

- Seeded jitter makes ordering reproducible but not "fair" across topics.
- Mastery is a running mean; no forgetting curve.
- No exam timer, no section structure, no negative marking.
- `session` is scoped to the drill object, not to a calendar day.

## Test map

`test/exam-drill.test.mjs` — PRNG stability, bank validation, default mastery, deterministic session, uniqueness, marks ranking, answer updates, clamping, unknown id, pool removal, summary, export/import, malformed state.
