import { QUESTIONS } from './questions.js';
import { isExpired } from './expiry.js';
import { createEmptyProgress, loadProgress, recordAttempt, resetProgress, saveProgress } from './progress-store.js';
import { createSession, evaluateAnswer, scoreSession } from './study-engine.js';

const SECTION_ORDER = ['ALL', 'A', 'B', 'C', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6'];
const SECTION_LABELS = { ALL: 'Alle', A: 'A', B: 'B', C: 'C', D1: 'D1', D2: 'D2', D3: 'D3', D4: 'D4', D5: 'D5', D6: 'D6' };

export function deriveHomeView(progress, questions) {
  const answered = Object.keys(progress.questions).filter((id) => questions.some((question) => question.id === id)).length;
  const correct = Object.values(progress.questions).filter((entry) => entry.lastCorrect === true).length;
  return {
    primaryLabel: progress.resume ? 'Session fortsetzen' : 'Alle 124 starten',
    answered,
    correct,
    wrongCount: progress.wrongIds.length,
    remaining: Math.max(0, questions.length - answered),
    percent: questions.length ? Math.round((answered / questions.length) * 100) : 0,
  };
}

export function deriveQuestionView(session, progress, questions) {
  if (!session.questionIds.length && session.mode === 'wrong') {
    return { kind: 'empty-wrong', nextAction: 'shuffle' };
  }
  if (!session.questionIds.length) return { kind: 'empty', nextAction: 'home' };
  const questionId = session.questionIds[session.currentIndex];
  const question = questions.find((candidate) => candidate.id === questionId);
  const answered = Object.hasOwn(session.answers, questionId);
  return {
    kind: 'question',
    question,
    position: session.currentIndex + 1,
    total: session.questionIds.length,
    selectedIndex: answered ? session.answers[questionId] : null,
    correctIndex: question.correctIndex,
    showFeedback: answered && (session.mode !== 'exam' || session.status === 'complete'),
    isLast: session.currentIndex === session.questionIds.length - 1,
    progress,
  };
}

export function deriveResultsView(session, questions) {
  return { score: scoreSession(session, questions) };
}

export function resetViewport(scroller) {
  scroller.scrollTo(0, 0);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function appTemplate(content, className = '') {
  return `<div class="shell ${className}">${content}</div>`;
}

function masthead() {
  return `<header class="masthead">
    <div class="brand"><span class="brand-mark">AW</span><span>124 Fragen</span></div>
    <p class="expiry-note">Verfügbar bis<br>25.09. · 20:00</p>
  </header>`;
}

function createController(root) {
  let progress = loadProgress();
  let route = 'home';
  let selectedSection = 'ALL';
  let session = progress.resume;

  function persistSession() {
    progress = { ...progress, resume: session?.status === 'active' ? session : null };
    saveProgress(localStorage, progress);
  }

  function renderHome() {
    const view = deriveHomeView(progress, QUESTIONS);
    const ring = `${Math.round((view.percent / 100) * 360)}deg`;
    root.innerHTML = appTemplate(`${masthead()}
      <section class="hero">
        <div><h1>Was übst du jetzt?</h1><p>124 Originalfragen. Dein Fehlerstapel wird mit jeder Runde kleiner.</p></div>
        <div class="progress-ring" style="--progress:${ring}" aria-label="${view.percent} Prozent abgeschlossen"><div><strong>${view.percent}%</strong><span>${view.answered}/124</span></div></div>
      </section>
      <dl class="stats">
        <div class="stat"><dt>Richtig</dt><dd>${view.correct}</dd></div>
        <div class="stat"><dt>Fehlerstapel</dt><dd>${view.wrongCount}</dd></div>
        <div class="stat"><dt>Offen</dt><dd>${view.remaining}</dd></div>
      </dl>
      <h2 class="section-heading">Lernmodus</h2>
      <div class="mode-list">
        <button class="mode-button" data-action="${progress.resume ? 'resume' : 'start'}" data-mode="all"><span class="mode-icon">01</span><span class="mode-copy"><strong>${view.primaryLabel}</strong><small>In der Reihenfolge des Kurses</small></span><span class="mode-count">124</span></button>
        <button class="mode-button" data-action="start" data-mode="shuffle"><span class="mode-icon">↝</span><span class="mode-copy"><strong>Zufällige Runde</strong><small>Alle Fragen neu gemischt</small></span><span class="mode-count">124</span></button>
        <button class="mode-button" data-action="start" data-mode="wrong"><span class="mode-icon">↺</span><span class="mode-copy"><strong>Nur meine Fehler</strong><small>Richtig beantworten, um sie abzubauen</small></span><span class="mode-count">${view.wrongCount}</span></button>
        <button class="mode-button" data-action="exam-setup"><span class="mode-icon">◎</span><span class="mode-copy"><strong>Prüfung simulieren</strong><small>Keine Hinweise bis zur Auswertung</small></span><span class="mode-count">frei</span></button>
      </div>
      <h2 class="section-heading">Teil auswählen</h2>
      <div class="section-grid" role="group" aria-label="Kursteil auswählen">
        ${SECTION_ORDER.map((section) => `<button class="section-button" data-section="${section}" aria-pressed="${section === selectedSection}">${SECTION_LABELS[section]}</button>`).join('')}
      </div>
      <div class="home-footer"><button class="text-button" data-action="settings">Fortschritt & Hinweise</button></div>`);
  }

  function startSession(mode, count) {
    session = createSession({
      questions: QUESTIONS,
      mode,
      section: selectedSection,
      count,
      wrongIds: progress.wrongIds,
      seed: Date.now(),
    });
    persistSession();
    route = 'question';
    render();
  }

  function renderQuestion() {
    const view = deriveQuestionView(session, progress, QUESTIONS);
    if (view.kind !== 'question') {
      const wrong = view.kind === 'empty-wrong';
      root.innerHTML = appTemplate(`<section class="empty-state">
        <p class="question-meta">${wrong ? 'FEHLERSTAPEL LEER' : 'KEINE FRAGEN'}</p>
        <h1 class="page-title">${wrong ? 'Noch keine Fehler gesammelt.' : 'Hier ist gerade nichts zu üben.'}</h1>
        <p class="lede">${wrong ? 'Starte eine zufällige Runde. Jede falsche Antwort landet automatisch hier.' : 'Wähle auf der Startseite einen anderen Teil.'}</p>
        <div class="button-stack"><button class="primary-button" data-action="${wrong ? 'start' : 'home'}" data-mode="shuffle">${wrong ? 'Zufällige Runde starten' : 'Zur Startseite'}</button></div>
      </section>`);
      return;
    }

    const answered = view.selectedIndex !== null;
    const correct = answered && view.selectedIndex === view.correctIndex;
    const progressWidth = Math.round((view.position / view.total) * 100);
    const letters = ['A', 'B', 'C', 'D'];
    root.innerHTML = appTemplate(`<div class="question-shell">
      <header class="question-topbar">
        <button class="close-button" data-action="home" aria-label="Session verlassen">×</button>
        <div class="question-progress"><div class="question-progress-line"><span style="width:${progressWidth}%"></span></div><p>Frage ${view.position} von ${view.total}</p></div>
      </header>
      <article class="question-card">
        <p class="question-meta">TEIL ${escapeHtml(view.question.section)}</p>
        <h1 class="question-text">${escapeHtml(view.question.prompt)}</h1>
      </article>
      <div class="answers" role="group" aria-label="Antwortmöglichkeiten">
        ${view.question.choices.map((choice, index) => {
          const classes = ['answer-button'];
          if (view.selectedIndex === index) classes.push('selected');
          if (view.showFeedback && index === view.correctIndex) classes.push('correct');
          if (view.showFeedback && view.selectedIndex === index && index !== view.correctIndex) classes.push('incorrect');
          return `<button class="${classes.join(' ')}" data-answer="${index}" ${answered ? 'disabled' : ''}><span class="answer-letter">${letters[index]}</span><span>${escapeHtml(choice)}</span></button>`;
        }).join('')}
        ${view.showFeedback ? `<aside class="feedback ${correct ? '' : 'wrong'}"><strong>${correct ? 'Richtig.' : 'Noch nicht.'}</strong><p>${escapeHtml(view.question.explanation)}</p></aside>` : ''}
      </div>
      <div class="bottom-action"><button class="primary-button" data-action="next" ${answered ? '' : 'disabled'}>${view.isLast ? 'Auswertung ansehen' : 'Nächste Frage'}</button></div>
    </div>`, 'question-page');
  }

  function answerQuestion(index) {
    const questionId = session.questionIds[session.currentIndex];
    if (Object.hasOwn(session.answers, questionId)) return;
    const question = QUESTIONS.find((candidate) => candidate.id === questionId);
    const result = evaluateAnswer(question, index);
    session = { ...session, answers: { ...session.answers, [questionId]: index } };
    if (session.mode !== 'exam') {
      progress = recordAttempt(progress, {
        ...result,
        attemptId: `${session.id}:${questionId}`,
      });
    }
    persistSession();
    renderQuestion();
  }

  function nextQuestion() {
    const currentId = session.questionIds[session.currentIndex];
    if (!Object.hasOwn(session.answers, currentId)) return;
    if (session.currentIndex < session.questionIds.length - 1) {
      session = { ...session, currentIndex: session.currentIndex + 1 };
      persistSession();
      renderQuestion();
      requestAnimationFrame(() => resetViewport(window));
      return;
    }
    session = { ...session, status: 'complete' };
    if (session.mode === 'exam') {
      for (const questionId of session.questionIds) {
        const question = QUESTIONS.find((candidate) => candidate.id === questionId);
        const result = evaluateAnswer(question, session.answers[questionId]);
        progress = recordAttempt(progress, { ...result, attemptId: `${session.id}:${questionId}` });
      }
    }
    progress = { ...progress, resume: null };
    saveProgress(localStorage, progress);
    route = 'results';
    render();
  }

  function renderExamSetup() {
    root.innerHTML = appTemplate(`<section class="setup">
      <button class="close-button" data-action="home" aria-label="Zurück">×</button>
      <p class="question-meta">PRÜFUNGSMODUS</p>
      <h1 class="page-title">Wie viele Fragen?</h1>
      <p class="lede">Keine Rückmeldung während der Runde. Danach siehst du Score, Teilbereiche und jeden Fehler.</p>
      <div class="field"><label for="exam-count">Fragenzahl (1–124)</label><input id="exam-count" type="number" inputmode="numeric" min="1" max="124" value="20"></div>
      <button class="primary-button" data-action="start-exam">Prüfung starten</button>
    </section>`);
  }

  function renderResults() {
    const { score } = deriveResultsView(session, QUESTIONS);
    const missed = score.missedIds.map((id) => QUESTIONS.find((question) => question.id === id));
    root.innerHTML = appTemplate(`<section class="results">
      <p class="question-meta">AUSWERTUNG</p>
      <h1 class="page-title">${score.percent >= 80 ? 'Stark. Weiter festigen.' : 'Dein nächster Fokus ist klar.'}</h1>
      <div class="result-score"><strong>${score.percent}%</strong><span>${score.correct} von ${score.total} richtig</span></div>
      <h2 class="section-heading">Nach Teil</h2>
      <table class="breakdown"><thead><tr><th>Teil</th><th>Richtig</th></tr></thead><tbody>${Object.entries(score.bySection).map(([section, value]) => `<tr><td>${section}</td><td>${value.correct}/${value.total}</td></tr>`).join('')}</tbody></table>
      <h2 class="section-heading">Fehler ansehen</h2>
      ${missed.length ? `<div class="review-list">${missed.map((question) => `<article class="review-item"><strong>${question.section}</strong><p>${escapeHtml(question.prompt)}</p><p><b>Lösung:</b> ${escapeHtml(question.choices[question.correctIndex])}</p></article>`).join('')}</div>` : '<p class="lede">Keine Fehler in dieser Runde.</p>'}
      <div class="button-stack"><button class="primary-button" data-action="start" data-mode="wrong">Fehler wiederholen</button><button class="secondary-button" data-action="home">Zur Übersicht</button></div>
    </section>`);
  }

  function renderSettings() {
    root.innerHTML = appTemplate(`<section class="settings">
      <button class="close-button" data-action="home" aria-label="Zurück">×</button>
      <p class="question-meta">FORTSCHRITT & HINWEISE</p>
      <h1 class="page-title">Alles bleibt auf diesem Gerät.</h1>
      <p class="lede">Antworten und Lernstand werden ausschließlich lokal in diesem Browser gespeichert.</p>
      <div class="notice"><strong>Lösungsschlüssel:</strong> Brian ging vor der vollständigen Lösungsverifikation offline. Die Antworten wurden danach fachlich anhand der Originalfragen geprüft und sind nicht als Brian-Originalschlüssel gekennzeichnet.</div>
      <button class="secondary-button" data-action="reset">Fortschritt zurücksetzen</button>
    </section>`);
  }

  function render() {
    if (route === 'question') renderQuestion();
    else if (route === 'exam-setup') renderExamSetup();
    else if (route === 'results') renderResults();
    else if (route === 'settings') renderSettings();
    else renderHome();
    requestAnimationFrame(() => resetViewport(window));
  }

  root.addEventListener('click', (event) => {
    const answer = event.target.closest('[data-answer]');
    if (answer) return answerQuestion(Number(answer.dataset.answer));
    const section = event.target.closest('[data-section]');
    if (section) {
      selectedSection = section.dataset.section;
      renderHome();
      return;
    }
    const action = event.target.closest('[data-action]');
    if (!action) return;
    action.blur();
    if (action.dataset.action === 'start') startSession(action.dataset.mode);
    if (action.dataset.action === 'resume') { session = progress.resume; route = 'question'; render(); }
    if (action.dataset.action === 'next') nextQuestion();
    if (action.dataset.action === 'exam-setup') { route = 'exam-setup'; render(); }
    if (action.dataset.action === 'start-exam') startSession('exam', Number(root.querySelector('#exam-count').value));
    if (action.dataset.action === 'settings') { route = 'settings'; render(); }
    if (action.dataset.action === 'home') { route = 'home'; render(); }
    if (action.dataset.action === 'reset' && window.confirm('Fortschritt wirklich zurücksetzen?')) {
      resetProgress();
      progress = createEmptyProgress();
      session = null;
      route = 'home';
      render();
    }
  });

  render();
}

if (typeof document !== 'undefined') {
  const root = document.querySelector('#app');
  if (root && isExpired()) {
    root.innerHTML = appTemplate(`<section class="empty-state"><p class="question-meta">SESSION BEENDET</p><h1 class="page-title">Der Trainer ist nicht mehr verfügbar.</h1><p class="lede">Der vereinbarte Zugriff endete am 25. September 2026 um 20:00 Uhr.</p></section>`);
  } else if (root) {
    createController(root);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
  }
}
