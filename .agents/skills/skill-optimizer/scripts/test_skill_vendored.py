# /// script
# requires-python = ">=3.12"
# dependencies = ["pytest"]
# ///
"""Tests for skill-optimizer: skills vendored through skills-lock.json.

Run with:
    python3 -m pytest -q .agents/skills
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

_spec = importlib.util.spec_from_file_location("optimize_vendored", Path(__file__).parent / "optimize.py")
assert _spec is not None and _spec.loader is not None
optimize = importlib.util.module_from_spec(_spec)
sys.modules["optimize_vendored"] = optimize
_spec.loader.exec_module(optimize)

NO_TRIGGER = "---\nname: v\ndescription: Does v.\n---\n\nBody.\n"


def make(tmp_path: Path, locked: bool) -> Path:
    skill = tmp_path / ".agents" / "skills" / "v"
    skill.mkdir(parents=True)
    (skill / "SKILL.md").write_text(NO_TRIGGER)
    lock = {"version": 1, "skills": {"v": {"source": "someone/skills"}} if locked else {}}
    (tmp_path / "skills-lock.json").write_text(json.dumps(lock))
    return skill


def test_vendored_skill_reports_notes_not_warnings(tmp_path: Path) -> None:
    report, err = optimize.load_skill(make(tmp_path, locked=True))
    assert err is None
    assert report["vendored"] == "someone/skills"
    assert not [w for w in report["warnings"] if "trigger" in str(w)]
    assert any("trigger" in str(n) and "upstream" in str(n) for n in report["notes"])


def test_own_skill_still_warns(tmp_path: Path) -> None:
    report, err = optimize.load_skill(make(tmp_path, locked=False))
    assert err is None
    assert report["vendored"] is None
    assert any("trigger" in str(w) for w in report["warnings"])
