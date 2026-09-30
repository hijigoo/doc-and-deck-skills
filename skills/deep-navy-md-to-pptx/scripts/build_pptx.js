// Native layout renderer. Local contract: ../references/pptx.md.
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const JSZip = require(require.resolve("jszip", { paths: [require.resolve("pptxgenjs")] }));
const { themes, configureSlide, validate, notesXml, validateDrawing, normalizeGeneratedContentTypes } = require("./contract");
const SOURCES = require("./icons.json");
let THEME, C, FONT, FONTL, WHITE;
const PW = 13.333, PH = 7.5, PARTS = 4;
let pptx, CUR_PART = 0, PAGE = 0, DECK;

function shadow(opts) {
  return Object.assign({}, THEME.shadow, opts || {});
}

let sharp = null;
let sharpPath;
try {
  sharpPath = require.resolve("sharp");
} catch (error) {
  if (error.code !== "MODULE_NOT_FOUND") throw error;
}
if (sharpPath) sharp = require(sharpPath);
const IC = {};

function tintSvg(svg, hex) {
  let out = svg.replace(/currentColor/g, "#" + hex);
  if (!/width=/.test(out)) out = out.replace("<svg", '<svg width="256" height="256"');
  return out;
}

async function svgToDataURI(svg) {
  if (sharp) {
    const buf = await sharp(Buffer.from(svg), { density: 300 }).resize(256, 256).png().toBuffer();
    return "image/png;base64," + buf.toString("base64");
  }
  return "image/svg+xml;base64," + Buffer.from(svg).toString("base64");
}

async function buildIcons(specs) {
  const keys = new Set();
  function visit(value) {
    if (!value || typeof value !== "object") return;
    if (value.icon) keys.add(value.icon);
    Object.values(value).forEach(visit);
  }
  specs.forEach(sp => {
    visit(sp);
    if (sp.kind === "cover") keys.add(sp.icon || "cloud");
    if (sp.kind === "divider") keys.add(sp.icon || "compass");
  });
  const tones = { w: "WHITE", n: "NAVY", m: "MID", a: "ACCENT" };
  const jobs = [];
  for (const key of keys) {
    for (const [tone, colorName] of Object.entries(tones)) {
      const hex = C[colorName];
      jobs.push(
        svgToDataURI(tintSvg(SOURCES[key], hex)).then(d => { IC[key + "_" + tone] = d; })
      );
    }
  }
  await Promise.all(jobs);
  if (!sharp) {
    console.warn("[build-pptx] sharp 없음 — 아이콘을 SVG 로 삽입합니다. " +
                 "PowerPoint 2016+ 에서 정상 표시되며, 최상의 호환성은 `npm install sharp`.");
  }
}

// icon("cloud","w") → dataURI. 없는 이름은 조용히 넘기지 않고 알려준다.
function icon(name, tone) {
  if (!name) return null;
  const k = name + "_" + (tone || "n");
  if (IC[k]) return IC[k];
  throw new Error(`Unknown icon: ${name}`);
}

// ---------- Slide helpers (build.js 와 동일) ----------
function footer(slide, dark) {
  PAGE += 1;
  const col = dark && !WHITE ? C.SKY : C.MUTED;
  slide.addText(DECK.title || "", { x: 0.5, y: 7.06, w: 6, h: 0.3, fontFace: FONT, fontSize: 8.5, color: col, align: "left" });
  slide.addText(String(PAGE), { x: 12.4, y: 7.06, w: 0.5, h: 0.3, fontFace: FONT, fontSize: 8.5, color: col, align: "right" });
}

function contentBG(slide) {
  slide.background = { color: C.BG };
  const gap = THEME.progress.gap, segW = (PW - (PARTS - 1) * gap) / PARTS;
  for (let i = 0; i < PARTS; i++) {
    const on = (i + 1) === CUR_PART;
    slide.addShape(pptx.ShapeType.rect, { x: i * (segW + gap), y: 0, w: segW, h: THEME.progress.height, fill: { color: on ? C.ACCENT : C.ICE } });
  }
}

