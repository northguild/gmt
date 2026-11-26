# /// script
# requires-python = ">=3.9"
# dependencies = ["pytest"]
# ///
"""Tests for agent-optimizer: planning files left behind by a Done story.

Run with:
    python3 -m pytest -q .agents/skills
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import checks_leftovers  # noqa: E402

DOMINATION = """# Tracker

| #   | Story    | Realm | Deliverable | Blocked by | Issue | Release | Status      |
| --- | -------- | ----- | ----------- | ---------- | ----- | ------- | ----------- |
| 1   | CORE-1   | Core  | One         | —          | #1    | 1.0.0   | Done        |
| 2   | CORE-10  | Core  | Ten         | —          | #2    | —       | In progress |
| 3   | INT-12   | Int   | Twelve      | —          | #3    | —       | Done        |
| 4   | CORE-90  | Core  | Ninety      | —          | #4    | —       | Waiting     |
"""

DOX = """| Order | Story                     | Blocked by | GitHub Issue | Status |
| ----- | ------------------------- | ---------- | ------------ | ------ |
| 1     | DOX-A3 (DOX-A3a, DOX-A3b) | —          | #132         | Done¹  |
| 2     | DOX-G2                    | —          | #447         | Todo   |
"""

CANARY = """| Order | Story  | Title | Blocked by | GitHub Issue | Status |
| ----- | ------ | ----- | ---------- | ------------ | ------ |
| 1     | CNRY-1 | One   | —          | #483         | Done   |
"""


def tree(root: Path, paths: list[str]) -> Path:
    files = {
        "context/domination/tracker.md": DOMINATION,
        "context/dox/tracker.md": DOX,
        "context/canary/tracker.md": CANARY,
    }
    for rel, text in files.items():
        (root / rel).parent.mkdir(parents=True, exist_ok=True)
        (root / rel).write_text(text)
    for rel in paths:
        p = root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        if rel.endswith("/"):
            p.mkdir(exist_ok=True)
        else:
            p.write_text("x")
    return root


def found(root: Path) -> list[str]:
    return [item["file"] for item in checks_leftovers.find_leftovers(root)]


def test_done_story_files_are_reported(tmp_path: Path) -> None:
    root = tree(tmp_path, [
        "context/domination/issues/CORE-1.md",
        "context/domination/issues/INT-12/notes.md",
        "context/domination/specs/CORE-1/index.md",
        "context/domination/research/int-12-demurrage.md",
        "context/dox/specs/dox-a3b-widget/index.md",
        "context/canary/issues/CNRY-1.md",
        "context/canary/specs/CNRY-1/index.md",
    ])
    assert found(root) == [
        "context/canary/issues/CNRY-1.md",
        "context/canary/specs/CNRY-1",
        "context/domination/issues/CORE-1.md",
        "context/domination/issues/INT-12",
        "context/domination/research/int-12-demurrage.md",
        "context/domination/specs/CORE-1",
        "context/dox/specs/dox-a3b-widget",
    ]


def test_open_stories_and_indexes_are_kept(tmp_path: Path) -> None:
    root = tree(tmp_path, [
        "context/domination/issues/index.md",
        "context/domination/issues/CORE-10.md",
        "context/domination/issues/CORE-90.md",
        "context/domination/specs/index.md",
        "context/domination/specs/CORE-10/index.md",
        "context/domination/research/core-10-notes.md",
        "context/domination/research/index.md",
        "context/dox/specs/dox-g2/index.md",
    ])
    assert found(root) == []


def test_an_id_prefix_is_not_a_match(tmp_path: Path) -> None:
    # CORE-1 is Done, CORE-10 is not: a CORE-10 folder must not be read as CORE-1's.
    root = tree(tmp_path, ["context/domination/specs/CORE-10/index.md",
                           "context/domination/research/core-10-x.md"])
    assert found(root) == []


def test_missing_trackers_report_nothing(tmp_path: Path) -> None:
    (tmp_path / "context").mkdir()
    assert checks_leftovers.find_leftovers(tmp_path) == []
