#!/usr/bin/env python3
"""Embed declared HTML resources into one portable file; citations remain links."""
import argparse
import base64
import hashlib
import html
from html.parser import HTMLParser
import json
import mimetypes
from pathlib import Path
import re
from urllib.parse import unquote, urljoin, urlsplit
from urllib.request import urlopen


class PackagingError(ValueError):
    pass


EMBEDDED_LINKS = """<script id="standalone-link-runtime">
document.addEventListener("click", function(event) {
  const link = event.target.closest("a");
  if (!link || link.hasAttribute("download") || link.target !== "_blank") return;
  const source = link.getAttribute("href");
  if (!source || !source.startsWith("data:")) return;
  const split = source.indexOf(",");
  const header = source.slice(5, split);
  if (!header.endsWith(";base64")) return;
  const bytes = Uint8Array.from(atob(source.slice(split + 1)), c => c.charCodeAt(0));
  link.href = URL.createObjectURL(new Blob([bytes], {type: header.slice(0, -7)}));
});
</script>"""


class Bundler:
    def __init__(self, allow_remote=False):
        self.allow_remote = allow_remote
        self.resources = {}
        self.active = set()

    def resolve(self, ref, base):
        if ref.startswith(("data:", "#")) or not ref:
            return ref
        url = urljoin(base, html.unescape(ref))
        if urlsplit(url).scheme not in ("file", "http", "https"):
            raise PackagingError(f"Unsupported resource scheme: {urlsplit(url).scheme}")
        return url

    def read(self, url):
        parts = urlsplit(url)
        if parts.scheme == "file":
            if parts.netloc not in ("", "localhost"):
                raise PackagingError("Remote file hosts are unsupported")
            file = Path(unquote(parts.path))
            if not file.is_file():
                raise PackagingError(f"Missing resource: {file}")
            data = file.read_bytes()
        else:
            if not self.allow_remote:
                raise PackagingError(f"Remote resource requires --allow-remote: {url}")
            with urlopen(url, timeout=30) as response:
                if urlsplit(response.url).scheme not in ("http", "https"):
                    raise PackagingError("Unsupported redirect scheme")
                data = response.read(64 * 1024 * 1024 + 1)
        if len(data) > 64 * 1024 * 1024:
            raise PackagingError("A resource exceeds the 64 MiB limit")
        return data

    def css(self, text, base):
        def import_css(match):
            ref = match[1] or match[2] or match[3]
            media = match[4].strip()
            content = self.asset(ref, base, css_text=True)
            return f"@media {media}{{{content}}}" if media else content
        text = re.sub(r'@import\s+(?:url\(\s*["\']?([^)"\']+)["\']?\s*\)|"([^"]+)"|\'([^\']+)\')\s*([^;]*);',
                      import_css, text, flags=re.I)
        if re.search(r"@import\b", re.sub(r"/\*[\s\S]*?\*/", "", text), re.I):
            raise PackagingError("Unsupported CSS @import syntax")
        return re.sub(r'url\(\s*(?:"([^"]*)"|\'([^\']*)\'|([^)]*))\s*\)',
                      lambda m: 'url("' + self.asset(next(v for v in m.groups() if v is not None).strip(), base) + '")',
                      text, flags=re.I)

    def asset(self, ref, base, css_text=False):
        url = self.resolve(ref, base)
        if url.startswith(("data:", "#")) or not url:
            if css_text:
                raise PackagingError("A stylesheet import must use a file or HTTP URL")
            return url
        key = (url, css_text)
        if key in self.resources:
            return self.resources[key]["value"]
        if key in self.active or len(self.active) >= 16:
            raise PackagingError("Cyclic or excessively nested resource references")
        self.active.add(key)
        try:
            data = self.read(url)
            suffix = Path(urlsplit(url).path).suffix.lower()
            mime = {".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
                    ".otf": "font/otf", ".js": "text/javascript"}.get(suffix)
            mime = mime or mimetypes.guess_type(urlsplit(url).path)[0] or "application/octet-stream"
            original_hash = hashlib.sha256(data).hexdigest()
            if css_text or suffix == ".css":
                text = self.css(data.decode("utf-8-sig"), url)
                data = text.encode("utf-8")
                mime = "text/css"
            elif suffix == ".svg":
                text = data.decode("utf-8-sig")
                if re.search(r"<script\b|<foreignObject\b", text, re.I):
                    raise PackagingError("SVG script/foreignObject requires explicit manual preparation")
                text = re.sub(r'((?:xlink:)?href\s*=\s*)(["\'])(.*?)\2',
                              lambda m: m[1] + m[2] + html.escape(self.asset(m[3], url), quote=True) + m[2],
                              text)
                data = self.css(text, url).encode("utf-8")
            if css_text:
                value = data.decode("utf-8")
            else:
                value = f"data:{mime};base64," + base64.b64encode(data).decode("ascii")
            self.resources[key] = {"name": Path(unquote(urlsplit(url).path)).name,
                                   "sha256": original_hash, "embedded_bytes": len(data), "value": value}
            return value
        finally:
            self.active.remove(key)


