# /// script
# requires-python = ">=3.9"
# dependencies = ["pytest"]
# ///
"""Tests for skill-optimizer: inventory and main.

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
# find_skills
# ---------------------------------------------------------------------------


def test_find_skills(tmp_path: Path) -> None:
    make_skill(tmp_path, "skill-a", f"---\n{VALID_FRONTMATTER}\n---\n")
    make_skill(tmp_path, "skill-b", f"---\n{VALID_FRONTMATTER}\n---\n")
    non_skill = tmp_path / "not-a-skill"
    non_skill.mkdir()
    found = optimize.find_skills(tmp_path)
    names = sorted(p.name for p in found)
    assert names == ["skill-a", "skill-b"]


def test_find_skills_empty(tmp_path: Path) -> None:
    assert optimize.find_skills(tmp_path) == []


# ---------------------------------------------------------------------------
# inventory_findings
# ---------------------------------------------------------------------------


def _skill_dict(name: str, desc: str, dir_: str = "/tmp/x") -> dict:
    return {"dir": dir_, "name": name, "description": desc}


def test_inventory_no_duplicates(tmp_path: Path) -> None:
    skills = [_skill_dict("a", "use when you need to validate"), _skill_dict("b", "lint code for temporal patterns")]
    inv = optimize.inventory_findings(skills)
    assert inv["duplicate_names"] == []
    assert inv["similar_descriptions"] == []


def test_inventory_duplicate_names(tmp_path: Path) -> None:
    skills = [
        _skill_dict("same", "use when x", "/tmp/a"),
        _skill_dict("same", "use when y", "/tmp/b"),
    ]
    inv = optimize.inventory_findings(skills)
    assert len(inv["duplicate_names"]) == 1
    assert inv["duplicate_names"][0]["name"] == "same"
    assert sorted(inv["duplicate_names"][0]["dirs"]) == [str(Path("/tmp/a")), str(Path("/tmp/b"))]


def test_inventory_similar_descriptions(tmp_path: Path) -> None:
    desc_a = "validate skills before deploying"
    desc_b = "validate skills before deploying"
    skills = [_skill_dict("a", desc_a), _skill_dict("b", desc_b)]
    inv = optimize.inventory_findings(skills)
    assert len(inv["similar_descriptions"]) == 1
    assert inv["similar_descriptions"][0]["ratio"] >= optimize.DESCRIPTION_SIMILARITY


def test_inventory_distinct_descriptions(tmp_path: Path) -> None:
    skills = [
        _skill_dict("a", "use when you need to validate"),
        _skill_dict("b", "lint code for temporal patterns"),
    ]
    inv = optimize.inventory_findings(skills)
    assert inv["similar_descriptions"] == []


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------


def test_main_single_dir(tmp_path: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch) -> None:
    content = "---\nname: main-test\ndescription: 'use when yes'\n---\n\n## S\nbody\n"
    skill = make_skill(tmp_path, "main-test", content)
    monkeypatch.setattr(sys, "argv", ["optimize.py", str(skill)])
    with pytest.raises(SystemExit) as exc_info:
        optimize.main()
    assert exc_info.value.code == 0
    out = json.loads(capsys.readouterr().out)
    assert out["name"] == "main-test"
    assert out["dir"] == str(skill)


def test_main_all_mode(tmp_path: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch) -> None:
    make_skill(tmp_path, "skill-one", "---\nname: skill-one\ndescription: 'use when yes'\n---\n\n## Body\nx\n")
    make_skill(tmp_path, "skill-two", "---\nname: skill-two\ndescription: 'lint code for patterns'\n---\n\n## Body\ny\n")
    monkeypatch.setattr(sys, "argv", ["optimize.py", "--all", str(tmp_path)])
    with pytest.raises(SystemExit) as exc_info:
        optimize.main()
    assert exc_info.value.code == 0
    out = json.loads(capsys.readouterr().out)
    assert "skills" in out
    assert "inventory" in out
    assert len(out["skills"]) == 2
    names = sorted(s["name"] for s in out["skills"])
    assert names == ["skill-one", "skill-two"]


def test_main_not_a_directory(capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(sys, "argv", ["optimize.py", "/nonexistent/path/that/does/not/exist"])
    with pytest.raises(SystemExit) as exc_info:
        optimize.main()
    assert exc_info.value.code == 1
    out = json.loads(capsys.readouterr().out)
    assert "error" in out