function arrowR(slide, x, y, len, opts) {
  opts = opts || {};
  slide.addShape(pptx.ShapeType.line, { x, y, w: len, h: 0, line: { color: opts.color || C.MID, width: WHITE ? 0.75 : opts.w || 2.5, endArrowType: "triangle" } });
}
function arrowD(slide, x, y, len, opts) {
  opts = opts || {};
  slide.addShape(pptx.ShapeType.line, { x, y, w: 0, h: len, line: { color: opts.color || C.MID, width: WHITE ? 0.75 : opts.w || 2.5, endArrowType: "triangle" } });
}

function header(slide, kicker, title, opts) {
  opts = opts || {};
  if (kicker) slide.addText(kicker.toUpperCase(), { x: 0.55, y: 0.42, w: 11.5, h: 0.34, fontFace: FONT, fontSize: 12.5, bold: true, color: C.MID, charSpacing: 2, align: "left" });
  slide.addText(title, { x: 0.52, y: 0.74, w: 12.3, h: opts.h || 0.9, fontFace: FONTL, fontSize: opts.size || 30, bold: true, color: C.DARK, align: "left", valign: "top" });
}

function card(slide, x, y, w, h, opts) {
  opts = opts || {};
  slide.addShape(WHITE ? pptx.ShapeType.rect : pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.09, fill: { color: opts.fill || C.WHITE }, line: { color: opts.line || C.LINE, width: WHITE ? 0.5 : 1 }, ...(WHITE ? {} : { shadow: shadow({ opacity: 0.14, blur: 6, offset: 2 }) }) });
}

function numBadge(slide, x, y, txt, opts) {
  opts = opts || {};
  const d = opts.d || 0.5;
  slide.addShape(WHITE ? pptx.ShapeType.rect : pptx.ShapeType.roundRect, { x, y, w: d, h: d, rectRadius: 0.1, fill: { color: opts.fill || C.NAVY } });
  slide.addText(txt, { x, y, w: d, h: d, fontFace: FONTL, fontSize: opts.fs || 18, bold: true, color: C.WHITE, align: "center", valign: "middle" });
}

function iconCircle(slide, x, y, d, ic, opts) {
  opts = opts || {};
  slide.addShape(pptx.ShapeType.ellipse, { x, y, w: d, h: d, fill: { color: opts.fill || C.ICE }, line: opts.line ? { color: opts.line, width: 1 } : { type: "none" } });
  if (ic) {
    const pad = d * 0.26;
    slide.addImage({ data: ic, x: x + pad, y: y + pad, w: d - pad * 2, h: d - pad * 2 });
  }
}

function slideIconRight(slide, x, y, d, ic) {
  slide.addShape(pptx.ShapeType.ellipse, { x, y, w: d, h: d, fill: { color: C.NAVY } });
  if (ic) {
    const pad = d * 0.26;
    slide.addImage({ data: ic, x: x + pad, y: y + pad, w: d - pad * 2, h: d - pad * 2 });
  }
}

function pill(slide, x, y, txt, kind) {
  const col = kind === "ga" ? C.GREEN : kind === "prev" ? C.GOLD : C.MID;
  const txtCol = (kind === "prev" || kind === "ga") && !WHITE ? C.DARK : C.WHITE;
  const w = Math.max(0.72, 0.2 + txt.length * 0.092);
  slide.addShape(WHITE ? pptx.ShapeType.rect : pptx.ShapeType.roundRect, { x, y, w, h: 0.3, rectRadius: 0.15, fill: { color: col } });
  slide.addText(txt, { x, y, w, h: 0.3, fontFace: FONT, fontSize: 10, bold: true, color: txtCol, align: "center", valign: "middle" });
  return w;
}

