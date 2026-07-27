"""Trim the variation axes of the bundled variable fonts to what the site can actually
render, and report the saving.

Two axes, two rules.

`wght` is CLAMPED to 400-700. The families ship the designers' full range (200-900).
Nothing in Quire can request a weight outside 400-700: the type system exposes
size/line/spacing but no weight (`TypeStyle`), custom-font uploads are limited to
400/500/600/700, and the stylesheets only use 400/500/600/700.

`opsz` is PINNED to 18. This reverses an earlier decision to keep it, and the reason is
that it turned out to be the single largest item on the LCP critical path:

    literata-latin.woff2   300 glyphs, opsz + wght    80,660 B
    inter-latin.woff2      518 glyphs, wght only      36,116 B

Literata carries 42% fewer glyphs than Inter and is 2.2x the size. The whole difference
is the `gvar` table (91 KB uncompressed), which stores deltas for every glyph across the
optical range. Pinning the axis removes that dimension and halves the file. Narrowing
the range instead was measured and is not competitive:

    full 7-72 (before)   80,660      limited 16-36    63,068
    limited 12-24        58,012      pinned 18        37,568

18 was chosen over 14/16/24 by rendering all four side by side and looking at them. The
body copy is 18px, so pinning at 18 leaves the body IDENTICAL to what
`font-optical-sizing: auto` produced, and body copy is where a reader spends their time.
The cost is that a 36px post title now renders in the 18pt design, so it is slightly
heavier than before. That was judged an acceptable trade for 43 KB off the critical
path; pinning at 24 instead would match titles more closely but shift the compromise
onto the body.

Only Literata and Source Serif 4 have an `opsz` axis. Inter, Source Sans 3 and the mono
faces are unaffected by that half of the script.

Usage:
    python scripts/subset-font-axes.py            # report only
    python scripts/subset-font-axes.py --write    # rewrite the files in place

Needs `pip install fonttools brotli`. After --write, keep `globals.css` truthful: the
`@font-face` `font-weight` range must match the clamped axis, and `font-optical-sizing`
is now a no-op for every bundled face.
"""

import os
import sys

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

FONT_DIR = os.path.join("public", "fonts")
MIN_W, MAX_W = 400, 700
PIN_OPSZ = 18

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

    # A (min, max) tuple keeps an axis and narrows it; a bare number removes it. Only
    # include an axis that actually needs work, so an already-trimmed file reports
    # "nothing to do" instead of being needlessly re-encoded.
    spec = {}
    notes = []
    if "wght" in axes:
        lo, hi = axes["wght"]
        if lo < MIN_W or hi > MAX_W:
            spec["wght"] = (MIN_W, MAX_W)
            notes.append(f"wght {int(lo)}-{int(hi)} -> {MIN_W}-{MAX_W}")
    if "opsz" in axes:
        lo, hi = axes["opsz"]
        spec["opsz"] = PIN_OPSZ
        notes.append(f"opsz {int(lo)}-{int(hi)} -> pinned {PIN_OPSZ}")

    if not spec:
        rows.append((name, before, before, "nothing to do"))
        total_before += before
        total_after += before
        continue

    instancer.instantiateVariableFont(font, spec, inplace=True)
    font.flavor = "woff2"

    tmp = path + ".tmp"
    font.save(tmp)
    after = os.path.getsize(tmp)

    # Instancing does not always shrink a file - a couple of these families are already
    # packed in a way that re-compresses larger. Never ship a bigger file for no reason;
    # leave those alone.
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
    rows.append((name, before, after, ", ".join(notes)))

w = max(len(r[0]) for r in rows)
for name, before, after, note in rows:
    pct = f"-{round((1 - after / before) * 100)}%" if after < before else ""
    print(f"{name.ljust(w)}  {before/1024:7.1f} KB -> {after/1024:7.1f} KB  {pct:>5}  {note}")

print(
    f"\ntotal {total_before/1024:.1f} KB -> {total_after/1024:.1f} KB "
    f"({(total_before - total_after)/1024:.1f} KB saved)"
)
print("(report only - pass --write to apply)" if not write else "(files rewritten)")
