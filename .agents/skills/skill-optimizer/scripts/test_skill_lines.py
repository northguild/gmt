# /// script
# requires-python = ">=3.9"
# dependencies = ["pytest"]
# ///
"""Tests for skill-optimizer: line budgets and .claude symlink sync.

Run with:
    python3 -m pytest -q .agents/skills
"""

from __future__ import annotations

import importlib.util
import json
import os
import stat
import sys
from pathlib import Path

import pytest

_spec = importlib.util.spec_from_file_location(
    "optimize", Path(__file__).parent / "optimize.py"
)
if _spec is None or _spec.loader is None:
    raise ImportError("Could not determine module spec for optimize.py")
optimize = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(optimize)

VALID_FRONTMATTER = "name: my-skill\ndescription: 'Use when you need to validate something.'"


def make_skill(tmp_path: Path, name: str, content: str) -> Path:
    skill_dir = tmp_path / name
    skill_dir.mkdir()
    (skill_dir / "SKILL.md").write_text(content)
    return skill_dir



FM = "---\nname: {n}\ndescription: 'use when yes'\n---\n"


def lines(n: int) -> str:
    return "".join(f"line {i}\n" for i in range(n))


def test_line_count_reported(tmp_path: Path) -> None:
    skill = make_skill(tmp_path, "s", FM.format(n="s") + lines(10))
    result, _ = optimize.load_skill(skill)
    assert result["lines"] == 14
    assert result["over_line_budget"] is False
    assert result["notes"] == []


def test_skill_md_soft_note_above_150(tmp_path: Path) -> None:
    skill = make_skill(tmp_path, "s", FM.format(n="s") + lines(150))
    result, _ = optimize.load_skill(skill)
    assert result["over_line_budget"] is False
    assert any("150" in n for n in result["notes"])
    assert not any("lines" in w for w in result["warnings"])


def test_skill_md_over_200_lines(tmp_path: Path) -> None:
    skill = make_skill(tmp_path, "s", FM.format(n="s") + lines(200))
    result, _ = optimize.load_skill(skill)
    assert result["over_line_budget"] is True
    assert any("SKILL.md" in w and "lines" in w for w in result["warnings"])


def test_reference_file_over_200_lines(tmp_path: Path) -> None:
    skill = make_skill(tmp_path, "s", FM.format(n="s") + "body\n")
    (skill / "references").mkdir()
    (skill / "references" / "big.md").write_text(lines(201))
    (skill / "references" / "ok.md").write_text(lines(200))
    result, _ = optimize.load_skill(skill)
    hits = [w for w in result["warnings"] if "references/" in w and "lines" in w]
    assert len(hits) == 1 and "big.md" in hits[0]


def make_repo(tmp_path: Path, link: bool, claude: bool = True) -> Path:
    skills = tmp_path / ".agents" / "skills"
    skills.mkdir(parents=True)
    skill = make_skill(skills, "foo", FM.format(n="foo") + "body\n")
    if claude:
        (tmp_path / ".claude" / "skills").mkdir(parents=True)
        if link:
            (tmp_path / ".claude" / "skills" / "foo").symlink_to("../../.agents/skills/foo")
    return skill


def test_missing_claude_symlink_flagged(tmp_path: Path) -> None:
    result, _ = optimize.load_skill(make_repo(tmp_path, link=False))
    assert any(".claude/skills/foo" in w for w in result["warnings"])


def test_present_claude_symlink_ok(tmp_path: Path) -> None:
    result, _ = optimize.load_skill(make_repo(tmp_path, link=True))
    assert not any(".claude/skills" in w for w in result["warnings"])


def test_no_claude_skills_dir_no_flag(tmp_path: Path) -> None:
    result, _ = optimize.load_skill(make_repo(tmp_path, link=False, claude=False))
    assert not any(".claude/skills" in w for w in result["warnings"])


def test_other_dir_not_checked(tmp_path: Path) -> None:
    (tmp_path / ".agents").mkdir()
    (tmp_path / ".claude" / "skills").mkdir(parents=True)
    skill = make_skill(tmp_path, "foo", FM.format(n="foo") + "body\n")
    result, _ = optimize.load_skill(skill)
    assert not any(".claude/skills" in w for w in result["warnings"])
