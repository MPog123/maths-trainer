"use strict";

/* ==========================================================================
   Question generators for every topic.
   Each difficulty level has a gen() that returns a question object:
   {
     kind:      "inline" | "written" | "longdiv",
     input:     "int" (default) | "decimal" | "remainder" | "fraction" |
                "mixed" | "mcq",
     text:      question text (plain), or textHtml for rich fraction text,
     wordy:     true for word problems (smaller font, left aligned),
     svg:       diagram markup shown above the question,
     numbers,symbol:      (written questions),
     divisor,dividend:    (longdiv questions),
     answer:    expected number (quotient for remainder questions),
     remainder: expected remainder,
     answerNum/answerDen/answerWhole: fraction answers (exact: must be
                simplified; otherwise any equivalent fraction is accepted),
     options:   mcq: [{html, correct}], answerLabel: text for feedback,
     unit:      unit label shown inside the answer box,
     decimals:  true if the "." key is allowed,
     parSec:    par time in seconds for the speed bonus
   }
   ========================================================================== */

/* ---------- Basic utilities ---------- */

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

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function totalDigits(numbers) {
  return numbers.reduce((a, n) => a + String(n).length, 0);
}

function gcd(a, b) {
  return b ? gcd(b, a % b) : a;
}

function simplifyFrac(n, d) {
  const g = gcd(n, d);
  return [n / g, d / g];
}

/* Stacked fraction for question text (rendered with innerHTML). */
function fracHtml(n, d) {
  return `<span class="tfrac"><span class="tf-n">${n}</span><span class="tf-d">${d}</span></span>`;
}

function mcqOptions(correctHtml, distractorHtmls) {
  return shuffle([
    { html: correctHtml, correct: true },
    ...distractorHtmls.map((html) => ({ html })),
  ]);
}

/* ==========================================================================
   SVG diagram helpers
   ========================================================================== */

const INK = "#1e2145";
const SOFT = "#6b6f93";
const FILL = "#a5b4fc";
const FILL_DARK = "#4f46e5";
const FILL_LIGHT = "#e0e7ff";
const FILL_GREY = "#e2e8f0";

function svgEl(w, h, inner) {
  // width/height attributes give the SVG an intrinsic size so CSS max-width
  // scaling works everywhere (notably inside MCQ option buttons).
  return `<svg class="qsvg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

function poly(pts, fill = FILL, extra = "") {
  const attr = pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  return `<polygon points="${attr}" fill="${fill}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round" ${extra}/>`;
}

function lineEl(x1, y1, x2, y2, extra = "") {
  return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${INK}" stroke-width="2.5" stroke-linecap="round" ${extra}/>`;
}

function txt(x, y, s, size = 15, fill = INK, anchor = "middle") {
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" font-weight="700" fill="${fill}" text-anchor="${anchor}" font-family="-apple-system,Segoe UI,sans-serif">${s}</text>`;
}

function caption(w, h, s = "Not drawn to scale") {
  return txt(w - 6, h - 6, s, 11, SOFT, "end");
}

function regPolyPts(n, cx, cy, r, rotDeg = -90) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = ((rotDeg + (360 * i) / n) * Math.PI) / 180;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

function sectorPath(cx, cy, r, a0, a1, fill) {
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `<path d="M ${cx} ${cy} L ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z" fill="${fill}" stroke="${INK}" stroke-width="2"/>`;
}

/* --- fraction visuals --- */

function pieSvg(den, num) {
  const cx = 100, cy = 100, r = 85;
  let inner = "";
  for (let i = 0; i < den; i++) {
    const a0 = -Math.PI / 2 + (2 * Math.PI * i) / den;
    const a1 = -Math.PI / 2 + (2 * Math.PI * (i + 1)) / den;
    inner += sectorPath(cx, cy, r, a0, a1, i < num ? FILL_DARK : FILL_LIGHT);
  }
  return svgEl(200, 200, inner);
}

function barSvg(den, num) {
  const w = 240 / den;
  let inner = "";
  for (let i = 0; i < den; i++) {
    inner += `<rect x="${(10 + i * w).toFixed(1)}" y="20" width="${w.toFixed(1)}" height="50" fill="${i < num ? FILL_DARK : FILL_LIGHT}" stroke="${INK}" stroke-width="2"/>`;
  }
  return svgEl(260, 90, inner);
}

/* --- 2D shapes --- */

const SHAPES_2D = {
  triangle: () => svgEl(240, 190, poly(regPolyPts(3, 120, 105, 85))),
  square: () => svgEl(240, 190, poly([[55, 30], [185, 30], [185, 160], [55, 160]])),
  rectangle: () => svgEl(240, 190, poly([[25, 50], [215, 50], [215, 140], [25, 140]])),
  pentagon: () => svgEl(240, 190, poly(regPolyPts(5, 120, 100, 82))),
  hexagon: () => svgEl(240, 190, poly(regPolyPts(6, 120, 95, 82, 0))),
  heptagon: () => svgEl(240, 190, poly(regPolyPts(7, 120, 100, 82))),
  octagon: () => svgEl(240, 190, poly(regPolyPts(8, 120, 95, 82, 22.5))),
  nonagon: () => svgEl(240, 190, poly(regPolyPts(9, 120, 100, 82))),
  decagon: () => svgEl(240, 190, poly(regPolyPts(10, 120, 95, 82))),
  circle: () => svgEl(240, 190, `<circle cx="120" cy="95" r="80" fill="${FILL}" stroke="${INK}" stroke-width="2.5"/>`),
  rhombus: () => svgEl(240, 190, poly([[120, 20], [195, 95], [120, 170], [45, 95]])),
  parallelogram: () => svgEl(240, 190, poly([[60, 140], [230, 140], [180, 50], [10, 50]])),
  trapezium: () => svgEl(240, 190, poly([[30, 150], [210, 150], [165, 50], [75, 50]])),
  kite: () => svgEl(240, 190, poly([[120, 10], [180, 80], [120, 180], [60, 80]])),
};

const SHAPE_NAMES = {
  triangle: "Triangle", square: "Square", rectangle: "Rectangle",
  pentagon: "Pentagon", hexagon: "Hexagon", heptagon: "Heptagon",
  octagon: "Octagon", nonagon: "Nonagon", decagon: "Decagon",
  circle: "Circle", rhombus: "Rhombus", parallelogram: "Parallelogram",
  trapezium: "Trapezium", kite: "Kite",
};

/* --- angles --- */

function angleSvg(deg) {
  const W = 260, H = 200;
  const cx = deg > 180 ? 130 : 70;
  const cy = deg > 180 ? 100 : 150;
  const len = deg > 180 ? 70 : 110;
  const rad = (-deg * Math.PI) / 180;
  const ex = cx + len * Math.cos(rad);
  const ey = cy + len * Math.sin(rad);
  let inner = lineEl(cx, cy, cx + len, cy) + lineEl(cx, cy, ex, ey);
  const r = 30;
  if (deg === 90) {
    inner += `<path d="M ${cx + 22} ${cy} L ${cx + 22} ${cy - 22} L ${cx} ${cy - 22}" fill="none" stroke="${INK}" stroke-width="2"/>`;
  } else {
    const large = deg > 180 ? 1 : 0;
    const ax = cx + r * Math.cos(rad);
    const ay = cy + r * Math.sin(rad);
    inner += `<path d="M ${cx + r} ${cy} A ${r} ${r} 0 ${large} 0 ${ax.toFixed(1)} ${ay.toFixed(1)}" fill="none" stroke="${FILL_DARK}" stroke-width="2.5"/>`;
  }
  return svgEl(W, H, inner);
}

/* angles on a straight line: known angle a, find x */
function lineAngleSvg(a) {
  const cx = 130, cy = 150;
  const rad = (-a * Math.PI) / 180;
  const ex = cx + 105 * Math.cos(rad);
  const ey = cy + 105 * Math.sin(rad);
  let inner = lineEl(20, cy, 240, cy) + lineEl(cx, cy, ex, ey);
  const mid1 = (-a / 2 * Math.PI) / 180;
  const mid2 = (-(a + 180) / 2 * Math.PI) / 180;
  inner += txt(cx + 55 * Math.cos(mid1), cy + 55 * Math.sin(mid1) + 5, `${a}°`);
  inner += txt(cx + 55 * Math.cos(mid2), cy + 55 * Math.sin(mid2) + 5, "x°", 15, FILL_DARK);
  inner += `<path d="M ${cx + 34} ${cy} A 34 34 0 0 0 ${(cx + 34 * Math.cos(rad)).toFixed(1)} ${(cy + 34 * Math.sin(rad)).toFixed(1)}" fill="none" stroke="${INK}" stroke-width="2"/>`;
  inner += `<path d="M ${(cx + 26 * Math.cos(rad)).toFixed(1)} ${(cy + 26 * Math.sin(rad)).toFixed(1)} A 26 26 0 0 0 ${cx - 26} ${cy}" fill="none" stroke="${FILL_DARK}" stroke-width="2"/>`;
  return svgEl(260, 200, inner + caption(260, 200));
}

/* angles at a point: known a, b, find x */
function pointAngleSvg(a, b) {
  const cx = 130, cy = 105, len = 90;
  const angles = [0, a, a + b];
  let inner = "";
  for (const t of angles) {
    const rad = (-t * Math.PI) / 180;
    inner += lineEl(cx, cy, cx + len * Math.cos(rad), cy + len * Math.sin(rad));
  }
  const mids = [a / 2, a + b / 2, (a + b + 360) / 2];
  const labels = [`${a}°`, `${b}°`, "x°"];
  mids.forEach((m, i) => {
    const rad = (-m * Math.PI) / 180;
    inner += txt(cx + 52 * Math.cos(rad), cy + 52 * Math.sin(rad) + 5, labels[i], 15, i === 2 ? FILL_DARK : INK);
  });
  return svgEl(260, 210, inner + caption(260, 210));
}

