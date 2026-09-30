import base64
import json
from pathlib import Path
import re
import tempfile
import unittest

from standalone_html import PackagingError, package


class StandaloneTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def write(self, name, data):
        file = self.root / name
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_bytes(data if isinstance(data, bytes) else data.encode("utf-8"))
        return file

    def build(self, body, head=""):
        source = self.write("input.html", f'<!doctype html><html lang="ko"><head>{head}</head><body>{body}</body></html>')
        target = self.root / "output.html"
        package(source, target)
        return target.read_text()

    def test_unicode_notes_links_and_hashes(self):
        result = self.build('<h1 id="one">한글 &amp; 근거</h1><a href="#one">목차</a><a href="https://example.com/docs">출처</a><aside>발표 노트</aside>')
        self.assertIn("한글 &amp; 근거", result)
        self.assertIn('href="#one"', result)
        self.assertIn('href="https://example.com/docs"', result)
        self.assertIn('charset="utf-8"', result)

    def test_css_paths_and_imports(self):
        self.write("fonts/a.woff2", b"font-bytes")
        self.write("css/base.css", '@font-face{font-family:Test;src:url("../fonts/a.woff2")}')
        self.write("css/main.css", '@import "base.css";body{color:#123}')
        result = self.build("<p>테스트</p>", '<link rel="stylesheet" href="css/main.css">')
        self.assertIn("data:font/woff2;base64,", result)
        self.assertNotIn("@import", result)
        self.assertNotIn('href="css/main.css"', result)

    def test_image_script_and_download(self):
        self.write("a.png", b"image")
        self.write("a.js", "window.sample = '한글';")
        self.write("source.pdf", b"pdf")
        result = self.build('<img src="a.png"><script src="a.js"></script><a href="source.pdf" download>원본</a>')
        self.assertIn("data:image/png;base64,", result)
        self.assertIn("window.sample = '한글';", result)
        self.assertIn("data:application/pdf;base64,", result)

    def test_svg_page_and_fallback(self):
        self.write("a.png", b"image")
        self.write("page.svg", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><image href="a.png"/></svg>')
        result = self.build('<object data="page.svg" type="image/svg+xml"><img src="a.png"></object>')
        uri = re.search(r'data="(data:[^"]+)"', result)[1]
        svg = base64.b64decode(uri.split(",", 1)[1]).decode()
        self.assertIn('viewBox="0 0 1 1"', svg)
        self.assertIn("data:image/png;base64,", svg)

    def test_existing_data_uri_and_inline_css(self):
        uri = "data:image/png;base64,aW1hZ2U="
        result = self.build(f'<img src="{uri}"><div style="background:url({uri})"></div>')
        self.assertIn(uri, result)

    def test_provenance_without_private_paths(self):
        self.write("a.png", b"image")
        result = self.build('<img src="a.png">')
        record = json.loads(re.search(r'id="standalone-provenance">([\s\S]*?)</script>', result)[1])
        self.assertEqual(record["format"], "standalone-html-v1")
        self.assertEqual(record["resources"][0]["name"], "a.png")
        self.assertEqual(len(record["resources"][0]["sha256"]), 64)
        self.assertNotIn(str(self.root), result)

    def test_missing_resource_fails(self):
        with self.assertRaisesRegex(PackagingError, "Missing resource"):
            self.build('<img src="missing.png">')

    def test_remote_resource_rejected_but_citation_allowed(self):
        with self.assertRaisesRegex(PackagingError, "--allow-remote"):
            self.build('<img src="https://example.com/image.png">')

    def test_unsupported_srcset_and_module_fail(self):
        with self.assertRaisesRegex(PackagingError, "srcset"):
            self.build('<img srcset="a.png 1x, b.png 2x">')
        with self.assertRaisesRegex(PackagingError, "module"):
            self.build('<script type="module" src="a.js"></script>')

    def test_fragments_and_cycles_fail(self):
        source = self.write("fragment.html", "<article>중간 조각</article>")
        with self.assertRaisesRegex(PackagingError, "fragment"):
            package(source, self.root / "out.html")
        self.write("loop.css", '@import "loop.css";')
        with self.assertRaisesRegex(PackagingError, "Cyclic"):
            self.build("", '<link rel="stylesheet" href="loop.css">')

    def test_preservation_manifest_and_sources(self):
        source = self.write("source.html", "<html><head></head><body>전사</body></html>")
        self.write("source.pptx", b"pptx"); self.write("source.pdf", b"pdf")
        manifest = self.write("manifest.json", json.dumps({"slides": 1, "assets": []}))
        target = self.root / "output.html"
        package(source, target, manifest=manifest)
        result = target.read_text()
        self.assertIn('id="source-preservation"', result)
        self.assertIn("data:application/pdf;base64,", result)
        self.assertNotIn("file://", result)

    def test_repackaging_has_one_provenance_record(self):
        self.build("<p>한글</p>")
        target = self.root / "output.html"
        package(target, target)
        self.assertEqual(target.read_text().count('id="standalone-provenance"'), 1)
        self.assertEqual(target.read_text().count('id="standalone-link-runtime"'), 1)

    def test_deferred_external_scripts_fail_explicitly(self):
        self.write("script.js", "document.body.dataset.ready='yes'")
        for attribute in ("defer", "async"):
            with self.assertRaisesRegex(PackagingError, "execution order"):
                self.build(f'<script src="script.js" {attribute}></script>')

    def test_preservation_downloads_stay_inside_main(self):
        source = self.write("source.html", "<html><head></head><body><main>본문</main></body></html>")
        self.write("source.pptx", b"pptx"); self.write("source.pdf", b"pdf")
        manifest = self.write("manifest.json", '{"assets":[]}')
        target = self.root / "output.html"
        package(source, target, manifest=manifest)
        result = target.read_text()
        self.assertLess(result.index("<details>"), result.index("</main>"))


if __name__ == "__main__":
    unittest.main()