function styledTable(slide, rows, x, y, w, colW, opts) {
  opts = opts || {};
  const tblRows = rows.map((r, ri) => r.map(cell => {
    const isHead = ri === 0;
    const c = (typeof cell === "object" && cell !== null) ? cell : { text: cell };
    const base = {
      fontFace: FONT, fontSize: opts.fs || 11.5,
      color: isHead && !WHITE ? C.WHITE : C.TEXT,
      fill: { color: isHead && !WHITE ? C.NAVY : (ri % 2 ? C.ICE2 : C.WHITE) },
      align: c.align || (isHead ? "center" : "left"),
      valign: "middle", bold: isHead || c.bold,
      margin: [3, 5, 3, 5],
    };
    if (c.color) base.color = c.color;
    return { text: c.text != null ? c.text : "", options: base };
  }));
  slide.addTable(tblRows, {
    x, y, w, colW,
    border: [
      { type: "solid", color: C.LINE, pt: 0.5 }, { type: "none" },
      { type: "solid", color: C.LINE, pt: 0.5 }, { type: "none" },
    ],
    rowH: opts.rowH || 0.36, valign: "middle", autoPage: false,
  });
}

// =====================================================================
//  Slide kinds
// =====================================================================

function s_cover(sp) {
  const s = pptx.addSlide();
  s.background = { color: WHITE ? C.WHITE : C.DARK };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: PW, h: PH, fill: { color: WHITE ? C.WHITE : C.DARK } });
  s.addShape(pptx.ShapeType.rect, { x: 0.85, y: 5.55, w: 4.2, h: WHITE ? 0.007 : 0.045, fill: { color: C.ACCENT } });
  iconCircle(s, 0.85, 0.75, 1.0, icon(sp.icon || "cloud", "w"), { fill: C.MID });
  if (sp.kicker) s.addText(sp.kicker.toUpperCase(), { x: 1.95, y: 0.98, w: 9, h: 0.5, fontFace: FONT, fontSize: 13, bold: true, color: C.SUBLT, charSpacing: 2, valign: "middle" });
  s.addText(sp.title, { x: 0.8, y: 2.5, w: 11.8, h: 1.5, fontFace: FONTL, fontSize: sp.titleSize || 54, bold: true, color: WHITE ? C.DARK : C.WHITE });
  if (sp.subtitle) s.addText(sp.subtitle, { x: 0.85, y: 3.95, w: 11.6, h: 0.6, fontFace: FONT, fontSize: 20, color: WHITE ? C.TEXT : C.ICE });
  if (sp.subtitle2) s.addText(sp.subtitle2, { x: 0.85, y: 4.55, w: 11.6, h: 0.5, fontFace: FONT, fontSize: 15, color: C.SUBLT });
  if (sp.meta) s.addText(sp.meta, { x: 0.85, y: 5.85, w: 11.6, h: 0.5, fontFace: FONT, fontSize: 13, color: WHITE ? C.MUTED : C.ICE });
  return s;
}

function s_agenda(sp) {
  const s = pptx.addSlide(); contentBG(s);
  header(s, sp.kicker || "Agenda", sp.title || "오늘의 흐름");
  const items = sp.items || [];
  let ay = 1.95;
  const h = Math.min(1.12, (6.7 - 1.95 - (items.length - 1) * 0.14) / items.length);
  items.forEach((p, i) => {
    card(s, 0.6, ay, 12.15, h);
    numBadge(s, 0.85, ay + (h - 0.5) / 2, String(p.n != null ? p.n : i + 1), { d: 0.5 });
    if (p.icon) slideIconRight(s, 11.95, ay + (h - 0.48) / 2, 0.48, icon(p.icon, "w"));
    const compact = h < 1.02;
    s.addText(p.title, { x: 1.55, y: ay + (compact ? 0.05 : 0.16), w: 8.5, h: compact ? 0.3 : 0.42, fontFace: FONTL, fontSize: compact ? 15 : 17, bold: true, color: C.DARK });
    if (p.desc) s.addText(p.desc, { x: 1.57, y: ay + (compact ? 0.37 : 0.58), w: 9.2, h: compact ? h - 0.4 : 0.44, fontFace: FONT, fontSize: 11.5, color: C.MUTED });
    if (p.time) s.addText(p.time, { x: 10.4, y: ay + 0.16, w: 1.35, h: 0.4, fontFace: FONT, fontSize: 12, bold: true, color: C.MID, align: "right" });
    ay += h + 0.14;
  });
  footer(s);
  return s;
}

