const STORAGE_KEY = 'aw-trainer-progress';

export function createEmptyProgress() {
  return {
    version: 1,
    questions: {},
    wrongIds: [],
    recordedAttemptIds: [],
    resume: null,
  };
}

function validProgress(value) {
  const resumeIsValid = value?.resume === null || (
    value?.resume
    && ['all', 'shuffle', 'wrong', 'exam'].includes(value.resume.mode)
    && Array.isArray(value.resume.questionIds)
    && value.resume.questionIds.length > 0
    && Number.isInteger(value.resume.currentIndex)
    && value.resume.currentIndex >= 0
    && value.resume.currentIndex < value.resume.questionIds.length
    && value.resume.answers
    && typeof value.resume.answers === 'object'
    && value.resume.status === 'active'
  );
  return value
    && value.version === 1
    && value.questions
    && Array.isArray(value.wrongIds)
    && Array.isArray(value.recordedAttemptIds)
    && resumeIsValid;
}

export function loadProgress(storage = localStorage) {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY));
    return validProgress(parsed) ? parsed : createEmptyProgress();
  } catch {
    return createEmptyProgress();
  }
}

export function saveProgress(storage = localStorage, progress) {
  storage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function recordAttempt(progress, result) {
  if (progress.recordedAttemptIds.includes(result.attemptId)) return progress;
  const previous = progress.questions[result.questionId] ?? {
    attempts: 0,
    correct: 0,
    incorrect: 0,
    lastSelected: null,
    lastCorrect: null,
  };
  const questionProgress = {
    attempts: previous.attempts + 1,
    correct: previous.correct + (result.correct ? 1 : 0),
    incorrect: previous.incorrect + (result.correct ? 0 : 1),
    lastSelected: result.selectedIndex,
    lastCorrect: result.correct,
  };
  const wrong = new Set(progress.wrongIds);
  if (result.correct) wrong.delete(result.questionId);
  else wrong.add(result.questionId);

  return {
    ...progress,
    questions: { ...progress.questions, [result.questionId]: questionProgress },
    wrongIds: [...wrong],
    recordedAttemptIds: [...progress.recordedAttemptIds, result.attemptId],
  };
}

export function resetProgress(storage = localStorage) {
  storage.removeItem(STORAGE_KEY);
}
