# /// script
# requires-python = ">=3.9"
# dependencies = ["pytest"]
# ///
"""Tests for skill-optimizer: referenced-file resolution.

Run with:
    python3 -m pytest -q .agents/skills
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

_spec = importlib.util.spec_from_file_location("optimize_refs", Path(__file__).parent / "optimize.py")
assert _spec is not None and _spec.loader is not None
optimize = importlib.util.module_from_spec(_spec)
sys.modules["optimize_refs"] = optimize
_spec.loader.exec_module(optimize)

SKILL = "---\nname: s\ndescription: Does s. Use when the user asks to \"run s\".\n---\n\nRun `{ref}`.\n"


def make(tmp_path: Path, ref: str) -> Path:
    skill = tmp_path / ".agents" / "skills" / "s"
    skill.mkdir(parents=True)
    (skill / "SKILL.md").write_text(SKILL.format(ref=ref))
    return skill


def warnings(skill: Path) -> list[str]:
    report, err = optimize.load_skill(skill)
    assert err is None
    return [str(w) for w in report["warnings"]]


def test_ref_resolves_from_repo_root(tmp_path: Path) -> None:
    skill = make(tmp_path, "scripts/stats.mjs")
    (tmp_path / "scripts").mkdir()
    (tmp_path / "scripts" / "stats.mjs").write_text("")
    assert not [w for w in warnings(skill) if "not found" in w]


def test_ref_missing_everywhere_is_reported(tmp_path: Path) -> None:
    skill = make(tmp_path, "scripts/gone.mjs")
    assert any("scripts/gone.mjs" in w for w in warnings(skill))