/* vertically opposite: known a between the lines, find x opposite */
function vertOppSvg(a) {
  const cx = 130, cy = 100, len = 105;
  const t1 = 10, t2 = 10 + a;
  let inner = "";
  for (const t of [t1, t2]) {
    const rad = (-t * Math.PI) / 180;
    inner += lineEl(cx - len * Math.cos(rad), cy - len * Math.sin(rad), cx + len * Math.cos(rad), cy + len * Math.sin(rad));
  }
  const midRad = (-(t1 + a / 2) * Math.PI) / 180;
  inner += txt(cx + 60 * Math.cos(midRad), cy + 60 * Math.sin(midRad) + 5, `${a}°`);
  inner += txt(cx - 60 * Math.cos(midRad), cy - 60 * Math.sin(midRad) + 5, "x°", 15, FILL_DARK);
  return svgEl(260, 200, inner + caption(260, 200));
}

/* triangle with angles A (left), B (right), x at apex */
function triAngleSvg(A, B) {
  const L = [40, 165], R = [225, 165];
  const Ar = (A * Math.PI) / 180, Br = (B * Math.PI) / 180;
  const t = ((R[0] - L[0]) * Math.sin(Br)) / Math.sin(Ar + Br);
  const apex = [L[0] + t * Math.cos(Ar), L[1] - t * Math.sin(Ar)];
  let inner = poly([L, R, apex], FILL_LIGHT);
  inner += txt(L[0] + 34, L[1] - 10, `${A}°`);
  inner += txt(R[0] - 34, R[1] - 10, `${B}°`);
  inner += txt(apex[0], Math.max(apex[1] + 28, 30), "x°", 15, FILL_DARK);
  return svgEl(260, 200, inner + caption(260, 200));
}

/* quadrilateral with angles a, b, c and x */
function quadAngleSvg(a, b, c) {
  const P = [[45, 170], [230, 155], [195, 45], [70, 30]];
  let inner = poly(P, FILL_LIGHT);
  inner += txt(P[0][0] + 22, P[0][1] - 14, `${a}°`);
  inner += txt(P[1][0] - 26, P[1][1] - 14, `${b}°`);
  inner += txt(P[2][0] - 20, P[2][1] + 24, `${c}°`);
  inner += txt(P[3][0] + 20, P[3][1] + 24, "x°", 15, FILL_DARK);
  return svgEl(260, 200, inner + caption(260, 200));
}

/* --- labelled shapes for perimeter / area --- */

function rectLabelledSvg(w, h, opts = {}) {
  const scale = Math.min(170 / w, 110 / h);
  const rw = w * scale, rh = h * scale;
  const x = (240 - rw) / 2, y = (170 - rh) / 2 + 10;
  let inner = poly([[x, y], [x + rw, y], [x + rw, y + rh], [x, y + rh]], FILL_LIGHT);
  inner += txt(x + rw / 2, y - 8, `${w} cm`);
  if (!opts.square) inner += txt(x + rw + 8, y + rh / 2 + 5, `${h} cm`, 15, INK, "start");
  if (opts.hideWidth) inner = inner.replace(`${w} cm`, "? cm");
  return svgEl(300, 190, inner + caption(300, 190));
}

function triLabelledSvg(labels, showHeight) {
  const P = [[35, 160], [235, 160], [150, 35]];
  let inner = poly(P, FILL_LIGHT);
  if (showHeight) {
    inner += lineEl(150, 160, 150, 35, `stroke-dasharray="6 5"`);
    inner += `<path d="M 150 148 L 162 148 L 162 160" fill="none" stroke="${INK}" stroke-width="1.5"/>`;
    inner += txt(122, 105, labels[1]);
    inner += txt(135, 180, labels[0]);
  } else {
    inner += txt(135, 180, labels[0]);
    inner += txt(65, 90, labels[1]);
    inner += txt(215, 90, labels[2]);
  }
  return svgEl(260, 195, inner + caption(260, 195));
}

function quadLabelledSvg(sides) {
  const P = [[45, 165], [225, 150], [200, 45], [75, 35]];
  let inner = poly(P, FILL_LIGHT);
  const mids = [
    [(P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2 + 20],
    [(P[1][0] + P[2][0]) / 2 + 24, (P[1][1] + P[2][1]) / 2 + 5],
    [(P[2][0] + P[3][0]) / 2, (P[2][1] + P[3][1]) / 2 - 10],
    [(P[3][0] + P[0][0]) / 2 - 24, (P[3][1] + P[0][1]) / 2 + 5],
  ];
  sides.forEach((s, i) => (inner += txt(mids[i][0], mids[i][1], `${s} cm`)));
  return svgEl(260, 200, inner + caption(260, 200));
}

function parallelogramLabelledSvg(b, h) {
  const P = [[35, 155], [195, 155], [235, 55], [75, 55]];
  let inner = poly(P, FILL_LIGHT);
  inner += lineEl(195, 155, 195, 55, `stroke-dasharray="6 5"`);
  inner += txt(115, 178, `${b} cm`);
  inner += txt(213, 110, `${h} cm`, 15, INK, "start");
  return svgEl(260, 195, inner + caption(260, 195));
}

function lShapeSvg(W, H, w, h) {
  const scale = Math.min(160 / W, 130 / H);
  const X = (x) => 45 + x * scale;
  const Y = (y) => 25 + y * scale;
  const P = [[X(0), Y(0)], [X(W - w), Y(0)], [X(W - w), Y(h)], [X(W), Y(h)], [X(W), Y(H)], [X(0), Y(H)]];
  let inner = poly(P, FILL_LIGHT);
  inner += txt(X((W - w) / 2), Y(0) - 7, `${W - w} cm`, 13);
  inner += txt(X(W - w) - 8, Y(h / 2) + 4, `${h} cm`, 13, INK, "end");
  inner += txt(X(W - w / 2), Y(h) - 7, `${w} cm`, 13);
  inner += txt(X(W) + 6, Y((H + h) / 2), `${H - h} cm`, 13, INK, "start");
  inner += txt(X(W / 2), Y(H) + 16, `${W} cm`, 13);
  inner += txt(X(0) - 6, Y(H / 2), `${H} cm`, 13, INK, "end");
  return svgEl(280, 200, inner + caption(280, 200));
}

/* --- triangles for classification --- */

function classifyTriangleSvg(type) {
  if (type === "equilateral") {
    const s = randInt(4, 9);
    const P = regPolyPts(3, 130, 105, 85);
    let inner = poly(P, FILL_LIGHT);
    inner += txt(130, 195, `${s} cm`);
    inner += txt(62, 90, `${s} cm`);
    inner += txt(198, 90, `${s} cm`);
    return { svg: svgEl(260, 205, inner + caption(260, 205)), label: "Equilateral" };
  }
  if (type === "isosceles") {
    const a = randInt(5, 9);
    let b = randInt(3, 9);
    if (b === a) b = a - 1;
    const P = [[130, 25], [65, 170], [195, 170]];
    let inner = poly(P, FILL_LIGHT);
    inner += txt(78, 90, `${a} cm`);
    inner += txt(182, 90, `${a} cm`);
    inner += txt(130, 190, `${b} cm`);
    return { svg: svgEl(260, 200, inner + caption(260, 200)), label: "Isosceles" };
  }
  const sides = shuffle([randInt(4, 6), randInt(7, 9), randInt(10, 12)]);
  const P = [[45, 160], [230, 150], [120, 40]];
  let inner = poly(P, FILL_LIGHT);
  inner += txt(135, 180, `${sides[0]} cm`);
  inner += txt(200, 90, `${sides[1]} cm`);
  inner += txt(60, 95, `${sides[2]} cm`);
  return { svg: svgEl(260, 200, inner + caption(260, 200)), label: "Scalene" };
}

function classifyTriangleByAnglesSvg(type) {
  if (type === "right") {
    const a = randInt(25, 65);
    const P = [[55, 165], [55, 45], [215, 165]];
    let inner = poly(P, FILL_LIGHT);
    inner += `<path d="M 55 143 L 77 143 L 77 165" fill="none" stroke="${INK}" stroke-width="2"/>`;
    inner += txt(78, 70, `${90 - a}°`);
    inner += txt(178, 155, `${a}°`);
    return { svg: svgEl(260, 200, inner + caption(260, 200)), label: "Right-angled" };
  }
  if (type === "acute") {
    const A = randInt(45, 75), B = randInt(45, 75);
    return { svg: triAngleWithAllLabels(A, B), label: "Acute-angled" };
  }
  const A = randInt(100, 130), B = randInt(20, 35);
  return { svg: triAngleWithAllLabels(A, B), label: "Obtuse-angled" };
}

function triAngleWithAllLabels(A, B) {
  const C = 180 - A - B;
  const L = [40, 160], R = [225, 160];
  const Ar = (A * Math.PI) / 180, Br = (B * Math.PI) / 180;
  const t = ((R[0] - L[0]) * Math.sin(Br)) / Math.sin(Ar + Br);
  const apex = [L[0] + t * Math.cos(Ar), L[1] - t * Math.sin(Ar)];
  let inner = poly([L, R, apex], FILL_LIGHT);
  inner += txt(L[0] + 36, L[1] - 10, `${A}°`, 14);
  inner += txt(R[0] - 36, R[1] - 10, `${B}°`, 14);
  inner += txt(apex[0], Math.min(Math.max(apex[1] + 30, 30), 140), `${C}°`, 14);
  return svgEl(260, 195, inner + caption(260, 195));
}

/* --- 3D solids --- */

function boxSvg(w, h, labels) {
  const x = 60, y = 65, dx = 42, dy = -30;
  let inner = poly([[x, y], [x + w, y], [x + w + dx, y + dy], [x + dx, y + dy]], FILL_LIGHT);
  inner += poly([[x + w, y], [x + w + dx, y + dy], [x + w + dx, y + dy + h], [x + w, y + h]], FILL);
  inner += poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], "#c7d2fe");
  if (labels) {
    inner += txt(x + w / 2, y + h + 18, labels[0]);
    inner += txt(x + w + dx / 2 + 8, y + h + dy / 2 + 12, labels[1], 15, INK, "start");
    inner += txt(x - 8, y + h / 2 + 5, labels[2], 15, INK, "end");
  }
  return svgEl(270, 200, inner + (labels ? caption(270, 200) : ""));
}

