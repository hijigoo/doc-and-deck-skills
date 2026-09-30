#!/usr/bin/env python3
"""Inject <p:timing> entrance animations into the generated decks.

Both HTML sources animate every `.reveal` block with a fade plus a short
translate, staggered by class r1..rN. pptxgenjs has no animation API, so each
generator records what its shapes should do (in the order the shapes were
added) into a manifest. Shape ids in a pptxgenjs slide are assigned
sequentially from 2 in that same order, so a manifest index maps straight onto
<p:cNvPr id>.

Manifest entries are one per shape, in document order:

    0                                   no animation
    <int>                               shorthand reveal tier r1..r5, meaning
                                        translateX(40px) over 0.5s using the
                                        default stagger below
    {"d":..,"dur":..,"fx":"fade"|"wipe",
     "axis":"x"|"y","off":<fraction>}   explicit: delay and duration in ms,
                                        fade + translate or a left-origin wipe

Every effect starts automatically when the slide appears (no click), matching
the CSS transitions that run on `.slide.visible`.

Usage: python3 scripts/add_animations.py [deck.pptx] [manifest.json]
"""

from __future__ import annotations

import json
import os
import re
import shutil
import sys
import zipfile

ROOT = os.getcwd()
DEFAULT_PPTX = os.path.join(ROOT, "qa", "white-cobalt-reference.pptx")
DEFAULT_MANIFEST = os.path.join(ROOT, "qa", "anim-manifest.json")

# Defaults used for bare integer manifest entries.
DURATION = 500                                  # ms, matches the 0.5s CSS transition
DELAYS = {1: 50, 2: 150, 3: 250, 4: 350, 5: 450}
OFFSET = 40 / 1920                              # translateX(40px) as a fraction of stage width

def spec(entry):
    """Normalise a manifest entry into an effect spec, or None for no effect."""
    if not entry:
        return None
    if isinstance(entry, int):
        return {"d": DELAYS[entry], "dur": DURATION, "fx": "fade", "axis": "x", "off": OFFSET}
    return {
        "d": int(entry["d"]),
        "dur": int(entry.get("dur", DURATION)),
        "fx": entry.get("fx", "fade"),
        "axis": entry.get("axis", "x"),
        "off": float(entry.get("off", OFFSET)),
    }

SLIDE_RE = re.compile(r"^ppt/slides/slide(\d+)\.xml$")
CNVPR_RE = re.compile(r'<p:cNvPr\b[^>]*\bid="(\d+)"[^>]*>')
PARA_RE = re.compile(r"<a:p>.*?</a:p>", re.S)
PPR_RE = re.compile(r"<a:pPr\b[^>]*(?:/>|>.*?</a:pPr>)", re.S)


def dedupe_para_props(xml: str) -> str:
    """pptxgenjs repeats the paragraph properties before every run of a
    multi-run paragraph. CT_TextParagraph allows at most one leading a:pPr, so
    the extras are dropped. They are byte-identical to the first, so nothing
    about the rendered text changes."""

    def one_paragraph(match: "re.Match[str]") -> str:
        seen = False

        def keep_first(prop: "re.Match[str]") -> str:
            nonlocal seen
            if seen:
                return ""
            seen = True
            return prop.group(0)

        return PPR_RE.sub(keep_first, match.group(0))

    return PARA_RE.sub(one_paragraph, xml)


def _entrance(spid, sp, ids, preset, subtype, filt) -> str:
    """An entrance effect: make the shape visible, then run a transition filter."""
    tgt = f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl>'
    a, b, c = next(ids), next(ids), next(ids)
    return (
        f'<p:par><p:cTn id="{a}" presetID="{preset}" presetClass="entr"'
        f' presetSubtype="{subtype}" fill="hold" nodeType="withEffect">'
        f'<p:stCondLst><p:cond delay="{sp["d"]}"/></p:stCondLst><p:childTnLst>'
        # Without this the shape is already painted when the slide appears and
        # the entrance has nothing left to reveal.
        f'<p:set><p:cBhvr><p:cTn id="{b}" dur="1" fill="hold">'
        f'<p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>{tgt}'
        f"<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst>"
        f'</p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>'
        f'<p:animEffect transition="in" filter="{filt}">'
        f'<p:cBhvr><p:cTn id="{c}" dur="{sp["dur"]}"/>{tgt}</p:cBhvr></p:animEffect>'
        f"</p:childTnLst></p:cTn></p:par>"
    )

def _motion(spid, sp, ids) -> str:
    """The CSS translate, as the motion-path effect PowerPoint itself writes:
    a relative path that runs from the offset back to the shape's own origin."""
    tgt = f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl>'
    a, b = next(ids), next(ids)
    dx = sp["off"] if sp["axis"] == "x" else 0.0
    dy = sp["off"] if sp["axis"] == "y" else 0.0
    return (
        f'<p:par><p:cTn id="{a}" presetID="42" presetClass="path" presetSubtype="0"'
        f' decel="100000" fill="hold" nodeType="withEffect">'
        f'<p:stCondLst><p:cond delay="{sp["d"]}"/></p:stCondLst><p:childTnLst>'
        f'<p:animMotion origin="layout" path="M {dx:.5f} {dy:.5f} L 0 0 "'
        f' pathEditMode="relative" rAng="0" ptsTypes="AA">'
        f'<p:cBhvr><p:cTn id="{b}" dur="{sp["dur"]}" fill="hold"/>{tgt}'
        f"<p:attrNameLst><p:attrName>ppt_x</p:attrName>"
        f"<p:attrName>ppt_y</p:attrName></p:attrNameLst></p:cBhvr>"
        f'<p:rCtr x="{round(-dx / 2 * 100000)}" y="{round(-dy / 2 * 100000)}"/>'
        f"</p:animMotion></p:childTnLst></p:cTn></p:par>"
    )

