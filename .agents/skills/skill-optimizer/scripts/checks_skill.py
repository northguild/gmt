"""Line-budget and .claude/skills symlink checks for skill-optimizer (see references/rules.md)."""

from __future__ import annotations

import json
import os
from pathlib import Path

# --- Budgets (mirror references/rules.md) ---
SKILL_MD_LINE_BUDGET = 200   # SKILL.md hard limit
SKILL_MD_LINE_SOFT = 150     # SKILL.md softer note above this
REFERENCE_LINE_BUDGET = 200  # each file under references/


def line_count(text: str) -> int:
    return len(text.splitlines())


def check_line_budgets(skill_path: Path, skill_lines: int) -> tuple[list[str], list[str]]:
    """Return (warnings, notes) for SKILL.md and each references/ file."""
    warnings: list[str] = []
    notes: list[str] = []
    if skill_lines > SKILL_MD_LINE_BUDGET:
        warnings.append(
            f"SKILL.md is {skill_lines} lines (budget {SKILL_MD_LINE_BUDGET}); move detail to references/"
        )
    elif skill_lines >= SKILL_MD_LINE_SOFT:
        notes.append(f"SKILL.md is {skill_lines} lines; aim for under {SKILL_MD_LINE_SOFT}")
    refs = skill_path / "references"
    if refs.is_dir():
        for md in sorted(refs.rglob("*.md")):
            n = line_count(md.read_text(errors="replace"))
            if n > REFERENCE_LINE_BUDGET:
                rel = md.relative_to(skill_path).as_posix()
                warnings.append(f"{rel} is {n} lines (budget {REFERENCE_LINE_BUDGET}); split it")
    return warnings, notes


def repo_root(path: Path) -> Path | None:
    for parent in [path, *path.parents]:
        if (parent / ".agents").is_dir():
            return parent
    return None


def check_claude_link(skill_path: Path) -> str | None:
    """Warn if a skill under <repo>/.agents/skills has no <repo>/.claude/skills/<name> entry."""
    skill = Path(os.path.abspath(skill_path))
    root = repo_root(skill.parent)
    if root is None or skill.parent != root / ".agents" / "skills":
        return None
    claude = root / ".claude" / "skills"
    if not claude.is_dir() or os.path.lexists(claude / skill.name):
        return None
    return f"No .claude/skills/{skill.name} symlink (Claude Code will not load this skill)"


def vendored_source(skill_path: Path) -> str | None:
    """Return the upstream source when skills-lock.json pins this skill, else None.

    A vendored skill is overwritten by `npx skills update`, so its findings are fixed upstream.
    """
    root = repo_root(skill_path)
    lock = root / "skills-lock.json" if root else None
    if lock is None or not lock.is_file():
        return None
    try:
        entry = json.loads(lock.read_text()).get("skills", {}).get(skill_path.name)
    except ValueError:
        return None
    return str(entry.get("source", "upstream")) if isinstance(entry, dict) else None
