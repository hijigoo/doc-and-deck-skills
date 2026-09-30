"""Run with python3 scripts/test_animations.py; no third-party packages needed."""
import contextlib
import io
import json
import re
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile

from add_animations import main, spec
from fix_notes import convert

P = "http://schemas.openxmlformats.org/presentationml/2006/main"
SLIDE = f'''<p:sld xmlns:p="{P}"><p:cSld><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1"/></p:nvGrpSpPr>
<p:sp><p:nvSpPr><p:cNvPr id="7"/></p:nvSpPr></p:sp>
<p:sp><p:nvSpPr><p:cNvPr id="42"/></p:nvSpPr></p:sp>
</p:spTree></p:cSld></p:sld>'''


class AnimationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.deck = Path(self.temp.name) / "deck.pptx"
        self.manifest = Path(self.temp.name) / "manifest.json"
        with ZipFile(self.deck, "w") as archive:
            archive.writestr("ppt/slides/slide1.xml", SLIDE)
            archive.writestr("ppt/presentation.xml", "<unchanged/>")

    def inject(self, entries, animate=True):
        self.manifest.write_text(json.dumps(entries), encoding="utf-8")
        with contextlib.redirect_stdout(io.StringIO()):
            main(str(self.deck), str(self.manifest), animate)
        with ZipFile(self.deck) as archive:
            self.assertEqual(archive.read("ppt/presentation.xml"), b"<unchanged/>")
            return ET.fromstring(archive.read("ppt/slides/slide1.xml"))

    def test_defaults_match_bundled_css(self):
        html = (Path(__file__).resolve().parents[1] / "deck.html").read_text(encoding="utf-8")
        duration = float(re.search(r"--dur:([\d.]+)s", html)[1]) * 1000
        offset = float(re.search(r"\.reveal\{[^}]*translateY\(([\d.]+)px\)", html)[1]) / 1080
        for tier in range(1, 9):
            delay = float(re.search(rf"\.reveal\.r{tier}\{{transition-delay:([\d.]+)s", html)[1]) * 1000
            self.assertEqual(spec(tier), {
                "d": round(delay), "dur": round(duration), "fx": "fade", "axis": "y", "off": offset,
            })

    def test_actual_shape_ids_and_static_entries(self):
        root = self.inject([[0, 8]])
        targets = {node.get("spid") for node in root.iter(f"{{{P}}}spTgt")}
        self.assertEqual(targets, {"42"})
        conditions = {node.get("delay") for node in root.iter(f"{{{P}}}cond")}
        self.assertIn("760", conditions)
        self.assertTrue(any(node.get("dur") == "620" for node in root.iter(f"{{{P}}}cTn")))
        self.assertEqual(next(root.iter(f"{{{P}}}animMotion")).get("path"), "M 0.00000 0.02778 L 0 0 ")

    def test_static_slide_has_no_timing(self):
        root = self.inject([[0, 0]])
        self.assertIsNone(root.find(f"{{{P}}}timing"))

    def test_explicit_wipe(self):
        root = self.inject([[{"d": 500, "dur": 900, "fx": "wipe"}, 0]])
        self.assertEqual(next(root.iter(f"{{{P}}}animEffect")).get("filter"), "wipe(left)")
        self.assertEqual(list(root.iter(f"{{{P}}}animMotion")), [])

    def test_no_anim_is_explicit(self):
        self.assertIsNone(self.inject([[1, 2]], animate=False).find(f"{{{P}}}timing"))

    def test_bad_manifest_does_not_change_file(self):
        original = self.deck.read_bytes()
        for entries in ([], {}, [None], [[0]], [[0, 0], []], [[0, {"d": 0, "fx": "spin"}]]):
            with self.subTest(entries=entries), self.assertRaises(ValueError):
                self.inject(entries)
            self.assertEqual(self.deck.read_bytes(), original)

    def test_invalid_effects_are_not_silent_fallbacks(self):
        for entry in (None, False, 0.0, -1, 9, {}, {"d": -1}, {"d": 0, "dur": 0},
                      {"d": "60"}, {"d": True}, {"d": 0, "axis": "z"},
                      {"d": 0, "off": float("nan")}, {"d": 0, "off": float("inf")},
                      {"d": 0, "click": True}):
            with self.subTest(entry=entry), self.assertRaises(ValueError):
                spec(entry)

    def test_repeated_injection_preserves_existing_file(self):
        self.inject([[1, 0]])
        original = self.deck.read_bytes()
        with self.assertRaisesRegex(ValueError, "existing timing"):
            self.inject([[1, 0]])
        self.assertEqual(self.deck.read_bytes(), original)

    def test_note_line_breaks_and_blank_paragraph(self):
        source = '<a:p xmlns:a="urn:test"><a:r><a:t>첫 줄\u2424둘째 줄\u2424\u2424다음 문단 &amp; 출처</a:t></a:r></a:p>'
        result, count = convert(source)
        root = ET.fromstring(result)
        self.assertEqual(count, 3)
        self.assertEqual(len(list(root.iter("{urn:test}br"))), 3)
        self.assertEqual("".join(root.itertext()), "첫 줄둘째 줄다음 문단 & 출처")
        self.assertEqual(convert(result), (result, 0))


if __name__ == "__main__":
    unittest.main()