class Document(HTMLParser):
    def __init__(self, bundler, base):
        super().__init__(convert_charrefs=False)
        self.bundler, self.base = bundler, base
        self.output = []
        self.style = None
        self.external_script = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "base":
            raise PackagingError("Resolve <base> URLs before packaging")
        if attrs.get("srcset"):
            raise PackagingError("Resolve srcset to a single src before packaging")
        if tag == "iframe":
            raise PackagingError("Embedded frames are not supported in standalone deliverables")
        if tag == "link" and attrs.get("rel", "").lower() in ("preconnect", "dns-prefetch"):
            return
        if tag == "link" and attrs.get("rel", "").lower() == "stylesheet":
            content = self.bundler.asset(attrs["href"], self.base, css_text=True)
            media = f' media="{html.escape(attrs["media"], quote=True)}"' if attrs.get("media") else ""
            self.output.append(f"<style{media}>" + content.replace("</style", "<\\/style") + "</style>")
            return
        changed = False
        if tag == "script" and attrs.get("src"):
            url = self.bundler.resolve(attrs.pop("src"), self.base)
            if attrs.get("type", "").lower() == "module" or "async" in attrs or "defer" in attrs:
                raise PackagingError("Prepare module/async/defer scripts before packaging to preserve execution order")
            script = self.bundler.read(url).decode("utf-8-sig")
            self.bundler.asset(url, self.base)
            attrs.pop("integrity", None)
            attrs.pop("crossorigin", None)
            self.output.append("<script" + self.attrs(attrs) + ">" + script.replace("</script", "<\\/script"))
            self.external_script = True
            return
        for name in ("src", "poster", "data", "xlink:href"):
            if name in attrs and (name != "data" or tag == "object"):
                attrs[name] = self.bundler.asset(attrs[name], self.base)
                changed = True
        if "href" in attrs:
            ref = attrs["href"]
            if tag in ("image", "use", "link") or (tag == "a" and urlsplit(ref).scheme in ("", "file") and not ref.startswith("#")):
                attrs["href"] = self.bundler.asset(ref, self.base)
                changed = True
        if "style" in attrs:
            attrs["style"] = self.bundler.css(attrs["style"], self.base)
            changed = True
        self.output.append("<" + tag + self.attrs(attrs) + ">" if changed else self.get_starttag_text())
        if tag == "style":
            self.style = []

    @staticmethod
    def attrs(attrs):
        return "".join(" " + key + ("" if value is None else '="' + html.escape(value, quote=True) + '"')
                       for key, value in attrs.items())

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if self.output and self.output[-1].endswith(">") and not self.output[-1].endswith("</style>"):
            self.output[-1] = self.output[-1][:-1] + "/>"

    def handle_endtag(self, tag):
        if tag == "style" and self.style is not None:
            self.output.append(self.bundler.css("".join(self.style), self.base))
            self.style = None
        if tag == "script":
            self.external_script = False
        self.output.append(f"</{tag}>")

    def handle_data(self, data):
        if self.style is not None:
            self.style.append(data)
        elif not self.external_script:
            self.output.append(data)

    def handle_entityref(self, name):
        self.handle_data("&" + name + ";")

    def handle_charref(self, name):
        self.handle_data("&#" + name + ";")

    def handle_comment(self, data):
        self.output.append("<!--" + data + "-->")

    def handle_decl(self, decl):
        self.output.append("<!" + decl + ">")


