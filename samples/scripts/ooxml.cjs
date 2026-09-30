// PptxGenJS 4.0.1 derives table IDs from slide numbers, which can collide with
// text IDs. Only repair fresh sample tables, before any timing references exist.
async function normalizeTableIds(zip) {
  for (const name of Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))) {
    let xml = await zip.file(name).async("string");
    if (/<p:timing\b|<a:(?:stCxn|endCxn)\b/.test(xml)) {
      throw new Error(`${name}: table normalization requires a fresh unconnected slide.`);
    }
    const ids = [...xml.matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"/g)].map(m => Number(m[1]));
    let nextId = Math.max(...ids) + 1;
    xml = xml.replace(/<p:graphicFrame>[\s\S]*?<\/p:graphicFrame>/g, frame =>
      frame.includes("<a:tbl>") ? frame.replace(/(<p:cNvPr\b[^>]*\bid=")\d+(")/, (_, a, b) => a + nextId++ + b) : frame);
    const normalized = [...xml.matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"/g)].map(m => m[1]);
    if (new Set(normalized).size !== normalized.length) throw new Error(`${name}: duplicate non-table IDs.`);
    zip.file(name, xml);
  }
}
module.exports = { normalizeTableIds };
