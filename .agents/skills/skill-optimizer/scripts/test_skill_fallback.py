# /// script
# requires-python = ">=3.9"
# dependencies = ["pytest"]
# ///
"""Tests for skill-optimizer: PyYAML-free frontmatter fallback.

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


import fm_parse  # noqa: E402  (importable once optimize.py has put scripts/ on sys.path)

BLOCKS = {
    "plain": ("name: a\ndescription: Use when you validate", {"name": "a", "description": "Use when you validate"}),
    "quoted": (
        "name: a\ndescription: 'Use when it''s odd: really'\nx: \"q\\\"d\"",
        {"name": "a", "description": "Use when it's odd: really", "x": 'q"d'},
    ),
    "folded": (
        "name: a\ndescription: >\n  Use when one\n  and two\nz: 1",
        {"name": "a", "description": "Use when one and two\n", "z": "1"},
    ),
    "literal": (
        "name: a\ndescription: |-\n  line1\n  line2\n",
        {"name": "a", "description": "line1\nline2"},
    ),
    "metadata": (
        "name: a\nmetadata:\n  author: me\n  version: 1.0\ndescription: d",
        {"name": "a", "metadata": {"author": "me", "version": "1.0"}, "description": "d"},
    ),
}


@pytest.fixture
def no_yaml(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(fm_parse, "yaml", None)


@pytest.mark.parametrize("key", sorted(BLOCKS))
def test_fallback_parses_blocks(no_yaml: None, key: str) -> None:
    block, expected = BLOCKS[key]
    got = fm_parse.parse_frontmatter(block)
    assert isinstance(got, dict)
    for k, v in expected.items():
        assert str(got[k]) == str(v) if k != "metadata" else got[k] == v


@pytest.mark.parametrize("key", ["plain", "quoted", "folded"])
def test_fallback_matches_yaml(monkeypatch: pytest.MonkeyPatch, key: str) -> None:
    pytest.importorskip("yaml")
    block, _ = BLOCKS[key]
    with_yaml = fm_parse.parse_frontmatter(block)
    monkeypatch.setattr(fm_parse, "yaml", None)
    assert fm_parse.parse_frontmatter(block)["description"].strip() == with_yaml["description"].strip()


def test_load_skill_without_yaml(no_yaml: None, tmp_path: Path) -> None:
    skill = make_skill(tmp_path, "my-skill", f"---\n{VALID_FRONTMATTER}\n---\n\n## S\nbody\n")
    result, err = optimize.load_skill(skill)
    assert err is None
    assert result["name"] == "my-skill"
    assert result["description"] == "Use when you need to validate something."
    assert result["warnings"] == []


def test_fallback_list_is_not_mapping(no_yaml: None, tmp_path: Path) -> None:
    skill = make_skill(tmp_path, "fm-list", "---\n- a\n- b\n---\n\nx\n")
    result, _ = optimize.load_skill(skill)
    assert any("must be a YAML mapping" in w for w in result["warnings"])


def test_fallback_unclosed_flow_is_invalid(no_yaml: None, tmp_path: Path) -> None:
    skill = make_skill(tmp_path, "bad", "---\nname: [unclosed\ndescription: 'use when yes'\n---\n\nx\n")
    result, _ = optimize.load_skill(skill)
    assert any("Invalid YAML in frontmatter" in w for w in result["warnings"])
    assert result["name"] is None
