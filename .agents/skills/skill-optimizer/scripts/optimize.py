# /// script
# requires-python = ">=3.9"
# dependencies = []
# ///
"""
Audit agent skills for token waste, progressive-disclosure violations, and common
triggering/loading/runtime problems.

Advisory only: reads skill directories and prints a JSON report. Never writes or edits files.

Usage:
    python3 optimize.py --all <skills_root>      # scan <root>/<skill>/SKILL.md
    python3 optimize.py <skill_directory>
(`uv run` also works. PyYAML is optional; fm_parse.py falls back to a built-in parser.)

Single-dir mode returns one object. --all mode returns a list of per-skill objects plus a
top-level "inventory" object with cross-skill findings (duplicate names, similar descriptions).

Budgets and thresholds are documented in references/rules.md and kept here as constants.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import checks_skill  # noqa: E402
from checks_inventory import DESCRIPTION_SIMILARITY, inventory_findings  # noqa: E402,F401
import fm_parse  # noqa: E402

# --- Budgets / thresholds (mirror references/rules.md) ---
SIZE_BUDGET = 20000          # total SKILL.md chars before a warning (matches quick_validate.py)
SECTION_EXTRACT_CHARS = 600  # a ## section body longer than this is an extraction candidate
TRIGGER_PHRASES = (          # description should contain at least one concrete trigger cue
    "use when", "when the user", "when you", "validate", "optimize", "check", "audit",
    "lint", "verify", "trim", "reduce", "enforce",
)

LOCAL_REF_RE = re.compile(
    r"(?<![A-Za-z0-9_./-])"
    r"((?:references|scripts|assets)/[A-Za-z0-9][A-Za-z0-9._/-]*\.[A-Za-z0-9]+)"
    r"(?![A-Za-z0-9_./-])"
)
BACKSLASH_PATH_RE = re.compile(r"[A-Za-z0-9_./-]\\(?:[A-Za-z0-9_./-]|$)")
FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---", re.DOTALL)


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Audit agent skills for token waste and disclosure issues.")
    p.add_argument("path", help="skill directory, or skills root when --all is set")
    p.add_argument("--all", action="store_true", help="treat path as a skills root and scan */*/SKILL.md")
    return p.parse_args(argv)


def load_skill(skill_path: Path) -> tuple[dict[str, object], str | None]:
    """Return (result_dict, error). error set only on a fatal structural problem."""
    warnings: list[str] = []
    skill_md = skill_path / "SKILL.md"

    if not skill_md.exists():
        return {"dir": str(skill_path), "error": "SKILL.md not found"}, None
    try:
        content = skill_md.read_text()
    except OSError as exc:
        return {"dir": str(skill_path), "error": f"Cannot read SKILL.md: {exc}"}, None
    chars = len(content)

    # Front matter
    fm: dict[str, object] = {}
    m = FRONTMATTER_RE.match(content)
    if not content.startswith("---") or not m:
        warnings.append("No/invalid YAML frontmatter (must start with --- and close with ---)")
    else:
        try:
            loaded = fm_parse.parse_frontmatter(m.group(1))
            if isinstance(loaded, dict):
                fm = loaded
            elif loaded is not None:
                warnings.append("Frontmatter must be a YAML mapping")
        except ValueError as exc:
            warnings.append(f"Invalid YAML in frontmatter: {exc}")

    name = fm.get("name")
    desc = fm.get("description", "")
    if not isinstance(name, str) or not name.strip():
        warnings.append("Missing/empty required field: name")
    elif name.strip() != skill_path.name:
        warnings.append(f"name '{name}' does not match directory name '{skill_path.name}'")
    if not isinstance(desc, str) or not desc.strip():
        warnings.append("Missing/empty required field: description")

    # Trigger phrases
    desc_l = (desc if isinstance(desc, str) else "").lower()
    if desc_l and not any(phrase in desc_l for phrase in TRIGGER_PHRASES):
        warnings.append(
            "description has no concrete trigger phrase (add 'use when …' / 'validate …' etc.)"
        )

    # Progressive disclosure: long ## sections
    section_candidates: list[dict[str, object]] = []
    for sm in re.finditer(r"^##\s+(.+?)\s*$\n(.*?)(?=^##\s|\Z)", content, re.MULTILINE | re.DOTALL):
        title, body = sm.group(1).strip(), sm.group(2)
        if len(body) > SECTION_EXTRACT_CHARS:
            slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
            section_candidates.append({
                "section": title,
                "chars": len(body),
                "suggest": f"references/{slug}.md",
            })

    # Local file references exist
    # Resolve against the skill dir first, then the repo root (the dir holding .agents/).
    roots = [skill_path] + [p for p in skill_path.resolve().parents if (p / ".agents").is_dir()][:1]
    for ref in sorted(set(LOCAL_REF_RE.findall(content))):
        if not any((base / ref).exists() for base in roots):
            warnings.append(f"Referenced file not found: {ref}")

    # Runtime readiness
    scripts_dir = skill_path / "scripts"
    if scripts_dir.is_dir():
        for py in sorted(scripts_dir.glob("*.py")):
            if not os.access(py, os.X_OK):
                warnings.append(f"Script not executable: {py.name} (run chmod +x)")
    if BACKSLASH_PATH_RE.search(content):
        warnings.append("Backslash path separator found; use forward slashes everywhere")

    lines = checks_skill.line_count(content)
    line_warnings, notes = checks_skill.check_line_budgets(skill_path, lines)
    warnings.extend(line_warnings)
    # A vendored skill (pinned in skills-lock.json) is fixed upstream: its content findings become notes.
    vendored = checks_skill.vendored_source(skill_path)
    if vendored:
        notes.extend(f"vendored ({vendored}), fix upstream: {w}" for w in warnings)
        warnings = []
    link_warning = checks_skill.check_claude_link(skill_path)
    if link_warning:
        warnings.append(link_warning)

    over_budget = chars > SIZE_BUDGET
    if over_budget:
        warnings.append(f"SKILL.md is {chars} chars (budget {SIZE_BUDGET}); move detail to references/")

    return {
        "dir": str(skill_path),
        "name": name if isinstance(name, str) else None,
        "description": desc if isinstance(desc, str) else "",
        "chars": chars,
        "over_budget": over_budget,
        "lines": lines,
        "over_line_budget": lines > checks_skill.SKILL_MD_LINE_BUDGET,
        "section_candidates": section_candidates,
        "notes": notes,
        "warnings": warnings,
        "vendored": vendored,
    }, None


def find_skills(root: Path) -> list[Path]:
    # Skills are <root>/<skill-name>/SKILL.md (one level deep).
    return sorted({p.parent for p in root.glob("*/SKILL.md")})


def main() -> None:
    args = parse_args(sys.argv[1:])
    root = Path(args.path).resolve()

    if args.all:
        if not root.is_dir():
            print(json.dumps({"error": f"Not a directory: {root}"}))
            sys.exit(1)
        skills = [load_skill(d)[0] for d in find_skills(root)]
        out = {"skills": skills, "inventory": inventory_findings(skills)}
        print(json.dumps(out, indent=2))
        sys.exit(0)

    if not root.is_dir():
        print(json.dumps({"error": f"Not a directory: {root}"}))
        sys.exit(1)
    result, err = load_skill(root)
    print(json.dumps(result, indent=2))
    sys.exit(1 if err else 0)


if __name__ == "__main__":
    main()