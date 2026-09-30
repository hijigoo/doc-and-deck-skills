#!/usr/bin/env python3
"""Portable PPTX STRUCTURAL checks, not full XSD or Office application validation.

Usage: python3 scripts/check_pptx.py deck.pptx [deck2.pptx ...]
Requires lxml. Always also open/render the result in PowerPoint or LibreOffice.
"""
from __future__ import annotations

import posixpath
import re
import stat
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit
from zipfile import BadZipFile, ZipFile

from lxml import etree

P = "http://schemas.openxmlformats.org/presentationml/2006/main"
A = "http://schemas.openxmlformats.org/drawingml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
REL = "http://schemas.openxmlformats.org/package/2006/relationships"
CT = "http://schemas.openxmlformats.org/package/2006/content-types"
NS = {"p": P, "a": A}
MAX_XML_BYTES = 32 * 1024 * 1024
MAX_PACKAGE_BYTES = 512 * 1024 * 1024


def safe_name(name):
    return (bool(name) and not name.startswith(("/", "\\")) and "\\" not in name
            and not any(ord(character) < 32 for character in name)
            and not re.match(r"^[A-Za-z]:", name)
            and all(part not in ("", ".", "..") for part in name.rstrip("/").split("/")))


def uint(value):
    if value is not None and value.isascii() and value.isdigit() and int(value) <= 4294967295:
        return int(value)
    return None


def relationship_source(name):
    if name == "_rels/.rels":
        return ""
    directory, filename = posixpath.split(name)
    if posixpath.basename(directory) != "_rels" or not filename.endswith(".rels"):
        raise ValueError(f"Invalid relationship part path: {name}")
    return posixpath.join(posixpath.dirname(directory), filename[:-5])


def internal_target(source, target):
    parsed = urlsplit(target)
    if parsed.scheme or parsed.netloc or parsed.query:
        raise ValueError(f"Invalid internal relationship URI: {target}")
    decoded = unquote(parsed.path)
    if not decoded or "\\" in decoded or "\x00" in decoded:
        raise ValueError(f"Invalid internal relationship target: {target}")
    base = "" if decoded.startswith("/") else posixpath.dirname(source)
    resolved = posixpath.normpath(posixpath.join(base, decoded.lstrip("/")))
    if not safe_name(resolved):
        raise ValueError(f"Relationship escapes package: {target}")
    return resolved


