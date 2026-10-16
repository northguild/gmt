# /// script
# requires-python = ">=3.12"
# dependencies = ["pytest"]
# ///
"""Tests for skill-optimizer: load_skill and frontmatter validation.

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


# ---------------------------------------------------------------------------
# load_skill — happy path
# ---------------------------------------------------------------------------


def test_load_skill_valid(tmp_path: Path) -> None:
    skill = make_skill(
        tmp_path,
        "my-skill",
        f"---\n{VALID_FRONTMATTER}\n---\n\n## Overview\nShort body here.\n",
    )
    result, err = optimize.load_skill(skill)
    assert err is None
    assert result["name"] == "my-skill"
    assert result["description"] == "Use when you need to validate something."
    assert result["chars"] > 0
    assert result["over_budget"] is False
    assert result["section_candidates"] == []
    assert result["warnings"] == []


# ---------------------------------------------------------------------------
# load_skill — missing / unreadable SKILL.md
# ---------------------------------------------------------------------------


def test_load_skill_no_file(tmp_path: Path) -> None:
    result, err = optimize.load_skill(tmp_path / "nonexistent")
    assert err is None
    assert result["error"] == "SKILL.md not found"


# ---------------------------------------------------------------------------
# load_skill — frontmatter parsing edge cases (regression: NameError/AttributeError)
# ---------------------------------------------------------------------------


def test_load_skill_no_frontmatter(tmp_path: Path) -> None:
    """Previously crashed with NameError: fm was never assigned."""
    content = "Some content without frontmatter.\n\n## Section\nbody\n"
    skill = make_skill(tmp_path, "no-fm", content)
    result, err = optimize.load_skill(skill)
    assert err is None
    assert result["name"] is None
    assert any("No/invalid YAML frontmatter" in w for w in result["warnings"])


def test_load_skill_missing_close_delimiter(tmp_path: Path) -> None:
    content = "---\nname: x\ndescription: 'use when yes'\nno closing"
    skill = make_skill(tmp_path, "open-only", content)
    result, _ = optimize.load_skill(skill)
    assert any("No/invalid YAML frontmatter" in w for w in result["warnings"])


def test_load_skill_invalid_yaml(tmp_path: Path) -> None:
    """Previously crashed with NameError: yaml.YAMLError left fm unbound."""
    content = (
        "---\nname: [unclosed\n  - list\n"
        "description: 'use when yes'\n---\n\n## S\nbody\n"
    )
    skill = make_skill(tmp_path, "bad-yaml", content)
    result, err = optimize.load_skill(skill)
    assert err is None
    assert any("Invalid YAML in frontmatter" in w for w in result["warnings"])
    # fm falls back to {} so downstream access doesn't crash
    assert result["name"] is None


def test_load_skill_frontmatter_is_list(tmp_path: Path) -> None:
    """Previously crashed with AttributeError: fm was a list, not a dict."""
    content = "---\n- item1\n- item2\n---\n\ndescription: not reached\n"
    skill = make_skill(tmp_path, "fm-list", content)
    result, err = optimize.load_skill(skill)
    assert err is None
    assert any("Frontmatter must be a YAML mapping" in w for w in result["warnings"])
    assert result["name"] is None
    assert result["description"] == ""


def test_load_skill_frontmatter_is_scalar(tmp_path: Path) -> None:
    content = "---\njust a string\n---\n\n## S\nbody\n"
    skill = make_skill(tmp_path, "fm-scalar", content)
    result, _ = optimize.load_skill(skill)
    assert any("Frontmatter must be a YAML mapping" in w for w in result["warnings"])


# ---------------------------------------------------------------------------
# load_skill — validation warnings
# ---------------------------------------------------------------------------


def test_load_skill_name_mismatch(tmp_path: Path) -> None:
    content = (
        "---\nname: wrong-name\ndescription: 'use when yes'\n---\n\n## S\nbody\n"
    )
    skill = make_skill(tmp_path, "actual-name", content)
    result, _ = optimize.load_skill(skill)
    assert result["name"] == "wrong-name"
    assert any("does not match directory name" in w for w in result["warnings"])


def test_load_skill_missing_name(tmp_path: Path) -> None:
    content = (
        "---\ndescription: 'use when yes'\n---\n\n## S\nbody\n"
    )
    skill = make_skill(tmp_path, "no-name", content)
    result, _ = optimize.load_skill(skill)
    assert any("Missing/empty required field: name" in w for w in result["warnings"])


def test_load_skill_missing_description(tmp_path: Path) -> None:
    content = (
        "---\nname: no-desc\ndescription: ''\n---\n\n## S\nbody\n"
    )
    skill = make_skill(tmp_path, "no-desc", content)
    result, _ = optimize.load_skill(skill)
    assert any("Missing/empty required field: description" in w for w in result["warnings"])


def test_load_skill_no_trigger_phrase(tmp_path: Path) -> None:
    content = (
        "---\nname: trigger-test\ndescription: 'A generic description without cues'\n---\n\n## S\nbody\n"
    )
    skill = make_skill(tmp_path, "trigger-test", content)
    result, _ = optimize.load_skill(skill)
    assert any("no concrete trigger phrase" in w for w in result["warnings"])


def test_load_skill_trigger_phrase_present(tmp_path: Path) -> None:
    content = (
        "---\nname: trigger-ok\ndescription: 'Validate skills before deploying'\n---\n\n## S\nbody\n"
    )
    skill = make_skill(tmp_path, "trigger-ok", content)
    result, _ = optimize.load_skill(skill)
    assert not any("no concrete trigger phrase" in w for w in result["warnings"])


