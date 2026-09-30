/**
 * Deck generator — 1:1 port of deck.html to PPTX.
 *
 * Design system: white paper ground, square corners everywhere, hairline
 * rules, a ruled top chrome bar carrying the section label, journey markers
 * and page number, and a large type scale.
 *
 * This keeps the HTML's 1920x1080 stage coordinates so every number below can
 * be diffed directly against the CSS:
 *
 *     1920 px  ->  13.333 in   (144 px per inch)
 *     1 px     ->  0.5 pt      (font sizes)
 *
 * CSS opacity (the faded "as requested" column) is pre-flattened against the
 * white ground rather than relying on renderer alpha.
 *
 * This is the preserved White Cobalt native reference generator: a six-slide
 * worked sample matching the original design language. It is not a generic
 * HTML converter.
 *
 * Animations are recorded per shape into qa/anim-manifest.json and are turned
 * into real <p:timing> effects by
 * scripts/add_animations.py. This deck uses the richer
 * manifest form because it needs two extra effects on top of the r1..r6
 * stagger: the accent rule and the title highlight both wipe in from the left
 * on their own schedule.
 *
 * Usage:
 *   DECK_SANS="Arial Unicode MS" DECK_LATIN="Arial Unicode MS" \
 *   node scripts/reference.cjs
 */

const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const JSZip = require(require.resolve("jszip", { paths: [require.resolve("pptxgenjs")] }));
const { normalizeGeneratedContentTypes } = require("./contract");

// ------------------------------------------------------------- geometry ----
const PXI = 144;
const px = (v) => v / PXI;
const pt = (v) => v / 2;
const lh = (size, ratio) => (size * ratio) / 2;

const STAGE_W = 1920;
const STAGE_H = 1080;
const PAD_X = 120; // --pad-x
const PAD_Y = 92; // --pad-y
const CW = STAGE_W - PAD_X * 2; // 1680
const RIGHT = STAGE_W - PAD_X; // 1800

// .topbar: a 34px row (the stage markers set the height), 26px of padding and
// a 2px ink rule. .body then adds its own 56px of top padding.
const BAR_ROW = 34;
const BAR_RULE_Y = PAD_Y + BAR_ROW + 26;
const BODY_TOP = BAR_RULE_Y + 2 + 56; // 210
const BODY_BOT = STAGE_H - PAD_Y; // 988
const BODY_H = BODY_BOT - BODY_TOP; // 778

// --------------------------------------------------------------- palette ----
const PAPER = "FFFFFF";
const PANEL = "F5F4F1";
const INK = "0E0E0E";
const INK_SOFT = "6B6B6B";
const INK_FAINT = "AFAFAF";
const ACCENT = "0F62FE";
const ACCENT_TINT = "EDF5FF";
const RULE = "E7E7E7";
// .col-faded is opacity:0.42 over white paper.
const FADE_SOFT = "C1C1C1"; // ink-soft  @ 42%
const FADE_INK = "999999"; // ink       @ 42%
const FADE_RULE = "F5F5F5"; // rule      @ 42%

// IBM Plex Sans KR / Archivo / IBM Plex Mono are web fonts. Malgun Gothic is
// the Korean Office standard; Segoe UI stands in for Archivo on the Latin-only
// chrome (page numbers, dates, step numerals, arrows), which is exactly where
// the stylesheet reaches for --font-latin.
const SANS = process.env.DECK_SANS || "맑은 고딕";
const LATIN = process.env.DECK_LATIN || "Segoe UI";

const ROOT = process.cwd();
const QA_DIR = process.env.DECK_QA_DIR || path.join(ROOT, "qa");
const MANIFEST = process.env.DECK_MANIFEST || path.join(QA_DIR, "anim-manifest.json");
const TOTAL = 6;   // slide count, drives the page numbers and progress bar

fs.mkdirSync(QA_DIR, { recursive: true });

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.author = "Deck Author";
pres.title = "Deck Title";
pres.subject = "Deck Subject";

