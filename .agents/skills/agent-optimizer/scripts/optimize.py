#!/usr/bin/env python3
"""
Audit top-level agent config files (AGENTS.md, CLAUDE.md, ...), every file under context/
(recursively), the `.agents/*.md` personas, and the `.claude` symlink sync, for token waste
and progressive-disclosure violations.

Advisory only: reads files and prints a JSON report. Never writes or edits files.

Usage:
    python3 optimize.py <repo_root>        (`uv run` also works; stdlib only)

Budgets and thresholds are documented in references/rules.md and kept here as constants.
Persona constants (PERSONA_LINE_BUDGET, OPUS_ALLOWED) live in checks_personas.py.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import checks_links  # noqa: E402
import checks_personas  # noqa: E402
import checks_sync  # noqa: E402
from checks_personas import OPUS_ALLOWED, PERSONA_LINE_BUDGET  # noqa: E402,F401

# --- Budgets / thresholds (mirror references/rules.md) ---
ENTRY_SIZE_BUDGET = 4000       # total chars in an entry file before a warning
ENTRY_LINE_BUDGET = 150        # lines in an entry file before a warning
SECTION_EXTRACT_CHARS = 600    # a ## section body longer than this is an extraction candidate
CONTEXT_FILE_BUDGET = 15000    # total chars in a single context file before a warning
CONTEXT_LINE_BUDGET = 200      # lines in a single context file before a warning
CONTEXT_SIMILARITY = 0.80      # pairwise ratio >= this => "near-duplicate context files"

ENTRY_FILE_NAMES = ("AGENTS.md", "CLAUDE.md")
CONTEXT_DIR_NAME = "context"
ARCHIVE_DIR_NAME = "archive"   # context/archive/** is excluded from orphan and budget checks


def find_entry_files(root: Path) -> list[Path]:
    return sorted(p for name in ENTRY_FILE_NAMES if (p := root / name).exists())


def audit_entry_file(entry_path: Path, root: Path) -> dict[str, object]:
    content = entry_path.read_text()
    chars, lines = len(content), len(content.splitlines())
    warnings: list[str] = []

    over_budget = chars > ENTRY_SIZE_BUDGET
    if over_budget:
        warnings.append(
            f"{entry_path.name} is {chars} chars (budget {ENTRY_SIZE_BUDGET}); "
            f"move detail into {CONTEXT_DIR_NAME}/"
        )
    over_lines = lines > ENTRY_LINE_BUDGET
    if over_lines:
        warnings.append(f"{entry_path.name} is {lines} lines (budget {ENTRY_LINE_BUDGET}); move detail into {CONTEXT_DIR_NAME}/")

    section_candidates: list[dict[str, object]] = []
    for sm in re.finditer(r"^##\s+(.+?)\s*$\n(.*?)(?=^##\s|\Z)", content, re.MULTILINE | re.DOTALL):
        title, body = sm.group(1).strip(), sm.group(2)
        if len(body) > SECTION_EXTRACT_CHARS:
            slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
            section_candidates.append({
                "section": title, "chars": len(body), "suggest": f"{CONTEXT_DIR_NAME}/{slug}.md",
            })

    broken = sorted({b["link"] for b in checks_links.broken_links([entry_path])})
    if broken:
        warnings.append(f"Broken links to nonexistent files: {', '.join(broken)}")

    return {
        "file": str(entry_path), "chars": chars, "lines": lines,
        "over_budget": over_budget, "over_line_budget": over_lines,
        "section_candidates": section_candidates, "warnings": warnings,
    }


def context_files(context_dir: Path) -> list[Path]:
    archive = context_dir / ARCHIVE_DIR_NAME
    return sorted(p for p in context_dir.rglob("*.md") if archive not in p.parents)


# Similarity is measured over non-blank lines, so large files stay fast.
def near_duplicates(contents: dict[Path, str]) -> list[dict[str, object]]:
    found: list[dict[str, object]] = []
    paths = list(contents)
    lines = {p: [x.strip() for x in contents[p].splitlines() if x.strip()] for p in paths}
    for i, a in enumerate(paths):
        for b in paths[i + 1:]:
            sm = SequenceMatcher(None, lines[a], lines[b], autojunk=False)
            if sm.real_quick_ratio() < CONTEXT_SIMILARITY or sm.quick_ratio() < CONTEXT_SIMILARITY:
                continue
            ratio = sm.ratio()
            if ratio >= CONTEXT_SIMILARITY:
                found.append({"a": str(a), "b": str(b), "ratio": round(ratio, 2)})
    return found


def audit_context_dir(root: Path, entry_files: list[Path]) -> dict[str, object]:
    context_dir = root / CONTEXT_DIR_NAME
    if not context_dir.is_dir():
        return {"dir": str(context_dir), "exists": False, "files": [], "orphans": [],
                "broken_links": [], "near_duplicates": []}

    personas = sorted((root / ".agents").glob("*.md")) if (root / ".agents").is_dir() else []
    files_md = context_files(context_dir)
    reached, linkers = checks_links.reachable([*entry_files, *personas])

    files: list[dict[str, object]] = []
    orphans: list[str] = []
    contents: dict[Path, str] = {}
    for md in files_md:
        text = md.read_text()
        contents[md] = text
        chars, lines = len(text), len(text.splitlines())
        warnings: list[str] = []
        if chars > CONTEXT_FILE_BUDGET:
            warnings.append(f"{chars} chars (budget {CONTEXT_FILE_BUDGET}); split into smaller scoped files")
        if lines > CONTEXT_LINE_BUDGET:
            warnings.append(f"{lines} lines (budget {CONTEXT_LINE_BUDGET}); split into smaller scoped files")
        if md.resolve() not in reached:
            orphans.append(str(md))
        files.append({
            "file": str(md), "chars": chars, "lines": lines,
            "over_budget": chars > CONTEXT_FILE_BUDGET, "over_line_budget": lines > CONTEXT_LINE_BUDGET,
            "linked_from": sorted(p.relative_to(root).as_posix() for p in linkers.get(md.resolve(), ())
                                  if p.is_relative_to(root)),
            "warnings": warnings,
        })

    scanned = [*entry_files, *personas, *files_md]
    return {
        "dir": str(context_dir), "exists": True, "files": files, "orphans": orphans,
        "broken_links": checks_links.broken_links(scanned),
        "near_duplicates": near_duplicates(contents),
    }


def summarize(out: dict[str, object]) -> dict[str, int]:
    ctx, sync = out["context"], out["sync"]
    sym = sum(len(v) for kind in ("agents", "skills") for v in sync[kind].values())
    return {
        "orphans": len(ctx["orphans"]), "broken_links": len(ctx["broken_links"]),
        "near_duplicates": len(ctx["near_duplicates"]),
        "over_budget_files": sum(1 for f in ctx["files"] if f["warnings"])
        + sum(1 for e in out["entry_files"] if e["over_budget"] or e["over_line_budget"]),
        "persona_warnings": sum(len(p["warnings"]) for p in out["personas"]),
        "symlink_problems": sym,
    }


def main() -> None:
    p = argparse.ArgumentParser(description="Audit AGENTS.md/CLAUDE.md, context/ and personas for token waste.")
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

    out: dict[str, object] = {
        "entry_files": [audit_entry_file(e, root) for e in entry_files],
        "context": audit_context_dir(root, entry_files),
        "personas": checks_personas.audit_personas(root),
        "sync": checks_sync.check_symlinks(root),
    }
    out["summary"] = summarize(out)
    print(json.dumps(out, indent=2))
    sys.exit(0)


if __name__ == "__main__":
    main()
