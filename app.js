"use strict";

/* ==========================================================================
   Question model
   Every difficulty level has a gen() that returns a question object:
   {
     kind:      "inline" | "written" | "longdiv",
     text:      question text (inline only; wordy => longer sentence style),
     wordy:     true for word problems (smaller font, left aligned),
     numbers:   the stacked numbers (written only),
     symbol:    operator symbol (written only),
     divisor/dividend:  (longdiv only),
     answer:    expected number (quotient for remainder questions),
     remainder: expected remainder (remainder questions only),
     unit:      unit label shown inside the answer box (conversions),
     decimals:  true if the "." key is allowed / answer is decimal,
     parSec:    par time in seconds for the speed bonus
   }
   Question parameters mirror the printed worksheets.
   ========================================================================== */

const QUESTIONS_PER_ROUND = 10;

function randInt(lo, hi) {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function randomWithDigits(d) {
  if (d === 1) return randInt(1, 9);
  return randInt(10 ** (d - 1), 10 ** d - 1);
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function totalDigits(numbers) {
  return numbers.reduce((a, n) => a + String(n).length, 0);
}

/* ---------- Addition & subtraction (shapes = digit counts) ---------- */

function arithGen(op, shapes, written) {
  return () => {
    for (let attempt = 0; attempt < 10000; attempt++) {
      const shape = pick(shapes);
      const numbers = shape.map(randomWithDigits);
      let answer;
      if (op === "+") {
        answer = numbers.reduce((a, b) => a + b, 0);
      } else {
        const rest = numbers.slice(1).reduce((a, b) => a + b, 0);
        if (numbers[0] < rest) continue;
        answer = numbers[0] - rest;
      }
      const par = (written ? 10 : 5) + 4 * totalDigits(numbers);
      if (written) {
        return { kind: "written", numbers, symbol: op === "+" ? "+" : "−", answer, parSec: par };
      }
      return {
        kind: "inline",
        text: numbers.join(op === "+" ? " + " : " − ") + " =",
        answer,
        parSec: par,
      };
    }
    return { kind: "inline", text: "99 − 11 =", answer: 88, parSec: 10 };
  };
}

/* ---------- Multiplication ---------- */

// 1-digit factors avoid 0 and 1 so questions are never trivial.
function mulFactor(digits) {
  return digits === 1 ? randInt(2, 9) : randomWithDigits(digits);
}

function mulWrittenGen(shapes) {
  return () => {
    const shape = pick(shapes);
    const numbers = shape.map(mulFactor);
    return {
      kind: "written",
      numbers,
      symbol: "×",
      answer: numbers.reduce((a, b) => a * b, 1),
      parSec: 10 + 6 * totalDigits(numbers),
    };
  };
}

function mulMentalGen(bLo, bHi) {
  return () => {
    const a = randInt(2, 12);
    const b = randInt(bLo, bHi);
    return { kind: "inline", text: `${a} × ${b} =`, answer: a * b, parSec: 20 };
  };
}

function mulTripleGen() {
  const a = randInt(2, 9);
  const b = randInt(2, 9);
  const c = randInt(2, 12);
  return { kind: "inline", text: `${a} × ${b} × ${c} =`, answer: a * b * c, parSec: 18 };
}

const MUL_WORD_TEMPLATES = [
  (a, b) => `A box holds ${a} pencils. How many pencils are in ${b} boxes?`,
  (a, b) => `There are ${a} students in each class. How many students are in ${b} classes?`,
  (a, b) => `A packet has ${a} biscuits. How many biscuits are in ${b} packets?`,
  (a, b) => `One table seats ${a} people. How many people can sit at ${b} tables?`,
  (a, b) => `A bus has ${a} seats. How many seats are there on ${b} buses?`,
  (a, b) => `A shelf holds ${a} books. How many books fit on ${b} shelves?`,
  (a, b) => `A ticket costs $${a}. How much do ${b} tickets cost? ($)`,
  (a, b) => `A garden has ${b} rows of flowers with ${a} flowers in each row. How many flowers are there?`,
  (a, b) => `A carton holds ${a} eggs. How many eggs are in ${b} cartons?`,
  (a, b) => `A swimmer swims ${a} metres each lap. How many metres do they swim in ${b} laps?`,
  (a, b) => `A baker makes ${a} cupcakes each day. How many cupcakes are made in ${b} days?`,
  (a, b) => `A train carriage has ${a} seats. How many seats are in ${b} carriages?`,
];

function mulWordGen(aRange, bRange) {
  return () => {
    const a = randInt(...aRange);
    const b = randInt(...bRange);
    return {
      kind: "inline",
      wordy: true,
      text: pick(MUL_WORD_TEMPLATES)(a, b),
      answer: a * b,
      parSec: 25,
    };
  };
}

/* ---------- Division ---------- */

function divFactsGen(dLo, dHi) {
  return () => {
    const d = randInt(dLo, dHi);
    const q = randInt(2, 12);
    return { kind: "inline", text: `${d * q} ÷ ${d} =`, answer: q, parSec: 8 };
  };
}

// Construct a dividend with exactly `nDigits` digits that divides evenly (or
// leaves a remainder when withRemainder is set).
function makeDivision(dLo, dHi, nDigits, withRemainder) {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const d = randInt(dLo, dHi);
    const lo = 10 ** (nDigits - 1);
    const hi = 10 ** nDigits - 1;
    const qMin = Math.max(2, Math.ceil(lo / d));
    const qMax = Math.floor(hi / d);
    if (qMin > qMax) continue;
    const q = randInt(qMin, qMax);
    if (!withRemainder) {
      return { d, q, r: 0, dividend: d * q };
    }
    const r = randInt(1, d - 1);
    if (d * q + r > hi) continue;
    return { d, q, r, dividend: d * q + r };
  }
  return { d: 4, q: 162, r: withRemainder ? 1 : 0, dividend: withRemainder ? 649 : 648 };
}

function longDivGen(dLo, dHi, nDigits, withRemainder) {
  return () => {
    const { d, q, r, dividend } = makeDivision(dLo, dHi, nDigits, withRemainder);
    const question = {
      kind: "longdiv",
      divisor: d,
      dividend,
      answer: q,
      parSec: 20 + 10 * nDigits + (d > 9 ? 15 : 0) + (withRemainder ? 8 : 0),
    };
    if (withRemainder) question.remainder = r;
    return question;
  };
}

function divMentalGen(dLo, dHi, parSec) {
  return () => {
    const { d, q, dividend } = makeDivision(dLo, dHi, 3, false);
    return { kind: "inline", text: `${dividend} ÷ ${d} =`, answer: q, parSec };
  };
}

const DIV_WORD_TEMPLATES = [
  (D, d) => `${D} apples are shared equally among ${d} children. How many apples does each child get?`,
  (D, d) => `${D} stickers are put equally into ${d} books. How many stickers go in each book?`,
  (D, d) => `${D} cupcakes are packed equally into ${d} boxes. How many cupcakes are in each box?`,
  (D, d) => `${D} chairs are arranged equally into ${d} rows. How many chairs are in each row?`,
  (D, d) => `${D} marbles are packed equally into ${d} bags. How many marbles are in each bag?`,
  (D, d) => `${D} pages are read over ${d} days, the same number each day. How many pages each day?`,
];

const DIV_WORD_REMAINDER_TEMPLATES = [
  (D, d) => `${D} pencils are packed into boxes of ${d}. How many full boxes can be made, and how many pencils are left over?`,
  (D, d) => `${D} students are put into teams of ${d}. How many full teams can be made, and how many students are left over?`,
  (D, d) => `${D} cookies are packed into bags of ${d}. How many full bags can be made, and how many are left over?`,
  (D, d) => `${D} books are placed on shelves that each hold ${d} books. How many full shelves are there, and how many books are left over?`,
  (D, d) => `${D} oranges are packed into crates of ${d}. How many full crates are there, and how many oranges are left over?`,
];

function divWordGen(withRemainder) {
  return () => {
    const d = randInt(2, 12);
    const q = randInt(4, 24);
    const r = withRemainder ? randInt(1, d - 1) : 0;
    const dividend = d * q + r;
    const template = pick(withRemainder ? DIV_WORD_REMAINDER_TEMPLATES : DIV_WORD_TEMPLATES);
    const question = {
      kind: "inline",
      wordy: true,
      text: template(dividend, d),
      answer: q,
      parSec: withRemainder ? 35 : 25,
    };
    if (withRemainder) question.remainder = r;
    return question;
  };
}

/* ---------- Measurement conversions ---------- */

// step keeps decimal values to at most 2 dp (e.g. 2250 g -> 2.25 kg).
const FAMILIES = {
  m_cm: { big: "m", small: "cm", factor: 100, step: 1, name: "Metres & Centimetres" },
  kg_g: { big: "kg", small: "g", factor: 1000, step: 10, name: "Kilograms & Grams" },
  cm_mm: { big: "cm", small: "mm", factor: 10, step: 1, name: "Centimetres & Millimetres" },
  l_ml: { big: "L", small: "mL", factor: 1000, step: 10, name: "Litres & Millilitres" },
  km_m: { big: "km", small: "m", factor: 1000, step: 10, name: "Kilometres & Metres" },
};

function convGen(family, mode) {
  const { big, small, factor, step } = family;
  return () => {
    if (mode === "bigToSmallWhole") {
      const n = randInt(1, 30);
      return { kind: "inline", text: `${n} ${big} =`, unit: small, answer: n * factor, parSec: 10 };
    }
    if (mode === "smallToBigWhole") {
      const n = randInt(1, 30);
      return { kind: "inline", text: `${n * factor} ${small} =`, unit: big, answer: n, parSec: 10 };
    }
    // Decimal modes: build an exact integer amount of the small unit first,
    // so the big-unit value always has at most 2 decimal places.
    let s;
    do {
      s = step * randInt(1, Math.floor((30 * factor) / step));
    } while (s % factor === 0);
    const v = s / factor;
    if (mode === "bigToSmallDecimal") {
      return { kind: "inline", text: `${v} ${big} =`, unit: small, answer: s, parSec: 14 };
    }
    // smallToBigDecimal
    return { kind: "inline", text: `${s} ${small} =`, unit: big, answer: v, decimals: true, parSec: 14 };
  };
}

function convLevels(family) {
  const { big, small } = family;
  return [
    { id: "l1", name: `${big} → ${small} (whole numbers)`, gen: convGen(family, "bigToSmallWhole") },
    { id: "l2", name: `${small} → ${big} (whole numbers)`, gen: convGen(family, "smallToBigWhole") },
    { id: "l3", name: `${big} → ${small} (decimals)`, gen: convGen(family, "bigToSmallDecimal") },
    { id: "l4", name: `${small} → ${big} (decimal answers)`, gen: convGen(family, "smallToBigDecimal") },
  ];
}

/* ==========================================================================
   Topics, subtopics & difficulty levels (mirroring the worksheets)
   ========================================================================== */

function addSubLevels(op, written) {
  if (written) {
    return [
      { id: "l1", name: `2-digit ${op} 2-digit`, gen: arithGen(op, [[2, 2]], true) },
      { id: "l2", name: `3/4-digit ${op} 2-digit`, gen: arithGen(op, [[3, 2], [4, 2]], true) },
      { id: "l3", name: `3/4-digit ${op} 3-digit`, gen: arithGen(op, [[3, 3], [4, 3]], true) },
      { id: "l4", name: `4/5-digit ${op} 3/4-digit`, gen: arithGen(op, [[5, 3], [4, 4], [5, 4]], true) },
    ];
  }
  return [
    { id: "l1", name: `2-digit ${op} 2-digit`, gen: arithGen(op, [[2, 2]]) },
    { id: "l2", name: `3-digit ${op} 2-digit`, gen: arithGen(op, [[3, 2]]) },
    { id: "l3", name: `4-digit ${op} 2-digit`, gen: arithGen(op, [[4, 2]]) },
    { id: "l4", name: `3-digit ${op} 3-digit`, gen: arithGen(op, [[3, 3]]) },
    { id: "l5", name: `4-digit ${op} 3-digit`, gen: arithGen(op, [[4, 3]]) },
  ];
}

function addSubTopic(topicName, op) {
  return {
    written: {
      name: `Written ${topicName}`,
      desc: "Column method — use the working-out pad",
      scratch: true,
      levels: addSubLevels(op, true),
    },
    mental: {
      name: `Mental ${topicName}`,
      desc: "Two numbers, all in your head",
      levels: addSubLevels(op, false),
    },
    mental3: {
      name: `Mental ${topicName}: 3+ Numbers`,
      desc: "Three or four numbers, all in your head",
      levels: [
        { id: "l1", name: "Three 2-digit numbers", gen: arithGen(op, [[2, 2, 2]]) },
        { id: "l2", name: "Four 2-digit numbers", gen: arithGen(op, [[2, 2, 2, 2]]) },
        { id: "l3", name: "One 3-digit, two 2-digit", gen: arithGen(op, [[3, 2, 2]]) },
      ],
    },
  };
}

const TOPICS = {
  addition: {
    name: "Addition",
    icon: "+",
    color: "linear-gradient(135deg, #34d399, #059669)",
    subtopics: addSubTopic("Addition", "+"),
  },
  subtraction: {
    name: "Subtraction",
    icon: "−",
    color: "linear-gradient(135deg, #60a5fa, #4f46e5)",
    subtopics: addSubTopic("Subtraction", "−"),
  },
  multiplication: {
    name: "Multiplication",
    icon: "×",
    color: "linear-gradient(135deg, #fbbf24, #ea580c)",
    subtopics: {
      written: {
        name: "Written Multiplication",
        desc: "Column method — use the working-out pad",
        scratch: true,
        levels: [
          { id: "l1", name: "2-digit × 1-digit", gen: mulWrittenGen([[2, 1]]) },
          { id: "l2", name: "3-digit × 1-digit", gen: mulWrittenGen([[3, 1]]) },
          { id: "l3", name: "4-digit × 1-digit", gen: mulWrittenGen([[4, 1]]) },
          { id: "l4", name: "2-digit × 2-digit", gen: mulWrittenGen([[2, 2]]) },
          { id: "l5", name: "3-digit × 2-digit", gen: mulWrittenGen([[3, 2]]) },
        ],
      },
      worded: {
        name: "Worded Multiplication",
        desc: "Real-life multiplication problems",
        levels: [
          { id: "l1", name: "Times tables (up to 12 × 12)", gen: mulWordGen([2, 12], [2, 12]) },
          { id: "l2", name: "2-digit × 1-digit", gen: mulWordGen([13, 99], [2, 9]) },
          { id: "l3", name: "2-digit × 2-digit", gen: mulWordGen([13, 99], [12, 25]) },
        ],
      },
      mental: {
        name: "Mental Multiplication",
        desc: "Up to 12 × a 2-digit number, in your head",
        levels: [
          { id: "l1", name: "× 13–19", gen: mulMentalGen(13, 19) },
          { id: "l2", name: "× 20–39", gen: mulMentalGen(20, 39) },
          { id: "l3", name: "× 40–59", gen: mulMentalGen(40, 59) },
          { id: "l4", name: "× 60–79", gen: mulMentalGen(60, 79) },
          { id: "l5", name: "× 80–99", gen: mulMentalGen(80, 99) },
        ],
      },
      triple: {
        name: "Multiplying Three Numbers",
        desc: "a × b × c, all in your head",
        levels: [{ id: "l1", name: "Three small numbers", gen: mulTripleGen }],
      },
    },
  },
  division: {
    name: "Division",
    icon: "÷",
    color: "linear-gradient(135deg, #f472b6, #9333ea)",
    subtopics: {
      facts: {
        name: "Division Facts",
        desc: "Times-table facts in reverse",
        levels: [
          { id: "l1", name: "Divide by 2–5", gen: divFactsGen(2, 5) },
          { id: "l2", name: "Divide by 6–9", gen: divFactsGen(6, 9) },
          { id: "l3", name: "Divide by 10–12", gen: divFactsGen(10, 12) },
        ],
      },
      longdiv: {
        name: "Long Division",
        desc: "No remainders — use the working-out pad",
        scratch: true,
        levels: [
          { id: "l1", name: "1-digit divisor, 3-digit number", gen: longDivGen(2, 9, 3, false) },
          { id: "l2", name: "1-digit divisor, 4-digit number", gen: longDivGen(2, 9, 4, false) },
          { id: "l3", name: "2-digit divisor, 3-digit number", gen: longDivGen(11, 99, 3, false) },
          { id: "l4", name: "2-digit divisor, 4-digit number", gen: longDivGen(11, 99, 4, false) },
        ],
      },
      longdivr: {
        name: "Long Division with Remainders",
        desc: "Answer with a remainder, e.g. 8 R 3",
        scratch: true,
        levels: [
          { id: "l1", name: "1-digit divisor, 3-digit number", gen: longDivGen(2, 9, 3, true) },
          { id: "l2", name: "1-digit divisor, 4-digit number", gen: longDivGen(2, 9, 4, true) },
          { id: "l3", name: "2-digit divisor, 3-digit number", gen: longDivGen(11, 99, 3, true) },
          { id: "l4", name: "2-digit divisor, 4-digit number", gen: longDivGen(11, 99, 4, true) },
        ],
      },
      worded: {
        name: "Worded Division",
        desc: "Real-life sharing problems",
        levels: [
          { id: "l1", name: "No remainder", gen: divWordGen(false) },
          { id: "l2", name: "With remainder", gen: divWordGen(true) },
        ],
      },
      mental: {
        name: "Regular Division Practice",
        desc: "3-digit numbers, no remainders",
        levels: [
          { id: "l1", name: "3-digit ÷ 1-digit", gen: divMentalGen(2, 9, 15) },
          { id: "l2", name: "3-digit ÷ 2-digit", gen: divMentalGen(11, 46, 30) },
        ],
      },
    },
  },
  measurement: {
    name: "Measurement Conversion",
    icon: "📏",
    color: "linear-gradient(135deg, #2dd4bf, #0d9488)",
    subtopics: Object.fromEntries(
      Object.entries(FAMILIES).map(([id, family]) => [
        id,
        {
          name: family.name,
          desc: `1 ${family.big} = ${family.factor} ${family.small}`,
          levels: convLevels(family),
        },
      ])
    ),
  },
};

/* Every multi-level subtopic gets a synthetic "Mixed" level. */
function levelsOf(sub) {
  if (sub.levels.length === 1) return sub.levels;
  const gens = sub.levels.map((l) => l.gen);
  return [
    ...sub.levels,
    { id: "mixed", name: "Mixed — All Difficulties", gen: () => pick(gens)(), mixed: true },
  ];
}

function getLevel(sub, levelId) {
  return levelsOf(sub).find((l) => l.id === levelId);
}

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
  typed: "",
  typedR: "",
  activeBox: "main", // "main" | "rem" (remainder questions)
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

  $("scratch-wrap").classList.toggle("active", !!sub.scratch);

  clearInterval(state.timerInterval);
  state.timerInterval = setInterval(() => {
    $("quiz-timer").textContent = formatMs(Date.now() - state.roundStartTime);
  }, 250);
  $("quiz-timer").textContent = "0:00";

  showScreen("quiz");
  showQuestion();
  if (sub.scratch) resizeScratchpad();
}

