// Two-slide API sample, not a port of the 15-layout deck.html or arbitrary HTML.
const fs = require("node:fs");
const path = require("node:path");
const pptxgen = require("pptxgenjs");
const JSZip = require(require.resolve("jszip", { paths: [require.resolve("pptxgenjs")] }));
const { normalizeGeneratedContentTypes } = require("./contract");

const px = value => value / 144;
const pt = value => value / 2;
const C = {
  paper: "F4F2ED", navy: "0E2340", accent: "2C6BED",
  ink: "0B1622", muted: "5A6A7D", line: "D8D3C9", white: "FFFFFF",
};
const sans = process.env.DECK_SANS || "Pretendard Variable";
const latin = process.env.DECK_LATIN || "Manrope";
const directory = process.env.DECK_QA_DIR || path.join(process.cwd(), "output", "reference");
const out = process.env.DECK_PPTX || path.join(directory, "deep-navy-reference.pptx");
const manifestPath = process.env.DECK_MANIFEST || path.join(directory, "anim-manifest.json");
const deck = new pptxgen();
deck.layout = "LAYOUT_WIDE";
deck.title = "Deep Navy porting API sample";
const manifest = [];
let entries;

function slide() {
  const result = deck.addSlide();
  result.background = { color: C.paper };
  entries = [];
  manifest.push(entries);
  return result;
}

function text(target, content, x, y, w, h, size, options = {}, effect = 0) {
  target.addText(content, {
    x: px(x), y: px(y), w: px(w), h: px(h),
    fontFace: sans, fontSize: pt(size), color: C.ink,
    margin: 0, valign: "top", breakLine: false, ...options,
  });
  entries.push(effect);
}

function box(target, x, y, w, h, color, effect = 0) {
  target.addShape(deck.ShapeType.rect, {
    x: px(x), y: px(y), w: px(w), h: px(h),
    fill: { color }, line: { color, transparency: 100 },
  });
  entries.push(effect);
}

function notes(target, value) {
  if (value.includes("\u2424")) throw new Error("Notes contain the reserved newline sentinel.");
  target.addNotes(value.replace(/\r\n?/g, "\n").replace(/\n/g, "\u2424"));
}

async function main() {
  const first = slide();
  box(first, 112, 380, 1696, 540, C.navy, 4);
  text(first, "DEEP NAVY / PORTING API", 112, 70, 1696, 44, 26,
    { fontFace: latin, color: C.accent, bold: true }, 1);
  text(first, "원본의 정보와 디자인을 함께 옮깁니다", 112, 170, 1696, 120, 64,
    { bold: true, color: C.navy }, 2);
  text(first, "편집 가능한 글자와 도형 · 원본 자산 · 장별 발표자 노트",
    112, 300, 1696, 60, 32, { color: C.muted }, 3);
  text(first, "배치 · 색 · 폰트", 160, 440, 1560, 96, 52,
    { bold: true, color: C.white }, 4);
  text(first, "이 예제의 좌표는 API 설명용입니다.\n실제 입력 HTML의 측정값으로 바꿔 사용합니다.",
    160, 600, 1560, 210, 38, { color: C.white }, 4);
  notes(first, "첫 문단: 예제의 목적을 설명합니다.\n둘째 줄: 원본 HTML을 측정합니다.\n\n다음 문단: 출처와 상세 스크립트를 유지합니다.");

  const second = slide();
  text(second, "값과 노트는 줄이지 않고 보존합니다", 112, 100, 1696, 120, 64,
    { bold: true, color: C.navy });
  const rows = [
    ["검토 항목", "보존 기준"],
    ["표 전체", "행 · 열 · 값 · 단위"],
    ["원본 자산", "비율 · 크롭 · 연결 관계"],
    ["발표자 노트", "문단 · 줄바꿈 · 출처"],
  ].map((row, index) => row.map(value => ({
    text: value,
    options: {
      bold: index === 0, color: index === 0 ? C.white : C.ink,
      fill: index === 0 ? C.navy : C.white,
    },
  })));
  second.addTable(rows, {
    x: px(112), y: px(330), w: px(1696), colW: [px(540), px(1156)],
    rowH: px(120), fontFace: sans, fontSize: pt(36), margin: 12,
    border: { type: "solid", color: C.line, pt: 0.5 }, autoPage: false,
  });
  entries.push(0);
  notes(second, "이 장은 정적 원본을 가정하므로 애니메이션을 추가하지 않습니다.\n표의 전체 행과 열을 확인합니다.");

  const zip = await JSZip.loadAsync(await deck.write({ outputType: "nodebuffer" }));
  await normalizeGeneratedContentTypes(zip);
  for (let index = 0; index < manifest.length; index++) {
    const xml = await zip.file(`ppt/slides/slide${index + 1}.xml`).async("string");
    const ids = [...xml.matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"/g)]
      .map(match => Number(match[1])).filter(id => id !== 1);
    if (ids.length !== manifest[index].length) {
      throw new Error(`Slide ${index + 1}: shape/manifest count mismatch.`);
    }
  }
  for (const file of [out, manifestPath]) fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(out, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`WROTE ${out}\nMANIFEST ${manifestPath}\nFONTS ${sans} / ${latin}`);
}

main().catch(error => { console.error(`[reference] ${error.message}`); process.exitCode = 1; });
