"use strict";

/* UI and game flow. Question generation lives in questions.js (TOPICS,
   levelsOf, getLevel). */

const QUESTIONS_PER_ROUND = 10;

function buildRound(level) {
  return Array.from({ length: QUESTIONS_PER_ROUND }, () => level.gen());
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
  slotVals: {},
  activeSlot: "main",
  correctCount: 0,
  score: 0,
  streak: 0,
  bestStreakThisRound: 0,
  roundStartTime: 0,
  questionStartTime: 0,
  timerInterval: null,
  locked: false, // true while showing feedback between questions
};

function currentSub() {
  return TOPICS[state.topicId].subtopics[state.subId];
}

function currentQuestion() {
  return state.questions[state.index];
}

function inputType(q) {
  if (q.input) return q.input;
  if (q.remainder !== undefined) return "remainder";
  if (q.decimals) return "decimal";
  return "int";
}

const SLOTS = {
  int: ["main"],
  decimal: ["main"],
  remainder: ["main", "rem"],
  pair: ["main", "rem"], // two labeled values, e.g. (x, y) or h : min
  fraction: ["num", "den"],
  mixed: ["whole", "num", "den"],
  mcq: [],
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
    const iconClass = topic.iconSmall ? "topic-icon topic-icon-small" : "topic-icon";
    card.innerHTML = `
      <div class="${iconClass}" style="background:${topic.color}">${topic.icon}</div>
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

    const levelCount = levelsOf(sub).length;
    const levelNote = levelCount > 1 ? ` · ${levelCount} difficulty levels` : "";
    const card = document.createElement("button");
    card.className = "subtopic-card";
    card.innerHTML = `
      <div>
        <div class="card-title">${sub.name}</div>
        <div class="card-sub">${sub.desc}${levelNote}</div>
      </div>
      <div class="mini-stats">${chips.map((c) => `<span class="mini-stat">${c}</span>`).join("")}</div>`;
    card.addEventListener("click", () => {
      if (levelCount === 1) {
        startRound(topicId, subId, sub.levels[0].id);
      } else {
        openLevels(topicId, subId);
      }
    });
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
  state.questions = buildRound(level);
  state.index = 0;
  state.correctCount = 0;
  state.score = 0;
  state.streak = 0;
  state.bestStreakThisRound = 0;
  state.roundStartTime = Date.now();
  state.locked = false;

  clearInterval(state.timerInterval);
  state.timerInterval = setInterval(() => {
    $("quiz-timer").textContent = formatMs(Date.now() - state.roundStartTime);
  }, 250);
  $("quiz-timer").textContent = "0:00";

  showScreen("quiz");
  showQuestion();
}

function showQuestion() {
  const q = currentQuestion();
  const type = inputType(q);
  state.slotVals = {};
  for (const s of SLOTS[type]) state.slotVals[s] = "";
  state.activeSlot = SLOTS[type][0] || null;
  state.locked = false;
  state.questionStartTime = Date.now();

  $("quiz-progress").textContent = `${state.index + 1}/${QUESTIONS_PER_ROUND}`;
  $("quiz-streak").textContent = `\u{1F525} ${state.streak}`;
  $("feedback").textContent = "";
  $("feedback").className = "feedback";

  // question display areas
  const svgBox = $("question-svg");
  svgBox.innerHTML = q.svg || "";
  svgBox.classList.toggle("active", !!q.svg);

  const inlineEl = $("question-inline");
  const verticalEl = $("question-vertical");
  const longdivEl = $("question-longdiv");
  inlineEl.classList.remove("active");
  verticalEl.classList.remove("active");
  longdivEl.classList.remove("active");

  if (q.kind === "written") {
    verticalEl.classList.add("active");
    const rows = $("v-rows");
    rows.innerHTML = "";
    q.numbers.forEach((n, i) => {
      const div = document.createElement("div");
      div.textContent = i === 0 ? String(n) : `${q.symbol} ${n}`;
      rows.appendChild(div);
    });
  } else if (q.kind === "longdiv") {
    longdivEl.classList.add("active");
    $("ld-divisor").textContent = q.divisor;
    $("ld-dividend").textContent = q.dividend;
  } else {
    inlineEl.classList.add("active");
    inlineEl.classList.toggle("q-word", !!q.wordy);
    if (q.textHtml) inlineEl.innerHTML = q.textHtml;
    else inlineEl.textContent = q.text || "";
  }

  // answer areas
  const isWritten = q.kind === "written";
  $("answer-row").classList.toggle("hidden", isWritten || type === "mcq" || type === "fraction" || type === "mixed");
  $("answer-frac").classList.toggle("active", type === "fraction" || type === "mixed");
  $("frac-whole").classList.toggle("hidden", type !== "mixed");
  $("answer-box-r").classList.toggle("active", type === "remainder" || type === "pair");

  // numpad vs multiple choice
  $("numpad").classList.toggle("hidden", type === "mcq");
  $("key-dot").classList.toggle("disabled", type !== "decimal");
  const mcqGrid = $("mcq-grid");
  mcqGrid.classList.toggle("active", type === "mcq");
  mcqGrid.innerHTML = "";
  if (type === "mcq") {
    q.options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.className = "mcq-btn";
      btn.innerHTML = opt.html;
      btn.addEventListener("click", () => submitMcq(i, btn));
      mcqGrid.appendChild(btn);
    });
  }

  // scratchpad
  const scratch = !!currentSub().scratch;
  $("scratch-wrap").classList.toggle("active", scratch);
  if (scratch) {
    resizeScratchpad();
    clearScratchpad();
  }

  updateTypedDisplay();
}

function slotBoxes() {
  return {
    main: $("answer-box"),
    rem: $("answer-box-r"),
    whole: $("frac-whole"),
    num: $("frac-num"),
    den: $("frac-den"),
  };
}

function updateTypedDisplay() {
  const q = currentQuestion();
  const type = inputType(q);
  if (type === "mcq") return;

  if (q.kind === "written") {
    $("v-answer").textContent = state.slotVals.main === "" ? " " : state.slotVals.main;
    return;
  }

  const boxes = slotBoxes();
  const slots = SLOTS[type];
  const multi = slots.length > 1;
  const labels = q.labels || (type === "remainder" ? [null, "R"] : []);
  for (const slot of slots) {
    const box = boxes[slot];
    const value = state.slotVals[slot];
    let html = value === "" ? "&nbsp;" : value;
    if (slot === "rem") html = `<span class="r-tag">${labels[1] ?? "R"}</span>` + html;
    if (slot === "main" && labels[0]) html = `<span class="r-tag">${labels[0]}</span>` + html;
    if (slot === "main" && q.unit) html += `<span class="unit">${q.unit}</span>`;
    box.innerHTML = html;
    box.classList.toggle("focus", multi && state.activeSlot === slot);
  }
}

function pressKey(key) {
  if (state.locked) return;
  const q = currentQuestion();
  const type = inputType(q);
  if (type === "mcq") return;
  const slots = SLOTS[type];
  const idx = slots.indexOf(state.activeSlot);

  if (key === "del") {
    const current = state.slotVals[state.activeSlot];
    if (current === "" && idx > 0) {
      state.activeSlot = slots[idx - 1];
    } else {
      state.slotVals[state.activeSlot] = current.slice(0, -1);
    }
    updateTypedDisplay();
  } else if (key === "go") {
    // advance to the next empty slot, or submit
    const firstEmpty = slots.find((s) => state.slotVals[s] === "");
    if (firstEmpty && state.slotVals[state.activeSlot] !== "") {
      state.activeSlot = firstEmpty;
      updateTypedDisplay();
    } else if (!firstEmpty) {
      submitAnswer();
    } else if (idx < slots.length - 1 && state.slotVals[state.activeSlot] !== "") {
      state.activeSlot = slots[idx + 1];
      updateTypedDisplay();
    }
  } else if (key === ".") {
    if (type !== "decimal") return;
    const current = state.slotVals.main;
    if (!current.includes(".") && current.length < 8) {
      state.slotVals.main = current === "" ? "0." : current + ".";
      updateTypedDisplay();
    }
  } else if (/^\d$/.test(key)) {
    const current = state.slotVals[state.activeSlot];
    if (current.length < 8) {
      state.slotVals[state.activeSlot] = current + key;
      updateTypedDisplay();
    }
  }
}

function answerText(q) {
  if (q.answerText) return q.answerText;
  const type = inputType(q);
  if (type === "remainder") return `${q.answer} R ${q.remainder}`;
  if (type === "pair") return `${q.answer}, ${q.answer2}`;
  if (type === "fraction") return `${q.answerNum}/${q.answerDen}`;
  if (type === "mixed") return `${q.answerWhole} ${q.answerNum}/${q.answerDen}`;
  if (type === "mcq") return q.answerLabel;
  return String(q.answer);
}

function checkAnswer(q) {
  const type = inputType(q);
  const v = state.slotVals;
  if (type === "remainder") {
    return parseInt(v.main, 10) === q.answer && parseInt(v.rem, 10) === q.remainder;
  }
  if (type === "pair") {
    return parseInt(v.main, 10) === q.answer && parseInt(v.rem, 10) === q.answer2;
  }
  if (type === "decimal") {
    return Math.abs(parseFloat(v.main) - q.answer) < 1e-6;
  }
  if (type === "fraction") {
    const n = parseInt(v.num, 10);
    const d = parseInt(v.den, 10);
    if (!d) return false;
    if (q.exact) return n === q.answerNum && d === q.answerDen;
    return n * q.answerDen === d * q.answerNum;
  }
  if (type === "mixed") {
    const w = parseInt(v.whole, 10);
    const n = parseInt(v.num, 10);
    const d = parseInt(v.den, 10);
    if (!d || n >= d) return false;
    // compare w + n/d with answerWhole + answerNum/answerDen
    return (w * d + n) * q.answerDen === (q.answerWhole * q.answerDen + q.answerNum) * d;
  }
  return parseInt(v.main, 10) === q.answer;
}

function finishAnswer(correct, q) {
  state.locked = true;
  const elapsed = (Date.now() - state.questionStartTime) / 1000;
  const feedback = $("feedback");

  if (correct) {
    state.correctCount++;
    state.streak++;
    state.bestStreakThisRound = Math.max(state.bestStreakThisRound, state.streak);

    const speedBonus = Math.round(100 * Math.max(0, 1 - elapsed / q.parSec));
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
    feedback.textContent = `❌ Not quite — the answer was ${answerText(q)}`;
    feedback.className = "feedback bad";
    document.body.classList.remove("flash-good", "flash-bad");
    void document.body.offsetWidth;
    document.body.classList.add("flash-bad");
    setTimeout(nextQuestion, 1800);
  }

  $("quiz-streak").textContent = `\u{1F525} ${state.streak}`;
}

function submitAnswer() {
  if (state.locked) return;
  const q = currentQuestion();
  const type = inputType(q);
  const slots = SLOTS[type];
  if (slots.some((s) => state.slotVals[s] === "")) return;
  finishAnswer(checkAnswer(q), q);
}

function submitMcq(index, btn) {
  if (state.locked) return;
  const q = currentQuestion();
  const correct = !!q.options[index].correct;
  // highlight chosen + correct answers
  const buttons = [...$("mcq-grid").children];
  buttons.forEach((b, i) => {
    if (q.options[i].correct) b.classList.add("mcq-correct");
  });
  if (!correct) btn.classList.add("mcq-wrong");
  finishAnswer(correct, q);
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
  const sub = currentSub();
  if (levelsOf(sub).length === 1) {
    openTopic(state.topicId);
  } else {
    openLevels(state.topicId, state.subId);
  }
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
  if (screens.quiz.classList.contains("active") && currentSub()?.scratch) {
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

// Tapping a slot box selects it (multi-slot inputs only).
for (const [slot, id] of Object.entries({
  main: "answer-box", rem: "answer-box-r", whole: "frac-whole", num: "frac-num", den: "frac-den",
})) {
  $(id).addEventListener("click", () => {
    const q = currentQuestion();
    if (!q || state.locked) return;
    if (SLOTS[inputType(q)].includes(slot)) {
      state.activeSlot = slot;
      updateTypedDisplay();
    }
  });
}

// Physical keyboard support (handy when testing on a computer)
window.addEventListener("keydown", (e) => {
  if (!screens.quiz.classList.contains("active")) return;
  const q = currentQuestion();
  if (q && inputType(q) === "mcq") {
    if (/^[1-4]$/.test(e.key)) {
      const btn = $("mcq-grid").children[parseInt(e.key, 10) - 1];
      if (btn) btn.click();
    }
    return;
  }
  if (/^[0-9]$/.test(e.key)) pressKey(e.key);
  else if (e.key === ".") pressKey(".");
  else if (e.key === "Backspace") pressKey("del");
  else if (e.key === "Enter") pressKey("go");
});

$("btn-play-again").addEventListener("click", () =>
  startRound(state.topicId, state.subId, state.levelId)
);

$("btn-results-home").addEventListener("click", quitRound);

// Register the service worker so the app works offline once installed.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

renderHome();
