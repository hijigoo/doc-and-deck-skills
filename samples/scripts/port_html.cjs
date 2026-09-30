// Bounded to the two bundled template families, not arbitrary web pages.
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");
const pptxgen = require("pptxgenjs");
const JSZip = require(require.resolve("jszip", { paths: [require.resolve("pptxgenjs")] }));
const { normalizeTableIds } = require("./ooxml.cjs");

async function port(input, out, skill, animate = true) {
  const contract = require(path.join(skill, "scripts/contract.js"));
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
  let measured;
  try {
    const page = await browser.newPage({ viewport: { width: 2040, height: 1300 } });
    await page.goto(pathToFileURL(input).href);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => {
      const freeze = document.createElement("style");
      freeze.textContent = ".slide .reveal{transition-property:none!important}";
      document.head.append(freeze);
      const stages = [...document.querySelectorAll(".sheet .slide")];
      for (const stage of stages) stage.classList.add("visible");
      for (const el of document.querySelectorAll(".slide .reveal")) {
        const cs = getComputedStyle(el);
        el.dataset.portEffect = JSON.stringify({
          fx: "fade", d: Math.round(parseFloat(cs.transitionDelay) * 1000),
          dur: Math.round(parseFloat(cs.transitionDuration) * 1000), axis: "y",
        });
      }
      for (const stage of stages) stage.classList.remove("visible");
      for (const el of document.querySelectorAll(".slide .reveal")) {
        const transform = getComputedStyle(el).transform;
        const effect = JSON.parse(el.dataset.portEffect);
        effect.off = new DOMMatrix(transform === "none" ? undefined : transform).m42 / 1080;
        el.dataset.portEffect = JSON.stringify(effect);
      }
      const css = document.createElement("style");
      css.textContent = ".sidebar,.mobile-nav,.mobile-bar{visibility:hidden!important}.sheet{width:1920px!important;height:1080px!important}.sheet .slide{transform:none!important;visibility:visible!important;opacity:1!important}.slide *{transition:none!important;animation:none!important}.slide .reveal{transform:none!important;opacity:1!important}";
      document.head.append(css);
      // Freeze selector-dependent styles, not intrinsic table dimensions.
      const originals = [...document.querySelectorAll(".slide *")].filter(el => !(el instanceof SVGElement));
      const snapshot = cs => [...cs].map(prop => [prop, cs.getPropertyValue(prop)]);
      const saved = originals.map(el => ({ el, style: snapshot(getComputedStyle(el)),
        pseudos: ["before", "after"].map(pseudo => ({ pseudo, style: snapshot(getComputedStyle(el, `::${pseudo}`)) })) }));
      for (const { el, style } of saved) {
        if (el.tagName === "TABLE") el.dataset.portTableHeight = String(el.getBoundingClientRect().height);
        for (const [prop, value] of style) {
          if (/^(background.*|color|border.*|font.*|grid-(row|column).*|margin.*|padding.*|order)$/.test(prop)) {
            el.style.setProperty(prop, value, "important");
          }
        }
      }
      let n = 0;
      for (const { el, pseudos } of saved) {
        for (const { pseudo, style } of pseudos) {
          const cs = Object.fromEntries(style);
          if (!cs.content || ["none", "normal"].includes(cs.content) || cs.display === "none") continue;
          const span = document.createElement("span");
          for (const [prop, value] of style) span.style.setProperty(prop, value, "important");
          span.textContent = cs.content.startsWith('"') ? JSON.parse(cs.content) : cs.content;
          el.setAttribute(`data-port-${pseudo}`, String(++n));
          const hide = document.createElement("style");
          hide.textContent = `[data-port-${pseudo}="${n}"]::${pseudo}{content:none!important;display:none!important}`;
          document.head.append(hide);
          if (pseudo === "before") el.prepend(span); else el.append(span);
        }
      }
    });
    measured = [];
    const slides = page.locator(".sheet .slide");
    for (let index = 0; index < await slides.count(); index++) {
      const stage = slides.nth(index);
      await stage.scrollIntoViewIfNeeded();
      const data = await stage.evaluate(slide => {
        const origin = slide.getBoundingClientRect();
        const objects = [];
        let id = 0;
        const rgba = raw => {
          const parts = raw.match(/[\d.]+/g)?.map(Number);
          if (!parts || parts.length < 3) throw new Error(`Unsupported color ${raw}`);
          return { color: parts.slice(0, 3).map(n => Math.round(n).toString(16).padStart(2, "0")).join("").toUpperCase(),
            transparency: Math.round((1 - (parts[3] ?? 1)) * 100) };
        };
        const box = el => {
          const r = el.getBoundingClientRect();
          return { x: r.x - origin.x, y: r.y - origin.y, w: r.width, h: r.height };
        };
        const effect = el => {
          const owner = el.closest("[data-port-effect]");
          return owner ? JSON.parse(owner.dataset.portEffect) : 0;
        };
        const font = (cs, value) => {
          const families = cs.fontFamily.split(",").map(s => s.trim().replace(/['"]/g, ""));
          const cjk = /[\uac00-\ud7af]/.test(value);
          const face = cjk ? families.find(s => /Pretendard|Sans KR/.test(s)) : families[0];
          return (face || families[0]).replace("Pretendard Variable", "Pretendard");
        };
        const background = el => {
          for (let p = el; p; p = p.parentElement) {
            const color = rgba(getComputedStyle(p).backgroundColor);
            if (color.transparency === 0) return color.color;
          }
          return "FFFFFF";
        };
        function walk(el) {
          const cs = getComputedStyle(el), rect = box(el);
          if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return;
          const base = { ...rect, effect: effect(el) };
          if (el.tagName.toLowerCase() === "svg") {
            el.dataset.portImage = String(++id);
            objects.push({ ...base, kind: "image", imageId: String(id), reason: "SVG diagram", text: [...el.querySelectorAll("text")].map(t => t.textContent).join("\n") });
            return;
          }
          if (el.tagName === "TABLE") {
            if (Math.abs(rect.h - Number(el.dataset.portTableHeight)) > 1) {
              throw new Error("Pseudo materialization changed table height");
            }
            const rows = [...el.rows];
            const first = rows[0].getBoundingClientRect(), last = rows.at(-1).getBoundingClientRect();
            objects.push({ ...base, y: first.y - origin.y, h: last.bottom - first.y, kind: "table",
              rows: rows.map(row => [...row.cells].map(cell => {
                const s = getComputedStyle(cell);
                return { text: cell.innerText, options: { fontFace: font(s, cell.innerText), fontSize: parseFloat(s.fontSize) / 2,
                  bold: Number(s.fontWeight) >= 600, color: rgba(s.color).color, fill: background(cell),
                  margin: ["Top", "Right", "Bottom", "Left"].map(side => parseFloat(s[`padding${side}`]) / 2),
                  align: ["center", "right"].includes(s.textAlign) ? s.textAlign : "left" } };
              })),
              colW: [...rows[0].cells].map(cell => cell.getBoundingClientRect().width / 144),
              rowH: rows.map(row => row.getBoundingClientRect().height / 144),
            });
            if (el.caption) walk(el.caption);
            return;
          }
          const fill = rgba(cs.backgroundColor);
          const sides = ["Top", "Right", "Bottom", "Left"].map(side => ({
            width: parseFloat(cs[`border${side}Width`]), color: rgba(cs[`border${side}Color`]),
            style: cs[`border${side}Style`],
          }));
          const complex = cs.backgroundImage !== "none" || cs.transform !== "none" ||
            ((!parseFloat(cs.width) || !parseFloat(cs.height)) && sides.some(s => s.width > 2));
          const radius = parseFloat(cs.borderTopLeftRadius) * (cs.borderTopLeftRadius.includes("%") ? Math.min(rect.w, rect.h) / 100 : 1);
          const ellipse = radius > 0 && radius >= Math.min(rect.w, rect.h) / 2;
          if (el !== slide && complex) {
            el.dataset.portImage = String(++id);
            objects.push({ ...base, kind: "image", imageId: String(id), reason: "CSS decoration", text: "", decoration: true });
          } else {
            if (el !== slide && (fill.transparency < 100 || ellipse) && rect.w > 0 && rect.h > 0) {
              objects.push({ ...base, kind: "rect", fill, ellipse,
                stroke: ellipse && sides[0].width ? { ...sides[0].color, width: sides[0].width / 2 } : null });
            }
            if (el !== slide && !ellipse) sides.forEach((side, n) => {
              if (!side.width || side.color.transparency === 100 || side.style === "none") return;
              objects.push({ ...base, kind: "line", side: n, color: side.color,
                width: side.width / 2, dash: ["dashed", "dotted"].includes(side.style) });
            });
          }
          for (const node of el.childNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) { walk(node); continue; }
            if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) continue;
            const groups = [];
            for (let i = 0; i < node.length; i++) {
              const range = document.createRange();
              range.setStart(node, i); range.setEnd(node, i + 1);
              const r = range.getBoundingClientRect();
              if (!r.width || !r.height) continue;
              let group = groups.at(-1);
              if (!group || Math.abs(group.top - r.top) > 2) {
                group = { top: r.top, left: r.left, right: r.right, height: r.height, text: "" };
                groups.push(group);
              }
              group.text += node.textContent[i];
              group.right = Math.max(group.right, r.right);
            }
            for (const g of groups) {
              if (!g.text.trim()) continue;
              objects.push({ kind: "text", x: g.left - origin.x, y: g.top - origin.y,
                w: g.right - g.left, h: g.height, value: g.text, role: el.closest(".layout-title") ? "title" : "body",
                fontFace: font(cs, g.text), fontSize: parseFloat(cs.fontSize) / 2, color: rgba(cs.color).color,
                bold: Number(cs.fontWeight) >= 600, italic: cs.fontStyle === "italic",
                spacing: cs.letterSpacing === "normal" ? 0 : parseFloat(cs.letterSpacing) / 2, effect: effect(el) });
            }
          }
        }
        walk(slide);
        const note = slide.closest(".chapter").querySelector(".note-body");
        return { layout: slide.dataset.layout, title: slide.querySelector(".layout-title").innerText,
          background: background(slide), objects, notes: note.innerText + "\n\n출처 URL\n" +
          [...note.querySelectorAll("a")].map(a => a.href).join("\n") +
          "\n\n시트 전사\n" + slide.innerText + "\n" + objects.filter(o => o.kind === "image").map(o => o.text).join("\n") };
      });
      for (const object of data.objects.filter(o => o.kind === "image")) {
        const node = stage.locator(`[data-port-image="${object.imageId}"]`);
        if (object.decoration) await node.evaluate(el => {
          el.dataset.portSavedStyle = el.getAttribute("style") || "";
          el.style.setProperty("color", "transparent", "important");
          for (const child of el.querySelectorAll("*")) {
            child.dataset.portImageSavedStyle = child.getAttribute("style") || "";
            child.style.setProperty("visibility", "hidden", "important");
          }
        });
        object.data = "image/png;base64," + (await node.screenshot({ omitBackground: true })).toString("base64");
        if (object.decoration) await node.evaluate(el => {
          el.setAttribute("style", el.dataset.portSavedStyle);
          for (const child of el.querySelectorAll("*")) child.setAttribute("style", child.dataset.portImageSavedStyle);
        });
      }
      measured.push(data);
    }
  } finally { await browser.close(); }
  const deck = new pptxgen();
  deck.layout = "LAYOUT_WIDE";
  deck.title = "Microsoft Foundry on Azure · All 15 templates";
  deck.lang = "ko-KR";
  const manifest = [];
  for (const data of measured) {
    const slide = deck.addSlide(), effects = [];
    slide.background = { color: data.background };
    const ordered = [...data.objects.filter(o => o.role === "title"), ...data.objects.filter(o => o.role !== "title")];
    for (const o of ordered) {
      const x = o.x / 144, y = o.y / 144, w = o.w / 144, h = o.h / 144;
      if (o.kind === "text") slide.addText(o.value, { x, y, w: w + 0.035, h: h + 0.02,
        fontFace: o.fontFace, fontSize: o.fontSize, color: o.color, bold: o.bold, italic: o.italic,
        charSpacing: o.spacing, margin: 0, valign: "top", wrap: false, paraSpaceAfter: 0, lang: "ko-KR" });
      else if (o.kind === "rect") slide.addShape(o.ellipse ? deck.ShapeType.ellipse : deck.ShapeType.rect,
        { x, y, w, h, fill: o.fill, line: o.stroke || { transparency: 100 } });
      else if (o.kind === "line") {
        const horizontal = o.side % 2 === 0;
        slide.addShape(deck.ShapeType.line, { x: x + (o.side === 1 ? w : 0), y: y + (o.side === 2 ? h : 0),
          w: horizontal ? w : 0, h: horizontal ? 0 : h,
          line: { ...o.color, width: o.width, dashType: o.dash ? "dash" : "solid" } });
      } else if (o.kind === "image") slide.addImage({ data: o.data, x, y, w, h, altText: o.text || o.reason });
      else if (o.kind === "table") slide.addTable(o.rows, { x, y, w, h, colW: o.colW, rowH: o.rowH,
        fontSize: 13, margin: 0, autoPage: false, valign: "middle",
        border: { type: "solid", color: "D8DDE5", pt: 0.5 }, paraSpaceAfter: 0, lang: "ko-KR" });
      else throw new Error(`Unsupported object ${o.kind}`);
      effects.push(animate ? o.effect : 0);
    }
    slide.addNotes(data.notes);
    manifest.push(effects);
  }
  const zip = await JSZip.loadAsync(await deck.write({ outputType: "nodebuffer" }));
  await contract.normalizeGeneratedContentTypes(zip);
  await normalizeTableIds(zip);
  for (let i = 0; i < measured.length; i++) {
    const name = `ppt/notesSlides/notesSlide${i + 1}.xml`;
    zip.file(name, contract.notesXml(await zip.file(name).async("string"), measured[i].notes));
  }
  fs.writeFileSync(out, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  fs.writeFileSync(path.join(path.dirname(out), "anim-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  fs.writeFileSync(path.join(path.dirname(out), "measured-layout.json"), JSON.stringify(measured.map(s => ({
    ...s, objects: s.objects.map(({ data, ...object }) => object),
  })), null, 2) + "\n");
}
module.exports = { port };