function s_divider(sp) {
  if (sp.part) CUR_PART = sp.part;
  const s = pptx.addSlide();
  s.background = { color: WHITE ? C.WHITE : C.DARK };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 4.6, h: PH, fill: { color: WHITE ? C.WHITE : C.NAVY } });
  s.addShape(pptx.ShapeType.rect, { x: 4.6, y: 0, w: WHITE ? 0.007 : 0.05, h: PH, fill: { color: WHITE ? C.LINE : C.MID } });
  iconCircle(s, 1.5, 2.7, 1.6, icon(sp.icon || "compass", "w"), { fill: C.MID });
  if (sp.label) s.addText(sp.label.toUpperCase(), { x: 5.2, y: 2.55, w: 7.4, h: 0.5, fontFace: FONT, fontSize: 15, bold: true, color: C.ACCENT2, charSpacing: 3 });
  s.addText(sp.title, { x: 5.15, y: 3.0, w: 7.7, h: 1.1, fontFace: FONTL, fontSize: 34, bold: true, color: WHITE ? C.DARK : C.WHITE });
  if (sp.sub) s.addText(sp.sub, { x: 5.2, y: 4.15, w: 7.5, h: 1.0, fontFace: FONT, fontSize: 14, color: C.SUBLT, lineSpacingMultiple: 1.25 });
  return s; // dividers 는 페이지번호 없음 (build.js 와 동일)
}

function s_cards(sp) {
  if (sp.part) CUR_PART = sp.part;
  const s = pptx.addSlide(); contentBG(s);
  header(s, sp.kicker, sp.title);
  let top = 1.95;
  if (sp.intro) { s.addText(sp.intro, { x: 0.6, y: 1.78, w: 12.15, h: 0.5, fontFace: FONT, fontSize: 12.5, color: C.TEXT, lineSpacingMultiple: 1.2 }); top = 2.5; }
  const cards = sp.cards || [];
  const cols = sp.cols || (cards.length <= 3 ? cards.length : (cards.length === 4 ? 2 : 3));
  const rows = Math.ceil(cards.length / cols);
  const gap = 0.25, x0 = 0.6, wTot = 12.15;
  const cw = (wTot - (cols - 1) * gap) / cols;
  const areaB = 6.85;
  const ch = Math.min(2.2, (areaB - top - (rows - 1) * gap) / rows);
  cards.forEach((cd, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const px = x0 + col * (cw + gap), py = top + row * (ch + gap);
    card(s, px, py, cw, ch);
    const ir = icon(cd.icon, "n");
    if (cd.icon) iconCircle(s, px + 0.3, py + 0.32, 0.8, ir, { fill: C.ICE });
    const tx = cd.icon ? px + 1.25 : px + 0.32;
    s.addText(cd.title, { x: tx, y: py + 0.34, w: px + cw - tx - 0.25, h: 0.7, fontFace: FONTL, fontSize: 16, bold: true, color: C.DARK, valign: "middle" });
    if (cd.desc) s.addText(cd.desc, { x: px + 0.32, y: py + (cd.icon ? 1.24 : 1.02), w: cw - 0.6, h: ch - (cd.icon ? 1.24 : 1.02) - (cd.badge ? 0.45 : 0.18), fontFace: FONT, fontSize: 11.5, color: C.MUTED, lineSpacingMultiple: 1.15, valign: "top" });
    if (cd.badge) pill(s, px + 0.32, py + ch - 0.46, cd.badge.text, cd.badge.kind);
  });
  footer(s);
  return s;
}