function showQuestion() {
  const q = currentQuestion();
  state.typed = "";
  state.typedR = "";
  state.activeBox = "main";
  state.locked = false;
  state.questionStartTime = Date.now();

  $("quiz-progress").textContent = `${state.index + 1}/${QUESTIONS_PER_ROUND}`;
  $("quiz-streak").textContent = `\u{1F525} ${state.streak}`;
  $("feedback").textContent = "";
  $("feedback").className = "feedback";

  const inlineEl = $("question-inline");
  const verticalEl = $("question-vertical");
  const longdivEl = $("question-longdiv");
  inlineEl.classList.remove("active");
  verticalEl.classList.remove("active");
  longdivEl.classList.remove("active");

  if (q.kind === "written") {
    verticalEl.classList.add("active");
    $("answer-row").classList.add("hidden");
    const rows = $("v-rows");
    rows.innerHTML = "";
    q.numbers.forEach((n, i) => {
      const div = document.createElement("div");
      div.textContent = i === 0 ? String(n) : `${q.symbol} ${n}`;
      rows.appendChild(div);
    });
  } else if (q.kind === "longdiv") {
    longdivEl.classList.add("active");
    $("answer-row").classList.remove("hidden");
    $("ld-divisor").textContent = q.divisor;
    $("ld-dividend").textContent = q.dividend;
  } else {
    inlineEl.classList.add("active");
    inlineEl.classList.toggle("q-word", !!q.wordy);
    inlineEl.textContent = q.text;
    $("answer-row").classList.remove("hidden");
  }

  $("answer-box-r").classList.toggle("active", q.remainder !== undefined);
  $("key-dot").classList.toggle("disabled", !q.decimals);
  if (currentSub().scratch) clearScratchpad();
  updateTypedDisplay();
}

