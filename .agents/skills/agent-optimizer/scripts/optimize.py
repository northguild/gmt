# /// script
# requires-python = ">=3.14,<3.15"
# dependencies = ["pyyaml"]
# ///
"""
Audit top-level agent config files (AGENTS.md, CLAUDE.md, ...) and their referenced context/
directory for token waste and progressive-disclosure violations.

Advisory only: reads files and prints a JSON report. Never writes or edits files.

Usage:
    uv run optimize.py <repo_root>

Checks:
- Entry file size against a budget (mirrors skill-optimizer's approach).
- Entry file "## " sections too large to stay inline (extraction candidates).
- Every file under context/ (or the configured context dir) is linked from at least one
  entry file, and every link in an entry file resolves to a real file (orphans in both
  directions).
- Each context file's own size against a budget.
- Near-duplicate context files (high content-similarity — candidates to merge).

Budgets and thresholds are documented in references/rules.md and kept here as constants.
"""

import argparse
import json
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path

# --- Budgets / thresholds (mirror references/rules.md) ---
ENTRY_SIZE_BUDGET = 4000       # total chars in an entry file before a warning
SECTION_EXTRACT_CHARS = 600    # a ## section body longer than this is an extraction candidate
CONTEXT_FILE_BUDGET = 15000    # total chars in a single context/*.md file before a warning
CONTEXT_SIMILARITY = 0.80      # pairwise ratio >= this => "near-duplicate context files"

ENTRY_FILE_NAMES = ("AGENTS.md", "CLAUDE.md")
CONTEXT_DIR_NAME = "context"

MD_LINK_RE = re.compile(r"\[[^\]]*\]\(\.?/?([^)\s]+\.md)[^)]*\)")


def find_entry_files(root: Path) -> list[Path]:
    return sorted(p for name in ENTRY_FILE_NAMES if (p := root / name).exists())


def linked_context_files(entry_content: str, root: Path) -> set[Path]:
    linked: set[Path] = set()
    for m in MD_LINK_RE.finditer(entry_content):
        target = (root / m.group(1)).resolve()
        linked.add(target)
    return linked


def audit_entry_file(entry_path: Path, root: Path) -> dict[str, object]:
    content = entry_path.read_text()
    chars = len(content)
    warnings: list[str] = []

    over_budget = chars > ENTRY_SIZE_BUDGET
    if over_budget:
        warnings.append(
            f"{entry_path.name} is {chars} chars (budget {ENTRY_SIZE_BUDGET}); "
            f"move detail into {CONTEXT_DIR_NAME}/"
        )

    section_candidates: list[dict[str, object]] = []
    for sm in re.finditer(r"^##\s+(.+?)\s*$\n(.*?)(?=^##\s|\Z)", content, re.MULTILINE | re.DOTALL):
        title, body = sm.group(1).strip(), sm.group(2)
        if len(body) > SECTION_EXTRACT_CHARS:
            slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
            section_candidates.append({
                "section": title,
                "chars": len(body),
                "suggest": f"{CONTEXT_DIR_NAME}/{slug}.md",
            })

    broken_links: list[str] = []
    for m in MD_LINK_RE.finditer(content):
        raw = m.group(1)
        target = (root / raw).resolve()
        if not target.exists():
            broken_links.append(raw)
    if broken_links:
        warnings.append(f"Broken links to nonexistent files: {', '.join(sorted(set(broken_links)))}")

    return {
        "file": str(entry_path),
        "chars": chars,
        "over_budget": over_budget,
        "section_candidates": section_candidates,
        "warnings": warnings,
    }


def audit_context_dir(root: Path, entry_files: list[Path]) -> dict[str, object]:
    context_dir = root / CONTEXT_DIR_NAME
    if not context_dir.is_dir():
        return {"dir": str(context_dir), "exists": False, "files": [], "orphans": [], "near_duplicates": []}

    all_linked: set[Path] = set()
    entry_contents: dict[Path, str] = {}
    for entry in entry_files:
        text = entry.read_text()
        entry_contents[entry] = text
        all_linked |= linked_context_files(text, root)

    files: list[dict[str, object]] = []
    orphans: list[str] = []
    contents: dict[Path, str] = {}

    for md in sorted(context_dir.glob("*.md")):
        text = md.read_text()
        contents[md] = text
        chars = len(text)
        over_budget = chars > CONTEXT_FILE_BUDGET
        linked_from = [e.name for e in entry_files if md.resolve() in linked_context_files(entry_contents[e], root)]
        if not linked_from:
            orphans.append(str(md))
        files.append({
            "file": str(md),
            "chars": chars,
            "over_budget": over_budget,
            "linked_from": linked_from,
            "warnings": (
                [f"{chars} chars (budget {CONTEXT_FILE_BUDGET}); split into smaller scoped files"]
                if over_budget else []
            ),
        })

    near_duplicates: list[dict[str, object]] = []
    paths = list(contents.keys())
    for i in range(len(paths)):
        for j in range(i + 1, len(paths)):
            a, b = contents[paths[i]], contents[paths[j]]
            ratio = SequenceMatcher(None, a, b).ratio()
            if ratio >= CONTEXT_SIMILARITY:
                near_duplicates.append({
                    "a": str(paths[i]),
                    "b": str(paths[j]),
                    "ratio": round(ratio, 2),
                })

    return {
        "dir": str(context_dir),
        "exists": True,
        "files": files,
        "orphans": orphans,
        "near_duplicates": near_duplicates,
    }


def main() -> None:
    p = argparse.ArgumentParser(description="Audit AGENTS.md/CLAUDE.md and context/ for token waste and disclosure issues.")
    p.add_argument("path", help="repo root containing AGENTS.md/CLAUDE.md and context/")
    args = p.parse_args(sys.argv[1:])

    root = Path(args.path).resolve()
    if not root.is_dir():
        print(json.dumps({"error": f"Not a directory: {root}"}))
        sys.exit(1)

    entry_files = find_entry_files(root)
    if not entry_files:
        print(json.dumps({"error": f"No entry file found ({', '.join(ENTRY_FILE_NAMES)}) under {root}"}))
        sys.exit(1)

    out = {
        "entry_files": [audit_entry_file(e, root) for e in entry_files],
        "context": audit_context_dir(root, entry_files),
    }
    print(json.dumps(out, indent=2))
    sys.exit(0)


if __name__ == "__main__":
    main()