def package(input_file, output_file, allow_remote=False, manifest=None):
    input_file = Path(input_file).resolve()
    content = input_file.read_text(encoding="utf-8")
    if not re.search(r"<html\b", content, re.I) or not re.search(r"<head\b", content, re.I):
        raise PackagingError("Input is a fragment; assemble it with deck.html before packaging")
    content = re.sub(r'<script type="application/json" id="standalone-provenance">[\s\S]*?</script>', "", content)
    content = re.sub(r'<script id="standalone-link-runtime">[\s\S]*?</script>', "", content)
    if manifest is not None:
        manifest = Path(manifest).resolve()
        record = json.loads(manifest.read_text(encoding="utf-8"))
        payload = json.dumps(record, ensure_ascii=False).replace("<", "\\u003c")
        links = [(manifest, "보존 기록")]
        for name in ("source.pptx", "source.pdf"):
            file = manifest.parent / name
            if not file.is_file():
                raise PackagingError(f"Missing preservation source: {file}")
            links.append((file, name))
        for asset in record.get("assets", []):
            file = manifest.parent / asset["file"]
            if hashlib.sha256(file.read_bytes()).hexdigest() != asset["sha256"]:
                raise PackagingError(f"Original asset hash mismatch: {file.name}")
            links.append((file, "원본 자산 · " + file.name))
        downloads = "".join(f'<li><a download="{html.escape(file.name)}" href="{file.as_uri()}">{html.escape(label)}</a></li>' for file, label in links)
        insert = f'<script type="application/json" id="source-preservation">{payload}</script><details><summary>원본 다운로드 · 보존 기록</summary><ul>{downloads}</ul></details>'
        closing = r"</main\s*>" if re.search(r"</main\s*>", content, re.I) else r"</body\s*>"
        if not re.search(closing, content, re.I):
            raise PackagingError("Preservation input requires an explicit closing body element")
        content = re.sub(closing, lambda m: insert + m[0], content, count=1, flags=re.I)
    bundler = Bundler(allow_remote)
    doc = Document(bundler, input_file.as_uri())
    doc.feed(content)
    doc.close()
    result = "".join(doc.output)
    record = {"format": "standalone-html-v1", "resources": [
        {k: v for k, v in item.items() if k != "value"} for item in bundler.resources.values()]}
    metadata = '<script type="application/json" id="standalone-provenance">' + json.dumps(record, ensure_ascii=False).replace("<", "\\u003c") + "</script>"
    metadata += EMBEDDED_LINKS
    result = result.replace("</body>", metadata + "\n</body>", 1) if "</body>" in result else result + metadata
    if not re.search(r'<meta\b[^>]*charset\s*=', result, re.I):
        result = re.sub(r"(<head\b[^>]*>)", r'\1<meta charset="utf-8">', result, count=1, flags=re.I)
    output_file = Path(output_file)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text(result, encoding="utf-8")
    return len(record["resources"])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--allow-remote", action="store_true")
    parser.add_argument("--manifest", type=Path, help="Embed preservation manifest and original source/media downloads")
    args = parser.parse_args()
    try:
        count = package(args.input, args.out, args.allow_remote, args.manifest)
    except (PackagingError, OSError, UnicodeError) as error:
        parser.error(str(error))
    print(f"{args.out}: standalone HTML, {count} resources embedded")


if __name__ == "__main__":
    main()