// ------------------------------------------------- animation bookkeeping ----
// .reveal is opacity 0 + translateY(30px) over 0.7s, staggered r1..r6.
const DUR = 700;
const OFF_Y = 30 / STAGE_H;
const R = [0, 80, 200, 320, 440, 560, 680];
const rev = (n) => ({ d: R[n], dur: DUR, fx: "fade", axis: "y", off: OFF_Y });
const wipe = (delay, dur) => ({ d: delay, dur, fx: "wipe" });

// pptxgenjs 4.x silently discards the whole note if the string contains a
// newline — the notes page comes out blank and nothing is logged. Write a
// sentinel instead and let scripts/fix_notes.py turn it into a real <a:br/>.
const NOTE_BR = "\u2424";
const note = (s, text) => s.addNotes(text.replace(/\n/g, NOTE_BR));

const manifest = [];
let anim = null;

function slide() {
  const s = pres.addSlide();
  s.background = { color: PAPER };
  anim = [];
  manifest.push(anim);
  return s;
}

function tier(r) {
  anim.push(r || 0);
}

const NONE = { type: "none" };

function box(s, type, opts, r) {
  s.addShape(type, { line: NONE, ...opts });
  tier(r);
}

/** Square-cornered fill; this system has no rounded corners at all. */
function rect(s, o, r) {
  box(s, pres.ShapeType.rect, o, r);
}

function txt(s, body, o, r) {
  s.addText(body, { fontFace: SANS, margin: 0, valign: "top", isTextBox: true, ...o });
  tier(r);
}

/** Text block positioned in stage px. */
function T(s, body, { x, y, w, h, size, color = INK, ratio = 1.4, ...rest }, r) {
  const o = { x: px(x), y: px(y), w: px(w), h: px(h), fontSize: pt(size), color, ...rest };
  if (ratio !== 1) o.lineSpacing = lh(size, ratio);
  txt(s, body, o, r);
}

// ------------------------------------------------------ text measurement ----
function em(str) {
  let e = 0;
  for (const ch of str) {
    const c = ch.codePointAt(0);
    if (
      (c >= 0xac00 && c <= 0xd7a3) ||
      (c >= 0x3130 && c <= 0x318f) ||
      (c >= 0x4e00 && c <= 0x9fff) ||
      (c >= 0x3000 && c <= 0x303f) ||
      (c >= 0xff00 && c <= 0xffef)
    )
      e += 1;
    else if (ch === " ") e += 0.3;
    else if (/[A-Z]/.test(ch)) e += 0.7;
    else if (/[a-z]/.test(ch)) e += 0.55;
    else if (/[0-9]/.test(ch)) e += 0.58;
    else e += 0.45;
  }
  return e;
}
const wpx = (str, size) => em(str) * size;

// ------------------------------------------------------ shared fragments ----
/** .topbar — section label left, journey markers + page number right. */
function topbar(s, sec, { stages = [], page }) {
  const mid = PAD_Y + BAR_ROW / 2;
  rect(s, { x: px(PAD_X), y: px(mid - 10), w: px(20), h: px(20), fill: { color: ACCENT } }, rev(1));
  T(
    s,
    sec,
    { x: PAD_X + 36, y: PAD_Y, w: 1000, h: BAR_ROW, size: 26, bold: true, ratio: 1.2, valign: "middle", charSpacing: -0.2 },
    rev(1)
  );

  // .pg — "03 / 11" with the total in a lighter weight.
  T(
    s,
    [
      { text: String(page).padStart(2, "0"), options: { bold: true } },
      { text: ` / ${TOTAL}`, options: { color: INK_FAINT } },
    ],
    {
      x: RIGHT - 240,
      y: PAD_Y,
      w: 240,
      h: BAR_ROW,
      size: 30,
      fontFace: LATIN,
      ratio: 1.2,
      align: "right",
      valign: "middle",
      charSpacing: 0.3,
    },
    rev(1)
  );

  // .stages — four markers, lit for the phases this slide covers.
  if (stages.length) {
    const x0 = RIGHT - 240 - 34 - (4 * 34 + 3 * 9);
    [1, 2, 3, 4].forEach((n, i) => {
      const on = stages.includes(n);
      const x = x0 + i * 43;
      box(
        s,
        pres.ShapeType.ellipse,
        {
          x: px(x),
          y: px(PAD_Y),
          w: px(34),
          h: px(34),
          fill: on ? { color: ACCENT } : { type: "none" },
          line: { color: on ? ACCENT : RULE, width: 1.5 },
        },
        rev(1)
      );
      T(
        s,
        String(n),
        {
          x,
          y: PAD_Y,
          w: 34,
          h: 34,
          size: 17,
          fontFace: LATIN,
          bold: true,
          color: on ? PAPER : INK_FAINT,
          ratio: 1,
          align: "center",
          valign: "middle",
        },
        rev(1)
      );
    });
  }

  rect(s, { x: px(PAD_X), y: px(BAR_RULE_Y), w: px(CW), h: px(2), fill: { color: INK } }, rev(1));
}

