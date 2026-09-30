#!/usr/bin/env node
// One verifier for both reading themes. Also accepts legacy presentation HTML.
const { chromium } = require("playwright");
const { pathToFileURL } = require("node:url");
const path = require("node:path");
const fs = require("node:fs");

async function inspect(page, index) {
  return page.evaluate((index) => {
    const slide = document.querySelectorAll(".sheet .slide, .deck-stage > .slide")[index];
    const issues = [];
    const bounds = slide.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return ["invisible slide"];
    const expectedRatio = Number(slide.dataset.sourceRatio || 16 / 9);
    if (!Number.isFinite(expectedRatio) || expectedRatio <= 0) issues.push("invalid source ratio");
    else if (Math.abs(bounds.width / bounds.height - expectedRatio) > 0.01) issues.push("unexpected slide ratio");
    const scale = bounds.width / 1920;
    const visible = (el) => {
      const cs = getComputedStyle(el);
      return cs.display !== "none" && cs.visibility !== "hidden" && el.getBoundingClientRect().width > 0;
    };
    for (const el of [slide, ...slide.querySelectorAll("*")]) {
      if (el.closest("svg,.slide-notes") || !visible(el)) continue;
      const box = el.getBoundingClientRect();
      if (!el.matches(".orb,.o1,.o2") &&
          (box.right > bounds.right + 2 * scale || box.bottom > bounds.bottom + 2 * scale ||
           box.left < bounds.left - 2 * scale || box.top < bounds.top - 2 * scale)) {
        issues.push(`outside slide: ${el.tagName}.${el.className}`);
      }
      const container = el.matches(".s-body,.body,.frame,.card,.band,.change");
      const clipsText = el.matches("h1,h2,h3,h4,p,td") && getComputedStyle(el).overflow !== "visible";
      if ((container || clipsText) &&
          (el.scrollHeight > el.clientHeight + 3 || el.scrollWidth > el.clientWidth + 3)) {
        issues.push(`overflow: ${el.tagName}.${el.className}`);
      }
      if (el.matches("img") && (!el.complete || el.naturalWidth === 0)) issues.push("broken image");
    }
    return [...new Set(issues)];
  }, index);
}

async function verify(file, { shots, widths = [1600, 768, 390] } = {}) {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  });
  const errors = [], pages = [];
  try {
    const page = await browser.newPage();
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
    await page.goto(/^(file|https?):/.test(file) ? file : pathToFileURL(path.resolve(file)).href);
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: `
      .reveal,.stagger>*,.cv{transition:none!important;animation:none!important;opacity:1!important;transform:none!important}
      .hl::after{transform:scaleX(1)!important}
      .cover-rule{animation:none!important;width:236px!important}
      .rule-accent{animation:none!important;transform:scaleX(1)!important}
      .main,.sidebar{transition:none!important}` });
    const count = await page.locator(".sheet .slide, .deck-stage > .slide").count();
    if (!count) throw new Error("No supported slides: refusing a false 0/0 pass.");
    for (const width of widths) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.waitForTimeout(100);
      for (let i = 0; i < count; i++) {
        await page.evaluate(i => {
          const slides = [...document.querySelectorAll(".sheet .slide, .deck-stage > .slide")];
          if (!document.querySelector(".chapter")) slides.forEach((s,j) => s.classList.toggle("active", j === i));
          slides[i].classList.add("visible");
          slides[i].scrollIntoView({ block: "start", behavior: "instant" });
        }, i);
        const issues = await inspect(page, i);
        pages.push({ width, slide: i + 1, issues });
        if (shots && width === widths[0]) {
          fs.mkdirSync(shots, { recursive: true });
          await page.screenshot({ path: path.join(shots, `slide-${String(i + 1).padStart(2, "0")}.png`) });
        }
      }
    }
    const structure = await page.evaluate(() => {
      const chapters = [...document.querySelectorAll(".chapter")];
      const links = [...document.querySelectorAll(".nav-link")];
      const issues = [];
      if (chapters.length) {
        if (links.length !== chapters.length) issues.push("TOC/chapter count mismatch");
        if (document.querySelectorAll(".note-body").length !== chapters.length) issues.push("notes/chapter count mismatch");
        const ids = [...document.querySelectorAll("[id]")].map(el => el.id);
        if (new Set(ids).size !== ids.length) issues.push("duplicate ids");
        links.forEach(link => { if (!document.getElementById(link.hash.slice(1))) issues.push("broken TOC link"); });
      }
      document.querySelectorAll("use").forEach(el => {
        const href = el.getAttribute("href") || el.getAttribute("xlink:href");
        if (href?.startsWith("#") && !document.getElementById(href.slice(1))) issues.push("missing SVG symbol " + href);
      });
      if (document.documentElement.scrollWidth > innerWidth + 2) issues.push("document overflows viewport");
      return { chapters: chapters.length, issues };
    });
    errors.push(...structure.issues);
    return { file, count, reading: Boolean(structure.chapters), errors, pages,
      ok: errors.length === 0 && pages.every(p => p.issues.length === 0) };
  } finally {
    await browser.close();
  }
}
module.exports = { verify, inspect };
if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error("Usage: node scripts/verify.cjs <file-or-url> [screenshot-directory]"); process.exitCode = 2; }
  else verify(file, { shots: process.argv[3] }).then(result => {
    console.log(JSON.stringify(result, null, 2)); process.exitCode = result.ok ? 0 : 1;
  }).catch(error => { console.error(error); process.exitCode = 1; });
}
