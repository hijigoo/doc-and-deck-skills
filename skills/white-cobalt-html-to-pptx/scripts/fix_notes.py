#!/usr/bin/env python3
"""Restore line breaks in PPTX speaker notes.

pptxgenjs 4.x silently drops the *entire* note when the string passed to
`addNotes()` contains a newline — you get a notes page with nothing on it and
no warning anywhere in the build log. Passing an array of runs does not help
either; `addNotes` stringifies it to "[object Object]".

The workaround is two-sided:

  1. The generator replaces newlines with a sentinel that is valid XML text
     and survives the round trip:

         s.addNotes(note.replace(/\\n/g, NOTE_BR));   // NOTE_BR = "\\u2424"

  2. This script rewrites each sentinel into a real <a:br/>, which is how
     OOXML expresses a soft line break inside a paragraph.

Do not be tempted to emit a vertical tab (0x0B) instead. PowerPoint uses it
internally, but it is not a legal XML 1.0 character — the package fails schema
validation and PowerPoint refuses the file.

    python3 fix_notes.py deck.pptx
"""

import re
import shutil
import sys
import zipfile
from pathlib import Path

# U+2424 SYMBOL FOR NEWLINE — a printable character, so it is valid XML text,
# and one nobody would type into a speaker note by accident.
SENTINEL = "\u2424"

NOTE_PART = re.compile(r"^ppt/notesSlides/notesSlide\d+\.xml$")


def convert(xml: str) -> tuple[str, int]:
    """Split every <a:t> holding sentinels into runs joined by <a:br/>."""
    count = 0
    # <a:br/> is a sibling of <a:r>, not something that can sit inside <a:t>,
    # so each break closes the current run and opens the next one.
    joiner = "</a:t></a:r><a:br/><a:r><a:t>"

    def repl(m: re.Match) -> str:
        nonlocal count
        body = m.group(1)
        if SENTINEL not in body:
            return m.group(0)
        parts = body.split(SENTINEL)
        count += len(parts) - 1
        return "<a:t>" + joiner.join(parts) + "</a:t>"

    out = re.sub(r"<a:t>(.*?)</a:t>", repl, xml, flags=re.S)
    return out, count


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2

    path = Path(sys.argv[1])
    if not path.exists():
        print(f"no such file: {path}")
        return 1

    src = path.with_suffix(path.suffix + ".tmp")
    shutil.move(path, src)

    total = 0
    touched = 0
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(
        path, "w", zipfile.ZIP_DEFLATED
    ) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if NOTE_PART.match(item.filename):
                xml = data.decode("utf-8")
                if SENTINEL in xml:
                    xml, n = convert(xml)
                    total += n
                    touched += 1
                    data = xml.encode("utf-8")
            zout.writestr(item, data)

    src.unlink()
    print(f"restored {total} line break(s) across {touched} notes page(s) -> {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