def inspect(path):
    """Return all detected errors without extracting anything from the ZIP."""
    errors, xml, relationships = [], {}, {}
    with ZipFile(path) as archive:
        entries = archive.infolist()
        names = [item.filename for item in entries]
        if len(names) != len(set(names)):
            errors.append("Duplicate ZIP entry names.")
        if len(entries) > 100000 or sum(item.file_size for item in entries) > MAX_PACKAGE_BYTES:
            return errors + ["Package exceeds structural check safety limits (512 MiB / 100000 entries)."]
        files = {item.filename for item in entries if not item.is_dir()}
        for entry in entries:
            name = entry.filename
            if not safe_name(name):
                errors.append(f"Unsafe ZIP path: {name!r}")
                continue
            if stat.S_ISLNK(entry.external_attr >> 16):
                errors.append(f"ZIP symlink is not a package part: {name}")
                continue
            if entry.is_dir():
                continue
            data = archive.read(entry)  # Also verifies CRC for binary parts.
            if name.endswith((".xml", ".rels")) or name == "[Content_Types].xml":
                if len(data) > MAX_XML_BYTES:
                    errors.append(f"{name}: XML exceeds 32 MiB safety limit.")
                    continue
                try:
                    parser = etree.XMLParser(resolve_entities=False, no_network=True,
                                             load_dtd=False, recover=False, huge_tree=False)
                    root = etree.fromstring(data, parser)
                    if root.getroottree().docinfo.doctype or any(
                            isinstance(node, etree._Entity) for node in root.iter()):
                        raise ValueError("DTD/entity declarations are not allowed in OOXML.")
                    xml[name] = root
                except (etree.XMLSyntaxError, ValueError) as error:
                    errors.append(f"{name}: invalid/unsafe XML: {error}")

        for required in ("[Content_Types].xml", "_rels/.rels", "ppt/presentation.xml",
                         "ppt/_rels/presentation.xml.rels"):
            if required not in xml:
                errors.append(f"Missing or invalid required part: {required}")

        for name, root in xml.items():
            if not name.endswith(".rels"):
                continue
            try:
                source = relationship_source(name)
            except ValueError as error:
                errors.append(str(error))
                continue
            if source and source not in files:
                errors.append(f"{name}: source part does not exist: {source}")
            if root.tag != f"{{{REL}}}Relationships":
                errors.append(f"{name}: invalid Relationships root.")
                continue
            rels = {}
            for item in root:
                if not isinstance(item.tag, str):
                    continue
                if item.tag != f"{{{REL}}}Relationship":
                    errors.append(f"{name}: unexpected relationship element.")
                    continue
                rid, kind, target = item.get("Id"), item.get("Type"), item.get("Target")
                if not rid or not kind or not target or rid in rels:
                    errors.append(f"{name}: missing/duplicate relationship Id, Type or Target: {rid!r}")
                    continue
                mode = item.get("TargetMode", "Internal")
                if mode not in ("Internal", "External"):
                    errors.append(f"{name}: invalid TargetMode {mode!r}.")
                    continue
                resolved = None
                if mode == "Internal":
                    try:
                        resolved = internal_target(source, target)
                        if resolved not in files:
                            errors.append(f"{name}: missing target part: {resolved}")
                    except ValueError as error:
                        errors.append(f"{name}: {error}")
                rels[rid] = (kind, resolved, mode)
            relationships[source] = rels

        types = xml.get("[Content_Types].xml")
        if types is not None:
            defaults, overrides = {}, {}
            if types.tag != f"{{{CT}}}Types":
                errors.append("[Content_Types].xml: invalid Types root.")
            for node in types:
                if not isinstance(node.tag, str):
                    continue
                kind = etree.QName(node).localname
                key = node.get("Extension") if kind == "Default" else node.get("PartName")
                content_type = node.get("ContentType")
                store = defaults if kind == "Default" else overrides
                if node.tag not in (f"{{{CT}}}Default", f"{{{CT}}}Override") or not key or not content_type:
                    errors.append("[Content_Types].xml: invalid content-type declaration.")
                    continue
                if key in store:
                    errors.append(f"[Content_Types].xml: duplicate declaration: {key}")
                store[key] = content_type
                if kind == "Override" and (not key.startswith("/") or unquote(key[1:]) not in files):
                    errors.append(f"[Content_Types].xml: override targets absent part: {key}")
            for name in files - {"[Content_Types].xml"}:
                if "/" + name not in overrides and name.rsplit(".", 1)[-1] not in defaults:
                    errors.append(f"{name}: missing content-type declaration.")
            expected_types = {
                "ppt/presentation.xml": "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
            }
            for name in files:
                if re.fullmatch(r"ppt/slides/slide\d+\.xml", name):
                    expected_types[name] = "application/vnd.openxmlformats-officedocument.presentationml.slide+xml"
            for name, expected in expected_types.items():
                actual = overrides.get("/" + name, defaults.get("xml"))
                if actual != expected:
                    errors.append(f"{name}: unexpected content type: {actual!r}")

        office = [rel for rel in relationships.get("", {}).values() if rel[0] == R + "/officeDocument"]
        if len(office) != 1 or office[0][1:] != ("ppt/presentation.xml", "Internal"):
            errors.append("Root relationships must contain one internal ppt/presentation.xml officeDocument.")

        presentation = xml.get("ppt/presentation.xml")
        listed_slides = set()
        if presentation is not None:
            if presentation.tag != f"{{{P}}}presentation":
                errors.append("ppt/presentation.xml: invalid presentation root.")
            size = presentation.find(f"{{{P}}}sldSz")
            if size is None or any(not (size.get(key, "").isdigit() and int(size.get(key)) > 0)
                                   for key in ("cx", "cy")):
                errors.append("ppt/presentation.xml: missing/invalid slide dimensions.")
            slides = presentation.findall(f"{{{P}}}sldIdLst/{{{P}}}sldId")
            if not slides:
                errors.append("Presentation contains no slide references.")
            ids = set()
            for slide in slides:
                sid = slide.get("id", "")
                if not sid.isdigit() or not 256 <= int(sid) < 2147483648 or sid in ids:
                    errors.append(f"ppt/presentation.xml: invalid/duplicate slide ID: {sid!r}")
                ids.add(sid)
                rid = slide.get(f"{{{R}}}id")
                rel = relationships.get("ppt/presentation.xml", {}).get(rid)
                if not rel or rel[0] != R + "/slide" or rel[2] != "Internal":
                    errors.append(f"ppt/presentation.xml: invalid slide relationship: {rid!r}")
                    continue
                target = rel[1]
                if target in listed_slides:
                    errors.append(f"ppt/presentation.xml: repeated slide target: {target}")
                listed_slides.add(target)
                if target not in xml or xml[target].tag != f"{{{P}}}sld":
                    errors.append(f"Missing or invalid slide XML: {target}")

        for name, root in xml.items():
            if name.endswith(".rels"):
                continue
            for node in root.iter():
                for attr, rid in node.attrib.items():
                    if attr.startswith(f"{{{R}}}") and rid not in relationships.get(name, {}):
                        errors.append(f"{name}: unresolved relationship reference: {rid!r}")
            if root.tag not in {f"{{{P}}}{kind}" for kind in
                                ("sld", "sldLayout", "sldMaster", "notes", "notesMaster")}:
                continue
            if root.find(f"{{{P}}}cSld/{{{P}}}spTree") is None:
                errors.append(f"{name}: missing cSld/spTree.")
            relation_kind = {
                f"{{{P}}}sld": ("slideLayout", "sldLayout"),
                f"{{{P}}}sldLayout": ("slideMaster", "sldMaster"),
                f"{{{P}}}notes": ("notesMaster", "notesMaster"),
            }.get(root.tag)
            if relation_kind:
                kind, target_tag = relation_kind
                matches = [rel for rel in relationships.get(name, {}).values() if rel[0] == R + "/" + kind]
                if (len(matches) != 1 or matches[0][2] != "Internal"
                        or matches[0][1] not in xml
                        or xml[matches[0][1]].tag != f"{{{P}}}{target_tag}"):
                    errors.append(f"{name}: requires one valid internal {kind} relationship.")
            shape_ids = set()
            for node in root.iter(f"{{{P}}}cNvPr"):
                sid = node.get("id", "")
                number = uint(sid)
                if number is None or number in shape_ids:
                    errors.append(f"{name}: invalid/duplicate local shape ID: {sid!r}")
                if number is not None:
                    shape_ids.add(number)
            for timing in root.findall(f"{{{P}}}timing"):
                time_ids = set()
                if timing.find(f"{{{P}}}tnLst") is None and timing.find(f"{{{P}}}bldLst") is None:
                    errors.append(f"{name}: timing requires a time-node or build list.")
                for node in timing.iter(f"{{{P}}}cTn"):
                    tid = node.get("id", "")
                    number = uint(tid)
                    if number is None or number in time_ids:
                        errors.append(f"{name}: invalid/duplicate timing ID: {tid!r}")
                    if number is not None:
                        time_ids.add(number)
                for node in timing.iter():
                    if (("spid" in node.attrib or node.tag == f"{{{P}}}spTgt")
                            and uint(node.get("spid")) not in shape_ids):
                        errors.append(f"{name}: timing targets missing shape: {node.get('spid')}")
                    if node.tag == f"{{{P}}}tn" and uint(node.get("val")) not in time_ids:
                        errors.append(f"{name}: timing targets missing time node: {node.get('val')}")
                    if node.tag == f"{{{P}}}cBhvr" and (
                            node.find(f"{{{P}}}cTn") is None or node.find(f"{{{P}}}tgtEl") is None):
                        errors.append(f"{name}: timing behavior requires cTn and tgtEl.")
    return errors


def check(path):
    try:
        errors = inspect(path)
    except (OSError, BadZipFile, ValueError, RuntimeError, etree.LxmlError) as error:
        errors = [str(error)]
    for error in errors:
        print(f"  {error}")
    print(f"{Path(path).name}: STRUCTURAL {'FAIL' if errors else 'OK'}"
          " — not full XSD validation or PowerPoint/LibreOffice open/render validation")
    return len(errors)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("usage: python3 scripts/check_pptx.py deck.pptx [deck2.pptx ...]")
    sys.exit(1 if sum(check(path) for path in sys.argv[1:]) else 0)