function s_numbered(sp) {
  if (sp.part) CUR_PART = sp.part;
  const s = pptx.addSlide(); contentBG(s);
  header(s, sp.kicker, sp.title);
  const items = sp.items || [];
  let ay = 1.95;
  const h = Math.min(1.05, (6.75 - 1.95 - (items.length - 1) * 0.14) / items.length);
  items.forEach((p, i) => {
    card(s, 0.6, ay, 12.15, h);
    numBadge(s, 0.85, ay + (h - 0.5) / 2, String(i + 1), { d: 0.5 });
    if (p.icon) slideIconRight(s, 11.95, ay + (h - 0.48) / 2, 0.48, icon(p.icon, "w"));
    const compact = h < 0.85;
    s.addText(p.title, { x: 1.55, y: ay + (compact ? 0.04 : 0.14), w: 9.9, h: compact ? 0.3 : 0.42, fontFace: FONTL, fontSize: compact ? 15 : 16.5, bold: true, color: C.DARK });
    if (p.desc) s.addText(p.desc, { x: 1.57, y: ay + (compact ? 0.35 : 0.55), w: 10.0, h: h - (compact ? 0.38 : 0.6), fontFace: FONT, fontSize: 11.5, color: C.MUTED, lineSpacingMultiple: 1.12 });
    ay += h + 0.14;
  });
  footer(s);
  return s;
}

function s_table(sp) {
  if (sp.part) CUR_PART = sp.part;
  const s = pptx.addSlide(); contentBG(s);
  header(s, sp.kicker, sp.title);
  let top = 2.0;
  if (sp.intro) { s.addText(sp.intro, { x: 0.6, y: 1.8, w: 12.15, h: 0.5, fontFace: FONT, fontSize: 12.5, color: C.TEXT, lineSpacingMultiple: 1.2 }); top = 2.55; }
  const rows = [sp.head].concat(sp.rows);
  const n = sp.head.length;
  const colW = sp.colW || Array(n).fill(12.15 / n);
  const rowH = sp.rowH || Math.min(0.6, (6.5 - top) / rows.length);
  styledTable(s, rows, 0.6, top, 12.15, colW, { fs: sp.fs || 11.5, rowH });
  if (sp.caption) s.addText(sp.caption, { x: 0.6, y: 6.55, w: 12.15, h: 0.4, align: "center", fontFace: FONT, fontSize: 12.5, bold: true, color: C.NAVY });
  footer(s);
  return s;
}

function s_flow(sp) {
  if (sp.part) CUR_PART = sp.part;
  const s = pptx.addSlide(); contentBG(s);
  header(s, sp.kicker, sp.title);
  const steps = sp.steps || [];
  const n = steps.length;
  const gap = 0.3, x0 = 0.85, wTot = 11.6;
  const cw = (wTot - (n - 1) * gap) / n;
  const ch = 2.4, ty = 2.3;
  let x = x0;
  steps.forEach((f, i) => {
    card(s, x, ty, cw, ch);
    iconCircle(s, x + (cw - 1.0) / 2, ty + 0.35, 1.0, icon(f.icon, "n"), { fill: C.ICE });
    s.addText(f.title, { x, y: ty + 1.45, w: cw, h: 0.4, align: "center", fontFace: FONTL, fontSize: 16, bold: true, color: C.DARK });
    if (f.desc) s.addText(f.desc, { x: x + 0.15, y: ty + 1.85, w: cw - 0.3, h: 0.5, align: "center", fontFace: FONT, fontSize: 11, color: C.MUTED, lineSpacingMultiple: 1.1 });
    if (i < n - 1) arrowR(s, x + cw + 0.04, ty + ch / 2, gap - 0.08, { color: C.MID });
    x += cw + gap;
  });
  if (sp.caption) {
    card(s, 0.85, 5.35, 11.6, 0.95, { fill: C.ICE2 });
    s.addText(sp.caption, { x: 1.15, y: 5.35, w: 11.0, h: 0.95, fontFace: FONT, fontSize: 12.5, color: C.TEXT, lineSpacingMultiple: 1.2, valign: "middle" });
  }
  footer(s);
  return s;
}