const SHAPES_3D = {
  cube: () => boxSvg(95, 95),
  "rectangular prism": () => boxSvg(130, 75),
  sphere: () =>
    svgEl(240, 190,
      `<circle cx="120" cy="95" r="75" fill="#c7d2fe" stroke="${INK}" stroke-width="2.5"/>` +
      `<ellipse cx="120" cy="95" rx="75" ry="22" fill="none" stroke="${INK}" stroke-width="1.5" stroke-dasharray="6 5"/>`),
  cylinder: () =>
    svgEl(240, 200,
      `<path d="M 55 50 L 55 150 A 65 20 0 0 0 185 150 L 185 50" fill="#c7d2fe" stroke="${INK}" stroke-width="2.5"/>` +
      `<ellipse cx="120" cy="50" rx="65" ry="20" fill="${FILL_LIGHT}" stroke="${INK}" stroke-width="2.5"/>`),
  cone: () =>
    svgEl(240, 200,
      `<path d="M 55 150 L 120 25 L 185 150" fill="#c7d2fe" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>` +
      `<ellipse cx="120" cy="150" rx="65" ry="20" fill="${FILL_LIGHT}" stroke="${INK}" stroke-width="2.5"/>`),
  "square pyramid": () =>
    svgEl(250, 200,
      poly([[55, 155], [175, 155], [215, 120], [95, 120]], FILL_LIGHT) +
      poly([[55, 155], [175, 155], [135, 30]], "#c7d2fe") +
      lineEl(135, 30, 215, 120) +
      lineEl(135, 30, 95, 120, `stroke-dasharray="6 5" stroke-width="1.5"`)),
  "triangular pyramid": () =>
    svgEl(250, 200,
      poly([[50, 160], [210, 150], [140, 120]], FILL_LIGHT) +
      poly([[50, 160], [210, 150], [125, 30]], "#c7d2fe") +
      lineEl(125, 30, 140, 120, `stroke-dasharray="6 5" stroke-width="1.5"`)),
  "triangular prism": () => {
    const A = [45, 155], B = [135, 155], C = [90, 58];
    const dx = 85, dy = -22;
    const A2 = [A[0] + dx, A[1] + dy], B2 = [B[0] + dx, B[1] + dy], C2 = [C[0] + dx, C[1] + dy];
    return svgEl(270, 200,
      poly([C, C2, B2, B], FILL_LIGHT) +
      poly([A, B, B2, A2], FILL) +
      poly([A, B, C], "#c7d2fe") +
      lineEl(A2[0], A2[1], C2[0], C2[1], `stroke-dasharray="6 5" stroke-width="1.5"`));
  },
};

const SOLID_NAMES = {
  cube: "Cube",
  "rectangular prism": "Rectangular prism",
  sphere: "Sphere",
  cylinder: "Cylinder",
  cone: "Cone",
  "square pyramid": "Square pyramid",
  "triangular pyramid": "Triangular pyramid",
  "triangular prism": "Triangular prism",
};

/* faces / edges / vertices data */
const SOLID_FEV = {
  cube: { f: 6, e: 12, v: 8 },
  "rectangular prism": { f: 6, e: 12, v: 8 },
  "triangular prism": { f: 5, e: 9, v: 6 },
  "square pyramid": { f: 5, e: 8, v: 5 },
  "triangular pyramid": { f: 4, e: 6, v: 4 },
};

/* --- isometric cube stacks --- */

function isoCubesSvg(heights) {
  // heights: 2D array heights[row][col]; row = depth (j), col = i
  const s = 26, v = 24;
  const cubes = [];
  for (let j = 0; j < heights.length; j++) {
    for (let i = 0; i < heights[j].length; i++) {
      for (let k = 0; k < heights[j][i]; k++) cubes.push([i, j, k]);
    }
  }
  cubes.sort((a, b) => a[0] + a[1] - (b[0] + b[1]) || a[2] - b[2]);
  const ox = 135, oy = 150;
  let inner = "";
  for (const [i, j, k] of cubes) {
    const sx = ox + (i - j) * s;
    const yt = oy + ((i + j) * s) / 2 - k * v;
    const top = [[sx, yt - v], [sx + s, yt - v - s / 2], [sx, yt - v - s], [sx - s, yt - v - s / 2]];
    const right = [[sx, yt], [sx + s, yt - s / 2], [sx + s, yt - s / 2 - v], [sx, yt - v]];
    const left = [[sx, yt], [sx - s, yt - s / 2], [sx - s, yt - s / 2 - v], [sx, yt - v]];
    inner += poly(left, FILL) + poly(right, "#818cf8") + poly(top, "#c7d2fe");
  }
  return svgEl(280, 210, inner);
}

function countCubes(heights) {
  return heights.flat().reduce((a, b) => a + b, 0);
}

/* --- nets --- */

function netSquares(cells, u = 34) {
  // cells: [col,row] grid positions of unit squares
  const maxC = Math.max(...cells.map((c) => c[0])) + 1;
  const maxR = Math.max(...cells.map((c) => c[1])) + 1;
  const w = maxC * u + 20, h = maxR * u + 20;
  let inner = "";
  for (const [c, r] of cells) {
    inner += `<rect x="${10 + c * u}" y="${10 + r * u}" width="${u}" height="${u}" fill="${FILL_LIGHT}" stroke="${INK}" stroke-width="2"/>`;
  }
  return svgEl(w, h, inner);
}

const NETS = {
  cube: () => netSquares([[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]]),
  "rectangular prism": () => {
    const w = 52, d = 26, h = 34;
    const x0 = 12, y0 = 12;
    const rect = (x, y, ww, hh) =>
      `<rect x="${x}" y="${y}" width="${ww}" height="${hh}" fill="${FILL_LIGHT}" stroke="${INK}" stroke-width="2"/>`;
    let inner = rect(x0 + d, y0, w, d);
    inner += rect(x0, y0 + d, d, h) + rect(x0 + d, y0 + d, w, h) + rect(x0 + d + w, y0 + d, d, h) + rect(x0 + d + w + d, y0 + d, w, h);
    inner += rect(x0 + d, y0 + d + h, w, d);
    return svgEl(x0 * 2 + d * 2 + w * 2, y0 * 2 + d * 2 + h, inner);
  },
  "square pyramid": () => {
    const u = 56, x0 = 60, y0 = 60;
    let inner = `<rect x="${x0}" y="${y0}" width="${u}" height="${u}" fill="${FILL_LIGHT}" stroke="${INK}" stroke-width="2"/>`;
    const t = (pts) => poly(pts, "#c7d2fe");
    inner += t([[x0, y0], [x0 + u, y0], [x0 + u / 2, y0 - 46]]);
    inner += t([[x0, y0 + u], [x0 + u, y0 + u], [x0 + u / 2, y0 + u + 46]]);
    inner += t([[x0, y0], [x0, y0 + u], [x0 - 46, y0 + u / 2]]);
    inner += t([[x0 + u, y0], [x0 + u, y0 + u], [x0 + u + 46, y0 + u / 2]]);
    return svgEl(180, 180, inner);
  },
  "triangular prism": () => {
    const w = 46, L = 62, x0 = 14, y0 = 46;
    const rect = (x) =>
      `<rect x="${x}" y="${y0}" width="${w}" height="${L}" fill="${FILL_LIGHT}" stroke="${INK}" stroke-width="2"/>`;
    let inner = rect(x0) + rect(x0 + w) + rect(x0 + 2 * w);
    inner += poly([[x0 + w, y0], [x0 + 2 * w, y0], [x0 + 1.5 * w, y0 - 40]], "#c7d2fe");
    inner += poly([[x0 + w, y0 + L], [x0 + 2 * w, y0 + L], [x0 + 1.5 * w, y0 + L + 40]], "#c7d2fe");
    return svgEl(170, 200, inner);
  },
  cylinder: () =>
    svgEl(190, 200,
      `<circle cx="95" cy="34" r="26" fill="${FILL_LIGHT}" stroke="${INK}" stroke-width="2"/>` +
      `<rect x="30" y="62" width="130" height="76" fill="#c7d2fe" stroke="${INK}" stroke-width="2"/>` +
      `<circle cx="95" cy="166" r="26" fill="${FILL_LIGHT}" stroke="${INK}" stroke-width="2"/>`),
};

/* --- chance visuals --- */

function spinnerSvg(n, k) {
  const cx = 105, cy = 110, r = 85;
  let inner = "";
  for (let i = 0; i < n; i++) {
    const a0 = -Math.PI / 2 + (2 * Math.PI * i) / n;
    const a1 = -Math.PI / 2 + (2 * Math.PI * (i + 1)) / n;
    inner += sectorPath(cx, cy, r, a0, a1, i < k ? "#3b82f6" : FILL_GREY);
  }
  inner += `<circle cx="${cx}" cy="${cy}" r="6" fill="${INK}"/>`;
  inner += poly([[cx - 8, 22], [cx + 8, 22], [cx, 6]], "#ef4444");
  return svgEl(210, 205, inner);
}

function jarSvg(red, blue) {
  let inner = `<rect x="55" y="30" width="130" height="150" rx="20" fill="none" stroke="${INK}" stroke-width="3"/>`;
  inner += `<line x1="55" y1="52" x2="185" y2="52" stroke="${INK}" stroke-width="2"/>`;
  const marbles = shuffle([
    ...Array(red).fill("#ef4444"),
    ...Array(blue).fill("#3b82f6"),
  ]);
  marbles.forEach((color, idx) => {
    const col = idx % 4, row = Math.floor(idx / 4);
    inner += `<circle cx="${78 + col * 28}" cy="${160 - row * 26}" r="12" fill="${color}" stroke="${INK}" stroke-width="1.5"/>`;
  });
  return svgEl(240, 200, inner);
}

