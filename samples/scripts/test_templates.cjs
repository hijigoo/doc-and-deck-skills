const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { LAYOUTS, chapters, escape } = require("./layouts.cjs");
const ROOT = path.resolve(__dirname, ".."), SKILLS = path.join(ROOT, "../skills");
const NEW_LAYOUTS = ["decision", "pyramid", "funnel", "riskmap", "swimlane"];
const specs = [...fs.readFileSync(path.join(ROOT, "shared/foundry.md"), "utf8").matchAll(/```json\n([\s\S]*?)\n```/g)]
  .map(match => ({ ...JSON.parse(match[1]), notes: "검증용 설명과 발표 스크립트" }));
const sources = JSON.parse(fs.readFileSync(path.join(ROOT, "shared/sources.json"), "utf8")).sources;
const skills = fs.readdirSync(SKILLS).filter(name => fs.existsSync(path.join(SKILLS, name, "SKILL.md"))).sort();

test("catalog has twenty distinct layouts and ten independent skill packages", () => {
  assert.equal(LAYOUTS.length, 20);
  assert.equal(new Set(LAYOUTS).size, 20);
  assert.deepEqual(LAYOUTS.slice(14, 19), NEW_LAYOUTS);
  assert.equal(LAYOUTS.at(-1), "closing");
  assert.equal(skills.length, 10);
  assert.deepEqual(specs.map(spec => spec.kind), LAYOUTS);
});

for (const skill of skills) {
  const theme = skill.startsWith("deep-navy") ? "deep-navy" : "white-cobalt";
  const template = path.join(SKILLS, skill, "deck.html");
  test(`${skill}: all twenty templates, notes and guide entries are distributed locally`, () => {
    const html = fs.readFileSync(template, "utf8");
    const sections = [...html.matchAll(/<article\b[^>]*class="chapter"[^>]*>[\s\S]*?<\/article>/g)].map(match => match[0]);
    assert.deepEqual(sections.map(section => section.match(/data-layout="([^"]+)"/)[1]), LAYOUTS);
    for (const section of sections) {
      assert.equal((section.match(/class="sheet"/g) || []).length, 1);
      assert.equal((section.match(/class="note-body"/g) || []).length, 1);
      if (theme === "white-cobalt") {
        assert.match(section, /class="chrome"/);
        assert.match(section, /class="sq"/);
        assert.doesNotMatch(section, /class="s-foot"/);
      }
    }
    assert.equal(html, fs.readFileSync(path.join(SKILLS, `${theme}-md-to-html/deck.html`), "utf8"));
    const guide = fs.readFileSync(path.join(SKILLS, skill, "references/guide.md"), "utf8");
    for (const name of LAYOUTS) assert.ok(guide.includes(`\`${name}\``), `${skill}: undocumented ${name}`);
    const instruction = fs.readFileSync(path.join(SKILLS, skill, "SKILL.md"), "utf8");
    assert.match(instruction, new RegExp(`^---\\nname: ${skill}\\ndescription: .+\\n---`));
  });
  test(`${skill}: actual sample content populates every template without missing slots`, () => {
    const result = chapters(specs, theme, sources, template);
    assert.equal(result.records.length, 20);
    assert.doesNotMatch(result.html, /<!-- slot:/);
    for (const spec of specs.filter(spec => NEW_LAYOUTS.includes(spec.kind))) {
      for (const item of spec.items || []) {
        assert.ok(result.html.includes(escape(item.title)), item.title);
        assert.ok(result.html.includes(escape(item.desc)), item.desc);
      }
    }
  });
}

test("incomplete, duplicated or reordered template coverage fails explicitly", () => {
  const template = path.join(SKILLS, "deep-navy-md-to-html/deck.html");
  for (const incomplete of [specs.slice(0, 19), [...specs.slice(0, 19), specs[0]], specs.toReversed()]) {
    assert.throws(() => chapters(incomplete, "deep-navy", sources, template), /all 20 layouts exactly once/);
  }
});