/** h2 — the single headline on every content slide. */
function h2(s, y, runs, r, { w = CW } = {}) {
  T(s, runs, { x: PAD_X, y, w, h: 70 * 1.24 * 2, size: 70, bold: true, ratio: 1.24, charSpacing: -1 }, r);
  return 70 * 1.24;
}

/** .label — spaced small caps-ish section marker. */
function label(s, x, y, w, text, r, color = INK_SOFT) {
  T(s, text, { x, y, w, h: 26.4, size: 22, bold: true, color, ratio: 1.2, charSpacing: 1.1 }, r);
}

/** .band — accent-tinted takeaway with a 10px accent rule on the left. */
function band(s, { x = PAD_X, y, w = CW, text, lines = 1, muted }, r) {
  const textH = 34 * 1.45 * lines;
  const mutedH = muted ? 10 + 27 * 1.2 : 0;
  const h = 60 + textH + mutedH;
  rect(s, { x: px(x), y: px(y), w: px(w), h: px(h), fill: { color: ACCENT_TINT } }, r);
  rect(s, { x: px(x), y: px(y), w: px(10), h: px(h), fill: { color: ACCENT } }, r);
  T(s, text, { x: x + 40, y: y + 30, w: w - 80, h: textH, size: 34, bold: true, ratio: 1.45, charSpacing: -0.2 }, r);
  if (muted)
    T(s, muted, { x: x + 40, y: y + 30 + textH + 10, w: w - 80, h: 27 * 1.2, size: 27, color: INK_SOFT, ratio: 1.2 }, r);
  return h;
}

/** .flow — square chips joined by accent arrows. Returns the height used. */
function flow(s, steps, { x, y, size = 25, padX = 24, padY = 18, gap = 18 }, r) {
  const h = size * 1.2 + padY * 2;
  let cx = x;
  steps.forEach((step, i) => {
    const runs = typeof step === "string" ? [{ text: step }] : step.runs || [{ text: step.t }];
    const plain = runs.map((t) => t.text).join("");
    const soft = typeof step === "object" && step.soft;
    const w = wpx(plain, size) + padX * 2;
    rect(
      s,
      {
        x: px(cx),
        y: px(y),
        w: px(w),
        h: px(h),
        fill: soft ? { color: PANEL } : { color: PAPER },
        line: { color: soft ? RULE : INK, width: soft ? 1.5 : 1.5 },
      },
      r
    );
    T(
      s,
      runs.map((t) => ({ text: t.text, options: { color: soft ? INK_SOFT : INK, ...(t.options || {}) } })),
      { x: cx, y, w, h, size, ratio: 1, align: "center", valign: "middle" },
      r
    );
    cx += w;
    if (i < steps.length - 1) {
      T(
        s,
        "→",
        { x: cx + gap, y, w: 30, h, size: 26, fontFace: LATIN, bold: true, color: ACCENT, ratio: 1, align: "center", valign: "middle" },
        r
      );
      cx += gap + 30 + gap;
    }
  });
  return h;
}