function updateTypedDisplay() {
  const q = currentQuestion();

  if (q.kind === "written") {
    $("v-answer").textContent = state.typed === "" ? " " : state.typed;
    return;
  }

  const main = $("answer-box");
  const unitHtml = q.unit ? `<span class="unit">${q.unit}</span>` : "";
  main.innerHTML = (state.typed === "" ? "&nbsp;" : state.typed) + unitHtml;
  main.classList.toggle("focus", state.activeBox === "main" && q.remainder !== undefined);

  if (q.remainder !== undefined) {
    const rem = $("answer-box-r");
    rem.innerHTML =
      `<span class="r-tag">R</span>` + (state.typedR === "" ? "&nbsp;" : state.typedR);
    rem.classList.add("active");
    rem.classList.toggle("focus", state.activeBox === "rem");
  }
}

function activeTyped() {
  return state.activeBox === "rem" ? state.typedR : state.typed;
}

function setActiveTyped(value) {
  if (state.activeBox === "rem") state.typedR = value;
  else state.typed = value;
}

function pressKey(key) {
  if (state.locked) return;
  const q = currentQuestion();

  if (key === "del") {
    const current = activeTyped();
    if (current === "" && state.activeBox === "rem") {
      state.activeBox = "main";
    } else {
      setActiveTyped(current.slice(0, -1));
    }
    updateTypedDisplay();
  } else if (key === "go") {
    if (q.remainder !== undefined && state.activeBox === "main" && state.typed !== "") {
      state.activeBox = "rem";
      updateTypedDisplay();
    } else {
      submitAnswer();
    }
  } else if (key === ".") {
    if (!q.decimals || state.activeBox === "rem") return;
    if (!state.typed.includes(".") && state.typed.length < 8) {
      state.typed += state.typed === "" ? "0." : ".";
      updateTypedDisplay();
    }
  } else if (/^\d$/.test(key)) {
    const current = activeTyped();
    if (current.length < 8) {
      setActiveTyped(current + key);
      updateTypedDisplay();
    }
  }
}

