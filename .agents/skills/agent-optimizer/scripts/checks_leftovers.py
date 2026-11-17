"""Leftover check: planning files that outlived their story.

A story's issue file, spec folder and research exist only while the story is open; the
finalizer deletes them at close (`.agents/finalizer.md` step 10). This reports any that a
`Done` story still has, so an unfolded spec cannot stay behind.
"""

from __future__ import annotations

import re
from pathlib import Path

TRACKERS = ("context/domination/tracker.md", "context/canary/tracker.md", "context/dox/tracker.md")
# Where each side keeps its planning files. Issue and spec entries are named by story ID;
# research files and Dox spec folders start with the lower-case ID and a hyphen.
PLACES = (
    "context/domination/issues", "context/domination/specs", "context/domination/research",
    "context/canary/issues", "context/canary/specs", "context/dox/specs",
)
STORY_ID = re.compile(r"\b[A-Z]+-[A-Z]?\d+[a-z]?\b")


def _cells(line: str) -> list[str]:
    return [c.strip() for c in line.strip().strip("|").split("|")]


def done_ids(root: Path) -> set[str]:
    """Every story ID whose tracker row is marked Done, in any tracker."""
    done: set[str] = set()
    for rel in TRACKERS:
        path = root / rel
        if not path.is_file():
            continue
        header: list[str] | None = None
        for line in path.read_text().splitlines():
            if not line.startswith("|"):
                header = None
                continue
            cells = _cells(line)
            if header is None:
                header = cells
                continue
            if "Story" not in header or "Status" not in header or set(line) <= set("|- "):
                continue
            if cells[header.index("Status")].startswith("Done"):
                done.update(STORY_ID.findall(cells[header.index("Story")]))
    return done


def _owner(name: str, done: set[str]) -> str | None:
    stem = name[:-3] if name.endswith(".md") else name
    if stem in done:
        return stem
    lower = name.lower()
    return next((d for d in done if lower.startswith(d.lower() + "-")), None)


def find_leftovers(root: Path) -> list[dict[str, str]]:
    done = done_ids(root)
    out: list[dict[str, str]] = []
    for rel in PLACES:
        place = root / rel
        if not place.is_dir():
            continue
        for entry in sorted(place.iterdir()):
            story = _owner(entry.name, done)
            if story:
                out.append({"file": entry.relative_to(root).as_posix(), "story": story})
    return sorted(out, key=lambda item: item["file"])
