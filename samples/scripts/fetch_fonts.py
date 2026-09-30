"""Fetch OFL-licensed theme fonts; retain licenses and provenance beside assets."""
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1] / "assets" / "fonts"
GOOGLE = "https://raw.githubusercontent.com/google/fonts/main/ofl/"
PRETENDARD = "https://raw.githubusercontent.com/orioncactus/pretendard/v1.3.9/"
FILES = {
    "Pretendard-Regular.otf": PRETENDARD + "packages/pretendard/dist/public/static/Pretendard-Regular.otf",
    "Pretendard-Bold.otf": PRETENDARD + "packages/pretendard/dist/public/static/Pretendard-Bold.otf",
    "Pretendard-LICENSE.txt": PRETENDARD + "LICENSE",
    "IBMPlexSansKR-Regular.ttf": GOOGLE + "ibmplexsanskr/IBMPlexSansKR-Regular.ttf",
    "IBMPlexSansKR-Bold.ttf": GOOGLE + "ibmplexsanskr/IBMPlexSansKR-Bold.ttf",
    "IBMPlexSansKR-OFL.txt": GOOGLE + "ibmplexsanskr/OFL.txt",
    "Manrope.ttf": GOOGLE + "manrope/Manrope%5Bwght%5D.ttf",
    "Manrope-OFL.txt": GOOGLE + "manrope/OFL.txt",
    "Archivo.ttf": GOOGLE + "archivo/Archivo%5Bwdth,wght%5D.ttf",
    "Archivo-OFL.txt": GOOGLE + "archivo/OFL.txt",
    "IBMPlexMono-Regular.ttf": GOOGLE + "ibmplexmono/IBMPlexMono-Regular.ttf",
    "IBMPlexMono-OFL.txt": GOOGLE + "ibmplexmono/OFL.txt",
}
ROOT.mkdir(parents=True, exist_ok=True)
records = []
for name, url in FILES.items():
    target = ROOT / name
    if not target.exists():
        with urlopen(url, timeout=60) as response:
            target.write_bytes(response.read())
    data = target.read_bytes()
    records.append(dict(file=name, url=url, sha256=hashlib.sha256(data).hexdigest(), bytes=len(data)))
    print(name, len(data))
(ROOT / "provenance.json").write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")
