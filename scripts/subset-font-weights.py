"""Restrict the weight axis of the bundled variable fonts to the range the site can
actually render, and report the saving.

The bundled families ship the designers' full wght axis (200-900). Nothing in Quire
can request a weight outside 400-700: the type system exposes size/line/spacing but
no weight (`TypeStyle`), custom-font uploads are limited to 400/500/600/700, and the
stylesheets only use 400/500/600/700. The extra axis range is pure download weight -
and it lands on the critical path, because the reading font paints the LCP text.

The `opsz` axis is KEPT: `globals.css` sets `font-optical-sizing: auto` on purpose, so
pinning it would change how the text renders at different sizes.

Usage:
    python scripts/subset-font-weights.py            # report only
    python scripts/subset-font-weights.py --write    # rewrite the files in place

After --write, update the matching `font-weight: 200 900` in globals.css to the new
range so the browser is told the truth about what the file contains.
"""

import os
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

FONT_DIR = os.path.join("public", "fonts")
MIN_W, MAX_W = 400, 700

write = "--write" in sys.argv
total_before = total_after = 0
rows = []

for name in sorted(os.listdir(FONT_DIR)):
    if not name.endswith(".woff2"):
        continue
    path = os.path.join(FONT_DIR, name)
    before = os.path.getsize(path)

    font = TTFont(path)
    if "fvar" not in font:
        rows.append((name, before, before, "static - skipped"))
        total_before += before
        total_after += before
        continue

    axes = {a.axisTag: (a.minValue, a.maxValue) for a in font["fvar"].axes}
    if "wght" not in axes:
        rows.append((name, before, before, "no wght axis - skipped"))
        total_before += before
        total_after += before
        continue

    lo, hi = axes["wght"]
    if lo >= MIN_W and hi <= MAX_W:
        rows.append((name, before, before, f"already {int(lo)}-{int(hi)}"))
        total_before += before
        total_after += before
        continue

    # Keep opsz untouched; clamp wght to the usable range.
    instancer.instantiateVariableFont(font, {"wght": (MIN_W, MAX_W)}, inplace=True)
    font.flavor = "woff2"

    tmp = path + ".tmp"
    font.save(tmp)
    after = os.path.getsize(tmp)

    # Instancing does not always shrink a file - a couple of these families are
    # already packed in a way that re-compresses larger. Never ship a bigger file
    # for no reason; leave those alone.
    if after >= before:
        os.remove(tmp)
        total_before += before
        total_after += before
        rows.append((name, before, before, "would grow - left alone"))
        continue

    if write:
        os.replace(tmp, path)
    else:
        os.remove(tmp)

    total_before += before
    total_after += after
    rows.append((name, before, after, f"wght {int(lo)}-{int(hi)} -> {MIN_W}-{MAX_W}"))

w = max(len(r[0]) for r in rows)
for name, before, after, note in rows:
    pct = f"-{round((1 - after / before) * 100)}%" if after < before else ""
    print(f"{name.ljust(w)}  {before/1024:7.1f} KB -> {after/1024:7.1f} KB  {pct:>5}  {note}")

print(
    f"\ntotal {total_before/1024:.1f} KB -> {total_after/1024:.1f} KB "
    f"({(total_before - total_after)/1024:.1f} KB saved)"
)
print("(report only - pass --write to apply)" if not write else "(files rewritten)")
