"use strict";

/* ==========================================================================
   Topics, subtopics & difficulty levels
   Each "shape" is a list of digit counts, mirroring the printed worksheets:
   e.g. [3, 2] means a 3-digit number (+/-) a 2-digit number.
   Levels follow the worksheet progression; every subtopic also gets an
   automatic "Mixed" level that draws from all of its shapes.
   For subtraction, generated questions always satisfy:
       first - (sum of the rest) >= 0
   ========================================================================== */

const QUESTIONS_PER_ROUND = 10;

function makeSubtopics(topicName, symbol) {
  const j = (parts) => parts.join(` ${symbol} `);
  return {
    written: {
      name: `Written ${topicName}`,
      desc: "Column method — use the working-out pad",
      written: true,
      levels: [
        { id: "l1", name: j(["2-digit", "2-digit"]), shapes: [[2, 2]] },
        { id: "l2", name: j(["3/4-digit", "2-digit"]), shapes: [[3, 2], [4, 2]] },
        { id: "l3", name: j(["3/4-digit", "3-digit"]), shapes: [[3, 3], [4, 3]] },
        { id: "l4", name: j(["4/5-digit", "3/4-digit"]), shapes: [[5, 3], [4, 4], [5, 4]] },
      ],
    },
    mental: {
      name: `Mental ${topicName}`,
      desc: "Two numbers, all in your head",
      levels: [
        { id: "l1", name: j(["2-digit", "2-digit"]), shapes: [[2, 2]] },
        { id: "l2", name: j(["3-digit", "2-digit"]), shapes: [[3, 2]] },
        { id: "l3", name: j(["4-digit", "2-digit"]), shapes: [[4, 2]] },
        { id: "l4", name: j(["3-digit", "3-digit"]), shapes: [[3, 3]] },
        { id: "l5", name: j(["4-digit", "3-digit"]), shapes: [[4, 3]] },
      ],
    },
    mental3: {
      name: `Mental ${topicName}: 3+ Numbers`,
      desc: "Three or four numbers, all in your head",
      levels: [
        { id: "l1", name: "Three 2-digit numbers", shapes: [[2, 2, 2]] },
        { id: "l2", name: "Four 2-digit numbers", shapes: [[2, 2, 2, 2]] },
        { id: "l3", name: "One 3-digit, two 2-digit", shapes: [[3, 2, 2]] },
      ],
    },
  };
}

const TOPICS = {
  addition: {
    name: "Addition",
    symbol: "+",
    icon: "+",
    color: "linear-gradient(135deg, #34d399, #059669)",
    subtopics: makeSubtopics("Addition", "+"),
  },
  subtraction: {
    name: "Subtraction",
    symbol: "−",
    icon: "−",
    color: "linear-gradient(135deg, #60a5fa, #4f46e5)",
    subtopics: makeSubtopics("Subtraction", "−"),
  },
};

/* Every subtopic gets a synthetic "Mixed" level drawing from all shapes. */
function levelsOf(sub) {
  const allShapes = sub.levels.flatMap((l) => l.shapes);
  return [
    ...sub.levels,
    { id: "mixed", name: "Mixed — All Difficulties", shapes: allShapes, mixed: true },
  ];
}

function getLevel(sub, levelId) {
  return levelsOf(sub).find((l) => l.id === levelId);
}

/* ==========================================================================
   Question generation
   ========================================================================== */