function s_stack(sp) {
  if (sp.part) CUR_PART = sp.part;
  const s = pptx.addSlide(); contentBG(s);
  header(s, sp.kicker, sp.title);
  const layers = sp.layers || [];
  const n = layers.length;
  let top = 1.95;
  const h = Math.min(0.92, (6.75 - top - (n - 1) * 0.12) / n);
  layers.forEach((l, i) => {
    const py = top + i * (h + 0.12);
    card(s, 1.4, py, 10.5, h);
    const d = Math.min(0.6, h - 0.12);
    if (l.icon) iconCircle(s, 1.65, py + (h - d) / 2, d, icon(l.icon, "n"), { fill: C.ICE });
    s.addText(l.title, { x: 2.5, y: py + 0.08, w: 3.6, h: h - 0.16, fontFace: FONTL, fontSize: 15, bold: true, color: C.DARK, valign: "middle" });
    if (l.desc) s.addText(l.desc, { x: 6.2, y: py + 0.08, w: 5.5, h: h - 0.16, fontFace: FONT, fontSize: 11.5, color: C.MUTED, valign: "middle", lineSpacingMultiple: 1.1 });
    if (i < n - 1) arrowD(s, 6.65, py + h + 0.005, 0.11, { color: C.MID, w: 2 });
  });
  footer(s);
  return s;
}

function s_twocol(sp) {
  if (sp.part) CUR_PART = sp.part;
  const s = pptx.addSlide(); contentBG(s);
  header(s, sp.kicker, sp.title);
  const cols = [sp.left, sp.right];
  const maxItems = Math.max((sp.left && sp.left.items || []).length, (sp.right && sp.right.items || []).length);
  const cw = 5.95, gap = 0.25, x0 = 0.6, top = 2.0;
  const ch = Math.min(4.9, 1.35 + maxItems * 0.62 + 0.35);
  cols.forEach((c, i) => {
    if (!c) return;
    const px = x0 + i * (cw + gap);
    card(s, px, top, cw, ch, { fill: i === 0 ? C.WHITE : C.ICE2 });
    if (c.icon) iconCircle(s, px + 0.35, top + 0.35, 0.7, icon(c.icon, "n"), { fill: C.ICE });
    s.addText(c.title, { x: c.icon ? px + 1.2 : px + 0.35, y: top + 0.4, w: cw - 1.4, h: 0.6, fontFace: FONTL, fontSize: 18, bold: true, color: i === 0 ? C.NAVY : C.DARK, valign: "middle" });
    let iy = top + 1.3;
    (c.items || []).forEach(it => {
      const t = typeof it === "object" ? it.text : it;
      s.addShape(pptx.ShapeType.ellipse, { x: px + 0.45, y: iy + 0.06, w: 0.12, h: 0.12, fill: { color: C.ACCENT } });
      s.addText(t, { x: px + 0.75, y: iy - 0.06, w: cw - 1.1, h: 0.55, fontFace: FONT, fontSize: 12.5, color: C.TEXT, valign: "top", lineSpacingMultiple: 1.15 });
      iy += 0.62;
    });
  });
  footer(s);
  return s;
}

function s_image(sp) {
  if (sp.part) CUR_PART = sp.part;
  const s = pptx.addSlide(); contentBG(s);
  header(s, sp.kicker, sp.title);
  const top = 1.85, bot = sp.caption ? 6.5 : 6.9;
  const availW = 12.0, availH = bot - top;
  const scale = Math.min(availW / sp._size.width, availH / sp._size.height);
  const w = sp._size.width * scale, h = sp._size.height * scale;
  const opt = { ...sp._source, x: 0.66 + (availW - w) / 2, y: top + (availH - h) / 2, w, h };
  s.addImage(opt);
  if (sp.caption) s.addText(sp.caption, { x: 0.6, y: 6.55, w: 12.15, h: 0.4, align: "center", fontFace: FONT, fontSize: 12, italic: true, color: C.MUTED });
  footer(s);
  return s;
}