/** .tag / .pill / .lx — flat panel chips that wrap. */
function chips(s, items, { x, y, w, size = 24, padX = 20, padY = 12, gap = 12 }, r) {
  const h = size * 1.2 + padY * 2;
  let cx = x,
    cy = y,
    rows = 1;
  items.forEach((t) => {
    const cw = wpx(t, size) + padX * 2;
    if (cx > x && cx + cw > x + w) {
      cx = x;
      cy += h + gap;
      rows += 1;
    }
    rect(s, { x: px(cx), y: px(cy), w: px(cw), h: px(h), fill: { color: PANEL } }, r);
    T(s, t, { x: cx, y: cy, w: cw, h, size, color: INK_SOFT, ratio: 1, align: "center", valign: "middle" }, r);
    cx += cw + gap;
  });
  return rows * h + (rows - 1) * gap;
}

/** Progress bar pinned to the bottom edge of the stage. */
function progress(s, idx) {
  rect(s, { x: 0, y: px(STAGE_H - 6), w: (STAGE_W * (idx / TOTAL)) / PXI, h: px(6), fill: { color: ACCENT } });
}

// ============================================================ S1 — TITLE ====
{
  const s = slide();

  // .title-top
  rect(s, { x: px(PAD_X), y: px(96), w: px(20), h: px(20), fill: { color: ACCENT } }, rev(1));
  T(
    s,
    "SECTION LABEL",
    { x: PAD_X + 38, y: 92, w: 700, h: 28, size: 22, fontFace: LATIN, bold: true, ratio: 1.2, charSpacing: 2.6, valign: "middle" },
    rev(1)
  );

  // --h1-size is 168px in the CSS, but a long second line overflows the 1680px
  // text column and wraps to a third line, colliding with the accent rule.
  // Measure the authored line and step the size down if it does not fit.
  const H1 = 150;
  const heroY = 239;
  const line2Y = heroY + H1 * 1.08;
  // The highlight bar sits behind the run it marks, so it is drawn first.
  // Advance of the leading text (then the highlighted run) at -0.045em tracking.
  const preW = wpx("부제 ", H1) - 3 * H1 * 0.045;
  const hlW = wpx("강조", H1) - 2 * H1 * 0.045;
  rect(
    s,
    { x: px(PAD_X + preW - 4), y: px(line2Y + H1 * 0.82), w: px(hlW + 8), h: px(16), fill: { color: ACCENT } },
    wipe(850, 700)
  );
  T(
    s,
    [
      { text: "주요 제목", options: { breakLine: true } },
      { text: "부제 강조 한 줄" },
    ],
    { x: PAD_X, y: heroY, w: CW, h: H1 * 1.08 * 2, size: H1, bold: true, ratio: 1.08, charSpacing: -3.4 },
    rev(2)
  );

  rect(s, { x: px(PAD_X), y: px(613), w: px(CW), h: px(10), fill: { color: ACCENT } }, wipe(500, 900));
  T(
    s,
    "LATIN SUBTITLE HERE",
    { x: PAD_X, y: 653, w: CW, h: 48, size: 40, fontFace: LATIN, bold: true, ratio: 1.2, charSpacing: 0.4 },
    rev(3)
  );

  // .title-foot — each meta cell is measured, not given a fixed column width,
  // so a longer value cannot wrap and shove the row out of alignment.
  const meta = [
    ["기간", "2026.01.01 – 03.01"],
    ["총 진행", "8주"],
    ["핵심 구간", "5주"],
  ];
  let mx = PAD_X;
  meta.forEach(([k, v]) => {
    const w = Math.max(wpx(k, 23), wpx(v, 26)) * 1.12;
    T(s, k, { x: mx, y: 866, w, h: 28, size: 23, color: INK_SOFT, ratio: 1.2, wrap: false }, rev(5));
    T(s, v, { x: mx, y: 900, w, h: 32, size: 26, bold: true, ratio: 1.2, charSpacing: -0.2, wrap: false }, rev(5));
    mx += w + 56;
  });
  T(
    s,
    [
      { text: "TEAM", options: { color: ACCENT, bold: true } },
      { text: "  이름 · 이름", options: { color: INK } },
    ],
    { x: PAD_X, y: 958, w: 700, h: 28, size: 23, ratio: 1.2, wrap: false },
    rev(5)
  );
  T(
    s,
    "01",
    { x: RIGHT - 300, y: 894, w: 300, h: 90, size: 112, fontFace: LATIN, bold: true, color: ACCENT, ratio: 1, align: "right" },
    rev(6)
  );

  progress(s, 1);
  note(s, "[0:00–0:20]\n표지에서 할 말. 발표자 노트는 그대로 PPTX 노트로 넘어갑니다.");
}

