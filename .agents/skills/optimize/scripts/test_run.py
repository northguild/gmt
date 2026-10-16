# /// script
# requires-python = ">=3.12"
# dependencies = ["pytest"]
# ///
"""Tests for optimize/scripts/run.py: one short summary from both optimizer reports.

Run with:
    python3 -m pytest -q .agents/skills
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

_spec = importlib.util.spec_from_file_location("optimize_run", Path(__file__).parent / "run.py")
assert _spec is not None and _spec.loader is not None
run = importlib.util.module_from_spec(_spec)
sys.modules["optimize_run"] = run
_spec.loader.exec_module(run)

R = "/repo"
AO = {
    "entry_files": [{"file": f"{R}/AGENTS.md", "warnings": ["AGENTS.md is 9462 chars"]}],
    "context": {
        "files": [{"file": f"{R}/context/big.md", "warnings": ["600 lines (budget 200)"]}],
        "orphans": [f"{R}/context/old.md"],
        "broken_links": [{"file": f"{R}/context/a.md", "link": "gone.md"}],
        "near_duplicates": [],
    },
    "personas": [{"file": f"{R}/.agents/tdd-dev.md", "warnings": ["model is inherit"]}],
    "sync": {
        "agents": {"missing": ["tester"], "wrong_target": [], "dangling": [], "extra": []},
        "skills": {"missing": [], "wrong_target": [], "dangling": [], "extra": []},
        "kilo": {"exists": True, "missing_personas": [], "bad_prompts": []},
    },
    "summary": {"orphans": 1, "broken_links": 1},
}
SO = {
    "skills": [
        {"dir": f"{R}/.agents/skills/foo", "name": "foo", "warnings": ["SKILL.md is 211 lines"]},
        {"dir": f"{R}/.agents/skills/bar", "name": "bar", "warnings": []},
    ],
    "inventory": {"duplicate_names": [], "similar_descriptions": []},
}


def test_findings_collects_every_kind() -> None:
    found = run.findings(AO, SO, Path(R))
    paths = {p for p, _ in found}
    assert {"AGENTS.md", "context/big.md", "context/old.md", "context/a.md",
            ".agents/tdd-dev.md", ".agents/skills/foo"} <= paths
    assert ("(repo)", "sync: agents missing: tester") in found


def test_relevant_keeps_changed_files_and_repo_wide() -> None:
    found = run.findings(AO, SO, Path(R))
    changed = {"context/big.md", ".agents/skills/foo/SKILL.md"}
    kept = run.relevant(found, changed)
    assert ("context/big.md", "600 lines (budget 200)") in kept
    assert (".agents/skills/foo", "SKILL.md is 211 lines") in kept
    assert ("(repo)", "sync: agents missing: tester") in kept
    assert not [p for p, _ in kept if p in ("context/old.md", "AGENTS.md")]


def test_render_is_short_and_counts_backlog() -> None:
    found = run.findings(AO, SO, Path(R))
    text = run.render(found, run.relevant(found, {"context/big.md"}), limit=2)
    lines = text.splitlines()
    assert lines[0].startswith("FAIL")
    assert any("backlog" in line for line in lines)
    assert len([line for line in lines if line.startswith("- ")]) <= 2


def test_render_pass_when_nothing_relevant() -> None:
    found = run.findings({"context": {}, "sync": {}}, {"skills": []}, Path(R))
    assert run.render(found, [], limit=30).startswith("PASS")
