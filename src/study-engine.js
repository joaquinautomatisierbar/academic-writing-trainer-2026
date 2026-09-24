function seededRandom(seed) {
  let state = Number(seed) || 1;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(items, seed) {
  const result = [...items];
  const random = seededRandom(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function createSession({
  questions,
  mode = 'all',
  section = 'ALL',
  count,
  seed = Date.now(),
  wrongIds = [],
}) {
  let eligible = section === 'ALL'
    ? [...questions]
    : questions.filter((question) => question.section === section);

  if (mode === 'wrong') {
    const allowed = new Set(wrongIds);
    eligible = eligible.filter((question) => allowed.has(question.id));
  }

  if (['shuffle', 'wrong', 'exam'].includes(mode)) {
    eligible = shuffled(eligible, seed);
  }

  if (mode === 'exam') {
    const requested = Number.isFinite(Number(count)) ? Math.max(1, Math.floor(Number(count))) : eligible.length;
    eligible = eligible.slice(0, Math.min(requested, eligible.length));
  }

  return {
    id: `session-${seed}`,
    mode,
    section,
    seed,
    questionIds: eligible.map((question) => question.id),
    currentIndex: 0,
    answers: {},
    status: eligible.length ? 'active' : 'empty',
  };
}

export function evaluateAnswer(question, selectedIndex) {
  return {
    questionId: question.id,
    selectedIndex,
    correctIndex: question.correctIndex,
    correct: selectedIndex === question.correctIndex,
  };
}

export function scoreSession(session, questions) {
  const lookup = new Map(questions.map((question) => [question.id, question]));
  const bySection = {};
  const missedIds = [];
  let correct = 0;
  let answered = 0;

  for (const id of session.questionIds) {
    const question = lookup.get(id);
    if (!question) continue;
    bySection[question.section] ??= { total: 0, correct: 0 };
    bySection[question.section].total += 1;
    if (!Object.hasOwn(session.answers, id)) continue;
    answered += 1;
    if (session.answers[id] === question.correctIndex) {
      correct += 1;
      bySection[question.section].correct += 1;
    } else {
      missedIds.push(id);
    }
  }

  return {
    total: session.questionIds.length,
    answered,
    correct,
    percent: answered ? Math.round((correct / answered) * 100) : 0,
    missedIds,
    bySection,
  };
}
