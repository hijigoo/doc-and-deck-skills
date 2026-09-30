const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { LAYOUTS, chapters, offlineFonts, escape } = require("./layouts.cjs");
const { port } = require("./port_html.cjs");
const ROOT = path.resolve(__dirname, ".."), REPO = path.dirname(ROOT);
const PYTHON = process.env.PYTHON || "python3";
const sources = JSON.parse(fs.readFileSync(path.join(ROOT, "shared/sources.json"), "utf8"));
const manuscript = fs.readFileSync(path.join(ROOT, "shared/foundry.md"), "utf8");
const topicBrief = fs.readFileSync(path.join(ROOT, "shared/topic-brief.md"), "utf8");
const themes = ["deep-navy", "white-cobalt"], registry = [];
const cache = path.join(ROOT, ".cache");
const run = (cmd, args, env = {}) => execFileSync(cmd, args, {
  cwd: ROOT, env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1", NODE_PATH: path.join(ROOT, "node_modules"), ...env }, stdio: "inherit",
});
function readSlides(markdown) {
  return markdown.split(/^## \d+/m).slice(1).map(section => {
    const match = section.match(/```json\n([\s\S]*?)\n```/);
    if (!match) throw new Error("Sample section lacks layout data.");
    const data = JSON.parse(match[1]);
    for (const id of data.sources) if (!sources.sources[id]) throw new Error(`Unknown source ${id}`);
    data.notes = section.slice(section.indexOf(match[0]) + match[0].length).trim().replace(/^### /gm, "");
    return data;
  });
}
function packageHtml(input, out, skillName, manifest) {
  const fontDir = path.join(ROOT, "assets/fonts");
  const licenses = fs.readdirSync(fontDir).filter(name => /OFL|LICENSE/i.test(name))
    .map(name => ({ file: name, text: fs.readFileSync(path.join(fontDir, name), "utf8") }));
  if (!licenses.length) throw new Error("Bundled font license notices are missing.");
  const html = fs.readFileSync(input, "utf8");
  fs.writeFileSync(input, html.replace("</body>", `<script type="application/json" id="bundled-font-licenses">${JSON.stringify(licenses).replaceAll("<", "\\u003c")}</script></body>`));
  run(PYTHON, [path.join(REPO, "skills", skillName, "scripts/standalone_html.py"), input, "--out", out,
    ...(manifest ? ["--manifest", manifest] : [])]);
}
function htmlSample(skillName, slides, filename, sourceMd, standalone) {
  const skill = path.join(REPO, "skills", skillName), output = path.join(ROOT, skillName);
  const work = path.join(cache, "work", skillName);
  fs.mkdirSync(work, { recursive: true });
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(work, "input.md"), sourceMd);
  const theme = skillName.startsWith("deep-navy") ? "deep-navy" : "white-cobalt";
  const populated = chapters(slides, theme, sources.sources, path.join(skill, "deck.html"));
  fs.writeFileSync(path.join(work, "chapters.fragment.html"), populated.html);
  const assembled = path.join(work, filename);
  run(PYTHON, [path.join(skill, "scripts/build_html.py"), path.join(work, "chapters.fragment.html"),
    "--title", "Microsoft Foundry on Azure", "--subtitle", "15개 템플릿으로 읽는 모델·에이전트·운영 판단",
    "--kicker", "OFFICIAL-SOURCE FIELD GUIDE", "--meta", "15 Chapters|한국어 기술 입문|2026-09-30",
    "--intro", "공식 문서 기반 설명 자료입니다. 개념 설계·가상 수치는 실제 배포·평가와 구분합니다.",
    "-o", assembled]);
  const fontBase = path.relative(work, path.join(ROOT, "assets/fonts")).split(path.sep).join("/") + "/";
  fs.writeFileSync(assembled, offlineFonts(fs.readFileSync(assembled, "utf8"), fontBase));
  const final = path.join(output, filename);
  if (standalone) packageHtml(assembled, final, skillName);
  else {
    const packer = `${theme}-md-to-html`;
    packageHtml(assembled, final, packer);
  }
  const coverage = { template: `skills/${skillName}/deck.html`, template_sha256: populated.template_sha256,
    slides: populated.records };
  fs.writeFileSync(path.join(work, "template-coverage.json"), JSON.stringify(coverage, null, 2) + "\n");
  return { final, coverage };
}
function entry(skill, output, input, mode, coverage) {
  registry.push({ skill, output: `${skill}/${output}`, slides: 15, input, mode, layouts: LAYOUTS, coverage });
}
async function main() {
  const slides = readSlides(manuscript);
  const htmlOnly = process.argv.includes("--html-only");
  for (const theme of themes) {
    const htmlSkill = `${theme}-md-to-html`;
    const html = htmlSample(htmlSkill, slides, "foundry.html", manuscript, true);
    entry(htmlSkill, "foundry.html", "shared/foundry.md", "standalone HTML; all actual templates", html.coverage);
    const topicSkill = `${theme}-topic-to-html`;
    const topic = htmlSample(topicSkill, slides, "topic.html", topicBrief + "\n\n" + manuscript, true);
    entry(topicSkill, "topic.html", "shared/topic-brief.md + shared/foundry.md", "researched standalone HTML; all actual templates", topic.coverage);
    const mdSkill = `${theme}-md-to-pptx`, mdDir = path.join(ROOT, mdSkill);
    const intermediate = htmlSample(mdSkill, slides, "intermediate.html", manuscript, false);
    if (htmlOnly) continue;
    const portSkill = `${theme}-html-to-pptx`, portDir = path.join(ROOT, portSkill);
    fs.mkdirSync(portDir, { recursive: true });
    for (const [skillName, dir, input, animate, coverage] of [
      [portSkill, portDir, html.final, true, html.coverage],
      [mdSkill, mdDir, intermediate.final, theme !== "deep-navy", intermediate.coverage],
    ]) {
      const skill = path.join(REPO, "skills", skillName), out = path.join(dir, "foundry.pptx");
      await port(input, out, skill, animate);
      if (animate) run(PYTHON, [path.join(skill, "scripts/add_animations.py"), out, path.join(dir, "anim-manifest.json")]);
      run(PYTHON, [path.join(skill, "scripts/check_pptx.py"), out]);
      entry(skillName, "foundry.pptx", skillName === mdSkill ? "shared/foundry.md" : `${htmlSkill}/foundry.html`,
        `${skillName === mdSkill ? "Markdown → own HTML templates → " : ""}native text/tables/shapes; SVG and complex CSS decorations as images${animate ? "; entrance effects" : "; static"}`, coverage);
    }
  }
  if (htmlOnly) { console.log("Built six template-based HTML stages; PPTX and catalog not updated."); return; }
  const fontConfig = `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${escape(path.join(ROOT, "assets/fonts"))}</dir><cachedir>${escape(path.join(cache, "fonts"))}</cachedir></fontconfig>`;
  fs.writeFileSync(path.join(cache, "fonts.conf"), fontConfig);
  for (const result of registry.filter(r => r.output.endsWith(".pptx"))) {
    const dir = path.join(ROOT, result.skill);
    run("soffice", [`-env:UserInstallation=${require("node:url").pathToFileURL(path.join(cache, "lo-profile")).href}`,
      "--headless", "--convert-to", "pdf", "--outdir", dir, path.join(ROOT, result.output)],
    { FONTCONFIG_FILE: path.join(cache, "fonts.conf") });
    const previews = path.join(ROOT, "previews", result.skill);
    fs.mkdirSync(previews, { recursive: true });
    run("pdftoppm", ["-scale-to", "1200", "-png", path.join(dir, "foundry.pdf"), path.join(previews, "slide")]);
  }
  for (const theme of themes) {
    const skillName = `${theme}-pptx-to-html`, skill = path.join(REPO, "skills", skillName);
    const work = path.join(cache, "work", skillName), output = path.join(ROOT, skillName);
    const source = path.join(ROOT, `${theme}-html-to-pptx`);
    fs.mkdirSync(work, { recursive: true });
    fs.mkdirSync(output, { recursive: true });
    for (const ext of ["pptx", "pdf"]) fs.copyFileSync(path.join(source, `foundry.${ext}`), path.join(work, `source.${ext}`));
    run(PYTHON, [path.join(skill, "scripts/extract_pptx.py"), path.join(work, "source.pptx"),
      "--json", path.join(work, "source.json"), "--img-dir", path.join(work, "assets")]);
    run(PYTHON, [path.join(skill, "scripts/preserve_pptx.py"), path.join(work, "source.pptx"),
      "--pdf", path.join(work, "source.pdf"), "--out", work, "--renderer", "LibreOffice"]);
    const html = path.join(work, "index.html");
    fs.writeFileSync(html, offlineFonts(fs.readFileSync(html, "utf8"), "../../../assets/fonts/"));
    packageHtml(html, path.join(output, "index.html"), skillName, path.join(work, "manifest.json"));
    entry(skillName, "index.html", `${theme}-html-to-pptx/foundry.pptx`,
      "standalone HTML; static original render; embedded pages/assets; notes + transcript", registry.find(r => r.skill === `${theme}-html-to-pptx`).coverage);
  }
  fs.writeFileSync(path.join(ROOT, "catalog.json"), JSON.stringify({
    subject: "Microsoft Foundry on Azure", checked: sources.checked, layouts: LAYOUTS,
    samples: registry.sort((a, b) => a.skill.localeCompare(b.skill)),
    limitations: ["PowerPoint native open/playback not verified.", "SVG diagrams and complex CSS decorations in PPTX are images; other text/tables/basic shapes are native.", "PPTX-to-HTML is static LibreOffice rendering.", "Illustrative chart values are not measured performance."],
  }, null, 2) + "\n");
  console.log(`Built ${registry.length} samples with all ${LAYOUTS.length} templates.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
