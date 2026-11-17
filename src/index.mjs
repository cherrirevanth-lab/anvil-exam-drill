// SPDX-License-Identifier: MIT
/**
 * exam-drill - spend the remaining hours on the questions that carry the marks.
 *
 * Score = marks * priority * (1 + 0.5 * (1 - mastery)). A weak high-mark
 * question beats a mastered low-mark one. The PRNG is seeded, so a drill is
 * reproducible: same bank, same seed, same order.
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));

export function loadBank(input) {
  const data = typeof input === 'string' ? JSON.parse(input) : input;
  if (!data || !Array.isArray(data.questions)) throw new TypeError('bank must have a questions array');
  if (data.questions.length === 0) throw new RangeError('bank must not be empty');
  const ids = new Set();
  const questions = data.questions.map((q, index) => {
    if (!q || typeof q !== 'object') throw new TypeError(`question ${index} must be an object`);
    if (typeof q.id !== 'string' || q.id.length === 0) throw new TypeError(`question ${index} needs an id`);
    if (ids.has(q.id)) throw new Error(`duplicate question id: ${q.id}`);
    ids.add(q.id);
    if (typeof q.question !== 'string' || q.question.trim().length === 0) throw new TypeError(`question ${q.id} has no text`);
    if (typeof q.answer !== 'string' || q.answer.trim().length === 0) throw new TypeError(`question ${q.id} has no answer`);
    if (typeof q.topic !== 'string' || q.topic.trim().length === 0) throw new TypeError(`question ${q.id} has no topic`);
    if (!Number.isInteger(q.marks) || q.marks < 1 || q.marks > 20) throw new RangeError(`question ${q.id} marks must be 1..20`);
    if (!Number.isInteger(q.priority) || q.priority < 1 || q.priority > 5) {
      throw new RangeError(`question ${q.id} priority must be 1..5`);
    }
    return Object.freeze({ ...q });
  });
  return Object.freeze(questions);
}

export function createDrill({ bank, seed = 1, now = () => Date.now() } = {}) {
  const questions = Array.isArray(bank) ? bank : loadBank(bank);
  if (typeof seed !== 'number' || !Number.isFinite(seed)) throw new TypeError('seed must be a number');
  const random = mulberry32(seed);
  const stats = new Map(questions.map((q) => [q.id, { attempts: 0, mastery: 0.3, lastQuality: null, history: [] }]));
  const byId = new Map(questions.map((q) => [q.id, q]));
  const presented = new Set();
  const sessionSeen = new Set();
  const startedAt = now();

  function scoreOf(question) {
    const mastery = stats.get(question.id).mastery;
    return question.marks * question.priority * (1 + 0.5 * (1 - mastery)) + random();
  }

  function pick({ unique }) {
    const pool = questions.filter((q) => {
      if (unique && sessionSeen.has(q.id)) return false;
      if (!presented.has(q.id)) return true;
      return stats.get(q.id).mastery < 0.4;
    });
    if (pool.length === 0) return null;
    const ranked = pool.map((q) => ({ q, score: scoreOf(q) }));
    ranked.sort((a, b) => b.score - a.score || a.q.id.localeCompare(b.q.id));
    const chosen = ranked[0].q;
    presented.add(chosen.id);
    sessionSeen.add(chosen.id);
    return {
      id: chosen.id,
      question: chosen.question,
      marks: chosen.marks,
      topic: chosen.topic,
      priority: chosen.priority,
    };
  }

  function next() {
    return pick({ unique: false });
  }

  function session(limit = 10) {
    if (!Number.isInteger(limit) || limit < 1) throw new RangeError('limit must be a positive integer');
    const items = [];
    while (items.length < limit) {
      const item = pick({ unique: true });
      if (!item) break;
      items.push(item);
    }
    return items;
  }

  function answer(id, quality) {
    if (!Number.isInteger(quality) || quality < 0 || quality > 5) throw new RangeError('quality must be 0..5');
    const question = byId.get(id);
    if (!question) throw new Error(`unknown question: ${id}`);
    const stat = stats.get(id);
    const observed = quality / 5;
    stat.mastery = clamp01((stat.mastery * stat.attempts + observed) / (stat.attempts + 1));
    stat.attempts += 1;
    stat.lastQuality = quality;
    stat.history.push({ quality, at: now() });
    return { id, mastery: stat.mastery, attempts: stat.attempts };
  }

  function summary() {
    const totalMarks = questions.reduce((n, q) => n + q.marks, 0);
    const predictedScore = Math.round(questions.reduce((n, q) => n + q.marks * stats.get(q.id).mastery, 0));
    const topics = new Map();
    for (const q of questions) {
      const stat = stats.get(q.id);
      const entry = topics.get(q.topic) ?? { topic: q.topic, total: 0, sum: 0 };
      entry.total += 1;
      entry.sum += stat.lastQuality ?? stat.mastery * 5;
      topics.set(q.topic, entry);
    }
    const weakTopics = [...topics.values()]
      .map((t) => ({ topic: t.topic, average: Number((t.sum / t.total).toFixed(2)), count: t.total }))
      .sort((a, b) => a.average - b.average || a.topic.localeCompare(b.topic));
    return {
      predictedScore,
      totalMarks,
      seen: presented.size,
      mastered: questions.filter((q) => stats.get(q.id).mastery >= 0.8).length,
      weakTopics,
    };
  }

  function exportState() {
    return {
      schemaVersion: 1,
      seed,
      startedAt,
      presented: [...presented],
      stats: [...stats.entries()].map(([id, stat]) => ({ id, ...stat, history: stat.history.map((h) => ({ ...h })) })),
    };
  }

  function importState(state) {
    if (!state || state.schemaVersion !== 1 || !Array.isArray(state.stats)) throw new TypeError('unsupported state');
    presented.clear();
    for (const id of state.presented ?? []) presented.add(id);
    for (const row of state.stats) {
      if (!stats.has(row.id)) continue;
      const stat = stats.get(row.id);
      stat.attempts = row.attempts;
      stat.mastery = row.mastery;
      stat.lastQuality = row.lastQuality;
      stat.history = row.history.map((h) => ({ ...h }));
    }
  }

  return { next, session, answer, summary, exportState, importState };
}
