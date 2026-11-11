"""Build index.html (the whole app in one file) from the source in src/.

Run from anywhere:  python build.py        (Python 3, standard library only; works on Windows)

  src/homebudget.src.html      the app source: <title>, <style>, markup, <script>. EDIT THIS FILE.
  vendor/pdfjs/                pdf.js 3.11.174 (Apache-2.0, license header kept inside), inlined into the build
  index.html                   the built file that GitHub Pages serves. Never edit it by hand; it is overwritten.
"""
import base64, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "src" / "homebudget.src.html"
VENDOR = ROOT / "vendor" / "pdfjs"

src = SRC.read_text(encoding="utf-8")
lib = (VENDOR / "pdf.min.js").read_text(encoding="utf-8")
worker = (VENDOR / "pdf.worker.min.js").read_bytes()

if "</script" in lib.lower():
    lib = lib.replace("</script", "<\\/script")
assert "<!--PDFJS_LIB-->" in src and "<!--PDFJS_WORKER-->" in src

frag = src.replace("<!--PDFJS_LIB-->", "<script>\n" + lib + "\n</script>")
frag = frag.replace(
    "<!--PDFJS_WORKER-->",
    '<script id="pdfjs-worker-b64" type="text/plain">' + base64.b64encode(worker).decode("ascii") + "</script>",
)

import re as _re
_csp = _re.search(r'<meta http-equiv="Content-Security-Policy"[^>]*>\n?', frag)
_csph = _csp.group(0).strip() if _csp else ''
_body = frag.replace(_csp.group(0), '', 1) if _csp else frag
# the leading <title>/<meta>/<link> lines belong in <head>: Chrome ignores a manifest or icons placed in <body>
_lines = _body.split('\n'); _k = 0
while _k < len(_lines) and _re.match(r'\s*(<title>.*</title>|<meta [^>]*>|<link [^>]*>|<!--.*-->)?\s*$', _lines[_k]): _k += 1
_headx = '\n'.join(l for l in _lines[:_k] if l.strip()); _body = '\n'.join(_lines[_k:])
standalone = (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">'
    + _csph +
    '<meta name="viewport" content="width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">'
    + "\n" + _headx + "\n</head><body>\n" + _body + "\n</body></html>"
)
(ROOT / "index.html").write_text(standalone, encoding="utf-8", newline="\n")
print("built", round(len(standalone) / 1e6, 2), "MB")