const DICE_PIPS = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

function dieSvg(value) {
  let inner = `<rect x="35" y="15" width="120" height="120" rx="22" fill="#fff" stroke="${INK}" stroke-width="3"/>`;
  for (const [dx, dy] of DICE_PIPS[value]) {
    inner += `<circle cx="${95 + dx * 32}" cy="${75 + dy * 32}" r="11" fill="${INK}"/>`;
  }
  return svgEl(190, 150, inner);
}

/* ==========================================================================
   Arithmetic topics (Addition, Subtraction, Multiplication, Division)
   ========================================================================== */

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

function divFactsGen(dLo, dHi) {
  return () => {
    const d = randInt(dLo, dHi);
    const q = randInt(2, 12);
    return { kind: "inline", text: `${d * q} ÷ ${d} =`, answer: q, parSec: 8 };
  };
}

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

/* ==========================================================================
   Measurement conversions
   ========================================================================== */

const FAMILIES = {
  m_cm: { big: "m", small: "cm", factor: 100, step: 1, name: "Metres & Centimetres" },
  kg_g: { big: "kg", small: "g", factor: 1000, step: 10, name: "Kilograms & Grams" },
  cm_mm: { big: "cm", small: "mm", factor: 10, step: 1, name: "Centimetres & Millimetres" },
  l_ml: { big: "L", small: "mL", factor: 1000, step: 10, name: "Litres & Millilitres" },
  km_m: { big: "km", small: "m", factor: 1000, step: 10, name: "Kilometres & Metres" },
};

const UNIT_NAMES = {
  m: "metres", cm: "centimetres", mm: "millimetres",
  kg: "kilograms", g: "grams", L: "litres", mL: "millilitres", km: "kilometres",
};

// Core conversion values. Decimal values are built from an exact integer
// amount of the small unit so answers have at most 2 decimal places.
function convValues(family, mode) {
  const { factor, step } = family;
  if (mode === "bigToSmallWhole") {
    const n = randInt(1, 30);
    return { from: n, answer: n * factor, decimals: false };
  }
  if (mode === "smallToBigWhole") {
    const n = randInt(1, 30);
    return { from: n * factor, answer: n, decimals: false };
  }
  let s;
  do {
    s = step * randInt(1, Math.floor((30 * factor) / step));
  } while (s % factor === 0);
  if (mode === "bigToSmallDecimal") {
    return { from: s / factor, answer: s, decimals: false };
  }
  return { from: s, answer: s / factor, decimals: true };
}

