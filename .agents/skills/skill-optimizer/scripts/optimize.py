# /// script
# requires-python = ">=3.14,<3.15"
# dependencies = ["pyyaml"]
# ///
"""
Audit agent skills for token waste, progressive-disclosure violations, and common
triggering/loading/runtime problems.

Advisory only: reads skill directories and prints a JSON report. Never writes or edits files.

Usage:
    uv run optimize.py <skill_directory>
    uv run optimize.py --all <skills_root>      # scan <root>/<skill>/SKILL.md

Single-dir mode returns one object. --all mode returns a list of per-skill objects plus a
top-level "inventory" object with cross-skill findings (duplicate names, similar descriptions).

Budgets and thresholds are documented in references/rules.md and kept here as constants.
"""

import argparse
import json
import os
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path
from typing import cast

import yaml

# --- Budgets / thresholds (mirror references/rules.md) ---
SIZE_BUDGET = 20000          # total SKILL.md chars before a warning (matches quick_validate.py)
SECTION_EXTRACT_CHARS = 600  # a ## section body longer than this is an extraction candidate
TRIGGER_PHRASES = (          # description should contain at least one concrete trigger cue
    "use when", "when the user", "when you", "validate", "optimize", "check", "audit",
    "lint", "verify", "trim", "reduce", "enforce",
)
DESCRIPTION_SIMILARITY = 0.80  # pairwise ratio >= this => "similar descriptions" warning

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
            loaded = yaml.safe_load(m.group(1))
            if isinstance(loaded, dict):
                fm = loaded
            elif loaded is not None:
                warnings.append("Frontmatter must be a YAML mapping")
        except yaml.YAMLError as exc:
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
    for ref in sorted(set(LOCAL_REF_RE.findall(content))):
        target = skill_path / ref
        if not target.exists():
            warnings.append(f"Referenced file not found: {ref}")

    # Runtime readiness
    scripts_dir = skill_path / "scripts"
    if scripts_dir.is_dir():
        for py in sorted(scripts_dir.glob("*.py")):
            if not os.access(py, os.X_OK):
                warnings.append(f"Script not executable: {py.name} (run chmod +x)")
    if BACKSLASH_PATH_RE.search(content):
        warnings.append("Backslash path separator found; use forward slashes everywhere")

    over_budget = chars > SIZE_BUDGET
    if over_budget:
        warnings.append(f"SKILL.md is {chars} chars (budget {SIZE_BUDGET}); move detail to references/")

    return {
        "dir": str(skill_path),
        "name": name if isinstance(name, str) else None,
        "description": desc if isinstance(desc, str) else "",
        "chars": chars,
        "over_budget": over_budget,
        "section_candidates": section_candidates,
        "warnings": warnings,
    }, None


def find_skills(root: Path) -> list[Path]:
    # Skills are <root>/<skill-name>/SKILL.md (one level deep).
    return sorted({p.parent for p in root.glob("*/SKILL.md")})


def inventory_findings(skills: list[dict[str, object]]) -> dict[str, list[dict[str, object]]]:
    named: list[dict[str, object]] = [s for s in skills if s.get("name")]
    duplicates: list[dict[str, object]] = []
    seen: dict[str, list[str]] = {}
    for s in named:
        name = cast(str, s["name"])
        dir_ = cast(str, s["dir"])
        seen.setdefault(name, []).append(dir_)
    for n, dirs in seen.items():
        if len(dirs) > 1:
            duplicates.append({"name": n, "dirs": dirs})

    similar: list[dict[str, object]] = []
    descs: list[tuple[str, str]] = [
        (cast(str, s["name"]), cast(str, s.get("description", "")) or "") for s in named
    ]
    for i in range(len(descs)):
        for j in range(i + 1, len(descs)):
            a = descs[i][1].lower()
            b = descs[j][1].lower()
            if a and b and SequenceMatcher(None, a, b).ratio() >= DESCRIPTION_SIMILARITY:
                similar.append({
                    "a": descs[i][0],
                    "b": descs[j][0],
                    "ratio": round(SequenceMatcher(None, a, b).ratio(), 2),
                })

    return {"duplicate_names": duplicates, "similar_descriptions": similar}


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