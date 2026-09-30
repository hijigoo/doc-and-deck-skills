#!/usr/bin/env python3
"""Assemble chapter fragments into either reading template (stdlib only)."""
import argparse
import html
import re
from pathlib import Path

SKILL_ROOT = Path(__file__).resolve().parents[1]
THEMES = ("deep-navy",)


def template_path(theme):
    return SKILL_ROOT / "deck.html"


def assemble(source, template, title, subtitle="", kicker="", intro="", h1=None,
             sb_title=None, meta="", icons=""):
    source = re.sub(r"<!--[\s\S]*?-->", "", source)
    chapters = re.findall(r'<article\b[^>]*class="chapter"[^>]*>[\s\S]*?</article>', source)
    if not chapters:
        raise ValueError('Expected <article class="chapter"> fragments, not raw Markdown.')
    for index, chapter in enumerate(chapters, 1):
        if len(re.findall(r'class="sheet"', chapter)) != 1 or 'class="note-body"' not in chapter:
            raise ValueError(f"Chapter {index}: exactly one sheet and a note-body are required.")
    replacements = {
        "sb-title": sb_title if sb_title is not None else html.escape(title).replace(" — ", "<br>"),
        "h1": html.escape(h1 or title),
        "subtitle": html.escape(subtitle),
        "kicker": html.escape(kicker),
        "intro": intro,
        "meta": "".join(f"<span>{html.escape(item.strip())}</span>" for item in meta.split("|") if item.strip()),
        "chapters": "\n".join(chapters),
    }
    for key, value in replacements.items():
        pattern = rf"(<!-- {key}:start -->)[\s\S]*?(<!-- {key}:end -->)"
        template, count = re.subn(pattern, lambda m: m[1] + value + m[2], template)
        if count != 1:
            raise ValueError(f"Template requires exactly one {key} marker pair.")
    # <title> cannot contain HTML comments; it is deliberately separate.
    template = re.sub(r"<title>[\s\S]*?</title>", lambda _: f"<title>{html.escape(title)}</title>", template, count=1)
    if icons:
        template = template.replace("<body>", "<body>\n" + icons, 1)
    return template


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("slides", type=Path)
    parser.add_argument("-o", "--out", required=True, type=Path)
    parser.add_argument("--theme", choices=THEMES, default="deep-navy")
    parser.add_argument("--title", required=True)
    parser.add_argument("--icons", type=Path, help="Optional original SVG symbols to copy unchanged")
    for key in ("sb-title", "h1"):
        parser.add_argument("--" + key)
    for key in ("subtitle", "kicker", "intro", "meta"):
        parser.add_argument("--" + key, default="")
    args = parser.parse_args()
    template = template_path(args.theme)
    try:
        result = assemble(args.slides.read_text(encoding="utf-8"), template.read_text(encoding="utf-8"),
                          args.title, args.subtitle, args.kicker, args.intro, args.h1, args.sb_title, args.meta,
                          args.icons.read_text(encoding="utf-8") if args.icons else "")
    except (ValueError, OSError) as error:
        parser.error(str(error))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(result, encoding="utf-8")
    count = result.count('<article class="chapter"')
    print(f"{args.out}: {count} chapters ({args.theme})")


if __name__ == "__main__":
    main()