function randInt(lo, hi) {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function randomWithDigits(d) {
  if (d === 1) return randInt(1, 9);
  return randInt(10 ** (d - 1), 10 ** d - 1);
}

function generateQuestion(topicId, shape) {
  for (let attempt = 0; attempt < 10000; attempt++) {
    const numbers = shape.map(randomWithDigits);
    if (topicId === "addition") {
      return { numbers, answer: numbers.reduce((a, b) => a + b, 0) };
    }
    const rest = numbers.slice(1).reduce((a, b) => a + b, 0);
    if (numbers[0] >= rest) {
      return { numbers, answer: numbers[0] - rest };
    }
  }
  // Unreachable for the shapes we use, but keep a safe fallback.
  return { numbers: [99, 11], answer: 88 };
}

function buildRound(topicId, shapes) {
  const questions = [];
  for (let i = 0; i < QUESTIONS_PER_ROUND; i++) {
    const shape = shapes[randInt(0, shapes.length - 1)];
    questions.push(generateQuestion(topicId, shape));
  }
  return questions;
}

/* Par time (seconds) used for the speed bonus: more digits = more time. */
function parSeconds(question, written) {
  const totalDigits = question.numbers.reduce((a, n) => a + String(n).length, 0);
  return (written ? 10 : 5) + 4 * totalDigits;
}

/* ==========================================================================
   Persistent stats (localStorage)
   Keys are "topic.subtopic.level", e.g. "addition.mental.l2".
   ========================================================================== */

const STORAGE_KEY = "y6maths-stats-v1";

function loadStats() {
  let stats;
  try {
    stats = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    stats = {};
  }
  // Migrate pre-difficulty stats ("addition.written") to the Mixed level,
  // since old rounds drew from all shapes.
  let changed = false;
  for (const key of Object.keys(stats)) {
    if (key.split(".").length === 2) {
      stats[`${key}.mixed`] = stats[key];
      delete stats[key];
      changed = true;
    }
  }
  if (changed) saveStats(stats);
  return stats;
}

function saveStats(stats) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

function statsFor(stats, topicId, subId, levelId) {
  const key = `${topicId}.${subId}.${levelId}`;
  if (!stats[key]) {
    stats[key] = {
      bestScore: 0,
      bestStreak: 0,
      bestTimeMs: null, // fastest perfect (10/10) round
      plays: 0,
      totalCorrect: 0,
      totalAnswered: 0,
    };
  }
  return stats[key];
}

function formatMs(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function statChips(s) {
  const chips = [];
  if (s.bestScore > 0) chips.push(`\u{1F3C6} Best: ${s.bestScore}`);
  if (s.bestStreak > 0) chips.push(`\u{1F525} Streak: ${s.bestStreak}`);
  if (s.bestTimeMs != null) chips.push(`⏱️ ${formatMs(s.bestTimeMs)}`);
  return chips;
}

/* ==========================================================================
   DOM helpers & screens
   ========================================================================== */

const $ = (id) => document.getElementById(id);

const screens = {
  home: $("screen-home"),
  subtopic: $("screen-subtopic"),
  level: $("screen-level"),
  quiz: $("screen-quiz"),
  results: $("screen-results"),
};

function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
}

/* ==========================================================================
   App state
   ========================================================================== */

const state = {
  topicId: null,
  subId: null,
  levelId: null,
  questions: [],
  index: 0,
  typed: "",
  correctCount: 0,
  score: 0,
  streak: 0,
  bestStreakThisRound: 0,
  roundStartTime: 0,
  questionStartTime: 0,
  timerInterval: null,
  locked: false, // true while showing feedback between questions
};

/* ==========================================================================
   Home, subtopic & level screens
   ========================================================================== */

function renderHome() {
  const list = $("topic-list");
  list.innerHTML = "";
  for (const [topicId, topic] of Object.entries(TOPICS)) {
    const card = document.createElement("button");
    card.className = "topic-card";
    card.innerHTML = `
      <div class="topic-icon" style="background:${topic.color}">${topic.icon}</div>
      <div>
        <div class="card-title">${topic.name}</div>
        <div class="card-sub">${Object.keys(topic.subtopics).length} practice modes</div>
      </div>`;
    card.addEventListener("click", () => openTopic(topicId));
    list.appendChild(card);
  }

  const stats = loadStats();
  let totalCorrect = 0;
  for (const s of Object.values(stats)) totalCorrect += s.totalCorrect || 0;
  $("total-stars").textContent =
    totalCorrect > 0 ? `⭐ ${totalCorrect} questions answered correctly!` : "";
}

function openTopic(topicId) {
  state.topicId = topicId;
  const topic = TOPICS[topicId];
  $("subtopic-title").textContent = topic.name;

  const list = $("subtopic-list");
  list.innerHTML = "";
  const stats = loadStats();

  for (const [subId, sub] of Object.entries(topic.subtopics)) {
    // Aggregate records across this subtopic's levels for the card chips.
    const agg = { bestScore: 0, bestStreak: 0, bestTimeMs: null };
    for (const level of levelsOf(sub)) {
      const s = stats[`${topicId}.${subId}.${level.id}`];
      if (!s) continue;
      agg.bestScore = Math.max(agg.bestScore, s.bestScore);
      agg.bestStreak = Math.max(agg.bestStreak, s.bestStreak);
    }
    const chips = statChips(agg);
    if (chips.length === 0) chips.push("New!");

    const card = document.createElement("button");
    card.className = "subtopic-card";
    card.innerHTML = `
      <div>
        <div class="card-title">${sub.name}</div>
        <div class="card-sub">${sub.desc} · ${levelsOf(sub).length} difficulty levels</div>
      </div>
      <div class="mini-stats">${chips.map((c) => `<span class="mini-stat">${c}</span>`).join("")}</div>`;
    card.addEventListener("click", () => openLevels(topicId, subId));
    list.appendChild(card);
  }

  showScreen("subtopic");
}

function openLevels(topicId, subId) {
  state.topicId = topicId;
  state.subId = subId;
  const sub = TOPICS[topicId].subtopics[subId];
  $("level-title").textContent = sub.name;

  const list = $("level-list");
  list.innerHTML = "";
  const stats = loadStats();

  levelsOf(sub).forEach((level, i) => {
    const s = statsFor(stats, topicId, subId, level.id);
    const chips = statChips(s);
    if (chips.length === 0) chips.push("New!");

    const label = level.mixed ? level.name : `Level ${i + 1}: ${level.name}`;
    const card = document.createElement("button");
    card.className = "subtopic-card";
    card.innerHTML = `
      <div>
        <div class="card-title">${level.mixed ? "\u{1F3B2} " : ""}${label}</div>
      </div>
      <div class="mini-stats">${chips.map((c) => `<span class="mini-stat">${c}</span>`).join("")}</div>`;
    card.addEventListener("click", () => startRound(topicId, subId, level.id));
    list.appendChild(card);
  });

  showScreen("level");
}

/* ==========================================================================
   Quiz flow
   ========================================================================== */

function startRound(topicId, subId, levelId) {
  const sub = TOPICS[topicId].subtopics[subId];
  const level = getLevel(sub, levelId);
  state.topicId = topicId;
  state.subId = subId;
  state.levelId = levelId;
  state.questions = buildRound(topicId, level.shapes);
  state.index = 0;
  state.correctCount = 0;
  state.score = 0;
  state.streak = 0;
  state.bestStreakThisRound = 0;
  state.roundStartTime = Date.now();
  state.locked = false;

  $("scratch-wrap").classList.toggle("active", !!sub.written);

  clearInterval(state.timerInterval);
  state.timerInterval = setInterval(() => {
    $("quiz-timer").textContent = formatMs(Date.now() - state.roundStartTime);
  }, 250);
  $("quiz-timer").textContent = "0:00";

  showScreen("quiz");
  showQuestion();
  if (sub.written) resizeScratchpad();
}

function currentSub() {
  return TOPICS[state.topicId].subtopics[state.subId];
}

function showQuestion() {
  const sub = currentSub();
  const q = state.questions[state.index];
  state.typed = "";
  state.locked = false;
  state.questionStartTime = Date.now();

  $("quiz-progress").textContent = `${state.index + 1}/${QUESTIONS_PER_ROUND}`;
  $("quiz-streak").textContent = `\u{1F525} ${state.streak}`;
  $("feedback").textContent = "";
  $("feedback").className = "feedback";

  const symbol = TOPICS[state.topicId].symbol;

  if (sub.written) {
    $("question-inline").classList.remove("active");
    $("question-vertical").classList.add("active");
    $("answer-box").classList.add("hidden");

    const rows = $("v-rows");
    rows.innerHTML = "";
    q.numbers.forEach((n, i) => {
      const div = document.createElement("div");
      div.textContent = i === 0 ? String(n) : `${symbol} ${n}`;
      rows.appendChild(div);
    });
    $("v-answer").innerHTML = "&nbsp;";
    clearScratchpad();
  } else {
    $("question-vertical").classList.remove("active");
    $("question-inline").classList.add("active");
    $("answer-box").classList.remove("hidden");
    $("question-inline").textContent = q.numbers.join(` ${symbol} `) + " =";
    $("answer-box").innerHTML = "&nbsp;";
  }
}

function updateTypedDisplay() {
  const sub = currentSub();
  const text = state.typed === "" ? " " : state.typed;
  if (sub.written) {
    $("v-answer").textContent = text;
  } else {
    $("answer-box").textContent = text;
  }
}

function pressKey(key) {
  if (state.locked) return;

  if (key === "del") {
    state.typed = state.typed.slice(0, -1);
    updateTypedDisplay();
  } else if (key === "go") {
    submitAnswer();
  } else if (/^\d$/.test(key)) {
    if (state.typed.length < 7) {
      state.typed += key;
      updateTypedDisplay();
    }
  }
}

function submitAnswer() {
  if (state.typed === "" || state.locked) return;
  state.locked = true;

  const q = state.questions[state.index];
  const sub = currentSub();
  const given = parseInt(state.typed, 10);
  const elapsed = (Date.now() - state.questionStartTime) / 1000;
  const correct = given === q.answer;

  const feedback = $("feedback");

  if (correct) {
    state.correctCount++;
    state.streak++;
    state.bestStreakThisRound = Math.max(state.bestStreakThisRound, state.streak);

    const par = parSeconds(q, sub.written);
    const speedBonus = Math.round(100 * Math.max(0, 1 - elapsed / par));
    const streakBonus = Math.min(50, 10 * (state.streak - 1));
    const points = 100 + speedBonus + streakBonus;
    state.score += points;

    feedback.textContent = `✅ Correct! +${points}`;
    feedback.className = "feedback good";
    document.body.classList.remove("flash-good", "flash-bad");
    void document.body.offsetWidth;
    document.body.classList.add("flash-good");
    setTimeout(nextQuestion, 700);
  } else {
    state.streak = 0;
    feedback.textContent = `❌ Not quite — the answer was ${q.answer}`;
    feedback.className = "feedback bad";
    document.body.classList.remove("flash-good", "flash-bad");
    void document.body.offsetWidth;
    document.body.classList.add("flash-bad");
    setTimeout(nextQuestion, 1800);
  }

  $("quiz-streak").textContent = `\u{1F525} ${state.streak}`;
}

function nextQuestion() {
  state.index++;
  if (state.index >= QUESTIONS_PER_ROUND) {
    finishRound();
  } else {
    showQuestion();
  }
}

function finishRound() {
  clearInterval(state.timerInterval);
  const elapsedMs = Date.now() - state.roundStartTime;
  const perfect = state.correctCount === QUESTIONS_PER_ROUND;

  // Update persistent stats
  const stats = loadStats();
  const s = statsFor(stats, state.topicId, state.subId, state.levelId);
  const records = [];

  if (state.score > s.bestScore) {
    if (s.bestScore > 0) records.push(`\u{1F3C6} New High Score: ${state.score}!`);
    s.bestScore = Math.max(s.bestScore, state.score);
  }
  if (state.bestStreakThisRound > s.bestStreak) {
    if (s.bestStreak > 0) records.push(`\u{1F525} New Best Streak: ${state.bestStreakThisRound}!`);
    s.bestStreak = state.bestStreakThisRound;
  }
  if (perfect && (s.bestTimeMs == null || elapsedMs < s.bestTimeMs)) {
    if (s.bestTimeMs != null) records.push(`⏱️ New Best Time: ${formatMs(elapsedMs)}!`);
    s.bestTimeMs = elapsedMs;
  }
  s.plays++;
  s.totalCorrect += state.correctCount;
  s.totalAnswered += QUESTIONS_PER_ROUND;
  saveStats(stats);

  // Render results
  $("res-score").textContent = state.score;
  $("res-correct").textContent = `${state.correctCount}/${QUESTIONS_PER_ROUND}`;
  $("res-time").textContent = formatMs(elapsedMs);
  $("res-streak").textContent = state.bestStreakThisRound;

  const emoji = perfect
    ? "\u{1F3C6}"
    : state.correctCount >= 8
    ? "\u{1F31F}"
    : state.correctCount >= 5
    ? "\u{1F44D}"
    : "\u{1F4AA}";
  $("results-emoji").textContent = emoji;
  $("results-heading").textContent = perfect
    ? "Perfect Round!"
    : state.correctCount >= 8
    ? "Great Job!"
    : state.correctCount >= 5
    ? "Well Done!"
    : "Keep Practising!";

  $("records").innerHTML = records
    .map((r) => `<div class="record-banner">${r}</div>`)
    .join("");

  showScreen("results");
}

function quitRound() {
  clearInterval(state.timerInterval);
  openLevels(state.topicId, state.subId);
}

/* ==========================================================================
   Scratchpad (working out for written questions)
   ========================================================================== */

const canvas = $("scratchpad");
const ctx = canvas.getContext("2d");
let drawing = false;

function resizeScratchpad() {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.scale(dpr, dpr);
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#1e2145";
}

function clearScratchpad() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

canvas.addEventListener("pointerdown", (e) => {
  drawing = true;
  canvas.setPointerCapture(e.pointerId);
  const p = canvasPos(e);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  e.preventDefault();
});

canvas.addEventListener("pointermove", (e) => {
  if (!drawing) return;
  const p = canvasPos(e);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
  e.preventDefault();
});

canvas.addEventListener("pointerup", () => (drawing = false));
canvas.addEventListener("pointercancel", () => (drawing = false));

window.addEventListener("resize", () => {
  if (screens.quiz.classList.contains("active") && currentSub()?.written) {
    resizeScratchpad();
  }
});

/* ==========================================================================
   Wiring
   ========================================================================== */

$("btn-back-home").addEventListener("click", () => {
  renderHome();
  showScreen("home");
});

$("btn-back-subtopic").addEventListener("click", () => {
  openTopic(state.topicId);
});

$("btn-quit").addEventListener("click", quitRound);
$("btn-clear-scratch").addEventListener("click", clearScratchpad);

$("numpad").addEventListener("click", (e) => {
  const key = e.target.closest(".key")?.dataset.key;
  if (key) pressKey(key);
});

// Physical keyboard support (handy when testing on a computer)
window.addEventListener("keydown", (e) => {
  if (!screens.quiz.classList.contains("active")) return;
  if (/^[0-9]$/.test(e.key)) pressKey(e.key);
  else if (e.key === "Backspace") pressKey("del");
  else if (e.key === "Enter") pressKey("go");
});

$("btn-play-again").addEventListener("click", () =>
  startRound(state.topicId, state.subId, state.levelId)
);

$("btn-results-home").addEventListener("click", () => {
  openLevels(state.topicId, state.subId);
});

// Register the service worker so the app works offline once installed.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

renderHome();