// ======================================================== S2 — STATEMENT ====
{
  const s = slide();
  topbar(s, "한 문장으로", { page: 2 });
  T(
    s,
    [
      { text: "첫 번째 줄은 담백하게,", options: { breakLine: true } },
      { text: "강조하고 싶은 구절", options: { color: ACCENT } },
      { text: "은 accent 색으로", options: { breakLine: true } },
      { text: "마지막 줄로 문장을 닫습니다." },
    ],
    { x: PAD_X, y: 350, w: CW, h: 80 * 1.42 * 4, size: 80, bold: true, ratio: 1.42, charSpacing: -1.6 },
    rev(2)
  );
  T(s, "— 출처 또는 부연", { x: PAD_X, y: 850, w: 900, h: 32, size: 26, color: INK_SOFT, ratio: 1.2, charSpacing: -0.2 }, rev(3));
  progress(s, 2);
  note(s, "[0:20–0:50]\n이 슬라이드에서 할 말.");
}

// ============================================= S3 — TWO-COLUMN CONTRAST ====
{
  const s = slide();
  topbar(s, "섹션 이름", { stages: [1, 2], page: 3 });
  const top = 268;
  h2(s, top, "슬라이드 제목이 들어갑니다", rev(2));
  T(
    s,
    "한 줄 부연 설명",
    { x: PAD_X, y: top + 87 + 16, w: CW, h: 40, size: 32, color: INK_SOFT, ratio: 1.2, charSpacing: -0.2 },
    rev(2)
  );

  // .cols — grid 1fr 1.25fr, 64px gutter
  const colY = top + 87 + 16 + 40 + 44;
  const C1W = 718,
    C2X = PAD_X + 718 + 64,
    C2W = 898;

  T(s, "겉으로 보였던 것", { x: PAD_X, y: colY, w: C1W, h: 34, size: 28, bold: true, color: FADE_SOFT, ratio: 1.2, charSpacing: -0.2 }, rev(3));
  rect(s, { x: px(PAD_X), y: px(colY + 56), w: px(6), h: px(102), fill: { color: FADE_RULE } }, rev(3));
  T(
    s,
    [{ text: "“인용하거나 대비시킬", options: { breakLine: true } }, { text: "내용을 여기에”" }],
    { x: PAD_X + 32, y: colY + 56, w: C1W - 32, h: 34 * 1.5 * 2, size: 34, color: FADE_INK, ratio: 1.5 },
    rev(3)
  );

  T(s, "실제로 중요했던 것", { x: C2X, y: colY, w: C2W, h: 34, size: 28, bold: true, color: INK_SOFT, ratio: 1.2, charSpacing: -0.2 }, rev(4));
  T(
    s,
    [
      { text: "핵심 주장을 " },
      { text: "두 줄", options: { color: ACCENT } },
      { text: " 이내로", options: { breakLine: true } },
      { text: "간결하게 적습니다" },
    ],
    { x: C2X, y: colY + 56, w: C2W, h: 38 * 1.42 * 2, size: 38, bold: true, ratio: 1.42, charSpacing: -0.4 },
    rev(4)
  );
  chips(s, ["키워드", "키워드", "키워드"], { x: C2X, y: colY + 190, w: C2W }, rev(4));

  band(
    s,
    {
      y: colY + 306 + 56,
      text: "이 슬라이드에서 남길 한 문장",
      muted: "필요하면 보조 설명을 한 줄 더",
    },
    rev(5)
  );

  progress(s, 3);
  note(s, "[0:50–2:00]\n이 슬라이드에서 할 말.");
}

