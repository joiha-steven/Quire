"""Rewrite the frozen tree's `@/lib/<name>` import alias to Quire 2.0's module paths.

The pure modules were copied across unchanged. Their own imports are all absolute `@/`
specifiers that still resolve (`@/types`, `@/locales/*` land where the alias points), so
the only thing that breaks is `@/lib/<name>`: 2.0 has no `lib/` directory, it has modules.

Run from `v2/`. Prints the edit count, which is the honest measure of what the port cost.
Anything still pointing at a module that has not been moved yet is reported, not guessed.
"""

import os
import re

SRC = "src"


def module_index() -> dict[str, str]:
    """Map a bare module name to its path under src/, e.g. 'footnotes' -> 'render/footnotes'."""
    index: dict[str, str] = {}
    for root, _, files in os.walk(SRC):
        for name in files:
            if not name.endswith(".ts") or name.endswith((".test.ts", ".d.ts")):
                continue
            rel = os.path.relpath(os.path.join(root, name), SRC).replace(os.sep, "/")
            index[rel[:-3].split("/")[-1]] = rel[:-3]
    return index


def main() -> None:
    index = module_index()
    edits = 0
    touched: set[str] = set()
    unresolved: set[str] = set()

    def replace(match: re.Match[str]) -> str:
        nonlocal edits
        name = match.group(1)
        target = index.get(name)
        if target is None:
            unresolved.add(name)
            return match.group(0)
        edits += 1
        return f"@/{target}"

    for root, _, files in os.walk(SRC):
        for name in files:
            if not name.endswith(".ts"):
                continue
            path = os.path.join(root, name)
            before = open(path, encoding="utf-8").read()
            after = re.sub(r"@/lib/([A-Za-z0-9_-]+)", replace, before)
            if after != before:
                open(path, "w", encoding="utf-8").write(after)
                touched.add(path.replace(os.sep, "/"))

    print(f"rewrote {edits} import specifier(s) across {len(touched)} file(s)")
    for path in sorted(touched):
        print(f"  {path}")
    if unresolved:
        print("\nstill pointing at modules not yet moved:")
        for name in sorted(unresolved):
            print(f"  @/lib/{name}")


if __name__ == "__main__":
    main()
