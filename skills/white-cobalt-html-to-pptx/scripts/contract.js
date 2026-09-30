const fs = require("fs");
const path = require("path");

const navy = {
  DARK: "0F2547", NAVY: "1A3D6D", MID: "2F5B93", SKY: "7AA5D6",
  ICE: "DBE7F6", ICE2: "EEF4FB", BG: "F5F8FC", ACCENT: "4F8FB6",
  ACCENT2: "6FA9CC", GOLD: "F5B841", GREEN: "2E9E6B", TEXT: "1B2A41",
  MUTED: "5F708A", LINE: "D4E0F0", WHITE: "FFFFFF", SUBLT: "C7D8EC",
};
const themes = {
  "deep-navy": {
    palette: navy, font: { body: "Apple SD Gothic Neo", heading: "Apple SD Gothic Neo" },
    shadow: { type: "outer", color: "1A2A44", opacity: 0.22, blur: 8, offset: 3, angle: 90 },
    progress: { height: 0.075, gap: 0.05 },
  },
  "white-cobalt": {
    palette: { ...navy, DARK: "0E0E0E", NAVY: "0F62FE", MID: "0F62FE", SKY: "525252",
      ICE: "F1F5FF", ICE2: "FFFFFF", BG: "FFFFFF", ACCENT: "0F62FE",
      ACCENT2: "0F62FE", GOLD: "0F62FE", GREEN: "0F62FE", TEXT: "0E0E0E",
      MUTED: "525252", LINE: "D6D6D6", SUBLT: "525252" },
    font: { body: "IBM Plex Sans KR", heading: "Archivo" },
    progress: { height: 0.007, gap: 0.05 },
  },
};
const kinds = "cover agenda divider cards numbered table flow stack twocol image quote bullets".split(" ");
const object = v => v !== null && typeof v === "object" && !Array.isArray(v);
function expect(ok, message) { if (!ok) throw new Error(message); }
function text(v, label, required = false) {
  expect((!required && v === undefined) || (typeof v === "string" && (!required || v.trim())), `${label} must be ${required ? "nonempty " : ""}text`);
  if (typeof v === "string") expect(!/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(v), `${label} contains invalid XML control characters`);
}
function list(value, label, min, max) {
  expect(Array.isArray(value) && value.length >= min && value.length <= max, `${label} requires ${min}–${max} entries; split dense content across slides`);
}
function estimatedLines(value, width, fontSize) {
  const lineWidth = Math.max(1, (width * 72 - 10) / fontSize);
  return String(value).split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(
    [...line].reduce((w, c) => w + (/[^\x00-\x7F]/.test(c) ? 1 : 0.5), 0) / lineWidth,
  )), 0);
}
function validate(deck, icons, baseDir) {
  expect(object(deck), "Deck must export an object");
  text(deck.title, "Deck.title", true);
  for (const k of ["author", "company", "version", "file"]) text(deck[k], `Deck.${k}`);
  expect(deck.slides === undefined || Array.isArray(deck.slides), "Deck.slides must be an array");
  expect(deck.cover === undefined || object(deck.cover), "Deck.cover must be an object");
  const specs = (deck.cover ? [{ ...deck.cover, kind: "cover" }] : []).concat(deck.slides || []);
  list(specs, "Deck", 1, 500);
  function checkIcons(value) {
    if (!value || typeof value !== "object") return;
    if (Object.hasOwn(value, "icon")) expect(icons.includes(value.icon), `Unknown icon: ${value.icon}`);
    Object.values(value).forEach(checkIcons);
  }
  checkIcons(specs);
  function item(value, label) {
    expect(object(value), `${label} must be an object`);
    text(value.title, `${label}.title`, true);
    for (const k of ["desc", "icon", "time"]) text(value[k], `${label}.${k}`);
    if (value.icon !== undefined) expect(icons.includes(value.icon), `Unknown icon: ${value.icon}`);
    if (value.badge !== undefined) {
      expect(object(value.badge), `${label}.badge must be an object`);
      text(value.badge.text, `${label}.badge.text`, true);
      expect(["ga", "prev", "mid"].includes(value.badge.kind), `${label}.badge.kind must be ga, prev, or mid`);
    }
  }
  function entries(sp, field, max, label) {
    list(sp[field], `${label}.${field}`, 1, max);
    sp[field].forEach((v, i) => item(v, `${label}.${field}[${i}]`));
  }
  function texts(values, label, max) {
    list(values, label, 1, max);
    values.forEach((v, i) => text(object(v) ? v.text : v, `${label}[${i}]`, true));
  }
  return specs.map((input, i) => {
    const label = `Slide ${i + 1}`;
    expect(object(input), `${label} must be an object`);
    const sp = { ...input };
    expect(kinds.includes(sp.kind), `${label}: Unknown kind: ${sp.kind}`);
    for (const k of ["kicker", "subtitle", "subtitle2", "meta", "label", "sub", "intro", "caption", "footnote", "icon", "note"]) text(sp[k], `${label}.${k}`);
    if (sp.kind !== "quote") text(sp.title, `${label}.title`, sp.kind !== "agenda");
    if (sp.icon !== undefined) expect(icons.includes(sp.icon), `Unknown icon: ${sp.icon}`);
    if (sp.part !== undefined) expect(Number.isInteger(sp.part) && sp.part >= 1 && sp.part <= 4, `${label}.part must be 1–4`);
    for (const k of ["fs", "rowH", "titleSize", "bigSize"]) if (sp[k] !== undefined) expect(Number.isFinite(sp[k]) && sp[k] > 0, `${label}.${k} must be positive`);
    switch (sp.kind) {
      case "agenda": case "numbered": entries(sp, "items", 6, label); break;
      case "cards":
        entries(sp, "cards", 6, label);
        if (sp.cols !== undefined) expect(Number.isInteger(sp.cols) && sp.cols >= 1 && sp.cols <= 3, `${label}.cols must be 1–3`);
        expect(Math.ceil(sp.cards.length / (sp.cols || (sp.cards.length <= 3 ? sp.cards.length : sp.cards.length === 4 ? 2 : 3))) <= 2, `${label}: cards support at most two rows`);
        break;
      case "flow": entries(sp, "steps", 6, label); break;
      case "stack": entries(sp, "layers", 7, label); break;
      case "twocol":
        for (const side of ["left", "right"]) { item(sp[side], `${label}.${side}`); texts(sp[side].items, `${label}.${side}.items`, 6); }
        break;
      case "bullets": texts(sp.bullets, `${label}.bullets`, 6); break;
      case "quote":
        text(sp.big, `${label}.big`, true);
        if (sp.cards !== undefined) {
          list(sp.cards, `${label}.cards`, 0, 3);
          sp.cards.forEach((v, j) => item(v, `${label}.cards[${j}]`));
        }
        break;
      case "table":
        list(sp.head, `${label}.head`, 1, 8); list(sp.rows, `${label}.rows`, 1, 12);
        [sp.head, ...sp.rows].forEach((row, j) => {
          list(row, `${label}.row[${j}]`, sp.head.length, sp.head.length);
          row.forEach(cell => {
            const value = object(cell) ? cell.text : cell;
            expect(typeof value === "string" || typeof value === "number", `${label}: table cell must be text or number`);
            if (typeof value === "string") text(value, `${label}.cell`);
            if (object(cell) && cell.color !== undefined) expect(/^[0-9a-f]{6}$/i.test(cell.color), `${label}: cell.color requires six hex digits`);
          });
        });
        if (sp.colW) expect(Array.isArray(sp.colW) && sp.colW.length === sp.head.length && sp.colW.every(v => Number.isFinite(v) && v > 0) && Math.abs(sp.colW.reduce((a,b) => a+b,0) - 12.15) < 0.01, `${label}.colW must be positive widths summing to 12.15 inches`);
        {
          const height = sp.rowH || Math.min(0.6, (6.5 - (sp.intro ? 2.55 : 2)) / (sp.rows.length + 1));
          expect(height * (sp.rows.length + 1) <= 6.5 - (sp.intro ? 2.55 : 2) + 0.001, `${label}: table is too tall`);
          [sp.head, ...sp.rows].forEach(row => row.forEach((cell, j) => {
            const lines = estimatedLines(object(cell) ? cell.text : cell, sp.colW ? sp.colW[j] : 12.15 / sp.head.length, sp.fs || 11.5);
            expect(lines * (sp.fs || 11.5) * 1.15 + 6 <= height * 72, `${label}: table text cannot fit; shorten cells or split the table`);
          }));
        }
        break;
      case "image":
        text(sp.image, `${label}.image`, true);
        sp.image = path.resolve(baseDir, sp.image);
        expect(fs.existsSync(sp.image) && fs.statSync(sp.image).isFile(), `${label}: image does not exist: ${sp.image}`);
        break;
    }
    return sp;
  });
}