function convGen(family, mode) {
  const { big, small } = family;
  return () => {
    const bigFirst = mode.startsWith("bigToSmall");
    const v = convValues(family, mode);
    return {
      kind: "inline",
      text: `${v.from} ${bigFirst ? big : small} =`,
      unit: bigFirst ? small : big,
      answer: v.answer,
      decimals: v.decimals,
      parSec: v.decimals || mode.endsWith("Decimal") ? 14 : 10,
    };
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

const CONV_WORD_THINGS = {
  m_cm: [["A ribbon", "is", "long"], ["A rope", "is", "long"], ["A hallway", "is", "long"], ["A garden bed", "is", "long"]],
  kg_g: [["A parcel", "weighs", ""], ["A pumpkin", "weighs", ""], ["A bag of rice", "weighs", ""], ["A puppy", "weighs", ""]],
  cm_mm: [["A pencil", "is", "long"], ["A leaf", "is", "long"], ["A key", "is", "long"], ["An eraser", "is", "long"]],
  l_ml: [["A bottle", "holds", ""], ["A jug", "holds", ""], ["A fish tank", "holds", ""], ["A watering can", "holds", ""]],
  km_m: [["A walking track", "is", "long"], ["A cycling path", "is", "long"], ["A fun run", "is", "long"], ["A road", "is", "long"]],
};

function convWordGen(decimalMode) {
  return () => {
    const [famId, family] = pick(Object.entries(FAMILIES));
    const bigFirst = Math.random() < 0.5;
    const mode = bigFirst
      ? decimalMode ? "bigToSmallDecimal" : "bigToSmallWhole"
      : decimalMode ? "smallToBigDecimal" : "smallToBigWhole";
    const v = convValues(family, mode);
    const [thing, verb, adj] = pick(CONV_WORD_THINGS[famId]);
    const fromUnit = bigFirst ? family.big : family.small;
    const toUnit = bigFirst ? family.small : family.big;
    const tail = adj ? ` ${adj}` : "";
    return {
      kind: "inline",
      wordy: true,
      text: `${thing} ${verb} ${v.from} ${fromUnit}${tail}. How many ${UNIT_NAMES[toUnit]} is that?`,
      unit: toUnit,
      answer: v.answer,
      decimals: v.decimals,
      parSec: decimalMode ? 18 : 14,
    };
  };
}

/* ==========================================================================
   Fractions
   ========================================================================== */

function shadedFractionGen(mode) {
  return () => {
    let d, n;
    if (mode === "unit") {
      d = randInt(2, 8);
      n = 1;
    } else if (mode === "proper") {
      d = randInt(3, 8);
      n = randInt(1, d - 1);
    } else {
      d = pick([6, 8, 9, 10, 12]);
      n = randInt(2, d - 1);
    }
    const [sn, sd] = simplifyFrac(n, d);
    return {
      kind: "inline",
      svg: Math.random() < 0.5 ? pieSvg(d, n) : barSvg(d, n),
      text: "What fraction is shaded?",
      input: "fraction",
      answerNum: sn,
      answerDen: sd,
      parSec: 12,
    };
  };
}

function equivalentFracGen(missingDen) {
  return () => {
    for (let attempt = 0; attempt < 100; attempt++) {
      const d = randInt(2, 6);
      const n = randInt(1, d - 1);
      if (gcd(n, d) !== 1) continue;
      const m = randInt(2, 6);
      if (missingDen) {
        return {
          kind: "inline",
          textHtml: `${fracHtml(n, d)} &nbsp;=&nbsp; ${fracHtml(n * m, "?")}`,
          text: `${n}/${d} = ${n * m}/?`,
          answer: d * m,
          parSec: 15,
        };
      }
      return {
        kind: "inline",
        textHtml: `${fracHtml(n, d)} &nbsp;=&nbsp; ${fracHtml("?", d * m)}`,
        text: `${n}/${d} = ?/${d * m}`,
        answer: n * m,
        parSec: 15,
      };
    }
    return { kind: "inline", text: "1/2 = ?/4", answer: 2, parSec: 15 };
  };
}

function simplifyFracGen(fLo, fHi, dMax) {
  return () => {
    for (let attempt = 0; attempt < 200; attempt++) {
      const d = randInt(2, dMax);
      const n = randInt(1, d - 1);
      if (gcd(n, d) !== 1) continue;
      const f = randInt(fLo, fHi);
      return {
        kind: "inline",
        textHtml: `Simplify &nbsp;${fracHtml(n * f, d * f)}`,
        text: `Simplify ${n * f}/${d * f}`,
        input: "fraction",
        answerNum: n,
        answerDen: d,
        exact: true,
        parSec: 20,
      };
    }
    return { kind: "inline", text: "Simplify 2/4", input: "fraction", answerNum: 1, answerDen: 2, exact: true, parSec: 20 };
  };
}

function fracAddSubGen(mode) {
  return () => {
    for (let attempt = 0; attempt < 500; attempt++) {
      let terms; // [num, den] list, joined by op
      let op = Math.random() < 0.6 ? "+" : "−";
      if (mode === "same") {
        const d = randInt(3, 12);
        const a = randInt(1, d - 1);
        const b = randInt(1, d - 1);
        terms = [[a, d], [b, d]];
      } else if (mode === "related") {
        const d1 = pick([2, 3, 4, 5, 6]);
        const m = randInt(2, 3);
        const d2 = d1 * m;
        if (d2 > 12) continue;
        terms = [[randInt(1, d1 - 1), d1], [randInt(1, d2 - 1), d2]];
      } else if (mode === "unlike") {
        const d1 = randInt(2, 6);
        let d2 = randInt(2, 6);
        if (d1 === d2) continue;
        terms = [[randInt(1, d1 - 1), d1], [randInt(1, d2 - 1), d2]];
      } else {
        // three fractions with small denominators
        op = "+";
        const dens = [pick([2, 3, 4]), pick([3, 4, 6]), pick([6, 12])];
        terms = dens.map((d) => [1, d]);
        if (Math.random() < 0.4) {
          const i = randInt(0, 2);
          terms[i][0] = randInt(1, terms[i][1] - 1);
        }
      }
      // evaluate over common denominator
      const den = terms.reduce((a, t) => (a * t[1]) / gcd(a, t[1]), 1);
      let num = (terms[0][0] * den) / terms[0][1];
      for (let i = 1; i < terms.length; i++) {
        const v = (terms[i][0] * den) / terms[i][1];
        num = op === "+" ? num + v : num - v;
      }
      if (num <= 0 || num >= den) continue;
      const [sn, sd] = simplifyFrac(num, den);
      const sep = ` ${op === "+" ? "+" : "−"} `;
      return {
        kind: "inline",
        textHtml: terms.map((t) => fracHtml(t[0], t[1])).join(`&nbsp;${op}&nbsp;`) + " =",
        text: terms.map((t) => `${t[0]}/${t[1]}`).join(sep) + " =",
        input: "fraction",
        answerNum: sn,
        answerDen: sd,
        parSec: mode === "same" ? 18 : mode === "three" ? 35 : 25,
      };
    }
    return { kind: "inline", text: "1/4 + 1/4 =", input: "fraction", answerNum: 1, answerDen: 2, parSec: 18 };
  };
}

function decToFracGen(mode) {
  return () => {
    if (mode === "tenths") {
      const k = randInt(1, 9);
      const [sn, sd] = simplifyFrac(k, 10);
      return {
        kind: "inline",
        text: `Convert 0.${k} to a fraction`,
        input: "fraction",
        answerNum: sn,
        answerDen: sd,
        parSec: 15,
      };
    }
    if (mode === "hundredths") {
      let k;
      do {
        k = randInt(1, 99);
      } while (k % 10 === 0);
      const [sn, sd] = simplifyFrac(k, 100);
      return {
        kind: "inline",
        text: `Convert 0.${String(k).padStart(2, "0")} to a fraction`,
        input: "fraction",
        answerNum: sn,
        answerDen: sd,
        parSec: 20,
      };
    }
    // mixed: w.k -> mixed fraction
    const w = randInt(1, 9);
    const k = randInt(1, 9);
    const [sn, sd] = simplifyFrac(k, 10);
    return {
      kind: "inline",
      text: `Convert ${w}.${k} to a mixed fraction`,
      input: "mixed",
      answerWhole: w,
      answerNum: sn,
      answerDen: sd,
      parSec: 22,
    };
  };
}

function fracOfNumberGen(mode) {
  return () => {
    const d = randInt(2, 12);
    const q = randInt(2, 12);
    const m = d * q;
    if (mode === "unit") {
      return {
        kind: "inline",
        textHtml: `What is ${fracHtml(1, d)} of ${m}?`,
        text: `What is 1/${d} of ${m}?`,
        answer: q,
        parSec: 15,
      };
    }
    const n = randInt(2, Math.max(2, d - 1));
    if (mode === "proper") {
      return {
        kind: "inline",
        textHtml: `What is ${fracHtml(n, d)} of ${m}?`,
        text: `What is ${n}/${d} of ${m}?`,
        answer: n * q,
        parSec: 20,
      };
    }
    return {
      kind: "inline",
      textHtml: `Simplify &nbsp;${m} × ${fracHtml(n, d)}`,
      text: `Simplify ${m} × ${n}/${d}`,
      answer: n * q,
      parSec: 22,
    };
  };
}

function improperMixedGen(toMixed) {
  return () => {
    const d = randInt(2, 9);
    const w = randInt(1, 5);
    const r = randInt(1, d - 1);
    if (toMixed) {
      return {
        kind: "inline",
        textHtml: `Write ${fracHtml(w * d + r, d)} as a mixed number`,
        text: `Write ${w * d + r}/${d} as a mixed number`,
        input: "mixed",
        answerWhole: w,
        answerNum: r,
        answerDen: d,
        parSec: 20,
      };
    }
    return {
      kind: "inline",
      textHtml: `Write ${w} ${fracHtml(r, d)} as an improper fraction`,
      text: `Write ${w} ${r}/${d} as an improper fraction`,
      input: "fraction",
      answerNum: w * d + r,
      answerDen: d,
      parSec: 20,
    };
  };
}

/* ==========================================================================
   Decimals
   ========================================================================== */

const PLACE_NAMES = ["ones", "tenths", "hundredths", "thousandths"];

function placeValueGen(maxDp) {
  return () => {
    for (let attempt = 0; attempt < 200; attempt++) {
      const dp = randInt(1, maxDp);
      const digits = [randInt(1, 9)];
      for (let i = 0; i < dp; i++) digits.push(randInt(0, 9));
      const pos = randInt(0, dp);
      const digit = digits[pos];
      if (digit === 0) continue;
      if (digits.filter((x) => x === digit).length > 1) continue;
      const numberStr = `${digits[0]}.${digits.slice(1).join("")}`;
      const correct = `${digit} ${PLACE_NAMES[pos]}`;
      const distractors = PLACE_NAMES.filter((_, i) => i !== pos && i <= 3)
        .slice(0, 3)
        .map((p) => `${digit} ${p}`);
      return {
        kind: "inline",
        text: `In ${numberStr}, what is the value of the digit ${digit}?`,
        wordy: true,
        input: "mcq",
        options: mcqOptions(correct, distractors),
        answerLabel: correct,
        parSec: 12,
      };
    }
    return {
      kind: "inline", text: "In 3.7, what is the value of the digit 7?", wordy: true,
      input: "mcq", options: mcqOptions("7 tenths", ["7 ones", "7 hundredths", "7 thousandths"]),
      answerLabel: "7 tenths", parSec: 12,
    };
  };
}

function buildNumberGen() {
  const w = randInt(1, 9);
  const t = randInt(1, 9);
  const h = randInt(1, 9);
  const useTh = Math.random() < 0.4;
  const parts = [`${w}`, `0.${t}`, `0.0${h}`];
  let answer = w + t / 10 + h / 100;
  if (useTh) {
    const th = randInt(1, 9);
    parts.push(`0.00${th}`);
    answer += th / 1000;
  }
  answer = Math.round(answer * 1000) / 1000;
  return {
    kind: "inline",
    text: `What number is ${parts.join(" + ")}?`,
    wordy: true,
    answer,
    decimals: true,
    parSec: 15,
  };
}

function decAddSubGen(mode) {
  return () => {
    for (let attempt = 0; attempt < 200; attempt++) {
      let scaled, scale;
      if (mode === "1dp") {
        scale = 10;
        scaled = [randInt(11, 999), randInt(11, 999)];
      } else if (mode === "2dp") {
        scale = 100;
        scaled = [randInt(101, 9999), randInt(101, 9999)];
      } else if (mode === "mixed2") {
        scale = 100;
        scaled = [randInt(101, 9999), randInt(1, 99) * 10];
      } else {
        // e.g. 12.23 + 6.2 + 0.057 (2 dp, 1 dp, 3 dp)
        scale = 1000;
        scaled = [randInt(101, 9999) * 10, randInt(1, 999) * 100, randInt(1, 999)];
      }
      const isAdd = mode === "3nums" ? true : Math.random() < 0.6;
      let totalScaled;
      if (isAdd) {
        totalScaled = scaled.reduce((a, b) => a + b, 0);
      } else {
        if (scaled[0] <= scaled[1]) continue;
        totalScaled = scaled[0] - scaled[1];
      }
      const nums = scaled.map((s) => s / scale);
      if (nums.some((n) => Number.isInteger(n))) continue;
      return {
        kind: "inline",
        text: nums.join(isAdd ? " + " : " − ") + " =",
        answer: totalScaled / scale,
        decimals: true,
        parSec: mode === "3nums" ? 40 : 25,
      };
    }
    return { kind: "inline", text: "1.2 + 3.4 =", answer: 4.6, decimals: true, parSec: 25 };
  };
}

function pow10Gen(isDivide) {
  return () => {
    const f = pick([10, 100, 1000]);
    const s = randInt(11, 9999);
    const v = s / 10; // 1 dp value (or whole if s ends in 0)
    let answer;
    if (isDivide) {
      answer = Math.round((v / f) * 100000) / 100000;
    } else {
      answer = Math.round(v * f * 100) / 100;
    }
    return {
      kind: "inline",
      text: `${v} ${isDivide ? "÷" : "×"} ${f} =`,
      answer,
      decimals: true,
      parSec: 12,
    };
  };
}

function decMulGen(dp) {
  return () => {
    for (let attempt = 0; attempt < 100; attempt++) {
      const scale = dp === 1 ? 10 : 100;
      const s = randInt(scale + 1, scale * 10 - 1);
      if (s % scale === 0) continue;
      const b = randInt(2, 9);
      return {
        kind: "inline",
        text: `${s / scale} × ${b} =`,
        answer: (s * b) / scale,
        decimals: true,
        parSec: dp === 1 ? 20 : 30,
      };
    }
    return { kind: "inline", text: "3.2 × 4 =", answer: 12.8, decimals: true, parSec: 20 };
  };
}

function fracToDecGen(easy) {
  return () => {
    const dens = easy ? [2, 4, 5, 10] : [20, 25, 50, 100];
    for (let attempt = 0; attempt < 100; attempt++) {
      const d = pick(dens);
      const n = randInt(1, d - 1);
      if (gcd(n, d) !== 1) continue;
      return {
        kind: "inline",
        textHtml: `Convert ${fracHtml(n, d)} to a decimal`,
        text: `Convert ${n}/${d} to a decimal`,
        answer: n / d,
        decimals: true,
        parSec: easy ? 15 : 22,
      };
    }
    return { kind: "inline", text: "Convert 3/4 to a decimal", answer: 0.75, decimals: true, parSec: 15 };
  };
}

function decToMixedGen() {
  const w = randInt(1, 12);
  const k = randInt(1, 9);
  const [sn, sd] = simplifyFrac(k, 10);
  return {
    kind: "inline",
    text: `Write ${w}.${k} as a mixed fraction`,
    input: "mixed",
    answerWhole: w,
    answerNum: sn,
    answerDen: sd,
    parSec: 22,
  };
}

/* ==========================================================================
   2D Shapes
   ========================================================================== */

function name2DGen(names) {
  return () => {
    const name = pick(names);
    const distractors = shuffle(names.filter((n) => n !== name)).slice(0, 3);
    return {
      kind: "inline",
      svg: SHAPES_2D[name](),
      text: "Name this 2D shape",
      input: "mcq",
      options: mcqOptions(SHAPE_NAMES[name], distractors.map((n) => SHAPE_NAMES[n])),
      answerLabel: SHAPE_NAMES[name],
      parSec: 10,
    };
  };
}

function perimeterGen(mode) {
  return () => {
    if (mode === "rect") {
      if (Math.random() < 0.35) {
        const a = randInt(2, 12);
        return {
          kind: "inline", svg: rectLabelledSvg(a, a, { square: true }),
          text: "Find the perimeter of this square", unit: "cm", answer: 4 * a, parSec: 15,
        };
      }
      const w = randInt(3, 15);
      const h = randInt(2, w - 1);
      return {
        kind: "inline", svg: rectLabelledSvg(w, h),
        text: "Find the perimeter of this rectangle", unit: "cm", answer: 2 * (w + h), parSec: 15,
      };
    }
    if (mode === "sides") {
      if (Math.random() < 0.5) {
        const sides = [randInt(4, 12), randInt(4, 12), randInt(4, 12)];
        return {
          kind: "inline",
          svg: triLabelledSvg(sides.map((s) => `${s} cm`), false),
          text: "Find the perimeter of this triangle", unit: "cm",
          answer: sides.reduce((a, b) => a + b, 0), parSec: 18,
        };
      }
      const sides = [randInt(4, 12), randInt(4, 12), randInt(4, 12), randInt(4, 12)];
      return {
        kind: "inline", svg: quadLabelledSvg(sides),
        text: "Find the perimeter of this shape", unit: "cm",
        answer: sides.reduce((a, b) => a + b, 0), parSec: 20,
      };
    }
    if (mode === "regular") {
      const n = pick([5, 6, 8]);
      const s = randInt(3, 12);
      const name = { 5: "pentagon", 6: "hexagon", 8: "octagon" }[n];
      return {
        kind: "inline",
        svg: SHAPES_2D[name](),
        text: `This is a regular ${name}. Each side is ${s} cm. Find the perimeter.`,
        wordy: true, unit: "cm", answer: n * s, parSec: 18,
      };
    }
    // missing side
    const w = randInt(3, 15);
    const h = randInt(2, w - 1);
    return {
      kind: "inline",
      svg: rectLabelledSvg(w, h, { hideWidth: true }),
      text: `The perimeter of this rectangle is ${2 * (w + h)} cm. Find the missing side.`,
      wordy: true, unit: "cm", answer: w, parSec: 25,
    };
  };
}

function areaGen(mode) {
  return () => {
    if (mode === "rect") {
      const w = randInt(3, 12);
      const h = randInt(2, 12);
      return {
        kind: "inline", svg: rectLabelledSvg(w, h),
        text: "Find the area of this rectangle", unit: "cm²", answer: w * h, parSec: 15,
      };
    }
    if (mode === "triangle") {
      const b = randInt(2, 10) * 2;
      const h = randInt(3, 12);
      return {
        kind: "inline", svg: triLabelledSvg([`${b} cm`, `${h} cm`], true),
        text: "Find the area of this triangle", unit: "cm²", answer: (b * h) / 2, parSec: 22,
      };
    }
    if (mode === "parallelogram") {
      const b = randInt(4, 14);
      const h = randInt(3, 10);
      return {
        kind: "inline", svg: parallelogramLabelledSvg(b, h),
        text: "Find the area of this parallelogram", unit: "cm²", answer: b * h, parSec: 22,
      };
    }
    // composite L-shape
    const W = randInt(8, 14);
    const H = randInt(6, 12);
    const w = randInt(3, W - 4);
    const h = randInt(2, H - 3);
    return {
      kind: "inline", svg: lShapeSvg(W, H, w, h),
      text: "Find the area of this shape", unit: "cm²", answer: W * H - w * h, parSec: 40,
    };
  };
}

const ANGLE_TYPES = {
  Acute: () => randInt(15, 80),
  Right: () => 90,
  Obtuse: () => randInt(100, 170),
  Straight: () => 180,
  Reflex: () => randInt(195, 340),
};

function angleTypeGen(typeNames) {
  return () => {
    const name = pick(typeNames);
    const deg = ANGLE_TYPES[name]();
    return {
      kind: "inline",
      svg: angleSvg(deg),
      text: "What type of angle is this?",
      input: "mcq",
      options: mcqOptions(name, shuffle(typeNames.filter((t) => t !== name)).slice(0, 3)),
      answerLabel: name,
      parSec: 10,
    };
  };
}

function missingAngleGen(mode) {
  return () => {
    if (mode === "line") {
      const a = randInt(25, 155);
      return {
        kind: "inline", svg: lineAngleSvg(a),
        text: "Find the missing angle x", unit: "°", answer: 180 - a, parSec: 15,
      };
    }
    if (mode === "point") {
      const a = randInt(70, 150);
      const b = randInt(70, 150);
      return {
        kind: "inline", svg: pointAngleSvg(a, b),
        text: "Angles at a point add to 360°. Find x.", wordy: true, unit: "°",
        answer: 360 - a - b, parSec: 20,
      };
    }
    if (mode === "vert") {
      const a = randInt(35, 145);
      return {
        kind: "inline", svg: vertOppSvg(a),
        text: "Find the missing angle x", unit: "°", answer: a, parSec: 12,
      };
    }
    if (mode === "triangle") {
      const A = randInt(30, 100);
      const B = randInt(30, Math.min(100, 150 - A));
      return {
        kind: "inline", svg: triAngleSvg(A, B),
        text: "Angles in a triangle add to 180°. Find x.", wordy: true, unit: "°",
        answer: 180 - A - B, parSec: 20,
      };
    }
    // quadrilateral
    for (let attempt = 0; attempt < 100; attempt++) {
      const a = randInt(60, 130);
      const b = randInt(60, 130);
      const c = randInt(60, 130);
      const x = 360 - a - b - c;
      if (x < 40 || x > 160) continue;
      return {
        kind: "inline", svg: quadAngleSvg(a, b, c),
        text: "Angles in a quadrilateral add to 360°. Find x.", wordy: true, unit: "°",
        answer: x, parSec: 25,
      };
    }
    return { kind: "inline", svg: quadAngleSvg(90, 90, 90), text: "Find x", unit: "°", answer: 90, parSec: 25 };
  };
}

function classifyTriangleGen(byAngles) {
  return () => {
    if (byAngles) {
      const type = pick(["right", "acute", "obtuse"]);
      const { svg, label } = classifyTriangleByAnglesSvg(type);
      const all = ["Right-angled", "Acute-angled", "Obtuse-angled"];
      return {
        kind: "inline", svg, text: "Classify this triangle by its angles",
        input: "mcq", options: mcqOptions(label, all.filter((l) => l !== label)),
        answerLabel: label, parSec: 12,
      };
    }
    const type = pick(["equilateral", "isosceles", "scalene"]);
    const { svg, label } = classifyTriangleSvg(type);
    const all = ["Equilateral", "Isosceles", "Scalene"];
    return {
      kind: "inline", svg, text: "Classify this triangle by its sides",
      input: "mcq", options: mcqOptions(label, all.filter((l) => l !== label)),
      answerLabel: label, parSec: 12,
    };
  };
}

/* ==========================================================================
   3D Shapes
   ========================================================================== */

function name3DGen(names) {
  return () => {
    const name = pick(names);
    const distractors = shuffle(names.filter((n) => n !== name)).slice(0, 3);
    return {
      kind: "inline",
      svg: SHAPES_3D[name](),
      text: "Name this 3D shape",
      input: "mcq",
      options: mcqOptions(SOLID_NAMES[name], distractors.map((n) => SOLID_NAMES[n])),
      answerLabel: SOLID_NAMES[name],
      parSec: 10,
    };
  };
}

function makeHeights(mode) {
  if (mode === "flat") {
    // an L of single cubes, all visible
    const a = randInt(2, 4);
    const b = randInt(1, 3);
    const heights = [];
    heights.push(Array(a).fill(1));
    for (let j = 0; j < b; j++) heights.push([1, ...Array(a - 1).fill(0)]);
    return heights;
  }
  if (mode === "cuboid") {
    const a = randInt(2, 3);
    const b = randInt(2, 3);
    const c = randInt(2, 3);
    return Array.from({ length: b }, () => Array(a).fill(c));
  }
  // staircase: heights decrease toward the front-right so nothing floats
  const rows = randInt(2, 3);
  const cols = randInt(2, 3);
  const heights = [];
  for (let j = 0; j < rows; j++) {
    const row = [];
    for (let i = 0; i < cols; i++) {
      row.push(randInt(1, 3));
    }
    heights.push(row);
  }
  // enforce monotone: heights[j][i] >= heights[j'][i] for j' > j (front rows lower)
  for (let i = 0; i < cols; i++) {
    for (let j = 1; j < rows; j++) {
      heights[j][i] = Math.min(heights[j][i], heights[j - 1][i]);
    }
  }
  return heights;
}

function countCubesGen(mode) {
  return () => {
    const heights = makeHeights(mode);
    return {
      kind: "inline",
      svg: isoCubesSvg(heights),
      text: "How many cubes are in this solid?",
      answer: countCubes(heights),
      parSec: mode === "flat" ? 12 : 25,
    };
  };
}

function fevGen(which) {
  return () => {
    const name = pick(Object.keys(SOLID_FEV));
    const label = { f: "faces", e: "edges", v: "vertices" }[which];
    return {
      kind: "inline",
      svg: SHAPES_3D[name](),
      text: `How many ${label} does a ${name} have?`,
      wordy: true,
      answer: SOLID_FEV[name][which],
      parSec: 15,
    };
  };
}

function volumeGen(mode) {
  return () => {
    if (mode === "cubes") {
      const heights = makeHeights("cuboid");
      return {
        kind: "inline",
        svg: isoCubesSvg(heights),
        text: "Each cube is 1 cm³. What is the volume of this solid?",
        wordy: true, unit: "cm³", answer: countCubes(heights), parSec: 25,
      };
    }
    if (mode === "dims") {
      const l = randInt(2, 10);
      const w = randInt(2, 8);
      const h = randInt(2, 6);
      return {
        kind: "inline",
        svg: boxSvg(110, 70, [`${l} cm`, `${w} cm`, `${h} cm`]),
        text: "Find the volume of this rectangular prism", unit: "cm³",
        answer: l * w * h, parSec: 25,
      };
    }
    // missing dimension
    const l = randInt(2, 10);
    const w = randInt(2, 8);
    const h = randInt(2, 6);
    return {
      kind: "inline",
      text: `A rectangular prism has volume ${l * w * h} cm³. Its length is ${l} cm and its width is ${w} cm. What is its height?`,
      wordy: true, unit: "cm", answer: h, parSec: 35,
    };
  };
}

function netMatchGen() {
  const names = Object.keys(NETS);
  const name = pick(names);
  const distractors = shuffle(names.filter((n) => n !== name)).slice(0, 3);
  return {
    kind: "inline",
    svg: NETS[name](),
    text: "Which 3D shape does this net fold into?",
    input: "mcq",
    options: mcqOptions(SOLID_NAMES[name] || name, distractors.map((n) => SOLID_NAMES[n] || n)),
    answerLabel: SOLID_NAMES[name] || name,
    parSec: 15,
  };
}

function netPickGen() {
  const names = Object.keys(NETS);
  const name = pick(names);
  const distractors = shuffle(names.filter((n) => n !== name)).slice(0, 3);
  const wrap = (n) => `<div class="mcq-svg">${NETS[n]()}</div>`;
  return {
    kind: "inline",
    svg: SHAPES_3D[name] ? SHAPES_3D[name]() : undefined,
    text: `Which of these is the net of a ${name}?`,
    wordy: true,
    input: "mcq",
    options: mcqOptions(wrap(name), distractors.map(wrap)),
    answerLabel: `the ${name} net`,
    parSec: 20,
  };
}

function surfaceAreaGen(cubeOnly) {
  return () => {
    if (cubeOnly) {
      const a = randInt(2, 9);
      return {
        kind: "inline",
        svg: boxSvg(95, 95, [`${a} cm`, `${a} cm`, `${a} cm`]),
        text: "Find the surface area of this cube",
        unit: "cm²", answer: 6 * a * a, parSec: 30,
      };
    }
    const l = randInt(2, 8);
    const w = randInt(2, 6);
    const h = randInt(2, 6);
    return {
      kind: "inline",
      svg: boxSvg(120, 70, [`${l} cm`, `${w} cm`, `${h} cm`]),
      text: "Find the surface area of this rectangular prism",
      unit: "cm²", answer: 2 * (l * w + l * h + w * h), parSec: 50,
    };
  };
}

/* ==========================================================================
   Chance
   ========================================================================== */

const CHANCE_WORDS = ["Impossible", "Unlikely", "Even chance", "Likely", "Certain"];

function chanceWordsGen() {
  const target = pick(CHANCE_WORDS);
  let red, total;
  if (target === "Impossible") { red = 0; total = randInt(4, 8); }
  else if (target === "Certain") { total = randInt(4, 8); red = total; }
  else if (target === "Even chance") { red = randInt(2, 4); total = red * 2; }
  else if (target === "Unlikely") { total = pick([5, 7, 8, 9]); red = randInt(1, Math.ceil(total / 2) - 1); }
  else { total = pick([5, 7, 8, 9]); red = randInt(Math.floor(total / 2) + 1, total - 1); }
  return {
    kind: "inline",
    svg: jarSvg(red, total - red),
    text: "You pick one marble without looking. What is the chance it is red?",
    wordy: true,
    input: "mcq",
    options: mcqOptions(target, shuffle(CHANCE_WORDS.filter((w) => w !== target)).slice(0, 3)),
    answerLabel: target,
    parSec: 15,
  };
}

function probSpinnerGen() {
  const n = randInt(3, 8);
  const k = randInt(1, n - 1);
  const [sn, sd] = simplifyFrac(k, n);
  return {
    kind: "inline",
    svg: spinnerSvg(n, k),
    text: "What is the probability the spinner lands on blue?",
    wordy: true,
    input: "fraction",
    answerNum: sn,
    answerDen: sd,
    parSec: 15,
  };
}

function probJarGen() {
  const total = randInt(4, 10);
  const red = randInt(1, total - 1);
  const [sn, sd] = simplifyFrac(red, total);
  return {
    kind: "inline",
    svg: jarSvg(red, total - red),
    text: "You pick one marble without looking. What is the probability it is red?",
    wordy: true,
    input: "fraction",
    answerNum: sn,
    answerDen: sd,
    parSec: 15,
  };
}

const DICE_EVENTS = [
  { text: "rolling a 3", n: 1, face: 3 },
  { text: "rolling a 6", n: 1, face: 6 },
  { text: "rolling an even number", n: 3 },
  { text: "rolling an odd number", n: 3 },
  { text: "rolling a number greater than 4", n: 2 },
  { text: "rolling a number less than 3", n: 2 },
  { text: "rolling a number greater than 1", n: 5 },
];

function probDiceGen() {
  const ev = pick(DICE_EVENTS);
  const [sn, sd] = simplifyFrac(ev.n, 6);
  return {
    kind: "inline",
    svg: ev.face ? dieSvg(ev.face) : dieSvg(5),
    text: `You roll a normal six-sided die. What is the probability of ${ev.text}?`,
    wordy: true,
    input: "fraction",
    answerNum: sn,
    answerDen: sd,
    parSec: 18,
  };
}

function probDecimalGen() {
  const choices = [
    { text: "You flip a coin. What is the probability of heads, as a decimal?", answer: 0.5 },
  ];
  const n = pick([2, 4, 5, 10]);
  const k = randInt(1, n - 1);
  const spinner = {
    svg: spinnerSvg(n, k),
    text: "What is the probability the spinner lands on blue, as a decimal?",
    answer: k / n,
  };
  const chosen = Math.random() < 0.25 ? choices[0] : spinner;
  return {
    kind: "inline",
    svg: chosen.svg,
    text: chosen.text,
    wordy: true,
    answer: chosen.answer,
    decimals: true,
    parSec: 18,
  };
}

function probPercentGen() {
  const n = pick([2, 4, 5, 10, 20, 25]);
  const k = randInt(1, n - 1);
  const useJar = n <= 10;
  return {
    kind: "inline",
    svg: useJar ? jarSvg(k, n - k) : undefined,
    text: useJar
      ? "You pick one marble without looking. What is the probability it is red, as a percentage?"
      : `A bag has ${n} tickets and ${k} of them win a prize. What is the probability of winning, as a percentage?`,
    wordy: true,
    unit: "%",
    answer: Math.round((k / n) * 100),
    parSec: 20,
  };
}

const PROB_WORD_TEMPLATES = [
  () => {
    const N = pick([8, 10, 12, 20]);
    const even = N / 2;
    const [sn, sd] = simplifyFrac(even, N);
    return { text: `Cards numbered 1 to ${N} are shuffled. You pick one card. What is the probability it is an even number?`, n: sn, d: sd };
  },
  () => {
    const N = pick([10, 12, 20]);
    const x = randInt(3, N - 2);
    const count = N - x;
    const [sn, sd] = simplifyFrac(count, N);
    return { text: `Cards numbered 1 to ${N} are shuffled. You pick one card. What is the probability it is greater than ${x}?`, n: sn, d: sd };
  },
  () => {
    const red = randInt(2, 6);
    const green = randInt(2, 6);
    const yellow = randInt(1, 4);
    const total = red + green + yellow;
    const [sn, sd] = simplifyFrac(red, total);
    return { text: `A jar has ${red} red, ${green} green and ${yellow} yellow jelly beans. You pick one without looking. What is the probability it is red?`, n: sn, d: sd };
  },
  () => {
    const red = randInt(2, 6);
    const green = randInt(2, 6);
    const yellow = randInt(1, 4);
    const total = red + green + yellow;
    const [sn, sd] = simplifyFrac(green + yellow, total);
    return { text: `A jar has ${red} red, ${green} green and ${yellow} yellow jelly beans. You pick one without looking. What is the probability it is NOT red?`, n: sn, d: sd };
  },
  () => {
    const word = pick(["MATHS", "CHANCE", "NUMBER", "SHAPES"]);
    const vowels = word.split("").filter((c) => "AEIOU".includes(c)).length;
    const [sn, sd] = simplifyFrac(vowels, word.length);
    return { text: `The letters of the word ${word} are put in a hat. You pick one letter. What is the probability it is a vowel?`, n: sn, d: sd };
  },
];

function probWordedGen() {
  const t = pick(PROB_WORD_TEMPLATES)();
  return {
    kind: "inline",
    text: t.text,
    wordy: true,
    input: "fraction",
    answerNum: t.n,
    answerDen: t.d,
    parSec: 25,
  };
}

/* ==========================================================================
   Topic tree
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
    subtopics: {
      ...Object.fromEntries(
        Object.entries(FAMILIES).map(([id, family]) => [
          id,
          {
            name: family.name,
            desc: `1 ${family.big} = ${family.factor} ${family.small}`,
            levels: convLevels(family),
          },
        ])
      ),
      worded: {
        name: "Worded Conversions",
        desc: "Real-life conversions across all units",
        levels: [
          { id: "l1", name: "Whole numbers", gen: convWordGen(false) },
          { id: "l2", name: "With decimals", gen: convWordGen(true) },
        ],
      },
    },
  },
  fractions: {
    name: "Fractions",
    icon: "½",
    color: "linear-gradient(135deg, #fb7185, #be123c)",
    subtopics: {
      shaded: {
        name: "What Fraction is Shaded?",
        desc: "Read fractions from pictures",
        levels: [
          { id: "l1", name: "Unit fractions (1 part shaded)", gen: shadedFractionGen("unit") },
          { id: "l2", name: "Several parts shaded", gen: shadedFractionGen("proper") },
          { id: "l3", name: "Bigger denominators", gen: shadedFractionGen("hard") },
        ],
      },
      equivalent: {
        name: "Equivalent Fractions",
        desc: "Fill in the missing number",
        levels: [
          { id: "l1", name: "Missing numerator", gen: equivalentFracGen(false) },
          { id: "l2", name: "Missing denominator", gen: equivalentFracGen(true) },
        ],
      },
      simplify: {
        name: "Simplifying Fractions",
        desc: "Write fractions in simplest form",
        levels: [
          { id: "l1", name: "Halve it (factor of 2)", gen: simplifyFracGen(2, 2, 6) },
          { id: "l2", name: "Factors up to 5", gen: simplifyFracGen(2, 5, 9) },
          { id: "l3", name: "Factors up to 12", gen: simplifyFracGen(2, 12, 12) },
        ],
      },
      addsub: {
        name: "Adding & Subtracting Fractions",
        desc: "Same, related and unlike denominators",
        levels: [
          { id: "l1", name: "Same denominator", gen: fracAddSubGen("same") },
          { id: "l2", name: "Related denominators", gen: fracAddSubGen("related") },
          { id: "l3", name: "Unlike denominators", gen: fracAddSubGen("unlike") },
          { id: "l4", name: "Three fractions", gen: fracAddSubGen("three") },
        ],
      },
      fromdec: {
        name: "Decimals → Fractions",
        desc: "Convert decimals to fractions",
        levels: [
          { id: "l1", name: "Tenths (0.8)", gen: decToFracGen("tenths") },
          { id: "l2", name: "Hundredths (0.35)", gen: decToFracGen("hundredths") },
          { id: "l3", name: "Mixed fractions (4.3)", gen: decToFracGen("mixedNum") },
        ],
      },
      ofnumber: {
        name: "Fraction of a Number",
        desc: "e.g. two thirds of 24",
        levels: [
          { id: "l1", name: "Unit fractions (1/3 of 24)", gen: fracOfNumberGen("unit") },
          { id: "l2", name: "Any fraction (2/3 of 24)", gen: fracOfNumberGen("proper") },
          { id: "l3", name: "Written as 24 × 2/3", gen: fracOfNumberGen("times") },
        ],
      },
      mixednum: {
        name: "Improper & Mixed Numbers",
        desc: "Convert between 7/3 and 2 1/3",
        levels: [
          { id: "l1", name: "Improper → mixed", gen: improperMixedGen(true) },
          { id: "l2", name: "Mixed → improper", gen: improperMixedGen(false) },
        ],
      },
    },
  },
  decimals: {
    name: "Decimals",
    icon: "0.5",
    iconSmall: true,
    color: "linear-gradient(135deg, #a78bfa, #6d28d9)",
    subtopics: {
      placevalue: {
        name: "Decimal Place Value",
        desc: "Tenths, hundredths and thousandths",
        levels: [
          { id: "l1", name: "Tenths & hundredths", gen: placeValueGen(2) },
          { id: "l2", name: "Up to thousandths", gen: placeValueGen(3) },
          { id: "l3", name: "Build the number", gen: buildNumberGen },
        ],
      },
      addsub: {
        name: "Adding & Subtracting Decimals",
        desc: "Line up those decimal points!",
        levels: [
          { id: "l1", name: "1 decimal place", gen: decAddSubGen("1dp") },
          { id: "l2", name: "2 decimal places", gen: decAddSubGen("2dp") },
          { id: "l3", name: "Different decimal places", gen: decAddSubGen("mixed2") },
          { id: "l4", name: "Three numbers (like 12.23 + 6.2 + 0.057)", gen: decAddSubGen("3nums") },
        ],
      },
      pow10: {
        name: "× and ÷ by 10, 100, 1000",
        desc: "Shift the decimal point",
        levels: [
          { id: "l1", name: "Multiplying", gen: pow10Gen(false) },
          { id: "l2", name: "Dividing", gen: pow10Gen(true) },
        ],
      },
      mul: {
        name: "Multiplying Decimals",
        desc: "Decimal × whole number",
        levels: [
          { id: "l1", name: "1 decimal place (3.2 × 4)", gen: decMulGen(1) },
          { id: "l2", name: "2 decimal places (1.25 × 6)", gen: decMulGen(2) },
        ],
      },
      todec: {
        name: "Fractions → Decimals",
        desc: "Convert fractions to decimals",
        levels: [
          { id: "l1", name: "Halves, quarters, fifths, tenths", gen: fracToDecGen(true) },
          { id: "l2", name: "20ths, 25ths, 50ths, 100ths", gen: fracToDecGen(false) },
          { id: "l3", name: "Decimals → mixed fractions (8.3)", gen: decToMixedGen },
        ],
      },
    },
  },
  shapes2d: {
    name: "2D Shapes",
    icon: "📐",
    color: "linear-gradient(135deg, #38bdf8, #0284c7)",
    subtopics: {
      name: {
        name: "Name the 2D Shape",
        desc: "Triangles to decagons",
        levels: [
          { id: "l1", name: "Common shapes", gen: name2DGen(["triangle", "square", "rectangle", "circle", "pentagon", "hexagon"]) },
          { id: "l2", name: "Special quadrilaterals", gen: name2DGen(["square", "rectangle", "rhombus", "parallelogram", "trapezium", "kite"]) },
          { id: "l3", name: "Many-sided shapes", gen: name2DGen(["pentagon", "hexagon", "heptagon", "octagon", "nonagon", "decagon"]) },
        ],
      },
      perimeter: {
        name: "Perimeter",
        desc: "Distance around the outside",
        levels: [
          { id: "l1", name: "Squares & rectangles", gen: perimeterGen("rect") },
          { id: "l2", name: "Triangles & quadrilaterals", gen: perimeterGen("sides") },
          { id: "l3", name: "Regular polygons", gen: perimeterGen("regular") },
          { id: "l4", name: "Find the missing side", gen: perimeterGen("missing") },
        ],
      },
      area: {
        name: "Area",
        desc: "Space inside a shape",
        levels: [
          { id: "l1", name: "Squares & rectangles", gen: areaGen("rect") },
          { id: "l2", name: "Triangles", gen: areaGen("triangle") },
          { id: "l3", name: "Parallelograms", gen: areaGen("parallelogram") },
          { id: "l4", name: "Composite shapes", gen: areaGen("composite") },
        ],
      },
      angletypes: {
        name: "Types of Angles",
        desc: "Acute, right, obtuse, straight, reflex",
        levels: [
          { id: "l1", name: "Acute, right, obtuse", gen: angleTypeGen(["Acute", "Right", "Obtuse"]) },
          { id: "l2", name: "All five types", gen: angleTypeGen(["Acute", "Right", "Obtuse", "Straight", "Reflex"]) },
        ],
      },
      missingangles: {
        name: "Missing Angles",
        desc: "Use angle rules to find x",
        levels: [
          { id: "l1", name: "Angles on a straight line", gen: missingAngleGen("line") },
          { id: "l2", name: "Vertically opposite angles", gen: missingAngleGen("vert") },
          { id: "l3", name: "Angles at a point", gen: missingAngleGen("point") },
          { id: "l4", name: "Angles in a triangle", gen: missingAngleGen("triangle") },
          { id: "l5", name: "Angles in a quadrilateral", gen: missingAngleGen("quad") },
        ],
      },
      classify: {
        name: "Classify the Triangle",
        desc: "By sides and by angles",
        levels: [
          { id: "l1", name: "By sides (equilateral, isosceles, scalene)", gen: classifyTriangleGen(false) },
          { id: "l2", name: "By angles (right, acute, obtuse)", gen: classifyTriangleGen(true) },
        ],
      },
    },
  },
  shapes3d: {
    name: "3D Shapes",
    icon: "🧊",
    color: "linear-gradient(135deg, #94a3b8, #334155)",
    subtopics: {
      name: {
        name: "Name the 3D Shape",
        desc: "Prisms, pyramids and curved solids",
        levels: [
          { id: "l1", name: "Curved solids & cubes", gen: name3DGen(["cube", "sphere", "cylinder", "cone"]) },
          { id: "l2", name: "Prisms & pyramids", gen: name3DGen(["cube", "rectangular prism", "triangular prism", "square pyramid", "triangular pyramid"]) },
        ],
      },
      cubes: {
        name: "Count the Cubes",
        desc: "How many cubes build the solid?",
        levels: [
          { id: "l1", name: "One layer", gen: countCubesGen("flat") },
          { id: "l2", name: "Solid blocks", gen: countCubesGen("cuboid") },
          { id: "l3", name: "Steps & stacks", gen: countCubesGen("stairs") },
        ],
      },
      fev: {
        name: "Faces, Edges & Vertices",
        desc: "Count the parts of a solid",
        levels: [
          { id: "l1", name: "Faces", gen: fevGen("f") },
          { id: "l2", name: "Vertices (corners)", gen: fevGen("v") },
          { id: "l3", name: "Edges", gen: fevGen("e") },
        ],
      },
      volume: {
        name: "Volume",
        desc: "Space inside a rectangular prism",
        levels: [
          { id: "l1", name: "Count the cubes (1 cm³ each)", gen: volumeGen("cubes") },
          { id: "l2", name: "Length × width × height", gen: volumeGen("dims") },
          { id: "l3", name: "Find the missing dimension", gen: volumeGen("missing") },
        ],
      },
      nets: {
        name: "Match the Nets",
        desc: "Fold flat shapes into solids",
        levels: [
          { id: "l1", name: "Which solid does this net make?", gen: netMatchGen },
          { id: "l2", name: "Pick the correct net", gen: netPickGen },
        ],
      },
      surface: {
        name: "Surface Area",
        desc: "Total area of all the faces",
        levels: [
          { id: "l1", name: "Cubes", gen: surfaceAreaGen(true) },
          { id: "l2", name: "Rectangular prisms", gen: surfaceAreaGen(false) },
        ],
      },
    },
  },
  chance: {
    name: "Chance",
    icon: "🎲",
    color: "linear-gradient(135deg, #f0abfc, #a21caf)",
    subtopics: {
      words: {
        name: "Chance Words",
        desc: "Impossible up to certain",
        levels: [{ id: "l1", name: "Describe the chance", gen: chanceWordsGen }],
      },
      fractions: {
        name: "Probability as Fractions",
        desc: "Spinners, marbles and dice",
        levels: [
          { id: "l1", name: "Spinners", gen: probSpinnerGen },
          { id: "l2", name: "Marble jars", gen: probJarGen },
          { id: "l3", name: "Dice", gen: probDiceGen },
        ],
      },
      numbers: {
        name: "Probability as Decimals & %",
        desc: "The same chances, written differently",
        levels: [
          { id: "l1", name: "As decimals", gen: probDecimalGen },
          { id: "l2", name: "As percentages", gen: probPercentGen },
        ],
      },
      worded: {
        name: "Worded Probability",
        desc: "Cards, jelly beans and letters",
        levels: [{ id: "l1", name: "Worded problems", gen: probWordedGen }],
      },
    },
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