// ========================================================= S4 — TIMELINE ====
{
  const s = slide();
  topbar(s, "전체 여정", { stages: [1, 2, 3, 4], page: 4 });
  const top = 324;
  h2(s, top, "8주, 4단계로 진행했습니다", rev(2));

  // .axis — a hairline with one dot per phase
  const axY = top + 87 + 54;
  const axW = CW / 4;
  rect(s, { x: px(PAD_X), y: px(axY + 13), w: px(CW), h: px(2), fill: { color: RULE } }, rev(3));
  [
    ["01 / 01", false],
    ["01 / 15", true],
    ["02 / 10", true],
    ["03 / 01", false],
  ].forEach(([date, hot], i) => {
    const x = PAD_X + i * axW;
    box(
      s,
      pres.ShapeType.ellipse,
      { x: px(x), y: px(axY + 6), w: px(16), h: px(16), fill: { color: hot ? ACCENT : INK_FAINT } },
      rev(3)
    );
    T(s, date, { x, y: axY + 38, w: axW, h: 30, size: 24, fontFace: LATIN, bold: true, color: hot ? INK : INK_SOFT, ratio: 1.2 }, rev(3));
  });

  // .steps — one column per phase, topped by a 6px rule
  const stY = axY + 67 + 26;
  const stW = (CW - 3 * 26) / 4;
  const steps = [
    ["01", "첫 단계", "두 줄 이내로\n무엇을 했는지", "2주", false],
    ["02", "두 번째 단계", "강조할 단계는\nhot 플래그를 켭니다", "1주", true],
    ["03", "세 번째 단계", "여기가 보통\n이야기의 전환점", "1주", true],
    ["04", "마지막 단계", "결과와\n이후로 이어진 것", "이후", false],
  ];
  steps.forEach(([n, head, body, dur, hot], i) => {
    const x = PAD_X + i * (stW + 26);
    rect(s, { x: px(x), y: px(stY), w: px(stW), h: px(6), fill: { color: hot ? ACCENT : RULE } }, rev(4));
    T(s, n, { x, y: stY + 30, w: stW, h: 42, size: 34, fontFace: LATIN, bold: true, color: hot ? ACCENT : INK_FAINT, ratio: 1.2 }, rev(4));
    // Titles get a full two-line slot so a wrapping title never crowds the body.
    T(s, head, { x, y: stY + 82, w: stW, h: 32 * 1.3 * 2, size: 32, bold: true, ratio: 1.3, charSpacing: -0.3 }, rev(4));
    T(s, body, { x, y: stY + 136, w: stW, h: 24 * 1.55 * 3, size: 24, color: INK_SOFT, ratio: 1.55 }, rev(4));
    T(s, dur, { x, y: stY + 230, w: stW, h: 26, size: 21, color: INK_FAINT, ratio: 1.2 }, rev(4));
  });

  T(
    s,
    [{ text: "보조 수치 한 줄 · " }, { text: "강조할 결과", options: { color: INK } }],
    { x: PAD_X, y: stY + 256 + 40, w: CW, h: 30, size: 24, color: INK_SOFT, ratio: 1.2 },
    rev(5)
  );

  progress(s, 4);
  note(s, "[2:00–2:40]\n이 슬라이드에서 할 말.");
}

