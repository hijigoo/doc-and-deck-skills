const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");
const sharp = require("sharp");
const { spawnSync } = require("node:child_process");
const { LAYOUTS } = require("./layouts.cjs");
const ROOT = path.resolve(__dirname, ".."), REPO = path.dirname(ROOT);
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "catalog.json"), "utf8"));

async function montage(images, out) {
  const width = 640, height = 360, columns = 3;
  const cells = await Promise.all(images.map(async (file, i) => ({
    input: await sharp(file).resize(width, height, { fit: "contain", background: "#ffffff" }).png().toBuffer(),
    left: i % columns * width, top: Math.floor(i / columns) * (height + 12),
  })));
  await sharp({ create: { width: width * columns, height: Math.ceil(images.length / columns) * (height + 12),
    channels: 3, background: "#D8DDE5" } }).composite(cells).png().toFile(out);
}

async function main() {
  const report = { checked: "2026-09-30", html: [], fontsBundled: true,
    powerpointOpenAndPlayback: "not performed", renderer: "LibreOffice", failures: [] };
  const directories = fs.readdirSync(path.join(REPO, "skills")).filter(name => fs.existsSync(path.join(REPO, "skills", name, "SKILL.md"))).sort();
  if (JSON.stringify(directories) !== JSON.stringify(catalog.samples.map(s => s.skill).sort())) {
    throw new Error("Sample catalog does not cover every local skill.");
  }
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
  try {
    for (const entry of catalog.samples) {
      const previews = path.join(ROOT, "previews", entry.skill);
      fs.mkdirSync(previews, { recursive: true });
      if (!fs.existsSync(path.join(ROOT, entry.output))) throw new Error(`Missing result ${entry.output}`);
      if (entry.slides !== 15 || JSON.stringify(entry.layouts) !== JSON.stringify(LAYOUTS)) {
        throw new Error(`${entry.skill}: all-template coverage mismatch`);
      }
      const shots = [];
      if (entry.output.endsWith(".html")) {
        const check = spawnSync(process.execPath, [path.join(REPO, "skills", entry.skill, "scripts/verify.cjs"), path.join(ROOT, entry.output)], {
          encoding: "utf8", env: { ...process.env, NODE_PATH: path.join(ROOT, "node_modules") },
        });
        if (check.error || !check.stdout.trim()) throw check.error || new Error(check.stderr);
        const result = JSON.parse(check.stdout);
        result.file = entry.output;
        if (!result.ok || result.count !== entry.slides) report.failures.push(entry.skill);
        const isolated = path.join(ROOT, ".cache/isolated", entry.skill);
        fs.mkdirSync(isolated, { recursive: true });
        const singleFile = path.join(isolated, "document.html");
        fs.copyFileSync(path.join(ROOT, entry.output), singleFile);
        const context = await browser.newContext({ offline: true, viewport: { width: 1920, height: 1200 } });
        const page = await context.newPage(), network = [], errors = [];
        page.on("requestfailed", r => network.push(`${r.url().slice(0, 160)}: ${r.failure()?.errorText}`));
        page.on("request", r => { if (/^https?:/.test(r.url())) network.push(r.url()); });
        page.on("pageerror", e => errors.push(e.message));
        await page.goto(pathToFileURL(singleFile).href);
        await page.evaluate(() => document.fonts.ready);
        await page.addStyleTag({ content: ".slide .reveal,.slide .stagger>*{transition:none!important;animation:none!important;opacity:1!important;transform:none!important}" });
        const overflow = await page.evaluate(() => [...document.querySelectorAll(".slide p,.slide h1,.slide h2,.slide h3,.slide td,.slide th,.slide pre")].filter(el =>
          (getComputedStyle(el).overflowY !== "visible" && el.scrollHeight > el.clientHeight + 2) ||
          el.scrollWidth > el.clientWidth + 2).map(el => el.innerText));
        const layouts = await page.locator(".sheet .slide").evaluateAll(els => els.map(el => el.dataset.layout));
        if (!entry.skill.endsWith("pptx-to-html") && JSON.stringify(layouts) !== JSON.stringify(LAYOUTS)) {
          report.failures.push(`${entry.skill}: actual layouts missing`);
        }
        const linkedResources = await page.evaluate(() => [...document.querySelectorAll("img[src],script[src],link[rel=stylesheet],object[data],video[src],source[src]")]
          .map(el => el.getAttribute("src") || el.getAttribute("href") || el.getAttribute("data"))
          .filter(url => url && !url.startsWith("data:") && !url.startsWith("#")));
        if (overflow.length || network.length || errors.length || linkedResources.length) report.failures.push(`${entry.skill}: overflow/resource/runtime failure`);
        Object.assign(result, { textOverflow: overflow, resourceFailures: network, layouts: entry.layouts,
          isolatedOffline: { onlyHtmlCopied: true, linkedResources, errors } });
        const notes = page.locator(".note").first();
        await notes.locator(".note-head").click();
        result.noteToggle = await notes.evaluate(el => el.classList.contains("collapsed"));
        await notes.locator(".note-head").click();
        if (!result.noteToggle) report.failures.push(`${entry.skill}: note toggle`);
        if (entry.skill.endsWith("pptx-to-html")) {
          const popupPromise = context.waitForEvent("page");
          await page.locator(".preserved-slide a").first().click();
          const popup = await popupPromise;
          await popup.waitForLoadState("domcontentloaded");
          result.embeddedOriginalOpens = await popup.locator("svg").count() === 1;
          await popup.close();
          if (!result.embeddedOriginalOpens) report.failures.push(`${entry.skill}: embedded original link`);
        }
        await page.emulateMedia({ media: "print" });
        result.printVisible = await page.locator(".sheet .slide").evaluateAll(slides =>
          slides.every(el => getComputedStyle(el).visibility !== "hidden" && getComputedStyle(el).display !== "none"));
        await page.emulateMedia({ media: "screen" });
        if (!result.printVisible) report.failures.push(`${entry.skill}: print visibility`);
        for (let i = 0; i < entry.slides; i++) {
          const slide = page.locator(".sheet .slide").nth(i);
          await slide.evaluate(el => { el.classList.add("visible"); el.scrollIntoView({ behavior: "instant", block: "center" }); });
          const shot = path.join(previews, `slide-${String(i + 1).padStart(2, "0")}.png`);
          await slide.screenshot({ path: shot });
          shots.push(shot);
        }
        await context.close();
        report.html.push(result);
        console.log(`${entry.skill}: ${result.ok && !overflow.length && !network.length && !errors.length ? "OK" : "FAIL"} (15 templates, offline single file)`);
      } else {
        for (let i = 1; i <= entry.slides; i++) shots.push(path.join(previews, `slide-${String(i).padStart(2, "0")}.png`));
      }
      await montage(shots, path.join(previews, "overview.png"));
      for (let start = 0; start < shots.length; start += 5) {
        await montage(shots.slice(start, start + 5), path.join(previews, `group-${start / 5 + 1}.png`));
      }
    }
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(ROOT, "validation.json"), JSON.stringify(report, null, 2) + "\n");
  if (report.failures.length) throw new Error(report.failures.join("\n"));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
