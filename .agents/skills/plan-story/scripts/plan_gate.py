#!/usr/bin/env python3
# /// script
# requires-python = ">=3.12"
# ///
"""Plan gate: a story may be implemented only once /plan-story has approved its spec.

Usage:
    python3 .agents/skills/plan-story/scripts/plan_gate.py [STORY-ID] [--root DIR]

With no id, the story comes from the branch name (feature/197-mar-16-... gives MAR-16).
Prints PASS or FAIL lines and exits 0 when the plan is complete, 1 otherwise.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

INDEX_LINE_BUDGET = 150
SLICE_LINE_BUDGET = 200
LIB_SPECS = "context/domination/specs"
DOX_SPECS = "context/dox/specs"

# <type>/<issue>-<story id>-...; a story id is letters, a dash, then a token holding a digit.
BRANCH_RE = re.compile(r"^[a-z]+/\d+-([a-z]+-[a-z]*\d[a-z0-9]*)(?:-|$)")
LINK_RE = re.compile(r"\]\(([^)#\s]+\.md)(?:#[^)]*)?\)")
FIELD_RE = re.compile(r"^([a-z_]+):\s*(.*?)\s*$")


def story_from_branch(branch: str) -> str | None:
    m = BRANCH_RE.match(branch.strip())
    return m.group(1).upper() if m else None


def frontmatter(text: str) -> dict[str, str]:
    if not text.startswith("---\n"):
        return {}
    end = text.find("\n---", 4)
    fields: dict[str, str] = {}
    for line in text[4:end if end != -1 else 4].splitlines():
        m = FIELD_RE.match(line)
        if m:
            fields[m.group(1)] = m.group(2)
    return fields


def line_count(path: Path) -> int:
    return len(path.read_text(errors="replace").splitlines())


def check_spec(root: Path, index: Path, label: str) -> tuple[list[str], dict[str, str]]:
    """Check one spec folder's index and slices; return problems and the index frontmatter."""
    rel = index.relative_to(root)
    if not index.is_file():
        return [f"{label}: no spec at {rel}; run /plan-story first"], {}
    text = index.read_text(errors="replace")
    fields = frontmatter(text)
    found: list[str] = []
    if fields.get("status") != "approved":
        found.append(f"{label}: {rel} is not approved (status: {fields.get('status', 'missing')})")
    lines = line_count(index)
    if lines > INDEX_LINE_BUDGET:
        found.append(f"{label}: {rel} is {lines} lines (budget {INDEX_LINE_BUDGET})")
    slices = sorted(set(LINK_RE.findall(text)))
    local = [s for s in slices if not s.startswith(("/", "..", "http"))]
    if not local:
        found.append(f"{label}: {rel} links no slice files")
    for name in local:
        path = index.parent / name
        if not path.is_file():
            found.append(f"{label}: slice {name} is missing")
        elif (n := line_count(path)) > SLICE_LINE_BUDGET:
            found.append(f"{label}: slice {name} is {n} lines (budget {SLICE_LINE_BUDGET})")
    return found, fields


def check(root: Path, story: str) -> list[str]:
    """Return every reason the story's plan is incomplete; empty means it may be implemented."""
    if story.startswith("DOX-"):
        found, _ = check_spec(root, root / DOX_SPECS / story.lower() / "index.md", story)
        return found
    found, fields = check_spec(root, root / LIB_SPECS / story / "index.md", story)
    if not fields:
        return found
    dox = fields.get("dox", "")
    if not dox:
        found.append(f"{story}: index has no dox decision (dox: none, or the Dox spec index path)")
    elif dox != "none":
        dox_found, _ = check_spec(root, root / dox, f"{story} Dox")
        found.extend(dox_found)
    return found


def current_branch(root: Path) -> str:
    out = subprocess.run(
        ["git", "-C", str(root), "branch", "--show-current"], capture_output=True, text=True
    )
    return out.stdout.strip()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("story", nargs="?", help="story id such as MAR-16 (default: from branch)")
    parser.add_argument("--root", default=".", help="repo root (default: current dir)")
    args = parser.parse_args(argv)
    root = Path(args.root).resolve()
    story = args.story.upper() if args.story else story_from_branch(current_branch(root))
    if not story:
        print("FAIL: no story id given and none in the branch name; pass one, e.g. MAR-16")
        return 1
    found = check(root, story)
    for problem in found:
        print(f"FAIL: {problem}")
    if not found:
        print(f"PASS: {story} is planned and approved")
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
