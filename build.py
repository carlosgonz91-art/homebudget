"""Build from homebudget.src.html (a page fragment: <title>, <style>, markup, <script>).

  homebudget.html           standalone file (adds doctype/head) with pdf.js inlined
  homebudget.artifact.html  fragment for the Artifact tool (the host adds doctype/head) with pdf.js inlined

pdf.js is Apache-2.0 (Mozilla); its license header is preserved inside the inlined file.
"""
import base64, pathlib

SP = pathlib.Path("/tmp/claude-0/-home-claude/a78b219c-6266-510d-9126-22aef69b49b9/scratchpad/pdfjs/node_modules/pdfjs-dist/build")
src = pathlib.Path("/home/claude/homebudget.src.html").read_text(encoding="utf-8")
lib = (SP / "pdf.min.js").read_text(encoding="utf-8")
worker = (SP / "pdf.worker.min.js").read_bytes()

if "</script" in lib.lower():
    lib = lib.replace("</script", "<\\/script")
assert "<!--PDFJS_LIB-->" in src and "<!--PDFJS_WORKER-->" in src

frag = src.replace("<!--PDFJS_LIB-->", "<script>\n" + lib + "\n</script>")
frag = frag.replace(
    "<!--PDFJS_WORKER-->",
    '<script id="pdfjs-worker-b64" type="text/plain">' + base64.b64encode(worker).decode("ascii") + "</script>",
)

pathlib.Path("/home/claude/homebudget.artifact.html").write_text(frag, encoding="utf-8")

import re as _re
_csp = _re.search(r'<meta http-equiv="Content-Security-Policy"[^>]*>\n?', frag)
_csph = _csp.group(0).strip() if _csp else ''
_body = frag.replace(_csp.group(0), '', 1) if _csp else frag
standalone = (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">'
    + _csph +
    '<meta name="viewport" content="width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">'
    "</head><body>\n" + _body + "\n</body></html>"
)
pathlib.Path("/home/claude/homebudget.html").write_text(standalone, encoding="utf-8")
print("built", round(len(standalone) / 1e6, 2), "MB")