function s_quote(sp) {
  if (sp.part) CUR_PART = sp.part;
  const s = pptx.addSlide();
  s.background = { color: WHITE ? C.WHITE : C.DARK };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: PW, h: WHITE ? 0.007 : 0.09, fill: { color: C.ACCENT } });
  if (sp.kicker) s.addText(sp.kicker, { x: 0.85, y: 0.8, w: 11, h: 0.5, fontFace: FONT, fontSize: 14, bold: true, color: C.SUBLT, charSpacing: 2 });
  s.addText(sp.big, { x: 0.85, y: 1.35, w: 11.6, h: 1.6, fontFace: FONTL, fontSize: sp.bigSize || 27, bold: true, color: WHITE ? C.DARK : C.WHITE, lineSpacingMultiple: 1.15 });
  let cy = 3.4;
  if (sp.sub) {
    s.addShape(pptx.ShapeType.rect, { x: 0.85, y: 3.35, w: 3.0, h: WHITE ? 0.007 : 0.05, fill: { color: C.ACCENT } });
    s.addText(sp.sub, { x: 0.85, y: 3.65, w: 11.6, h: 0.5, fontFace: FONTL, fontSize: 17, bold: true, color: WHITE ? C.DARK : C.ICE });
    cy = 4.35;
  }
  const cards = sp.cards || [];
  if (cards.length) {
    const n = cards.length, gap = 0.2, x0 = 0.85, wTot = 11.6;
    const cw = (wTot - (n - 1) * gap) / n;
    let qx = x0;
    cards.forEach((q, i) => {
      s.addShape(WHITE ? pptx.ShapeType.rect : pptx.ShapeType.roundRect, { x: qx, y: cy, w: cw, h: 1.95, rectRadius: 0.08, fill: { color: WHITE ? C.WHITE : C.NAVY }, line: { color: WHITE ? C.LINE : C.MID, width: WHITE ? 0.5 : 1 } });
      numBadge(s, qx + 0.3, cy + 0.25, String(i + 1), { d: 0.5, fs: 17, fill: C.MID });
      s.addText(q.title, { x: qx + 0.3, y: cy + 0.87, w: cw - 0.6, h: 0.5, fontFace: FONTL, fontSize: 15.5, bold: true, color: WHITE ? C.DARK : C.WHITE });
      if (q.desc) s.addText(q.desc, { x: qx + 0.3, y: cy + 1.37, w: cw - 0.6, h: 0.5, fontFace: FONT, fontSize: 11.5, color: WHITE ? C.MUTED : C.ICE, lineSpacingMultiple: 1.15 });
      qx += cw + gap;
    });
  }
  if (sp.footnote) s.addText(sp.footnote, { x: 0.85, y: 6.5, w: 11.6, h: 0.4, fontFace: FONT, fontSize: 11.5, color: WHITE ? C.MUTED : C.ICE, valign: "middle" });
  footer(s, true);
  return s;
}

function s_bullets(sp) {
  if (sp.part) CUR_PART = sp.part;
  const s = pptx.addSlide(); contentBG(s);
  header(s, sp.kicker, sp.title);
  let iy = 2.1;
  (sp.bullets || []).forEach(b => {
    const t = typeof b === "object" ? b.text : b;
    s.addShape(pptx.ShapeType.ellipse, { x: 0.8, y: iy + 0.09, w: 0.15, h: 0.15, fill: { color: C.ACCENT } });
    s.addText(t, { x: 1.15, y: iy - 0.05, w: 11.3, h: 0.6, fontFace: FONT, fontSize: 14.5, color: C.TEXT, valign: "top", lineSpacingMultiple: 1.2 });
    iy += 0.72;
  });
  footer(s);
  return s;
}

const KINDS = {
  cover: s_cover, agenda: s_agenda, divider: s_divider, cards: s_cards,
  numbered: s_numbered, table: s_table, flow: s_flow, stack: s_stack,
  twocol: s_twocol, image: s_image, quote: s_quote, bullets: s_bullets,
};