def effect(spid: int, sp, ids) -> str:
    """The effect pars for one shape, in the order PowerPoint writes them."""
    if sp["fx"] == "wipe":
        # scaleX(0) -> scaleX(1) anchored left. PowerPoint pairs "from left"
        # (presetSubtype 8) with the wipe(left) filter.
        return _entrance(spid, sp, ids, 22, 8, "wipe(left)")
    # Fade plus translate is two effects sharing a delay, not one compound node.
    return _entrance(spid, sp, ids, 10, 0, "fade") + _motion(spid, sp, ids)

def timing(effects) -> str:
    """effects: [(spid, spec), ...] ordered by delay. Everything sits in one
    click group that fires as soon as the slide appears, so nothing needs a
    click — the same as the CSS transitions running on `.slide.visible`."""
    ids = iter(range(5, 100000))
    body = "".join(effect(spid, sp, ids) for spid, sp in effects)
    return (
        "<p:timing><p:tnLst><p:par>"
        '<p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>'
        '<p:seq concurrent="1" nextAc="seek">'
        '<p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>'
        '<p:par><p:cTn id="3" fill="hold"><p:stCondLst>'
        '<p:cond delay="indefinite"/>'
        '<p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond>'
        "</p:stCondLst><p:childTnLst>"
        '<p:par><p:cTn id="4" fill="hold">'
        '<p:stCondLst><p:cond delay="0"/></p:stCondLst>'
        f"<p:childTnLst>{body}</p:childTnLst>"
        "</p:cTn></p:par>"
        "</p:childTnLst></p:cTn>"
        # CT_TLTimeNodeParallel allows a cTn and nothing else — the prev/next
        # conditions belong to the enclosing p:seq below.
        "</p:par></p:childTnLst></p:cTn>"
        '<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>'
        '<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst>'
        "</p:seq></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>"
    )

def main(pptx: str, manifest_path: str, animate: bool = True) -> None:
    with open(manifest_path, encoding="utf-8") as fh:
        manifest = json.load(fh)

    src = zipfile.ZipFile(pptx)
    items = src.infolist()
    payload = {}
    animated = 0

    for info in items:
        data = src.read(info.filename)
        match = SLIDE_RE.match(info.filename)
        if match:
            index = int(match.group(1)) - 1
            xml = dedupe_para_props(data.decode("utf-8"))
            # Shape ids in document order; id 1 is the spTree group itself.
            spids = [int(i) for i in CNVPR_RE.findall(xml) if int(i) != 1]
            entries = manifest[index]
            if len(spids) != len(entries):
                sys.exit(
                    f"{info.filename}: {len(spids)} shapes but {len(entries)} manifest entries"
                )
            # One click-free group; every effect carries its own delay.
            ordered = []
            for spid, entry in zip(spids, entries):
                sp = spec(entry)
                if sp:
                    ordered.append((spid, sp))
            ordered.sort(key=lambda pair: pair[1]["d"])
            if ordered and animate:
                assert "<p:timing>" not in xml
                xml = xml.replace("</p:sld>", timing(ordered) + "</p:sld>")
                animated += len(ordered)
            data = xml.encode("utf-8")
        payload[info.filename] = data

    tmp = pptx + ".tmp"
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as dst:
        for info in items:
            # Rebuild each entry from the original header so directory flags and
            # timestamps survive the rewrite. Compression is our own choice —
            # JSZip stores everything uncompressed, which inflates the package
            # roughly tenfold.
            entry = zipfile.ZipInfo(info.filename, date_time=info.date_time)
            entry.compress_type = (
                zipfile.ZIP_STORED if info.is_dir() else zipfile.ZIP_DEFLATED
            )
            entry.external_attr = info.external_attr
            entry.internal_attr = info.internal_attr
            entry.create_system = info.create_system
            dst.writestr(entry, payload[info.filename])
    shutil.move(tmp, pptx)
    print(f"animated {animated} shapes across {len(manifest)} slides -> {pptx}")

if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--no-anim"]
    # Escape hatch: apply only the OOXML corrections and skip the timing block.
    animate = "--no-anim" not in sys.argv
    deck = args[0] if args else DEFAULT_PPTX
    # Each deck gets its own manifest, so several can be built side by side:
    #   deck.pptx -> qa/anim-manifest-deck.json, falling back to the default.
    named = os.path.join(
        ROOT, "qa", "anim-manifest-%s.json" % os.path.splitext(os.path.basename(deck))[0]
    )
    default_manifest = named if os.path.exists(named) else DEFAULT_MANIFEST
    main(deck, args[1] if len(args) > 1 else default_manifest, animate)
