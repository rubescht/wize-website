#!/usr/bin/env python3
"""Adds or refreshes the security tags on every page of this site:
a Content Security Policy (inline scripts pinned by hash), a referrer policy and an anti-framing guard.
Run after editing any inline <script>:  python3 tools/csp.py"""
import re, hashlib, base64, glob, os
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOTS = ["."]          # folders that are published as the website
CONNECT = []      # extra hosts pages may send data to
GUARD = "/* Anti-clickjacking: refuse to render inside another site's frame. */\n(function(){ if(window.top!==window.self){ try{ window.top.location.replace(window.self.location.href); }catch(e){ document.documentElement.style.visibility='hidden'; } } })();\n"
START, END = "<!-- security:start -->", "<!-- security:end -->"
for root in ROOTS:
    base = os.path.join(REPO, root)
    os.makedirs(os.path.join(base, "assets"), exist_ok=True)
    open(os.path.join(base, "assets", "guard.js"), "w").write(GUARD)
    for path in sorted(glob.glob(os.path.join(base, "**", "*.html"), recursive=True)):
        if "node_modules" in path: continue
        s = open(path, encoding="utf-8").read()
        s = re.sub(re.escape(START) + r".*?" + re.escape(END) + r"\n?", "", s, flags=re.S)
        hashes = ["'sha256-" + base64.b64encode(hashlib.sha256(m.group(1).encode()).digest()).decode() + "'"
                  for m in re.finditer(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", s, flags=re.S)]
        gf = "fonts.googleapis.com" in s
        d = [("default-src", ["'self'"]), ("script-src", ["'self'"] + hashes),
             ("style-src", ["'self'", "'unsafe-inline'"] + (["https://fonts.googleapis.com"] if gf else [])),
             ("font-src", ["'self'", "data:"] + (["https://fonts.gstatic.com"] if gf else [])),
             ("img-src", ["'self'", "data:", "blob:"]), ("media-src", ["'self'", "blob:"]),
             ("connect-src", ["'self'"] + CONNECT), ("worker-src", ["'self'", "blob:"]), ("frame-src", ["'none'"]),
             ("object-src", ["'none'"]), ("base-uri", ["'self'"]), ("form-action", ["'self'", "mailto:"]), ("upgrade-insecure-requests", [])]
        csp = "; ".join((k + " " + " ".join(v)).strip() for k, v in d)
        rel = os.path.relpath(os.path.join(base, "assets", "guard.js"), os.path.dirname(path)).replace(os.sep, "/")
        block = (f'{START}\n<meta http-equiv="Content-Security-Policy" content="{csp}">\n'
                 f'<meta name="referrer" content="strict-origin-when-cross-origin">\n<script src="{rel}"></script>\n{END}\n')
        new, n = re.subn(r'(<meta name="viewport"[^>]*>\n?)', lambda m: m.group(1) + ("" if m.group(1).endswith("\n") else "\n") + block, s, count=1)
        if not n: new, n = re.subn(r'(<head[^>]*>\n?)', lambda m: m.group(1) + ("" if m.group(1).endswith("\n") else "\n") + block, s, count=1)
        open(path, "w", encoding="utf-8").write(new)
        print(os.path.relpath(path, REPO), len(hashes), "inline scripts" + ("" if n else "  !! no <head> found"))
