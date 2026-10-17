# /// script
# requires-python = ">=3.9"
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

# Fixture story: these tests never read a real spec under context/.
LIB = "context/domination/specs/FIX-1"
DOX = "context/dox/specs/fix-1"


def index(status: str = "approved", dox: str = "none", links: str = "[a](a.md)") -> str:
    return f"---\nstory: FIX-1\nstatus: {status}\ndox: {dox}\n---\n\n# FIX-1\n\n| Slice |\n| {links} |\n"


def write(root: Path, rel: str, text: str) -> None:
    p = root / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text)


def problems(root: Path, story: str = "FIX-1") -> list[str]:
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
    assert any("fix-1" in p and "not approved" in p for p in problems(tmp_path))


def test_dox_story_uses_dox_specs_only(tmp_path: Path) -> None:
    write(tmp_path, "context/dox/specs/dox-e1c/index.md", index(links="[t](t.md)"))
    write(tmp_path, "context/dox/specs/dox-e1c/t.md", "tool\n")
    assert problems(tmp_path, "DOX-E1C") == []


def test_main_exit_codes(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert plan_gate.main(["FIX-1", "--root", str(tmp_path)]) == 1
    assert "FAIL" in capsys.readouterr().out
    write(tmp_path, f"{LIB}/index.md", index())
    write(tmp_path, f"{LIB}/a.md", "slice\n")
    assert plan_gate.main(["FIX-1", "--root", str(tmp_path)]) == 0
    assert "PASS" in capsys.readouterr().out


@pytest.mark.parametrize("line, expected", [
    ("status: draft        # approved only after review", "draft"),
    ("status: 'approved'", "approved"),
    ('status: "approved"', "approved"),
    ('dox: "none"', "none"),
    ("dox: context/dox/specs/x/index.md # the Dox spec", "context/dox/specs/x/index.md"),
])
def test_frontmatter_strips_comments_and_quotes(line: str, expected: str) -> None:
    fields = plan_gate.frontmatter(f"---\n{line}\n---\n")
    assert next(iter(fields.values())) == expected


@pytest.mark.parametrize("dox, word", [("/tmp/x/index.md", "absolute"), ("../outside/index.md", "outside")])
def test_dox_path_outside_repo_fails_without_traceback(tmp_path: Path, dox: str, word: str) -> None:
    write(tmp_path, f"{LIB}/index.md", index(dox=dox))
    write(tmp_path, f"{LIB}/a.md", "slice\n")
    assert any("dox path" in p and word in p for p in problems(tmp_path))