// ================================================= S5 — PIPELINE / STACK ====
{
  const s = slide();
  topbar(s, "결과물", { stages: [2], page: 5 });
  const top = 332;
  h2(s, top, "무엇을 만들었는지 한 줄로", rev(2));

  let y = top + 87 + 52;
  label(s, PAD_X, y, CW, "사용자 경험", rev(3));
  flow(
    s,
    [{ t: "입력" }, { t: "처리", soft: true }, { t: "분석", soft: true }, { t: "결과물" }],
    { x: PAD_X, y: y + 44 },
    rev(3)
  );

  y = y + 44 + 66 + 38;
  label(s, PAD_X, y, CW, "기술 구성", rev(4));
  flow(
    s,
    [
      { t: "구성요소 A", soft: true },
      { runs: [{ text: "구성요소 B " }, { text: "(비고)", options: { color: ACCENT } }], soft: true },
      { t: "구성요소 C", soft: true },
    ],
    { x: PAD_X, y: y + 44 },
    rev(4)
  );

  y = y + 44 + 66 + 38;
  label(s, PAD_X, y, CW, "들어간 것", rev(5));
  chips(s, ["항목", "항목", "항목"], { x: PAD_X, y: y + 44, w: CW, padX: 22, padY: 13 }, rev(5));

  progress(s, 5);
  note(s, "[2:40–3:20]\n이 슬라이드에서 할 말.");
}

// ====================================================== S6 — REFLECTIONS ====
{
  const s = slide();
  topbar(s, "돌아보니", { page: 6 });
  const top = 317;
  h2(s, top, "느낀 것 세 가지", rev(2));

  const rY = top + 87 + 52;
  const rW = (CW - 88) / 3;
  const refs = [
    [
      "01",
      [{ text: "첫 번째 " }, { text: "배운 점", options: { color: ACCENT } }, { text: "을 두 줄 이내로" }],
      "왜 그렇게 느꼈는지 한두 문장.",
      rev(3),
    ],
    ["02", [{ text: "두 번째 배운 점" }], "왜 그렇게 느꼈는지 한두 문장.", rev(4)],
    ["03", [{ text: "세 번째 배운 점" }], "왜 그렇게 느꼈는지 한두 문장.", rev(5)],
  ];
  refs.forEach(([n, head, body, r], i) => {
    const x = PAD_X + i * (rW + 44);
    rect(s, { x: px(x), y: px(rY), w: px(rW), h: px(6), fill: { color: INK } }, r);
    T(s, n, { x, y: rY + 32, w: rW, h: 68, size: 64, fontFace: LATIN, bold: true, color: ACCENT, ratio: 1 }, r);
    T(s, head.map((t) => ({ text: t.text, options: { bold: true, ...(t.options || {}) } })), {
      x,
      y: rY + 120,
      w: rW,
      h: 33 * 1.38 * 2,
      size: 33,
      ratio: 1.38,
      charSpacing: -0.33,
    }, r);
    T(s, body, { x, y: rY + 232, w: rW, h: 24 * 1.6 * 3, size: 24, color: INK_SOFT, ratio: 1.6 }, r);
  });

  T(
    s,
    [
      { text: "정답이라기보다 " },
      { text: "이런 조건에서는 이랬다", options: { bold: true, color: INK } },
      { text: "는 관찰입니다" },
    ],
    { x: PAD_X, y: rY + 348 + 52, w: CW, h: 34, size: 26, color: INK_SOFT, ratio: 1.2 },
    rev(6)
  );

  progress(s, 6);
  note(s, "[3:20–4:00]\n톤 주의 — \"하세요\"가 아니라 \"이랬습니다\".");
}

// ----------------------------------------------------------------- write ----
const out = process.env.DECK_OUT || process.env.DECK_PPTX || path.join(QA_DIR, "white-cobalt-reference.pptx");
fs.mkdirSync(path.dirname(path.resolve(MANIFEST)), { recursive: true });
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(MANIFEST, JSON.stringify(manifest));
(async () => {
  const zip = await JSZip.loadAsync(await pres.write({ outputType: "nodebuffer" }));
  await normalizeGeneratedContentTypes(zip);
  fs.writeFileSync(out, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  console.log("wrote " + out);
})().catch(error => { console.error(error); process.exitCode = 1; });