// =====================================================================
async function build(deck, options = {}) {
  options = { theme: "deep-navy", ...options };
  THEME = themes[options.theme || "deep-navy"];
  if (!THEME) throw new Error(`Unknown theme: ${options.theme}`);
  DECK = deck;
  const specs = validate(deck, Object.keys(SOURCES), options.baseDir || process.cwd());
  C = THEME.palette;
  WHITE = options.theme === "white-cobalt";
  const font = options.font || process.env.DECK_FONT || DECK.font;
  if (font !== undefined && (typeof font !== "string" || !font.trim())) throw new Error("font must be a nonempty font family string");
  FONT = font || THEME.font.body;
  FONTL = font || THEME.font.heading;
  CUR_PART = PAGE = 0;
  pptx = new pptxgen();
  pptx.defineLayout({ name: "W", width: PW, height: PH });
  pptx.layout = "W";
  pptx.author = DECK.author || "";
  pptx.company = DECK.company || "";
  pptx.title = DECK.title || "";

  const addSlide = pptx.addSlide.bind(pptx);
  pptx.addSlide = () => configureSlide(addSlide(), { white: WHITE, body: FONT, heading: FONTL });
  await buildIcons(specs);
  for (const sp of specs.filter(s => s.kind === "image")) {
    if (!sharp) throw new Error("Image slides require sharp for aspect-ratio measurement. Run npm install in this skill directory.");
    const meta = await sharp(sp.image).metadata();
    if (!["png", "jpeg", "svg", "gif"].includes(meta.format)) throw new Error(`Unsupported image format: ${meta.format}; use PNG, JPEG, SVG, or GIF`);
    sp._size = { width: meta.width, height: meta.height };
    sp._source = { path: sp.image };
    if (meta.orientation > 1) {
      const { data, info } = await sharp(sp.image).autoOrient().png().toBuffer({ resolveWithObject: true });
      sp._source = { data: "image/png;base64," + data.toString("base64") };
      sp._size = info;
    }
  }
  specs.forEach((sp, i) => {
    try {
      const sl = KINDS[sp.kind](sp);
      if (sp.note) sl.addNotes(sp.note);
    } catch (err) { throw new Error(`Slide ${i + 1} (${sp.kind}): ${err.message}`); }
  });
  const version = process.env.DECK_VERSION || DECK.version || "v1";
  const base = DECK.file || "deck";
  const out = options.out || version + "-" + base + ".pptx";
  if (path.extname(out).toLowerCase() !== ".pptx") throw new Error("Output must end in .pptx");
  const zip = await JSZip.loadAsync(await pptx.write({ outputType: "nodebuffer" }));
  await normalizeGeneratedContentTypes(zip);
  // PptxGenJS 4 emits literal CRLF sentinels in notes; replace only the body runs.
  for (let i = 0; i < specs.length; i++) {
    validateDrawing(await zip.file(`ppt/slides/slide${i + 1}.xml`).async("string"), `Slide ${i + 1}`);
    const key = `ppt/notesSlides/notesSlide${i + 1}.xml`;
    zip.file(key, notesXml(await zip.file(key).async("string"), specs[i].note || ""));
  }
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  return { out, slides: specs.length, theme: options.theme || "deep-navy", bodyFont: FONT, headingFont: FONTL };
}

if (require.main === module) {
  (async () => {
    const { parseArgs } = require("node:util");
    const { values, positionals } = parseArgs({ allowPositionals: true, options: {
      theme: { type: "string", default: "deep-navy" }, out: { type: "string" }, font: { type: "string" },
    } });
    if (positionals.length !== 1) throw new Error("Usage: node scripts/build_pptx.js <deck.data.js> --theme deep-navy|white-cobalt --out deck.pptx [--font 'Font Family']");
    const specPath = path.resolve(positionals[0]);
    const result = await build(require(specPath), { ...values, baseDir: path.dirname(specPath) });
    console.log(`WROTE ${result.out} (${result.slides} slides; ${result.theme}; ${result.bodyFont} / ${result.headingFont})`);
  })().catch(err => { console.error(`[build-pptx] ${err.message}`); process.exitCode = 1; });
}
let pending = Promise.resolve();
module.exports = { build: (deck, options) => {
  const next = pending.then(() => build(deck, options));
  pending = next.catch(() => {});
  return next;
} };
