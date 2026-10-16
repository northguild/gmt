# /// script
# requires-python = ">=3.12"
# dependencies = ["pytest"]
# ///
"""Tests for plan_gate.py: a story may be implemented only once its plan is approved.

Run with:
    python3 -m pytest -q .agents/skills
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

_spec = importlib.util.spec_from_file_location("plan_gate", Path(__file__).parent / "plan_gate.py")
assert _spec is not None and _spec.loader is not None
plan_gate = importlib.util.module_from_spec(_spec)
sys.modules["plan_gate"] = plan_gate
_spec.loader.exec_module(plan_gate)

LIB = "context/domination/specs/MAR-16"
DOX = "context/dox/specs/mar-16"


def index(status: str = "approved", dox: str = "none", links: str = "[a](a.md)") -> str:
    return f"---\nstory: MAR-16\nstatus: {status}\ndox: {dox}\n---\n\n# MAR-16\n\n| Slice |\n| {links} |\n"


def write(root: Path, rel: str, text: str) -> None:
    p = root / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text)


def problems(root: Path, story: str = "MAR-16") -> list[str]:
    return plan_gate.check(root, story)


@pytest.mark.parametrize(
    ("branch", "story"),
    [
        ("feature/197-mar-16-gpstoutc-utctogps", "MAR-16"),
        ("feature/289-dox-e1c-chat-tools", "DOX-E1C"),
        ("fix/12-core-8-range-edges", "CORE-8"),
        ("feature/304-dox-three-intermodal-tools", None),
        ("main", None),
    ],
)
def test_story_from_branch(branch: str, story: str | None) -> None:
    assert plan_gate.story_from_branch(branch) == story


def test_approved_plan_without_dox_passes(tmp_path: Path) -> None:
    write(tmp_path, f"{LIB}/index.md", index())
    write(tmp_path, f"{LIB}/a.md", "slice\n")
    assert problems(tmp_path) == []


def test_missing_index_fails(tmp_path: Path) -> None:
    assert any("no spec" in p for p in problems(tmp_path))


def test_draft_status_fails(tmp_path: Path) -> None:
    write(tmp_path, f"{LIB}/index.md", index(status="draft"))
    write(tmp_path, f"{LIB}/a.md", "slice\n")
    assert any("not approved" in p for p in problems(tmp_path))


def test_missing_dox_decision_fails(tmp_path: Path) -> None:
    write(tmp_path, f"{LIB}/index.md", "---\nstatus: approved\n---\n[a](a.md)\n")
    write(tmp_path, f"{LIB}/a.md", "slice\n")
    assert any("dox" in p for p in problems(tmp_path))


def test_missing_and_oversized_slices_fail(tmp_path: Path) -> None:
    write(tmp_path, f"{LIB}/index.md", index(links="[a](a.md) [b](b.md)"))
    write(tmp_path, f"{LIB}/a.md", "x\n" * 201)
    found = problems(tmp_path)
    assert any("b.md" in p and "missing" in p for p in found)
    assert any("a.md" in p and "201 lines" in p for p in found)


def test_no_slices_fails(tmp_path: Path) -> None:
    write(tmp_path, f"{LIB}/index.md", index(links="none"))
    assert any("no slice" in p for p in problems(tmp_path))


def test_oversized_index_fails(tmp_path: Path) -> None:
    write(tmp_path, f"{LIB}/index.md", index() + "x\n" * 150)
    write(tmp_path, f"{LIB}/a.md", "slice\n")
    assert any("index.md" in p and "lines" in p for p in problems(tmp_path))


def test_dox_spec_must_be_approved_too(tmp_path: Path) -> None:
    write(tmp_path, f"{LIB}/index.md", index(dox=f"{DOX}/index.md"))
    write(tmp_path, f"{LIB}/a.md", "slice\n")
    write(tmp_path, f"{DOX}/index.md", index(status="draft", links="[t](tool.md)"))
    write(tmp_path, f"{DOX}/tool.md", "tool\n")
    assert any("mar-16" in p and "not approved" in p for p in problems(tmp_path))


def test_dox_story_uses_dox_specs_only(tmp_path: Path) -> None:
    write(tmp_path, "context/dox/specs/dox-e1c/index.md", index(links="[t](t.md)"))
    write(tmp_path, "context/dox/specs/dox-e1c/t.md", "tool\n")
    assert problems(tmp_path, "DOX-E1C") == []


def test_main_exit_codes(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert plan_gate.main(["MAR-16", "--root", str(tmp_path)]) == 1
    assert "FAIL" in capsys.readouterr().out
    write(tmp_path, f"{LIB}/index.md", index())
    write(tmp_path, f"{LIB}/a.md", "slice\n")
    assert plan_gate.main(["MAR-16", "--root", str(tmp_path)]) == 0
    assert "PASS" in capsys.readouterr().out