function answerText(q) {
  return q.remainder !== undefined ? `${q.answer} R ${q.remainder}` : String(q.answer);
}

function submitAnswer() {
  if (state.typed === "" || state.locked) return;
  const q = currentQuestion();
  if (q.remainder !== undefined && state.typedR === "") {
    state.activeBox = "rem";
    updateTypedDisplay();
    return;
  }
  state.locked = true;

  const elapsed = (Date.now() - state.questionStartTime) / 1000;
  let correct;
  if (q.remainder !== undefined) {
    correct =
      parseInt(state.typed, 10) === q.answer && parseInt(state.typedR, 10) === q.remainder;
  } else if (q.decimals) {
    correct = Math.abs(parseFloat(state.typed) - q.answer) < 1e-6;
  } else {
    correct = parseInt(state.typed, 10) === q.answer;
  }

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

// Tapping an answer box selects it (remainder questions only).
$("answer-box").addEventListener("click", () => {
  if (currentQuestion()?.remainder !== undefined && !state.locked) {
    state.activeBox = "main";
    updateTypedDisplay();
  }
});
$("answer-box-r").addEventListener("click", () => {
  if (currentQuestion()?.remainder !== undefined && !state.locked) {
    state.activeBox = "rem";
    updateTypedDisplay();
  }
});

// Physical keyboard support (handy when testing on a computer)
window.addEventListener("keydown", (e) => {
  if (!screens.quiz.classList.contains("active")) return;
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