function configureSlide(slide, fonts) {
  for (const method of ["addText", "addShape", "addImage"]) {
    const add = slide[method].bind(slide);
    slide[method] = (...args) => {
      const opts = method === "addImage" ? args[0] : args[1];
      for (const k of ["x", "y", "w", "h"]) expect(Number.isFinite(opts[k]) && opts[k] >= 0, `${method}.${k}: invalid extent; split dense content`);
      expect(opts.x + opts.w <= 13.334 && opts.y + opts.h <= 7.501, `${method}: content extends beyond the slide`);
      if (method === "addText") {
        if (fonts.white && opts.fontFace === fonts.heading && /[^\x00-\x7F]/.test(args[0])) opts.fontFace = fonts.body;
        const floor = Math.min(10, opts.fontSize);
        const lines = estimatedLines(args[0], opts.w, floor);
        expect(lines * floor * 1.1 <= opts.h * 72 + 2, `Text cannot fit legibly: "${String(args[0]).slice(0, 50)}"; shorten it or split the slide`);
        // Preserve legacy shape geometry; Office may shrink text, never grow over neighbors.
        opts.fit = "shrink";
      }
      return add(...args);
    };
  }
  return slide;
}
const escapeXml = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function notesXml(xml, note) {
  const runs = note.replace(/\r\n?/g, "\n").split("\n").map(line => `<a:r><a:rPr lang="en-US" dirty="0"/><a:t>${escapeXml(line)}</a:t></a:r>`).join("<a:br/>");
  return xml.replace(/(<p:ph type="body"[\s\S]*?<a:p>)[\s\S]*?(<a:endParaRPr)/, (_, start, end) => start + runs + end);
}
function validateDrawing(xml, label) {
  for (const match of xml.matchAll(/<(?:a|p):xfrm\b[^>]*>([\s\S]*?)<\/(?:a|p):xfrm>/g)) {
    const off = match[1].match(/<a:off x="(-?\d+)" y="(-?\d+)"/);
    const ext = match[1].match(/<a:ext cx="(-?\d+)" cy="(-?\d+)"/);
    if (!off || !ext) continue;
    const [x, y, w, h] = [off[1], off[2], ext[1], ext[2]].map(Number);
    expect(x >= 0 && y >= 0 && w >= 0 && h >= 0 && x + w <= 12191696 && y + h <= 6858001, `${label}: shape/table extends beyond the slide; split the content`);
  }
}
async function normalizeGeneratedContentTypes(zip) {
  const part = zip.file("[Content_Types].xml");
  expect(part, "Generated PPTX is missing [Content_Types].xml");
  const xml = await part.async("string");
  // PptxGenJS 4 declares one slide master per slide, even when it writes only
  // one master. Remove only those nonexistent master declarations, not parts.
  const normalized = xml.replace(/<Override\b[^>]*\/>/g, declaration => {
    const target = declaration.match(/\bPartName="([^"]+)"/)?.[1];
    const type = declaration.match(/\bContentType="([^"]+)"/)?.[1];
    expect(target && type, "Unexpected generated content-type declaration");
    if (zip.file(target.slice(1))) return declaration;
    expect(/^\/ppt\/slideMasters\/slideMaster\d+\.xml$/.test(target) &&
      type === "application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml",
      `Generated content type references missing part: ${target}`);
    return "";
  });
  zip.file("[Content_Types].xml", normalized);
}
module.exports = { themes, validate, configureSlide, notesXml, validateDrawing, normalizeGeneratedContentTypes };
